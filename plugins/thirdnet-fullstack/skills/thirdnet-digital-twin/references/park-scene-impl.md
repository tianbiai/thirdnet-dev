# 范式实现导读（ParkScene.impl）

> v2.0 新增。这是 `assets/park-scene.impl.ts`（范式实现）的使用说明。生成器**以本实现为基线「拷贝-改」**，而不是从 scene-recipe.md 的散文合成——后者已证明会让 LLM 漂移，丢掉环境贴图 / bloom / 环境光下限 / 渐变背景等真实感关键环节。

## 为什么要有范式实现

v1.x 的生成路径是「读 scene-recipe.md 散文 + 指向未随技能发布的 `DigitalTwin.ts`（旧文档反复说『拷贝它、修剪它』）」。实测生成代码会漂移：金属材质无环境贴图导致玻璃发黑、`profile.bloom` 是死配置从不实例化 composer、`ambientFloor`/`scene.background` 写在规范里却被跳过。

范式实现把这些问题一次性解决：**技能随包发布一份完整、可直接 `cp` 的 `ParkScene.ts`**，所有 v1.9 漂移项与 v2.0 写实增强层都已落地。生成器只需替换数据源、按 spec 选风格，无需重新合成 Three.js 渲染管线代码。

## v2.1 新增：真实感细节层 + 四个实测 bug 修复

**真实感细节层**（全部固化，参数写死或走 token 新块，随机一律 `mulberry32(hashStr(...))` 确定性种子）：

| 元素 | 实现 | token 驱动 |
|---|---|---|
| 程序化天空 | `makeBackgroundTexture` 升级版（canvas 512×256）：写实白云（3–6 朵椭圆组合）、夜景星空（130 颗亚像素暗星——**必须低于 bloom 阈值，否则晕成雪片**）+ 月亮（右上径向光晕） | `scene.sky: {clouds, stars, moon}` 开关 |
| 楼顶设备 | `building-geometry.ts` 新增 `buildRooftopKit()`：电梯机房盒（w·0.18 × fh·0.5 × d·0.22）+ 1–2 根天线 + 警示灯（仅 `night-realistic` 接通红色航空警示灯，其余风格保留不亮）；位置种子 = `rooftop:{buildingId}` | `environment.rooftop` 色 |
| 地面标线 | `buildRoadMarkings()`：环路/主路中央虚线（InstancedMesh 12×2 段）+ 大门斑马线（6×2.5×20）+ 引道（连接大门与环路）+ 引导箭头 | `environment.roadMarking` 色 |
| 绿化多样性 | 行道树球形（Icosahedron）/锥形（Cone）按位置序奇偶交替 + 草地边缘灌木球丛（每块 6 丛，种子确定性） | 沿用 `environment.treeCanopy` |
| 水景 | `greenery.waterFeature` 终于落地：Circle(50) 水面 + Ring 池缘；写实两风格低粗糙度 Standard 材质吃 envMap 反射 | `environment.water` 色 |
| POI 悬停 | `ParkSceneCallbacks.onPoiHover`——驱动 HTML 名称条（§11「名称仅悬停」契约补齐） | — |

**四个 v2.0 实测 bug 修复**（都在范式实现里，拷贝即修复）：

1. **楼名标签埋进塔体**：`building-geometry.ts` 旧式 `label.y = h/2 + 22`——高楼（h > 44）标签被埋进塔体内部不可见。修复为 `y = h + 22`（屋顶上方）。
2. **浅色风格标签黑块**：旧式标签配对 `(void-bg, cyan-bright)` 在亮底风格两字色都偏亮，违反 §4.2「亮底深字 / 暗底亮字」。修复为走 token `ui.labelBg/labelText`（3 风格各自的高对比配对）。
3. **取景偏小**：`frameCamera()` 旧式用默认 18 层估算 Hmax——实际楼层更少时园区只占画面 ~1/3。修复为水合后用真实最高楼层（`maxBuildingHeight()`），`hydrateBuildings()` 末尾重新 `frameCamera()`。
4. **`buildCorridor` 空指针**：未配置 `scaffold.corridor` 的园区 `c.floor` 直接抛 TypeError。修复为 `if (!c) return`。

