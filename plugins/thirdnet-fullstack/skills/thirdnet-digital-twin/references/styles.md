# 风格（Styles）—— 4 种视觉模板

园区数字孪生支持 4 种视觉风格，由 `spec.style` 选择（步骤 3 用 `AskUserQuestion` 让用户挑，默认 `cyber`）。每种风格的**配色唯一事实来源**是对应的 token 文件：

| `spec.style` | 风格 | 配色文件 | 着色器地面 | 写实引擎 |
|---|---|---|---|---|
| `cyber`（默认） | 赛博 | `assets/themes/cyber.tokens.json` | ✅ 霓虹青网格 | ❌ |
| `isometric` | 等距插画（信息图） | `assets/themes/isometric.tokens.json` | ❌ | ❌ |
| `realistic` | 写实日景 | `assets/themes/realistic.tokens.json` | ❌ | ✅ envMap+GTAO+软阴影 |
| `night-realistic` | 写实夜景 | `assets/themes/night-realistic.tokens.json` | ❌ | ✅ envMap+GTAO+软阴影+反射+雾+强bloom |

**写实两风格**以**提交的 token 文件**激活 `assets/park-scene.impl.ts` 内置的写实能力——环境贴图（**v2.19 起改用 `public/sky.hdr` CC0 户外 HDRI 的 PMREM 烘焙**，玻璃反射与天空方向/色温一致，替代旧 `RoomEnvironment` 室内工作室烘焙；HDRI 异步加载、首帧 `RoomEnvironment` 兜底、加载完一次性重建）、`GTAOPass` 接触阴影、2048² `PCFSoftShadowMap` 软阴影、`Reflector` 夜间湿润地面反射、线性雾、`UnrealBloomPass`（夜景窗光/路灯辉光）。**v2.19：写实 `pbr` 楼体升级 `MeshPhysicalMaterial`（消费 `realism.material.clearcoat`/`clearcoatRoughness`，玻璃幕墙漆面反射）；所有 composer 风格后处理链加 `SMAAPass`（composer 绕过渲染器 MSAA）；曝光改由 `realism.exposure` 驱动（缺省回退 `PROFILES.toneExposure`）；等距风格楼底加 `CircleGeometry` 伪接触阴影。**写实立面为真实窗户网格；**v2.17 起全部 2 个深色风格（cyber/night-realistic）均走 Park 驾驶舱同款程序化发光窗流水线**（v2.15 引入 night-realistic，v2.17 扩到其余深色风格；realistic 日景仍画静态窗户网格、isometric 仍贴砖）：双纹理（`map` 全窗 + `emissiveMap` 仅亮窗辉光）、逐层砖错位面板窗（塔体 `roomsAxisTower` 3 列；`roomsAxisPodium` 5 列已入 schema/`tokens.windows` 预留，当前 facade 仅绘塔体）、分层点亮（底层 0% / 中层 0.38 / 顶层 0.22）、暖冷双辉光（70/30）、`animRatio=0.2` 的窗户 dirty-gated 开关灯翻转动画（`prefers-reduced-motion` 关闭）。旋钮走可选 `tokens.windows` 块（2 个深色风格 token 各配一块；缺省 `DEFAULT_WINDOWS`；`animRatio=0` 退化为静态烘焙）。**发光窗是 emissive、不属于写实引擎**（envMap/GTAO/反射/软阴影/雾仍只 realistic/night-realistic 启用）——故给 cyber 加窗不破坏既有纪律。**不要手改 `PROFILES` 表或临场编写实 token**——改观感只改对应 `assets/themes/<style>.tokens.json` 的 `realism` 块 / `windows` 块 / `building.edgeColor`（旋钮说明见 `park-scene-impl.md` + `scene-recipe.md §15`）。

**网格着色器的归属**：只有 `cyber` 接入 `gridGround.glsl`。其余 3 种风格跳过 shader 地面，但都叠一层 `makeGroundTexture` 程序化 `CanvasTexture`（isometric 用 `grid`）——不再是纯色色片。

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色（§4）、车库入口标记（§5）、地面车位（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建。

