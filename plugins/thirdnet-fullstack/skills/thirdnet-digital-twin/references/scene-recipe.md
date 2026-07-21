# 场景配方（Scene Recipe）—— Three.js 数字孪生

> **v2.0 重要变更**：本技能现随包发布完整范式实现 [`assets/park-scene.impl.ts`](../assets/park-scene.impl.ts)（导读见 [`park-scene-impl.md`](park-scene-impl.md)）。**生成器以该实现为基线「拷贝-改」产出 `src/scene/ParkScene.ts`，不再从下文散文合成渲染管线**——v1.x 实测散文合成会让 LLM 漂移（丢掉环境贴图 / bloom / `ambientFloor` / `scene.background` 渐变 / 程序化地面纹理）。下文仍是「为什么这么设计」的设计原理与逐风格材质/灯光规范（是 single source of truth for *intent*），但落地代码以范式实现为准；冲突时回填到本文件。

这是中央 3D 场景的核心构建配方。下文 §2–§3 是**赛博风格**的详细配方（`blueprint` 风格**同样接入** §3 的网格着色器地面，仅 uniform 调色不同），§4–§10（按类别上色、车库标牌、Legend、交互/选中、生命周期、园区环境）是**所有风格共用**的部分。**渲染器/灯光/材质/地面若选用其它风格**（真实物体 / 夜间写实 / 全息 / 白模 / 等距插画），见 `references/styles.md`——除 `cyber`/`blueprint` 外的风格跳过 §3（网格着色器地面），按 `styles.md` 的 PBR/扁平/半透/flatShading 材质与灯光构建，但 §4–§9 照常适用。

赛博规范的核心：把 `grid.glsl` 接为着色器地面（现有 `src/scene/DigitalTwin.ts` 文档里写了但从未导入的一块），按类别给楼栋上色，把车库渲染成一栋带占用标牌的楼，并显示 Legend。

现有的 `DigitalTwin.ts`（约 1.5k 行）是绝佳的 Three.js 模式参考——拷贝它的正交相机、射线拾取、聚焦补间、程序化幕墙纹理和完整的 `dispose()` 路径。相比该文件要**改动**的（赛博风格下）：丢掉夜间写实倾向（重 IBL/PMREM、VSM 阴影、沥青纹理），加入网格着色器地面，按类别上色，加车库楼 + 标牌，加 Legend 叠加。（若用户选了真实物体/夜间写实风格，反而要**保留并增强** PBR/PMREM/阴影——见 `references/styles.md`。）

下文的行号范围指范例仓库（`references/exemplar.md`）中的 `src/scene/DigitalTwin.ts`。

## 目录（v1.8）—— 为 X 读 §Y

| 你要做的事 | 读哪节 |
|---|---|
| 文件布局 / WebGL2 能力检测 | §1 |
| 渲染器 / 相机取景 / 灯光（赛博） | §2 |
| 网格着色器地面（cyber/blueprint） | §3 |
| 按类别上色楼栋 / 楼层虚线 + 贴砖 / 楼顶标签 / §4.2 标签对比 | §4 |
| 车库入口半金字塔 + P 牌 | §5 |
| Legend 叠加 | §6 |
| 可选赛博装饰 | §7 |
| 交互 / 选中态机 / 聚焦补间（铁律 + 反面模式） | §8 |
| 生命周期 / WebGL context loss / dispose 清单 | §9 |
| 园区环境（道路/车位/绿化/周边/氛围）/ 性能预算 | §10 |
| POI 标记 + tooltip / openPoiId 单开契约 | §11 |
| 动态数据水合 API / 加载时序 | §12 |
| 各风格渲染器/灯光/材质/地面分支 | `references/styles.md` |
| 契约层 5 文件 / Mock/Real / 后端端点 | `references/dynamic-data-api.md` |
| 舞台外壳 / 响应式 / a11y / 空错态 | `references/shell.md` |

## 1. 文件布局

```
src/
  scene/
    ParkScene.ts          ← 新的赛博场景类（单例；见 §9、§12 水合 API）
    shaders/
      gridGround.glsl     ← 从技能 assets/ 拷贝（UV 适配的网格）
  data/
    <park>.ts             ← 从 Park Spec 生成（v1.5：仅静态脚手架——楼栋占地几何 + 环境驱动；不含 name/floors/POI）
  composables/
    useSelection.ts       ← 从范例拷贝；跨组件选中单例
  components/center/
    GlobalTwin.vue        ← 挂载 <canvas>，实例化 ParkScene；onMounted 拉动态数据并水合（见 §12）
  config/index.ts         ← MOCK_ENABLED、API_BASE_URL（自适应宿主；独立项目生成，admin 模板复用）
  api/                    ← v1.5 动态数据契约层（见 dynamic-data-api.md）
    request.ts            ← 统一 request<T>()（admin 模板复用其自带；独立项目生成最小 fetch 封装）
    types/digital-twin.ts
    interfaces/manager/digital-twin.ts   （admin 模板扁平：interfaces/digital-twin.ts）
    modules/manager/digital-twin.ts      ← RealDigitalTwinApi + createDigitalTwinApi() + digitalTwinApi
  mock/                   ← v1.5（独立项目靠 VITE_MOCK_ENABLED=false + tree-shaking 剥离；admin 模板用 mockDataStripPlugin）
    api/manager/digital-twin.ts          ← MockDigitalTwinApi
    data/manager/digital-twin.ts         ← 由 spec 派生的 mockBuildings / mockFloorDetails / mockPois
```

用 Vite `?raw` 加载着色器（`src/vite-env.d.ts` 里已有类型管线）：
```ts
import gridFrag from '../scene/shaders/gridGround.glsl?raw'
```

### WebGL2 能力检测（v1.8）

部分特性依赖 WebGL2：`MeshPhysicalMaterial.transmission`（全息已禁用，但留作检测示例）、`MeshReflectorMaterial`、高质量各向异性阴影过滤。构建场景前**一次性检测**并降级，避免在集成显卡 / 旧驱动上崩溃或掉帧：

```ts
const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
const hasWebGL2 = !!canvas.getContext('webgl2')
// 无 WebGL2 时：禁用 transmission/reflector/CSM，bloom 降档或关闭，阴影改 PCF（非 PCFSoft）。
// 极端情况（getContext 返回 null）退化为 cyber/blueprint/isometric 这类轻量风格路径。
```

Three.js `WebGLRenderer` 默认请求 WebGL2 并自动回退 WebGL1，但**材质/后处理不会自动降级**——生成器须据 `hasWebGL2` 选择材质与 pass。

## 2. 渲染器、相机、灯光（赛博风格；其它风格见 `references/styles.md`）

拷贝 `DigitalTwin.ts:1-216` 并向赛博观感修剪：

- **渲染器：** `WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })`，**`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`**（v1.8 硬性上限 2，避免 4K/retina 分配超大 framebuffer），**`renderer.outputColorSpace = THREE.SRGBColorSpace`**（v1.8 强制，所有风格统一，防换肤色调漂移），`ACESFilmicToneMapping`（曝光约 1.0——比夜间版更平）。`EffectComposer` 可选（仅当要用微弱 bloom 时才需要）。
- **场景背景（v1.9，防黑屏的关键修复）：** 渲染器虽 `alpha:true`，但**必须显式设 `scene.background`**——否则画布透明、透出深色页面底，整屏发黑（这是 v1.8 常见「一片黑」的直接原因）。背景取 token 的 `scene` 块，画成**顶→底纵向渐变** `CanvasTexture`（`scene.bgTop` → `scene.bgBottom`）：
  ```ts
  function makeBackgroundTexture(bgTop: string, bgBottom: string): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, bgTop); grad.addColorStop(1, bgBottom)
    g.fillStyle = grad; g.fillRect(0, 0, 8, 256)
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex
  }
  scene.background = makeBackgroundTexture(token.scene.bgTop, token.scene.bgBottom)
  ```
  why 渐变而非纯色：暗色风格（cyber/holographic/night-realistic/blueprint）给地平线上方一点空气感、纵深，远比 `palette.void-bg` 一抹纯黑读起来像「数字孪生空腔」；亮色风格两端相近，近似纯色但保留一致性。`alpha:true` 保留（其它逻辑依赖），但背景以 `scene.background` 为准——绝不留空。
- **相机（取景必须从 spec 几何推导，不能写死）**：`OrthographicCamera`，等轴姿态（`elevation = atan(1/√2)`、方位角 π/4）。**不要**用固定 `frustumH=280` + `lookAt(0,0,0)`——瞄准地平面会让所有楼栋质量（都在 Y>0）堆在画面上半，地面最近端落在画面中线偏上，其下到视锥底边整段都是空白画布（= 下方大片空白）。正确做法是「**测量后取景**」：算出内容包围盒在相机视图空间的范围，再据此设**非对称视锥**，把地面最近端钉到距舞台底边 ~6%。算法如下（`canvasW/H` 为画布像素尺寸；正交相机下 `dist` 不影响成像，只要在远裁面内）：

