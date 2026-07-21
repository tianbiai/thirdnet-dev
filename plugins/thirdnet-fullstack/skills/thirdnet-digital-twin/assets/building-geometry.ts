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
 *   label 楼名 sprite : y = h/2 + 22
 *   slab 第 i 层拾取盒 (0..floors-1): position.y = (i+0.5)·fh   ★须与 setSelection 高亮一致
 * ─────────────────────────────────────────────────────────────────
 *
 * 风格相关的东西（材质、facade 纹理、标签配色）由调用方 ParkScene 构造后**作为入参传入**；
 * 本函数只负责形状与定位，不读 token、不查 profile（profile 的布尔结果以参数传入）。
 */
import * as THREE from 'three'

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
  /** 裙座材质；null 表示该风格不画裙座（如 wire 蓝图）。 */
  podiumMaterial: THREE.Material | null
  /** 女儿墙/屋顶盖板材质；null 表示不画（如 wire / white）。 */
  capMaterial: THREE.Material | null
  /** 楼层横向虚线分隔色。 */
  dividerColor: THREE.Color
  /** 立体轮廓线色。 */
  edgeColor: THREE.Color
  /** 立体轮廓线不透明度（wire 风格 1，其余 ~0.6）。 */
  edgeOpacity: number
  /** 楼顶名称 Sprite 纹理（调用方经 makeContrastLabel 生成）。 */
  labelTexture: THREE.Texture
  /** 是否投射/接受阴影（profile.shadows）。 */
  castShadow: boolean
  /** 画完的拾取盒会 push 进此数组（调用方再注入 pickables / meta.slabs）。 */
  slabSink: THREE.Mesh[]
}

export interface BuiltBuilding {
  group: THREE.Group
  /** 不可见楼层拾取盒（caller → pickables + meta.slabs）。 */
  slabs: THREE.Mesh[]
}

/**
 * 装配一栋挤出楼栋（裙座 + 塔体 + 女儿墙 + 立体轮廓 + 楼层虚线 + 楼名 + 楼层拾取盒）。
 * 所有 y 坐标在本函数内统一，调用方无需关心对齐。
 */
export function buildBuilding(opts: BuildBuildingOptions): BuiltBuilding {
  const { group, id, w, d, h, floors, fh } = opts
  const slabs: THREE.Mesh[] = []

  // 裙座（包在塔底，塔体不抬升）
  if (opts.podiumMaterial) {
    const podiumH = fh * 0.5
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, podiumH, d * 1.06), opts.podiumMaterial)
    podium.position.y = podiumH / 2
    if (opts.castShadow) { podium.castShadow = true; podium.receiveShadow = true }
    group.add(podium)
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

  // 楼顶常驻名称标签
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: opts.labelTexture, depthTest: true, depthWrite: false, transparent: true }))
  label.position.set(0, h / 2 + 22, 0)
  const lw = Math.max(60, opts.name.length * 22)
  label.scale.set(lw, 30, 1)
  group.add(label)

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

  return { group, slabs }
}