## v2.3 新增：选中层（描边 + 4 立面填充，按风格配色）

v2.2 以前选中楼层只有一圈亮金描边（`selectionOverlay` 线框），对比度不足。v2.3 起选中层 = 描边 + 半透明填充两层，且**配色按风格 token**：

- **描边** `selectionOverlay`：`EdgesGeometry` 线框，`opacity:1.0` 全不透明勾勒轮廓（`LineBasicMaterial` 受 WebGL 限制线宽恒 1px；要更粗需换 `Line2`/`LineMaterial`，本实现未引入）。
- **填充** `selectionFill`：`BoxGeometry(1,1,1)` 配 6 材质数组 `[fill,fill,skip,skip,fill,fill]`——顶/底（`+Y/-Y`）用 `visible:false` 空材质跳过，**只渲染 4 个立面**（不封顶/底）；`MeshBasicMaterial` 半透明、`depthTest:false`（不被楼体立面遮挡）、`renderOrder:-1`（描边画在其上）。
- **配色按风格**：`updateSelectionColors()` 在 `applyProfile()`（构造 + 每次 `setStyle`）读取主题 `ui.selectionBorder` / `ui.selectionFill` / `ui.selectionFillOpacity`，应用到两层材质；缺省回退 `FLOOR_HIGHLIGHT_COLOR`/`FLOOR_FILL_COLOR`/`FLOOR_FILL_OPACITY` 常量。冷调/暗底风格用暖琥珀撞色、亮底风格用红橙描边 + 蓝填充互补。
- `clearSceneGroup` 的 `keep` 集保留两层（切风格不丢选中）；`dispose` 释放填充 geometry + 材质数组。

> 4 个主题 token 已各加 `ui.selectionBorder/Fill/Opacity`；`assets/tokens.schema.json` 的 `ui.properties` 已登记（非 required，可选）。

## 怎么用（生成器工作流）

1. **拷贝两个文件**：`cp assets/park-scene.impl.ts <目标项目>/src/scene/ParkScene.ts` **和** `cp assets/building-geometry.ts <目标项目>/src/scene/building-geometry.ts`（缺一不可——后者是楼栋几何装配的单一事实来源）。
2. **改数据源**：把脚手架类型（`ParkScaffold`、`ScaffoldBuilding`、`BuildingRuntimeItem`、`PoiRuntimeItem`）对齐到本项目的 `src/data/<park>.ts` 与 `src/api/types/manager/digital-twin.ts`（见 `dynamic-data-api.md`）。这些是结构契约，字段名不要改。v2.1 起 `src/data/<park>.ts` 由 `scripts/generate_data.py` 生成（含 `ParkScaffold` 接口定义），通常无需再改。
3. **选风格**：`spec.style` 决定 `PROFILES` 的取值——**不要手改 profile 表**；要调某个风格的观感，改 `assets/themes/<style>.tokens.json` 的 `realism` 块（见下）。
4. **校验**：`npm run typecheck` 干净 + `python scripts/validate_spec.py spec.json` OK（v2.0 起含 token schema 校验，v2.1 起含布局重叠/出界检测）。

## 楼栋几何装配 = `building-geometry.ts`（不要手写）

楼栋的立体轮廓半埋地下、金色楼层高亮偏移，根因都是 podium/body/edges/cap/dividers/label/slabs 的 y 坐标各自手算、彼此错位。所以这套装配抽成了 `assets/building-geometry.ts` 的 `buildBuilding(opts)` 纯函数——**所有 y 坐标只在此文件定义一次**（v2.1 起楼顶设备的 y 坐标也由 `buildRooftopKit` 在此定义）。