```ts
// (a) 从 spec 派生内容几何 —— 不再写死 280
const bx = spec.boundary.x, bz = spec.boundary.z
const Hmax = Math.max(...spec.buildings.map(b => b.floors)) * spec.floorHeight
const centroid = new THREE.Vector3(0, Hmax / 2, 0)          // 内容竖向质心 = 瞄准/轨道中心

// (b) 等轴姿态 + 瞄准质心（而非地平面原点）
const elevation = Math.atan(1 / Math.sqrt(2)), az = Math.PI / 4, dist = 3000
this.camera.position.set(dist*Math.cos(elevation)*Math.cos(az) + centroid.x,
                         dist*Math.sin(elevation)           + centroid.y,
                         dist*Math.cos(elevation)*Math.sin(az) + centroid.z)
this.camera.lookAt(centroid)
this.camera.updateMatrixWorld()

// (c) 测内容 8 个包围盒角点在 view-space 的 x/y 范围
const corners: THREE.Vector3[] = []
for (const sx of [-1,1]) for (const sy of [0,1]) for (const sz of [-1,1])
  corners.push(new THREE.Vector3(sx*bx, sy*Hmax, sz*bz))
let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity
for (const c of corners){ const v=c.clone().applyMatrix4(this.camera.matrixWorldInverse)
  xmin=Math.min(xmin,v.x);xmax=Math.max(xmax,v.x);ymin=Math.min(ymin,v.y);ymax=Math.max(ymax,v.y) }
const cx = (xmin+xmax)/2

// (d) 按画布宽高比 A 算出能容纳内容(留出周边环境余量)的视锥高；frustumH 是算出来的
//     K 是「园区内容」占画面的比例。v1.2 起默认 K=0.66——四周各留 ~17% 用来显示
//     周边市政道路、行道树、围墙/绿化带，让默认取景就是一张「嵌在城市里的全景图」，
//     而不是 v1.1 那种把园区撑满 88% 以致看不到环境的特写。
const A = canvasW / canvasH, K = 0.66, M = (1 - K) / 2        // 内容占 66%，上下对称留白 ~17%
const cw = xmax-xmin, ch = ymax-ymin
const frustumH = Math.max(ch / K, cw / (A * K))               // 宽/高两个方向取较大需求
const frustumW = A * frustumH

// (e) 非对称视锥：底部钉到 M，水平居中，顶部吸收余量
this.camera.zoom = 1
this.camera.bottom = ymin - M*frustumH                        // ← 地面最近端钉到距底边 ~17%
this.camera.top    = this.camera.bottom + frustumH
this.camera.left   = cx - frustumW/2
this.camera.right  = cx + frustumW/2
this.camera.near = 1; this.camera.far = 8000
this.camera.updateProjectionMatrix()
this.controls.target.copy(centroid)                           // clearFocus / 轨道中心 = 质心
```

  要点（**理解 why，不要照抄数字**）：
  - **瞄准质心而非地平面**：`lookAt(centroid=(0,Hmax/2,0))` 让楼栋质量进入画面上半，配合底部钉边，下方空白消失。
  - **测量后取景**：内容包围盒投到 view-space 再算视锥，天然适配不同 `boundary`/楼高——换园区不用调参。
  - **留出周边环境余量（v1.2 默认 K=0.66）**：`K` 是园区内容（boundary × 最高楼）占画面的比例。默认 `K=0.66` 让四周各留 ~17%，用来显示周边市政道路、行道树、围墙/绿化带——默认取景就是一张能看全园区轮廓和紧邻环境的「全景图」，而不是把园区撑满 88% 的特写。`M = (1-K)/2 = 0.17`，`bottom = ymin - M*frustumH` 把地面最近端钉在距底边 ~17%；左右居中，顶部吸收剩余余量。`ymin` 是 8 个角点里最低的那个，正好是地面最近端。**若用户明确要「特写主体」可把 K 调到 0.8 左右；若要「航拍俯瞰全城」可调到 0.55。**
  - **`OrbitControls`**：带阻尼，极角夹紧 [0.5, 1.3]，缩放夹紧 [0.45, 2.6]（滚轮改 `camera.zoom`，归用户所有）。v1.2 把缩放下限从 0.6 放宽到 0.45，让用户能继续拉远俯瞰周边道路与全貌。全局取景对应 `zoom=1, target=centroid`；`clearFocus` 回到这两者。
  - **resize 重算**：宽高比 A 变了要重跑 (d)(e)——把这段封装成 `frameCamera()`，在 `setupCamera` 末尾和 `onResize` 里都调一次。
- **灯光：** 刻意保持平，让着色器地面 + 自发光边线读起来像“数字孪生”而不是“建筑可视化”。一个 `HemisphereLight(0x3a5d86, 0x0a1428, ~0.6)` + 一盏柔和 `DirectionalLight` 就够了。丢掉范例里的 2048² VSM 阴影贴图和 PMREM 环境——它们会和赛博地面打架。
- **环境光下限（v1.9，所有风格强制）：** 无论风格 `lights.ambient` 是否为 `null`，都**额外补一盏低强度 `AmbientLight`**，强度取 token `lights.ambientFloor`（暗色风格 ~0.18–0.20、亮色风格 ~0.08；blueprint 已有 `ambient=1.0` 故 `ambientFloor=0.0`），色取 `lights.hemiSky` 或中性白。why：cyber 等风格原本刻意无环境光，实测导致未受光的楼面/地面区域纯黑、肉眼判定为「黑屏」；一道极弱环境光只抬起阴影、不破坏氛围，是和「显式 scene.background」配合消灭黑屏的另一只手。生成器据此统一：`if (token.lights.ambientFloor > 0) scene.add(new AmbientLight(hemiSky ?? 0xffffff, ambientFloor))`。

## 3. 网格着色器地面  ← cyber 与 blueprint 风格的关键地面（其余风格跳过，按 `styles.md` 用纹理/PBR/扁平地面）

这是标志性的赛博地面。范例用的是程序化沥青画布——**替换**成真正的着色器平面。

```ts
const GRID_UNIFORMS = {
  u_gridColor: { value: new THREE.Color(spec.shaders.grid.u_gridColor) }, // #2a7fff
  u_cell:      { value: spec.shaders.grid.u_cell },                       // 46
  u_strength:  { value: spec.shaders.grid.u_strength },                   // 0.85
  u_scale:     { value: new THREE.Vector2(boundary.x * 2, boundary.z * 2) },
}
const groundGeo = new THREE.PlaneGeometry(boundary.x * 2, boundary.z * 2)
const groundMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL1,
  uniforms: GRID_UNIFORMS,
  fragmentShader: gridFrag,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  transparent: true,
  depthWrite: false,
})
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
scene.add(ground)
```

`gridGround.glsl`（在 `assets/`）是事实来源 `grid.glsl` 的 UV 适配变体：同样的细网格 + 每 5 格的主网格 + 径向晕影配方，但由 `vUv * u_scale` 驱动，使网格跟随平面而非随相机漂移。上面的顶点着色器把 `vUv` 传过去。

**外圈城市地面（v1.2，所有风格）**：园区的周边道路、行道树、围墙会落在 `boundary` 之外（见 §10），所以地面要分两层：
- **园区地面**（`boundary.x*2 × boundary.z*2`）—— cyber 用上面的 shader 平面（霓虹青网格），blueprint 用**同一个 shader 平面**但换蓝图调 uniform（深蓝图底 + 淡白青坐标网格），其它风格按 `styles.md` 的草地/铺装/反射/扁平材质。
- **外圈城市地面**（`boundary*1.6 × 2` 左右，比园区大一圈）—— 一个比园区地面更深/更冷的纯色 `MeshBasicMaterial`（颜色取 token 的 `palette.divider` 或新的 `environment.city-ground`），铺在园区地面之下，作为周边道路与市政背景的画布。两层都 `rotation.x = -π/2`，Y 略低于园区地面（如 `-0.5`）避免 z-fight。

### §3.1 程序化地面纹理 `makeGroundTexture`（v1.9，非 cyber/blueprint 风格的主地面 + cyber/blueprint 的降级）

v1.8 除 cyber/blueprint 外的 5 个风格地面都是**纯色** `MeshLambert`/`MeshStandard` 平面——远观就是一张色片，「没纹理」。v1.9 起给园区地面叠一层**程序化 `CanvasTexture`**（与 `makeFacadeTexture`/`makeLabelTexture` 同一套程序化画布思路，不引入外部图片资源），形态由 token `ground.texture.type` 决定：

```ts
function makeGroundTexture(token): THREE.CanvasTexture {
  const g = token.ground.texture            // { type, base, line, cell }
  const SIZE = 512, c = document.createElement('canvas'); c.width = c.height = SIZE
  const ctx = c.getContext('2d')!
  ctx.fillStyle = g.base; ctx.fillRect(0, 0, SIZE, SIZE)   // 底色
  const step = SIZE / Math.max(1, g.cell)                  // 每格像素
  ctx.strokeStyle = g.line; ctx.fillStyle = g.line
  if (g.type === 'grid') {                                  // white-model/isometric 细网格 + cyber/blueprint 降级
    ctx.lineWidth = 1
    for (let i = 0; i <= g.cell; i++) { const p = i * step
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(SIZE, p); ctx.stroke() }
  } else if (g.type === 'tiles') {                          // realistic/night-realistic 铺装/草地 tile（略带噪点）
    ctx.lineWidth = 2
    for (let i = 0; i <= g.cell; i++) { const p = i * step
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, SIZE); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(SIZE, p); ctx.stroke() }
    // 确定性伪随机洒点（同 spec 一致、不抖动）——用 index 作种子，避免 Math.random
    for (let i = 0; i < g.cell * g.cell; i += 3) {
      const px = (i % g.cell) * step + (i * 37 % step)
      const py = Math.floor(i / g.cell) * step + (i * 53 % step)
      ctx.globalAlpha = 0.15; ctx.fillRect(px, py, 2, 2); ctx.globalAlpha = 1
    }
  } else if (g.type === 'dots') {                           // holographic 青色点阵
    for (let i = 0; i <= g.cell; i++) for (let j = 0; j <= g.cell; j++) {
      ctx.beginPath(); ctx.arc(i * step, j * step, 1.5, 0, Math.PI * 2); ctx.fill() }
  } // type === 'none'：纯色，啥也不画（回退）
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 8)                       // 平铺，让纹理随园区尺寸延展
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
```

