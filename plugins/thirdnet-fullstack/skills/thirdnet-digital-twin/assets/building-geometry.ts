/**
 * building-geometry.ts —— 楼栋几何装配（v2.0，对齐单一事实来源）。
 *
 * 为什么独立成模块：楼栋的立体轮廓（EdgesGeometry）半埋地下、金色楼层高亮偏移等 bug，
 * 根因都是 podium/body/edges/cap/dividers/label/slabs 的 y 坐标各自手算、彼此错位。
 * 把这套装配抽成一个纯函数，所有 y 坐标**只在此文件定义一次**——生成器导入调用，
 * 不再手写几何装配，从结构上消除错位。
 *
 * ─────────────────────────────────────────────────────────────────
 * 坐标系约定（相对 group 原点：楼栋中心、地面 y=0）：
 *   podium 裙座   : y ∈ [0, 0.5·fh]，居中 0.25·fh，占地 w·1.06 × d·1.06（包在塔底）
 *   body  塔体   : 高 h=floors·fh，y ∈ [0, h]，position.y = h/2
 *   edges 轮廓   : 与塔体同位 → position.y = h/2   ★对齐修复点
 *   cap  女儿墙  : 居顶，position.y = h + 0.09·fh
 *   divider 第 i 层横向虚线 (1..floors-1): y = i·fh
 *   label 楼名 sprite : y = h + 22   ★须在屋顶上方（v2.1 修复：旧式 h/2+22 会把标签埋进塔体）
 *   slab 第 i 层拾取盒 (0..floors-1): position.y = (i+0.5)·fh   ★须与 setSelection 高亮一致
 *
 * 地下车库层 L（v2.6，level<0；deckY=该层底板 Y 为负；ceilY=该层壁顶 Y，B1=0、B2=B1.deckY）:
 *   deck  底板      : y = deckY - 0.1（PlaneGeometry 平铺，半透明自发光）
 *   wall  玻璃壁    : y ∈ [ceilY, deckY]（4 面；多层时拼成连续竖井）
 *   divider 层分隔  : y = ceilY（壁顶四边虚线，多层标示楼板）
 *   spot  车位描线  : y = deckY + 0.05
 *   car   车辆      : y = deckY
 *   room  功能间    : y ∈ [deckY, deckY+roomH]，线框盒居中 deckY+roomH/2；名标牌 deckY+roomH+14
 *   ramp  坡道      : y 从 deckY 斜上到 ceilY（B1→地面；B2→上一层底板）
 *   label 层标牌    : y = deckY + 28
 *   pick  拾取盒    : y 居中 (ceilY+deckY)/2，高 (ceilY-deckY)
 * ─────────────────────────────────────────────────────────────────
 *
 * 风格相关的东西（材质、facade 纹理、标签配色）由调用方 ParkScene 构造后**作为入参传入**；
 * 本函数只负责形状与定位，不读 token、不查 profile（profile 的布尔结果以参数传入）。
 */
import * as THREE from 'three'

// ---------------------------------------------------------------------------
// v2.30 楼栋类型（spec building.type）——类型化外观的「体块形态」维度
// ---------------------------------------------------------------------------

/**
 * 楼栋类型：office=写字楼 / residential=居民楼 / commercial=商业 / default=未指定或未知。
 * 驱动三个外观维度：① 窗户/灯光模式、② 立面材质/基色（均在 park-scene.impl.ts）、
 * ③ 体块形态（本文件 KIND_MASSING）。'default' 行为与 v2.29 完全一致（向后兼容锚点）。
 */
export type BuildingKind = 'office' | 'residential' | 'commercial' | 'default'

/** spec building.type 字符串 → BuildingKind（缺省/未知落 'default'）。引擎只认本映射，不直接消费 type 字符串。 */
export function kindOf(type: string | undefined | null): BuildingKind {
  return type === 'office' || type === 'residential' || type === 'commercial' ? type : 'default'
}