生成器在 `extrudeBuildings()` 里**只负责风格相关的部分**（构造材质、facade 纹理、标签配色），然后调用 `buildBuilding(...)` 装配几何：

```ts
import { buildBuilding } from './building-geometry'
// ...构造 sideMat/topMat/podiumMat/capMat/labelTex（风格相关）...
const { slabs } = buildBuilding({
  group, id, name, w, d, h, floors, fh,
  sideMaterials: [sideMat, sideMat, topMat, topMat, sideMat, sideMat],
  podiumMaterial: podiumMat,   // null = 不画裙座（v2.30 写字楼 office 即走此路）
  capMaterial: capMat,         // null = 不画女儿墙
  dividerColor, edgeColor, edgeOpacity,
  labelTexture: labelTex,
  castShadow: profile.shadows,
  slabSink: meta.slabs,
  kind,                        // v2.30 楼栋类型（缺省 'default' 体块不变）
  balconyMaterial: balconyMat,       // v2.30 residential 阳台挑板（null 不画）
  storefrontMaterial: storefrontMat, // v2.30 commercial 底盘灯带（null 不画）
})
for (const s of slabs) this.pickables.push(s)
```

**铁律**：不要在 ParkScene 里重新手写 podium/body/edges/cap/dividers/label/slab 的 `position.y`——任何一处手写都可能重新引入错位。`setSelection()` 的金色高亮中心 y 必须用 `(fin+0.5)*fh`（与 `buildBuilding` 内 slab 同式）；楼名标签 y 必须是 `h + 22`（v2.1 修复，旧式 `h/2 + 22` 会把标签埋进塔体）。

> 范式实现不依赖范例项目的外部 `DigitalTwin.ts`。旧的「拷贝外部范例」指示在 v2.0 已改为「以本实现为基线」。

## v2.30 楼栋类型化外观（office / residential / commercial）

`spec.buildings[].type` 驱动**构造外观**的类型差异（解决「写字楼和居民楼长得一样」）。**类型只分构造、不分颜色**——所有类型楼栋统一走 category 配色链（`typeColorToken` 仅在用户显式配了 `buildingType` 块时才按类型分色，默认主题不配 → 全类型同色）。核心机制与纪律：

- **`BuildingKind` + `kindOf()`**（`building-geometry.ts` 导出）：spec 字符串 → `'office'|'residential'|'commercial'|'default'`。引擎只认 `BuildingKind`，未知/缺省落 `'default'`——**default 路径每个参数合并结果与 v2.29 逐项相等**（向后兼容锚点）。
- **kind 单点派生 + 显式下传**：`extrudeBuildings` 循环内 `const kind = kindOf(scBld?.type)` 取一次，以**入参**传给 `makeFacadeTexture` / `buildWindowEmissive` / `computeWindowLayout` / `windowMetricsTower` / `windowsTokens` / `buildBuilding`。禁止下游各自回查 spec——保证 albedo 与 emissiveMap 两条路径的 kind 必然一致（防贴图错位第一纪律）。**种子串不含 kind**（`lit:`/`flip:` 种子不变、参数变，两次调用布局仍一致）。
- **维度① 窗户/灯光**（深色两风格）：`windowsTokens(kind)` 四级合并 `DEFAULT_WINDOWS → tokens.windows（风格通用）→ KIND_WINDOWS[kind]（类型签名，压过风格通用值——3 个内置主题都配了完整 windows 块，否则类型差异被抹平）→ tokens.windows.types.<kind>`；新旋钮 `winWRatio`（窗宽占 cell 比，默认 0.5；写字楼 0.82 横带幕墙 / 居民楼 0.34 单元小窗）与 `storefront`（商业底层行替换为贯通恒亮橱窗 cell，不进动画子集）。`emissiveIntensity` 不进 KIND——亮度由风格 token 统一控制（夜景 1.6 是 v2.18 调好的可见性基线），类型只管图案。
- **维度② 立面纹理构造**：日景 pbr 分支走内置 `KIND_FACADE_DAY`（窗框 inset 占比 / 玻璃 HSL / 居民楼窗台线；不进 token 免 schema 膨胀）。颜色不从类型取——`typeColorToken` 解析链 = `tokens.buildingType.<kind>` → `spec.tokens.buildingType.<kind>` → `categoryToken(category)`，前两级默认不存在 → 统一 category 色。
- **维度③ 体块形态**：`building-geometry.ts` 内置 `KIND_MASSING`（保持「纯几何不管材质」纪律——形状在几何层、材质仍由 extrudeBuildings 注入）：office=`podiumMaterial:null` 无裙楼直落；residential=逐层阳台挑板（共享 geometry，`y=i·fh`）；commercial=裙楼 `fh*2.0` 高 ×1.18 平面 + 半高贯通灯带薄盒（裙楼无立面贴图，底层橱窗只能靠几何件表达；深色风格注入暖白 emissive 2.2——折角处被 GTAO 乘弱需补偿，日景注入高亮玻璃色）。
- **预设表是共识不是调参处**：`KIND_WINDOWS`/`KIND_FACADE_DAY`/`KIND_MASSING` 的值是所有园区的类型签名——园区级微调走 token（`windows.types.<kind>` 块；要按类型分色才配 `buildingType` 块），不要改这三张表。

