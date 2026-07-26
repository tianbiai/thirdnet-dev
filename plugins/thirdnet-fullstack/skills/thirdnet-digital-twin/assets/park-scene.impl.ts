/**
 * ParkScene —— 园区数字孪生中央 3D 场景（v2.0 范式实现）。
 *
 * 这是技能随包发布的「范式实现」：生成器拷贝本文件为目标项目的 `src/scene/ParkScene.ts`，
 * 再按 spec（脚手架数据源、spec.style、token）改写。**不要从散文合成**——本文件已把
 * v1.9 漂移项（scene.background 渐变 / ambientFloor / 程序化地面纹理）和 v2.0 写实增强层
 * （RoomEnvironment 环境贴图 / EffectComposer+Bloom / GTAO / 地面反射）全部落地。
 *
 * 写实纪律（与 styles.md 一致）：
 * - v2.5 恢复 realistic/night-realistic 两风格并激活写实引擎（envMap + GTAO + 2048² 软阴影；night-realistic 额外 Reflector 湿润反射 + 雾 + 强 bloom + 夜间发光窗）。接受 ~15-25% 帧率成本。
 * - cyber/isometric 2 风格守纪律：无环境贴图、无 AO、PointLight≤8、transmission 禁用、DPR≤2。
 * - 无 WebGL2 时降级：禁 AO/反射/transmission、bloom 降级、环境贴图退化为更高强度 ambient。
 *
 * 能力：脚手架静态几何 → hydrateBuildings / hydratePois 动态水合；setStyle 4 风格运行时
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
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import gridFrag from './shaders/gridGround.glsl?raw'
import { buildBuilding, buildRooftopKit, buildUndergroundGarage } from './building-geometry'
import type { GarageRoomSpec, UndergroundMaterials } from './building-geometry'
import { applyTheme, type StyleKey, type ThemeTokens } from '@/utils/theme'
import type { BuildingRuntimeItem, PoiRuntimeItem } from '@/api/types/digital-twin'
import { PoiStatusEnum, PoiTypeEnum } from '@/api/types/digital-twin'
import type { ParkScaffold, ScaffoldBuilding, ScaffoldGarage } from '@/data/park'

export interface ParkSceneCallbacks {
  onHover?: (bid: string | null, fin: number | null) => void
  onSelect?: (bid: string, fin: number) => void
  onDeselect?: () => void
  onPoiOpen?: (poiId: string | null) => void
  /** v2.1：POI 悬停（驱动 HTML 名称条，§11「名称仅悬停」契约；未命中传 null）。 */
  onPoiHover?: (poiId: string | null) => void
  /** v2.2：航拍巡航因用户拖拽自动退出（§13）——GlobalTwin 映射到 useTour.disable()，单向同步按钮态。 */
  onTourAutoExit?: () => void
  /** v2.6：地下车库选中（地下视角下点击坑体）——GlobalTwin 映射到 useSelection.selectGarage()，null=取消。 */
  onGarageSelect?: (id: string | null) => void
}

// ---------------------------------------------------------------------------
// v2.15 夜间发光窗流水线类型 + 默认（仅 pbr-night 消费）
// ---------------------------------------------------------------------------
/** 单扇可动画窗户在 emissive 画布上的状态（绝对时钟，便于暂停/恢复不跳相）。 */
interface FacadeWindow {
  x: number; y: number; w: number; h: number   // emissive 画布像素矩形
  color: 'warm' | 'cool'                        // 创建时定的辉光色
  cur: number                                   // 当前亮度 0..1
  from: number; to: number                      // 当前过渡端点
  fadeStart: number                             // 过渡起始 ms（绝对；0=空闲）
  nextFlip: number                              // 下次翻转目标 ms（绝对）
}
/** 单立面（一楼一侧）动画聚合：emissive 画布的 ctx + tex + 仅动画子集 + 独立翻转种子流。 */
interface FacadeAnim {
  ctx: CanvasRenderingContext2D
  tex: THREE.CanvasTexture
  rngFlip: () => number                          // 独立于点亮种子的翻转时序流
  windows: FacadeWindow[]                        // 仅参与动画的子集（≤ animRatio·总数）
  warmColor: string                              // 构造时定格的辉光色（避免 animate 每帧读 token）
  coolColor: string
  fadeMs: number
  flipMinMs: number
  flipVarMs: number
}
/** computeWindowLayout 产出的单扇窗单元（albedo 与 emissive 共用，确定性一致）。 */
interface WindowCell {
  x: number; y: number; w: number; h: number     // albedo/emissive 画布像素矩形
  color: 'warm' | 'cool'
  lit: boolean                                   // 初始是否点亮
  animatable: boolean                            // 是否参与开关动画
}
/** tokens.windows 的读取形状（缺省走 DEFAULT_WINDOWS）。 */
interface WindowsTokens {
  roomsAxisTower: number
  roomsAxisPodium: number
  litRatio: { ground: number; middle: number; top: number }
  warmColor: string
  coolColor: string
  warmRatio: number
  glassOff: string
  gradient: { top: string; bottom: string }
  animRatio: number
  fadeMs: number
  flipMinMs: number
  flipVarMs: number
  emissiveIntensity: number
  seedSalt?: string
}
/** 缺省（token 无 windows 块时兜底；animRatio>0 默认开启动画）。 */
const DEFAULT_WINDOWS: WindowsTokens = {
  roomsAxisTower: 3,
  roomsAxisPodium: 5,
  litRatio: { ground: 0.0, middle: 0.38, top: 0.22 },
  warmColor: '#ffd989',
  coolColor: '#bfe2ff',
  warmRatio: 0.7,
  glassOff: '#0c2240',
  gradient: { top: '#4a93d8', bottom: '#27609c' },
  animRatio: 0.2,
  fadeMs: 800,
  flipMinMs: 3000,
  flipVarMs: 8000,
  emissiveIntensity: 1.3,
}

interface StyleProfile {
  toneMapping: THREE.ToneMapping
  toneExposure: number
  shadows: boolean
  ground: 'grid' | 'pbr' | 'dark' | 'light' | 'flat'
  building: 'emissive' | 'pbr' | 'pbr-night' | 'flat'
  flatShading?: boolean
  /** 是否烘焙并挂载 RoomEnvironment 环境贴图（v2.5：realistic/night-realistic 启用，其余 2 风格 false）。 */
  envMap: boolean
  /** 是否启用后处理 composer（含 bloom）。 */
  composer: boolean
  /** 是否启用 GTAO 接触阴影（写实两风格）。 */
  ao: boolean
  /** 是否启用地面湿润反射（夜间）。 */
  reflect: boolean
  /** v2.5：透视相机（写实两风格 true——正交相机会把 PBR 场景压成「等距/扁平」观感）。 */
  perspective?: boolean
}

