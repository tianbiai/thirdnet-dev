# 场景配方（Scene Recipe）—— Three.js 数字孪生

这是中央 3D 场景的核心构建配方，**设计原理与逐风格材质/灯光规范**（single source of truth for *intent*）。

> **落地代码以 `assets/park-scene.impl.ts` 为基线**（导读见 `references/park-scene-impl.md`）。生成器「拷贝-改」范式实现产出 `src/scene/ParkScene.ts`，不再从下文散文合成渲染管线。本文件讲「为什么这么设计」；冲突时以范式实现代码为准。下文偶尔出现的 `DigitalTwin.ts` 是一个不随技能发布的历史范例文件，其模式（正交相机、射线拾取、聚焦补间、程序化幕墙纹理、完整 dispose）已全部并入 `park-scene.impl.ts`，生成器无需查阅它。

下文 §2–§3 是**赛博风格**的详细配方，§4–§9（按类别上色、车库标牌、Legend、交互/选中、生命周期、园区环境）是**所有风格共用**的部分。**渲染器/灯光/材质/地面若选用其它风格**（全息 / 等距插画 / 星云 / 写实），见 `references/styles.md`——除 `cyber` 外的风格跳过 §3（网格着色器地面），按 `styles.md` 的半透/flatShading/星空/PBR 材质构建，但 §4–§9 照常适用。

## 目录—— 为 X 读 §Y

| 你要做的事 | 读哪节 |
|---|---|
| 文件布局 / WebGL2 能力检测 | §1 |
| 渲染器 / 相机取景 / 灯光（赛博） | §2 |
| 网格着色器地面（cyber） | §3 |
| 按类别上色楼栋 / 楼层虚线 + 贴砖 / 楼顶标签 / 标签对比 | §4 |
| 车库入口半金字塔 + P 牌 | §5 |
| Legend 叠加 | §6 |
| 可选赛博装饰 | §7 |
| 交互 / 选中态机 / 聚焦补间（铁律 + 反面模式） | §8 |
| 生命周期 / WebGL context loss / dispose 清单 | §9 |
| 园区环境（道路/车位/绿化/周边/氛围）/ 性能预算 | §10 |
| POI 标记 + tooltip / openPoiId 单开契约 | §11 |
| 动态数据水合 API / 加载时序 | §12 |
| 航拍巡航（auto-orbit）/ setTourEnabled | §13 |
| 地下场景（地下车库多层剖面）/ buildUndergroundGarage / setBelowView | §14 |
| 各风格渲染器/灯光/材质/地面分支 | `references/styles.md` |
| 契约层 5 文件 / Mock/Real / 后端端点 | `references/dynamic-data-api.md` |
| 舞台外壳 / 响应式 / a11y / 空错态 | `references/shell.md` |

## 1. 文件布局

```
src/
  scene/
    ParkScene.ts          ← 从 assets/park-scene.impl.ts「拷贝-改」（单例；见 §9、§12 水合 API）
    building-geometry.ts  ← 从 assets/building-geometry.ts 原样拷贝（楼栋几何装配单一事实来源）
    shaders/{gridGround,fresnelRim}.glsl   ← 从 assets/ 拷贝
    themes/*.tokens.json  ← 从 assets/themes/ 拷贝 6 个（theme.ts 静态 import；tsconfig 需 resolveJsonModule）
  data/<park>.ts          ← generate_data.py 生成（静态脚手架：占地几何 + 环境驱动 + tokens）
  composables/{useSelection,useScaleBoard,useTwinData,useTour,useStyle}.ts   ← 从 assets/components/ 拷贝
  utils/theme.ts          ← applyTheme + applyCssVars（从 assets/components/ 拷贝）
  components/center/      ← 从 assets/components/ 拷贝（9 .vue + 5 composable + theme.ts = 15 范式文件）
  styles/tokens.css       ← generate_theme.py 生成（main.ts 顶部 import）
  config/index.ts + api/  ← v1.5 动态数据契约层（见 dynamic-data-api.md）
  mock/                   ← v1.5（独立项目靠 VITE_MOCK_ENABLED=false + tree-shaking 剥离；admin 模板用 mockDataStripPlugin）
```

用 Vite `?raw` 加载着色器：`import gridFrag from '../scene/shaders/gridGround.glsl?raw'`。

**WebGL2 能力检测**：部分特性依赖 WebGL2（`MeshReflectorMaterial`、高质量阴影过滤）。`detectWebGL2()`（范式实现内置）在独立探测 canvas 上一次性判定（**绝不**在真实 canvas 上 `getContext`——会固化上下文属性）。无 WebGL2 时禁用 transmission/reflector/PMREM，bloom 降档、阴影改 PCF。Three.js `WebGLRenderer` 默认请求 WebGL2 并回退 WebGL1，但材质/后处理不会自动降级——须据 `hasWebGL2` 选择材质与 pass。

## 2. 渲染器、相机、灯光（赛博风格；其它风格见 `references/styles.md`）

以 `assets/park-scene.impl.ts` 为基线「拷贝-改」，渲染器/相机/灯光骨架直接复用：

- **渲染器**：`WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })`，`setPixelRatio(Math.min(dpr, 2))`（硬性上限 2），`outputColorSpace = SRGBColorSpace`（防换肤色调漂移），`ACESFilmicToneMapping`（曝光约 1.0）。`EffectComposer` 可选（仅当要用 bloom 时）。
- **场景背景（防黑屏关键）**：渲染器虽 `alpha:true`，但**必须显式设 `scene.background`**——否则画布透明、透出深色页面底、整屏发黑。背景取 token 的 `scene` 块，画成**顶→底纵向渐变** `CanvasTexture`（`bgTop → bgBottom`）。why 渐变而非纯色：暗色风格给地平线上方空气感、纵深，远比纯黑读起来像「数字孪生空腔」。
- **相机（取景必须从 spec 几何推导，不能写死）**：`OrthographicCamera`（写实两风格用 `PerspectiveCamera`，见 `park-scene-impl.md`），等轴姿态（`elevation = atan(1/√2)`、方位角 π/4）。采用「**测量后取景**」：算出内容包围盒在相机视图空间的范围，据此设**非对称视锥**，把地面最近端钉到距舞台底边 ~6%。算法封装在范式实现 `frameCamera()`：

