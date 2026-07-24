# 风格（Styles）—— 6 种视觉模板

园区数字孪生支持 6 种视觉风格，由 `spec.style` 选择（步骤 3 用 `AskUserQuestion` 让用户挑，默认 `cyber`）。每种风格的**配色唯一事实来源**是对应的 token 文件：

| `spec.style` | 风格 | 配色文件 | 着色器地面 | 写实引擎 |
|---|---|---|---|---|
| `cyber`（默认） | 赛博 | `assets/themes/cyber.tokens.json` | ✅ 霓虹青网格 | ❌ |
| `holographic` | 全息（未来科技） | `assets/themes/holographic.tokens.json` | ❌ | ❌ |
| `nebula` | 深空星云（科幻指挥中心） | `assets/themes/nebula.tokens.json` | ❌ | ❌ |
| `isometric` | 等距插画（信息图） | `assets/themes/isometric.tokens.json` | ❌ | ❌ |
| `realistic` | 写实日景 | `assets/themes/realistic.tokens.json` | ❌ | ✅ envMap+GTAO+软阴影 |
| `night-realistic` | 写实夜景 | `assets/themes/night-realistic.tokens.json` | ❌ | ✅ envMap+GTAO+软阴影+反射+雾+强bloom |

**写实两风格**以**提交的 token 文件**激活 `assets/park-scene.impl.ts` 内置的写实能力——`RoomEnvironment` PMREM 环境贴图（玻璃/金属真实反射、不发黑）、`GTAOPass` 接触阴影、2048² `PCFSoftShadowMap` 软阴影、`Reflector` 夜间湿润地面反射、线性雾、`UnrealBloomPass`（夜景窗光/路灯辉光）。写实立面为真实窗户网格；**夜间（night-realistic）走 Park 驾驶舱同款程序化发光窗流水线**（v2.15）：双纹理（`map` 全窗 + `emissiveMap` 仅亮窗辉光）、逐层砖错位面板窗（塔体 `roomsAxisTower` 3 列；`roomsAxisPodium` 5 列已入 schema/`tokens.windows` 预留，当前 facade 仅绘塔体）、分层点亮（底层 0% / 中层 0.38 / 顶层 0.22）、暖冷双辉光（70/30）、`animRatio=0.2` 的窗户 dirty-gated 开关灯翻转动画（`prefers-reduced-motion` 关闭）。旋钮走可选 `tokens.windows` 块（缺省 `DEFAULT_WINDOWS`；`animRatio=0` 退化为静态烘焙）。**不要手改 `PROFILES` 表或临场编写实 token**——改观感只改对应 `assets/themes/<style>.tokens.json` 的 `realism` 块 / `windows` 块（旋钮说明见 `park-scene-impl.md` + `scene-recipe.md §15`）。

**网格着色器的归属**：只有 `cyber` 接入 `gridGround.glsl`。其余 5 种风格跳过 shader 地面，但都叠一层 `makeGroundTexture` 程序化 `CanvasTexture`（holographic/nebula 用 `dots`、isometric 用 `grid`）——不再是纯色色片。

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色（§4）、车库入口标记（§5）、地面车位（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建。

**跨风格纪律**（实现细节见 `scene-recipe.md §2` 与 `park-scene-impl.md`）：
- **灯光色走 token**：每风格 token 顶层 `lights` 块（`sun`/`hemiSky`/`hemiGround`/`ambient`/`ambientFloor` + intensity）。`ambientFloor` 是防黑屏的环境光下限（暗色风格 ~0.18–0.20、亮色风格 ~0.08）。
- **`outputColorSpace = SRGB` 统一**：所有走 ACES toneMapping 的风格（cyber/holographic/nebula/realistic/night-realistic）必须显式设；isometric 用 `NoToneMapping`。
- **`devicePixelRatio` 上限 2** + **材质能降则降**（`roughness ≥ 0.9 && metalness == 0` 用 `MeshLambertMaterial`）。
- **程序化天空（token `scene.sky`）**：nebula 开星空+月亮；holographic 开稀疏星点（须低于 bloom 阈值）；cyber/isometric 无天空元素。
- **`ui` 块**：2D 组件观感旋钮（`panelOpacity/panelBlur/panelRadius/glowStrength/glowColor/borderWidth/labelBg/labelText/switcherStyle`）。赛博/全息/nebula = neon 描边发光 pill；等距 = flat 克制。
- **程序化地面纹理 `ground.texture`**（`{type, base, line, cell}`）：非 cyber 风格地面叠一层 CanvasTexture（见 `scene-recipe.md §3.1`）。
- **地面装饰可读性**：`buildGreenery` 统一走装饰材质 helper；cyber/holographic/nebula 用不受光材质 + `environment.decorOutline`，night-realistic 用 Standard + `environment.decorEmissive`，避免草地、树冠、灌木、广场和水景在暗色背景中融成黑块。realistic/isometric 分别保持 PBR 与 flatShading。