const PROFILES: Record<StyleKey, StyleProfile> = {
  // cyber：bloom 为主 + 网格着色器地面，无 env/AO/反射
  cyber:             { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.0, shadows: false, ground: 'grid',  building: 'emissive',   composer: true,  envMap: false, ao: false, reflect: false },
  // isometric：flatShading 扁平轴测
  isometric:         { toneMapping: THREE.NoToneMapping, toneExposure: 1.0, shadows: false, ground: 'flat', building: 'flat', flatShading: true, composer: false, envMap: false, ao: false, reflect: false },
  // v2.5 恢复写实两风格——激活全套写实引擎：
  // realistic：日间 PBR（RoomEnvironment 环境贴图 + GTAO 接触阴影 + 2048² PCFSoft 软阴影），无地面反射/雾。
  realistic:         { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 1.0, shadows: true,  ground: 'pbr',   building: 'pbr',       composer: true,  envMap: true,  ao: true,  reflect: false, perspective: true },
  // night-realistic：夜间 PBR + Reflector 湿润地面反射 + 雾 + 强 bloom（发光窗/路灯辉光）。
  // v2.19：恢复 reflect:true（湿润反射为夜景签名特性）；曝光改由 token.realism.exposure 驱动。
  'night-realistic': { toneMapping: THREE.ACESFilmicToneMapping, toneExposure: 2.5, shadows: true,  ground: 'dark',  building: 'pbr-night', composer: true,  envMap: true,  ao: true,  reflect: true, perspective: true },
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
  private camera!: THREE.OrthographicCamera | THREE.PerspectiveCamera
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
  /** v2.0 环境贴图（RoomEnvironment PMREM），写实两风格启用。 */
  private envMapTarget: THREE.WebGLRenderTarget | null = null
  /** v2.0 夜间地面反射。 */
  private reflector: Reflector | null = null
  private pmrem: THREE.PMREMGenerator | null = null
  /** v2.19 真实天空 HDRI 烘焙后的环境贴图（PMREM），写实两风格用作 IBL；未就绪时回退 RoomEnvironment。 */
  private hdriEnvTexture: THREE.Texture | null = null
  private hdriLoading = false

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
  /** v2.6 地下车库拾取盒（仅 belowView 时参与 raycast）。 */
  private garagePickables: THREE.Object3D[] = []
  /** 报警 POI 的 halo 列表（animate 逐帧呼吸缩放，免整树 traverse——v2.6 地下节点膨胀后尤为关键）。随 buildPOIs 重建、clearSceneGroup 清空。 */
  private alarmPois: THREE.Object3D[] = []
  /** v2.15 夜间发光窗动画状态（每楼一顶）。clearSceneGroup 清空；CanvasTexture 经 disposeObject 释放。
   * reducedMotion 时根本不填（构造期门控），animate 也不再驱动——保留静态点亮图。 */
  private facadeAnims: FacadeAnim[] = []
  /** worldToScreen 投影复用向量（每帧调用，避免逐次 new Vector3）。 */
  private _proj = new THREE.Vector3()

  /** v2.6 地下视角：belowView 开关 + belowBlend 补间（相机在「锚点↔坑中平视」间过渡）。
   * 设计对齐 web 驾驶舱 setBelowView——设的是 position/target（非 polar），故正交/透视相机都适用。 */
  private belowView = false
  private belowBlend = 0
  private belowAnchor = new THREE.Vector3()
  private belowTargetAnchor = new THREE.Vector3()
  private sideCamPos = new THREE.Vector3()
  private sideTarget = new THREE.Vector3()
  private belowZoom = 1
  private belowZoomAnchor = 1
  /** OrbitControls 极角上限（v2.10 起放开到 π-0.1≈174°——允许拖到地面之下、从下仰视坑体；从下方看 Y=0 不透明地面因 BackSide culling 自然消失，坑体净可见）。belowView 期间沿用同值。 */
  private static readonly MAX_POLAR = Math.PI - 0.1

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
  /** v2.5 写实风格透视相机 FOV（度）——50° 接近 28mm 广角，建筑垂直线明显会聚、前后景有大小差，读得出透视纵深（过窄如 35° 会显得接近平视/正交）。 */
  private static readonly REALISTIC_FOV = 50
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

    // v2.5：写实两风格用透视相机（正交相机会把 PBR 场景压成「等距/扁平」观感）。
    // 相机类型在构造期按 scaffold.style 一次性决定（正交↔透视运行时切换不重建相机，属已知限制）。
    const cw0 = canvas.clientWidth || 1920
    const ch0 = canvas.clientHeight || 1080
    const targetProfile = PROFILES[(this.scaffold.style as StyleKey) ?? 'cyber'] ?? PROFILES.cyber
    this.camera = targetProfile.perspective
      ? new THREE.PerspectiveCamera(ParkScene.REALISTIC_FOV, cw0 / ch0, 1, 8000)
      : new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 8000)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.minPolarAngle = 0.08  // v2.18：放开极角下限，让围合式园区中央地面元素（水池/地下坑底）可拖到近顶视查看（默认斜视不变）
    this.controls.maxPolarAngle = ParkScene.MAX_POLAR   // v2.10：放开到 π-0.1 允许地下俯仰
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
    // v2.19：曝光优先走 token.realism.exposure（数据化调参），缺省回退 PROFILES.toneExposure。
    const rExp = (this.tokens.realism as { exposure?: number } | undefined)?.exposure
    this.renderer.toneMappingExposure = typeof rExp === 'number' ? rExp : p.toneExposure
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
    this.garagePickables = []
    this.alarmPois = []
    this.facadeAnims = []   // v2.15：CanvasTexture 由 disposeObject 经 material.emissiveMap 释放，此处仅弃引用
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
    this.buildUnderground()   // v2.6 地下车库多层剖面（Y<0 透明玻璃柱坑体），§14
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
    // 仅 profile.envMap 且 WebGL2 可用时烘焙（v2.5：realistic/night-realistic）；其余风格 / 无 WebGL2 跳过。
    if (!this.profile.envMap || !this.isWebGL2) {
      this.sceneObj.environment = null
      return
    }
    // v2.19：优先用真实天空 HDRI（户外 IBL，玻璃幕墙反射与天空方向/色温一致——写实最大收益）。
    if (this.hdriEnvTexture) {
      this.sceneObj.environment = this.hdriEnvTexture
      return
    }
    // HDRI 未就绪：回退 RoomEnvironment（室内工作室烘焙）兜底首帧，并触发 HDRI 加载。
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer)
    const env = new RoomEnvironment()
    this.envMapTarget = this.pmrem.fromScene(env, 0.04)
    this.sceneObj.environment = this.envMapTarget.texture
    ;(env as unknown as { dispose?: () => void }).dispose?.()
    if (!this.hdriLoading) this.loadEnvHDRI()
  }

  /**
   * v2.19 异步加载 public/sky.hdr（CC0 户外 HDRI）→ PMREM 烘焙 → 缓存为 hdriEnvTexture。
   * 加载成功且当前风格需要 envMap 时，触发一次 setStyle 重建以拾取真实天空 IBL。
   * 失败则保持 RoomEnvironment 兜底（console.warn），不阻断渲染。
   */
  private loadEnvHDRI() {
    if (this.hdriLoading || this.hdriEnvTexture) return
    this.hdriLoading = true
    const loader = new RGBELoader()
    loader.load(
      'sky.hdr',
      (tex) => {
        if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer)
        this.hdriEnvTexture = this.pmrem.fromEquirectangular(tex).texture
        tex.dispose()
        this.hdriLoading = false
        // 当前风格若是写实（envMap），重建一次让材质读真实 IBL；非写实风格不必重建。
        if (this.profile?.envMap) this.setStyle(this.style)
      },
      undefined,
      (err) => {
        this.hdriLoading = false
        console.warn('[ParkScene] HDRI sky.hdr 加载失败，回退 RoomEnvironment', err)
      },
    )
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
      // GTAOPass 需要场景中可投射 AO 的对象；此处给全场，强度/半径走 token（v2.5：radius 不再硬编码）。
      const gtao = new GTAOPass(this.sceneObj, this.camera, w, h)
      gtao.output = GTAOPass.OUTPUT.Default
      this.configureGTAO(gtao, ao?.intensity ?? 0.6, ao?.radius ?? 0.25)
      this.composer.addPass(gtao)
      this.gtaoPass = gtao
    }
    if (wantBloom) {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), bloom!.strength ?? 0.3, bloom!.radius ?? 0.4, bloom!.threshold ?? 0.6)
      this.composer.addPass(bloomPass)
      this.bloomPass = bloomPass
    }
    // v2.19：SMAA 抗锯齿——composer 路径绕过了渲染器 MSAA（渲染到 WebGLRenderTarget），
    // 所有 composer 风格（cyber/写实/夜景）的霓虹线/玻璃边/网格都会锯齿。
    // SMAAPass 在 bloom 之后、OutputPass 之前做边缘抗锯齿（isometric 无 composer，仍走渲染器 MSAA）。
    this.composer.addPass(new SMAAPass(this.canvas.clientWidth || 1920, this.canvas.clientHeight || 1080))
    // OutputPass 在 composer 末端做正确的 tone mapping + 色彩空间转换（取代旧 setAlpha/色调手工修正）。
    this.composer.addPass(new OutputPass())
  }

  private configureGTAO(gtao: GTAOPass, intensity: number, radius: number) {
    // v2.5：radius 来自 token.realism.ao.radius（此前硬编码 0.25、token 声明却无效）。
    // 通过 Record<string, unknown> 赋值绕过 three 版本间属性类型差异（普通属性赋值不会抛）。
    const g = gtao as unknown as Record<string, unknown>
    g.radius = radius
    g.intensity = intensity
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
    // v1.9 环境光下限：所有风格恒加（v2.5 修正——此前 ambient 已设时会被跳过，违背「恒加」语义）。
    if (ambientFloor > 0) {
      // v2.18：兜底环境光用白色——旧版复用近黑 hemiSky（夜景 #1a2638）让 ambientFloor 强度形同虚设；白色低强度是标准做法、不破坏氛围。
      this.sceneGroup.add(new THREE.AmbientLight(new THREE.Color('#ffffff'), ambientFloor))
    }

    const hemi = new THREE.HemisphereLight(new THREE.Color(hemiSky), new THREE.Color(hemiGround), hemiIntensity)
    this.sceneGroup.add(hemi)

    {
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
        // v2.5：软阴影 radius/bias 走 token.realism.shadow（缺省 4 / -0.0003）。
        const sh = (this.tokens.realism as { shadow?: { radius?: number; bias?: number } }).shadow
        dir.shadow.radius = sh?.radius ?? 4
        dir.shadow.bias = sh?.bias ?? -0.0003
      }
      this.sceneGroup.add(dir)
      if (this.profile.shadows) this.sceneGroup.add(dir.target)
    }
  }

  // ---------- 地面（v1.9 程序化纹理 + v2.0 夜间反射） ----------

  private buildGround() {
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const env = this.tokens.environment as Record<string, unknown>

    const cityColor = (env['city-ground'] as string) ?? '#080418'
    const cityGeo = new THREE.PlaneGeometry(bx * 30, bz * 30)
    // v2.17：外圈城市地面改全透明（边界外透出页面背景 →「漂浮园区岛」）。市政道路/人行道/闸机是
    // buildSurrounding 独立 mesh、仍保留（浮在透明背景上）。renderer 已 alpha:true。
    const cityMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(cityColor), transparent: true, opacity: 0, depthWrite: false })
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
      // v2.17：网格 shader 地面半透——其下加不透明衬底保证「园区内不透明」（遮挡地下坑体 + 不透出页面背景）。
      // 衬底色取 environment.city-ground，网格仍画于其上（视觉等价旧「网格叠暗城市地面」）。
      const gridBack = new THREE.Mesh(new THREE.PlaneGeometry(bx * 2, bz * 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(cityColor) }))
      gridBack.rotation.x = -Math.PI / 2
      gridBack.position.y = -0.05
      if (this.profile.shadows) gridBack.receiveShadow = true
      this.sceneGroup.add(gridBack)
      this.sceneGroup.add(m)
      return
    }

    // v2.0/v2.5 夜间湿润反射（Reflector，仅 night-realistic + WebGL2）。预算超限或缺 WebGL2 时降级为普通地面。
    // opacity = 反射强度上限；mixStrength = 与地面的混合权重（0=几乎只看地面、1=强反射）。二者相乘为有效不透明度
    // （v2.5：mixStrength 此前声明却从不消费——死旋钮，现已接通）。
    const r = this.tokens.realism as { reflection?: { enabled?: boolean; opacity?: number; mixStrength?: number } } | undefined
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
        const effOpacity = Math.max(0, Math.min(1, (r.reflection.opacity ?? 0.45) * (r.reflection.mixStrength ?? 1.0)))
        ;((this.reflector.material as unknown as { opacity: number })).opacity = effOpacity
        // v2.17：Reflector 半透——其下加不透明衬底保证「园区内不透明」（湿润反射叠于其上 + 遮挡地下坑体）。
        const reflBackMat = new THREE.MeshLambertMaterial({ color: new THREE.Color((env.road as string) ?? '#0e1426') })
        // emissive 底光：让 reflBack 不依赖 PointLight 也有底亮度（俯视/离路灯远的画面中央可见），
        // Lambert 部分仍受 PointLight 在路灯附近叠加加亮。解决俯视视角地面中央偏暗。
        reflBackMat.emissive = new THREE.Color((env.road as string) ?? '#0e1426')
        reflBackMat.emissiveIntensity = 0.9
        const reflBack = new THREE.Mesh(new THREE.PlaneGeometry(bx * 2, bz * 2), reflBackMat)
        reflBack.rotation.x = -Math.PI / 2
        reflBack.position.y = -0.05
        if (this.profile.shadows) reflBack.receiveShadow = true
        this.sceneGroup.add(reflBack)
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
    if (this.profile.ground === 'flat') {
      mat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#c9b79b'), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    } else if (this.profile.ground === 'pbr') {
      mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(grass), roughness: 0.95, metalness: 0 })
    } else {
      // dark 地面改用 MeshBasicMaterial（不受光）：夜景灯光暗，受光 Standard 会被压成近黑「看不见地面」；
      // 不受光直接按 token ground.texture 全色显示，保证地面可辨、与背景强对比。
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(groundTex ? '#ffffff' : '#06070d') })
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
    if (this.profile.shadows || this.profile.ground === 'pbr' || this.profile.ground === 'flat') {
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
    const lit = this.profile.shadows || this.profile.ground === 'pbr' || this.profile.ground === 'flat'
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
    const bx = this.scaffold.boundary.x
    const bz = this.scaffold.boundary.z
    const stallW = 14
    const stallD = 26
    // v2.17：二维网格布局 + 边界夹紧（修复旧版「单条直线 + 溢出边界」）。
    // 由边界反推网格容量，必不溢出（思路同 building-geometry.ts 地下车位 w/cols、d/rows）。
    const laneGap = 8
    const rowStep = stallW + laneGap
    const marginX = 70
    const marginZ = 70
    const maxCols = Math.max(1, Math.floor((2 * (bz - marginZ)) / stallD))
    const maxRows = Math.max(1, Math.floor((2 * (bx - marginX)) / rowStep))
    // 尽量接近方阵（sqrt），再被边界容量封顶；actualStalls = rows*cols（超出容量的 stall 自动截断）。
    const cols = Math.min(maxCols, Math.max(1, Math.ceil(Math.sqrt(stalls))))
    const rows = Math.min(maxRows, Math.ceil(stalls / cols))
    const total = Math.min(stalls, rows * cols)
    const cars = Math.min(total, occupied ?? Math.round(stalls * 0.3))
    // X：排锚在边界 +X 内侧、向内（−X）延展（避开中心楼栋）；Z：关于中心对称。
    const xEdge = bx - marginX - stallW / 2
    const xForRow = (r: number) => xEdge - r * rowStep
    const zForCol = (c: number) => (c - (cols - 1) / 2) * stallD
    const fillMat = this.profile.shadows
      ? new THREE.MeshLambertMaterial({ color: new THREE.Color(sp.stallFill) })
      : new THREE.MeshBasicMaterial({ color: new THREE.Color(sp.stallFill) })
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(sp.stallLine) })
    // P 牌纹理/材质全车位共用（同字同色，每车位重建一份 canvas 纹理是纯浪费）。
    const pTex = this.makeContrastLabel('P', sp.pMarkBg ?? sp.stallFill, sp.pMark, sp.stallLine)
    const pMat = new THREE.SpriteMaterial({ map: pTex, depthTest: false, transparent: true })
    for (let i = 0; i < total; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = xForRow(row)
      const z = zForCol(col)
      const stall = new THREE.Mesh(new THREE.PlaneGeometry(stallW, stallD - 2), fillMat)
      stall.rotation.x = -Math.PI / 2
      stall.position.set(x, 0.3, z)
      this.sceneGroup.add(stall)
      const loop = new THREE.LineLoop(new THREE.EdgesGeometry(new THREE.PlaneGeometry(stallW, stallD)), lineMat)
      loop.rotation.x = -Math.PI / 2
      loop.position.set(x, 0.35, z)
      this.sceneGroup.add(loop)
      const psprite = new THREE.Sprite(pMat)
      psprite.position.set(x, 2, z)
      psprite.scale.set(7, 7, 1)
      this.overlayScene.add(psprite)
      if (i < cars) {
        const car = this.makeCarProxy(sp.car ?? '#1e6fff')
        car.position.set(x, 0, z)
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
    const grassMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.grass), ...(this.profile.flatShading ? { flatShading: true } : {}) })
    for (const [gx, gz] of [[-bx * 0.5, -bz * 0.3], [bx * 0.5, -bz * 0.3], [-bx * 0.5, bz * 0.4], [bx * 0.5, bz * 0.4]]) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), grassMat)
      patch.rotation.x = -Math.PI / 2
      patch.position.set(gx, 0.15, gz)
      this.sceneGroup.add(patch)
    }
    if (env.greenery?.centralPlaza !== false) {
      const plazaMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) })
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
      const trunkMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeTrunk), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length)
      positions.forEach((m, i) => trunkInst.setMatrixAt(i, m))
      trunkInst.castShadow = this.profile.shadows
      this.sceneGroup.add(trunkInst)

      // v2.1/v2.5 树冠双形态：偶数位球形（Icosahedron）、奇数位锥形（Cone）——两种树形
      // 间隔排布打破「一整排同款球」的塑料感。v2.5：非 flat 风格球冠 detail 0→1（去宝石感、更有机），
      // 并加每株确定性缩放/Y 旋转变化；flat（等距 cel）保留 detail 0 低面数气质。
      const canopyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeCanopy), ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const sphereIdx = positions.map((_, i) => i).filter((i) => i % 2 === 0)
      const coneIdx = positions.map((_, i) => i).filter((i) => i % 2 === 1)
      const up = new THREE.Matrix4()
      const qY = new THREE.Quaternion()
      const yaxis = new THREE.Vector3(0, 1, 0)
      if (sphereIdx.length > 0) {
        const sphereGeo = this.profile.flatShading ? new THREE.IcosahedronGeometry(12, 0) : new THREE.IcosahedronGeometry(12, 1)
        const sphereInst = new THREE.InstancedMesh(sphereGeo, canopyMat, sphereIdx.length)
        sphereIdx.forEach((pi, k) => {
          const pos = new THREE.Vector3().setFromMatrixPosition(positions[pi])
          const rnd = mulberry32(hashStr('canopy-s:' + pi))
          const sc = 0.85 + rnd() * 0.4
          qY.setFromAxisAngle(yaxis, rnd() * Math.PI * 2)
          up.compose(new THREE.Vector3(pos.x, trunkH + 10, pos.z), qY, new THREE.Vector3(sc, sc * (0.9 + rnd() * 0.25), sc))
          sphereInst.setMatrixAt(k, up)
        })
        sphereInst.castShadow = this.profile.shadows
        this.sceneGroup.add(sphereInst)
      }
      if (coneIdx.length > 0) {
        const coneInst = new THREE.InstancedMesh(new THREE.ConeGeometry(9, 24, 8), canopyMat, coneIdx.length)
        coneIdx.forEach((pi, k) => {
          const pos = new THREE.Vector3().setFromMatrixPosition(positions[pi])
          const rnd = mulberry32(hashStr('canopy-c:' + pi))
          const sc = 0.85 + rnd() * 0.4
          up.compose(new THREE.Vector3(pos.x, trunkH + 12, pos.z), new THREE.Quaternion(), new THREE.Vector3(sc, sc, sc))
          coneInst.setMatrixAt(k, up)
        })
        coneInst.castShadow = this.profile.shadows
        this.sceneGroup.add(coneInst)
      }
    }

    // v2.1 灌木球丛：沿 4 块草地边缘点缀（每块 6 丛，种子确定性偏移），增加绿化层次
    {
      const bushMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.treeCanopy), ...(this.profile.flatShading ? { flatShading: true } : {}) })
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
        : new THREE.MeshLambertMaterial({ color: waterColor, transparent: true, opacity: 0.85, ...(this.profile.flatShading ? { flatShading: true } : {}) })
      const water = new THREE.Mesh(new THREE.CircleGeometry(50, 48), waterMat)
      water.rotation.x = -Math.PI / 2
      water.position.set(bx * 0.3, 0.25, bz * 0.42)
      this.sceneGroup.add(water)
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(50, 56, 48),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) }),
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
    if (s.gate !== false) {
      const gmat = new THREE.MeshLambertMaterial({ color: new THREE.Color(e.sidewalk) })
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
        // v2.18 预览：路灯真照明——给路灯 head 挂 PointLight（≤8 守性能纪律），照亮地面受光物体
        // （草地/车库入口/楼底）+ 路灯打光效果。仅当该风格 lights.point 配置了色（夜景）才挂，
        // cyber/realistic 的 point=null 自动跳过。
        const L = this.tokens.lights as Record<string, unknown>
        const pColor = (L.point as string) ?? null
        const pInt = (L.pointIntensity as number) ?? 0
        const pDist = (L.pointDistance as number) ?? 200
        if (pColor && pInt > 0) {
          const n = Math.min(8, lampPos.length)
          for (let i = 0; i < n; i++) {
            const p = lampPos[i]
            const pl = new THREE.PointLight(new THREE.Color(pColor), pInt, pDist, 1)
            pl.position.set(p.x, 42, p.z)
            this.sceneGroup.add(pl)
          }
        }
      }
    }
    if (a.groundGlow !== false && this.style === 'cyber') {
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

  /** v2.7：按楼栋类别解析配色 token——自定义类别（factory/warehouse/residential…）取 tokens.category.<cat>，缺省回退 category.building。
   *  v2.18：主题静态 category 缺该键时，回退读 spec.tokens.category.<cat>（per-park 覆盖）——此前 applyTheme 只读静态主题、
   *  spec.tokens.category 进不到 3D（仅进 CSS 变量），与 park-spec.md / intake.md 文档不符。 */
  private categoryToken(category: string): string {
    const cat = this.tokens.category as Record<string, string>
    if (category && cat[category]) return cat[category]
    const specCat = (this.scaffold.tokens as Record<string, unknown> | undefined)?.category as Record<string, string> | undefined
    if (category && specCat && specCat[category]) return specCat[category]
    return cat.building
  }

  private buildFootprintPad(b: ScaffoldBuilding) {
    const color = new THREE.Color(this.categoryToken(b.category))
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
    const r = this.tokens.realism as { material?: { roughness?: number; metalness?: number; envMapIntensity?: number; clearcoat?: number; clearcoatRoughness?: number } } | undefined
    const rm = r?.material
    if (b === 'flat') return new THREE.MeshLambertMaterial({ color, flatShading: true })
    if (b === 'pbr') {
      // v2.19：楼体升级 MeshPhysicalMaterial——玻璃幕墙加 clearcoat，配合 HDRI 天水反射更真实
      // （旧 MeshStandardMaterial 读作哑光塑料/漆面，缺幕墙质感）。默认值偏玻璃：低金属度、低粗糙度、
      // 高 envMapIntensity；clearcoat 给一层透明漆面反射。屋顶/裙楼另走哑光混凝土，拉开质感对比。
      const m = new THREE.MeshPhysicalMaterial({
        color,
        metalness: rm?.metalness ?? 0.05,
        roughness: rm?.roughness ?? 0.18,
        envMapIntensity: rm?.envMapIntensity ?? 1.3,
        clearcoat: rm?.clearcoat ?? 0.7,
        clearcoatRoughness: rm?.clearcoatRoughness ?? 0.25,
      })
      if (this.sceneObj.environment) m.envMap = this.sceneObj.environment
      return m
    }
    if (b === 'pbr-night') {
      const m = new THREE.MeshStandardMaterial({ color, metalness: rm?.metalness ?? 0.8, roughness: rm?.roughness ?? 0.2, envMapIntensity: rm?.envMapIntensity ?? 0.35, emissive: color, emissiveIntensity: 0.08 })
      if (this.sceneObj.environment) m.envMap = this.sceneObj.environment
      return m
    }
    // emissive（cyber 默认）
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isBody ? 0.12 : 0.05, metalness: 0.2, roughness: 0.6 })
  }

  hydrateBuildings(items: BuildingRuntimeItem[]) {
    this.hydratedBuildings = items
    this.extrudeBuildings(items)
    // v2.1：真实楼层数就绪后重新取景（构造期用默认估算会偏松），园区更贴合 2/3 画面
    this.frameCamera()
  }

  /**
   * v2.19 等距（flat）风格伪接触阴影：每栋楼底铺一圈 CircleGeometry 半透黑贴片，
   * 消除「飘」感（等距风格按 styles.md 纪律不开真实阴影）。实现见 extrudeBuildings。
   * 非 flat 风格不消费（写实有真阴影、深色风格黑底看不见）。
   */

  private extrudeBuildings(items: BuildingRuntimeItem[]) {
    const fh = this.scaffold.floorHeight
    const roomShade = (this.tokens.building.roomShade as number) ?? 0.16
    const dividerColor = new THREE.Color(this.tokens.building.dividerColor as string)
    // 楼栋 id→脚手架映射：每楼层项按 id O(1) 查类别，免 O(N²) 线性 find。
    const scaffoldById = new Map(this.scaffold.buildings.map((s) => [s.id, s] as const))
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
      const scBld = scaffoldById.get(item.building_id)
      const color = new THREE.Color(this.categoryToken(scBld?.category ?? 'building'))
      const b = this.profile.building

      // 风格相关：材质、facade 纹理、标签配色（在本类里构造，受 token/style 驱动）。
      const facade = this.makeFacadeTexture(item.building_id, item.floors, w, d, color, roomShade, dividerColor)
      const sideMat = this.buildingMaterial(color, true)
      if (facade) {
        if (sideMat instanceof THREE.MeshStandardMaterial || sideMat instanceof THREE.MeshLambertMaterial || sideMat instanceof THREE.MeshBasicMaterial) {
          ;(sideMat as THREE.MeshStandardMaterial).map = facade
        }
      }
      // v2.15 夜间发光窗：pbr-night 叠 emissiveMap（分层点亮 + 暖冷双辉光）+ bloom 产生夜景窗光。
      // v2.17 扩到 cyber（emissive）：emissive:white 让 emissiveMap 直接驱动色（窗光取代旧的整栋均匀自发光），
      // 暖/冷由贴图决定；动画子集入 facadeAnims。
      if ((b === 'pbr-night' || b === 'emissive') && sideMat instanceof THREE.MeshStandardMaterial) {
        const wtk = this.windowsTokens()
        const built = this.buildWindowEmissive(item.building_id, item.floors, w)
        if (built) {
          sideMat.emissive = new THREE.Color('#ffffff')
          sideMat.emissiveMap = built.tex
          sideMat.emissiveIntensity = wtk.emissiveIntensity
          if (!this.reducedMotion && wtk.animRatio > 0) this.facadeAnims.push(built.anim)
        }
      }
      const topMat = (b === 'pbr' || b === 'pbr-night')
        // v2.5 写实屋顶：哑光混凝土（高 roughness、无金属、无自发光），不再恒发 0.05 自发光。
        ? new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.8), roughness: 0.9, metalness: 0.0 })
        : new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.05, metalness: 0.2, roughness: 0.6 })
      const podiumMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), roughness: 0.85, metalness: 0.05 })
      const capMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.7), roughness: 0.7, metalness: 0.2 })
      // v2.19 等距风格接地阴影：楼底铺一圈圆形半透黑贴片（CircleGeometry），消除「飘」感。
      // 用实色半透（而非 alpha 贴图）——后者在本场景的 CanvasTexture 透明度路径上不稳定。
      // renderOrder=1 让它在地面之后绘制（depthTest 仍生效，楼栋基座更近会正确遮挡）。
      if (b === 'flat') {
        const csMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, opacity: 0.32 })
        const shadow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(w, d) * 0.85, 32), csMat)
        shadow.rotation.x = -Math.PI / 2
        shadow.position.y = 0.5
        shadow.renderOrder = 1
        group.add(shadow)
      }
      // 楼顶标签配色（v2.1 改走 token ui.labelBg/labelText——4 风格各自的高对比配对；
      // 旧式 (void-bg, cyan-bright) 在浅色风格下两字色都偏亮、标签糊成黑块，违反 §4.2 规则）
      const uiTk = this.tokens.ui
      const labelTex = this.makeContrastLabel(
        item.name,
        uiTk?.labelBg ?? (this.tokens.palette['void-bg'] as string),
        uiTk?.labelText ?? ((this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff'),
        this.categoryToken(scBld?.category ?? 'building'),
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
        // v2.17：立体轮廓色单独走 building.edgeColor（缺省回退 dividerColor）。夜景下 dividerColor 极暗、
        // 楼幢 silhouette 融入天空，故夜景 token 配淡色 edgeColor 让轮廓可辨；逐层虚线仍用 dividerColor。
        edgeColor: (this.tokens.building.edgeColor as string | undefined)
          ? new THREE.Color(this.tokens.building.edgeColor as string)
          : dividerColor,
        edgeOpacity: 0.85,
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
        if (b === 'flat') {
          roomMat = new THREE.MeshLambertMaterial({ color: rc, flatShading: true })
          antennaMat = new THREE.MeshLambertMaterial({ color: rc, flatShading: true })
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
          // v2.5：night-realistic 接通红色航空警示灯（此前恒 null，代码路径不可达）。
          beaconColor: this.style === 'night-realistic' ? new THREE.Color('#ff3a3a') : null,
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


  /**
   * 读取 tokens.windows（缺省合并 DEFAULT_WINDOWS）。仅 pbr-night 消费；其余风格不读。
   * 为什么兜底：schema 把 windows 标为可选，用户自定义 night-realistic token 缺该块时仍可工作。
   */
  private windowsTokens(): WindowsTokens {
    const raw = (this.tokens as ThemeTokens & { windows?: Partial<WindowsTokens> }).windows
    if (!raw) return DEFAULT_WINDOWS
    return {
      roomsAxisTower: raw.roomsAxisTower ?? DEFAULT_WINDOWS.roomsAxisTower,
      roomsAxisPodium: raw.roomsAxisPodium ?? DEFAULT_WINDOWS.roomsAxisPodium,
      litRatio: {
        ground: raw.litRatio?.ground ?? DEFAULT_WINDOWS.litRatio.ground,
        middle: raw.litRatio?.middle ?? DEFAULT_WINDOWS.litRatio.middle,
        top: raw.litRatio?.top ?? DEFAULT_WINDOWS.litRatio.top,
      },
      warmColor: raw.warmColor ?? DEFAULT_WINDOWS.warmColor,
      coolColor: raw.coolColor ?? DEFAULT_WINDOWS.coolColor,
      warmRatio: raw.warmRatio ?? DEFAULT_WINDOWS.warmRatio,
      glassOff: raw.glassOff ?? DEFAULT_WINDOWS.glassOff,
      gradient: {
        top: raw.gradient?.top ?? DEFAULT_WINDOWS.gradient.top,
        bottom: raw.gradient?.bottom ?? DEFAULT_WINDOWS.gradient.bottom,
      },
      animRatio: raw.animRatio ?? DEFAULT_WINDOWS.animRatio,
      fadeMs: raw.fadeMs ?? DEFAULT_WINDOWS.fadeMs,
      flipMinMs: raw.flipMinMs ?? DEFAULT_WINDOWS.flipMinMs,
      flipVarMs: raw.flipVarMs ?? DEFAULT_WINDOWS.flipVarMs,
      emissiveIntensity: raw.emissiveIntensity ?? DEFAULT_WINDOWS.emissiveIntensity,
      seedSalt: raw.seedSalt,
    }
  }

  /**
   * v2.14 及之前：风格化贴砖分支（cyber/iso）+ pbr 日景用的窗格度量。
   * 保留勿删——风格化分支仍依赖此 cols/cellW。
   */
  private windowMetrics(w: number, floors: number): {
    padW: number; padH: number; cols: number; rows: number; cellW: number; cellH: number
  } {
    const fh = this.scaffold.floorHeight
    const padW = Math.max(128, Math.round(w * 2))
    const padH = Math.max(128, Math.round(floors * fh * 0.5))
    const cols = Math.max(2, Math.min(12, Math.round(w / 14)))
    const rows = Math.max(1, floors)
    return { padW, padH, cols, rows, cellW: padW / cols, cellH: padH / rows }
  }

  /**
   * v2.15 夜间塔体窗度量（Park 流水线）：画布随立面尺寸缩放，rows=楼层数，
   * rooms=塔体窗列数，winW=cellW*0.5 统一窗宽，insetY=rowH*0.22 留出窗框/楼板暗带。
   * albedo facade 与 emissiveMap 共用此度量——同网格杜绝错位（v2.5 bug 教训）。
   */
  private windowMetricsTower(w: number, floors: number): {
    padW: number; padH: number; rooms: number; rows: number; cellW: number; rowH: number; winW: number; insetY: number
  } {
    const fh = this.scaffold.floorHeight
    const faceH = Math.max(floors * fh, 10)
    const padW = Math.min(720, Math.max(256, Math.round(w * 3)))
    const padH = Math.max(64, Math.round(padW * (faceH / w)))
    const rooms = Math.max(2, this.windowsTokens().roomsAxisTower)
    const rows = Math.max(1, floors)
    const cellW = padW / rooms
    const rowH = padH / rows
    return { padW, padH, rooms, rows, cellW, rowH, winW: cellW * 0.5, insetY: rowH * 0.22 }
  }

  /**
   * v2.15 计算一栋楼的窗户布局（确定性——albedo 与 emissive 各自调用结果完全一致）。
   * 每层用 floorRoomDividerFracs 砖错位切片面板，Fisher-Yates 洗牌取 2..5 窗，面板过窄过滤；
   * 分层点亮率（底层 0 / 中层 / 顶层）+ 暖冷双辉光（warmRatio）+ 动画子集（独立 flip 种子流）。
   * 注意 BoxGeometry flipY：canvas 行 0=顶层、行 rows-1=底层——与 litRatio.top/ground 对应。
   */
  private computeWindowLayout(buildingId: string, floors: number, w: number): {
    m: { padW: number; padH: number; rooms: number; rows: number; cellW: number; rowH: number; winW: number; insetY: number }
    cells: WindowCell[]
  } {
    const tk = this.windowsTokens()
    const m = this.windowMetricsTower(w, floors)
    const salt = tk.seedSalt ? tk.seedSalt + ':' : ''
    const rngLit = mulberry32(hashStr('lit:' + salt + buildingId))
    const rngFlip = mulberry32(hashStr('flip:' + salt + buildingId))
    const cells: WindowCell[] = []
    const rows = m.rows
    for (let r = 0; r < rows; r++) {
      // 行 r：r===0 顶层、r===rows-1 底层（BoxGeometry flipY）
      const litR = r === rows - 1 ? tk.litRatio.ground : (r === 0 ? tk.litRatio.top : tk.litRatio.middle)
      const yTop = r * m.rowH
      const winH = m.rowH - 2 * m.insetY
      const y = yTop + m.insetY
      // 面板切片（砖错位）→ 像素段
      const fracs = floorRoomDividerFracs(r, m.rooms)
      const panels: { x0: number; x1: number }[] = []
      for (let i = 0; i < m.rooms; i++) {
        const f0 = fracs[i]
        const f1 = Math.min(1, f0 + 1 / m.rooms)
        if (f0 >= 1) continue              // 相位偏移推出右边界的面板丢弃
        const x0 = f0 * m.padW
        const x1 = f1 * m.padW
        if (x1 - x0 < m.winW * 1.1) continue   // 面板太窄容不下一扇窗
        panels.push({ x0, x1 })
      }
      // Fisher-Yates 洗牌（确定性），取 want 窗
      for (let i = panels.length - 1; i > 0; i--) {
        const j = Math.floor(rngLit() * (i + 1))
        ;[panels[i], panels[j]] = [panels[j], panels[i]]
      }
      const want = 2 + Math.floor(rngLit() * 4)   // 2..5
      const take = Math.min(want, panels.length)
      for (let i = 0; i < take; i++) {
        const p = panels[i]
        const mid = (p.x0 + p.x1) / 2
        const span = Math.max(0, p.x1 - p.x0 - m.winW)
        const cx = Math.max(p.x0 + 1, Math.min(p.x1 - m.winW - 1, mid + (rngLit() - 0.5) * span * 0.7))
        const x = cx
        const lit = rngLit() < litR
        const color: 'warm' | 'cool' = rngLit() < tk.warmRatio ? 'warm' : 'cool'
        // 动画子集：与 lit 无关——亮可灭、灭可亮（Park 同款）
        const animatable = r !== rows - 1 && rngFlip() < tk.animRatio   // 底层不参与动画（本就不亮）
        cells.push({ x, y, w: m.winW, h: winH, color, lit, animatable })
      }
    }
    return { m, cells }
  }

  /**
   * 程序化幕墙 CanvasTexture（风格分支）。
   * pbr-night/emissive（v2.15+v2.17）：纵向渐变墙 + 逐层面板窗户（亮窗画暖/冷同色让 bloom 发光，未亮画 glassOff）+ 窗框/楼板线。
   *   v2.17 起全部 2 个深色风格（night-realistic/cyber）走此分支——夜间楼幢主辉光来自窗。
   * pbr 日景：真实窗户网格——玻璃 + 窗框 + 楼板暗带（受 envMap/AO/阴影影响，远观像真楼）。
   * flat（等距插画）：沿用 v1.7 贴砖拼花（相邻两色强对比交替 + 深色竖实线），气质不变。
   * 发光窗由 buildWindowEmissive 单独产 emissiveMap（与 albedo 同布局），v2.17 起同样覆盖 2 个深色风格。
   */
  private makeFacadeTexture(buildingId: string, floors: number, w: number, d: number, color: THREE.Color, roomShade: number, dividerColor: THREE.Color): THREE.CanvasTexture | null {
    const b = this.profile.building
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const baseHsl = { h: 0, s: 0, l: 0 }
    color.getHSL(baseHsl)

    if (b === 'pbr-night' || b === 'emissive') {
      // v2.15 Park 流水线 albedo：渐变墙 + 分层面板窗户。v2.17 起扩到全部深色风格（pbr-night/emissive，
      // 即 night-realistic/cyber）——窗光成为夜间楼幢主辉光；各风格 token 的
      // windows.gradient 决定墙面色、windows.glassOff 决定熄窗色，使每风格在自己配色上画窗。
      const tk = this.windowsTokens()
      const { m, cells } = this.computeWindowLayout(buildingId, floors, w)
      canvas.width = m.padW; canvas.height = m.padH
      const grad = ctx.createLinearGradient(0, 0, 0, m.padH)
      grad.addColorStop(0, tk.gradient.top)
      grad.addColorStop(1, tk.gradient.bottom)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, m.padW, m.padH)
      // 窗户：亮窗画暗同色（bloom 负责发光），未亮画 glassOff
      for (const c of cells) {
        ctx.fillStyle = c.lit ? (c.color === 'warm' ? tk.warmColor : tk.coolColor) : tk.glassOff
        ctx.globalAlpha = c.lit ? 0.55 : 1
        ctx.fillRect(c.x, c.y, c.w, c.h)
      }
      ctx.globalAlpha = 1
      // 楼板暗带（每层底）+ 竖向窗框（rooms 列）
      const frame = new THREE.Color().setHSL(baseHsl.h, baseHsl.s * 0.5, Math.max(0.05, baseHsl.l * 0.3))
      const frameHex = `#${frame.getHexString()}`
      const frameH = Math.max(1, Math.round(m.insetY * 0.6))
      ctx.fillStyle = frameHex
      for (let r = 0; r <= m.rows; r++) {
        const y = Math.min(m.padH - frameH, Math.round(r * m.rowH))
        ctx.fillRect(0, y, m.padW, frameH)
      }
      const frameW = Math.max(1, Math.round(m.cellW * 0.08))
      for (let i = 0; i <= m.rooms; i++) {
        const x = Math.min(m.padW - frameW, Math.round(i * m.cellW))
        ctx.fillRect(x, 0, frameW, m.padH)
      }
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      return tex
    }

    if (b === 'pbr') {
      // v2.5 写实日景窗户网格：墙面底 → 玻璃单元 → 窗框/楼板线（原样保留）。
      const m = this.windowMetrics(w, floors)
      const padW = m.padW
      const padH = m.padH
      canvas.width = padW; canvas.height = padH
      const wall = new THREE.Color().setHSL(baseHsl.h, baseHsl.s * 0.8, Math.max(0.1, baseHsl.l * 0.85))
      const frame = new THREE.Color().setHSL(baseHsl.h, baseHsl.s * 0.5, Math.max(0.05, baseHsl.l * 0.4))
      const glass = new THREE.Color().setHSL(baseHsl.h, 0.28, Math.min(0.85, baseHsl.l * 1.2))
      ctx.fillStyle = `#${wall.getHexString()}`
      ctx.fillRect(0, 0, padW, padH)
      const cols = m.cols
      const rows = m.rows
      const cellW = m.cellW
      const cellH = m.cellH
      const inX = Math.max(1, cellW * 0.1)
      const inY = Math.max(1, cellH * 0.12)
      ctx.fillStyle = `#${glass.getHexString()}`
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(c * cellW + inX, r * cellH + inY, cellW - 2 * inX, cellH - 2 * inY)
        }
      }
      const frameW = Math.max(1, Math.round(cellW * 0.1))
      const frameH = Math.max(1, Math.round(cellH * 0.12))
      ctx.fillStyle = `#${frame.getHexString()}`
      for (let c = 0; c <= cols; c++) {
        const x = Math.min(padW - frameW, Math.round(c * cellW))
        ctx.fillRect(x, 0, frameW, padH)
      }
      for (let r = 0; r <= rows; r++) {
        const y = Math.min(padH - frameH, Math.round(r * cellH))
        ctx.fillRect(0, y, padW, frameH)
      }
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      return tex
    }

    // 风格化贴砖拼花（v1.7）——v2.17 起仅 flat（等距插画）走此分支；深色风格已改走上面的窗户分支。
    const m = this.windowMetrics(w, floors)
    const padW = m.padW
    const padH = m.padH
    canvas.width = padW; canvas.height = padH
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
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  /**
   * v2.15 夜间发光窗 emissiveMap + 动画状态（仅 pbr-night）：与 makeFacadeTexture 同布局。
   * 亮窗画满色（emissive:white 驱动 + bloom 发光），未亮黑（不发光）；动画子集收入 FacadeAnim 供
   * animate 逐帧 dirty-gated 局部重绘。返回 null 时调用方跳过 emissive 接线。
   */
  private buildWindowEmissive(buildingId: string, floors: number, w: number): { tex: THREE.CanvasTexture; anim: FacadeAnim } | null {
    const tk = this.windowsTokens()
    const { m, cells } = this.computeWindowLayout(buildingId, floors, w)
    const canvas = document.createElement('canvas')
    canvas.width = m.padW; canvas.height = m.padH
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, m.padW, m.padH)
    // 初始静态点亮：仅画 lit 窗（动画窗的初始态也由 lit 决定，cur/from/to 同步）
    const rngFlip = mulberry32(hashStr('fliprng:' + (tk.seedSalt ? tk.seedSalt + ':' : '') + buildingId))
    const animWindows: FacadeWindow[] = []
    const now = performance.now()
    for (const c of cells) {
      if (c.lit) {
        ctx.fillStyle = c.color === 'warm' ? tk.warmColor : tk.coolColor
        ctx.fillRect(c.x, c.y, c.w, c.h)
      }
      if (c.animatable) {
        // 首次翻转错峰：now + flipMin + [0,flipVar)——绝对时钟，暂停/恢复不跳相
        animWindows.push({
          x: c.x, y: c.y, w: c.w, h: c.h,
          color: c.color,
          cur: c.lit ? 1 : 0, from: c.lit ? 1 : 0, to: c.lit ? 1 : 0,
          fadeStart: 0,
          nextFlip: now + tk.flipMinMs + rngFlip() * tk.flipVarMs,
        })
      }
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const anim: FacadeAnim = { ctx, tex, rngFlip, windows: animWindows, warmColor: tk.warmColor, coolColor: tk.coolColor, fadeMs: tk.fadeMs, flipMinMs: tk.flipMinMs, flipVarMs: tk.flipVarMs }
    return { tex, anim }
  }

  // ---------- 车库入口（半金字塔三角门 + P 牌） ----------

  private buildGarageEntrance(b: ScaffoldBuilding) {
    const color = new THREE.Color(this.tokens.category.garage)
    const group = new THREE.Group()
    group.position.set(b.x, 0, b.z)
    const facing = b.facing ?? 'S'
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide })
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
    const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.8 }))
    g.add(wire)
    return g
  }

  // ---------- v2.6 地下场景（地下车库多层剖面，§14）----------

  /**
   * 装配所有地下车库负层（scaffold.garages[]）。地面不开洞——坑体是 Y<0 的透明玻璃柱：
   * 楼栋不悬空，从侧面透过半透明墙可见内部。多层按 level 升序堆叠，每层 ceilY = 上一层 deckY，
   * 故 4 面玻璃壁拼成连续竖井。挂在 sceneGroup（随 clearSceneGroup 释放）。
   */
  private buildUnderground() {
    const garages = this.scaffold.garages
    if (!garages || garages.length === 0) return
    // token.underground 缺省回退（自定义主题可能缺该块）——保证不崩；颜色只走 token，禁手写 hex。
    const ug = ((this.tokens as unknown as Record<string, unknown>).underground ?? {}) as Record<string, unknown>
    const str = (k: string, fb: string) => (typeof ug[k] === 'string' ? (ug[k] as string) : fb)
    const num = (k: string, fb: number) => (typeof ug[k] === 'number' ? (ug[k] as number) : fb)
    const edgeColor = new THREE.Color(str('edge', '#3df0c8'))
    const materials = this.undergroundMaterials(ug, str, num)
    const carColors = (ug['carColors'] as THREE.ColorRepresentation[] | undefined) ?? [
      '#eaf6ff', '#d6ecff', '#ffd989', '#f2f5fa', '#aad4f5', '#ffe27a', '#cfe6ff',
    ]
    const labelBg = str('deck', '#06030f')
    const labelFg = `#${edgeColor.getHexString()}`
    // 同名标牌（入口/出口/房间名在 B1·B2 间复用）按 name 记忆，避免重复生成 canvas 纹理。
    const labelCache = new Map<string, THREE.Texture>()
    const labelTextureOf = (name: string) => {
      let t = labelCache.get(name)
      if (!t) { t = this.makeContrastLabel(name, labelBg, labelFg, edgeColor, 500); labelCache.set(name, t) }
      return t
    }
    // 按 level 升序（-1 B1 先于 -2 B2）：逐层 ceilY = 上一层 deckY（B1 的 ceilY=0）→ 壁拼连续竖井
    const sorted = [...garages].sort((a, b) => b.level - a.level)
    let prevDeckY = 0
    for (const g of sorted) {
      const grp = new THREE.Group()
      grp.position.set(g.x, 0, g.z)
      const deckY = -Math.abs(g.deck_y)
      buildUndergroundGarage({
        group: grp,
        id: g.id,
        name: g.name,
        w: g.w, d: g.d,
        deckY, ceilY: prevDeckY,
        cols: g.cols, rows: g.rows,
        rooms: this.resolveGarageRooms(g),
        materials,
        labelTexture: labelTextureOf(g.name),
        labelTextureOf,
        makeCar: (c) => this.makeGarageCar(c),
        carColors,
        castShadow: this.profile.shadows,
        pickSink: this.garagePickables,
      })
      this.sceneGroup.add(grp)
      prevDeckY = deckY
    }
  }

  /** 构造地下材质束（按 profile.building 分支：flat / pbr / emissive；与楼上同纪律）。 */
  private undergroundMaterials(
    ug: Record<string, unknown>,
    str: (k: string, fb: string) => string,
    num: (k: string, fb: number) => number,
  ): UndergroundMaterials {
    const b = this.profile.building
    const deckHex = str('deck', '#0a1320')
    const deckEmHex = str('deckEmissive', '#0a1830')
    const deckOp = num('deckOpacity', 0.32)
    const wallHex = str('wall', '#1de9ff')
    const wallOp = num('wallOpacity', 0.12)
    const rampHex = str('ramp', '#10283a')
    const matOf = (hex: string, emHex: string, op: number): THREE.Material => {
      const col = new THREE.Color(hex)
      const em = new THREE.Color(emHex)
      if (b === 'flat') return new THREE.MeshLambertMaterial({ color: col, flatShading: true, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })
      if (b === 'pbr') return new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0.05, emissive: em, emissiveIntensity: 0.15, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })
      // emissive / pbr-night：靠自发光在地下无独立光照时可见
      const emInt = b === 'pbr-night' ? 0.8 : 0.55
      return new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.2, emissive: em, emissiveIntensity: emInt, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })
    }
    return {
      deck: matOf(deckHex, deckEmHex, deckOp),
      wall: matOf(wallHex, wallHex, wallOp),
      ramp: matOf(rampHex, deckEmHex, Math.max(deckOp, 0.55)),
      roomEdgeColor: new THREE.Color(str('room', '#ffc24a')),
      spotColor: new THREE.Color(str('spot', '#eaf6ff')),
      edgeColor: new THREE.Color(str('edge', '#3df0c8')),
    }
  }

  /** 功能房间：spec 给定则用；非 parking 且无 rooms 返回空（不回退车库配电/消防…默认间，避免误导）；parking 缺省 8 间沿边界内侧分布。 */
  private resolveGarageRooms(g: ScaffoldGarage): GarageRoomSpec[] {
    if (g.rooms && g.rooms.length) {
      return g.rooms.map((r) => ({ name: r.name, x: r.x, z: r.z, w: r.w, d: r.d }))
    }
    // 非车库地下结构（商场/地铁/人防/车间…）无 rooms 时只显外壳 + 标牌，不塞车库专属房间。
    if (g.usage && g.usage !== 'parking') return []
    const fwx = g.w / 2
    const fdz = g.d / 2
    return [
      { name: '配电室', x: -fwx + 50, z: -fdz + 40, w: 70, d: 44 },
      { name: '消防控制室', x: 0, z: -fdz + 40, w: 90, d: 44 },
      { name: '通风机房', x: fwx - 50, z: -fdz + 40, w: 70, d: 44 },
      { name: '水泵房', x: -fwx + 50, z: fdz - 40, w: 70, d: 44 },
      { name: '值班室', x: 0, z: fdz - 40, w: 90, d: 44 },
      { name: '储物间', x: fwx - 50, z: fdz - 40, w: 70, d: 44 },
      { name: '设备间', x: -fwx + 40, z: 0, w: 44, d: 80 },
      { name: '弱电间', x: fwx - 40, z: 0, w: 44, d: 80 },
    ]
  }

  /** 地下车辆：暗风格（cyber/night）车身自发光才地下可见；写实/flat 走受光材质。 */
  private makeGarageCar(color: THREE.ColorRepresentation): THREE.Group {
    const col = new THREE.Color(color)
    const b = this.profile.building
    const g = new THREE.Group()
    const bodyMat: THREE.Material = b === 'flat'
      ? new THREE.MeshLambertMaterial({ color: col })
      : (b === 'pbr'
          ? new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, emissive: col, emissiveIntensity: 0.1 })
          : new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.2, emissive: col, emissiveIntensity: 0.7 }))
    const body = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 16), bodyMat)
    body.position.y = 3.6
    if (this.profile.shadows) body.castShadow = true
    g.add(body)
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x2a4060, roughness: 0.15, metalness: 0.6 }))
    cabin.position.set(0, 7, -0.5)
    g.add(cabin)
    const wheelGeo = new THREE.CylinderGeometry(2, 2, 3, 12)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
    for (const dx of [-4.2, 4.2]) {
      for (const dz of [-5, 5]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(dx, 2, dz)
        g.add(wheel)
      }
    }
    return g
  }

  /** 最浅层车库（level 最大，-1）——belowView 相机瞄它的坑体中心。 */
  private shallowestGarage(): ScaffoldGarage | null {
    const gs = this.scaffold.garages
    if (!gs || !gs.length) return null
    return gs.reduce((m, g) => (g.level > m.level ? g : m), gs[0])
  }

  /**
   * 地下视角开关（v2.6，§14）。on=相机补间到坑体中深度的南侧水平直视（看负层侧立面/剖面：
   * 地表、坡道下沉、透明墙、车位与房间）；off=补间回到原视角。对齐 web 驾驶舱 setBelowView。
   * 设的是 position/target/zoom（非 polar），正交/透视相机都适用。v2.10 起 MAX_POLAR 已放开到
   * π-0.1，正常交互即可拖到地面之下仰视坑体（不透明地面因 BackSide culling 从下方不可见）；
   * belowView 的角色回归为「补间到坑中平视取景位」，此处 maxPolarAngle 沿用 MAX_POLAR、不再独占放宽。
   * 复用 §8/§13「事件触发+有限时长+结束释放 OrbitControls」纪律。
   */
  setBelowView(on: boolean) {
    if (on === this.belowView) return
    this.belowView = on
    // 互斥：进地下即取消楼上聚焦/巡航（都写 target/zoom/position，避免打架）
    if (on) {
      if (this.tween?.active) this.tween.active = false
      if (this.frameTween?.active) this.frameTween.active = false
      this.controls.autoRotate = false
    }
    this.controls.enabled = false   // 补间期间手动定位相机
    this.controls.maxPolarAngle = ParkScene.MAX_POLAR   // belowView 不改极角（v2.10 起 default 已放开到 π-0.1，此处仅保持一致）
    if (on) {
      this.belowAnchor.copy(this.camera.position)
      this.belowTargetAnchor.copy(this.controls.target)
      this.belowZoomAnchor = this.camera.zoom
      const g = this.shallowestGarage()
      const cx = g ? g.x : 0
      const cz = g ? g.z : 0
      const depth = g ? Math.abs(g.deck_y) : 140
      const pitW = g ? Math.abs(g.w) : 600
      const cy = -depth / 2                         // 坑体中深度
      this.sideTarget.set(cx, cy, cz)
      if (this.camera instanceof THREE.PerspectiveCamera) {
        // 透视：按坑宽反推距离自然取景
        this.belowZoom = 1
        const fovRad = (ParkScene.REALISTIC_FOV * Math.PI) / 180
        const dist = (Math.max(pitW, depth * 2) * 0.62) / Math.tan(fovRad / 2)
        this.sideCamPos.set(cx, cy, cz + dist)
      } else {
        // 正交：距离不影响大小，按现有视锥宽度算 zoom 让坑体横向占满
        const cam = this.camera as THREE.OrthographicCamera
        const frustW = Math.max(1, cam.right - cam.left)
        this.belowZoom = Math.max(0.3, Math.min(2.6, frustW / (pitW * 1.15)))
        this.sideCamPos.set(cx, cy, cz + Math.max(420, pitW * 0.9))
      }
    }
  }

  /** 地下车库拾取（仅 belowView 时测 garagePickables）——返回 garageId 或 null。射线已由 updatePointer 设置。 */
  private pickGarage(): string | null {
    if (!this.belowView || !this.garagePickables.length) return null
    const hits = this.raycaster.intersectObjects(this.garagePickables, false)
    return hits.length ? (hits[0].object.userData.garageId as string) : null
  }

  // ---------- 自定义扩展：2F 悬空走廊 ----------

  private buildCorridor() {
    const c = this.scaffold.corridor
    if (!c) return // corridor 是可选扩展——未配置的园区直接跳过（v2.1 修复空指针）
    const fh = this.scaffold.floorHeight
    const floorEnd = (c as { floorEnd?: number }).floorEnd
    const multi = floorEnd != null && floorEnd > c.floor            // 跨层连廊（floorEnd > floor）：桥体跨 floor..floorEnd
    const yH = multi ? (floorEnd! - c.floor + 1) * fh : c.thickness // 单层沿用 thickness（向后兼容）
    const y = multi ? ((c.floor + floorEnd! + 1) * fh) / 2 : c.floor * fh + fh / 2
    const from = new THREE.Vector3(c.from.x, y, c.from.z)
    const to = new THREE.Vector3(c.to.x, y, c.to.z)
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    const color = new THREE.Color((this.tokens.palette.mint as string) ?? '#3df0c8')
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.9 })
    const geo = new THREE.BoxGeometry(c.width, yH, len)
    const bridge = new THREE.Mesh(geo, mat)
    bridge.position.copy(mid)
    bridge.lookAt(to.x, mid.y, to.z)
    bridge.rotateX(Math.PI / 2)
    if (this.profile.shadows) bridge.castShadow = true
    this.sceneGroup.add(bridge)
    const edgeColor = new THREE.Color((this.tokens.building.edgeColor as string | undefined) ?? (this.tokens.building.dividerColor as string))
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: edgeColor }))
    edges.position.copy(bridge.position)
    edges.quaternion.copy(bridge.quaternion)
    this.sceneGroup.add(edges)
    const tex = this.makeContrastLabel(c.label, this.tokens.palette['void-bg'] as string, (this.tokens.palette['cyan-bright'] as string) ?? '#7ff5ff', color)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
    sprite.position.set(mid.x, y + yH / 2 + 14, mid.z)
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
        group.add(halo)
        this.alarmPois.push(halo)   // animate 逐帧呼吸缩放（免整树 traverse）
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

  private poiSymbol(type: PoiTypeEnum | string): string {
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
    // v2.6：地下视角由 setBelowView tween 管理相机（position/target/zoom），勿回拽到地面取景。
    if (this.belowView) return
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
    const dirX = Math.cos(elevation) * Math.cos(az)
    const dirY = Math.sin(elevation)
    const dirZ = Math.cos(elevation) * Math.sin(az)
    // 参考距离定位以测相机空间包围盒——沿视图轴移动相机只改 z 不改 x/y，故 xmin..xmax/ymin..ymax 与最终距离无关。
    this.camera.position.set(centroid.x + dirX * 3000, centroid.y + dirY * 3000, centroid.z + dirZ * 3000)
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
    if (this.camera instanceof THREE.PerspectiveCamera) {
      // v2.5 透视取景：按内容高度反推相机距离（visibleHalfH = frustumH/2 → dist = (frustumH/2)/tan(fov/2)），
      // 对称视锥瞄向质心；近远平面按距离伸缩以保深度精度。用 local const 保 instanceof 收窄（this.camera 在调用后会被 TS 复位）。
      const cam = this.camera
      const fovRad = (ParkScene.REALISTIC_FOV * Math.PI) / 180
      const dist = (frustumH / 2) / Math.tan(fovRad / 2)
      cam.position.set(centroid.x + dirX * dist, centroid.y + dirY * dist, centroid.z + dirZ * dist)
      cam.lookAt(centroid)
      cam.aspect = A
      cam.fov = ParkScene.REALISTIC_FOV
      cam.near = Math.max(1, dist - 3000)
      cam.far = dist + 3000
    } else {
      const cam = this.camera as THREE.OrthographicCamera
      cam.bottom = ymin - M * frustumH
      cam.top = cam.bottom + frustumH
      cam.left = cx - frustumW / 2
      cam.right = cx + frustumW / 2
      cam.near = 1
      cam.far = 8000
    }
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

  /** 把俯角钳到 OrbitControls polar 夹紧 [minPolarAngle, maxPolarAngle] 允许的范围（v2.10 起 maxPolarAngle=π-0.1，范围跨越水平面、含地下仰视）。 */
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
    this._proj.set(x, y, z).project(this.camera)
    const rect = this.canvas.getBoundingClientRect()
    return { x: (this._proj.x * 0.5 + 0.5) * rect.width, y: (-this._proj.y * 0.5 + 0.5) * rect.height }
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
    // 射线已由 updatePointer 设置（调用方 onPointerMove/onPointerUp 均先 updatePointer）。
    const hits = this.raycaster.intersectObjects(this.poiPickables, false)
    return hits.length ? (hits[0].object.userData.poiId as string) : null
  }

  private pickBuilding(): { bid: string; fin: number } | null {
    // 射线已由 updatePointer 设置（调用方 onPointerMove/onPointerUp 均先 updatePointer）。
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
    // v2.6：地下视角只拾取车库坑体（楼上楼栋/POI 在地下视角无关）
    if (this.belowView) {
      const gid = this.pickGarage()
      this.canvas.style.cursor = gid ? 'pointer' : 'default'
      return
    }
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
    // v2.6：地下视角点击 → 选中/取消车库（null=取消）
    if (this.belowView) {
      this.cb.onGarageSelect?.(this.pickGarage())
      return
    }
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
    // v2.6 地下视角补间：相机 position/target/zoom 在「锚点 ↔ 坑中平视」之间过渡。
    {
      const targetBlend = this.belowView ? 1 : 0
      if (Math.abs(this.belowBlend - targetBlend) > 0.001) {
        this.belowBlend += (targetBlend - this.belowBlend) * 0.1
        this.camera.position.lerpVectors(this.belowAnchor, this.sideCamPos, this.belowBlend)
        this.controls.target.lerpVectors(this.belowTargetAnchor, this.sideTarget, this.belowBlend)
        this.camera.zoom = this.belowZoomAnchor + (this.belowZoom - this.belowZoomAnchor) * this.belowBlend
        this.camera.lookAt(this.controls.target)
        this.camera.updateProjectionMatrix()
      } else if (this.belowBlend !== targetBlend) {
        this.belowBlend = targetBlend
        this.controls.enabled = true   // 补间完成，恢复用户操控
      }
    }
    this.controls.update()
    if (!this.reducedMotion && this.alarmPois.length) {
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.18
      for (const o of this.alarmPois) o.scale.setScalar(s)
    }
    // v2.15 夜间发光窗开关动画：dirty-gated 局部重绘 emissiveMap（仅动画窗小矩形；空闲帧零上传）。
    if (!this.reducedMotion && this.facadeAnims.length) {
      const now = performance.now()
      for (const fa of this.facadeAnims) if (updateFacade(fa, now)) fa.tex.needsUpdate = true
    }
    // v2.0：启用 composer 时走后处理链（含 bloom/AO/OutputPass），否则直渲。
    if (this.composer) this.composer.render()
    else this.renderer.render(this.sceneObj, this.camera)
    // overlay 第二遍渲染：绕过 GTAO/bloom，保证楼顶名/P 牌/POI 图标全风格清晰可读。
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
    this.hdriEnvTexture?.dispose()
    this.pmrem?.dispose()
    // selectionFill / selectionOverlay 都在 keep 集中、clearSceneGroup 不回收，这里显式释放（含几何与材质）。
    this.selectionFill.geometry.dispose()
    const fm = this.selectionFill.material
    if (Array.isArray(fm)) (fm as THREE.Material[]).forEach((m) => m.dispose())
    else (fm as THREE.Material).dispose()
    this.selectionOverlay.geometry.dispose()
    ;(this.selectionOverlay.material as THREE.Material).dispose()
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
    // v2.5：车身 + 玻璃车舱 + 4 轮 + 前后灯（替代旧「两个方块」）。前后灯不受光，夜间 bloom 点亮。
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 20), new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex) }))
    body.position.y = 5
    if (this.profile.shadows) body.castShadow = true
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4, 9), new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex).multiplyScalar(0.5) }))
    cabin.position.set(0, 9, -1)
    const wheelGeo = new THREE.CylinderGeometry(2, 2, 2.5, 10)
    const wheelMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#15171c') })
    for (const [wx, wz] of [[-5, -7], [5, -7], [-5, 7], [5, 7]] as Array<[number, number]>) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(wx, 2.5, wz)
      g.add(wheel)
    }
    const headL = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4d0') }))
    headL.position.set(0, 5, 10)
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3030') }))
    tailL.position.set(0, 5, -10)
    g.add(body, cabin, headL, tailL)
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