```ts
// (a) 从 spec 派生内容几何
const bx = spec.boundary.x, bz = spec.boundary.z
const Hmax = Math.max(...spec.buildings.map(b => b.floors)) * spec.floorHeight
const centroid = new THREE.Vector3(0, Hmax / 2, 0)          // 内容竖向质心 = 瞄准/轨道中心
// (b) 等轴姿态 + 瞄准质心（而非地平面原点）
// (c) 测内容 8 个包围盒角点在 view-space 的 x/y 范围
// (d) 按画布宽高比 A 算出能容纳内容的视锥高
const A = canvasW / canvasH, K = 0.66, M = (1 - K) / 2        // 内容占 66%，四周各留 ~17% 显示周边环境
const frustumH = Math.max(ch / K, cw / (A * K))
// (e) 非对称视锥：底部钉到 M，水平居中，顶部吸收余量
this.camera.bottom = ymin - M*frustumH                        // 地面最近端钉到距底边 ~17%
```

  要点（理解 why，不照抄数字）：
  - **瞄准质心而非地平面**：`lookAt(centroid=(0,Hmax/2,0))` 让楼栋质量进入画面上半，配合底部钉边，下方空白消失。
  - **测量后取景**：内容包围盒投到 view-space 再算视锥，天然适配不同 boundary/楼高。
  - **留周边环境余量（默认 K=0.66）**：四周各留 ~17% 显示周边市政道路/行道树——默认就是一张能看全园区轮廓和紧邻环境的「全景图」。特写主体可调 K→0.8；航拍俯瞰 K→0.55（§13 巡航落地）。
  - **取景高度用真实楼层**：`frameCamera()` 的 `Hmax` 水合前用默认 18 层估算（保证首屏不白屏），`hydrateBuildings()` 末尾必须用真实最高楼层重新 `frameCamera()`（范式实现已内置 `maxBuildingHeight()`）。
  - **程序化天空（token `scene.sky` 开关）**：背景纹理 canvas 加宽到 512，按风格画入白云（写实）/ 星空（夜景，130 颗）/ 月亮（夜景）。**星星必须暗淡（alpha ≤ 0.45）**——亮星会被 bloom 晕成「雪片」。
  - **`OrbitControls`**：带阻尼，极角夹紧 [0.5, π-0.1]（允许拖到地面之下仰视坑体），缩放夹紧 [0.45, 2.6]。
  - **resize 重算**：宽高比 A 变了要重跑 (d)(e)——封装成 `frameCamera()`，`setupCamera` 末尾和 `onResize` 里都调，**防抖 150ms**。
- **灯光**：刻意保持平，让着色器地面 + 自发光边线读起来像「数字孪生」而非「建筑可视化」。一个 `HemisphereLight` + 一盏柔和 `DirectionalLight`。丢掉 VSM 阴影贴图和 PMREM 环境（会与赛博地面打架）。
- **环境光下限（所有风格强制）**：无论风格 `lights.ambient` 是否为 `null`，都额外补一盏低强度 `AmbientLight`，强度取 token `lights.ambientFloor`（暗色风格 ~0.18–0.20、亮色风格 ~0.08）。why：cyber 等风格原本刻意无环境光，实测导致未受光面纯黑、被判定为「黑屏」；一道极弱环境光只抬起阴影、不破坏氛围。

## 3. 网格着色器地面 ← cyber 风格的关键地面（其余风格跳过，按 `styles.md`）

赛博地面用真正的着色器平面（`assets/gridGround.glsl`，霓虹青网格 + 径向晕影，由 `vUv * u_scale` 驱动，网格跟随平面而非随相机漂移）：

```ts
const GRID_UNIFORMS = {
  u_gridColor: { value: new THREE.Color(spec.shaders.grid.u_gridColor) },  // #2a7fff
  u_cell:      { value: spec.shaders.grid.u_cell },                         // 46
  u_strength:  { value: spec.shaders.grid.u_strength },                     // 0.85
  u_scale:     { value: new THREE.Vector2(boundary.x * 2, boundary.z * 2) },
}
const groundMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL1, uniforms: GRID_UNIFORMS, fragmentShader: gridFrag, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, transparent: true, depthWrite: false })
const ground = new THREE.Mesh(new THREE.PlaneGeometry(boundary.x * 2, boundary.z * 2), groundMat)
ground.rotation.x = -Math.PI / 2
```

**外圈城市地面（所有风格）**：园区的周边道路、行道树落在 `boundary` 之外，所以地面分两层——园区地面（cyber 用 shader，其它风格按 `styles.md`）+ 外圈城市地面（比园区大一圈的更深/冷纯色 `MeshBasicMaterial`，铺在园区地面之下作周边道路画布）。两层 `rotation.x = -π/2`，Y 略低避免 z-fight。

### §3.1 程序化地面纹理 `makeGroundTexture`（非 cyber 风格主地面 + cyber 降级）

非 cyber 风格的园区地面叠一层**程序化 `CanvasTexture`**（与 `makeFacadeTexture` 同套画布思路，不引入外部图片），形态由 token `ground.texture.type` 决定：`grid`（isometric 细网格）、`dots`（holographic/nebula 点阵）、`tiles`（引擎保留分支）、`none`（纯色回退）。`wrapS/wrapT = RepeatWrapping`、`repeat.set(8,8)` 平铺。

接线规则：
- **非 cyber**：`makeGroundTexture(token)` 作为园区地面材质的 `map`（holographic 等自发光风格可同时作 `emissiveMap` + 低强度）。不替换两层地面结构，只给园区地面加纹理。
- **cyber（shader 失败降级）**：shader 编译失败 / uniform 绑定异常时（`transparent:true` + 失败 = 地面凭空消失、整屏黑），**必须降级**为不透明纯色 + 网格 `CanvasTexture`。包一层 try/catch 检测 `material.userData.shaderFailed`。why：地面是数字孪生的「地基」，宁可丢霓虹辉光也不能丢地面。

## 4. 按类别上色的楼栋（所有风格共用——颜色来自 token；材质按风格替换）

**两阶段构建**（见 §12）：① 静态脚手架阶段（同步）按 `spec.buildings[]` 的**占地几何**画低**占地底板**占位（高 ~2 单位），类别色已定，**不读 name/floors**（动态数据）；② 水合阶段（`getBuildings()` 返回后 `scene.hydrateBuildings(items)`）按返回的 `floors × floorHeight` 挤出为完整盒体、楼顶标签用返回的 `name`、楼层拾取板按返回的 `floor_ids` 注册。

对每个 `BuildingSpec`，挤出一个盒体并按类别上色。**颜色所有风格一致**（token `category` 映射）；**材质按风格替换**（cyber 自发光 `MeshStandardMaterial`；holographic 半透体 + 自发光边；nebula 深空星空 + 虹彩辉光；isometric `flatShading` cel；realistic/night-realistic PBR）。幕墙纹理 + 楼层环线 + 屋顶轮廓已固化在 `park-scene.impl.ts` + `building-geometry.ts`，直接复用。

```ts
const CATEGORY_COLOR: Record<Category, number> = { building: 0x27a8ff, garage: 0x3df0c8 }  // 从 token 派生，绝不硬编码

for (const b of spec.buildings) {
  if (b.category === 'garage') { buildGarageEntrance(b); continue }   // 车库不挤出盒体 → §5
  const h = b.floors * floorHeight
  const geo = new THREE.BoxGeometry(b.w, h, b.d)
  const color = CATEGORY_COLOR[b.category]
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.6 })
  const mesh = new THREE.Mesh(geo, sideMaterials(b, color))
  mesh.position.set(b.x, h / 2, b.z)
  mesh.userData = { kind: 'building', buildingId: b.id }
  scene.add(mesh)
  addFloorDividers(mesh, b)   // 楼层横向虚线分隔（§4.1）
  addRoofOutline(mesh, b)     // 顶面 EdgesGeometry
  addRoofLabel(mesh, b.name)  // 楼顶常驻名称标签
}
```

