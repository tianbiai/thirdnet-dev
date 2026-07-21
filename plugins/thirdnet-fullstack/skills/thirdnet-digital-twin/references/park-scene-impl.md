# 范式实现导读（ParkScene.impl）

> v2.0 新增。这是 `assets/park-scene.impl.ts`（范式实现）的使用说明。生成器**以本实现为基线「拷贝-改」**，而不是从 scene-recipe.md 的散文合成——后者已证明会让 LLM 漂移，丢掉环境贴图 / bloom / 环境光下限 / 渐变背景等真实感关键环节。

## 为什么要有范式实现

v1.x 的生成路径是「读 scene-recipe.md 散文 + 指向未随技能发布的 `DigitalTwin.ts`（exemplar.md 反复说『拷贝它、修剪它』）」。实测生成代码会漂移：金属材质无环境贴图导致玻璃发黑、`profile.bloom` 是死配置从不实例化 composer、`ambientFloor`/`scene.background` 写在规范里却被跳过。

范式实现把这些问题一次性解决：**技能随包发布一份完整、可直接 `cp` 的 `ParkScene.ts`**，所有 v1.9 漂移项与 v2.0 写实增强层都已落地。生成器只需替换数据源、按 spec 选风格，无需重新合成 Three.js 渲染管线代码。

## v2.1 新增：真实感细节层 + 四个实测 bug 修复

**真实感细节层**（全部固化，参数写死或走 token 新块，随机一律 `mulberry32(hashStr(...))` 确定性种子）：

| 元素 | 实现 | token 驱动 |
|---|---|---|
| 程序化天空 | `makeBackgroundTexture` 升级版（canvas 512×256）：写实白云（3–6 朵椭圆组合）、夜景星空（130 颗亚像素暗星——**必须低于 bloom 阈值，否则晕成雪片**）+ 月亮（右上径向光晕） | `scene.sky: {clouds, stars, moon}` 开关 |
| 楼顶设备 | `building-geometry.ts` 新增 `buildRooftopKit()`：电梯机房盒（w·0.18 × fh·0.5 × d·0.22）+ 1–2 根天线 + night-realistic 红色警示灯；位置种子 = `rooftop:{buildingId}` | `environment.rooftop` 色 |
| 地面标线 | `buildRoadMarkings()`：环路/主路中央虚线（InstancedMesh 12×2 段）+ 大门斑马线（6×2.5×20）+ 引道（连接大门与环路）+ 引导箭头 | `environment.roadMarking` 色 |
| 绿化多样性 | 行道树球形（Icosahedron）/锥形（Cone）按位置序奇偶交替 + 草地边缘灌木球丛（每块 6 丛，种子确定性） | 沿用 `environment.treeCanopy` |
| 水景 | `greenery.waterFeature` 终于落地：Circle(50) 水面 + Ring 池缘；写实两风格低粗糙度 Standard 材质吃 envMap 反射 | `environment.water` 色 |
| POI 悬停 | `ParkSceneCallbacks.onPoiHover`——驱动 HTML 名称条（§11「名称仅悬停」契约补齐） | — |

**四个 v2.0 实测 bug 修复**（都在范式实现里，拷贝即修复）：

1. **楼名标签埋进塔体**：`building-geometry.ts` 旧式 `label.y = h/2 + 22`——高楼（h > 44）标签被埋进塔体内部不可见。修复为 `y = h + 22`（屋顶上方）。
2. **浅色风格标签黑块**：旧式标签配对 `(void-bg, cyan-bright)` 在 realistic/white-model/isometric 两字色都偏亮，违反 §4.2「亮底深字 / 暗底亮字」。修复为走 token `ui.labelBg/labelText`（7 风格各自的高对比配对）。
3. **取景偏小**：`frameCamera()` 旧式用默认 18 层估算 Hmax——实际楼层更少时园区只占画面 ~1/3。修复为水合后用真实最高楼层（`maxBuildingHeight()`），`hydrateBuildings()` 末尾重新 `frameCamera()`。
4. **`buildCorridor` 空指针**：未配置 `scaffold.corridor` 的园区 `c.floor` 直接抛 TypeError。修复为 `if (!c) return`。