接线规则：
- **非 cyber/blueprint 风格**：把 `makeGroundTexture(token)` 作为园区地面材质的 `map`（holographic 等自发光风格可同时作 `emissiveMap` + 低 `emissiveIntensity`，让点阵在暗底微亮）。**不替换** §3 的两层地面结构，只给园区地面材质加纹理。外圈城市地面仍是纯色 `MeshBasicMaterial`。
- **cyber/blueprint（shader 失败降级）**：园区地面正常走 `gridGround.glsl` shader；但 shader 编译失败 / uniform 绑定异常时（`transparent:true` + 失败 = 地面凭空消失、整屏黑），**必须降级**为 `new THREE.MeshBasicMaterial({ map: makeGroundTexture(token), color: environment.city-ground })` 的不透明纯色 + 网格平面。包一层 try/catch 检测 `material.userData.shaderFailed` 或 `renderer.debug`，失败即换材质。why：地面是数字孪生的「地基」，宁可丢霓虹辉光也不能丢地面。

## 4. 按类别上色的楼栋（所有风格共用——颜色来自 token；材质按风格替换）

> **v1.5 两阶段构建（见 §12）**：楼栋渲染分两步——
> 1. **静态脚手架阶段**（同步，构造 `ParkScene` 时）：按 `spec.buildings[]` 的**占地几何**（id/w/d/x/z/category/facing）画一个低**占地底板**占位（高 ~2 单位的 `BoxGeometry` 或贴地 `PlaneGeometry`），类别色已在此时确定。**不读 `name`/`floors`**（它们是动态数据）。
> 2. **水合阶段**（`getBuildings()` 返回后，`scene.hydrateBuildings(items)`）：按下文配方把底板**替换/挤出**为完整盒体——高度用返回的 `floors × floorHeight`、楼顶标签用返回的 `name`、楼层拾取板按返回的 `floor_ids` 注册。下文代码里的 `b.floors`/`b.name` 在 v1.5 应理解为**水合时来自 `BuildingRuntimeItem`**，由 `building_id` 与静态底板 join。

对每个 `BuildingSpec`，挤出一个盒体并按类别上色。**颜色来源所有风格一致**（token 的 `category` 映射：楼幢/地下车库）；**材质按风格替换**——赛博用下面的自发光 `MeshStandardMaterial`；真实物体/夜间写实用 PBR（玻璃 metalness≈0.9、混凝土 roughness≈0.9）；蓝图用扁平半透 `MeshBasicMaterial` + 白色 `EdgesGeometry` 描边；全息用半透体 + 自发光边；白模用纯白磨砂 `MeshStandardMaterial`（类别色转移到屋顶描边）；等距插画用 `flatShading` cel 着色。各风格材质细则见 `styles.md`。复用范例的幕墙纹理 + 楼层环线 + 屋顶轮廓方式（`DigitalTwin.ts:424-465, 766-890`），替换颜色来源。

**v1.4 起，楼栋必须表达「楼层 + 贴砖」层次**（数字孪生的核心可读性——一眼能读出「这栋几层、每层几块砖」）：(1) 每两层之间画贯穿四立面的**横向虚线分隔**；(2) 在幕墙纹理上把每层切成 **1–5 块贴砖**、**v1.7 起相邻贴砖深浅两色强对比交替**（类别色 HSL lightness `±roomShade` 派生的 light/dark 两色，按 `i%2` 交替）、**贴砖之间用高对比深色竖实线分隔**。**贴砖划分是生成器侧的程序化装饰，不进 Park Spec**（保持 spec 精简）——用楼栋 `id` + 楼层索引做种子的**确定性**伪随机，保证同一份 spec 每次生成结果一致、不抖动。

```ts
const CATEGORY_COLOR: Record<Category, number> = {
  building: 0x27a8ff, garage: 0x3df0c8,
} // 从 spec.tokens / assets/themes/<style>.tokens.json 派生——绝不硬编码

for (const b of spec.buildings) {
  if (b.category === 'garage') {            // v1.3: 车库不再挤出盒体
    buildGarageEntrance(b)                  // → §5：半金字塔三角门入口 + P 牌
    continue
  }
  const h = b.floors * floorHeight
  const geo = new THREE.BoxGeometry(b.w, h, b.d)
  const color = CATEGORY_COLOR[b.category]
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.6 })
  // 侧面用程序化幕墙画布（makeFacadeTexture 模式）——v1.4/v1.7：画布内画「每层 1–5 块贴砖 + 相邻两色交替 + 深色竖实线」（见 §4.1）
  const mesh = new THREE.Mesh(geo, sideMaterials(b, color))
  mesh.position.set(b.x, h / 2, b.z)
  mesh.userData = { kind: 'building', buildingId: b.id }
  scene.add(mesh)

  addFloorDividers(mesh, b)             // v1.4: 每层之间贯穿四立面的横向虚线分隔（见 §4.1）
  addRoofOutline(mesh, b)               // 顶面的 EdgesGeometry
  addRoofLabel(mesh, b.name)            // v1.3: 楼顶常驻名称标签（见下）
}
```

### §4.1 楼层虚线分隔 + 贴砖两色交替（v1.4，v1.7 改贴砖）

楼栋可读性 = 能数出层数 + 能看出每层的贴砖拼花。两件事都在立面层面解决，不增加 spec 字段：

- **`addFloorDividers(mesh, b)`**：在每个楼层边界（`y = i * floorHeight`，i=1..floors）画一条**贯穿四个立面的横向虚线**。用 `LineSegments` + `LineDashedMaterial`（需 `computeLineDistances()`），或 `Line2`/`LineMaterial`（`dashed: true`）。颜色取 token `building.dividerColor`（7 种风格各自定义，见 `assets/themes/*.tokens.json`）。why：仅靠盒体边缘的环线远看会融成一片实心体；显式的横向虚线在等轴视角下被楼面“挂”住，立刻读出「这一层 / 那一层」。虚线（而非实线）是为了与 `addRoofOutline` 的实线轮廓区分层级、不喧宾夺主。
- **`makeFacadeTexture` 内的贴砖划分**：在已有的程序化幕墙画布（`DigitalTwin.ts` 幕墙纹理模式）绘制阶段，对每一层：
  1. `roomCount = 1 + floor(seededRand(hash(b.id, floorIndex)) * 5)` —— 同层 1 到 5 块贴砖，确定性伪随机。
  2. 把该层在画布上的水平条带按 `roomCount` 等分；**每块贴砖从「深浅两色」中按序号交替取色**——把 `category.building` 色转 HSL，派生两个明度 `light = L + roomShade`、`dark = L − roomShade`（`roomShade` 取 token `building.roomShade`，cyber ~0.16，要更强对比可上调到 ~0.22；saturation/hue 不变），第 i 块（i=0..roomCount−1）按 `i % 2 === 0 ? light : dark` 取色。why 两色交替而非线性明度梯度：线性梯度（`−roomShade + 2*roomShade*i/(roomCount-1)`）让相邻两块只差一个步长，远观看不出层次、糊成一片；**相邻两块永远一明一暗**才是「贴砖」应有的强对比拼花，远观即可数清砖缝。单间（roomCount=1）时取 `light` 即可。
  3. 每两块贴砖之间画一条**高对比深色竖实线**分隔——用 token `building.dividerColor`（7 种风格各自定义，见 `assets/themes/*.tokens.json`），在每条贴砖边界画一条 1–2px 宽的**实线**（`fillRect` 或 `lineTo`，**非虚线**），贯穿该层立面高度。楼层边界留出与 `addFloorDividers` 重合的横向虚线带。why 深色实线：旧的「更细的同色竖线」与贴砖同色调、对比弱、远观融掉；深色实线让每块贴砖的边界清晰可数，强化「贴砖」语义。楼层之间的横向分隔**保持虚线**（`addFloorDividers` 不动）——本规则只约束贴砖之间的竖向分隔。
  4. （night-realistic）原有的窗户自发光 `emissiveMap` 仍在贴砖色块之上叠加——亮窗让夜景楼栋「亮起来」。
  why 用纹理而非 3D 子盒体：跨 4 风格统一、一栋楼一个材质性能可控、与既有幕墙画布天然吻合；3D 盒体会让网格数 ×贴砖数暴涨（10 层 ×5 块 ×N 栋）。

### 楼顶常驻名称标签（v1.3）

每栋 `building` 楼的屋顶上方加一个**始终可见**的名称标签——这是数字孪生可读性的关键（一眼能认出哪栋是哪栋）。用 `THREE.Sprite` + `CanvasTexture`：

```ts
function addRoofLabel(mesh: THREE.Mesh, name: string) {
  const tex = makeLabelTexture(name)           // 圆角半透明底 + 描边 + 文字（中文字体 Noto Sans SC）
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.position.set(0, mesh.geometry.parameters.height / 2 + 18, 0)  // 屋顶上方 ~18 单位
  const w = Math.max(60, name.length * 22)
  sprite.scale.set(w, 30, 1)
  mesh.add(sprite)                             // 跟随楼栋，Sprite 天然始终面向相机
}
```