## 渲染管线一览（按风格分支开关）

| 风格 | toneMapping | 阴影 | 环境贴图 (RoomEnvironment PMREM) | Bloom (UnrealBloomPass) | GTAO | 地面反射 (Reflector) | 渐变背景 | 环境光下限 | 程序化地面纹理 |
|---|---|---|---|---|---|---|---|---|---|
| cyber | ACES 1.0 | ✗ | ✗ | ✅ 0.25 | ✗ | ✗ | ✅+暗星 | ✅ | grid shader |
| realistic | ACES 1.0 | ✅ | ✅ | ✅（弱） | ✅ | ✗ | ✅+白云日空 | ✅ | pbr 地面（真实窗户立面） |
| night-realistic | ACES 1.0 | ✅ | ✅ | ✅（强） | ✅ | ✅ Reflector | ✅+星空月色 | ✅ | 湿润反射地面（夜间发光窗） |

环境贴图 / GTAO / 地面反射是 **v2.0 写实增强层保留的引擎能力**（接受 ~15–25% 帧率成本）。**v2.5 起 `realistic`/`night-realistic` 两风格已激活**（RoomEnvironment 环境贴图 + GTAO + 2048² 软阴影；night-realistic 额外开 Reflector 湿润反射 + 雾 + 强 bloom + 夜间发光窗）——以提交的 `assets/themes/realistic|night-realistic.tokens.json` 驱动。**cyber 风格仍守纪律**：无环境贴图、无 AO、PointLight≤8、transmission 禁用、DPR≤2。天空元素开关在各风格 token 的 `scene.sky`（v2.1）。

## token.realism 旋钮（调参表面）

每风格 `assets/themes/<style>.tokens.json` 新增顶层 `realism` 块——这是 v2.0 写实旋钮的**唯一调参处**，生成器不要把数值硬编码进 ParkScene.ts：

```jsonc
"realism": {
  "material":   { "roughness": 0.1, "metalness": 0.9, "envMapIntensity": 1.0 }, // PBR 材质（envMapIntensity 仅在开环境贴图时生效）
  "bloom":      { "threshold": 0.9, "strength": 0.0, "radius": 0.4 },           // strength=0 表示关 composer
  "ao":         { "enabled": true, "intensity": 0.65, "radius": 0.5 },          // GTAO（v2.5 realistic/night-realistic 启用）
  "reflection": { "enabled": false, "opacity": 0.4, "mixStrength": 0.5 },       // 地面湿润反射（v2.5 night-realistic 启用；mixStrength 控制与地面混合）
  "fog":        { "color": "#a9c8e0", "near": 1800, "far": 6500 },              // 线性雾；null 关闭
  "sun":        { "azimuth": 120, "elevation": 48 }                             // 太阳方位（颜色/强度仍走 lights.sun/sunIntensity）
}
```