**跨风格纪律**（实现细节见 `scene-recipe.md §2` 与 `park-scene-impl.md`）：
- **灯光色走 token**：每风格 token 顶层 `lights` 块（`sun`/`hemiSky`/`hemiGround`/`ambient`/`ambientFloor` + intensity）。`ambientFloor` 是防黑屏的环境光下限——**v2.20 起 cyber/night-realistic 抬至 ~1.2**（根治夜景立面/地面黑屏，旧值 ~0.2 在 ACES + 弱光下被压成近黑）；realistic/isometric ~0.08–0.2。具体值以各风格 token 为准。
- **`outputColorSpace = SRGB` 统一**：所有走 ACES toneMapping 的风格（cyber/realistic/night-realistic）必须显式设；isometric 用 `NoToneMapping`。
- **`devicePixelRatio` 上限 2** + **材质能降则降**（`roughness ≥ 0.9 && metalness == 0` 用 `MeshLambertMaterial`）。
- **程序化天空（token `scene.sky`）**：night-realistic 开星空+月亮；cyber 开稀疏暗星（须低于 bloom 阈值）；isometric/realistic 无天空元素。
- **`ui` 块**：2D 组件观感旋钮（`panelOpacity/panelBlur/panelRadius/glowStrength/glowColor/borderWidth/labelBg/labelText/switcherStyle`）。赛博 = neon 描边发光 pill；等距 = flat 克制。
- **程序化地面纹理 `ground.texture`**（`{type, base, line, cell}`）：非 cyber 风格地面叠一层 CanvasTexture（见 `scene-recipe.md §3.1`）。

---

## cyber（赛博，默认）

完整配方见 `references/scene-recipe.md` §2–§3。要点：
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；`outputColorSpace = SRGB`；`EffectComposer` 可选（仅当要用 bloom 时）。DPR ≤ 2。
- **灯光**：刻意平——`HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` + 柔和 `DirectionalLight(lights.sun, lights.sunIntensity)` + `ambientFloor` 兜底。不要 VSM 阴影 / PMREM。
- **地面**：`gridGround.glsl` 着色器平面（青色网格 + 径向晕影）。shader 失败时降级为纯色 + 网格 CanvasTexture。
- **后处理**：`UnrealBloomPass` 强度建议 ≥0.25（~0.15 在 ACES 下几乎不可见）。
- **楼栋材质**：`MeshStandardMaterial`（`building: 'emissive'`）。v2.17 起走发光窗流水线——`map`=深青蓝渐变墙 + 逐层面板窗、`emissiveMap`=仅亮窗辉光（`emissive:white` 驱动，**窗光取代旧「整栋均匀霓虹蓝自发光」**）、bloom 让窗光溢出；立体轮廓 EdgesGeometry 走 `dividerColor`（亮青，暗底可辨）。旋钮见 `cyber.tokens.json` 的 `windows` 块（gradient/glassOff/暖冷色）。
- **环境材质**：道路深蓝灰 `MeshBasicMaterial`（轻微自发光）；车道线/标线用自发光青色 `Line2`；草地暗紫青；路灯灯头自发光青/白**不挂 PointLight**（赛博靠自发光+bloom 表现灯光）。
- **标签对比（§4.2）**：「深底亮字」——底取深色，字取亮霓虹 + 霓虹描边。
- **车库入口/地面车位/POI**：半金字塔三角门 `MeshBasicMaterial` + 自发光边；地面车位为长方形铺装 + 自发光描边 + 每位印 P + ~30% 自发光车辆；POI 图标按 `poi.<type>` 自发光色 + 高对比底。

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

## night-realistic（写实夜景）

夜间写实——HDRI 天空 IBL + 湿润反射 + 程序化发光窗 + 暖色路灯真照明。配色/旋钮唯一事实来源 `night-realistic.tokens.json`（v2.20 调色值）。写实引擎通用能力（HDRI/MeshPhysicalMaterial/SMAA/`realism.exposure` token/等距接地阴影）见顶部「写实两风格」总段，本节只列 night-realistic 专属调色。