### §4.1 楼层虚线分隔 + 贴砖两色交替

楼栋可读性 = 能数出层数 + 能看出每层贴砖拼花。两件事都在立面层面解决，不增加 spec 字段：

- **`addFloorDividers(mesh, b)`**：在每个楼层边界（`y = i * floorHeight`）画**贯穿四立面的横向虚线**（`LineSegments` + `LineDashedMaterial`，`computeLineDistances()`）。颜色取 token `building.dividerColor`。why：仅靠盒体边缘环线远看融成一片实心体；显式横向虚线在等轴视角下被楼面挂住，立刻读出层级。虚线（而非实线）与 `addRoofOutline` 的实线轮廓区分层级。
- **`makeFacadeTexture` 内的贴砖划分**：对每一层：① `roomCount = 1 + floor(seededRand(hash(b.id, floorIndex)) * 5)`（1–5 块，确定性伪随机）；② 把该层水平条带按 `roomCount` 等分，**相邻贴砖按序号 `i%2` 在 light/dark 两色间交替取色**（`category.building` 色 HSL 派生 `light = L + roomShade`、`dark = L − roomShade`，token `building.roomShade` cyber ~0.16）。why 两色交替而非线性梯度：线性梯度让相邻两块只差一个步长，远观糊成一片；**相邻两块永远一明一暗**才是「贴砖」应有的强对比拼花。③ 每两块贴砖之间画**高对比深色竖实线**分隔（token `building.dividerColor`，1–2px 实线，非虚线）。楼层边界留出与 `addFloorDividers` 重合的横向虚线带。why 用纹理而非 3D 子盒体：跨 6 风格统一、一栋楼一个材质性能可控、与既有幕墙画布天然吻合。

### 楼顶常驻名称标签

每栋 `building` 楼屋顶上方加一个**始终可见**的名称标签（数字孪生可读性关键——一眼认出哪栋是哪栋）。用 `THREE.Sprite` + `CanvasTexture`（圆角半透明底 + 描边 + 文字，Noto Sans SC）。

要点：
- **Sprite 而非 HTML**：楼名要随相机旋转/缩放保持在楼顶——Sprite 天然面向相机且跟随楼栋，比每帧 `project()` 的 HTML 叠加层便宜得多（几十栋楼每帧投影会卡）。
- **始终可见、不受选中影响**：选中高亮由**独立的选中层**（描边 + 4 立面半透明填充，配色按风格 token，按 buildingId + 楼层定位，见 §8.2 `setSelection`）表达，楼名标签独立。
- **对比度（§4.2）**：楼名标签配色固化为 token `ui.labelBg`/`ui.labelText`（6 风格各自校验过的高对比对）。旧式 `(void-bg, cyan-bright)` 在浅色风格两字色都偏亮、标签糊成黑块。
- **位置**：楼名标签 Sprite 的 y 必须是 **`h + 22`（屋顶上方）**——旧式 `h/2 + 22` 会把标签埋进塔体内部，高楼（h > 44）完全不可见。该 y 坐标只在 `building-geometry.ts` 定义（铁律）。
- **标签可见性总表**：

  | 对象 | 名称/文字 | 何时显示 | 形态 |
  |---|---|---|---|
  | 楼幢 | 楼顶名 | **常驻** | §4 Sprite |
  | 地下车库入口 | P 牌 | **常驻** | §5 Sprite |
  | 地面车位 | 每位 P | **常驻** | §10 Sprite |
  | POI | 类型图标 | 常驻（可悬停目标） | §11 Sprite |
  | POI | 显示名（label/tooltip.title） | **仅悬停/点击** | §11 HTML tooltip/卡片 |

  why 这张表：POI 名称是「按需查看」的细节，常驻会让画面被几十个文字 Sprite 堆满、与楼名重复堆叠。POI 的 Sprite **只画类型图标符号**，**绝不**把 label 文字画进 Sprite——显示名只能通过 HTML tooltip（悬停）与卡片（点击）出现。

楼层拾取板（`building-geometry.ts` 的 `buildBuilding` 已把每层 slab 注册进 `pickables[]`，`userData = { buildingId, floorIndex }`，用于射线投射）。

### §4.2 CanvasTexture 标签对比度（所有风格共用）

场景里所有用 `CanvasTexture` + `Sprite` 的标签（楼顶名/车库 P/车位 P/POI 图标）必须**前景与背景高对比可读**。规则：底色与字色分布在明度轴两端——**亮底配深字，暗底配亮字**，绝不把两个同偏亮或同偏暗的色配在一起。配色**不散落 hex**，每个标签读 token 的 `{ signBg, signFg }` 配对，统一走 `makeContrastLabelTexture(text, { bg, fg, stroke, radius })` 辅助函数（bg/fg 已由 token 保证高对比，函数只负责绘制）。每风格的底/字取向见 `references/styles.md`。

## 5. 车库入口标记 —— 半金字塔三角门 + P 牌（所有风格共用）

地下车库**不再**渲染成下沉盒体，也**不再**显示占用标牌/进度条。占用数字是运营态实时数据——留在后台/详情面板按需拉取，场景本体只表达「这里有一个地下车库入口」。

`buildGarageEntrance(b)` 构建纯 3D（非 HTML）：
- **半金字塔三角门**：在 `(b.x, b.z)` 用 `BufferGeometry` 拼出朝 `b.facing`（默认 `'S'`）开口的半金字塔——底面贴地（宽 `b.w` × 深 `b.d`），远端向地下收缩成脊线，造型即「车库入口雨棚/坡道」。4 三角面 + `EdgesGeometry` 描边。材质按风格取 token `category.garage` 色。
- **P 标识牌**：入口正上方 `Sprite`，走 §4.2 的 `makeContrastLabelTexture('P', { bg: garageEntrance.signBg, fg: garageEntrance.signFg })`，深底亮字/浅底深字，始终面向相机。
- **可点击**：入口网格（或不可见命中盒）push 进 `pickables[]`，`userData = { kind: 'building', buildingId: b.id }`，点击切换器聚焦「地下车库」标签，与楼栋同一套选中机制——只是不再有占用标牌弹出。

要点：
- **半金字塔而非盒体**：传达「向下进入地下」的语义。朝向 `facing` 让开口对准主要人流方向。
- **去占用显示**：`spec` 里**没有** `garage.capacity/empty/occupied`。占用数据由 `getPois()` 返回的 `parking` 类 POI 的 `occupancy` 字段提供（见 §11、§12），点击时随 tooltip 显示。不要塞回 3D 几何。