调参建议：
- **玻璃太像镜子/发白**：降 `material.metalness`、提 `roughness`、降 `material.envMapIntensity`。v2.20 night-realistic 实测基线：`envMapIntensity 2.0→0.3` + `roughness 0.3→0.65` + `metalness 0.15→0.05`（偏哑光混凝土，用户反馈「玻璃反光太强」的解）。
- **整体过曝**：v2.19 起曝光优先走 `realism.exposure` token（`applyProfile` 优先读、缺省回退 `PROFILES.toneExposure`）——降该 token，或提 `bloom.threshold`。**不要直接改 `PROFILES.toneExposure`**（已被 token 覆盖、是死值）。
- **夜景太暗看不清楼/地面**：v2.20 实测 `ambientFloor` 须到 ~1.2（cyber/night-realistic；旧值 ~0.2 在 ACES + 弱光下把受光物体压成近黑）；地面暗另查路灯 PointLight（提 `pointIntensity`/`pointDistance` 扩亮斑）+ reflBack `emissive`（俯视中央不黑）。
- **夜景 bloom 太冲**：v2.20 night-realistic 基线 `bloom.strength 0.18` / `threshold 0.8`（旧 0.45/0.6 已大幅调低）；仍冲就继续降 strength 或提 threshold。
- **星星被 bloom 晕成雪片**（v2.1）：星星 alpha 必须低于 bloom 阈值——已经写死在 `makeBackgroundTexture`（≤0.45），不要调高。
- **地面反射掉帧**：关 `reflection.enabled`（降级为普通深色地面，视觉等价于预烘焙反射纹理）。

## 降级与健壮性（已内置）

- **WebGL2 缺失**：`detectWebGL2()` 在独立探测 canvas 上判定（**绝不**在真实 canvas 上 getContext——会固化上下文属性并让 Three.js 拿到 null）。无 WebGL2 时自动关 AO/反射/PMREM，bloom 仍可用。
- **地面 shader 编译失败**：gridGround.glsl 失败时降级为纯色 + 程序化网格 CanvasTexture（见 `makeGroundTexture`）。
- **context loss**：canvas 监听 `webglcontextlost/restored`，丢失时停 RAF、恢复时重建。
- **dispose 完整**：composer renderTargets / PMREM / Reflector / 所有几何材质纹理都释放。

## 不要做什么