## 怎么用（生成器工作流）

1. **拷贝两个文件**：`cp assets/park-scene.impl.ts <目标项目>/src/scene/ParkScene.ts` **和** `cp assets/building-geometry.ts <目标项目>/src/scene/building-geometry.ts`（缺一不可——后者是楼栋几何装配的单一事实来源）。
2. **改数据源**：把脚手架类型（`ParkScaffold`、`ScaffoldBuilding`、`BuildingRuntimeItem`、`PoiRuntimeItem`）对齐到本项目的 `src/data/<park>.ts` 与 `src/api/types/digital-twin.ts`（见 `dynamic-data-api.md`）。这些是结构契约，字段名不要改。v2.1 起 `src/data/<park>.ts` 由 `scripts/generate_data.py` 生成（含 `ParkScaffold` 接口定义），通常无需再改。
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
  podiumMaterial: podiumMat,   // null = 不画裙座
  capMaterial: capMat,         // null = 不画女儿墙
  dividerColor, edgeColor, edgeOpacity,
  labelTexture: labelTex,
  castShadow: profile.shadows,
  slabSink: meta.slabs,
})
for (const s of slabs) this.pickables.push(s)
```

**铁律**：不要在 ParkScene 里重新手写 podium/body/edges/cap/dividers/label/slab 的 `position.y`——任何一处手写都可能重新引入错位。`setSelection()` 的金色高亮中心 y 必须用 `(fin+0.5)*fh`（与 `buildBuilding` 内 slab 同式）；楼名标签 y 必须是 `h + 22`（v2.1 修复，旧式 `h/2 + 22` 会把标签埋进塔体）。

> 范式实现不依赖范例项目的外部 `DigitalTwin.ts`。exemplar.md 的「拷贝外部范例」指示在 v2.0 已改为「以本实现为基线」。

## 渲染管线一览（按风格分支开关）

| 风格 | toneMapping | 阴影 | 环境贴图 (RoomEnvironment PMREM) | Bloom (UnrealBloomPass) | GTAO | 地面反射 (Reflector) | 渐变背景 | 环境光下限 | 程序化地面纹理 |
|---|---|---|---|---|---|---|---|---|---|
| realistic | ACES 1.1 | ✓ | ✅ | ✗（日间） | ✅ | ✗ | ✅+白云 | ✅ | tiles |
| night-realistic | ACES 0.95 | ✓ | ✅ | ✅ 0.45 | ✅ | ✅ | ✅+星月 | ✅ | tiles |
| cyber | ACES 1.0 | ✗ | ✗ | ✅ 0.25 | ✗ | ✗ | ✅+暗星 | ✅ | grid shader |
| holographic | ACES 1.0 | ✗ | ✗ | ✅ 0.3 | ✗ | ✗ | ✅+暗星 | ✅ | dots |
| blueprint | None | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid shader |
| white-model | ACES 1.05 | ✓ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid |
| isometric | None | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid |

**放宽上限仅限 realistic / night-realistic**（环境贴图 + GTAO，夜再 + 地面反射），接受 ~15–25% 帧率成本。其余 5 风格守纪律：无环境贴图、无 AO、PointLight≤8、transmission 禁用、DPR≤2。天空元素开关在各风格 token 的 `scene.sky`（v2.1）。

## token.realism 旋钮（调参表面）

每风格 `assets/themes/<style>.tokens.json` 新增顶层 `realism` 块——这是 v2.0 写实旋钮的**唯一调参处**，生成器不要把数值硬编码进 ParkScene.ts：

```jsonc
"realism": {
  "material":   { "roughness": 0.1, "metalness": 0.9, "envMapIntensity": 1.0 }, // PBR 材质（envMapIntensity 仅在开环境贴图时生效）
  "bloom":      { "threshold": 0.9, "strength": 0.0, "radius": 0.4 },           // strength=0 表示关 composer
  "ao":         { "enabled": true, "intensity": 0.65, "radius": 0.5 },          // GTAO（写实两风格）
  "reflection": { "enabled": false, "opacity": 0.4, "mixStrength": 0.5 },       // 地面湿润反射（夜间）
  "fog":        { "color": "#a9c8e0", "near": 1800, "far": 6500 },              // 线性雾；null 关闭
  "sun":        { "azimuth": 120, "elevation": 48 }                             // 太阳方位（颜色/强度仍走 lights.sun/sunIntensity）
}
```

调参建议：
- **玻璃太像镜子/发白**：降 `material.metalness`（0.9→0.8）、提 `roughness`（0.1→0.2）、降 `material.envMapIntensity`。
- **整体过曝**：降该风格 `profile.toneExposure`（在 ParkScene.ts 的 PROFILES）或 token 调不动时改这里；或提 `bloom.threshold`。
- **夜景太暗看不清楼**：提 `lights.ambientFloor`（0.18→0.22）或 `sunIntensity`。
- **夜景 bloom 太冲**：降 `bloom.strength`（0.45→0.3）、提 `bloom.threshold`（0.5→0.7）。
- **星星被 bloom 晕成雪片**（v2.1）：星星 alpha 必须低于 bloom 阈值——已经写死在 `makeBackgroundTexture`（≤0.45），不要调高。
- **地面反射掉帧**：关 `reflection.enabled`（降级为普通深色地面，视觉等价于预烘焙反射纹理）。

## 降级与健壮性（已内置）

- **WebGL2 缺失**：`detectWebGL2()` 在独立探测 canvas 上判定（**绝不**在真实 canvas 上 getContext——会固化上下文属性并让 Three.js 拿到 null）。无 WebGL2 时自动关 AO/反射/PMREM，bloom 仍可用。
- **地面 shader 编译失败**：gridGround.glsl 失败时降级为纯色 + 程序化网格 CanvasTexture（见 `makeGroundTexture`）。
- **context loss**：canvas 监听 `webglcontextlost/restored`，丢失时停 RAF、恢复时重建。
- **dispose 完整**：composer renderTargets / PMREM / Reflector / 所有几何材质纹理都释放。

## 不要做什么

- ❌ 不要把 `realism` 数值硬编码进 ParkScene.ts 的材质构造——一律读 token。
- ❌ 不要为追求「更真实」给非写实风格开环境贴图/AO/反射——破坏既有纪律（cyber/holo 靠自发光、blueprint 靠线框、white-model/iso 靠哑光）。
- ❌ 不要在真实 canvas 上 `getContext('webgl2')` 探测——用范式实现的 `detectWebGL2`。
- ❌ 不要每帧重算环境贴图/亮窗 emissiveMap——范式实现里它们都是一次性烘焙（`buildEnvironmentMap` / `makeFacadeTexture`）。
- ❌ 不要把楼名标签 y 改回 `h/2 + 22`（v2.1 修复点，标签会埋进塔体）；不要绕过 token `ui.labelBg/labelText` 自行配标签色（浅色风格会糊成黑块）。
- ❌ 不要在 `buildRoadMarkings`/`buildRooftopKit` 里引入非种子随机（`Math.random`）——重复生成必须一致，用 `mulberry32(hashStr(...))`。

## 与其它参考的关系

- 渲染步骤的「为什么」与逐风格材质/灯光说明仍在 `scene-recipe.md`（§2 渲染器、§3 地面）与 `styles.md`（每风格段）——本文件是「怎么落地」的实现基线，那两份是「为什么这么设计」的规范。冲突时以本实现的代码为准，并回填到规范。
- spec 字段如何映射到脚手架/水合见 `park-spec.md`、`dynamic-data-api.md`。
- 选中态/相机补间/POI 契约见 `scene-recipe.md` §8、§11——范式实现已照抄，勿临场改写。

