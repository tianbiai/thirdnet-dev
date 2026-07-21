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
import { buildBuilding } from './building-geometry'
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

const FLOOR_HIGHLIGHT_COLOR = 0xffd400
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
  private tween: { active: boolean; start: number; dur: number; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; fromZoom: number; toZoom: number } | null = null
  private defaultTarget = new THREE.Vector3(0, 0, 0)
  private defaultZoom = 1

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
    const mat = new THREE.LineBasicMaterial({ color: FLOOR_HIGHLIGHT_COLOR, transparent: true, opacity: 0.95 })
    this.selectionOverlay = new THREE.LineSegments(edges, mat)
    this.selectionOverlay.visible = false
    this.sceneGroup.add(this.selectionOverlay)
    boxGeo.dispose()

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
    const sc = this.tokens.scene as Record<string, string>
    this.sceneObj.background = this.makeBackgroundTexture(sc.bgTop, sc.bgBottom)
    this.sceneObj.fog = this.makeFog()
  }

  /** v1.9 顶→底纵向渐变背景。暗色风格给空气层次，亮色风格两端相近近似纯色。 */
  private makeBackgroundTexture(top: string, bottom: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, top)
    grad.addColorStop(1, bottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 8, 256)
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
    const keep = new Set<THREE.Object3D>([this.selectionOverlay])
    for (let i = this.sceneGroup.children.length - 1; i >= 0; i--) {
      const c = this.sceneGroup.children[i]
      if (keep.has(c)) continue
      this.sceneGroup.remove(c)
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
    let mat: THREE.Material
    if (this.profile.ground === 'light' || this.profile.ground === 'flat') {
      mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.profile.ground === 'light' ? '#cfd2d6' : '#c9b79b'), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    } else if (this.profile.ground === 'pbr') {
      mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(grass), roughness: 0.95, metalness: 0 })
    } else {
      mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.style === 'night-realistic' ? '#0a1018' : '#06070d'), roughness: 0.4, metalness: 0 })
    }
    // v1.9 程序化地面纹理叠加（消灭纯色色片）。
    const groundTex = this.makeGroundTexture()
    if (groundTex && mat instanceof THREE.MeshStandardMaterial) (mat as THREE.MeshStandardMaterial).map = groundTex
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
      const psprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ptex, depthTest: true, transparent: true }))
      psprite.position.set(rowX, 2, z)
      psprite.scale.set(7, 7, 1)
      this.sceneGroup.add(psprite)
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

      const canopyGeo = new THREE.IcosahedronGeometry(12, 0)
      const canopyMat = this.profile.building === 'wire'
        ? new THREE.MeshBasicMaterial({ color: new THREE.Color(e.treeCanopy) })
        : new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeCanopy), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, positions.length)
      const up = new THREE.Matrix4()
      positions.forEach((m, i) => {
        const pos = new THREE.Vector3().setFromMatrixPosition(m)
        up.makeTranslation(pos.x, trunkH + 10, pos.z)
        canopyInst.setMatrixAt(i, up)
      })
      canopyInst.castShadow = this.profile.shadows
      this.sceneGroup.add(canopyInst)
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
      const m = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.2 })
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
      const labelTex = this.makeContrastLabel(item.name, this.tokens.palette['void-bg'] as string, (this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff', this.tokens.category.building)

      // 几何装配统一交给 building-geometry.buildBuilding——所有 y 坐标对齐只在那里定义一次。
      const { slabs } = buildBuilding({
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
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }))
    const facingOffset = this.facingOffset(facing, b.d * 0.6 + 24)
    sign.position.set(facingOffset.x, b.d * 0.9 + 30, facingOffset.z)
    sign.scale.set(44, 44, 1)
    group.add(sign)
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
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }))
    sprite.position.set(mid.x, y + 18, mid.z)
    sprite.scale.set(Math.max(120, c.label.length * 18), 26, 1)
    this.sceneGroup.add(sprite)
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
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }))
      icon.position.y = 34
      icon.scale.set(20, 20, 1)
      group.add(icon)
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

  private frameCamera() {
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const Hmax = Math.max(DEFAULT_FLOOR_ESTIMATE, ...this.scaffold.buildings.map((b) => b.category === 'garage' ? 1 : DEFAULT_FLOOR_ESTIMATE)) * this.scaffold.floorHeight
    const centroid = new THREE.Vector3(0, Hmax / 2, 0)
    const elevation = Math.atan(1 / Math.sqrt(2))
    const az = Math.PI / 4
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
    const K = 0.66
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
    this.defaultTarget.copy(centroid)
    this.defaultZoom = 1
    // 后处理依赖相机/尺寸，取景变化后重建 pass 尺寸。
    this.buildPostFX()
  }

  // ---------- 相机聚焦补间 ----------

  focusBuilding(id: string | null) {
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

  // ---------- 金色选中 overlay ----------

  setSelection(bid: string | null, fin: number | null) {
    if (!bid || fin == null) { this.selectionOverlay.visible = false; return }
    const meta = this.buildingMap.get(bid)
    if (!meta || meta.slabs.length === 0) { this.selectionOverlay.visible = false; return }
    const slab = meta.slabs[fin]
    if (!slab) { this.selectionOverlay.visible = false; return }
    const fh = this.scaffold.floorHeight
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(meta.x, (fin + 0.5) * fh, meta.z),
      new THREE.Vector3(meta.w * 1.04, fh * 0.98, meta.d * 1.04),
    )
    const size = new THREE.Vector3()
    box.getSize(size)
    this.selectionOverlay.scale.set(size.x, size.y, size.z)
    this.selectionOverlay.position.copy(box.getCenter(new THREE.Vector3()))
    this.selectionOverlay.visible = true
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

  private onPointerDown = (e: PointerEvent) => { this.pointerDownPos = { x: e.clientX, y: e.clientY } }
  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return
    this.updatePointer(e)
    const poiId = this.pickPoi()
    if (poiId) { this.cb.onHover?.(null, null); this.canvas.style.cursor = 'pointer'; return }
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
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.ro?.disconnect()
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

  private makeContrastLabel(text: string, bg: string, fg: string, stroke: THREE.Color | string): THREE.CanvasTexture {
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
    ctx.font = `700 ${fontSize}px "Noto Sans SC", sans-serif`
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