## 6. Legend 叠加（所有风格共用）

场景头里一行 HTML，每个 `spec.legend` 条目一个色块 + 标签（`e.color` 作 `background` + `box-shadow` 发光）。默认图例：楼幢（青色）、地下车库（薄荷绿）。必需，非可选。

## 7. 可选的赛博装饰（仅赛博风格）

时间允许 / 输入需要时添加：网络连线（`Line2` 把楼顶连到枢纽，青色低不透明度）、罗盘（左上角 `▲ N` + `◢ ISO 3D` 文字叠加）。纯属调味；用户想要更干净的场景就跳过。

## 8. 交互（所有风格共用）

指针模型（范式实现的指针绑定段）：无按键 pointermove → 对 `pickables[]` 悬停射线投射；pointerup（移动 <4px）→ 点击；委托给 `useSelection`（`assets/components/useSelection.ts`）。该 composable 持有 `focusedBuildingId`/`floorIndex`/`hoverBuildingId`；**有效**选中是 `hover ?? focused`，被 watch 并通过 `setSelection(bid, fin)` 推回场景（金色边线 + 该层半透明填充）。楼栋切换器和 3D 点击写入同一个 composable 保持同步。交互完整闭环：悬停某层 → 立即金色边框；点击某层 → 锁定（鼠标移开后金边保留）；点击空白 → `onDeselect → clearFocus`，金边消失、楼栋聚焦与相机回到全局。

> **务必照抄 §8.1 / §8.2 的契约与代码**。本节历史上有个隐蔽 bug：选中楼层后鼠标移开画布，金色边框就消失（应当保留）。根因是生成器「临场发挥」了点击接线——在楼层点击里除 `onSelect` 又追加 `onFocus`（→ `focusBuilding` 清空 `floorIndex`）。照抄下方契约即可避免。

### §8.1 选中态契约（`useSelection`）—— 单一数据源

选中态是「悬停预览 + 已锁定楼层」的合成，由一个 `watch` 推回场景画金色高亮。整套机制强依赖一条铁律：

> **楼层点击必须一次性写入「楼 + 层」（`selectFloor`），点击之后绝不能再有任何调用改写/清空 `floorIndex`。**

否则鼠标移开（悬停清空）后，有效选中回落到「楼 + null」，`setSelection(bid, null)` 命中 `fin==null` 分支隐藏金色高亮——表现为「选中后鼠标移开金边消失」（见本节末反面模式）。

> **铁律只约束「命中楼栋」的点击分支**。它禁止在 `onSelect`（命中楼栋）之后再追加 `onFocus`/`focusBuilding` 去 `floorIndex=null`。它**不禁止**「点空白取消选中」：`onPointerUp` 未命中任何楼栋/POI 时，走 `onDeselect → clearFocus` 是独立、必需的取消入口——用户显式「点空白取消一切」的语义。区分清楚两条路径：命中楼栋 → `selectFloor`（锁定，不清空）；命中空白 → `clearFocus`（全清回全局）。

`useSelection.ts` 关键接口（完整实现拷贝 `assets/components/useSelection.ts`）：

```ts
const effBuildingId = computed(() => hoverBuildingId.value ?? focusedBuildingId.value)
const effFloorIndex = computed(() => hoverFloorIndex.value ?? floorIndex.value)

function selectFloor(b, f) { focusedBuildingId.value = b; floorIndex.value = f }  // 楼层点击专用：原子写入（铁律所在）
function focusBuilding(b) { focusedBuildingId.value = b; floorIndex.value = null } // 仅切换器标签页用；⛔ 绝不在楼层点击里调用
function clearFocus() { /* 全清回全局 */ }
function setHover(b, f) { hoverBuildingId.value = b; hoverFloorIndex.value = f }   // 只写 hover*，不动 focused/floor
```

各 writer 语义：`selectFloor`（楼层点击，楼+层原子写入，也是相机聚焦触发源）；`focusBuilding`（切换器标签页，聚焦整楼重置楼层，与楼层点击互斥）；`clearFocus`（切回全局）；`setHover`（悬停，只写 hover*）。

### §8.2 点击 / 悬停处理（ParkScene 指针回调 + GlobalTwin watch 接线）

**ParkScene 侧**：楼层点击只调 `onSelect`，**不要**再追加 `onFocus`/`focusBuilding`。相机聚焦不靠点击回调，靠 GlobalTwin 的 `watch(focusedBuildingId)`。

```ts
private onPointerUp = (e: PointerEvent) => {
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
  if (moved > 4) return                                  // 拖拽不触发点击
  const poiId = this.pickPoi()
  if (poiId) { this.openPoi(poiId); return }             // POI 优先，命中则不触楼栋
  const b = this.pickBuilding()
  if (b) {
    this.cb.onSelect?.(b.bid, b.fin)                     // 命中楼栋/楼层：楼+层由 selectFloor 一次性写入
    // ⛔ 不要 this.cb.onFocus?.(b.bid) —— 相机聚焦已由 watch(focusedBuildingId) 驱动
  } else {
    this.cb.onDeselect?.()                               // 点空白/非楼栋物体 → clearFocus 取消选中回全局
  }
}
```

`ParkScene` 只暴露 `focusBuilding(id)`（相机补间）与 `setSelection(bid, fin)`（定位选中层 overlay）两个命令式方法；**它不持有选中态**，选中态在 composable 里，由 watch 单向推回场景。

> **选中层 = 描边 + 4 立面填充**：`setSelection` 把选中楼层定位到两层 overlay——① 描边 `selectionOverlay`（`EdgesGeometry` 线框，`opacity:1.0`）+ ② 填充 `selectionFill`（`BoxGeometry` 仅渲染 4 个立面，顶/底 `visible:false` 跳过；半透明、`depthTest:false`、`renderOrder:-1`）。配色**按风格**走 token `ui.selectionBorder`/`selectionFill`/`selectionFillOpacity`，`updateSelectionColors()` 在 `applyProfile()` 读取；缺省回退常量。取消选中（`fin==null`）两层一并隐藏。

**GlobalTwin.vue 侧**：指针回调只把命中结果写进 composable；相机聚焦与金色高亮**全部由响应式 `watch` 驱动**（单一数据源，不要在回调里直接操作场景 overlay）：

```ts
const scene = new ParkScene(canvas, scaffold, style, {
  onHover: (bid, fin) => sel.setHover(bid, fin),
  onSelect: (bid, fin) => sel.selectFloor(bid, fin),
  onDeselect: () => sel.clearFocus(),
  // ⛔ 不要 onFocus 回调。切换器标签页由 BuildingSwitcher 直接调 sel.focusBuilding()
})
watch(() => sel.focusedBuildingId.value, (id) => scene.focusBuilding(id))           // 相机聚焦
watch(() => [sel.effBuildingId.value, sel.effFloorIndex.value] as const,
      ([bid, fin]) => scene.setSelection(bid, fin))                                  // 金色高亮（悬停 ?? 已选）
```