/**
 * 类型 → 体块旋钮（本文件保持「纯几何不管材质」纪律——下表只定形状尺寸，
 * 阳台挑板/底盘灯带的材质由调用方注入，null=不画该附加件）。
 * default = 现状（裙座 fh*0.5、平面 ×1.06、无附加件）。
 */
interface KindMassing {
  /** 裙座高（fh 倍数；现状 0.5）。office 的无裙楼由调用方 podiumMaterial=null 表达，不在此表。 */
  podiumH: number
  /** 裙座平面放大系数（现状 1.06）。 */
  podiumScale: number
  /** 逐层阳台挑板（居民楼签名）。 */
  balconies: boolean
  /** 裙楼半高贯通灯带薄盒（商业底商签名；全风格可辨——裙楼无立面贴图，底层橱窗只能靠几何件表达）。 */
  storefrontBand: boolean
}
const KIND_MASSING: Record<BuildingKind, KindMassing> = {
  office:      { podiumH: 0.5, podiumScale: 1.06, balconies: false, storefrontBand: false },
  residential: { podiumH: 0.5, podiumScale: 1.06, balconies: true,  storefrontBand: false },
  commercial:  { podiumH: 2.0, podiumScale: 1.18, balconies: false, storefrontBand: true },
  default:     { podiumH: 0.5, podiumScale: 1.06, balconies: false, storefrontBand: false },
}

// ---------------------------------------------------------------------------
// 确定性伪随机（v2.1 楼顶设备定位用；与 park-scene.impl.ts / generate_data.py 同款）
// ---------------------------------------------------------------------------
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BuildBuildingOptions {
  /** 已定位到楼栋中心的空 group（调用方 `group.position.set(x,0,z)` 后传入）。 */
  group: THREE.Group
  /** 楼栋 id（写入 body/slab 的 userData，供拾取与详情）。 */
  id: string
  /** 楼名（仅作注释/调试用，标签纹理由调用方生成传入）。 */
  name: string
  /** 占地宽 / 深 / 总高 / 楼层数 / 单层高。 */
  w: number
  d: number
  h: number
  floors: number
  fh: number
  /** 塔体六面材质数组（[+x,-x,+y,-y,+z,-z]）。调用方已把 facade 纹理贴到侧面材质。 */
  sideMaterials: THREE.Material[]
  /** 裙座材质；null 表示不画裙座。 */
  podiumMaterial: THREE.Material | null
  /** 女儿墙/屋顶盖板材质；null 表示不画。 */
  capMaterial: THREE.Material | null
  /** 楼层横向虚线分隔色。 */
  dividerColor: THREE.Color
  /** 立体轮廓线色。 */
  edgeColor: THREE.Color
  /** 立体轮廓线不透明度（默认 ~0.6）。 */
  edgeOpacity: number
  /** 楼顶名称 Sprite 纹理（调用方经 makeContrastLabel 生成）。 */
  labelTexture: THREE.Texture
  /** 是否投射/接受阴影（profile.shadows）。 */
  castShadow: boolean
  /** 画完的拾取盒会 push 进此数组（调用方再注入 pickables / meta.slabs）。 */
  slabSink: THREE.Mesh[]
  /** v2.30 楼栋类型（缺省 'default' = 与 v2.29 相同体块）。驱动 KIND_MASSING：裙座尺寸/阳台/灯带。 */
  kind?: BuildingKind
  /** v2.30 阳台挑板材质（kind=residential 时调用方注入；null/缺省=不画）。 */
  balconyMaterial?: THREE.Material | null
  /** v2.30 商业裙楼底盘灯带材质（kind=commercial 时调用方注入；null/缺省=不画）。 */
  storefrontMaterial?: THREE.Material | null
}

export interface BuiltBuilding {
  group: THREE.Group
  /** 不可见楼层拾取盒（caller → pickables + meta.slabs）。 */
  slabs: THREE.Mesh[]
  /**
   * 楼顶名称 Sprite（caller 自行挂到 overlay 场景，**不进主场景**）。
   * 为什么不在 group 里：GTAO（v2.5 写实两风格已启用）会把漂浮在天空区的透明 sprite 像素乘向黑，
   * 挂在独立 overlay 场景里在 composer 之后第二遍渲染才能绕过 GTAO/bloom，保证全风格可读。
   */
  label: THREE.Sprite
}