- ❌ 不要把 `realism` 数值硬编码进 ParkScene.ts 的材质构造——一律读 token（v2.5：`ao.radius`/`reflection.mixStrength`/`shadow.radius` 都已接通 token，勿改回硬编码）。
- ❌ 不要为追求「更真实」给 cyber 风格开环境贴图/AO/反射——破坏既有纪律（cyber 靠自发光+bloom）；写实效果只走 `realistic`/`night-realistic` 两风格（其 token 已配好）。
- ℹ️ **发光窗 ≠ 写实引擎**（v2.17）：cyber 现在也走程序化发光窗流水线（emissive+emissiveMap+bloom），这是 emissive 自发光、不属于上面禁开的 envMap/AO/反射，故不破坏纪律。改窗光气质只改对应 `assets/themes/<style>.tokens.json` 的 `windows` 块（2 个深色风格各一块）。
- ℹ️ **夜景楼幢轮廓**（v2.17）：立体轮廓 `EdgesGeometry` 色单独走可选 token `building.edgeColor`（缺省回退 `dividerColor`）。night-realistic 配淡色 `edgeColor`（如 `#a8c0d8`）让楼幢 silhouette 在暗天空下可辨——旧版用极暗 `dividerColor` 轮廓融入背景看不清。逐层虚线分隔仍用 `dividerColor`。
- ℹ️ **地面内外透明**（v2.17）：外圈城市地面全透明（`opacity:0`）、园区内地面保证不透明（cyber 网格 / night Reflector 半透，其下 `y=-0.05` 加不透明衬底）。改外圈透明度/衬底色直接改 `buildGround()`，勿在它处重建地面。
- ❌ 不要在生成时手写 5 文件契约层——4 个静态样板从 `assets/api/` 拷贝（mock 数据由 `generate_data.py` 生成）。
- ❌ 不要在真实 canvas 上 `getContext('webgl2')` 探测——用范式实现的 `detectWebGL2`。
- ❌ 不要每帧重算环境贴图——它是 `buildEnvironmentMap` 一次性烘焙。亮窗 emissiveMap **静态亮窗也是一次性烘焙**（`buildWindowEmissive`），但 v2.15 起夜景开关灯动画允许 **dirty-gated 局部重绘**：仅对动画子集（≤ `windows.animRatio`·窗数、`prefers-reduced-motion` 门控）在翻转/渐变帧 `clearRect`+重绘其小矩形、仅脏帧 `tex.needsUpdate=true`（`updateFacade`）。**禁止整图全量重烘焙** emissiveMap（重现 v2.5 错位 + 性能崩）。
- ❌ 不要把楼名标签 y 改回 `h/2 + 22`（v2.1 修复点，标签会埋进塔体）；不要绕过 token `ui.labelBg/labelText` 自行配标签色（浅色风格会糊成黑块）。
- ❌ 不要在 `buildRoadMarkings`/`buildRooftopKit` 里引入非种子随机（`Math.random`）——重复生成必须一致，用 `mulberry32(hashStr(...))`。

## v2.28 动效层 + 首屏电影入场（2026-07-26）

**目的**：让领导首次看场景有「指挥中心」级视觉冲击——首屏 1.8s 电影入场 + 风格专属签名运动 + 高科技感扫描线。

### 架构：双重门 token 驱动

```ts
interface StyleProfile {
  // ... 既有字段 ...
  fx: {
    scan: boolean           // 雷达脉冲（cyber）
    dataFlow: boolean       // 楼间贝塞尔弧 + 数据包流（cyber）
    pillars: boolean        // 自发光光柱（cyber/night）
    particles: boolean      // 浮粒粉尘（cyber/realistic/night）
    lampCones: boolean      // 路灯头光锥（night）
    godRays: boolean        // 太阳柔光斑（realistic，暂禁）
    stars: boolean          // 星空闪烁（night）
    water: boolean          // 水面 UV 漂移
    fog: boolean            // 线性雾
    scanlines: boolean      // CSS 扫描线
    gridPulse: boolean      // gridGround.glsl 径向波
  }
}
```

`buildFxLayer()` 在 `rebuildScene()` 末、`buildPostFX()` 之前调，按 `this.profile.fx.<key> === true && this.tokens.effects.<key>.enabled === true` 双重门调对应 `build*` 方法。

### 7 个 builder 落地

1. `buildScanField` — PlaneGeometry 覆盖园区，自写 ShaderMaterial 雷达脉冲环（`u_time / u_periodMs / u_ringRadius / u_ringWidth / u_color`）
2. `buildDataFlow` — QuadraticBezierCurve3（主楼→综合楼→服务楼）+ TubeGeometry + Points packet 沿弧 `getPoint(t)`
3. `buildLightPillars` — 6-12 根 CylinderGeometry（顶 r=0.55, 底 r=1.4），6 材质数组（顶亮底暗），`mulberry32(hashStr(style:pillars:count:height:color))` 散布避楼栋 AABB
4. `buildParticles` — Points + 程序化软点 CanvasTexture（`makeSoftDotTexture` 64×64 径向 alpha 衰减）+ AdditiveBlending
5. `buildLampCones` — ConeGeometry(r=3.5, h=60, openEnded) × 5 根（4 角 + 中段），自写 ShaderMaterial 顶亮底暗梯度（`vY` 局部 y 渐变）；振幅 0.4 → 0.18 + 高 110 → 60 让用户可调
6. `buildGodRay` — Sprite（柔光斑 CanvasTexture `makeSunGlowTexture` 256×256 + 4 道射线）+ AdditiveBlending；⚠️ 因 `SpriteMaterial+depthTest:false` 透明区 WebGL 黑底 bug 暂禁（realistic.tokens.json `effects.godRays.enabled:false`），后续改用 Plane+Shader 重写
7. `buildStarField` — 上半球 200-900 高度 N 颗 Points，**opacity 严格 ≤ 0.4**（防 bloom 阈值 0.8 误拾到「雪片」）
8. `buildContactShadows` — 每楼底 CircleGeometry(max(w,d)*0.85) × 3 楼，半透明黑 MeshBasicMaterial