- **曝光（夜景主杠杆）**：`realism.exposure = 3.0`（ACES tone mapping exposure；`applyProfile` 优先读此 token、缺省回退 `PROFILES.toneExposure`）。夜景发黑主因是 exposure 不足——`1.0→3.0` 是分水岭（v2.18 实测 1.0/1.3/1.6 几乎无效，2.4+ 才显著）。湿润反射会补光，故较纯提亮场景的 exposure 略低。
- **路灯真 PointLight（v2.18 预览→v2.20 固化）**：`buildAmbiance` 给路灯 head 挂 `PointLight`（暖琥珀 `lights.point #ffd09a`、`pointIntensity≈1530` candela、`pointDistance≈2800`、≤8 盏 `decay=1`）——v2.18 前路灯仅自发光球、不照亮地面。**仅 night-realistic 启用**（cyber `lights.point=null` 自动跳过、仍走自发光球）。亮斑有效半径 ∝ intensity（decay=1 线性衰减），调亮斑面积只动 `pointIntensity`/`pointDistance`。
- **地面 reflBack 衬底（v2.20）**：夜景地面 `Reflector`（湿润反射，`realism.reflection.enabled:true`）其下 `y=-0.05` 加不透明 `reflBack` 衬底，材质 `MeshLambertMaterial + emissive（road 色，emissiveIntensity=0.9）`——Lambert 部分受 PointLight 在路灯附近叠加加亮，emissive 底光让俯视/离路灯远的画面中央不黑（Reflector 是自定义反射 shader、其 opacity 不按标准透明透出下层，故 reflBack 必须自发光才有底亮度）。`environment.city-ground #98a6bd` / `road #8090ae` 故意调亮（远亮于 cyber 紫蓝）以匹配夜景整体提亮。
- **楼墙降玻璃反光（v2.20）**：`realism.material.envMapIntensity=0.3 + roughness=0.65 + metalness=0.05`——降 PBR 镜面反射（用户反馈「墙体玻璃反光太强」），楼墙偏哑光混凝土质感。
- **发光窗**：走 2 深色风格通用程序化流水线（见 cyber 段 + `scene-recipe.md §15`），`windows.emissiveIntensity=1.6`、暖冷双辉光 70/30、开关灯动画。
- **楼幢轮廓**：`building.edgeColor #d8e6f8`（淡冷月光色 `EdgesGeometry`，暗天空下 silhouette 多角度可辨，替代旧极暗 `dividerColor`）。
- **环境光**：`ambientFloor=1.2`（v2.20 大幅抬升根治立面黑屏）+ 冷月光 `DirectionalLight`（`sunIntensity=1.0`）+ `HemisphereLight`（`hemiIntensity=0.9`）。
- **后处理**：`UnrealBloomPass`（threshold 0.8 / strength 0.18）+ `SMAAPass`（v2.19）+ `GTAOPass`（intensity 0.55）+ 线性雾（`fog near 1500 / far 3200`，v2.20 推远避免园区内被暗雾染）+ 2048² `PCFSoftShadowMap`。`realism.reflection` opacity 0.2 / mixStrength 0.35（v2.18 的 0.85×0.6 过强，已克制）。

---

## 选择与换肤

- **首次生成**：步骤 3 用 `AskUserQuestion` 让用户在 4 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 部分覆盖），重新派生 `tokens.css`/`theme.ts`/Three.js 材质。`cyber` 消费 grid 着色器、其余 3 种不消费——换到/换自 `cyber` 时记得接入或移除 grid pass。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。
- **地下场景**：每个风格 token 都有 `underground` 块（deck/wall/edge/room/spot/ramp + deckOpacity/wallOpacity）。地下坑体材质由 `ParkScene.undergroundMaterials()` 按 `profile.building` 分支——cyber/night-realistic 走自发光 `MeshStandardMaterial`（地下无独立光照，靠 emissive 才可见）；realistic 走 PBR 受光；isometric 走 `flatShading` Lambert。换肤时改 `underground` 值即可统一改地下配色（单一事实来源，禁手写 hex）。详见 `scene-recipe.md §14`。