/**
 * 装配一栋挤出楼栋（裙座 + 塔体 + 女儿墙 + 立体轮廓 + 楼层虚线 + 楼名 + 楼层拾取盒）。
 * 所有 y 坐标在本函数内统一，调用方无需关心对齐。
 */
export function buildBuilding(opts: BuildBuildingOptions): BuiltBuilding {
  const { group, id, w, d, h, floors, fh } = opts
  const slabs: THREE.Mesh[] = []
  const massing = KIND_MASSING[opts.kind ?? 'default']

  // 裙座（包在塔底，塔体不抬升）；v2.30 高/平面按类型 massing（commercial=2 层大裙楼）
  if (opts.podiumMaterial) {
    const podiumH = fh * massing.podiumH
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w * massing.podiumScale, podiumH, d * massing.podiumScale), opts.podiumMaterial)
    podium.position.y = podiumH / 2
    if (opts.castShadow) { podium.castShadow = true; podium.receiveShadow = true }
    group.add(podium)

    // v2.30 商业底盘灯带：裙楼半高贯通薄盒（底商橱窗的几何表达——裙楼无立面贴图，
    // 底层橱窗画在塔体 albedo 上会被裙楼挡住，只能靠独立几何件；全风格可辨）。
    // 四周比裙楼外挑 2 单位（+4）——只挑 0.5 会在斜俯视下与裙楼立面融成一条细线不可辨。
    if (massing.storefrontBand && opts.storefrontMaterial) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(w * massing.podiumScale + 4, fh * 0.9, d * massing.podiumScale + 4),
        opts.storefrontMaterial,
      )
      band.position.y = podiumH * 0.55
      group.add(band)
    }
  }

  // 塔体（BoxGeometry 居中，抬到地面之上：position.y = h/2 → 底面贴 y=0）
  const bodyGeo = new THREE.BoxGeometry(w, h, d)
  const body = new THREE.Mesh(bodyGeo, opts.sideMaterials)
  body.position.y = h / 2
  body.userData = { kind: 'building', buildingId: id }
  if (opts.castShadow) { body.castShadow = true; body.receiveShadow = true }
  group.add(body)

  // 女儿墙/屋顶盖板
  if (opts.capMaterial) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, fh * 0.18, d * 0.96), opts.capMaterial)
    cap.position.y = h + fh * 0.09
    if (opts.castShadow) cap.castShadow = true
    group.add(cap)
  }

  // 立体轮廓——必须与塔体同位（EdgesGeometry 默认居中原点，不补偿会半埋地下）。
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(bodyGeo),
    new THREE.LineBasicMaterial({ color: opts.edgeColor, transparent: true, opacity: opts.edgeOpacity }),
  )
  edges.position.y = h / 2
  group.add(edges)

  // 楼层横向虚线分隔（第 i 层底，y = i·fh）
  for (let i = 1; i < floors; i++) {
    const y = i * fh
    const pts = [
      new THREE.Vector3(-w / 2, y, -d / 2), new THREE.Vector3(w / 2, y, -d / 2),
      new THREE.Vector3(w / 2, y, -d / 2), new THREE.Vector3(w / 2, y, d / 2),
      new THREE.Vector3(w / 2, y, d / 2), new THREE.Vector3(-w / 2, y, d / 2),
      new THREE.Vector3(-w / 2, y, d / 2), new THREE.Vector3(-w / 2, y, -d / 2),
    ]
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const line = new THREE.LineSegments(geo, new THREE.LineDashedMaterial({ color: opts.dividerColor, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.5 }))
    line.computeLineDistances()
    group.add(line)
  }

  // v2.30 居民楼逐层阳台挑板（住宅签名）。共享一份 geometry + 调用方注入的单一材质；
  // 板心在楼板线 y=i·fh（厚度 fh*0.07，塔体周圈外挑 4%）——挑板前沿恰好替代该层虚线分隔的观感。
  // 超高层（>40 层）可改隔层挑板（i%2===0）控制 mesh 数。
  if (massing.balconies && opts.balconyMaterial) {
    const balGeo = new THREE.BoxGeometry(w * 1.04, fh * 0.07, d * 1.04)
    for (let i = 1; i < floors; i++) {
      const bal = new THREE.Mesh(balGeo, opts.balconyMaterial)
      bal.position.y = i * fh
      if (opts.castShadow) { bal.castShadow = true; bal.receiveShadow = true }
      group.add(bal)
    }
  }

  // 楼顶常驻名称标签（须在屋顶上方——旧式 h/2+22 会把标签埋进塔体内部，高楼不可见）。
  // depthTest:false：标签走 overlay 第二遍渲染（始终置顶），不参与主场景深度/GTAO。
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.labelTexture, depthTest: false, depthWrite: false, transparent: true }))
  label.position.set(0, h + 22, 0)
  const lw = Math.max(52, opts.name.length * 19)
  label.scale.set(lw, 25, 1)
  // 不 add 进 group——交给 caller 挂到 overlayScene（绕过 GTAO/bloom）。

  // 楼层拾取盒（不可见命中盒，y = (i+0.5)·fh；setSelection 金色高亮须用同式）
  const slabGeo = new THREE.BoxGeometry(w, fh * 0.92, d)
  const slabMat = new THREE.MeshBasicMaterial({ visible: false })
  for (let i = 0; i < floors; i++) {
    const slab = new THREE.Mesh(slabGeo.clone(), slabMat)
    slab.position.y = (i + 0.5) * fh
    slab.userData = { kind: 'building', buildingId: id, floorIndex: i }
    group.add(slab)
    slabs.push(slab)
  }
  opts.slabSink.push(...slabs)

  return { group, slabs, label }
}