要点（**理解 why**）：
- **Sprite 而非 HTML**：楼名要随相机旋转/缩放保持在楼顶——`Sprite` 是 3D 对象，天然面向相机且跟随楼栋，比每帧 `project()` 的 HTML 叠加层便宜得多（几十栋楼每帧投影会卡）。
- **始终可见、不受选中影响**：这是「常驻标识」，不是悬停提示；金色高亮选中状态由**独立的选中 overlay**（金色 `EdgesGeometry` 描边 + 半透明填充，按 buildingId + 楼层定位，见 §8.2 的 `setSelection`）表达，楼名标签独立。`buildFloorSlabs`（楼层拾取板，见本节末）只负责不可见的射线命中盒（`pickables[]`），**不画**任何选中态——不要在它里面找「选中分支」。
- **对比度（v1.4，§4.2）**：楼名标签同样走高对比配对——底色/字色按风格取 `garageEntrance.signBg/signFg` 同源的明度策略（亮底深字 / 暗底亮字），描边取 `category.building`。绝不散落 hex。
- **字体**：中文用 `Noto Sans SC`（与全局字体一致），CanvasTexture 绘制时设好 `font`。
- **标签可见性总表（v1.9，契约级——哪些常驻、哪些悬停）**：
  | 对象 | 名称/文字 | 何时显示 | 形态 |
  |---|---|---|---|
  | 楼幢（`building`） | 楼顶名 | **常驻**（始终可见、面向相机、跟随楼栋） | §4 `Sprite` |
  | 地下车库入口 | P 牌 | **常驻**（定位标识） | §5 `Sprite` |
  | 地面车位 | 每位 P | **常驻**（定位标识） | §10 `Sprite` |
  | POI 兴趣点 | **类型图标** | 常驻（可悬停目标） | §11 `Sprite` |
  | POI 兴趣点 | **显示名（label/tooltip.title）** | **仅悬停/点击** | §11 HTML tooltip/卡片 |

  why 这张表：数字孪生要一眼认出「哪栋楼」（楼名常驻），但 POI 名称是「按需查看」的细节，常驻会让画面被几十个文字 Sprite 堆满、与楼名重复堆叠。POI 的 `Sprite` **只画类型图标符号**（箭头/摄像机/P/圆点等），**绝不**把 `label`/`tooltip.title` 文字画进 Sprite——显示名只能通过 §11 的 HTML tooltip（悬停）与卡片（点击）出现。车库/车位 P 牌是「这里有个车库/车位」的定位标识，保持常驻（用户确认）。

楼层拾取板（`buildFloorSlabs` 模式，`DigitalTwin.ts:509-560`）把每层注册进一个 `pickables[]` 数组，带 `userData = { buildingId, floorIndex }`，用于射线投射。

### §4.2 CanvasTexture 标签对比度（所有风格共用；v1.4）

场景里所有用 `CanvasTexture` + `Sprite` 画的「标签类」对象——楼顶名称（§4）、车库入口 P 牌（§5）、地面车位每位印的 P（§10）、POI 图标（§11）——都必须保证**前景（字/符号）与背景（底色）高对比可读**。这是 v1.4 修复的核心痛点：旧版赛博 P 牌用薄荷绿底 `#3df0c8` + 白字，两者都偏亮，远看糊成一团看不清。

**规则**：底色与字色必须分布在明度轴两端——**亮底配深字，暗底配亮字**。绝不把两个同偏亮或同偏暗的色配在一起。配色**不散落 hex**，每个标签读 token 里的 `{ signBg, signFg }`（或房间/POI 对应的 `fg/bg`）配对；缺省时回退到旧 `sign` 单色 + 自动取反明度字色。统一走一个辅助函数：

```ts
function makeContrastLabelTexture(
  text: string,
  { bg, fg, stroke, radius }: { bg: string; fg: string; stroke?: string; radius?: number }
): THREE.CanvasTexture {
  // 圆角底色 bg + 描边 stroke + 字色 fg，中文字体 Noto Sans SC。
  // bg/fg 已由 token 保证高对比——这里只负责绘制，不再做明度判断。
}
```

每个风格的「哪边是底、哪边是字」由风格气质决定（详见 `references/styles.md` 与各 `assets/themes/<style>.tokens.json`）：cyber 深底（`palette.void-bg`/`panel-top`）+ 亮霓虹字 + 霓虹描边；blueprint 深蓝图底 + 淡白青字；holographic 深底 + 自发光青亮字；realistic 中性浅底 + 深字；white-model 浅灰底 + 深字；isometric 暖白底 + 深海军蓝字；night-realistic 深底 + 自发光暖/亮字（夜间可见）。**理解 why**：标签是数字孪生的「可读层」，必须比楼栋/地面更跳——对比度不够就等于没标签。

## 5. 车库入口标记 —— 半金字塔三角门 + P 牌（所有风格共用；v1.3 重写）

v1.3 起，地下车库**不再**渲染成一栋下沉的盒体，也**不再**显示占用标牌/进度条。占用数字是运营态实时数据，不属于「几何打点」——把它留在后台/详情面板按需拉取，场景本体只表达「这里有一个地下车库入口」。

入口标记是纯 3D（非 HTML），由 `buildGarageEntrance(b)` 构建：

- **半金字塔三角门**：在 `(b.x, b.z)` 用一个 `BufferGeometry` 拼出朝 `b.facing`（默认 `'S'`，即朝南/朝镜头）开口的半金字塔——底面贴地（宽 `b.w` × 深 `b.d`），远端向地下收缩成一条脊线，造型即「车库入口雨棚/坡道三角门」。可由 4 个三角形面（底、左坡、右坡、顶坡）+ 一条 `EdgesGeometry` 描边组成。材质按风格取 token 的 `category.garage` 色（各风格按 `styles.md`；cyber/holographic/night-realistic 自发光描边，blueprint 白线框，realistic/white-model/isometric 扁平）。
- **P 标识牌**：入口正上方一个 `Sprite`，走 §4.2 的 `makeContrastLabelTexture('P', { bg: token.garageEntrance.signBg, fg: token.garageEntrance.signFg, stroke: ... })`——**深底亮字 / 浅底深字**的高对比配对，始终面向相机。**不要**再用旧的单色 `sign` 底 + 白字（v1.4 前的赛博 P 牌因此看不清）。
- **可点击**：把入口网格（或一个不可见的命中盒）push 进 `pickables[]`，`userData = { kind: 'building', buildingId: b.id }`。点击后切换器聚焦「地下车库」标签，与楼栋同一套选中机制——只是不再有占用标牌弹出。

```ts
function buildGarageEntrance(b: BuildingSpec) {
  const group = new THREE.Group()
  group.position.set(b.x, 0, b.z)
  const color = CATEGORY_COLOR['garage']
  group.add(makeHalfPyramidGate(b.w, b.d, b.facing ?? 'S', color))   // 4 三角面 + EdgesGeometry
  const g = token.garageEntrance                                      // { signBg, signFg, ... }
  const tex = makeContrastLabelTexture('P', { bg: g.signBg, fg: g.signFg, stroke: color })  // §4.2
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }))
  sign.position.set(0, b.d * 0.9 + 24, 0)                            // 入口上方
  sign.scale.set(40, 40, 1)
  group.add(sign)
  group.userData = { kind: 'building', buildingId: b.id }            // 命中盒继承，进 pickables[]
  scene.add(group)
}
```

要点：
- **半金字塔而非盒体**：传达「向下进入地下」的语义，比一栋平顶小楼更准确地表达「车库入口」。朝向 `facing` 让开口对准主要人流方向（默认朝南 = 朝默认相机）。
- **去占用显示**：`spec` 里**没有** `garage.capacity/empty/occupied`（v1.3 已删除）。占用数据是运营态实时数据——**v1.5 起由 `getPois()` 返回的 `parking` 类 POI 的 `occupancy` 字段提供**（见 §11、§12 与 `dynamic-data-api.md` §4），可在点击车库/停车场 POI 时随 tooltip 显示，或由详情面板按需拉取。不要塞回 3D 场景几何。

## 6. Legend 叠加（Hdr → Legend）（所有风格共用）

场景头里的一行 HTML，每个 `spec.legend` 条目一个色块：

```html
<div class="legend">
  <span v-for="e in spec.legend" :key="e.category" class="lg">
    <i class="swatch" :style="{ background: e.color, boxShadow: `0 0 5px ${e.color}` }"></i>{{ e.label }}
  </span>
</div>
```

默认图例：楼幢（青色）、地下车库（薄荷绿）。这是让类别上色可读的屏幕图例——必需，非可选。

## 7. 可选的赛博装饰（仅赛博风格）

时间允许 / 输入需要时添加（都在 `.pen` Scene 里见过）：
- **网络连线** —— `LineSegments2`/`Line2` 把楼顶连到一个枢纽，青色，低不透明度。
- **罗盘** —— 场景左上角一个小的 `▲ N` + `◢ ISO 3D` 文字叠加。

这些纯属调味；用户想要更干净的场景就跳过。

## 8. 交互（所有风格共用）

拷贝范例的指针模型（`DigitalTwin.ts` 的指针绑定段，按方法名定位）：无按键的 pointermove → 对 `pickables[]` 做悬停射线投射；pointerup（移动 <4px）→ 点击；委托给 `useSelection` composable（`references/exemplar.md`）。该 composable 持有 `focusedBuildingId` / `floorIndex` / `hoverBuildingId`；**有效**选中是 `hover ?? focused`，被 watch 并通过 `setSelection(bid, fin)` 推回场景（金色边线光晕 + 该层的半透明填充）。楼栋切换器和 3D 点击都写入同一个 composable，所以它们保持同步。**v1.7 起交互完整闭环**：悬停某层 → 该层立即出金色边框（`eff = hover`）；点击某层 → 锁定该层（`selectFloor`），鼠标移开后金边保留（`eff` 回落已选层）；**点击空白或非楼栋物体 → `onDeselect → clearFocus`，之前选中楼层的金色边框消失、楼栋聚焦与相机一并回到全局概览**。

> **务必照抄下方 §8.1 / §8.2 的契约与代码**。本节历史上出过一个隐蔽 bug：选中楼层后鼠标移开画布，金色边框就消失（应当保留）。根因是生成器「临场发挥」了点击接线——在楼层点击里除了 `onSelect` 又追加了 `onFocus`（→ `focusBuilding` 清空 `floorIndex`）。下面把 composable 契约、点击/悬停代码、watch 接线、反面模式一次给齐，照抄即可避免。