### updateFx() — 每帧推进 6 类动画

构造期仍建 mesh，`reduced-motion` 守卫下整段 no-op。推进项：

```ts
protected updateFx(now: number): void {
  // 1. pillars 呼吸：每柱 opacity = base × (0.85..1.15) sin(2π·t/breatheMs + phaseOffset)
  // 2. gridPulse：gridMat.uniforms.u_time = now * 0.001
  // 3. stars twinkle：starMat.size = base × (0.85..1.15)
  // 4. god ray breath：god.scale = base × (0.92..1.08)
  // 4b. lamp cone breath：cone u_opacity = base × (0.85..1.15)
  // 5. scan 脉冲：scan shader u_time = now * 0.001
  // 6. dataFlow packets：5 颗粒沿弧 getPoint(cycle) 循环
}
```

`animate()` 调 `if (!this.reducedMotion) this.updateFx(performance.now())`，在 `composer.render()` 之前。

### gridGround.glsl 加 3 uniform

```glsl
uniform float u_time;
uniform float u_pulseSpeed;  // cyber=0.6；其余 0
uniform float u_wavelength;  // cyber=24

// in main: 复用 vUv 到 center 偏移 c，长度 dist = length(c)
// if (u_pulseSpeed > 0.0) {
//   float wave = sin(dist * u_wavelength - u_time * u_pulseSpeed) * 0.5 + 0.5;
//   gl_FragColor = vec4(u_gridColor, alpha + wave * vig * 0.22);
// }
```

### 首屏电影入场 playIntro() / stepIntro() / skipIntro()

`realism.intro` token 块控制（默认 `durationMs:1800 / fromDistanceFactor:1.6 / fromElevOffset:10-12 / staggerMs:150`）。`GlobalTwin` 在 `await Promise.allSettled([loadBuildings(), loadPois()])` 完成之后调 `scene?.playIntro?.()`：

```ts
public playIntro(): void {
  if (this.introTween || this.introSkipped || this.reducedMotion) return
  const intro = this.tokens.realism.intro
  if (!intro?.enabled) { this.introSkipped = true; return }
  // 1. 备份 _origCamPos / _origCamZoom
  // 2. 计算 fromPos = toPos 拉远 × fromDistanceFactor + 抬高 fromElevOffsetDeg
  // 3. 立即跳到 fromPos（首帧即拉远位），this.controls.enabled = false
  // 4. 推 introTween = { active, start, dur, fromPos, toPos, fromZoom, toZoom, staggerMs }
}

private stepIntro(now: number): boolean {
  // easeOutCubic(k)；lerp position + zoom；k=1 → 解锁 controls、tween=null、return true
}

private skipIntro(): void {
  // onPointerDown 时若 introTween.active → 还原 _origCamPos / _origCamZoom；controls.enabled=true
}
```

### GlobalTwin + StyleSwitcher 配合