// ---------------------------------------------------------------------------
// v2.1 楼顶设备套件（buildRooftopKit）——真实建筑天际线的关键细节
// ---------------------------------------------------------------------------
// 真实楼栋的屋顶从不是一块平板：电梯机房 + 通信天线/避雷针是远观可辨的天际线元素。
// 位置/数量由 buildingId 种子确定性派生（同一 spec 重复生成一致），y 坐标仍只在本
// 文件定义（机房坐在女儿墙上、天线从屋顶起算），调用方只传风格化材质。

export interface RooftopKitOptions {
  /** 已定位到楼栋中心的 group（与 buildBuilding 同一个）。 */
  group: THREE.Group
  /** 楼栋 id（确定性种子来源）。 */
  id: string
  /** 占地宽 / 深 / 总高 / 单层高。 */
  w: number
  d: number
  h: number
  fh: number
  /** 电梯机房盒材质（风格相关，调用方构造；色取 token environment.rooftop）。 */
  roomMaterial: THREE.Material
  /** 天线杆材质。 */
  antennaMaterial: THREE.Material
  /** 天线顶端警示灯色（night-realistic 给红色自发光；其余风格 null = 不装）。 */
  beaconColor?: THREE.Color | null
  castShadow?: boolean
}

/**
 * 装配楼顶设备：1 个电梯机房盒 + 1–2 根天线（种子决定）+ 可选警示灯。
 * 机房：w·0.18 × fh·0.5 × d·0.22，position.y = h + fh·0.25（坐屋顶面）。
 * 天线：Cylinder(r0.4, r0.6, fh·1.2)，底部 y = h；警示灯球在杆顶。
 */