/** v2.15 smoothstep 缓动（窗户开关渐隐用）。t 限 [0,1]。 */
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/**
 * v2.15 楼层房间面板竖向分割比例（砖错位：偶数层相位 0、奇数层相位 0.5）。
 * 返回每个面板的左边界比例数组（长度 = rooms），如 rooms=3 偶层 → [0, 0.333, 0.667]，
 * 奇层 → [0.5/3, 0.5/3+0.333, ...]（半面板偏移）。facade 纹理按此切片画窗，保证相邻层
 * 窗户不连成长条、更接近真实楼层入户错位。
 */
function floorRoomDividerFracs(floorIndex: number, rooms: number): number[] {
  const cell = 1 / rooms
  const phase = floorIndex % 2 === 0 ? 0 : cell * 0.5
  const fracs: number[] = []
  for (let i = 0; i < rooms; i++) fracs.push(phase + i * cell)
  return fracs
}

/**
 * v2.15 单立面动画推进（绝对时钟 now）。仅当本帧有窗在过渡/到期翻转时重绘其小矩形并返回 true。
 * 调用方据返回值决定是否 tex.needsUpdate=true（dirty-gated：空闲帧零 GL 上传）。
 * 注意：只重绘 emissiveMap 画布上动画窗的矩形——其余静态亮窗从不重画（局部重绘，非整图重烘焙）。
 */