### §8.1 选中态契约（`useSelection`）—— 单一数据源，勿临场发挥

选中态是「悬停预览 + 已锁定楼层」的合成，由一个 `watch` 推回场景画金色高亮。整套机制强依赖一条铁律：

> **楼层点击必须一次性写入「楼 + 层」（`selectFloor`），点击之后绝不能再有任何调用改写/清空 `floorIndex`。**

否则鼠标移开（悬停清空）后，有效选中会回落到「楼 + null」，`setSelection(bid, null)` 命中 `fin==null` 分支隐藏金色高亮——表现为「选中后鼠标移开金边消失」（见本节末反面模式）。

> **v1.7 澄清——铁律只约束「命中楼栋」的点击分支**。铁律禁止的是：在 `onSelect`（命中楼栋/楼层）之后再追加 `onFocus`/`focusBuilding` 去清 `floorIndex`。它**不禁止**「点空白取消选中」：当 `onPointerUp` 未命中任何楼栋/POI 时，走 `onDeselect → clearFocus` 是一条**独立、必需**的取消入口——这是用户显式「点空白取消一切」的语义，与悬停期间不清空（保持金边）并不冲突。区分清楚两条路径：命中楼栋 → `selectFloor`（锁定，不清空）；命中空白 → `clearFocus`（全清回全局）。

`useSelection.ts`（模块级单例，原样拷贝范例；范例不可访问时按下契约实现）：

```ts
import { ref, computed } from 'vue'

const focusedBuildingId = ref<string | null>(null)   // 聚焦楼（null=全局概览）
const floorIndex = ref<number | null>(null)          // 已锁定楼层（null=未锁定）
const unitIndex = ref(0)
const hoverBuildingId = ref<string | null>(null)
const hoverFloorIndex = ref<number | null>(null)

// 有效选中 = 悬停 ?? 已选。金色高亮 watch 这两个 computed。
const effBuildingId = computed(() => hoverBuildingId.value ?? focusedBuildingId.value)
const effFloorIndex = computed(() => hoverFloorIndex.value ?? floorIndex.value)

// 3D 楼层点击专用：楼 + 层一次性原子写入（铁律所在）。
function selectFloor(b: string, f: number) {
  focusedBuildingId.value = b
  floorIndex.value = f
}
// 仅「切换器标签页」用：聚焦某楼、重置楼层（null 或随机一层）。
// ⛔ 绝不在楼层点击里调用——会清空 floorIndex，触发反面模式 bug。
function focusBuilding(b: string | null) {
  focusedBuildingId.value = b
  floorIndex.value = null
}
function clearFocus() {                               // 切回全局：全清
  focusedBuildingId.value = null
  floorIndex.value = null
  hoverBuildingId.value = null
  hoverFloorIndex.value = null
}
function setHover(b: string | null, f: number | null) {
  hoverBuildingId.value = b
  hoverFloorIndex.value = f
}
```

各 writer 的语义边界（理解 why，不要混用）：
- **`selectFloor`（楼层点击）**：楼 + 层是「一次原子写入」。楼层点击的语义就是「锁定这楼的这层」，二者必须一起变；这也正是相机聚焦的触发源（`focusedBuildingId` 变 → 下面的 watch 聚焦）。
- **`focusBuilding`（切换器标签页）**：切换器的语义是「聚焦整栋楼、不锁定具体层」，所以 `floorIndex` 重置。**它和楼层点击是互斥的两个入口**——切换器走 `focusBuilding`，3D 点击走 `selectFloor`，不要叠加。
- **`clearFocus`（切回全局）**：全清，回到无选中概览。
- **`setHover`（悬停）**：只写 `hover*`，不动 focused/floor。

### §8.2 点击 / 悬停处理（ParkScene 指针回调 + GlobalTwin watch 接线）

**ParkScene 侧**：楼层点击只调 `onSelect`，**不要**再追加 `onFocus` / `focusBuilding`。相机聚焦不靠点击回调，而靠下面 GlobalTwin 的 `watch(focusedBuildingId)`——重复调用反而会用 `focusBuilding` 清空 `floorIndex`。

```ts
// ParkScene.onPointerUp（移动 <4px 才算点击；POI 拾取优先见下文）
private onPointerUp = (e: PointerEvent) => {
  const moved = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y)
  if (moved > 4) return                                  // 拖拽不触发点击
  this.updatePointer(e)
  const poiId = this.pickPoi()
  if (poiId) { this.openPoi(poiId); return }             // POI 优先，命中则不触楼栋
  const b = this.pickBuilding()
  if (b) {
    this.cb.onSelect?.(b.bid, b.fin)                     // ← 命中楼栋/楼层：楼+层由 selectFloor 一次性写入
    // ⛔ 不要 this.cb.onFocus?.(b.bid)
    //    相机聚焦已由 GlobalTwin 的 watch(focusedBuildingId) → scene.focusBuilding() 驱动；
    //    再调 onFocus 会触发 composable.focusBuilding 清空 floorIndex → 鼠标移开金边消失（反面模式）。
  } else {
    this.cb.onDeselect?.()                               // ← v1.7：点空白/非楼栋物体 → clearFocus 取消选中回全局
  }
}

// ParkScene.onPointerMove：无按键时做悬停射线投射，命中楼栋则 onHover(bid, fin)，否则 onHover(null, null)。
private onPointerMove = (e: PointerEvent) => {
  this.updatePointer(e)
  const poiId = this.pickPoi()
  if (poiId) { this.cb.onHover?.(null, null); return }
  const b = this.pickBuilding()
  this.cb.onHover?.(b?.bid ?? null, b?.fin ?? null)      // 未命中楼栋时传 (null, null)：eff 回落已选楼层
}
```

`ParkScene` 只暴露 `focusBuilding(id)`（相机补间）与 `setSelection(bid, fin)`（定位金色 overlay）两个命令式方法；**它不持有选中态**，选中态在 composable 里，由 watch 单向推回场景。

**GlobalTwin.vue 侧**：指针回调只负责把命中结果写进 composable；相机聚焦与金色高亮**全部由响应式 `watch` 驱动**（单一数据源，不要在回调里直接操作场景 overlay）：

```ts
const sel = useSelection()

const scene = new ParkScene(canvas, scaffold, style, {
  onHover: (bid, fin) => sel.setHover(bid, fin),         // 悬停写 hover*（eff 立即变）
  onSelect: (bid, fin) => sel.selectFloor(bid, fin),     // 楼层点击写 focused+floor（一次性原子写入）
  onDeselect: () => sel.clearFocus(),                    // v1.7：点空白/非楼栋物体 → clearFocus（清楼层金边 + 楼栋聚焦 + 相机回全景）
  // ⛔ 不要 onFocus 回调。切换器标签页由 BuildingSwitcher 直接调 sel.focusBuilding()；
  //    相机聚焦交给下面的 watch(focusedBuildingId)，不要在指针回调里重复驱动。
})

// 相机聚焦：跟随 focusedBuildingId（切换器标签页 / 3D 楼层点击都会改它）
watch(() => sel.focusedBuildingId.value, (id) => scene.focusBuilding(id))

// 金色高亮：跟随「有效楼层」eff = 悬停 ?? 已选。
//   悬停某层 → 立即高亮；鼠标移开 → eff 回落已选楼层，高亮保留（只要 floorIndex 没被清掉）。
watch(
  () => [sel.effBuildingId.value, sel.effFloorIndex.value] as const,
  ([bid, fin]) => scene.setSelection(bid, fin),
)
```

> **反面模式（即本节修复的 bug）**：楼层点击同时调 `onSelect`（→ `selectFloor` 写 `floorIndex=fin`）和 `onFocus`（→ `focusBuilding` 写 `floorIndex=null`）。点击瞬间 `floorIndex` 被清成 null；悬停时 `eff = hover` 掩盖了它（金边还在），但鼠标一移开 `eff` 回落到 `(bid, null)`，`setSelection(bid, null)` 命中 `fin==null` 分支隐藏 overlay——表现为「选中后鼠标移开金边消失」。修复：楼层点击只调 `onSelect`；相机聚焦交给 `watch(focusedBuildingId)`，二者不要重叠。

**POI 拾取（v1.3，§11）**：在楼栋 raycast **之后**对独立的 `poiPickables[]` 再做一次 raycast。命中 POI 时**优先**处理——弹出/高亮其 tooltip，并 `return` 不再触发楼栋聚焦（POI 不应误触楼栋选中）。POI 标记永远不混入楼栋 `pickables[]`。

相机**聚焦补间**（⚠️ 必须是「事件触发 + 有限时长」的过渡，**不能**在 animate 里无条件每帧 lerp）：

- **触发**：仅当 `focusedBuildingId` 改变（聚焦某楼 / `clearFocus` 回全局）时启动一次 tween，记录起始 `controls.target` 与 `camera.zoom`、目标 target 与目标 zoom。
- **过渡期间**（如 0.6s `easeOutCubic`）：在 animate 里 lerp `controls.target`（`lerpVectors(start, end, e)`）与 `camera.zoom`；过渡结束（elapsed ≥ duration）后置位 `tweening=false`，**不再每帧触碰 `camera.zoom` / `controls.target`**。
- **滚轮缩放所有权（关键）**：本场景用 `OrthographicCamera`，`OrbitControls` 的滚轮缩放就是改 `camera.zoom`。过渡结束后必须把缩放、平移、旋转完整交还 `OrbitControls`——否则用户滚轮改的 `zoom` 会被「每帧 lerp 回 targetZoom」抹掉，表现为「滚轮缩放失效」；同理每帧 lerp `controls.target` 会把用户的 pan 慢慢拖回原点。滚轮范围仍由 `OrbitControls` 的 `minZoom`/`maxZoom` 限制。
- **反面模式（勿抄）**：`camera.zoom += (targetZoom - camera.zoom) * 0.1` 与 `controls.target.lerp(focusTarget, 0.1)` 写进 animate 每帧无条件执行——会拽回用户滚轮缩放与 pan。
- 全局视角：tween 目标为园区中心 target + 默认 zoom（如 1.0）。