export function buildRooftopKit(opts: RooftopKitOptions): void {
  const { group, id, w, d, h, fh } = opts
  const rnd = mulberry32(hashStr(`rooftop:${id}`))

  // 电梯机房盒（确定性偏移，不压边缘、不挡楼顶标签——标签在 y=h/2+22 前侧）
  const roomW = w * 0.18
  const roomD = d * 0.22
  const roomH = fh * 0.5
  const ox = (rnd() - 0.5) * (w - roomW) * 0.6
  const oz = (rnd() - 0.5) * (d - roomD) * 0.6
  const room = new THREE.Mesh(new THREE.BoxGeometry(roomW, roomH, roomD), opts.roomMaterial)
  room.position.set(ox, h + roomH / 2, oz)
  if (opts.castShadow) { room.castShadow = true; room.receiveShadow = true }
  group.add(room)

  // v2.5 AC 机组合（1–2 个扁盒，机房对侧）—— 真实建筑屋顶常见设备，丰富天际线。
  const nAc = 1 + Math.floor(rnd() * 2)
  for (let i = 0; i < nAc; i++) {
    const acW = w * (0.1 + rnd() * 0.06)
    const acD = d * (0.1 + rnd() * 0.06)
    const acH = fh * (0.22 + rnd() * 0.12)
    const acx = -ox * (0.5 + rnd() * 0.4) + (rnd() - 0.5) * w * 0.2
    const acz = -oz * (0.5 + rnd() * 0.4) + (rnd() - 0.5) * d * 0.2
    const ac = new THREE.Mesh(new THREE.BoxGeometry(acW, acH, acD), opts.roomMaterial)
    ac.position.set(acx, h + acH / 2, acz)
    if (opts.castShadow) { ac.castShadow = true; ac.receiveShadow = true }
    group.add(ac)
  }

  // 天线 1–2 根（种子决定），放在机房对侧
  const nAntenna = 1 + Math.floor(rnd() * 2)
  for (let i = 0; i < nAntenna; i++) {
    const ax = -ox * (0.6 + rnd() * 0.4) + (rnd() - 0.5) * w * 0.15
    const az = -oz * (0.6 + rnd() * 0.4) + (rnd() - 0.5) * d * 0.15
    const ah = fh * (1.0 + rnd() * 0.5)
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, ah, 6), opts.antennaMaterial)
    antenna.position.set(ax, h + ah / 2, az)
    if (opts.castShadow) antenna.castShadow = true
    group.add(antenna)
    if (opts.beaconColor) {
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 8, 6),
        new THREE.MeshBasicMaterial({ color: opts.beaconColor }),
      )
      beacon.position.set(ax, h + ah + 1.5, az)
      group.add(beacon)
    }
  }
}

// ---------------------------------------------------------------------------
// v2.6 地下车库（地下多层剖面）—— buildUndergroundGarage
// ---------------------------------------------------------------------------
// 设计取舍（对齐 web 驾驶舱 DigitalTwin.buildGarage）：地面**不开洞**，坑体是 Y<0 的
// 透明玻璃柱——楼栋不悬空，从侧面透过半透明墙可见内部车位/车辆/功能房间/坡道。
// 多层（B1/B2…）由调用方按 level 升序排序后逐层调用：每层 ceilY = 上一层 deckY（B1 的 ceilY=0），
// 故每层的 4 面玻璃壁自然拼成连续竖井。地下无独立光照，靠材质 emissive 伪造深度感。
//
// 风格相关（材质/标牌纹理/车辆工厂）由调用方 ParkScene 构造后作为入参传入；本函数只负责
// 形状与定位，不读 token、不查 profile——与 buildBuilding 同纪律。

/** 由 4 个角点构造双面四边形 mesh（地下玻璃壁 / 坡道斜面）。 */
export function quadMesh(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
    a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
  ], 3))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, mat)
}

export interface GarageRoomSpec {
  name: string
  x: number; z: number            // 房间中心（相对坑体中心）
  w: number; d: number            // 房间占地
}

export interface UndergroundMaterials {
  deck: THREE.Material            // 底板（半透明自发光，调用方按风格构造）
  wall: THREE.Material            // 4 面玻璃壁（半透明）
  ramp: THREE.Material            // 坡道斜面
  roomEdgeColor: THREE.Color      // 功能房间线框色
  spotColor: THREE.Color          // 车位描线色
  edgeColor: THREE.Color          // 边界虚线 / 层分隔 / 坡道门洞色
}