```ts
// GlobalTwin.vue: onMounted 末
scene?.playIntro?.()

// StyleSwitcher.vue: 选中态加呼吸环
.style-chip--active {
  animation: style-chip-pulse 2.4s ease-in-out infinite;
}
@keyframes style-chip-pulse {
  0%, 100% { box-shadow: 0 0 calc(10px * var(--twin-ui-glow-strength)) var(--twin-ui-glow-color); }
  50%      { box-shadow: 0 0 calc(20px * var(--twin-ui-glow-strength)) var(--twin-ui-glow-color); }
}
```

```html
<!-- GlobalTwin.vue: 扫描线 CSS 叠加层 -->
<div class="twin-scanlines" aria-hidden="true" />
```

```css
/* 扫描线（cyber/night 弱）：mix-blend-mode:screen + 4s 动画 */
.twin-scanlines {
  background: repeating-linear-gradient(0deg, transparent 0 2px, var(--twin-effects-scanlines-color) 3px);
  opacity: var(--twin-effects-scanlines-opacity, 0.06);
  animation: twin-scanlines-move var(--twin-effects-scanlines-period-ms, 4000ms) linear infinite;
}
```

### 已知问题（v2.28 遗留）

- **god ray 暂禁**（realistic）：`SpriteMaterial + depthTest:false` 透明区 WebGL 黑底 bug——alpha=0 区域 + AdditiveBlending + premultiplied RGB=white 出现黑底色块。后续改用 `Plane+Shader` 重写（自定义 fragment 在 alpha<0.01 处 `discard`）。
- **water UV 漂移未驱动**：状态已记录于 `fxMats.waterNormal`（仅占位），可见性靠既有 reflector 写实引擎；后续用 `material.onBeforeCompile` 改 shader。
- **skill 模板回写完整闭环**：本次只改 park-digital-twin 工程，tokens/styles.md/scene-recipe.md §16/park-scene-impl.md v2.28 段已随本次同步更新（changelog 已记）。

### 性能预算

构造期每个 effect builder < 1ms（缓存辅助纹理）。`updateFx()` 每帧 < 0.1ms（仅读写 uniform / opacity）。60fps 稳定（low-end 笔记本 3 风格切换 < 50ms rebuild）。


## 与其它参考的关系

- 渲染步骤的「为什么」与逐风格材质/灯光说明仍在 `scene-recipe.md`（§2 渲染器、§3 地面）与 `styles.md`（每风格段）——本文件是「怎么落地」的实现基线，那两份是「为什么这么设计」的规范。冲突时以本实现的代码为准，并回填到规范。
- spec 字段如何映射到脚手架/水合见 `park-spec.md`、`dynamic-data-api.md`。
- 选中态/相机补间/POI 契约见 `scene-recipe.md` §8、§11——范式实现已照抄，勿临场改写。

## v2.28.1 增量（2026-07-26）—— 已迁移至 v2.29.0 历史

**赛博/夜景瘦身（解决「连线和竖线太多」）**。全部 token 驱动，代码侧只增不改；v2.29.0 删除 isometric 后，赛博/夜景瘦身条款随 `isometric` 整风格一并下线（isometric 唯一独占的「等距 toon outline」段已不适用，本节保留历史供追溯）。

### A. 赛博/夜景瘦身

- **token 改动**：仅 2 个 JSON，`enabled: true → false`：
  - `cyber.tokens.json`: `dataFlow.enabled: false`、`pillars.enabled: false`
  - `night-realistic.tokens.json`: `pillars.enabled: false`
- **保留**：cyber 留 `particles` + `scanlines`；night 留 `lampCones` + `particles` + `stars` + water + 弱 scanlines
- **代码不删**：`buildLightPillars` / `buildDataFlow` builder + `updateFx` 呼吸/packet 逻辑完整保留——双重门 token 化，将来其它风格启用零代码改动
- **per-style 效果矩阵（v2.28.1）**：

| 风格 | 启用效果 |
|---|---|
| cyber | particles + scanlines（v2.28 启用 6 项 → 现 2 项） |
| realistic | particles + water（不变） |
| night-realistic | lampCones + particles + stars + water（v2.28 启用 5 项 → 现 4 项，删 pillars） |