> 范例 `DigitalTwin.ts:1368-1416` 的聚焦补间可借鉴其相机过渡思路，但**改写成事件触发 + 有限时长 tween**，不要照搬「每帧无条件 lerp」。

## 9. 生命周期（所有风格共用）

- canvas 上的 `ResizeObserver` → 更新渲染器、composer（若启用 bloom）、宽高比、视锥、每个 `LineMaterial.resolution`。**v1.8：resize 回调防抖（如 150ms `debounce`）**，避免拖拽窗口时每帧重算视锥。
- **v1.8 WebGL 上下文丢失/恢复**：GPU 进程崩溃、驱动休眠、标签页后台抢占都会触发 `webglcontextlost`。canvas 监听两个事件：
  - `webglcontextlost`：`e.preventDefault()`（阻止默认销毁）+ 停 RAF + 标记 `contextLost=true` + 给用户一个「3D 上下文丢失，点击恢复」遮罩。
  - `webglcontextrestored`（或用户点遮罩调 `renderer.forceContextRestore()`）：重建依赖 GPU 资源的对象（几何/材质/纹理需重新上传；Three.js `WebGLRenderer` 在 restore 后会自动重新编译，但自定义 `ShaderMaterial` 的 uniform/attribute 可能需要重绑）+ 重启 RAF + 重新 `frameCamera()`。
  - 不要在 `webglcontextlost` 后继续渲染——会抛 `getContextProperty` 异常。
- **v1.8 `dispose()` 完整清单**（拷贝 `DigitalTwin.ts:1454` 并补全）：① `cancelAnimationFrame(rafId)`；② `ResizeObserver.disconnect()`；③ `OrbitControls.dispose()`（移除其指针/键盘 listener）；④ 移除所有 `canvas.addEventListener`（pointerdown/move/up、`webglcontextlost/restored`）；⑤ 遍历 `sceneGroup` 递归 `geometry.dispose()` + `material.dispose()`，并 dispose 材质的 `.map`/`.emissiveMap`/`.envMap`/`renderTarget` 纹理；⑥ `EffectComposer` 启用时 dispose 其 `renderTarget1/2` 与各 pass；⑦ `renderer.dispose()` + `renderer.forceContextLoss()`（彻底释放 GPU 上下文）。
- **保持一个长生命周期实例。** 范例在每次标签页往返时重建 `DigitalTwin`（没有 keep-alive），丢弃 WebGL 状态。优先用带命令式 API（`focusBuilding`、`setSelection`、`clearSelection`、`dispose`）的单例，让 `<canvas>` 撑过标签页切换；`GlobalTwin.vue` 只在真正的 mount/unmount 时创建/销毁。

## 10. 园区环境（道路 / 地面车位 / 绿化 / 周边道路 / 氛围）—— 所有风格共用

v1.2 起，场景不再只是「楼栋 + 地面」。一份完整的数字孪生全景应当嵌在城市环境里：园区内部有环形道路和地面车位，四周有市政道路、行道树、围墙与出入口。所有这些元素**完全由 `spec.environment` 驱动**（schema 见 `references/park-spec.md`），字段缺失时用**智能默认**生成一套合理园区——绝不硬编码具体内容（沿用本技能核心铁律）。

调用顺序：先建外圈城市地面（§3 末尾），再依次 `buildInternalRoads → buildSurfaceParking → buildGreenery → buildSurrounding → buildAmbiance → buildPOIs`（§11），全部挂到同一个 `sceneGroup`。所有颜色取所选风格 token 的 `environment` / `poi` 子对象（见 `assets/themes/*.tokens.json`），不散落 hex。

### buildInternalRoads(env)
在 `boundary` 内、楼栋间隙画园区内部道路。形状由 `env.internalRoads` 决定（默认 `'loop'`）：
- `loop`：沿 boundary 内侧 ~30 单位绕一圈环形车道（4 段 `PlaneGeometry` 长条 + 4 个圆角），中间留出楼栋与中央广场。
- `cross`：十字主干（沿 X 和 Z 各一条），适合方正网格布局。
- `grid`：井字网格，适合多栋密集园区。
- `none`：跳过。

材质：园区地面颜色之上的沥青色 `MeshBasicMaterial`（赛博/蓝图/全息用深色调 `MeshBasicMaterial`；真实物体/白模/等距插画用哑光沥青 `MeshStandardMaterial`；各风格取色见 `styles.md` §10），`rotation.x = -π/2`、Y 略高于地面（如 `0.2`）。车道虚线用 `Line2`/`LineSegments`（白色 `environment.roadLine`）沿车道中线。**不进 `pickables[]`**。

### buildSurfaceParking(env)
若 `env.surfaceParking` 非 null，在内部道路某一侧铺一排**长方形地面车位**（真实车位语义）。`stalls` 缺省时按楼栋规模推算（如 `sum(floors) * 6`）。v1.4 起每个车位表达为「**长方形铺装 + 描边 + 中央印 P**」，**不再**用正方形框、**不再**立区域 P 牌：

- **车位几何**：每个车位是一个贴地长方形（典型 ~12 × 24 世界单位，长边沿停车方向），排成一列沿内部道路一侧。车位底 = 扁平 `PlaneGeometry`（`surfaceParking.stallFill`，沥青/铺装色），`rotation.x = -π/2`、Y 略高于地面（如 `0.3`）；外框 = `EdgesGeometry`/`LineLoop`（`surfaceParking.stallLine`）。
- **逐位印 P**：每个车位中心放一个小 `Sprite`（或贴地 CanvasTexture decal），走 §4.2 的 `makeContrastLabelTexture('P', { bg: stallFill, fg: pMark })`——**底=车位铺装色、字=`surfaceParking.pMark`**，保证 P 清晰可读。**移除**旧版整片端头的区域 P 牌。
- **示意停放车辆**：默认 `round(stalls * 0.3)` 个车位放置低多边形汽车代理体（简单车身 `BoxGeometry` + 车顶 + 4 轮，复用 §10 `buildAmbiance` 的车辆代理体模式），车身色取 `surfaceParking.car`（缺省回退 `environment.vehicle`）。具体哪些车位放车由 `occupied` 决定——给了就放前 `occupied` 个、没给就按 30% 默认。**why**：把一直闲置的 `occupied` 重新赋能为「示意停放车辆数」，满足「示意车辆停放」诉求而不引入新 spec 字段。
- **不进 `pickables[]`**（车位/车都不影响楼栋 raycast）。材质按风格分支见 `references/styles.md`（赛博/全息/夜间写实用自发光描边、蓝图用白线框描边、真实物体/白模/等距插画用扁平描边；各风格取色见 `styles.md` §10）。

```ts
function buildSurfaceParking(env) {
  const sp = token.surfaceParking                                    // { stallFill, stallLine, pMark, pMarkBg, car }
  const stalls = env.surfaceParking?.stalls ?? sumFloors(spec) * 6
  const cars = env.surfaceParking?.occupied ?? Math.round(stalls * 0.3)  // v1.4: 默认 ~30% 示意车辆
  for (let i = 0; i < stalls; i++) {
    const stall = makeStall(sp.stallFill, sp.stallLine)              // 12×24 长方形铺装 + 描边，rotation.x=-π/2
    stall.position.set(rowX, 0.3, rowZ + i * STALL_LEN)
    group.add(stall)
    const pTex = makeContrastLabelTexture('P', { bg: sp.pMarkBg ?? sp.stallFill, fg: sp.pMark })  // §4.2
    const pSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: pTex, depthTest: true }))
    pSprite.position.copy(stall.position).add(new THREE.Vector3(0, 1, 0)); pSprite.scale.set(8, 8, 1)
    group.add(pSprite)
    if (i < cars) group.add(makeCarProxy(sp.car, stall.position))   // 低多边形车代理体，复用 buildAmbiance 模式
  }
  // 不再立区域 P 牌；整个 group 不进 pickables[]
}
```

### buildGreenery(env)
园区绿化景观（默认 `treeDensity: 'normal'`）：
- **草地色块**（`GreenPatch`）：楼栋之间、道路两侧的低 `PlaneGeometry`，颜色取 `environment.grass`（赛博暗紫青、真实物体/等距插画草绿、白模鼠尾草低饱和、夜间写实深绿、蓝图/全息深蓝调；各风格取色见 `styles.md` §10）。可叠程序化噪声纹理。
- **行道树**：沿内部道路与外围人行道按密度（`sparse` 间隔大 / `normal` / `lush` 密）种树。每棵 = 树干 `CylinderGeometry`（`environment.treeTrunk`，棕）+ 树冠 `ConeGeometry` 或 `IcosahedronGeometry`（`environment.treeCanopy`）。**密度大时用 `InstancedMesh`**（见下方性能预算）。
- `env.greenery.centralPlaza`（默认 true）：园区中心一个铺装广场（圆形 `CircleGeometry` 浅色 + 可选旱喷/地标）。
- `env.greenery.waterFeature`（默认 false）：一个小水池（`CircleGeometry` 蓝色半透明 + cyber 下自发光边）。**不进 `pickables[]`**。