---

## cyber（赛博，默认）

完整配方见 `references/scene-recipe.md` §2–§3。要点：
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；`outputColorSpace = SRGB`；`EffectComposer` 可选（仅当要用 bloom 时）。DPR ≤ 2。
- **灯光**：刻意平——`HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` + 柔和 `DirectionalLight(lights.sun, lights.sunIntensity)` + `ambientFloor` 兜底。不要 VSM 阴影 / PMREM。
- **地面**：`gridGround.glsl` 着色器平面（青色网格 + 径向晕影）。shader 失败时降级为纯色 + 网格 CanvasTexture。
- **后处理**：`UnrealBloomPass` 强度建议 ≥0.25（~0.15 在 ACES 下几乎不可见）。
- **楼栋材质**：`MeshStandardMaterial`，`emissive = color`、`emissiveIntensity ≈ 0.12`，配程序化幕墙 + 楼层环线 + 屋顶 EdgesGeometry。贴砖按 §4.1（`roomShade` ~0.16，相邻两色交替 + 亮青竖实线分隔）。
- **环境材质**：道路深蓝灰 `MeshBasicMaterial`（轻微自发光）；车道线/标线用自发光青色 `Line2`；草地暗紫青；路灯灯头自发光青/白**不挂 PointLight**（赛博靠自发光+bloom 表现灯光）。
- **标签对比（§4.2）**：「深底亮字」——底取深色，字取亮霓虹 + 霓虹描边。
- **车库入口/地面车位/POI**：半金字塔三角门 `MeshBasicMaterial` + 自发光边；地面车位为长方形铺装 + 自发光描边 + 每位印 P + ~30% 自发光车辆；POI 图标按 `poi.<type>` 自发光色 + 高对比底。

---

## holographic（全息 / 未来科技）

目标「高端未来科技感」——半透玻璃体 + 边缘辉光 + bloom。「净版未来风」。
- **渲染器**：`ACESFilmicToneMapping`；`outputColorSpace = SRGB`；关闭 `shadowMap`（全息靠辉光分层）。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR（会把半透体照得浑浊）；极低强度 `HemisphereLight` + `AmbientLight` 保留通透感 + `ambientFloor` 兜底。
- **地面**：不接网格着色器。深色 `MeshBasicMaterial`（近黑）大平面 + 自发光青色 `Line2` 园区轮廓勾边 + 叠 `dots` 青色点阵 CanvasTexture，消灭死黑地板。
- **楼栋材质**：**半透体 + 边缘辉光**（菲涅尔 rim 廉价近似）——
  - 体：`MeshStandardMaterial({ color: category.building, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.2 })`。
  - 边：高亮自发光青色 `EdgesGeometry`/`Line2`（`cyan-bright`），楼栋轮廓在暗底发光——全息感来源。
  - ⛔ **禁用 `MeshPhysicalMaterial transmission`**：与 bloom 叠加是性能黑洞，且暗底下视觉与「半透 Standard + 自发光边」几乎无差别。菲涅尔 rim 用 `onBeforeCompile` 注入 `assets/fresnelRim.glsl` 做廉价近似——唯一推荐的边缘辉光增强路径。
  - 贴砖按 §4.1（`roomShade` ~0.14，自发光青竖实线分隔）。
- **后处理**：`UnrealBloomPass` 强度 ~0.3——半透体边缘/轮廓在暗底溢出是全息感灵魂。优先选择性 bloom。
- **环境材质**：极暗深空底 + 自发光青色标线/勾边；路灯灯头自发光青小点不挂 `PointLight`。
- **标签对比**：「深底 + 自发光青亮字」。
- **车库入口/地面车位/POI**：半透 `MeshStandardMaterial` + 自发光青 `EdgesGeometry` 描边；地面车位近黑铺装 + 自发光青描边 + 每位印 P；POI 图标自发光色 + 深底 + bloom。

---

## nebula（深空星云 / 科幻指挥中心）