export interface BuildUndergroundGarageOptions {
  /** 已定位到坑体中心的 group（调用方 `group.position.set(x,0,z)` 后传入）。 */
  group: THREE.Group
  id: string                      // 写入拾取盒 userData.garageId
  name: string                    // 层标牌文字（"地下车库 B1"）
  w: number; d: number            // 坑体占地
  /** 该层底板 Y（负数，如 -140）。 */
  deckY: number
  /** 该层壁顶 Y（B1=0；B2=B1 的 deckY）。壁从 ceilY 延伸到 deckY。 */
  ceilY: number
  cols?: number; rows?: number    // 车位网格采样列/行（仅 parking；非 parking 省略→buildUndergroundGarage 跳过车位网格）
  rooms: GarageRoomSpec[]         // 功能房间（调用方解析缺省 8 间）
  materials: UndergroundMaterials
  /** 层标牌纹理（调用方经 makeContrastLabel 生成）。 */
  labelTexture: THREE.Texture
  /** 房间/坡道名标牌纹理工厂（调用方按 name 生成，如 roomLabelTexture('入口')）。 */
  labelTextureOf: (name: string) => THREE.Texture
  /** 车辆工厂（调用方按风格构造，暗风格走 emissive 才地下可见）。 */
  makeCar: (color: THREE.ColorRepresentation) => THREE.Group
  carColors: THREE.ColorRepresentation[]
  castShadow: boolean             // profile.shadows（写实两风格）
  /** 画完的不可见拾取盒 push 进此数组（调用方再注入 garagePickables）。 */
  pickSink: THREE.Object3D[]
}

export interface BuiltUndergroundGarage {
  group: THREE.Group
  pick: THREE.Mesh
}

const GARAGE_ROOM_H = 34

interface Rect { x0: number; x1: number; z0: number; z1: number }

/**
 * 装配一个地下车库负层坑体：底板 + 4 面透明玻璃壁 + 层分隔虚线 + 车位网格/车辆 +
 * 功能房间线框 + 2 条出入坡道 + 层标牌 + 不可见拾取盒。所有地下 y 坐标在本函数内统一。
 */