> **反面模式（即本节修复的 bug）**：楼层点击同时调 `onSelect`（→ `selectFloor` 写 `floorIndex=fin`）和 `onFocus`（→ `focusBuilding` 写 `floorIndex=null`）。点击瞬间 `floorIndex` 被清成 null；悬停时 `eff = hover` 掩盖（金边还在），但鼠标移开 `eff` 回落到 `(bid, null)`，`setSelection(bid, null)` 隐藏 overlay。修复：楼层点击只调 `onSelect`；相机聚焦交给 `watch(focusedBuildingId)`。

**POI 拾取**：在楼栋 raycast **之后**对独立的 `poiPickables[]` 再做一次 raycast。命中 POI 时**优先**处理——弹出/高亮 tooltip，并 `return` 不再触发楼栋聚焦。POI 标记永远不混入楼栋 `pickables[]`。

相机**聚焦补间**（⚠️ 必须是「事件触发 + 有限时长」过渡，**不能**在 animate 里无条件每帧 lerp）：
- **触发**：仅当 `focusedBuildingId` 改变时启动一次 tween，记录起始/目标 `controls.target` 与 `camera.zoom`。
- **过渡期间**（~0.6s `easeOutCubic`）：animate 里 lerp target 与 zoom；过渡结束后置 `tweening=false`，**不再每帧触碰 `camera.zoom`/`controls.target`**。
- **滚轮缩放所有权（关键）**：`OrthographicCamera` 下 `OrbitControls` 滚轮缩放改 `camera.zoom`。过渡结束后必须把缩放/平移/旋转完整交还 `OrbitControls`——否则用户滚轮改的 zoom 会被「每帧 lerp 回 targetZoom」抹掉（表现为「滚轮缩放失效」）。
- **反面模式（勿抄）**：`camera.zoom += (targetZoom - camera.zoom) * 0.1` 写进 animate 每帧无条件执行——会拽回用户滚轮缩放与 pan。
- 范式实现的 `focusBuilding`/`positionAndFrame` 已是「事件触发 + 有限时长 tween」，直接复用。

> **§13 航拍巡航**是另一类「事件触发 + 有限时长」相机动画（进/出取景过渡 tween + `autoRotate` 稳态环绕），遵守同一「释放控制权」铁律。相机动画只有这两种合规形态——focus tween（§8）与 tour tween（§13）；任何「每帧无条件 lerp」都是反面模式。

## 9. 生命周期（所有风格共用）

- canvas 上的 `ResizeObserver` → 更新渲染器、composer、宽高比、视锥、每个 `LineMaterial.resolution`。**resize 回调防抖 150ms**。
- **WebGL 上下文丢失/恢复**：canvas 监听 `webglcontextlost`（`e.preventDefault()` + 停 RAF + `contextLost=true` + 显式遮罩）与 `webglcontextrestored`（重建依赖 GPU 资源的对象 + 重启 RAF + `frameCamera()`）。不要在 contextlost 后继续渲染——会抛异常。
- **`dispose()` 完整清单**（范式实现已落地）：① `cancelAnimationFrame`；② `ResizeObserver.disconnect()`；③ `OrbitControls.dispose()`；④ 移除所有 `canvas.addEventListener`；⑤ 遍历 `sceneGroup` 递归 `geometry.dispose()` + `material.dispose()`，并 dispose 材质的 map/emissiveMap/envMap/renderTarget 纹理；⑥ composer 启用时 dispose 其 renderTargets 与各 pass；⑦ `renderer.dispose()` + `forceContextLoss()`。
- **保持一个长生命周期实例**：不要在每次标签页往返时重建 `ParkScene`（会丢弃 WebGL 状态）。用带命令式 API 的单例，让 `<canvas>` 撑过标签页切换；`GlobalTwin.vue` 只在真正的 mount/unmount 时创建/销毁。

## 10. 园区环境（道路 / 地面车位 / 绿化 / 周边道路 / 氛围）—— 所有风格共用

一份完整的数字孪生全景应当嵌在城市环境里。所有元素**完全由 `spec.environment` 驱动**，字段缺失时用**智能默认**生成一套合理园区——绝不硬编码具体内容。

调用顺序：先建外圈城市地面（§3 末尾），再依次 `buildInternalRoads → buildSurfaceParking → buildGreenery → buildSurrounding → buildAmbiance → buildPOIs`（§11），全部挂到同一个 `sceneGroup`。所有颜色取所选风格 token 的 `environment`/`poi` 子对象，不散落 hex。

### buildInternalRoads(env)
在 `boundary` 内、楼栋间隙画园区内部道路。形状由 `env.internalRoads` 决定（默认 `'loop'` 环形）：`loop`（沿 boundary 内侧绕一圈）、`cross`（十字主干）、`grid`（井字网格）、`none`（跳过）。材质：沥青色 `MeshBasicMaterial`（isometric 用哑光 `MeshStandardMaterial`），`rotation.x=-π/2`、Y 略高于地面。车道虚线用 `Line2`/`LineSegments`。**不进 `pickables[]`**。

### buildSurfaceParking(env)
若 `env.surfaceParking` 非 null，在内部道路某一侧铺一排**长方形地面车位**（真实车位语义）。`stalls` 缺省时按楼栋规模推算（如 `sum(floors) * 6`）。每个车位表达为「**长方形铺装 + 描边 + 中央印 P**」：
- **车位几何**：贴地长方形（~12×24 世界单位），底=扁平 `PlaneGeometry`（`surfaceParking.stallFill`），外框=`EdgesGeometry`（`stallLine`）。
- **逐位印 P**：每个车位中心放小 `Sprite`，走 §4.2 的 `makeContrastLabelTexture('P', { bg: pMarkBg ?? stallFill, fg: pMark })`。
- **示意停放车辆**：默认 `round(stalls * 0.3)` 个车位放低多边形汽车代理体（车身 `BoxGeometry` + 车顶 + 4 轮），车身色取 `surfaceParking.car`。哪些车位放车由 `occupied` 决定（给了放前 occupied 个，没给按 30% 默认）。
- **不进 `pickables[]`**。

### buildGreenery(env)
- **草地色块**：楼栋之间、道路两侧低 `PlaneGeometry`，颜色取 `environment.grass`。
- **行道树**：沿内部道路与外围人行道按密度（sparse/normal/lush）种树。每棵=树干 `CylinderGeometry`（`treeTrunk`）+ 树冠（`treeCanopy`）。树冠双形态：球形（`IcosahedronGeometry`）与锥形（`ConeGeometry`）按位置序奇偶交替，两个 `InstancedMesh` 合批。
- **灌木球丛**：每块草地边缘 6 丛（`SphereGeometry`，种子确定性偏移），一个 `InstancedMesh` 合批。
- `centralPlaza`（默认 true）：园区中心铺装广场。
- `waterFeature`（默认 false）：`CircleGeometry(50)` 水面 + `RingGeometry(50,56)` 池缘，写实两风格吃 envMap 反射、其余用半透明 Lambert/Basic。**不进 `pickables[]`**。