**复用全息渲染路径**（半透体 + 菲涅尔 rim + bloom），换成**深空紫蓝星云**调色，用星点 + 月亮的天空层与 cyber 拉开差异：「漂浮在宇宙中的全息投影」。
- **渲染器**：`ACESFilmicToneMapping`；`outputColorSpace = SRGB`；关闭 `shadowMap`。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR（同全息）；`scene.background` 顶→底渐变（`bgTop` 深紫 → `bgBottom` 近黑），叠星点 + 月亮（`scene.sky.stars`/`moon` 全开）——深空感来源。
- **灯光**：低强度 `HemisphereLight`（偏紫蓝）+ `AmbientLight` + `ambientFloor` 兜底。
- **地面**：不接网格着色器。近黑 `MeshBasicMaterial` + 自发光品红 `Line2` 轮廓勾边 + 叠 `dots` 品红点阵 CanvasTexture。
- **楼栋材质**：**半透体 + 边缘辉光（菲涅尔 rim）**——building mode `holo` + `useRim:true`：
  - 体：`MeshStandardMaterial({ color: category.building 淡紫, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.35 })`。
  - 边：高亮自发光**品红/青双色** `EdgesGeometry`/`Line2`。菲涅尔 rim 用 `onBeforeCompile` 注入 `assets/fresnelRim.glsl`。⛔ 禁用 `transmission`（同全息）。
  - 贴砖按 §4.1（`roomShade` ~0.14，自发光淡紫竖实线分隔）。
- **后处理**：`UnrealBloomPass` 强度 ~0.5（高于全息）——边缘/轮廓/POI 在深空底强烈溢出是星云指挥中心感灵魂。优先选择性 bloom。
- **环境材质**：深空底 + 自发光品红/青标线/勾边；路灯灯头自发光品红/青小点不挂 `PointLight`。
- **标签对比**：「深空底 + 自发光品红/青亮字」。

---

## isometric（等距插画 / 信息图）

目标「扁平但好看的友好信息图」——cel 着色感的彩色楼栋，鲜活但和谐。
- **渲染器**：`NoToneMapping`（保持饱和、色值可预测）；`outputColorSpace = SRGB`；关闭 `shadowMap`（插画风靠 flatShading 面明度分层，不靠投影）。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR。
- **灯光**：一盏暖色 `DirectionalLight`（**从等轴斜上方**与相机同向）——让 `flatShading` 每个面得到不同平涂明度，形成 cel/插画感；可加低强度 `HemisphereLight` 补暗部。⛔ **DO-NOT-ENABLE-SHADOWS**——方向光锁定相机方向，若开投影，背面/侧面阴影随相机旋转错乱，破坏插画风。
- **地面**：不接网格着色器。暖色扁平 `MeshLambertMaterial({ color: palette.city-ground, flatShading: true })` + 叠 `grid` 暖色细网格 CanvasTexture，地面有插画铺装感。
- **楼栋材质**：**flatShading cel 着色**——`MeshLambertMaterial({ color: category.building, flatShading: true })`（metalness=0 时与 Standard 视觉一致、~30% 更便宜）。**`flatShading: true` 是关键**：几何体每个面被当作平涂色块，配方向光得到 cel 明度阶梯。贴砖按 §4.1（`roomShade` ~0.18 强化 cel 阶梯，深海军蓝竖实线分隔）。
- **后处理**：无 bloom。
- **环境材质**：鲜活但和谐的插画配色——道路暖棕沥青、车道线奶油色、草地鲜绿、树冠鲜绿，全部 `flatShading`；路灯灯头暖色小球不发光。
- **标签对比**：「暖白底 + 深海军蓝字」，不发光、保持扁平插画统一。

---

## 选择与换肤

- **首次生成**：步骤 3 用 `AskUserQuestion` 让用户在 6 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 部分覆盖），重新派生 `tokens.css`/`theme.ts`/Three.js 材质。`cyber` 消费 grid 着色器、其余 5 种不消费——换到/换自 `cyber` 时记得接入或移除 grid pass。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。
- **地下场景**：每个风格 token 都有 `underground` 块（deck/wall/edge/room/spot/ramp + deckOpacity/wallOpacity）。地下坑体材质由 `ParkScene.undergroundMaterials()` 按 `profile.building` 分支——cyber/holographic/nebula/night-realistic 走自发光 `MeshStandardMaterial`（地下无独立光照，靠 emissive 才可见）；realistic 走 PBR 受光；isometric 走 `flatShading` Lambert。换肤时改 `underground` 值即可统一改地下配色（单一事实来源，禁手写 hex）。详见 `scene-recipe.md §14`。