### buildSurrounding(env)
把园区嵌进城市路网（默认 `roads/sidewalk/wall/gate` 全 true）：
- **市政道路**：`boundary` 外侧四面各一条双向道路（4 段 `PlaneGeometry` 宽带，沥青色），中央黄线用 `Line2`（`environment.roadLine` 偏暖黄）。道路延伸到外圈城市地面边缘。
- **人行道**：园区边沿与围墙之间一圈窄铺装带（`environment.sidewalk` 浅色）。
- **围墙/护栏**：沿 boundary 的矮 `BoxGeometry` 链（`environment.wall`），cyber 下可带顶部发光线。`env.surrounding.wall === false` 时改用绿篱（一行矮灌木，复用 `treeCanopy` 色）。
- **主出入口闸机**：朝南（Z+）正中一个开口 + 两侧闸机柱 + 可选门头标识。**不进 `pickables[]`**。

### buildAmbiance(env)
氛围细节（默认 `streetLamps/vehicles` true；`groundGlow` 仅 cyber 默认 true）：
- **街灯**：沿内部道路与外围人行道每隔一段一盏——杆 `CylinderGeometry`（深灰）+ 灯头 `SphereGeometry`（`environment.lampGlow`）。**night-realistic 风格下每盏挂一个暖琥珀 `PointLight`（~0xffb24a，强度 ~30，距离衰减）**，沿道路布点（沿用 `styles.md` night-realistic 已有的路灯方案）。其它风格灯头仅作自发光标记，不挂实光源，省性能。
- **地面发光标线**（`groundGlow`，仅 cyber 默认开）：用 `Line2` 自发光（`environment.roadLine` 偏青）在车道线/园区轮廓加发光勾边，强化「数字孪生」感。其它风格跳过。
- **车辆/行人代理体**（`vehicles`）：周边道路与地面车位上零星几辆低多边形车（复用上面的车辆代理体）；可选少量行人代理体（胶囊 + 球头）。数量克制，纯氛围。**不进 `pickables[]`**。

### 性能预算（硬约束）
环境网格（树/车/灯/草块）**总数建议 ≤ 400**。超出时优先降密度（`treeDensity` 降一档、车位/车辆减少），其次把同类元素改用 `THREE.InstancedMesh` 合批。**v1.8 起 InstancedMesh 为强制**（同类几何 ≥ ~10 个时）：
- **行道树**：树干一个 `InstancedMesh` + 树冠一个，承载数百棵——禁止每棵一个 `Mesh`。
- **车辆/车位代理体**：所有低多边形车代理体共用一个车身 `InstancedMesh`（车位 P 标签仍各自 Sprite，因其 CanvasTexture 文本不同，但可按文本分组共享纹理）。
- **cyber 树冠边光**（`EdgesGeometry` per tree）：v1.8 改为 `InstancedMesh` 的线段实例或共享 `LineSegments`，不再每树一个 `EdgesGeometry`（N 棵 = N draw call）。
- **POI 杆/图标**（§11）：按 type 分组共享几何 + 共享材质，杆用 `InstancedMesh`。

一棵树 = 树干 instance + 树冠 instance 两个 `InstancedMesh` 即可承载数百棵。所有环境元素**不参与 floor raycast pick**（不要 push 进 `pickables[]`），避免误触楼栋选中。

### 生命周期
所有环境网格挂到 `ParkScene` 的 `sceneGroup`，跟随 §9 的 `ResizeObserver` + `dispose()` 一起清理；不每帧 lerp、不每帧重算。环境元素在首次 `buildScene()` 一次建好，标签页切换不重建（沿用 §9 单例铁律）。

## 11. 兴趣点（POI）—— 类型化标记 + tooltip/popup（所有风格共用；v1.3 新增；v1.5 动态化）

> **v1.5：POI 是动态数据**。`buildPOIs` 不再在静态脚手架阶段按 `spec.pois` 一次建好，而是改在**水合阶段**由 `scene.hydratePois(items)` 按 `getPois()` 返回的 `PoiRuntimeItem[]` 构建（坐标/类型/tooltip 来自 API，新增 `status` 驱动颜色/动画、`occupancy` 给停车场 POI）。`spec.pois` 仅作为生成 Mock 数据（`mockPois`）的种子。详见 §12 与 `dynamic-data-api.md`。下文的标记几何/tooltip 机制不变——只是数据源从静态 spec 改为运行期 API。

`spec.pois` 缺省为 `[]`（不生成任何 POI）。提供时，POI 与楼栋/单位同源——全部走 spec，是后台 API 可配置的「打点 + 提示」数据契约。`buildPOIs` 在 `buildAmbiance` 之后、**水合阶段**调用（v1.5），挂到同一个 `sceneGroup`。

### buildPOIs(pois)
对每个 `PoiSpec` 在 `(x, y ?? 0, z)` 放一个**类型化标记**：
- **杆**：一根细 `CylinderGeometry`（深灰，半径 ~1.5，高 ~30），底端锚定。`buildingId` + `floorIndex` 给定时，把整组（杆+图标）锚到该楼该层高度（`floorIndex * floorHeight + y`）做室内点位；否则锚地面。
- **图标**：顶部一个 `Sprite`，CanvasTexture 按 `type` 画图标符号。图标同样遵守 §4.2 对比规则——给图标加一个高对比底（`surfaceParking.pMarkBg` / 深色或浅色，随风格），符号用 `poi.<type>` 色（缺省 `poi.custom`）；**禁止**把饱和图标直接画在与它明度相近的地面/楼面色上。类型→符号映射建议：entrance/exit 用箭头、camera 用摄像机轮廓、gate 用闸机、service 用信息点、landmark 用星标、parking 用「P」、custom 用圆点。
- 每个标记的命中盒 push 进**独立的 `poiPickables[]`**（`userData = { kind: 'poi', poiId }`），与楼栋 `pickables[]` 分开。

### Tooltip / popup（HTML 叠加层）
沿用原 garage sign 的屏幕投影思路——`buildPOIs` 不自己画 HTML，而是把 POI 列表交给一个 Vue 组件（如 `PoiLayer.vue`），由它：
- 每帧把当前打开的 POI 世界坐标 `Vector3.project(camera)` 投到屏幕，定位弹出卡（只投影**当前打开的那一个**，不是全部——几十个 POI 每帧全投影会卡）。
- **悬停**：高亮标记 + 显示 `tooltip.title ?? label`。
- **点击**：展开完整卡片——`tooltip.title ?? label` 作标题、`tooltip.description` 作正文（支持换行）、`tooltip.meta` 渲染成键值表（如 负责人/电话/状态/容量）。无 `tooltip` 字段的 POI 点击仅显示 `label`。

> **v1.8 POI 单开契约**：`useSelection` 新增 `openPoiId: Ref<string | null>`（与楼栋 `focusedBuildingId` 平行）。同一时刻**至多一个 POI 打开**——点击新 POI 覆盖旧的（`openPoiId.value = poiId`），点击空白 / Esc / 再点同 POI 关闭（`openPoiId.value = null`）。POI 打开与楼栋聚焦**互斥**：点 POI 不聚焦楼栋（§8 POI 拾取优先 + `return`），点楼栋不关 POI（但 POI 卡片可用 Esc 关）。打开 POI 卡片时 `aria-live="polite"` 播报、焦点移入卡片、Esc 关闭并归还焦点（见 `shell.md` 可访问性）。`PoiLayer.vue` 只投影 `openPoiId` 对应的那一个 POI（悬停态用轻量 tooltip，不进 project 循环）。

```html
<div class="poi-card" :style="cardStyle">
  <div class="poi-title">{{ poi.tooltip?.title ?? poi.label }}</div>
  <p v-if="poi.tooltip?.description" class="poi-desc">{{ poi.tooltip.description }}</p>
  <dl v-if="poi.tooltip?.meta" class="poi-meta">
    <template v-for="(v, k) in poi.tooltip.meta" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></template>
  </dl>
</div>
```

要点（**理解 why**）：
- **类型驱动图标/颜色**：让「监控」「闸机」「出入口」一眼可辨，是数字孪生打点的核心价值。颜色全部从 token `poi.*` 派生，绝不散落 hex。
- **v1.9 名称仅悬停（契约级）**：POI 的 `Sprite` **只渲染类型图标符号**（箭头/摄像机/P/圆点等），**绝不**把 `label`/`tooltip.title` 文字画进 Sprite——显示名只能通过 HTML tooltip（悬停 `tooltip.title ?? label`）与卡片（点击）出现。why：几十个 POI 常驻文字 Sprite 会与楼幢常驻楼名重复堆叠、堆满画面；POI 名称是「按需查看」的细节，悬停才浮现正合适（楼名 = 常驻标识，POI 名 = 悬停详情，见 §4 标签可见性总表）。这与既有「未打开的 POI 仅显示 3D 图标、不进每帧 project 循环」是一致的方向。
- **只投影当前打开的 POI**：性能关键。未打开的 POI 仅显示 3D 图标，不参与每帧屏幕投影。
- **POI 与楼栋选中隔离**：POI 有自己的 `poiPickables[]` 和点击处理（§8），点 POI 不应聚焦楼栋——避免「点摄像头却跳到某栋楼」。
- **性能预算**：POI 总数建议 ≤ 200；杆/图标用 `InstancedMesh` 或共享几何 + 共享材质（按 type 分组）合批。

## 12. 动态数据接入与水合（所有风格共用；v1.5 新增）

v1.5 起页面数据分两层（基础信息静态内联、动态数据走 `IDigitalTwinApi`）。**契约层（5 文件 + Real/Mock 工厂 + `VITE_MOCK_ENABLED`）的完整规范见 `references/dynamic-data-api.md`**——本节只讲场景侧的「脚手架先行再水合」接线。

### ParkScene 命令式水合 API

`ParkScene`（§9 单例）除构造期建静态脚手架外，暴露三个水合方法 + 一个查询方法，由 `GlobalTwin.vue` 在 `onMounted` / 交互回调里调用：

