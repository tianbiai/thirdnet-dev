/**
 * ParkScene —— 园区数字孪生中央 3D 场景（v2.0 范式实现）。
 *
 * 这是技能随包发布的「范式实现」：生成器拷贝本文件为目标项目的 `src/scene/ParkScene.ts`，
 * 再按 spec（脚手架数据源、spec.style、token）改写。**不要从散文合成**——本文件已把
 * v1.9 漂移项（scene.background 渐变 / ambientFloor / 程序化地面纹理）和 v2.0 写实增强层
 * （RoomEnvironment 环境贴图 / EffectComposer+Bloom / GTAO / 地面反射）全部落地。
 *
 * v2.0 写实纪律（与 styles.md 一致）：
 * - realistic / night-realistic 放宽上限：开环境贴图 + GTAO（+ 夜间地面反射）。
 * - 其余 5 风格守纪律：无环境贴图、无 AO、PointLight≤8、transmission 禁用、DPR≤2。
 * - 无 WebGL2 时降级：禁 AO/反射/transmission、bloom 降级、环境贴图退化为更高强度 ambient。
 *
 * 能力：脚手架静态几何 → hydrateBuildings / hydratePois 动态水合；setStyle 7 风格运行时
 * 切换；交互拾取楼栋/楼层/POI；focusBuilding 相机补间；setSelection 金色高亮；完整 dispose。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import gridFrag from './shaders/gridGround.glsl?raw'
import { buildBuilding, buildRooftopKit } from './building-geometry'
import { fresnelRimBody } from './shaders/fresnelRimInjector'
import { applyTheme, type StyleKey, type ThemeTokens } from '@/utils/theme'
import type { BuildingRuntimeItem, PoiRuntimeItem } from '@/api/types/digital-twin'
import { PoiStatusEnum, PoiTypeEnum } from '@/api/types/digital-twin'
import type { ParkScaffold, ScaffoldBuilding } from '@/data/park'

export interface ParkSceneCallbacks {
  onHover?: (bid: string | null, fin: number | null) => void
  onSelect?: (bid: string, fin: number) => void
  onDeselect?: () => void
  onPoiOpen?: (poiId: string | null) => void
  /** v2.1：POI 悬停（驱动 HTML 名称条，§11「名称仅悬停」契约；未命中传 null）。 */
  onPoiHover?: (poiId: string | null) => void
  /** v2.2：航拍巡航因用户拖拽自动退出（§13）——GlobalTwin 映射到 useTour.disable()，单向同步按钮态。 */
  onTourAutoExit?: () => void
}

interface StyleProfile {
  toneMapping: THREE.ToneMapping
  toneExposure: number
  shadows: boolean
  ground: 'grid' | 'pbr' | 'dark' | 'light' | 'flat'
  building: 'emissive' | 'pbr' | 'pbr-night' | 'wire' | 'holo' | 'white' | 'flat'
  flatShading?: boolean
  useRim?: boolean
  /** 是否烘焙并挂载 RoomEnvironment 环境贴图（写实三风格）。 */
  envMap: boolean
  /** 是否启用后处理 composer（含 bloom）。 */
  composer: boolean
  /** 是否启用 GTAO 接触阴影（写实两风格）。 */
  ao: boolean
  /** 是否启用地面湿润反射（夜间）。 */
  reflect: boolean
}

const PROFILES: Record<StyleKey, StyleProfile> = {
  // realistic/night-realistic 放宽上限：env + composer + AO（夜再 +reflect）
  realistic:         { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.1, shadows: true,  ground: 'pbr',   building: 'pbr',        composer: false, envMap: true,  ao: true,  reflect: false },
  'night-realistic': { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 0.95, shadows: true, ground: 'dark',  building: 'pbr-night',  composer: true,  envMap: true,  ao: true,  reflect: true },
  // holographic / cyber：bloom 为主，无 env/AO/反射
  cyber:             { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.0, shadows: false, ground: 'grid',  building: 'emissive',   composer: true,  envMap: false, ao: false, reflect: false },
  holographic:       { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.0, shadows: false, ground: 'dark',  building: 'holo', useRim: true, composer: true,  envMap: false, ao: false, reflect: false },
  // 纪律风格：无 env/bloom/AO/反射
  blueprint:         { toneMapping: THREE.NoToneMapping, toneExposure: 1.0, shadows: false, ground: 'grid',  building: 'wire',       composer: false, envMap: false, ao: false, reflect: false },
  'white-model':     { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.05, shadows: true, ground: 'light', building: 'white',     composer: false, envMap: false, ao: false, reflect: false },
  isometric:         { toneMapping: THREE.NoToneMapping, toneExposure: 1.0, shadows: false, ground: 'flat', building: 'flat', flatShading: true, composer: false, envMap: false, ao: false, reflect: false },
}

// 选中层配色缺省值（各风格主题 ui.selectionBorder/Fill/Opacity 覆盖之；未定义时回退此处）
const FLOOR_HIGHLIGHT_COLOR = 0xff3300
const FLOOR_FILL_COLOR = 0xccffff
const FLOOR_FILL_OPACITY = 0.4
const DEFAULT_FLOOR_ESTIMATE = 18

export class ParkScene {
  private canvas: HTMLCanvasElement
  private scaffold: ParkScaffold
  private cb: ParkSceneCallbacks

  private renderer!: THREE.WebGLRenderer
  private camera!: THREE.OrthographicCamera
  private controls!: OrbitControls
  private sceneObj = new THREE.Scene()
  private sceneGroup = new THREE.Group()
  /**
   * Overlay 场景：所有 CanvasTexture 广告牌 sprite（楼顶名称 / 车库 P / 地面车位 P / 连廊名 / POI 图标）
   * 挂这里，在 composer 之后第二遍渲染——绕过 GTAO（realistic/night 会把漂浮 sprite 像素乘向黑）与 bloom。
   * sprite 不受光，此场景无需灯光；sprite 统一 depthTest:false 始终置顶（楼顶名/标记置顶可接受）。
   */
  private overlayScene = new THREE.Scene()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pointerDownPos = { x: 0, y: 0 }

  /** v2.0 后处理：composer / bloom / AO。仅写实与发光风格启用。 */
  private composer: EffectComposer | null = null
  private bloomPass: UnrealBloomPass | null = null
  private gtaoPass: GTAOPass | null = null
  /** v2.0 环境贴图（RoomEnvironment PMREM），写实三风格共享。 */
  private envMapTarget: THREE.WebGLRenderTarget | null = null
  /** v2.0 夜间地面反射。 */
  private reflector: Reflector | null = null
  private pmrem: THREE.PMREMGenerator | null = null

  /** WebGL2 能力（决定能否开 AO/反射/transmission/PMREM）。 */
  private readonly isWebGL2: boolean

  private style: StyleKey = 'cyber'
  private tokens!: ThemeTokens
  private profile!: StyleProfile

  private pickables: THREE.Object3D[] = []
  private poiPickables: THREE.Object3D[] = []
  private buildingMap = new Map<string, {
    group: THREE.Group
    slabs: THREE.Mesh[]
    floors: number
    w: number; d: number; x: number; z: number
  }>()
  private floorIdMap = new Map<string, string>()
  private poiMap = new Map<string, PoiRuntimeItem>()

  private hydratedBuildings: BuildingRuntimeItem[] | null = null
  private hydratedPois: PoiRuntimeItem[] | null = null

  private selectionOverlay: THREE.LineSegments
  private selectionFill: THREE.Mesh
  private selectionFillMat!: THREE.MeshBasicMaterial
  private tween: { active: boolean; start: number; dur: number; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromZoom: number; toZoom: number } | null = null
  private defaultTarget = new THREE.Vector3(0, 0, 0)
  private defaultZoom = 1

  // v2.2 航拍巡航（§13）：取景过渡 tween（进/出）+ autoRotate 稳态环绕。
  // 与 §8 focus tween 同源纪律——事件触发 + 有限时长，结束后把缩放/平移/旋转完整交还 OrbitControls。
  private static readonly DEFAULT_K = 0.66
  private static readonly DEFAULT_ELEV = Math.atan(1 / Math.sqrt(2))
  private static readonly DEFAULT_AZ = Math.PI / 4
  private curK = ParkScene.DEFAULT_K
  private curElev = ParkScene.DEFAULT_ELEV
  private frameTween: { active: boolean; start: number; dur: number; fromK: number; toK: number; fromElev: number; toElev: number; onDone?: () => void } | null = null
  private tourMode = false   // true = 已请求巡航（含进入过渡期）；setTourEnabled(false) 完成退出过渡后才回 false
  private tourActive = false // true = 进入过渡已完成、autoRotate 已开

  private rafId = 0
  private ro!: ResizeObserver
  private resizeTimer: number | undefined
  private contextLost = false
  private reducedMotion = false
  private disposed = false

  constructor(canvas: HTMLCanvasElement, scaffold: ParkScaffold, cb: ParkSceneCallbacks = {}) {
    this.canvas = canvas
    this.scaffold = scaffold
    this.cb = cb
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.isWebGL2 = this.detectWebGL2(canvas)

    this.tokens = applyTheme('cyber')
    this.profile = PROFILES['cyber']

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 8000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.minPolarAngle = 0.5
    this.controls.maxPolarAngle = 1.3
    this.controls.minZoom = 0.45
    this.controls.maxZoom = 2.6
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

    const boxGeo = new THREE.BoxGeometry(1, 1, 1)
    const edges = new THREE.EdgesGeometry(boxGeo)
    const mat = new THREE.LineBasicMaterial({ color: FLOOR_HIGHLIGHT_COLOR, transparent: true, opacity: 1.0 })
    this.selectionOverlay = new THREE.LineSegments(edges, mat)
    this.selectionOverlay.visible = false
    this.sceneGroup.add(this.selectionOverlay)
    boxGeo.dispose()

    // 选中楼层填充层（仅 4 个立面，不含顶/底）：与 selectionOverlay 同盒缩放。
    // BoxGeometry 6 面 material index 顺序 = [+X,-X,+Y(顶),-Y(底),+Z,-Z]；顶/底用 visible:false
    // 空材质跳过，只渲染 4 个立面（贴合「只填 4 面」）。MeshBasicMaterial 不受光；depthTest:false
    // 让填充不被楼体不透明立面遮挡；renderOrder=-1 保证边框（LineSegments）画在其上。
    const fillFaceMat = new THREE.MeshBasicMaterial({ color: FLOOR_FILL_COLOR, transparent: true, opacity: FLOOR_FILL_OPACITY, depthWrite: false, depthTest: false })
    const skipMat = new THREE.MeshBasicMaterial({ visible: false })
    this.selectionFill = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      [fillFaceMat, fillFaceMat, skipMat, skipMat, fillFaceMat, fillFaceMat],
    )
    this.selectionFillMat = fillFaceMat   // 保留引用，updateSelectionColors 按风格改色
    this.selectionFill.renderOrder = -1
    this.selectionFill.visible = false
    this.sceneGroup.add(this.selectionFill)

