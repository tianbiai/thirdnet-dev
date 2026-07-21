# 范式实现导读（ParkScene.impl）

> v2.0 新增。这是 `assets/park-scene.impl.ts`（范式实现）的使用说明。生成器**以本实现为基线「拷贝-改」**，而不是从 scene-recipe.md 的散文合成——后者已证明会让 LLM 漂移，丢掉环境贴图 / bloom / 环境光下限 / 渐变背景等真实感关键环节。

## 为什么要有范式实现

v1.x 的生成路径是「读 scene-recipe.md 散文 + 指向未随技能发布的 `DigitalTwin.ts`（exemplar.md 反复说『拷贝它、修剪它』）」。实测生成代码会漂移：金属材质无环境贴图导致玻璃发黑、`profile.bloom` 是死配置从不实例化 composer、`ambientFloor`/`scene.background` 写在规范里却被跳过。

范式实现把这些问题一次性解决：**技能随包发布一份完整、可直接 `cp` 的 `ParkScene.ts`**，所有 v1.9 漂移项与 v2.0 写实增强层都已落地。生成器只需替换数据源、按 spec 选风格，无需重新合成 Three.js 渲染管线代码。

## 怎么用（生成器工作流）

1. **拷贝两个文件**：`cp assets/park-scene.impl.ts <目标项目>/src/scene/ParkScene.ts` **和** `cp assets/building-geometry.ts <目标项目>/src/scene/building-geometry.ts`（缺一不可——后者是楼栋几何装配的单一事实来源）。
2. **改数据源**：把脚手架类型（`ParkScaffold`、`ScaffoldBuilding`、`BuildingRuntimeItem`、`PoiRuntimeItem`）对齐到本项目的 `src/data/<park>.ts` 与 `src/api/types/digital-twin.ts`（见 `dynamic-data-api.md`）。这些是结构契约，字段名不要改。
3. **选风格**：`spec.style` 决定 `PROFILES` 的取值——**不要手改 profile 表**；要调某个风格的观感，改 `assets/themes/<style>.tokens.json` 的 `realism` 块（见下）。
4. **校验**：`npm run typecheck` 干净 + `python scripts/validate_spec.py spec.json` OK（v2.0 起含 token schema 校验）。

## 楼栋几何装配 = `building-geometry.ts`（不要手写）

楼栋的立体轮廓半埋地下、金色楼层高亮偏移，根因都是 podium/body/edges/cap/dividers/label/slabs 的 y 坐标各自手算、彼此错位。所以这套装配抽成了 `assets/building-geometry.ts` 的 `buildBuilding(opts)` 纯函数——**所有 y 坐标只在此文件定义一次**。

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

**铁律**：不要在 ParkScene 里重新手写 podium/body/edges/cap/dividers/label/slab 的 `position.y`——任何一处手写都可能重新引入错位。`setSelection()` 的金色高亮中心 y 必须用 `(fin+0.5)*fh`（与 `buildBuilding` 内 slab 同式）。

> 范式实现不依赖范例项目的外部 `DigitalTwin.ts`。exemplar.md 的「拷贝外部范例」指示在 v2.0 已改为「以本实现为基线」。

## 渲染管线一览（按风格分支开关）

| 风格 | toneMapping | 阴影 | 环境贴图 (RoomEnvironment PMREM) | Bloom (UnrealBloomPass) | GTAO | 地面反射 (Reflector) | 渐变背景 | 环境光下限 | 程序化地面纹理 |
|---|---|---|---|---|---|---|---|---|---|
| realistic | ACES 1.1 | ✓ | ✅ | ✗（日间） | ✅ | ✗ | ✅ | ✅ | tiles |
| night-realistic | ACES 0.95 | ✓ | ✅ | ✅ 0.45 | ✅ | ✅ | ✅ | ✅ | tiles |
| cyber | ACES 1.0 | ✗ | ✗ | ✅ 0.25 | ✗ | ✗ | ✅ | ✅ | grid shader |
| holographic | ACES 1.0 | ✗ | ✗ | ✅ 0.3 | ✗ | ✗ | ✅ | ✅ | dots |
| blueprint | None | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid shader |
| white-model | ACES 1.05 | ✓ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid |
| isometric | None | ✗ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | grid |

**放宽上限仅限 realistic / night-realistic**（环境贴图 + GTAO，夜再 + 地面反射），接受 ~15–25% 帧率成本。其余 5 风格守纪律：无环境贴图、无 AO、PointLight≤8、transmission 禁用、DPR≤2。

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

## 与其它参考的关系

- 渲染步骤的「为什么」与逐风格材质/灯光说明仍在 `scene-recipe.md`（§2 渲染器、§3 地面）与 `styles.md`（每风格段）——本文件是「怎么落地」的实现基线，那两份是「为什么这么设计」的规范。冲突时以本实现的代码为准，并回填到规范。
- spec 字段如何映射到脚手架/水合见 `park-spec.md`、`dynamic-data-api.md`。
- 选中态/相机补间/POI 契约见 `scene-recipe.md` §8、§11——范式实现已照抄，勿临场改写。