### buildRoadMarkings(env)
内部道路标线（色取 `environment.roadMarking`）：中央虚线（环路 + 主路，两个 `InstancedMesh` 横/纵合批）、大门引道（连接主出入口与环路）、斑马线（引道上 6 条白杠）、引导箭头（`ShapeGeometry` 直行箭头）。`surrounding.gate===false` 时引道/斑马线/箭头跳过；`internalRoads==='none'` 时整段跳过。

### buildSurrounding(env)
把园区嵌进城市路网（默认 `roads/sidewalk/gate` 全 true）：市政道路（boundary 外侧四面双向道路，中央黄线 `Line2`）、人行道（园区边沿窄铺装带）、主出入口闸机（朝南正中开口 + 两侧闸机柱）。**不进 `pickables[]`**。

### buildAmbiance(env)
氛围细节（默认 `streetLamps/vehicles` true；`groundGlow` 仅 cyber 默认 true）：街灯（杆 `CylinderGeometry` + 灯头 `SphereGeometry`，`night-realistic` 挂暖琥珀 `PointLight`、其余风格仅自发光灯头）、地面发光标线（仅 cyber，`Line2` 自发光勾边）、车辆/行人代理体（周边道路与地面车位零星几辆低多边形车）。**不进 `pickables[]`**。

### 性能预算（硬约束）
环境网格（树/车/灯/草块）**总数建议 ≤ 460**，超出时优先降密度，其次把同类元素改用 `THREE.InstancedMesh` 合批。**InstancedMesh 为强制**（同类几何 ≥ ~10 个时）：行道树（树干 + 球形/锥形树冠三个 InstancedMesh 承载数百棵）、灌木球丛、地面标线虚线、楼顶设备（每园 ≤5 栋 ≈ +20）、车辆代理体（所有车共用一个车身 InstancedMesh）。所有环境元素**不参与 floor raycast pick**（不要 push 进 `pickables[]`）。

## 11. 兴趣点（POI）—— 类型化标记 + tooltip/popup（所有风格共用）

**POI 是动态数据**。`buildPOIs` 不在静态脚手架阶段按 `spec.pois` 建好，而是改在**水合阶段**由 `scene.hydratePois(items)` 按 `getPois()` 返回的 `PoiRuntimeItem[]` 构建（坐标/类型/tooltip 来自 API，新增 `status` 驱动颜色/动画、`occupancy` 给停车场 POI）。`spec.pois` 仅作为生成 Mock 数据的种子。下文标记几何/tooltip 机制不变——只是数据源从静态 spec 改为运行期 API。

### buildPOIs(pois)
对每个 POI 在 `(x, y ?? 0, z)` 放**类型化标记**：
- **杆**：细 `CylinderGeometry`（深灰，半径 ~1.5，高 ~30），底端锚定。`buildingId`+`floorIndex` 给定时锚到该楼该层高度做室内点位；否则锚地面。
- **图标**：顶部 `Sprite`，CanvasTexture 按 `type` 画图标符号。遵守 §4.2 对比规则——给图标加高对比底，符号用 `poi.<type>` 色。类型→符号映射：entrance/exit 箭头、camera 摄像机、gate 闸机、service 信息点、landmark 星标、parking「P」、custom 圆点。
- 每个标记命中盒 push 进**独立的 `poiPickables[]`**（`userData = { kind: 'poi', poiId }`），与楼栋 `pickables[]` 分开。

### Tooltip / popup（HTML 叠加层）
`buildPOIs` 不自己画 HTML，而是把 POI 列表交给 Vue 组件（`PoiOverlay.vue`），由它：
- 每帧把当前打开的 POI 世界坐标 `Vector3.project(camera)` 投到屏幕定位弹出卡（只投影**当前打开的那一个**，不是全部——几十个 POI 每帧全投影会卡）。
- **悬停**：高亮标记 + 显示 `tooltip.title ?? label`（轻量 HTML 名称条，由 `ParkSceneCallbacks.onPoiHover` 驱动）。
- **点击**：展开完整卡片——`tooltip.title ?? label` 作标题、`description` 作正文、`meta` 渲染成键值表。`room_spec` 优先渲染（部门/职责/面积/容纳）。无 `tooltip` 字段的 POI 点击仅显示 `label`。

> **POI 单开契约**：`useSelection` 有 `openPoiId: Ref<string | null>`（与楼栋 `focusedBuildingId` 平行）。同一时刻**至多一个 POI 打开**——点新 POI 覆盖旧的，点空白/Esc/再点同 POI 关闭。POI 打开与楼栋聚焦**互斥**：点 POI 不聚焦楼栋（§8 POI 拾取优先 + return），点楼栋不关 POI。打开 POI 卡片时 `aria-live="polite"` 播报、焦点移入、Esc 关闭并归还焦点（见 `shell.md`）。

要点：
- **类型驱动图标/颜色**：让「监控」「闸机」「出入口」一眼可辨。颜色全从 token `poi.*` 派生。
- **名称仅悬停（契约级）**：POI 的 Sprite **只渲染类型图标符号**，**绝不**把 label 文字画进 Sprite——显示名只能通过 HTML tooltip（悬停）与卡片（点击）出现。
- **只投影当前打开的 POI**：性能关键。
- **POI 与楼栋选中隔离**：点 POI 不应聚焦楼栋。
- **性能预算**：POI 总数建议 ≤ 200；杆/图标用 `InstancedMesh` 或共享几何 + 共享材质（按 type 分组）合批。

## 12. 动态数据接入与水合（所有风格共用）

页面数据分两层（基础信息静态内联、动态数据走 `IDigitalTwinApi`）。**契约层完整规范见 `references/dynamic-data-api.md`**——本节只讲场景侧「脚手架先行再水合」接线。

`ParkScene`（§9 单例）除构造期建静态脚手架外，暴露水合方法，由 `GlobalTwin.vue` 调用：

```ts
class ParkScene {
  constructor(canvas, scaffold: ParkScaffold) { /* 同步：静态脚手架——环境(§10) + 楼栋占地底板(§4) + Legend(§6) + 取景(§2) */ }
  hydrateBuildings(items: BuildingRuntimeItem[]): void   // 按 floors 挤出 + 楼顶 name 标签 + 注册 floor_ids 拾取板
  hydratePois(items: PoiRuntimeItem[]): void              // 按 PoiRuntimeItem[] 建标记(§11)，status 驱动颜色，parking 挂 occupancy
  getFloorId(buildingId, floorIndex): string | undefined  // 查水合时注册的 floor_id（点击楼层 → getFloorDetail 用）
  focusBuilding(id): void   setSelection(bid, fin): void   dispose(): void
}
```