```ts
class ParkScene {
  // 构造期（同步）：建静态脚手架——环境(§10) + 楼栋占地底板(§4 占地) + Legend(§6) + 相机取景(§2)
  constructor(canvas: HTMLCanvasElement, scaffold: ParkScaffold) { ... }

  /** 水合楼栋：按 floors 挤出底板为完整盒体 + 楼顶 name 标签 + 注册 floor_ids 拾取板。 */
  hydrateBuildings(items: BuildingRuntimeItem[]): void
  /** 水合 POI：按 PoiRuntimeItem[] 建标记杆+图标(§11)，status 驱动颜色/动画，parking 类挂 occupancy tooltip。 */
  hydratePois(items: PoiRuntimeItem[]): void
  /** 由 building_id + 楼层序号查水合时注册的 floor_id（点击楼层 → getFloorDetail 用）。 */
  getFloorId(buildingId: string, floorIndex: number): string | undefined

  focusBuilding(id: string | null): void   // §8
  setSelection(bid, fin): void             // §8
  dispose(): void                          // §9
}
```

`ParkScaffold`（构造参数）= 从 spec 派生的**静态**数据：`buildings[].id/w/d/x/z/category/facing`、`environment`、`tokens`、`boundary`、`floorHeight`、`stage`。**不含** `name`/`floors`/`pois`。

### 加载时序（脚手架先行）

```ts
// GlobalTwin.vue onMounted
const scene = new ParkScene(canvas, scaffold)        // ① 同步：静态脚手架（环境+占地底板+Legend+取景）
// v1.8: Promise.allSettled——POI 失败不连累楼栋水合，各自独立错误态
const [bRes, pRes] = await Promise.allSettled([      // ② 并行拉动态数据
  digitalTwinApi.getBuildings(),
  digitalTwinApi.getPois(),
])
if (bRes.status === 'fulfilled') scene.hydrateBuildings(bRes.value)   // ③ 水合楼栋
else buildingsError.value = errMsg(bRes.reason)                       // 降级：楼名/高度缺失
if (pRes.status === 'fulfilled') scene.hydratePois(pRes.value)       // ③ 水合 POI
else poisError.value = errMsg(pRes.reason)                            // 降级：POI 缺失
hydrating.value = false
// ④ 点击楼层：watch(selection) → scene.getFloorId() → getFloorDetail({signal}) → UnitDetail
//    v1.8: watch 用 onCleanup + AbortController 取消旧请求（防 race），错误驱动面板内联重试
```

### 关键约束

- **相机取景只用静态几何**（§2 `frameCamera()`）：`Hmax` 用 spec 最高楼估算（或 boundary 上限），**不等** `getBuildings()`——否则水合前白屏。水合后楼栋实际高度若与估算有明显出入，可在 `hydrateBuildings` 末尾再 `frameCamera()` 一次（可选）。
- **水合前楼栋以占地底板占位**（低 `BoxGeometry`/贴地 `PlaneGeometry`，类别色已定）；水合时按 `floors` 替换/挤出为完整盒体（§4 配方）。`dispose()` 要清掉水合阶段建的网格（楼层拾取板、标签 Sprite、POI 标记）。
- **loading / 空 / 错误三态兜底**：请求中显示底板骨架（不白屏）；失败显示降级提示且脚手架可交互；`getPois()` 返回 `[]` 不报错（不渲染 POI）。
- **POI 状态色**：图标底色取 token `poi[type]`，外圈光晕/动画色取 token `poi.status[status]`（`dynamic-data-api.md` §12）；`alarm` 可加呼吸动画。status 缺省回退 `online`。
- **车库占用**：点击 `parking` 类 POI（含地下车库入口）时，tooltip 的 `meta` 或专用区显示 `occupancy.empty/capacity`（来自 `getPois()`，不再有任何静态占用数据）。

---

## 验证

生成后，`npm run dev`（端口 3000）并确认：
- [ ] **场景不再死黑（v1.9）**：7 种风格首屏都有可辨识的 `scene.background`（暗色风格为顶→底渐变空腔、非纯黑）；楼栋/地面未受光区域不再是纯黑（环境光下限 `ambientFloor` 生效）。逐风格切换肉眼确认。
- [ ] **写实增强层（v2.0）**：realistic/night-realistic 的 `scene.environment` 已赋值（RoomEnvironment PMREM），玻璃/金属有反射、不发黑；night-realistic/holographic/cyber 的 `EffectComposer`+`UnrealBloomPass`+`OutputPass` 已实例化，亮部有可见溢光；realistic/night-realistic 的 GTAO 生效、night-realistic 地面湿润反射生效（帧率可接受）；realistic/night-realistic 远景有淡雾（`token.realism.fog`）。其余 5 风格**无** env/AO/反射（纪律不破）。
- [ ] **轮廓对齐（v2.0）**：楼栋几何装配走 `assets/building-geometry.ts` 的 `buildBuilding()`（与 `park-scene.impl.ts` 一起拷贝，**不在 ParkScene 里手写 position.y**）；`EdgesGeometry` 立体轮廓与楼体同位（`position.y = h/2`），不再半埋地下；金色楼层高亮对齐楼层 slab、不偏移；裙楼底座包在塔底（塔体从 y=0 起，无错位）。
- [ ] **地面有纹理（v1.9）**：cyber/blueprint 显示着色器网格；realistic/night-realistic 显示程序化 tiles（草地/沥青）、holographic 显示青色点阵、white-model/isometric 显示细网格——**没有一种风格是「一片纯色色片」**。人为破坏 cyber `gridGround.glsl` 引用后，地面降级为带网格纹理的纯色平面（不消失、不发黑）。
- [ ] **赛博 / 蓝图风格**：地面显示着色器网格（cyber 为霓虹青网格、blueprint 为深蓝图底 + 淡白青坐标网格）。**其它风格**：地面与材质按 `references/styles.md`（如真实物体有 PBR 反射 + 柔和阴影、夜间写实有窗户自发光 + bloom、全息有半透体 + 边缘辉光、白模有纯白磨砂 + 软阴影、等距插画有 flatShading cel 着色），且**除 blueprint 外未接入** grid。
- [ ] 楼栋按类别上色，并与屏幕 Legend 色块一致（颜色来自所选风格 token 的 `category` 映射）。
- [ ] **每栋楼顶部常驻显示名称标签**（v1.3），始终可见、面向相机、跟随楼栋。
- [ ] **楼栋可读出楼层与贴砖层次**（v1.4，v1.7 改贴砖）：每层之间有贯穿四立面的横向虚线分隔；每层立面切成 1–5 块贴砖、**相邻贴砖深浅两色强对比交替**（一明一暗 ping-pong）、**贴砖之间用高对比深色竖实线分隔**；同一 spec 重复生成结果一致（确定性伪随机）。
- [ ] **所有标签高对比可读**（v1.4）：楼顶名称、车库 P 牌、地面车位每位印的 P、POI 图标都「亮底深字 / 暗底亮字」，远观不糊（赛博 P 牌尤其要清晰）。
- [ ] **车库渲染为半金字塔三角门入口 + P 牌**（v1.3），朝向 `facing`，**无**占用标牌/进度条/车位数。
- [ ] **地面车位为长方形车位 + 每位印 P + ~30% 示意车辆**（v1.4），**无**正方形框、**无**区域 P 牌；`occupied` 给定时按其数量放车。
- [ ] **POI 标记按类型上色**（v1.3），悬停高亮、点击弹出 tooltip（含 `description` + `meta`）；点 POI 不误触楼栋聚焦。
- [ ] **POI 名称仅悬停（v1.9）**：POI 的 3D `Sprite` 只显示类型图标、**默认无文字名称**；鼠标悬停 POI 才浮现名称 tooltip，点击展开卡片。楼幢楼顶名、车库 P 牌、车位 P 牌保持**常驻可见**。
- [ ] 切换标签页（含 地下车库）聚焦正确的楼；点击某层金色高亮它并打开详情面板。
- [ ] **楼层选中闭环**（v1.7）：悬停某层 → 该层立即出金色边框；点击某层 → 锁定金边，**鼠标移开后金边保留**；**点击空白或非楼栋物体 → 之前选中楼层的金边消失、楼栋聚焦与相机回到全局概览**（`onDeselect → clearFocus`）。
- [ ] 滚轮可缩放、右键可平移、左键可旋转，且松手后视角**保持**（不被「每帧 lerp」拽回）；聚焦切换为**有限时长**过渡、结束后不抢占滚轮。
- [ ] 改变窗口大小后场景保持正确缩放（赛博下含网格，无漂移）。
- [ ] **取景贴合（v1.2 默认 K=0.66）**：园区内容约占画面 2/3，四周能看到周边道路/绿化/围墙；地面最近端钉在距舞台底边 ~17%，左右居中，**下方无大片空白**、楼栋完整可见未被裁切；滚轮可继续拉远到 zoom≈0.45 俯瞰全貌；resize 后重算仍贴合、无变形。
- [ ] **园区环境（v1.2）**：默认加载时场景里有内部道路、地面车位带、行道树与绿地色块、四向市政道路、围墙与出入口；夜间写实风格下路灯发光（`PointLight`），cyber 风格下地面发光标线可见。环境元素不影响楼栋 raycast 选中。
- [ ] **动态数据水合（v1.5）**：`VITE_MOCK_ENABLED=true` 下首屏先出静态脚手架（环境 + 楼栋占地底板 + Legend + 取景），随后水合出楼栋完整高度 + 楼顶名称 + POI 标记（status 上色）；点击楼层弹出由 `getFloorDetail()` 返回的 UnitDetail。切 `VITE_MOCK_ENABLED=false` 后 Network 请求落到 `/api/manager/park/buildings|floor-detail|pois`（证明走真实 API）。请求失败时脚手架仍可交互（降级兜底）。
- [ ] `npm run typecheck` 干净通过。