    this.sceneObj.add(this.sceneGroup)
    this.applyProfile()
    this.rebuildScene()
    this.frameCamera()

    this.ro = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer)
      this.resizeTimer = window.setTimeout(() => this.onResize(), 150)
    })
    this.ro.observe(canvas)
    this.bindPointer()
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)

    this.animate()
  }

  // ---------- WebGL2 检测（v1.8/v2.0 降级依据） ----------

  /**
   * 在「一次性 canvas」上探测 WebGL2，绝不触碰真实 canvas——
   * 一旦对 canvas 调 getContext('webgl2') 会固化其上下文属性，之后 Three.js 以 {alpha,antialias,...}
   * 再取会拿到 null；更不能 loseContext()（会销毁上下文）。故用独立探测 canvas。
   */
  private detectWebGL2(_canvas: HTMLCanvasElement): boolean {
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2')
      return !!gl
    } catch { /* ignore */ }
    return false
  }

  // ---------- 风格 ----------

  setStyle(style: StyleKey) {
    this.style = style
    this.tokens = applyTheme(style)
    this.profile = PROFILES[style]
    this.applyProfile()
    this.rebuildScene()
    this.frameCamera()
  }

  private applyProfile() {
    const p = this.profile
    this.renderer.toneMapping = p.toneMapping
    this.renderer.toneMappingExposure = p.toneExposure
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = p.shadows
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // v1.9 显式 scene.background（顶→底渐变 CanvasTexture）—— 防黑屏关键，取代 setClearColor 纯色。
    this.sceneObj.background = this.makeBackgroundTexture(this.tokens.scene.bgTop, this.tokens.scene.bgBottom)
    this.sceneObj.fog = this.makeFog()
    this.updateSelectionColors()   // 按当前风格 token 更新选中层边框/填充色
  }

  /** 选中层配色随风格 token（ui.selectionBorder/Fill/Opacity）变化；缺省回退常量。 */
  private updateSelectionColors() {
    const ui = (this.tokens.ui ?? {}) as Record<string, unknown>
    const border = ui.selectionBorder as string | undefined
    const fill = ui.selectionFill as string | undefined
    const opacity = typeof ui.selectionFillOpacity === 'number' ? ui.selectionFillOpacity : FLOOR_FILL_OPACITY
    ;(this.selectionOverlay.material as THREE.LineBasicMaterial).color.set(border ?? FLOOR_HIGHLIGHT_COLOR)
    this.selectionFillMat.color.set(fill ?? FLOOR_FILL_COLOR)
    this.selectionFillMat.opacity = opacity
  }

  /**
   * v1.9 顶→底纵向渐变背景（防黑屏关键，取代 setClearColor 纯色）。
   * v2.1 程序化天空元素（token scene.sky 开关，画进同一张背景纹理、零运行时成本；
   * 种子 = style，同一风格重复生成一致）：stars=星空（上半部 150 颗）、moon=月亮
   * （右上象限径向光晕）、clouds=白云（3–6 朵椭圆组合）。canvas 加宽到 512 容纳横向分布。
   */
  private makeBackgroundTexture(top: string, bottom: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, top)
    grad.addColorStop(1, bottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 512, 256)

    const sky = (this.tokens.scene as Record<string, unknown>)?.sky as
      { clouds?: boolean; stars?: boolean; moon?: boolean } | undefined
    if (sky?.stars || sky?.moon || sky?.clouds) {
      const rnd = mulberry32(hashStr(`sky:${this.style}`))

      // 星空：上半 60% 区域，亚像素小点、低透明度（须低于 bloom 阈值，
      // 否则白点被 bloom 晕成「雪片」——宁可暗淡也不可抢戏）
      if (sky.stars) {
        for (let i = 0; i < 130; i++) {
          const x = rnd() * 512
          const y = rnd() * 256 * 0.6
          const r = 0.3 + rnd() * 0.6
          ctx.globalAlpha = 0.15 + rnd() * 0.3
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }

      // 月亮：右上象限，本体 + 径向光晕
      if (sky.moon) {
        const mx = 512 * 0.78
        const my = 256 * 0.16
        const glow = ctx.createRadialGradient(mx, my, 4, mx, my, 46)
        glow.addColorStop(0, 'rgba(255, 248, 224, 0.85)')
        glow.addColorStop(0.35, 'rgba(255, 248, 224, 0.25)')
        glow.addColorStop(1, 'rgba(255, 248, 224, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(mx, my, 46, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff8e0'
        ctx.beginPath()
        ctx.arc(mx, my, 14, 0, Math.PI * 2)
        ctx.fill()
      }

      // 白云：3–6 朵，每朵 3–5 个椭圆组合，上半 45% 区域（日间写实）
      if (sky.clouds) {
        const n = 3 + Math.floor(rnd() * 4)
        for (let c = 0; c < n; c++) {
          const cx = rnd() * 512
          const cy = rnd() * 256 * 0.45
          const baseR = 14 + rnd() * 16
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = 0.5 + rnd() * 0.3
          const blobs = 3 + Math.floor(rnd() * 3)
          for (let bIdx = 0; bIdx < blobs; bIdx++) {
            const bx = cx + (bIdx - blobs / 2) * baseR * 0.9
            const by = cy + (rnd() - 0.5) * baseR * 0.4
            const br = baseR * (0.6 + rnd() * 0.5)
            ctx.beginPath()
            ctx.ellipse(bx, by, br, br * 0.55, 0, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        ctx.globalAlpha = 1
      }
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  /** v2.0 线性雾（远景大气透视），由 token.realism.fog 驱动；null 则无雾。 */
  private makeFog(): THREE.Fog | null {
    const r = this.tokens.realism as Record<string, unknown> | undefined
    const fog = r?.fog as { color: string; near: number; far: number } | null | undefined
    if (!fog) return null
    return new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far)
  }

  private clearSceneGroup() {
    const keep = new Set<THREE.Object3D>([this.selectionOverlay, this.selectionFill])
    for (let i = this.sceneGroup.children.length - 1; i >= 0; i--) {
      const c = this.sceneGroup.children[i]
      if (keep.has(c)) continue
      this.sceneGroup.remove(c)
      this.disposeObject(c)
    }
    // overlay 场景（楼顶名/P 牌/POI 图标）同样清空释放——切风格/重建不残留叠影
    for (let i = this.overlayScene.children.length - 1; i >= 0; i--) {
      const c = this.overlayScene.children[i]
      this.overlayScene.remove(c)
      this.disposeObject(c)
    }
    this.pickables = []
    this.poiPickables = []
    this.buildingMap.clear()
    this.floorIdMap.clear()
    this.poiMap.clear()
  }

  private rebuildScene() {
    this.clearSceneGroup()
    this.disposePostFX()
    this.disposeReflector()
    this.buildLights()
    this.buildEnvironmentMap()   // v2.0：写实风格烘焙 RoomEnvironment（必须在材质创建前赋值 scene.environment）
    this.buildGround()
    this.buildEnvironment()
    for (const b of this.scaffold.buildings) {
      if (b.category === 'garage') this.buildGarageEntrance(b)
      else this.buildFootprintPad(b)
    }
    if (this.hydratedBuildings) this.extrudeBuildings(this.hydratedBuildings)
    this.buildCorridor()
    if (this.hydratedPois) this.buildPOIs(this.hydratedPois)
    // 后处理依赖最终场景尺寸/相机，几何就绪后再装配
    this.buildPostFX()
  }

  // ---------- v2.0 环境贴图（RoomEnvironment PMREM） ----------

  private buildEnvironmentMap() {
    // 仅写实三风格且 WebGL2 可用时烘焙；其余风格 / 无 WebGL2 跳过（材质 metalness 由 ambient 兜底）。
    if (!this.profile.envMap || !this.isWebGL2) {
      this.sceneObj.environment = null
      return
    }
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = new RoomEnvironment()
    this.envMapTarget = this.pmrem.fromScene(env, 0.04)
    this.sceneObj.environment = this.envMapTarget.texture
    ;(env as unknown as { dispose?: () => void }).dispose?.()
  }

  // ---------- v2.0 后处理（EffectComposer + Bloom + GTAO） ----------

  private buildPostFX() {
    const r = this.tokens.realism as Record<string, { strength?: number; threshold?: number; radius?: number; enabled?: boolean; intensity?: number }> | undefined
    const bloom = r?.bloom
    const ao = r?.ao
    const wantBloom = this.profile.composer && (bloom?.strength ?? 0) > 0 && this.isWebGL2
    const wantAO = this.profile.ao && ao?.enabled && this.isWebGL2

    if (!wantBloom && !wantAO) { this.composer = null; return }

    const w = this.canvas.clientWidth || 1920
    const h = this.canvas.clientHeight || 1080
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.sceneObj, this.camera))

    if (wantAO) {
      // GTAOPass 需要场景中可投射 AO 的对象；此处给全场，强度走 token，半径默认。
      const gtao = new GTAOPass(this.sceneObj, this.camera, w, h)
      gtao.output = GTAOPass.OUTPUT.Default
      this.configureGTAO(gtao, ao?.intensity ?? 0.6)
      this.composer.addPass(gtao)
      this.gtaoPass = gtao
    }
    if (wantBloom) {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom!.strength ?? 0.3, bloom!.radius ?? 0.4, bloom!.threshold ?? 0.6)
      this.composer.addPass(bloomPass)
      this.bloomPass = bloomPass
    }
    // OutputPass 在 composer 末端做正确的 tone mapping + 色彩空间转换（取代旧 setAlpha/色调手工修正）。
    this.composer.addPass(new OutputPass())
  }

  private configureGTAO(gtao: GTAOPass, intensity: number) {
    // GTAOPass 公开属性因 three 版本略有差异，try 赋值，失败静默（保留默认）。
    try {
      ;(gtao as unknown as Record<string, unknown>).radius = 0.25
      ;(gtao as unknown as Record<string, unknown>).intensity = intensity
    } catch { /* noop */ }
  }

  private disposePostFX() {
    if (this.composer) {
      this.composer.dispose?.()
      this.composer = null
      this.bloomPass = null
      this.gtaoPass = null
    }
  }

  // ---------- 灯光（v1.9 ambientFloor 兜底 + v2.0 太阳方位） ----------

  private buildLights() {
    const L = this.tokens.lights as Record<string, string | number | null>
    const r = this.tokens.realism as { sun?: { azimuth?: number; elevation?: number } } | undefined
    const hemiSky = (L.hemiSky as string) ?? '#3a5d86'
    const hemiGround = (L.hemiGround as string) ?? '#0a1428'
    const hemiIntensity = (L.hemiIntensity as number) ?? 0.6
    const sun = (L.sun as string) ?? '#9fb8e0'
    const sunIntensity = (L.sunIntensity as number) ?? 0.7
    const ambient = L.ambient as string | null
    const ambientIntensity = (L.ambientIntensity as number) ?? 0.0
    // v1.9 环境光下限：所有风格恒加，消灭未受光面纯黑。
    const ambientFloor = (L.ambientFloor as number) ?? 0.0

    if (ambient) this.sceneGroup.add(new THREE.AmbientLight(new THREE.Color(ambient), ambientIntensity))
    if (ambientFloor > 0 && !ambient) {
      this.sceneGroup.add(new THREE.AmbientLight(new THREE.Color(hemiSky ?? '#ffffff'), ambientFloor))
    }

    if (this.style !== 'blueprint' && this.style !== 'holographic') {
      const hemi = new THREE.HemisphereLight(new THREE.Color(hemiSky), new THREE.Color(hemiGround), hemiIntensity)
      this.sceneGroup.add(hemi)
    } else if (this.style === 'holographic') {
      this.sceneGroup.add(new THREE.HemisphereLight(new THREE.Color(hemiSky), new THREE.Color(hemiGround), Math.min(hemiIntensity, 0.35)))
      this.sceneGroup.add(new THREE.AmbientLight(new THREE.Color('#16324a'), 0.4))
    }

    if (this.style !== 'blueprint') {
      const dir = new THREE.DirectionalLight(new THREE.Color(sun), sunIntensity)
      // v2.0 太阳方位（token.realism.sun.azimuth/elevation，单位度）。
      const az = ((r?.sun?.azimuth ?? 135) * Math.PI) / 180
      const el = ((r?.sun?.elevation ?? 50) * Math.PI) / 180
      const dist = 1600
      dir.position.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(dist)
      if (this.profile.shadows) {
        dir.castShadow = true
        const bx = this.scaffold.boundary.x
        const bz = this.scaffold.boundary.z
        dir.shadow.camera.left = -bx
        dir.shadow.camera.right = bx
        dir.shadow.camera.top = bz
        dir.shadow.camera.bottom = -bz
        dir.shadow.camera.near = 100
        dir.shadow.camera.far = 4000
        dir.shadow.mapSize.set(2048, 2048)
        dir.shadow.radius = 4
        dir.shadow.bias = -0.0003
      }
      this.sceneGroup.add(dir)
      if (this.profile.shadows) this.sceneGroup.add(dir.target)
    }

    // night-realistic：受控 PointLight（≤8，不投影）
    if (this.style === 'night-realistic') {
      const pColor = (L.point as string) ?? '#ffb24a'
      const pInt = (L.pointIntensity as number) ?? 30
      const pDist = (L.pointDistance as number) ?? 400
      const spots: Array<[number, number]> = [[0, 120], [200, 0], [-200, 0], [0, -120]]
      for (const [x, z] of spots) {
        const pl = new THREE.PointLight(new THREE.Color(pColor), pInt, pDist)
        pl.position.set(x, 90, z)
        pl.castShadow = false
        this.sceneGroup.add(pl)
      }
    }
  }

  // ---------- 地面（v1.9 程序化纹理 + v2.0 夜间反射） ----------

  private buildGround() {
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const env = this.tokens.environment as Record<string, unknown>

    const cityColor = (env['city-ground'] as string) ?? '#080418'
    const cityGeo = new THREE.PlaneGeometry(bx * 3.2, bz * 3.2)
    const cityMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cityColor) })
    const city = new THREE.Mesh(cityGeo, cityMat)
    city.rotation.x = -Math.PI / 2
    city.position.y = -0.5
    if (this.profile.shadows) city.receiveShadow = true
    this.sceneGroup.add(city)

    if (this.profile.ground === 'grid') {
      const grid = this.tokens.shaders?.grid ?? { u_gridColor: '#2a7fff', u_cell: 46, u_strength: 0.85 }
      const uniforms = {
        u_gridColor: { value: new THREE.Color(grid.u_gridColor) },
        u_cell: { value: grid.u_cell },
        u_strength: { value: grid.u_strength },
        u_scale: { value: new THREE.Vector2(bx * 2, bz * 2) },
      }
      const geo = new THREE.PlaneGeometry(bx * 2, bz * 2)
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL1,
        uniforms,
        fragmentShader: gridFrag,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        transparent: true,
        depthWrite: false,
      })
      const m = new THREE.Mesh(geo, mat)
      m.rotation.x = -Math.PI / 2
      m.position.y = 0
      this.sceneGroup.add(m)
      return
    }

    // v2.0 夜间湿润反射（Reflector，仅 night-realistic + WebGL2）。预算超限或缺 WebGL2 时降级为普通地面。
    const r = this.tokens.realism as { reflection?: { enabled?: boolean; opacity?: number } } | undefined
    if (this.profile.reflect && r?.reflection?.enabled && this.isWebGL2) {
      try {
        this.reflector = new Reflector(new THREE.PlaneGeometry(bx * 2, bz * 2), {
          clipBias: 0.003,
          textureWidth: (this.canvas.clientWidth || 1920) * Math.min(window.devicePixelRatio, 2),
          textureHeight: (this.canvas.clientHeight || 1080) * Math.min(window.devicePixelRatio, 2),
          color: new THREE.Color((env.road as string) ?? '#0e1426'),
        })
        this.reflector.rotation.x = -Math.PI / 2
        this.reflector.position.y = 0
        ;(this.reflector.material as THREE.Material).transparent = true
        ;((this.reflector.material as unknown as { opacity: number })).opacity = r.reflection.opacity ?? 0.45
        this.sceneGroup.add(this.reflector)
        return
      } catch {
        this.reflector = null // 降级
      }
    }

    const grass = (env.grass as string) ?? '#13304a'
    // v1.9 程序化地面纹理叠加（消灭纯色色片）。提前取纹理。
    const groundTex = this.makeGroundTexture()
    let mat: THREE.Material
    if (this.profile.ground === 'light' || this.profile.ground === 'flat') {
      mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.profile.ground === 'light' ? '#cfd2d6' : '#c9b79b'), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    } else if (this.profile.ground === 'pbr') {
      mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(grass), roughness: 0.95, metalness: 0 })
    } else {
      // dark 地面改用 MeshBasicMaterial（不受光）：夜景/全息灯光暗，受光 Standard 会被压成近黑「看不见地面」；
      // 不受光直接按 token ground.texture 全色显示，保证地面可辨、与背景强对比。
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(groundTex ? '#ffffff' : (this.style === 'night-realistic' ? '#0a1018' : '#06070d')) })
    }
    if (groundTex && mat instanceof THREE.MeshBasicMaterial) (mat as THREE.MeshBasicMaterial).map = groundTex
    else if (groundTex && mat instanceof THREE.MeshStandardMaterial) (mat as THREE.MeshStandardMaterial).map = groundTex
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bx * 2, bz * 2), mat)
    m.rotation.x = -Math.PI / 2
    m.position.y = 0
    if (this.profile.shadows) m.receiveShadow = true
    this.sceneGroup.add(m)
  }

  private disposeReflector() {
    if (this.reflector) {
      this.reflector.dispose?.()
      this.reflector = null
    }
  }

  /** v1.9/v2.0 程序化地面 CanvasTexture（tiles/grid/dots），由 token.ground.texture 驱动。 */
  private makeGroundTexture(): THREE.CanvasTexture | null {
    const gt = (this.tokens.ground as { texture?: { type: string; base: string; line: string; cell: number } } | undefined)?.texture
    if (!gt) return null
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = gt.base
    ctx.fillRect(0, 0, size, size)
    const rand = mulberry32(hashStr(this.style))
    if (gt.type === 'tiles') {
      const n = Math.max(4, Math.round(size / Math.max(16, gt.cell)))
      const step = size / n
      ctx.strokeStyle = gt.line
      ctx.lineWidth = 2
      for (let i = 0; i <= n; i++) {
        ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke()
      }
      // 确定性伪随机洒点（颗粒感）
      ctx.fillStyle = gt.line
      for (let i = 0; i < 600; i++) {
        const x = rand() * size, y = rand() * size, s = rand() * 1.5
        ctx.globalAlpha = 0.15 + rand() * 0.2
        ctx.fillRect(x, y, s, s)
      }
      ctx.globalAlpha = 1
    } else if (gt.type === 'dots') {
      ctx.fillStyle = gt.line
      for (let y = gt.cell / 2; y < size; y += gt.cell) {
        for (let x = gt.cell / 2; x < size; x += gt.cell) {
          ctx.globalAlpha = 0.25 + rand() * 0.35
          ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    } else {
      // grid
      ctx.strokeStyle = gt.line
      ctx.lineWidth = 1
      for (let i = 0; i <= size; i += gt.cell) {
        ctx.globalAlpha = 0.5
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(4, 4)
    tex.anisotropy = 8
    return tex
  }

  // ---------- 环境（道路/车位/绿化/周边/氛围） ----------

  private buildEnvironment() {
    const env = this.scaffold.environment
    this.buildInternalRoads(env)
    this.buildRoadMarkings(env)
    if (env.surfaceParking) this.buildSurfaceParking(env.surfaceParking.stalls, env.surfaceParking.occupied)
    this.buildGreenery(env)
    this.buildSurrounding(env)
    this.buildAmbiance(env)
  }

  private roadMaterial(): THREE.Material {
    const road = (this.tokens.environment as Record<string, string>)['road'] ?? '#0c1430'
    if (this.profile.shadows || this.profile.ground === 'pbr' || this.profile.ground === 'light' || this.profile.ground === 'flat') {
      return new THREE.MeshLambertMaterial({ color: new THREE.Color(road), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    }
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(road) })
  }

  private buildInternalRoads(env: ParkScaffold['environment']) {
    const shape = env.internalRoads ?? 'loop'
    if (shape === 'none') return
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const mat = this.roadMaterial()
    const addRoad = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat)
      m.rotation.x = -Math.PI / 2
      m.position.set(x, 0.2, z)
      this.sceneGroup.add(m)
    }
    if (shape === 'cross' || shape === 'grid') {
      addRoad(bx * 1.8, 24, 0, 0)
      addRoad(24, bz * 1.8, 0, 0)
    }
    if (shape === 'grid') {
      addRoad(bx * 1.8, 18, 0, bz * 0.45)
      addRoad(bx * 1.8, 18, 0, -bz * 0.45)
    }
    const inset = 40
    addRoad((bx - inset) * 2, 22, 0, bz - inset)
    addRoad((bx - inset) * 2, 22, 0, -(bz - inset))
    addRoad(22, (bz - inset) * 2, bx - inset, 0)
    addRoad(22, (bz - inset) * 2, -(bx - inset), 0)
  }

  /**
   * v2.1 地面标线（内部道路中央虚线 + 大门口斑马线 + 引导箭头 + 门前引道）。
   * 色取 token environment.roadMarking；虚线走 InstancedMesh（性能纪律）。
   * 真实感要点：真实园区道路从不是光秃秃的色带——标线是远观可辨的尺度参照。
   */
  private buildRoadMarkings(env: ParkScaffold['environment']) {
    const shape = env.internalRoads ?? 'loop'
    if (shape === 'none') return
    const e = this.tokens.environment as Record<string, string>
    const color = new THREE.Color(e.roadMarking ?? e.roadLine ?? '#f5f5f0')
    const lit = this.profile.shadows || this.profile.ground === 'pbr' || this.profile.ground === 'light' || this.profile.ground === 'flat'
    const mat = lit
      ? new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.9, ...(this.profile.flatShading ? { flatShading: true } : {}) })
      : new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const inset = 40
    const y = 0.4

    // ---- 中央虚线（12×2 段、间隔 24；环路四边 + 十字/井字主路） ----
    const dashH: THREE.Matrix4[] = []
    const dashV: THREE.Matrix4[] = []
    const tmp = new THREE.Matrix4()
    const pushDash = (arr: THREE.Matrix4[], x: number, z: number) => {
      tmp.makeRotationX(-Math.PI / 2)
      tmp.setPosition(x, y, z)
      arr.push(tmp.clone())
    }
    const segH = (x0: number, x1: number, z: number) => { for (let x = x0 + 14; x < x1 - 8; x += 24) pushDash(dashH, x, z) }
    const segV = (z0: number, z1: number, x: number) => { for (let z = z0 + 14; z < z1 - 8; z += 24) pushDash(dashV, x, z) }
    const lx = bx - inset
    const lz = bz - inset
    segH(-lx, lx, lz); segH(-lx, lx, -lz)
    segV(-lz, lz, lx); segV(-lz, lz, -lx)
    if (shape === 'cross' || shape === 'grid') {
      segH(-bx * 0.9, bx * 0.9, 0)
      segV(-bz * 0.9, bz * 0.9, 0)
    }
    const addInst = (geo: THREE.PlaneGeometry, mats: THREE.Matrix4[]) => {
      if (mats.length === 0) return
      const inst = new THREE.InstancedMesh(geo, mat, mats.length)
      mats.forEach((m, i) => inst.setMatrixAt(i, m))
      this.sceneGroup.add(inst)
    }
    addInst(new THREE.PlaneGeometry(12, 2), dashH)
    addInst(new THREE.PlaneGeometry(2, 12), dashV)

    // ---- 大门引道 + 斑马线 + 引导箭头（surrounding.gate 关闭时跳过） ----
    if (env.surrounding?.gate !== false) {
      // 门前引道：连接大门（z=bz）与环路（z=bz-inset）的一小段路
      const driveway = new THREE.Mesh(new THREE.PlaneGeometry(24, inset + 6), this.roadMaterial())
      driveway.rotation.x = -Math.PI / 2
      driveway.position.set(0, 0.25, bz - inset / 2)
      this.sceneGroup.add(driveway)

      // 斑马线：6 条 2.5×20 白杠横跨环路（行人沿引道过街）
      const zebra = new THREE.PlaneGeometry(2.5, 20)
      for (let i = 0; i < 6; i++) {
        const bar = new THREE.Mesh(zebra, mat)
        bar.rotation.x = -Math.PI / 2
        bar.position.set(-15 + i * 6, y, bz - inset)
        this.sceneGroup.add(bar)
      }

      // 引导箭头：引道上指园区内部（shape +y 平放后指向 -z）
      const arrowShape = new THREE.Shape()
      arrowShape.moveTo(0, 5); arrowShape.lineTo(3.5, 0); arrowShape.lineTo(1.2, 0)
      arrowShape.lineTo(1.2, -5); arrowShape.lineTo(-1.2, -5); arrowShape.lineTo(-1.2, 0)
      arrowShape.lineTo(-3.5, 0); arrowShape.closePath()
      const arrowGeo = new THREE.ShapeGeometry(arrowShape)
      const arrow = new THREE.Mesh(arrowGeo, mat)
      arrow.rotation.x = -Math.PI / 2
      arrow.scale.setScalar(1.6)
      arrow.position.set(0, y + 0.01, bz - inset + 18)
      this.sceneGroup.add(arrow)
    }
  }

  private buildSurfaceParking(stalls: number, occupied?: number) {
    const sp = this.tokens.surfaceParking as Record<string, string>
    const cars = occupied ?? Math.round(stalls * 0.3)
    const stallW = 14
    const stallD = 26
    const rowX = this.scaffold.boundary.x - 70
    const rowZ0 = -((stalls * stallD) / 2)
    const fillMat = this.profile.building === 'wire'
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(sp.stallFill) })
      : (this.profile.shadows ? new THREE.MeshLambertMaterial({ color: new THREE.Color(sp.stallFill) }) : new THREE.MeshBasicMaterial({ color: new THREE.Color(sp.stallFill) }))
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(sp.stallLine) })
    for (let i = 0; i < stalls; i++) {
      const z = rowZ0 + i * stallD
      const stall = new THREE.Mesh(new THREE.PlaneGeometry(stallW, stallD - 2), fillMat)
      stall.rotation.x = -Math.PI / 2
      stall.position.set(rowX, 0.3, z)
      this.sceneGroup.add(stall)
      const loop = new THREE.LineLoop(new THREE.EdgesGeometry(new THREE.PlaneGeometry(stallW, stallD)), lineMat)
      loop.rotation.x = -Math.PI / 2
      loop.position.set(rowX, 0.35, z)
      this.sceneGroup.add(loop)
      const ptex = this.makeContrastLabel('P', sp.pMarkBg ?? sp.stallFill, sp.pMark, sp.stallLine)
      const psprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex, depthTest: false, transparent: true }))
      psprite.position.set(rowX, 2, z)
      psprite.scale.set(7, 7, 1)
      this.overlayScene.add(psprite)
      if (i < cars) {
        const car = this.makeCarProxy(sp.car ?? '#1e6fff')
        car.position.set(rowX, 0, z)
        car.rotation.y = Math.PI / 2
        this.sceneGroup.add(car)
      }
    }
  }

  private buildGreenery(env: ParkScaffold['environment']) {
    const e = this.tokens.environment as Record<string, string>
    const density = env.greenery?.treeDensity ?? 'normal'
    const step = density === 'lush' ? 60 : density === 'sparse' ? 130 : 90
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const grassMat = this.profile.building === 'wire'
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.grass) })
      : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.grass), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    for (const [gx, gz] of [[-bx * 0.5, -bz * 0.3], [bx * 0.5, -bz * 0.3], [-bx * 0.5, bz * 0.4], [bx * 0.5, bz * 0.4]]) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), grassMat)
      patch.rotation.x = -Math.PI / 2
      patch.position.set(gx, 0.15, gz)
      this.sceneGroup.add(patch)
    }
    if (env.greenery?.centralPlaza !== false) {
      const plazaMat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.sidewalk) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) })
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(70, 48), plazaMat)
      plaza.rotation.x = -Math.PI / 2
      plaza.position.set(0, 0.2, -70)
      this.sceneGroup.add(plaza)
    }
    const positions: THREE.Matrix4[] = []
    const tmp = new THREE.Matrix4()
    const trunkH = 18
    for (let x = -bx + 30; x <= bx - 30; x += step) {
      for (const side of [-1, 1]) {
        const z = side * (bz - 60)
        tmp.makeTranslation(x, trunkH / 2, z)
        positions.push(tmp.clone())
      }
    }
    if (positions.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(1.6, 2.2, trunkH, 6)
      const trunkMat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.treeTrunk) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeTrunk), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length)
      positions.forEach((m, i) => trunkInst.setMatrixAt(i, m))
      trunkInst.castShadow = this.profile.shadows
      this.sceneGroup.add(trunkInst)

      // v2.1 树冠双形态：偶数位球形（Icosahedron）、奇数位锥形（Cone）——两种树形
      // 间隔排布打破「一整排同款球」的塑料感；分组确定性（按位置序奇偶），无需种子。
      const canopyMat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.treeCanopy) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeCanopy), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const sphereIdx = positions.map((_, i) => i).filter((i) => i % 2 === 0)
      const coneIdx = positions.map((_, i) => i).filter((i) => i % 2 === 1)
      const up = new THREE.Matrix4()
      if (sphereIdx.length > 0) {
        const sphereInst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(12, 0), canopyMat, sphereIdx.length)
        sphereIdx.forEach((pi, k) => {
          const pos = new THREE.Vector3().setFromMatrixPosition(positions[pi])
          up.makeTranslation(pos.x, trunkH + 10, pos.z)
          sphereInst.setMatrixAt(k, up)
        })
        sphereInst.castShadow = this.profile.shadows
        this.sceneGroup.add(sphereInst)
      }
      if (coneIdx.length > 0) {
        const coneInst = new THREE.InstancedMesh(new THREE.ConeGeometry(9, 24, 8), canopyMat, coneIdx.length)
        coneIdx.forEach((pi, k) => {
          const pos = new THREE.Vector3().setFromMatrixPosition(positions[pi])
          up.makeTranslation(pos.x, trunkH + 12, pos.z)
          coneInst.setMatrixAt(k, up)
        })
        coneInst.castShadow = this.profile.shadows
        this.sceneGroup.add(coneInst)
      }
    }

    // v2.1 灌木球丛：沿 4 块草地边缘点缀（每块 6 丛，种子确定性偏移），增加绿化层次
    {
      const bushMat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.treeCanopy) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeCanopy), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const bushMats: THREE.Matrix4[] = []
      const tmpB = new THREE.Matrix4()
      const patches: Array<[number, number]> = [[-bx * 0.5, -bz * 0.3], [bx * 0.5, -bz * 0.3], [-bx * 0.5, bz * 0.4], [bx * 0.5, bz * 0.4]]
      for (const [gx, gz] of patches) {
        const rnd = mulberry32(hashStr(`bush:${gx},${gz}`))
        for (let i = 0; i < 6; i++) {
          const px = gx + (rnd() - 0.5) * 140
          const pz = gz + (rnd() - 0.5) * 70
          const s = 0.7 + rnd() * 0.6
          tmpB.makeScale(s, s, s)
          tmpB.setPosition(px, 5 * s, pz)
          bushMats.push(tmpB.clone())
        }
      }
      const bushInst = new THREE.InstancedMesh(new THREE.SphereGeometry(6, 8, 6), bushMat, bushMats.length)
      bushMats.forEach((m, i) => bushInst.setMatrixAt(i, m))
      bushInst.castShadow = this.profile.shadows
      this.sceneGroup.add(bushInst)
    }

    // v2.1 水景（spec environment.greenery.waterFeature）：圆形水面 + 池缘环。
    // 写实两风格用低粗糙度 Standard 材质吃 envMap 反射；其余风格半透明色。
    if (env.greenery?.waterFeature) {
      const waterColor = new THREE.Color(e.water ?? '#4a90c0')
      const waterMat = (this.profile.ground === 'pbr' || this.profile.ground === 'dark')
        ? new THREE.MeshStandardMaterial({ color: waterColor, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 })
        : this.profile.building === 'wire'
          ? new THREE.MeshBasicMaterial({ color: waterColor, transparent: true, opacity: 0.5 })
          : new THREE.MeshLambertMaterial({ color: waterColor, transparent: true, opacity: 0.85, ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const water = new THREE.Mesh(new THREE.CircleGeometry(50, 48), waterMat)
      water.rotation.x = -Math.PI / 2
      water.position.set(bx * 0.3, 0.25, bz * 0.42)
      this.sceneGroup.add(water)
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(50, 56, 48),
        this.profile.building === 'wire'
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.sidewalk) })
          : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) }),
      )
      rim.rotation.x = -Math.PI / 2
      rim.position.set(bx * 0.3, 0.22, bz * 0.42)
      this.sceneGroup.add(rim)
    }
  }

  private buildSurrounding(env: ParkScaffold['environment']) {
    const e = this.tokens.environment as Record<string, string>
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const s = env.surrounding ?? {}
    if (s.roads !== false) {
      const rmat = this.roadMaterial()
      const add = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), rmat)
        m.rotation.x = -Math.PI / 2
        m.position.set(x, 0.1, z)
        this.sceneGroup.add(m)
      }
      add(bx * 3.2, 40, 0, bz + 60)
      add(bx * 3.2, 40, 0, -(bz + 60))
      add(40, bz * 3.2, bx + 60, 0)
      add(40, bz * 3.2, -(bx + 60), 0)
    }
    if (s.wall !== false) {
      const wmat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.wall) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.wall) })
      const seg = (w: number, x: number, z: number, rotY: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 14, 3), wmat)
        m.position.set(x, 7, z)
        m.rotation.y = rotY
        this.sceneGroup.add(m)
      }
      const gap = s.gate !== false ? 40 : 0
      seg(bx * 2 - gap, -gap / 2 - bx / 2, bz, 0)
      seg(bx * 2 - gap, gap / 2 + bx / 2, bz, 0)
      seg(bx * 2 - gap, -gap / 2 - bx / 2, -bz, 0)
      seg(bx * 2 - gap, gap / 2 + bx / 2, -bz, 0)
      seg(bz * 2, bx, 0, Math.PI / 2)
      seg(bz * 2, -bx, 0, Math.PI / 2)
    }
    if (s.gate !== false) {
      const gmat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.sidewalk) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) })
      for (const dx of [-22, 22]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 8), gmat)
        post.position.set(dx, 13, bz)
        this.sceneGroup.add(post)
      }
    }
  }

  private buildAmbiance(env: ParkScaffold['environment']) {
    const e = this.tokens.environment as Record<string, string>
    const a = env.ambiance ?? {}
    if (a.streetLamps !== false) {
      const lampPos: THREE.Vector3[] = []
      const bx = this.scaffold.boundary.x
      const bz = this.scaffold.boundary.z
      for (let x = -bx + 60; x <= bx - 60; x += 150) {
        lampPos.push(new THREE.Vector3(x, 0, bz - 30))
        lampPos.push(new THREE.Vector3(x, 0, -(bz - 30)))
      }
      if (lampPos.length) {
        const poleMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#2a2f3a') })
        const poleGeo = new THREE.CylinderGeometry(0.8, 1, 40, 6)
        const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampPos.length)
        const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(e.lampGlow) })
        const headGeo = new THREE.SphereGeometry(3, 10, 10)
        const headInst = new THREE.InstancedMesh(headGeo, headMat, lampPos.length)
        const m1 = new THREE.Matrix4()
        const m2 = new THREE.Matrix4()
        lampPos.forEach((p, i) => {
          m1.makeTranslation(p.x, 20, p.z); poleInst.setMatrixAt(i, m1)
          m2.makeTranslation(p.x, 42, p.z); headInst.setMatrixAt(i, m2)
        })
        this.sceneGroup.add(poleInst)
        this.sceneGroup.add(headInst)
      }
    }
    if (a.groundGlow !== false && (this.style === 'cyber' || this.style === 'holographic')) {
      const lineCol = new THREE.Color(e.roadLine)
      const bx = this.scaffold.boundary.x
      const pts: THREE.Vector3[] = [
        new THREE.Vector3(-bx, 0.4, this.scaffold.boundary.z),
        new THREE.Vector3(bx, 0.4, this.scaffold.boundary.z),
        new THREE.Vector3(bx, 0.4, -this.scaffold.boundary.z),
        new THREE.Vector3(-bx, 0.4, -this.scaffold.boundary.z),
        new THREE.Vector3(-bx, 0.4, this.scaffold.boundary.z),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      this.sceneGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: lineCol })))
    }
  }

  // ---------- 楼栋（v2.0：裙楼 + 女儿墙几何增强） ----------

  private buildFootprintPad(b: ScaffoldBuilding) {
    const color = new THREE.Color(this.tokens.category.building)
    const mat = this.padMaterial(color)
    const pad = new THREE.Mesh(new THREE.BoxGeometry(b.w, 2, b.d), mat)
    pad.position.set(b.x, 1, b.z)
    pad.userData = { kind: 'building', buildingId: b.id, footprint: true }
    this.sceneGroup.add(pad)
    this.pickables.push(pad)
    this.buildingMap.set(b.id, { group: new THREE.Group(), slabs: [], floors: 0, w: b.w, d: b.d, x: b.x, z: b.z })
  }

  private padMaterial(color: THREE.Color): THREE.Material {
    return this.buildingMaterial(color, false)
  }

  /** 楼栋材质工厂（按风格，v2.0 PBR 走 token.realism.material）。 */
  private buildingMaterial(color: THREE.Color, isBody: boolean): THREE.Material {
    const b = this.profile.building
    const r = this.tokens.realism as { material?: { roughness?: number; metalness?: number; envMapIntensity?: number } } | undefined
    const rm = r?.material
    if (b === 'wire') return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 })
    if (b === 'white') return new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff') })
    if (b === 'flat') return new THREE.MeshLambertMaterial({ color, flatShading: true })
    if (b === 'pbr') {
      const m = new THREE.MeshStandardMaterial({ color, metalness: rm?.metalness ?? 0.9, roughness: rm?.roughness ?? 0.1, envMapIntensity: rm?.envMapIntensity ?? 1.0 })
      if (this.sceneObj.environment) m.envMap = this.sceneObj.environment
      return m
    }
    if (b === 'pbr-night') {
      const m = new THREE.MeshStandardMaterial({ color, metalness: rm?.metalness ?? 0.8, roughness: rm?.roughness ?? 0.2, envMapIntensity: rm?.envMapIntensity ?? 0.35, emissive: color, emissiveIntensity: 0.08 })
      if (this.sceneObj.environment) m.envMap = this.sceneObj.environment
      return m
    }
    if (b === 'holo') {
      const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.5, emissive: color, emissiveIntensity: 0.4, metalness: 0.1, roughness: 0.2 })
      if (this.profile.useRim) this.injectRim(m)
      return m
    }
    // emissive（cyber 默认）
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isBody ? 0.12 : 0.05, metalness: 0.2, roughness: 0.6 })
  }

  private injectRim(mat: THREE.MeshStandardMaterial) {
    const rimColor = new THREE.Color((this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff')
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: rimColor }
      shader.uniforms.uRimPower = { value: 3.0 }
      shader.uniforms.uRimIntensity = { value: 0.6 }
      shader.fragmentShader = 'uniform vec3 uRimColor; uniform float uRimPower; uniform float uRimIntensity;\n' +
        shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fresnelRimBody)
    }
  }

  hydrateBuildings(items: BuildingRuntimeItem[]) {
    this.hydratedBuildings = items
    this.extrudeBuildings(items)
    // v2.1：真实楼层数就绪后重新取景（构造期用默认估算会偏松），园区更贴合 2/3 画面
    this.frameCamera()
  }

  private extrudeBuildings(items: BuildingRuntimeItem[]) {
    const fh = this.scaffold.floorHeight
    const roomShade = (this.tokens.building.roomShade as number) ?? 0.16
    const dividerColor = new THREE.Color(this.tokens.building.dividerColor as string)
    for (const item of items) {
      const meta = this.buildingMap.get(item.building_id)
      if (!meta) continue
      const padObj = this.sceneGroup.children.find((c) => (c as THREE.Mesh).userData?.buildingId === item.building_id && (c as THREE.Mesh).userData?.footprint)
      if (padObj) { this.sceneGroup.remove(padObj); this.disposeObject(padObj); this.pickables = this.pickables.filter((p) => p !== padObj) }

      const group = meta.group
      group.position.set(meta.x, 0, meta.z)
      const w = meta.w
      const d = meta.d
      const h = item.floors * fh
      const color = new THREE.Color(this.tokens.category.building)
      const b = this.profile.building

      // 风格相关：材质、facade 纹理、标签配色（在本类里构造，受 token/style 驱动）。
      const facade = this.makeFacadeTexture(item.building_id, item.floors, w, d, color, roomShade, dividerColor)
      const sideMat = this.buildingMaterial(color, true)
      if (facade) {
        if (sideMat instanceof THREE.MeshStandardMaterial || sideMat instanceof THREE.MeshLambertMaterial || sideMat instanceof THREE.MeshBasicMaterial) {
          ;(sideMat as THREE.MeshStandardMaterial).map = facade
          if (this.style === 'night-realistic') (sideMat as THREE.MeshStandardMaterial).emissiveMap = facade
        }
      }
      const topMat = b === 'white'
        ? new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff') })
        : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.05, metalness: 0.2, roughness: 0.6 })
      const podiumMat = b === 'wire' ? null
        : (b === 'white'
            ? new THREE.MeshLambertMaterial({ color: new THREE.Color('#e6e9ee') })
            : new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), roughness: 0.85, metalness: 0.05 }))
      const capMat = (b === 'wire' || b === 'white') ? null
        : new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.7), roughness: 0.7, metalness: 0.2 })
      // 楼顶标签配色（v2.1 改走 token ui.labelBg/labelText——7 风格各自的高对比配对；
      // 旧式 (void-bg, cyan-bright) 在浅色风格下两字色都偏亮、标签糊成黑块，违反 §4.2 规则）
      const uiTk = this.tokens.ui
      const labelTex = this.makeContrastLabel(
        item.name,
        uiTk?.labelBg ?? (this.tokens.palette['void-bg'] as string),
        uiTk?.labelText ?? ((this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff'),
        this.tokens.category.building,
        500,
      )

      // 几何装配统一交给 building-geometry.buildBuilding——所有 y 坐标对齐只在那里定义一次。
      const { slabs, label } = buildBuilding({
        group,
        id: item.building_id,
        name: item.name,
        w, d, h, floors: item.floors, fh,
        sideMaterials: [sideMat, sideMat, topMat, topMat, sideMat, sideMat],
        podiumMaterial: podiumMat,
        capMaterial: capMat,
        dividerColor,
        edgeColor: b === 'white' ? color : dividerColor,
        edgeOpacity: b === 'wire' ? 1 : 0.6,
        labelTexture: labelTex,
        castShadow: this.profile.shadows,
        slabSink: meta.slabs,
      })
      for (const slab of slabs) this.pickables.push(slab)

      // 楼顶名称牌挂 overlayScene（绕过 GTAO/bloom）：buildBuilding 给的是 group-local (0,h+22,0)，
      // 这里换成世界坐标（group 已 position 到 meta.x/0/meta.z）。
      label.position.set(meta.x, h + 22, meta.z)
      this.overlayScene.add(label)

      // v2.1 楼顶设备套件（电梯机房 + 天线 + 夜间警示灯）——真实建筑天际线。
      // 色取 token environment.rooftop；材质随风格分支（与楼栋材质同纪律）。
      {
        const rc = new THREE.Color((this.tokens.environment as Record<string, string>)['rooftop'] ?? '#8a93a0')
        let roomMat: THREE.Material
        let antennaMat: THREE.Material
        if (b === 'wire') {
          roomMat = new THREE.MeshBasicMaterial({ color: rc, wireframe: true })
          antennaMat = new THREE.MeshBasicMaterial({ color: rc, wireframe: true })
        } else if (b === 'white') {
          roomMat = new THREE.MeshLambertMaterial({ color: rc })
          antennaMat = new THREE.MeshLambertMaterial({ color: rc })
        } else if (b === 'flat') {
          roomMat = new THREE.MeshLambertMaterial({ color: rc, flatShading: true })
          antennaMat = new THREE.MeshLambertMaterial({ color: rc, flatShading: true })
        } else if (b === 'holo') {
          roomMat = new THREE.MeshStandardMaterial({ color: rc, transparent: true, opacity: 0.35, emissive: rc, emissiveIntensity: 0.3 })
          antennaMat = new THREE.MeshStandardMaterial({ color: rc, transparent: true, opacity: 0.5, emissive: rc, emissiveIntensity: 0.4 })
        } else if (b === 'pbr' || b === 'pbr-night') {
          roomMat = new THREE.MeshStandardMaterial({ color: rc, roughness: 0.7, metalness: 0.2 })
          antennaMat = new THREE.MeshStandardMaterial({ color: rc, roughness: 0.5, metalness: 0.6 })
        } else { // emissive / cyber
          roomMat = new THREE.MeshStandardMaterial({ color: rc, emissive: dividerColor, emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.6 })
          antennaMat = new THREE.MeshStandardMaterial({ color: rc, emissive: dividerColor, emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.5 })
        }
        buildRooftopKit({
          group,
          id: item.building_id,
          w, d, h, fh,
          roomMaterial: roomMat,
          antennaMaterial: antennaMat,
          beaconColor: this.style === 'night-realistic' ? new THREE.Color(0xff3b30) : null,
          castShadow: this.profile.shadows,
        })
      }

      for (let i = 0; i < item.floors; i++) {
        this.floorIdMap.set(`${item.building_id}:${i}`, item.floor_ids[i] ?? `${item.building_id}-${i}`)
      }
      meta.floors = item.floors
      this.sceneGroup.add(group)
    }
  }


  /** 程序化幕墙 CanvasTexture：每层 1–5 块贴砖、相邻两色交替 + 深色竖实线；夜景叠亮窗。 */
  private makeFacadeTexture(buildingId: string, floors: number, w: number, d: number, color: THREE.Color, roomShade: number, dividerColor: THREE.Color): THREE.CanvasTexture | null {
    if (this.profile.building === 'white') return null
    const fh = this.scaffold.floorHeight
    const padW = Math.max(128, Math.round(w * 2))
    const padH = Math.max(128, Math.round(floors * fh * 0.5))
    const canvas = document.createElement('canvas')
    canvas.width = padW
    canvas.height = padH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const baseHsl = { h: 0, s: 0, l: 0 }
    color.getHSL(baseHsl)
    const light = new THREE.Color().setHSL(baseHsl.h, baseHsl.s, Math.min(0.97, baseHsl.l + roomShade))
    const dark = new THREE.Color().setHSL(baseHsl.h, baseHsl.s, Math.max(0.03, baseHsl.l - roomShade))
    const fillLight = `#${light.getHexString()}`
    const fillDark = `#${dark.getHexString()}`
    const divHex = `#${dividerColor.getHexString()}`
    ctx.fillStyle = fillLight
    ctx.fillRect(0, 0, padW, padH)

    const bandH = padH / floors
    const rand = mulberry32(hashStr(buildingId))
    for (let f = 0; f < floors; f++) {
      const yTop = Math.round(f * bandH)
      const yBot = Math.round((f + 1) * bandH)
      const roomCount = 1 + Math.floor(rand() * 5)
      const roomW = padW / roomCount
      for (let r = 0; r < roomCount; r++) {
        ctx.fillStyle = r % 2 === 0 ? fillLight : fillDark
        ctx.fillRect(Math.round(r * roomW), yTop, Math.ceil(roomW), yBot - yTop)
        if (r > 0) {
          ctx.fillStyle = divHex
          ctx.fillRect(Math.round(r * roomW) - 1, yTop, 2, yBot - yTop)
        }
      }
      if (this.style === 'night-realistic') {
        const amber = (this.tokens.accents.amber as string) ?? '#ffc24a'
        for (let r = 0; r < roomCount; r++) {
          if (rand() < 0.45) {
            ctx.fillStyle = amber
            const wx = Math.round(r * roomW + roomW * 0.3)
            const wy = yTop + Math.round(bandH * 0.3)
            ctx.fillRect(wx, wy, Math.max(2, Math.round(roomW * 0.35)), Math.max(2, Math.round(bandH * 0.35)))
          }
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  // ---------- 车库入口（半金字塔三角门 + P 牌） ----------

  private buildGarageEntrance(b: ScaffoldBuilding) {
    const color = new THREE.Color(this.tokens.category.garage)
    const group = new THREE.Group()
    group.position.set(b.x, 0, b.z)
    const facing = b.facing ?? 'S'
    const mat = this.profile.building === 'wire'
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
      : (this.profile.building === 'white'
          ? new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff'), side: THREE.DoubleSide })
          : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }))
    const halfPyramid = this.makeHalfPyramid(b.w, b.d, facing, mat, color)
    group.add(halfPyramid)
    const g = this.tokens.garageEntrance as Record<string, string>
    const tex = this.makeContrastLabel('P', g.signBg, g.signFg, color)
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    const facingOffset = this.facingOffset(facing, b.d * 0.6 + 24)
    // group 位于 (b.x,0,b.z)，sign 原为 group-local → 转世界坐标挂 overlayScene
    sign.position.set(b.x + facingOffset.x, b.d * 0.9 + 30, b.z + facingOffset.z)
    sign.scale.set(44, 44, 1)
    this.overlayScene.add(sign)
    const hit = new THREE.Mesh(new THREE.BoxGeometry(b.w, 30, b.d), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(0, 15, 0)
    hit.userData = { kind: 'building', buildingId: b.id }
    group.add(hit)
    this.pickables.push(hit)
    this.sceneGroup.add(group)
    this.buildingMap.set(b.id, { group, slabs: [], floors: 1, w: b.w, d: b.d, x: b.x, z: b.z })
  }

  private facingOffset(facing: string, dist: number): THREE.Vector3 {
    switch (facing) {
      case 'N': return new THREE.Vector3(0, 0, -dist)
      case 'S': return new THREE.Vector3(0, 0, dist)
      case 'E': return new THREE.Vector3(dist, 0, 0)
      case 'W': return new THREE.Vector3(-dist, 0, 0)
      default: return new THREE.Vector3(0, 0, dist)
    }
  }

  private makeHalfPyramid(w: number, d: number, _facing: string, mat: THREE.Material, edgeColor: THREE.Color): THREE.Group {
    const g = new THREE.Group()
    const hw = w / 2
    const hd = d / 2
    const ridgeY = d * 0.6
    const geo = new THREE.BufferGeometry()
    const verts = new Float32Array([
      -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
      -hw * 0.5, ridgeY, hd, hw * 0.5, ridgeY, hd,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
    const idx = [
      4, 5, 1, 4, 1, 0,
      4, 3, 5, 5, 3, 2,
      0, 1, 3, 1, 2, 3,
      4, 0, 3,
    ]
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, mat)
    if (this.profile.shadows) mesh.castShadow = true
    g.add(mesh)
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: this.profile.building === 'wire' ? 1 : 0.8 }))
    g.add(wire)
    return g
  }

  // ---------- 自定义扩展：2F 悬空走廊 ----------

  private buildCorridor() {
    const c = this.scaffold.corridor
    if (!c) return // corridor 是可选扩展——未配置的园区直接跳过（v2.1 修复空指针）
    const fh = this.scaffold.floorHeight
    const y = c.floor * fh + fh / 2
    const from = new THREE.Vector3(c.from.x, y, c.from.z)
    const to = new THREE.Vector3(c.to.x, y, c.to.z)
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    const color = new THREE.Color((this.tokens.palette.mint as string) ?? '#3df0c8')
    const mat = this.profile.building === 'wire'
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
      : (this.profile.building === 'white'
          ? new THREE.MeshLambertMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.92 })
          : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.9 }))
    const geo = new THREE.BoxGeometry(c.width, c.thickness, len)
    const bridge = new THREE.Mesh(geo, mat)
    bridge.position.copy(mid)
    bridge.lookAt(to.x, mid.y, to.z)
    bridge.rotateX(Math.PI / 2)
    if (this.profile.shadows) bridge.castShadow = true
    this.sceneGroup.add(bridge)
    const edgeColor = this.profile.building === 'white' ? color : new THREE.Color(this.tokens.building.dividerColor as string)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeColor }))
    edges.position.copy(bridge.position)
    edges.quaternion.copy(bridge.quaternion)
    this.sceneGroup.add(edges)
    const tex = this.makeContrastLabel(c.label, this.tokens.palette['void-bg'] as string, (this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff', color)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    sprite.position.set(mid.x, y + 18, mid.z)
    sprite.scale.set(Math.max(120, c.label.length * 18), 26, 1)
    this.overlayScene.add(sprite)
  }

  // ---------- POI ----------

  hydratePois(items: PoiRuntimeItem[]) {
    this.hydratedPois = items
    this.buildPOIs(items)
  }

  private buildPOIs(items: PoiRuntimeItem[]) {
    const poi = this.tokens.poi as Record<string, unknown>
    const statusCol = (poi.status as Record<string, string>) ?? {}
    const fh = this.scaffold.floorHeight
    for (const p of items) {
      const yBase = (p.building_id && p.floor_index != null) ? p.floor_index * fh + (p.y ?? 0) : (p.y ?? 0)
      const group = new THREE.Group()
      group.position.set(p.x, yBase, p.z)
      const typeColor = new THREE.Color((poi[p.type] as string) ?? (poi.custom as string) ?? '#1de9ff')
      const statusColor = new THREE.Color(statusCol[p.status] ?? statusCol.online ?? '#3df0c8')
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 30, 6), new THREE.MeshLambertMaterial({ color: new THREE.Color('#2a2f3a') }))
      pole.position.y = 15
      group.add(pole)
      const sym = this.poiSymbol(p.type)
      const tex = this.makeContrastLabel(sym, statusColor.getHexString().startsWith('#') ? `#${statusColor.getHexString()}` : '#06030f', '#ffffff', typeColor)
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
      // POI group 在 (p.x, yBase, p.z)，icon 原 group-local(0,34,0) → 世界坐标挂 overlayScene
      icon.position.set(p.x, yBase + 34, p.z)
      icon.scale.set(20, 20, 1)
      this.overlayScene.add(icon)
      if (p.status === PoiStatusEnum.Alarm) {
        const halo = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), new THREE.MeshBasicMaterial({ color: statusColor, transparent: true, opacity: 0.5 }))
        halo.position.y = 34
        halo.userData.poiAlarm = true
        group.add(halo)
      }
      const hit = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 8), new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.y = 30
      hit.userData = { kind: 'poi', poiId: p.poi_id }
      group.add(hit)
      this.poiPickables.push(hit)
      this.poiMap.set(p.poi_id, p)
      this.sceneGroup.add(group)
    }
  }

  private poiSymbol(type: PoiTypeEnum): string {
    switch (type) {
      case PoiTypeEnum.Entrance: return '入'
      case PoiTypeEnum.Exit: return '出'
      case PoiTypeEnum.Camera: return '◉'
      case PoiTypeEnum.Gate: return '闸'
      case PoiTypeEnum.Service: return 'i'
      case PoiTypeEnum.Landmark: return '★'
      case PoiTypeEnum.Parking: return 'P'
      default: return '●'
    }
  }

  // ---------- 取景 ----------

  /** v2.1 取景高度：水合后用真实最高楼层（而非默认 18 层估算），取景更贴合。 */
  private maxBuildingHeight(): number {
    const floors = this.hydratedBuildings
      ? Math.max(1, ...this.hydratedBuildings.map((b) => b.floors || 0))
      : DEFAULT_FLOOR_ESTIMATE
    return floors * this.scaffold.floorHeight
  }

  private frameCamera() {
    const centroid = this.positionAndFrame(ParkScene.DEFAULT_K, ParkScene.DEFAULT_ELEV, ParkScene.DEFAULT_AZ)
    this.defaultTarget.copy(centroid)
    this.defaultZoom = 1
    // 后处理依赖相机/尺寸，取景变化后重建 pass 尺寸。
    this.buildPostFX()
  }

  /**
   * 取景内核（v2.2 从 frameCamera 抽出）：按 (K, elevation, az) 定位相机 + 测内容包围盒算非对称正交视锥。
   * - K = 园区内容占画面比例（0.66 默认全景；0.55 俯瞰全城）。
   * - elevation = 相机俯角（above-horizon，rad）。
   * - az = 方位角（rad）；巡航过渡期传 currentAzimuth() 保持用户/autoRotate 的当前朝向连续。
   * 返回内容质心（= 瞄准/轨道中心）。
   */
  private positionAndFrame(K: number, elevation: number, az: number): THREE.Vector3 {
    this.curK = K
    this.curElev = elevation
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const Hmax = this.maxBuildingHeight()
    const centroid = new THREE.Vector3(0, Hmax / 2, 0)
    const dist = 3000
    this.camera.position.set(dist * Math.cos(elevation) * Math.cos(az) + centroid.x, dist * Math.sin(elevation) + centroid.y, dist * Math.cos(elevation) * Math.sin(az) + centroid.z)
    this.camera.lookAt(centroid)
    this.camera.updateMatrixWorld()

    const canvasW = this.canvas.clientWidth || 1920
    const canvasH = this.canvas.clientHeight || 1080
    const corners: THREE.Vector3[] = []
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) corners.push(new THREE.Vector3(sx * bx, sy * Hmax, sz * bz))
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity
    for (const c of corners) {
      const v = c.clone().applyMatrix4(this.camera.matrixWorldInverse)
      xmin = Math.min(xmin, v.x); xmax = Math.max(xmax, v.x)
      ymin = Math.min(ymin, v.y); ymax = Math.max(ymax, v.y)
    }
    const cx = (xmin + xmax) / 2
    const A = canvasW / canvasH
    const M = (1 - K) / 2
    const cw = xmax - xmin
    const ch = ymax - ymin
    const frustumH = Math.max(ch / K, cw / (A * K))
    const frustumW = A * frustumH
    this.camera.zoom = 1
    this.camera.bottom = ymin - M * frustumH
    this.camera.top = this.camera.bottom + frustumH
    this.camera.left = cx - frustumW / 2
    this.camera.right = cx + frustumW / 2
    this.camera.near = 1
    this.camera.far = 8000
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(centroid)
    this.controls.update()
    return centroid
  }

  /** 当前方位角（从相机相对 target 的偏移读出，未定位时回退默认 π/4）——巡航过渡期保持朝向连续。 */
  private currentAzimuth(): number {
    const off = new THREE.Vector3().subVectors(this.camera.position, this.controls.target)
    if (off.lengthSq() < 1) return ParkScene.DEFAULT_AZ
    return Math.atan2(off.z, off.x)
  }

  /** 把 above-horizon 俯角钳到 OrbitControls polar 夹紧 [minPolarAngle, maxPolarAngle] 允许的范围。 */
  private clampElevation(elev: number): number {
    const minElev = Math.PI / 2 - this.controls.maxPolarAngle
    const maxElev = Math.PI / 2 - this.controls.minPolarAngle
    return Math.max(minElev, Math.min(maxElev, elev))
  }

  // ---------- 相机聚焦补间 ----------

  focusBuilding(id: string | null) {
    // v2.2：聚焦优先——若航拍巡航的取景过渡仍在进行，取消它（两者都会写 target/zoom，互斥避免打架）。
    // 触发场景：巡航中点击楼栋 → pointerdown 先退出巡航(outro frameTween 起) → pointerup 聚焦(本方法)。
    if (this.frameTween?.active) this.frameTween.active = false
    const startTarget = this.controls.target.clone()
    const startZoom = this.camera.zoom
    let toTarget: THREE.Vector3
    let toZoom: number
    if (!id) {
      toTarget = this.defaultTarget.clone()
      toZoom = this.defaultZoom
    } else {
      const meta = this.buildingMap.get(id)
      if (!meta) return
      const h = Math.max(meta.floors, 1) * this.scaffold.floorHeight
      toTarget = new THREE.Vector3(meta.x, h / 2, meta.z)
      toZoom = 1.8
    }
    this.tween = { active: true, start: performance.now(), dur: this.reducedMotion ? 0 : 600, fromTarget: startTarget, toTarget, fromZoom: startZoom, toZoom }
  }

  private stepTween(now: number) {
    const t = this.tween
    if (!t || !t.active) return
    const e = t.dur <= 0 ? 1 : Math.min(1, (now - t.start) / t.dur)
    const k = easeOutCubic(e)
    this.controls.target.lerpVectors(t.fromTarget, t.toTarget, k)
    this.camera.zoom = t.fromZoom + (t.toZoom - t.fromZoom) * k
    this.camera.updateProjectionMatrix()
    this.controls.update()
    if (e >= 1) t.active = false
  }

  // ---------- v2.2 航拍巡航（§13）----------

  /**
   * 航拍巡航开关：on → 取景过渡到鸟瞰（K/framingK、elevation）后开 autoRotate 稳态环绕；
   * off → 关 autoRotate + 过渡回默认取景。复用 §8「事件触发 + 有限时长 + 结束后释放 OrbitControls」纪律。
   * reducedMotion 下为 no-op（autoRotate 本身是运动，须与 §8 tween/呼吸动画同纪律禁用）。
   * 用户拖拽触发 onTourAutoExit → GlobalTwin → useTour.disable() → watch → 本方法(false)，单向。
   */
  setTourEnabled(on: boolean) {
    if (this.reducedMotion) return
    if (on && this.tourMode) return
    if (!on && !this.tourMode) return
    const dur = this.reducedMotion ? 0 : 600
    if (on) {
      this.tourMode = true
      this.tourActive = false
      // 巡航优先——取消进行中的聚焦补间（两者都写 target/zoom，互斥；与 focusBuilding 对称）。
      if (this.tween?.active) this.tween.active = false
      this.controls.autoRotate = false // 过渡期间不转，到位再开（避免过渡与自转叠加）
      const ct: NonNullable<ParkScaffold['cameraTour']> = this.scaffold.cameraTour ?? {}
      const toK = ct.framingK ?? 0.55
      const toElev = this.clampElevation(ct.elevation ?? 1.0)
      this.frameTween = {
        active: true, start: performance.now(), dur,
        fromK: this.curK, toK, fromElev: this.curElev, toElev,
        onDone: () => {
          this.controls.autoRotateSpeed = ct.speed ?? 0.6
          this.controls.autoRotate = true
          this.tourActive = true
        },
      }
    } else {
      this.tourMode = false
      this.tourActive = false
      this.controls.autoRotate = false
      this.frameTween = {
        active: true, start: performance.now(), dur,
        fromK: this.curK, toK: ParkScene.DEFAULT_K, fromElev: this.curElev, toElev: ParkScene.DEFAULT_ELEV,
      }
    }
  }

  private stepFrameTween(now: number) {
    const t = this.frameTween
    if (!t || !t.active) return
    const e = t.dur <= 0 ? 1 : Math.min(1, (now - t.start) / t.dur)
    const k = easeOutCubic(e)
    const K = t.fromK + (t.toK - t.fromK) * k
    const elev = this.clampElevation(t.fromElev + (t.toElev - t.fromElev) * k)
    // 方位角取当前（autoRotate/用户拖拽留下的朝向），过渡期不强行扳回 → 退出时朝向连续不突兀。
    this.positionAndFrame(K, elev, this.currentAzimuth())
    if (e >= 1) {
      t.active = false
      const done = t.onDone
      this.frameTween = null
      if (done) done()
    }
  }

  // ---------- 金色选中 overlay ----------

  setSelection(bid: string | null, fin: number | null) {
    const hide = () => { this.selectionOverlay.visible = false; this.selectionFill.visible = false }
    if (!bid || fin == null) { hide(); return }
    const meta = this.buildingMap.get(bid)
    if (!meta || meta.slabs.length === 0) { hide(); return }
    const slab = meta.slabs[fin]
    if (!slab) { hide(); return }
    const fh = this.scaffold.floorHeight
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(meta.x, (fin + 0.5) * fh, meta.z),
      new THREE.Vector3(meta.w * 1.04, fh * 0.98, meta.d * 1.04),
    )
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = box.getCenter(new THREE.Vector3())
    this.selectionOverlay.scale.set(size.x, size.y, size.z)
    this.selectionOverlay.position.copy(center)
    this.selectionFill.scale.set(size.x, size.y, size.z)   // 黄色填充层与金色边框同盒
    this.selectionFill.position.copy(center)
    this.selectionOverlay.visible = true
    this.selectionFill.visible = true
  }

  getFloorId(buildingId: string, floorIndex: number): string | undefined {
    return this.floorIdMap.get(`${buildingId}:${floorIndex}`)
  }

  worldToScreen(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera)
    const rect = this.canvas.getBoundingClientRect()
    return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height }
  }

  // ---------- 指针交互 ----------

  private bindPointer() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
  }

  private updatePointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
  }

  private pickPoi(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.poiPickables, false)
    return hits.length ? (hits[0].object.userData.poiId as string) : null
  }

  private pickBuilding(): { bid: string; fin: number } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, false)
    if (!hits.length) return null
    const ud = hits[0].object.userData
    if (ud.kind !== 'building') return null
    return { bid: ud.buildingId as string, fin: (ud.floorIndex ?? 0) as number }
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY }
    // v2.2 §13：巡航中用户一按下即退出（把控制权还给用户）；pauseOnInteract 默认 true。
    // 立即关 autoRotate 防止拖拽与自转打架；正式收尾由 onTourAutoExit → useTour.disable() → watch → setTourEnabled(false) 单向完成。
    if (this.tourMode && (this.scaffold.cameraTour?.pauseOnInteract !== false)) {
      this.controls.autoRotate = false
      this.cb.onTourAutoExit?.()
    }
  }
  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return
    this.updatePointer(e)
    const poiId = this.pickPoi()
    if (poiId) { this.cb.onHover?.(null, null); this.cb.onPoiHover?.(poiId); this.canvas.style.cursor = 'pointer'; return }
    this.cb.onPoiHover?.(null)
    const b = this.pickBuilding()
    this.cb.onHover?.(b?.bid ?? null, b?.fin ?? null)
    this.canvas.style.cursor = b ? 'pointer' : 'default'
  }
  private onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
    if (moved > 4) return
    this.updatePointer(e)
    const poiId = this.pickPoi()
    if (poiId) { this.cb.onPoiOpen?.(poiId); return }
    const b = this.pickBuilding()
    if (b) this.cb.onSelect?.(b.bid, b.fin)
    else this.cb.onDeselect?.()
  }

  // ---------- 生命周期 ----------

  private onResize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    if (this.composer) this.composer.setSize(w, h)
    if (this.bloomPass) this.bloomPass.setSize(w, h)
    if (this.gtaoPass) this.gtaoPass.setSize(w, h)
    this.frameCamera()
  }

  private onContextLost = (e: Event) => {
    e.preventDefault()
    this.contextLost = true
    cancelAnimationFrame(this.rafId)
  }

  private onContextRestored = () => {
    this.contextLost = false
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.animate()
  }

  private animate = () => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.animate)
    if (this.contextLost) return
    if (this.tween?.active) this.stepTween(performance.now())
    if (this.frameTween?.active) this.stepFrameTween(performance.now())
    this.controls.update()
    if (!this.reducedMotion) {
      const t = performance.now() * 0.004
      this.sceneGroup.traverse((o) => {
        if ((o as THREE.Mesh).userData?.poiAlarm) {
          const s = 1 + Math.sin(t) * 0.18
          o.scale.setScalar(s)
        }
      })
    }
    // v2.0：启用 composer 时走后处理链（含 bloom/AO/OutputPass），否则直渲。
    if (this.composer) this.composer.render()
    else this.renderer.render(this.sceneObj, this.camera)
    // overlay 第二遍渲染：绕过 GTAO/bloom，保证楼顶名/P 牌/POI 图标 7 风格清晰可读。
    // autoClear=false 保留主帧颜色；sprite 统一 depthTest:false 始终置顶。
    this.renderer.autoClear = false
    this.renderer.render(this.overlayScene, this.camera)
    this.renderer.autoClear = true
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.ro?.disconnect()
    this.controls.autoRotate = false
    this.controls?.dispose()
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    window.clearTimeout(this.resizeTimer)
    this.disposePostFX()
    this.disposeReflector()
    this.envMapTarget?.dispose()
    this.pmrem?.dispose()
    // selectionFill 在 keep 集中、clearSceneGroup 不回收，这里显式释放（overlay 既有同样未释放，保持现状）
    this.selectionFill.geometry.dispose()
    const fm = this.selectionFill.material
    if (Array.isArray(fm)) (fm as THREE.Material[]).forEach((m) => m.dispose())
    else (fm as THREE.Material).dispose()
    this.clearSceneGroup()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
      if (m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mat of mats) {
          const mm = mat as THREE.MeshStandardMaterial
          if (mm.map) mm.map.dispose()
          if (mm.emissiveMap) mm.emissiveMap.dispose()
          mat.dispose()
        }
      }
    })
  }

  // ---------- CanvasTexture 标签 ----------

  private makeContrastLabel(text: string, bg: string, fg: string, stroke: THREE.Color | string, weight = 700): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    const pad = 12
    const fontSize = text.length > 3 ? 40 : 56
    canvas.width = text.length * fontSize + pad * 2
    canvas.height = fontSize + pad * 2
    const ctx = canvas.getContext('2d')!
    const strokeHex = typeof stroke === 'string' ? stroke : `#${stroke.getHexString()}`
    ctx.fillStyle = bg
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 10)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = strokeHex
    roundRect(ctx, 1.5, 1.5, canvas.width - 3, canvas.height - 3, 9)
    ctx.stroke()
    ctx.fillStyle = fg
    ctx.font = `${weight} ${fontSize}px "Noto Sans SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  private makeCarProxy(colorHex: string): THREE.Group {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 20), new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex) }))
    body.position.y = 5
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 10), new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex) }))
    top.position.set(0, 10, -1)
    g.add(body, top)
    return g
  }
}

// ---------- 工具 ----------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