`ParkScaffold`（构造参数）= 从 spec 派生的**静态**数据：`buildings[].id/w/d/x/z/category/facing`、`environment`、`tokens`、`boundary`、`floorHeight`、`stage`、`cameraTour`、`corridor`、`garages`。**不含** name/floors/pois。

加载时序见 `dynamic-data-api.md §2`。关键约束：
- **相机取景只用静态几何**：`Hmax` 用 spec 最高楼估算，**不等** `getBuildings()`——否则水合前白屏。
- **水合前楼栋以占地底板占位**；`dispose()` 要清掉水合阶段建的网格。
- **loading/空/错误三态兜底**。
- **POI 状态色**：图标底色取 `poi[type]`，光晕/动画色取 `poi.status[status]`；缺省回退 `online`。
- **车库占用**：点击 `parking` 类 POI 时 tooltip 显示 `occupancy.empty/capacity`（来自 `getPois()`，无静态占用数据）。

## 13. 航拍巡航（cameraTour）—— auto-orbit 展示（所有风格共用）

`spec.cameraTour` 可选（缺省即智能默认）。开启后相机过渡到鸟瞰取景，再沿园区缓慢自动环绕——一份「会动的数字孪生」用于展示/汇报首屏。机制 = **取景过渡 tween（进/出）+ `OrbitControls.autoRotate` 稳态环绕**：
1. **进入**（点 `TourToggleButton` / `enabled:true` 首屏自动）：frameTween 把取景从默认（K=0.66、等轴俯角）过渡到巡航（K=`framingK`≈0.55、`elevation`≈1.0 鸟瞰，~0.6s `easeOutCubic`）；过渡结束置 `controls.autoRotate=true`、`autoRotateSpeed=speed`。
2. **稳态环绕**：`animate()` 每帧已调 `controls.update()`——autoRotate 绕 target 缓慢转方位角，俯角/取景不变。
3. **退出**（再点按钮 / 用户拖拽 / 卸载）：`autoRotate=false` + frameTween 过渡回默认取景。

命令式 API：`ParkScene.setTourEnabled(on: boolean)`（reducedMotion 下 no-op）。`ParkSceneCallbacks` 新增 `onTourAutoExit?: () => void`——巡航中用户拖拽时回调（`GlobalTwin` 映射到 `useTour.disable()`，由 `watch(enabled → setTourEnabled)` 单向完成收尾，不在指针回调里直接改引擎态，与 §8 选中态 watch 推回同模式）。

**取景内核复用**：`frameCamera()` 的取景数学抽成 `positionAndFrame(K, elevation, az)`——`frameCamera()` = `positionAndFrame(0.66, atan(1/√2), π/4)`（行为不变）；巡航过渡调用 `positionAndFrame(tweenedK, clampElevation(tweenedElev), currentAzimuth())`。**方位角取当前**——过渡期不强行扳回，退出时朝向连续不突兀。

**纪律（与 §8 focus tween 同源）**：
- **事件触发 + 有限时长**：frameTween 结束后**不**每帧碰 `camera.zoom/target/K`；autoRotate 由 `OrbitControls` 内部管理，缩放/平移仍归用户。
- **用户拖拽即退出**（`pauseOnInteract` 默认 true）：`onPointerDown` 命中且巡航中 → 立即 `autoRotate=false` + `onTourAutoExit`。**滚轮缩放不退出**。
- **反面模式（勿抄）**：在 `animate` 里无条件每帧 `controls.target.lerp(centroid, 0.1)` 或每帧重设 `camera.zoom`。
- **`prefers-reduced-motion` 禁用**：`setTourEnabled(true)` 为 no-op，按钮 `aria-disabled`。

配置：`spec.cameraTour { enabled, speed, elevation, framingK, pauseOnInteract }`（全可选，见 `park-spec.md`「相机巡航」）。归属**基础信息（静态）**——`generate_data.py` 写进 `ParkScaffold.cameraTour`，`enabled:true` 时 `GlobalTwin` onMounted 调 `tour.enable()`。组件（`useTour.ts` / `TourToggleButton.vue` / `GlobalTwin.vue` 接线）见 `shell.md`。

## 14. 地下场景（地下车库多层剖面）—— Y<0 透明玻璃柱坑体

`spec.garages[]`（每个条目=一个负层坑体，`level: -1` B1、`-2` B2…）渲染为 **Y=0 之下的透明玻璃柱**。设计取舍：**地面不开洞**——楼栋不悬空，坑体从侧面透过 4 面半透明玻璃壁 + 半透明自发光底板透视内部的车位网格 + 车辆 + 功能房间线框 + 出入口坡道 + 层标牌。这比「地面挖洞」简单稳健（无裁剪/模板），且楼上视角下坑体被不透明地面自然遮挡、不干扰全景。相机可自由俯仰到地面之下仰视（`MAX_POLAR=π-0.1`）：从下方看时 Y=0 不透明地面因 BackSide culling 自然消失、坑体可净看入。

**`usage` 区分用途**：缺省 `'parking'`（下述车位网格 + 车辆 + GarageCard 占用）；`'mall'`/`'subway'`/`'shelter'`/`'workshop'`/`'custom'` 等非车库用途**跳过车位网格与车辆**，坑体改显功能房间（spec `rooms[]`）+ 层标牌——可表达地下商场/地铁通道/人防工程/地下车间。`buildUndergroundGarage` 用 `if (cols && rows)` 守卫车位块；`GarageCard` 据 `capacity` 是否存在分支：parking 显占用率、非 parking 显用途 + 功能间数。

与 §5 的区别：§5 `buildGarageEntrance` 是 **Y=0 之上的地面入口标记**（半金字塔 + P 牌，无体积）；§14 是**真正的地下剖面几何**。二者独立——可只用地面试标记、可只用地下坑体、也可共存。

### §14.1 几何装配（`building-geometry.ts::buildUndergroundGarage`，所有 y 坐标单一事实来源）