function updateFacade(fa: FacadeAnim, now: number): boolean {
  let dirty = false
  for (const w of fa.windows) {
    if (now >= w.nextFlip) {
      w.from = w.cur
      w.to = w.to > 0.5 ? 0 : 1
      w.fadeStart = now
      w.nextFlip = now + fa.flipMinMs + fa.rngFlip() * fa.flipVarMs
    }
    if (w.fadeStart) {
      const t = (now - w.fadeStart) / fa.fadeMs
      if (t >= 1) { w.cur = w.to; w.fadeStart = 0 }
      else { w.cur = w.from + (w.to - w.from) * smoothstep(t) }
      dirty = true
    }
  }
  if (dirty) {
    for (const w of fa.windows) {
      if (!w.fadeStart && w.cur >= 0.999) continue   // 稳态亮——初画已着色，跳过
      fa.ctx.fillStyle = '#000000'
      fa.ctx.fillRect(w.x, w.y, w.w, w.h)
      if (w.cur > 0.001) {
        fa.ctx.globalAlpha = w.cur
        fa.ctx.fillStyle = w.color === 'warm' ? fa.warmColor : fa.coolColor
        fa.ctx.fillRect(w.x, w.y, w.w, w.h)
        fa.ctx.globalAlpha = 1
      }
    }
  }
  return dirty
}