export function buildUndergroundGarage(opts: BuildUndergroundGarageOptions): BuiltUndergroundGarage {
  const { group, id, w, d, deckY, ceilY, cols, rows, rooms, materials, makeCar, carColors } = opts
  const fwx = w / 2
  const fdz = d / 2

  // 底板（半透明自发光，从下方仰视可透见其上车位/车辆，不被一片黑楼板挡住）
  const deckFloor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), materials.deck)
  deckFloor.rotation.x = -Math.PI / 2
  deckFloor.position.y = deckY - 0.1
  if (opts.castShadow) deckFloor.receiveShadow = true
  group.add(deckFloor)

  // 4 面透明玻璃直壁（ceilY → deckY）
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const TNW = V(-fwx, ceilY, -fdz), TNE = V(fwx, ceilY, -fdz), TSE = V(fwx, ceilY, fdz), TSW = V(-fwx, ceilY, fdz)
  const BNW = V(-fwx, deckY, -fdz), BNE = V(fwx, deckY, -fdz), BSE = V(fwx, deckY, fdz), BSW = V(-fwx, deckY, fdz)
  const wall = materials.wall
  group.add(quadMesh(TNW, TNE, BNE, BNW, wall)) // 北壁
  group.add(quadMesh(TSW, TSE, BSE, BSW, wall)) // 南壁
  group.add(quadMesh(TNE, TSE, BSE, BNE, wall)) // 东壁
  group.add(quadMesh(TNW, TSW, BSW, BNW, wall)) // 西壁

  // 壁顶层分隔虚线（多层时标示楼板位置；B1 时即地表边界 footprint 标记）+ 顶层 4 条垂直角线（示深度）
  const dividerMat = new THREE.LineDashedMaterial({ color: materials.edgeColor, dashSize: 10, gapSize: 8, transparent: true, opacity: 0.7 })
  const divGeo = new THREE.BufferGeometry().setFromPoints([TNW, TNE, TNE, TSE, TSE, TSW, TSW, TNW])
  const divLine = new THREE.LineSegments(divGeo, dividerMat)
  divLine.computeLineDistances()
  group.add(divLine)
  if (ceilY === 0) {
    const dropMat = new THREE.LineDashedMaterial({ color: materials.edgeColor, dashSize: 10, gapSize: 8, transparent: true, opacity: 0.7 })
    for (const [a, b] of [[TNW, BNW], [TNE, BNE], [TSE, BSE], [TSW, BSW]] as Array<[THREE.Vector3, THREE.Vector3]>) {
      const drop = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([a, b]), dropMat)
      drop.computeLineDistances()
      group.add(drop)
    }
  }

  // 坡道（入口在西、出口在东）：从 deckY 斜上到 ceilY，置于 z=±d/4 两侧（避让中央车位）
  const rampRects = [
    buildGarageRamp(group, 'x', -d / 4, -fwx + Math.min(80, w * 0.18), -fwx + Math.min(20, w * 0.05), 46, deckY, ceilY, opts.labelTextureOf('入口'), materials, opts.castShadow),
    buildGarageRamp(group, 'x', d / 4, fwx - Math.min(20, w * 0.05), fwx - Math.min(80, w * 0.18), 46, deckY, ceilY, opts.labelTextureOf('出口'), materials, opts.castShadow),
  ]

  // 功能房间（线框盒 + 名标牌）+ 记录占地矩形（车位避让）
  const roomRects: Rect[] = []
  for (const rm of rooms) {
    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(rm.w, GARAGE_ROOM_H, rm.d)),
      new THREE.LineBasicMaterial({ color: materials.roomEdgeColor, transparent: true, opacity: 0.85 }),
    )
    wire.position.set(rm.x, deckY + GARAGE_ROOM_H / 2, rm.z)
    group.add(wire)
    const rlab = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.labelTextureOf(rm.name), transparent: true, depthTest: true }))
    rlab.scale.set(rm.w * 0.9, 22, 1)
    rlab.position.set(rm.x, deckY + GARAGE_ROOM_H + 14, rm.z)
    group.add(rlab)
    roomRects.push({ x0: rm.x - rm.w / 2 - 8, x1: rm.x + rm.w / 2 + 8, z0: rm.z - rm.d / 2 - 8, z1: rm.z + rm.d / 2 + 8 })
  }

  // 车位网格 + 车辆（仅 parking：cols/rows 给定；非 parking 跳过）。确定性铺放，避让房间/坡道占地。
  if (cols && rows) {
    const rng = mulberry32(hashStr(`garage:${id}`))
    const colStep = w / cols
    const rowStep = d / rows
    const spotW = colStep * 0.6
    const stallL = rowStep * 0.6
    const startX = -w / 2 + colStep / 2
    const startZ = -d / 2 + rowStep / 2
    const lineMat = new THREE.LineBasicMaterial({ color: materials.spotColor, transparent: true, opacity: 0.45 })
    const avoid = [...roomRects, ...rampRects]
    const inAvoid = (x: number, z: number) => avoid.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
    // 车位描线批量合并为单个 LineSegments：每车位 3 段 U 形（近边→右边→回到近左），
    // 取代每格一个 THREE.Line（200 个车位 = 200 个绘制调用 → 1）。视觉逐段等价。
    const spotPts: THREE.Vector3[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * colStep
        const z = startZ + r * rowStep
        if (inAvoid(x, z)) continue
        const nx = x - spotW / 2, fx = x + spotW / 2, nz = z - stallL / 2, fz = z + stallL / 2
        spotPts.push(
          new THREE.Vector3(nx, 0, nz), new THREE.Vector3(fx, 0, nz),
          new THREE.Vector3(fx, 0, nz), new THREE.Vector3(fx, 0, fz),
          new THREE.Vector3(fx, 0, fz), new THREE.Vector3(nx, 0, nz),
        )
        if (rng() > 0.55) {
          const car = makeCar(carColors[(rng() * carColors.length) | 0])
          car.position.set(x, deckY, z)
          if (rng() > 0.5) car.rotation.y = Math.PI
          group.add(car)
        }
      }
    }
    if (spotPts.length) {
      const spotLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spotPts), lineMat)
      spotLines.position.y = deckY + 0.05
      group.add(spotLines)
    }
  }

  // 层标牌（depthTest:true 随坑体一起被地面遮挡——地上视角不穿地乱显，地下视角在坑内可读）
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.labelTexture, transparent: true, depthTest: true }))
  label.scale.set(Math.min(200, w * 0.4), 48, 1)
  label.position.set(0, deckY + 28, 0)
  group.add(label)

  // 不可见拾取盒（覆盖本层体积）→ 地下视角时点击出 GarageCard
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(w, ceilY - deckY, d),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  pick.position.set(0, (ceilY + deckY) / 2, 0)
  pick.userData = { kind: 'garage', garageId: id }
  group.add(pick)
  opts.pickSink.push(pick)

  return { group, pick }
}