`rebuildScene()` 在 `buildGround()` 后调 `buildUnderground()`：按 `level` 升序（B1 先于 B2）逐层调用 `buildUndergroundGarage`，每层 `ceilY = 上一层 deckY`（B1 的 ceilY=0）→ 4 面玻璃壁拼成**连续竖井**，各层底板处画虚线层分隔。单层装配（所有 y 只在此定义）：
- **底板** `PlaneGeometry(w,d)` 平铺，`y = deckY - 0.1`，半透明自发光。
- **4 面玻璃壁** `quadMesh`（4 角点双面四边形）从 `ceilY` 到 `deckY`，半透明（opacity 走 token `underground.wallOpacity`）。
- **层分隔虚线** 壁顶四边 `LineDashedMaterial`（`underground.edge`）；顶层额外画 4 条垂直角线示深度。
- **车位网格** `cols×rows`（仅 `usage='parking'`），所有车位的 L 形描线批量合并为单个 `LineSegments`（`underground.spot`，每车位 3 段 U 形），整体 `y = deckY + 0.05`（取代每格一个 `Line`，数百车位 → 1 次绘制调用）；确定性铺车（`mulberry32(hashStr('garage:'+id))`，~45% 占用），自动避让房间/坡道。
- **功能房间** `EdgesGeometry(BoxGeometry)` 线框盒（`underground.room`），`y ∈ [deckY, deckY+roomH]`；parking 缺省 8 间沿边界内侧，spec `rooms[]` 可覆盖；**非 parking 时为主内容**，无 rooms 则不画。
- **坡道** `buildGarageRamp`：斜坡面 + 中央虚线 + 地面端 2 立柱门洞 + 标牌；入口在西、出口在东，从 `deckY` 斜上到 `ceilY`，天然泛化多层。
- **层标牌** `Sprite`，`y = deckY + 28`，`depthTest:true`（地上视角被地面遮挡不穿地乱显，地下坑内可读）。
- **不可见拾取盒** `BoxGeometry(w, ceilY-deckY, d)` `visible:false`，`userData={kind:'garage',garageId}`，push 进 `garagePickables`。

材质由 `ParkScene.undergroundMaterials()` 按 `profile.building` 分支构造（flat / pbr / emissive，pbr-night 与 holo 经 emissiveIntensity 区分）。颜色全走 `underground` token 块（6 风格各配），禁手写 hex。

### §14.2 地下视角相机（`ParkScene.setBelowView`）

切换器「地下车库」标签 → `useSelection.enterBelowView()` → `GlobalTwin watch(belowView) → scene.setBelowView(on)`。复用 §8/§13「事件触发 + 有限时长 + 结束释放 OrbitControls」纪律：
- **on**：记当前相机位为锚点；取消进行中的 focus/frame tween + 关 autoRotate（互斥）；`controls.enabled=false`；`maxPolarAngle` 沿用 `MAX_POLAR=π-0.1`；设 `sideCamPos/sideTarget` = 坑体中心 `(g.x, -deck_y/2, g.z)` 南侧水平直视，`belowZoom` 按坑宽算。**设的是 position/target/zoom 非 polar，故正交/透视相机都适用。**
- **补间**在 `animate()` 里 `belowBlend` lerp（0.1 阻尼）相机 position/target/zoom 在「锚点 ↔ 坑中平视」之间过渡；完成 `controls.enabled=true`。
- **取景守卫**：`belowView` 时 `frameCamera()` 早 return（hydrate/resize/setStyle 不把相机回拽到地面）。
- **拾取门控**：`belowView` 时 `onPointerMove/Up` 只测 `garagePickables`（`pickGarage`），命中 → `onGarageSelect(id)` → `selectGarage`（出 `GarageCard`）；点空白 → `onGarageSelect(null)` 仅清卡片、留地下视角。

### §14.3 组件（详见 shell.md）

`useSelection.ts`：新增 `belowView`（驱动相机）+ `selectedGarageId`（驱动卡片）+ `enterBelowView/selectGarage`（退出地下由 `clearFocus` 的退地下分支承担、`selectGarage(null)` 仅清卡片留地下视角）；与楼上楼栋/楼层/POI 互斥。`BuildingSwitcher.vue`：有 `garages[]` 时追加「地下车库」标签 → `enterBelowView`。`GarageCard.vue`：地下选中时浮出（右下），展示容量/已占用/空余/占用率；Esc/× → `selectGarage(null)`。`GlobalTwin.vue`：`onGarageSelect → selectGarage` + `watch(belowView → setBelowView)`。

## 验证

生成后，`npm run dev`（端口 3000）并确认（条件子清单见 SKILL.md「验证」段 + `shell.md`）：

- [ ] **场景不死黑**：6 种风格首屏都有可辨识的 `scene.background`（暗色风格为顶→底渐变、非纯黑）；未受光区域不再是纯黑（`ambientFloor` 生效）。
- [ ] **写实增强层**：`realistic`/`night-realistic` 启用 env/AO（night-realistic 另开反射/雾），其余 4 风格守纪律不启用；`EffectComposer`+`UnrealBloomPass` 已实例化（cyber/holographic/nebula 亮部有溢光）；isometric 不挂 bloom。
- [ ] **轮廓对齐**：楼栋几何装配走 `building-geometry.ts` 的 `buildBuilding()`（不在 ParkScene 里手写 `position.y`）；金色楼层高亮对齐楼层 slab、不偏移。
- [ ] **地面有纹理**：cyber 显示着色器网格；holographic/nebula 显示点阵；isometric 显示细网格——没有一种风格是「纯色色片」。破坏 cyber shader 引用后地面降级为带网格纹理的纯色平面（不消失）。
- [ ] 楼栋按类别上色，与 Legend 一致；每栋楼顶常驻名称标签；立面有楼层虚线分隔 + 贴砖（相邻两块深浅交替）；同一 spec 重复生成一致。
- [ ] 所有标签（楼名/车库 P/车位 P/POI 图标）高对比可读。
- [ ] 车库渲染为半金字塔三角门入口 + P 牌，**无**占用标牌/进度条/车位数。
- [ ] **地下场景**：含 `garages[]` 时点「地下车库」标签 → 相机俯冲到坑体南侧水平直视；坑体为 Y<0 透明玻璃柱，可见车位网格 + 车辆 + 功能房间线框 + 坡道 + 层标牌；多层 B1+B2 堆叠、层分隔虚线清晰；点坑体浮出 `GarageCard`，Esc/× 关卡片留地下视角；无 `garages[]` 时无地下标签、无回归。
- [ ] 地面车位为长方形车位 + 每位印 P + ~30% 示意车辆，**无**正方形框、**无**区域 P 牌。
- [ ] POI 标记按类型上色，悬停高亮、点击弹 tooltip；POI Sprite 只显示类型图标、**默认无文字名称**（名称仅悬停/点击）；点 POI 不误触楼栋聚焦。
- [ ] 楼层选中闭环：悬停金边、点击锁定（鼠标移开保留）、点空白取消回全局。
- [ ] 滚轮可缩放、右键平移、左键旋转，松手后视角保持；聚焦为有限时长过渡、结束后不抢占滚轮。
- [ ] resize 后场景保持正确缩放；取景贴合（K=0.66，四周可见周边环境，下方无大片空白）。
- [ ] 园区环境完整（内部道路、地面车位带、行道树/绿地、四向市政道路、出入口、路灯）。
- [ ] 动态数据水合：`VITE_MOCK_ENABLED=true` 首屏先出脚手架再水合；切 `false` 后请求落到 `/api/manager/park/*`；失败时脚手架仍可交互。
- [ ] 航拍巡航（`spec.cameraTour` 提供时）：点按钮相机过渡到鸟瞰并自动环绕；巡航中滚轮可缩放、拖拽即退出；`enabled:true` 首屏自动开；reducedMotion 下禁用。
- [ ] `npm run typecheck` 干净通过。