/**
 * 单条地下车库坡道：斜坡面 + 中央虚线 + 地面端 2 立柱门洞 + 标牌。
 * 沿 axis 方向从 (aDeep, deckY) 斜上到 (aSurf, ceilY)；cross 为垂直轴中线坐标。
 * 返回占地矩形（供车位避让）。
 */
function buildGarageRamp(
  group: THREE.Group,
  axis: 'x' | 'z',
  cross: number,
  aDeep: number,
  aSurf: number,
  width: number,
  deckY: number,
  ceilY: number,
  labelTexture: THREE.Texture,
  materials: UndergroundMaterials,
  castShadow: boolean,
): Rect {
  const yDeep = deckY
  const ySurf = ceilY
  const hw = width / 2
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  let d1: THREE.Vector3, d2: THREE.Vector3, s1: THREE.Vector3, s2: THREE.Vector3
  if (axis === 'z') {
    d1 = V(cross - hw, yDeep, aDeep); d2 = V(cross + hw, yDeep, aDeep)
    s1 = V(cross - hw, ySurf, aSurf); s2 = V(cross + hw, ySurf, aSurf)
  } else {
    d1 = V(aDeep, yDeep, cross - hw); d2 = V(aDeep, yDeep, cross + hw)
    s1 = V(aSurf, ySurf, cross - hw); s2 = V(aSurf, ySurf, cross + hw)
  }
  const ramp = quadMesh(d1, d2, s2, s1, materials.ramp)
  if (castShadow) { ramp.castShadow = true; ramp.receiveShadow = true }
  group.add(ramp)
  // 中央虚线（深端中点 → 地面端中点）
  const midDeep = d1.clone().add(d2).multiplyScalar(0.5)
  const midSurf = s1.clone().add(s2).multiplyScalar(0.5)
  const dash = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([midDeep, midSurf]),
    new THREE.LineDashedMaterial({ color: materials.edgeColor, dashSize: 7, gapSize: 5, transparent: true, opacity: 0.8 }),
  )
  dash.computeLineDistances()
  group.add(dash)
  // 地面端门洞：2 立柱 + 横梁
  const postMat = new THREE.MeshBasicMaterial({ color: materials.edgeColor })
  const postH = Math.max(16, ySurf - yDeep + 16)
  for (const p of [s1, s2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, postH, 6), postMat)
    post.position.set(p.x, yDeep + postH / 2, p.z)
    group.add(post)
  }
  const lintelW = axis === 'x' ? 2 : width + 4
  const lintelD = axis === 'x' ? width + 4 : 2
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(lintelW, 2, lintelD), postMat)
  lintel.position.set((s1.x + s2.x) / 2, yDeep + postH, (s1.z + s2.z) / 2)
  group.add(lintel)
  // 标牌
  const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: true }))
  lab.scale.set(60, 18, 1)
  lab.position.set(midSurf.x, ySurf + 14, midSurf.z)
  group.add(lab)
  // 占地矩形
  const xs = [d1.x, d2.x, s1.x, s2.x]
  const zs = [d1.z, d2.z, s1.z, s2.z]
  return { x0: Math.min(...xs) - 6, x1: Math.max(...xs) + 6, z0: Math.min(...zs) - 6, z1: Math.max(...zs) + 6 }
}
