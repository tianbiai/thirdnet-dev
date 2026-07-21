# 风格（Styles）—— 7 种视觉模板

园区数字孪生支持 7 种视觉风格，由 `spec.style` 选择（在第 3 步用 `AskUserQuestion` 让用户挑，默认 `cyber`）。每种风格的**配色唯一事实来源**是对应的 token 文件：

| `spec.style` | 风格 | 配色文件 | grid.glsl |
|---|---|---|---|
| `cyber`（默认） | 赛博 | `assets/themes/cyber.tokens.json` | ✅ 使用（霓虹青网格地面） |
| `realistic` | 真实物体（日间 PBR） | `assets/themes/realistic.tokens.json` | ❌ 不使用 |
| `night-realistic` | 夜间写实（PBR + 灯光） | `assets/themes/night-realistic.tokens.json` | ❌ 不使用 |
| `blueprint` | 蓝图（工程蓝图） | `assets/themes/blueprint.tokens.json` | ✅ 使用（深蓝图底 + 淡白青坐标网格） |
| `holographic` | 全息（未来科技） | `assets/themes/holographic.tokens.json` | ❌ 不使用 |
| `white-model` | 白模（建筑模型） | `assets/themes/white-model.tokens.json` | ❌ 不使用 |
| `isometric` | 等距插画（信息图） | `assets/themes/isometric.tokens.json` | ❌ 不使用 |

> **grid.glsl 的归属**：只有 `cyber` 与 `blueprint` 接入 `gridGround.glsl` 着色器地面（两者用**同一个着色器资产**，仅 uniform 调色不同——cyber 是霓虹青网格、blueprint 是深蓝图底 + 淡白青坐标网格）。其余 5 种风格跳过 §3，地面走各自的纯色/PBR/扁平材质。`spec.style` 为 `cyber` 或 `blueprint` 时，生成器把 `assets/gridGround.glsl` 接为着色器地面、读 `shaders.grid` uniform；其它风格忽略 `shaders.grid`。

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色思路（§4，含楼顶名称标签）、车库入口标记（§5，v1.3 半金字塔三角门 + P 牌）、地面车位正方形框（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建；`blueprint` 同样接入 §3 的网格着色器（仅 uniform 不同）。

颜色规则不变：**所有颜色都从所选风格的 token 派生**（SCSS 变量、`:root` CSS 变量、`theme.ts`、Three.js `Color`、uniform）。绝不在场景代码里散落 hex 字面量。

---

## cyber（赛博，默认）

完整配方见 `references/scene-recipe.md` §2–§3。要点：
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0，偏平；`EffectComposer` 可选（仅当要用 bloom 时）。
- **相机取景（所有风格共用）**：正交等轴相机，取景**从 spec 几何推导**——测内容包围盒设非对称视锥，把地面最近端钉到距舞台底边 ~6%，下方不留大片空白。详见 `scene-recipe.md §2` 的 `frameCamera()`；该取景跨风格共享（相机不分风格）。
- **灯光**：刻意平——一个 `HemisphereLight` + 一盏柔和 `DirectionalLight`，让着色器地面 + 自发光边线读起来像「数字孪生」而非「建筑可视化」。不要 VSM 阴影 / PMREM。
- **地面**：`gridGround.glsl` 着色器平面（青色网格 + 径向晕影）。
- **后处理**：可选微弱 `UnrealBloomPass`（强度 ~0.15）。
- **楼栋材质**：`MeshStandardMaterial`，颜色取自类别 token，`emissive = color`、`emissiveIntensity ≈ 0.12`，搭配程序化幕墙画布 + 楼层环线 + 屋顶 EdgesGeometry。**v1.4 楼层/房间层次**：幕墙画布按 §4.1 切每层 1–5 间房、房间用类别色 HSL lightness `±roomShade`（cyber ~0.16）阶梯着色；楼层之间用 `building.dividerColor`（亮青）自发光虚线分隔。
- **环境（§10）材质**：道路用深蓝灰 `MeshBasicMaterial`（带轻微自发光）；车道线/地面发光标线用自发光青色 `Line2`（`environment.groundGlow` 默认开）；草地暗紫青低饱和；树冠可加一圈青色边光（`EdgesGeometry`）；路灯灯头自发光青/白，**不挂 PointLight**（赛博靠自发光+bloom 表现灯光）。围墙顶部可加一条发光线。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底亮字**」——底取 `palette.void-bg`/`panel-top` 深色，字取亮霓虹（`mint`/`cyan-bright`）+ 霓虹描边。**不要**再用霓虹底 + 白字（旧版赛博 P 牌因此看不清）。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshBasicMaterial`（`category.garage` 色）+ 自发光 `EdgesGeometry` 勾边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg/signFg`）；**地面车位为长方形铺装（`surfaceParking.stallFill`）+ 自发光描边（`stallLine`）+ 每位印 P（`pMarkBg`/`pMark`，深底亮字）+ ~30% 自发光车辆（`car`）**，不再用正方形框/区域 P 牌；POI 图标按 `poi.<type>` 自发光色 + 高对比底，bloom 让标记在夜里溢出。

---

## realistic（真实物体 / 日间 PBR）

目标是「真实建筑可视化」，不是「数字孪生仪表盘」。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.1；`outputColorSpace = SRGB`；启用 `shadowMap`（`PCFSoftShadowMap`）。
- **环境**：`PMREMGenerator.fromScene(new Sky())` 或一张白天天空 HDR 作为环境贴图，给玻璃/金属提供真实反射。
- **灯光**：一盏 `DirectionalLight`（太阳，暖白 ~0xfff4e0，强度 ~2.5）投射柔和阴影；一个低强度 `HemisphereLight`（天蓝/地褐）补光。阴影相机要包住整个园区。
- **楼栋材质**：
  - 玻璃幕墙：`MeshStandardMaterial({ metalness: 0.9, roughness: 0.1, envMapIntensity: 1.0 })`，颜色取自类别 token（玻璃蓝）。
  - 混凝土/实体：`roughness: 0.9, metalness: 0.0`，灰白基色 + 程序化噪声纹理。
  - **v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间，房间明度阶梯模拟不同反射的玻璃单元（`roomShade` ~0.14）；楼层之间用中性深色 `building.dividerColor` 虚线分隔，接受阳光、不发光。
- **地面**：**不要**着色器网格。用一张草地/铺装纹理的 `MeshStandardMaterial` 大平面（或带轻微凹凸的法线贴图）；可叠一条隐含的园区轮廓。
- **后处理**：可选非常微弱的 `UnrealBloomPass`（强度 ~0.05）只为高光收敛。
- **环境（§10）材质**：道路用哑光沥青 `MeshStandardMaterial`（`roughness 0.95`，可投/接阴影）；车道线用白/黄扁平条；草地自然草绿（可叠草纹理）；树干棕、树冠绿（`MeshStandardMaterial`，接受阳光阴影）；路灯灯头用 `MeshStandardMaterial`（金属玻璃质感），**不挂 PointLight**（日光下不需要）。围墙用混凝土材质。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**浅底深字**」——中性浅底（`tile-bg`/米白）+ 深主色字，日光下清晰、接受环境光。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshStandardMaterial`（绿色金属玻璃感，接受阳光阴影）+ 描边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg`/`signFg`）；**地面车位为长方形哑光沥青铺装（`stallFill`）+ 白描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 真实车身色车辆（`car`）**，不再用正方形框/区域 P 牌；POI 图标用 `MeshStandardMaterial`（按 `poi.<type>` 色）+ 高对比底，日光下接受阴影、不发光。

---

## night-realistic（夜间写实）

介于赛博与真实之间——真实材质，但夜景灯光。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；启用 `shadowMap`（`PCFSoftShadowMap`）；`toneMappingExposure` 略低让夜色沉下去。
- **环境**：一张深蓝夜空 HDR（或低强度 `Sky` + 偏蓝 sun）经 PMREM 生成环境贴图，强度调低（`envMapIntensity ~0.3`），避免把夜晚照亮。
- **灯光**：一盏冷色 `DirectionalLight`（月光，~0x9fb4ff，强度 ~0.4，可投微弱阴影）+ 多个暖色 `PointLight`（路灯，~0xffb24a，强度 ~30，距离衰减）沿道路放置。
- **楼栋材质**：PBR（`MeshStandardMaterial`，玻璃 `metalness: 0.8, roughness: 0.2`），关键是给幕墙画布叠加**窗户自发光**——程序化生成「亮窗网格」`emissiveMap`（暖琥珀 `#ffb24a`），让楼栋在夜里「亮起来」。**v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间，房间明度阶梯（`roomShade` ~0.16）配合窗户自发光，亮窗只落在部分房间；楼层之间用自发光暖色 `building.dividerColor`（`#ffb24a`）虚线分隔，夜间可见、bloom 微溢。
- **地面**：深色 `MeshStandardMaterial`（粗糙、`roughness: 0.4, metalness: 0.0`）+ 微弱反射（可用 `MeshReflectorMaterial` 或一张反射纹理），模拟雨后/光泽地面。不要 `grid.glsl`。
- **后处理**：可加 `UnrealBloomPass`（强度 ~0.4），让窗户/路灯的亮部溢出——这是夜景的灵魂。
- **环境（§10）材质**：这是环境发光最有戏的风格——**路灯灯头每盏挂一个暖琥珀 `PointLight`（~0xffb24a，强度 ~30，距离衰减）沿道路布点**（`buildAmbiance` 核心）；湿润沥青道路深色 + 雨后反光（`roughness 0.25`）；车道线可微弱自发光；草地深绿；树冠深绿带偶发暖光点缀；车辆代理体可加车灯（白色前灯 + 红色尾灯小 `PointLight` 或自发光球）；围墙顶部可加暗灯带。bloom 会让所有这些亮部在夜里溢出，是夜景氛围的关键。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底亮字**」——深底（`panel-bot`/夜空蓝）+ 自发光暖/亮字（`amber`/`online-light`），夜间可见、bloom 微溢。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshStandardMaterial`（`category.garage` 色）+ 自发光描边，P 牌走对比配对（`garageEntrance.signBg`/`signFg`，深底亮字自发光）；**地面车位为长方形湿润沥青铺装（`stallFill`）+ 自发光暖描边（`stallLine`）+ 每位印 P（深底亮字）+ ~30% 深色车身车辆（`car`）**，不再用正方形框/区域 P 牌；**POI 图标按 `poi.<type>` 自发光色 + 高对比底 + bloom**——夜景下 POI 标记是画面的亮点，监控/闸机类可用各自类型的暖/冷发光色让它们在夜里跳出来。

---

## blueprint（蓝图 / 工程蓝图）

目标是「专业工程图 / BIM 工业感」——线框主导、可测量、严谨。它和 `cyber` 共用 `gridGround.glsl`，但调色与材质完全不同：深蓝图底 + 淡白青坐标网格 + 白色线框楼栋。
- **渲染器**：`NoToneMapping`（保持线色纯净、可预测）；关闭 `shadowMap`（蓝图不打阴影，靠线框读形）。
- **灯光**：单个 `AmbientLight(0xffffff, ~1.0)` 即可；不需要方向光/环境贴图（线框与扁平填充不受光照衰减影响）。
- **地面**：**接入 `gridGround.glsl`**（与 cyber 同资产），uniform 换蓝图调——`u_gridColor=#cfe4ff`（淡白青网格线）、`u_cell=46`、`u_strength=0.6`，底色由 token `palette.void-bg`（深蓝图蓝 `#0a2d6e`）驱动。读起来像一张工程坐标底图。外圈城市地面用更深的蓝图纯色。
- **楼栋材质**：**线框主导**——`MeshBasicMaterial({ color: category.building, transparent: true, opacity: 0.25 })` 作淡蓝半透填充 + **白色加粗 `EdgesGeometry`/`Line2`**（`LineBasicMaterial`/`LineMaterial` 用 `palette.cyan-bright` 白）勾勒轮廓与楼层。**v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间，但 `roomShade` 极小（~0.08）——蓝图里房间靠细线划分而非色块明度；楼层之间用 `building.dividerColor`（淡白青）细虚线分隔。
- **后处理**：无 bloom（保持图纸干燥感）。
- **环境（§10）材质**：全部 `MeshBasicMaterial` 深蓝图单色调——道路深蓝、车道线/标线淡白青、草地/树冠压成蓝灰抽象块（`environment.grass/treeCanopy` 取蓝调）以维持工程图氛围；路灯灯头淡白青小点不发光。`environment.groundGlow` 默认关（保持图纸干燥）；环境元素可降密度。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深蓝图底 + 淡白青/白亮字**」——底取 `palette.void-bg`/`panel-top` 深蓝图，字取 `cyan`/`cyan-bright` 淡白青，描边取类别色。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用淡蓝半透 `MeshBasicMaterial` + 白色 `EdgesGeometry` 描边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg`/`signFg`，深蓝图底 + 淡白青字）；**地面车位为长方形深蓝铺装（`stallFill`）+ 淡白青描边（`stallLine`）+ 每位印 P（深底亮字）+ ~30% 蓝色线框车辆（`car`）**；POI 图标用淡白青/克制亮色线框 + 高对比深底，不发光。

---

## holographic（全息 / 未来科技）

目标是「高端未来科技感」——半透玻璃体 + 边缘辉光 + bloom。介于赛博与写实之间的「净版未来风」，把「科技感」给到位但不嘈杂。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；关闭 `shadowMap`（全息不打实阴影，靠辉光分层）。
- **环境**：**不要** PMREM/HDR（会把半透体照得浑浊）；用一个极低强度 `HemisphereLight` + `AmbientLight` 让半透体保留通透感。
- **灯光**：低强度 `HemisphereLight(0x1a2a4a, 0x05060f, ~0.4)` + `AmbientLight(0x2a4a7a, ~0.3)`；无太阳/方向光。
- **地面**：**不接入 grid.glsl**。深色 `MeshBasicMaterial`（近黑 `palette.void-bg`）大平面 + 自发光青色 `Line2` 园区轮廓勾边 + 可选径向辉光（一个透明渐变 Sprite 或 shader 在地心），强化「全息投影台」感。
- **楼栋材质**：**半透体 + 边缘辉光**（菲涅尔 rim 的廉价近似）——
  - 体：`MeshStandardMaterial({ color: category.building, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.2 })`。
  - 边：高亮自发光青色 `EdgesGeometry`/`Line2`（`emissive` 色 `cyan-bright`），让楼栋轮廓在暗底发光——这是全息感的来源。
  - **可选增强**（不强制）：换 `MeshPhysicalMaterial({ transmission: 0.55, roughness: 0.15, thickness: 1.0, ior: 1.3 })` 做真折射玻璃；或用 `onBeforeCompile` 注入菲涅尔 rim 项。基础版用上面的半透 Standard + 自发光边即可。
  - **v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间（`roomShade` ~0.14，半透体上的明度阶梯）；楼层之间用自发光青 `building.dividerColor` 虚线分隔，与边缘辉光融为一体。
- **后处理**：`UnrealBloomPass` 强度 ~0.3——让半透体的边缘/轮廓在暗底溢出，这是全息感的灵魂。可选 CSS/Shader 扫描线叠加（注为可选增强）。
- **环境（§10）材质**：极暗深空底 + 自发光青色标线/勾边——道路近黑 `MeshBasicMaterial`、车道线自发光青 `Line2`、草地/树冠压成深蓝绿抽象块；路灯灯头自发光青小点不挂 `PointLight`（靠 bloom 表现）。`environment.groundGlow` 默认开（青色勾边是全息感的一部分）。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底 + 自发光青亮字**」——底取 `palette.void-bg`/`panel-bot` 近黑，字取自发光青（`cyan-bright`/`mint`），bloom 微溢。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用半透 `MeshStandardMaterial` + 自发光青 `EdgesGeometry` 描边；P 牌/楼顶名称标签自发光（深底亮字）；**地面车位为长方形近黑铺装（`stallFill`）+ 自发光青描边（`stallLine`）+ 每位印 P（深底亮字自发光）+ ~30% 深色车身车辆（`car`）**；**POI 图标按 `poi.<type>` 自发光色 + 深底 + bloom**，暗底下 POI 标记与楼栋边缘辉光共同构成画面亮点。

---

## white-model（白模 / 建筑模型）

目标是「博物馆/沙盘级纯净汇报」——全白磨砂 + 柔和接地阴影，干净但有体积（这正是被移除的扁平 `minimal` 想做却没做到的）。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.05；启用 `shadowMap`（`PCFSoftShadowMap`）——接地软阴影是体积感的来源。
- **环境**：**不要** PMREM/HDR（白模要的是干净中性，不是反射）。可用一个极低强度的纯白环境（`PMREMGenerator.fromScene(纯白 Scene)` 强度 ~0.2）做最弱的填光，或干脆只用半球光。
- **灯光**：`HemisphereLight(0xffffff, 0xd8dce4, ~1.0)` 作主光 + 一盏柔和 `DirectionalLight`（正白 ~0xffffff，强度 ~1.5，从等轴斜上方）投射 PCF 软阴影。阴影相机包住园区，`shadow.radius` 调大让阴影虚化。
- **地面**：**不接入 grid.glsl**。浅灰中性 `MeshStandardMaterial({ color: palette.city-ground, roughness: 0.95, metalness: 0 })` 大平面，接受软阴影。
- **楼栋材质**：**纯白统一磨砂**——`MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 })`。**按类别上色转移到屋顶描边/轮廓**：楼栋体仍是纯白，但屋顶 `EdgesGeometry`/`Line2` 取 `category.building`（蓝）色、车库入口描边取 `category.garage`（绿）色——这样图例色块与 3D 上色仍一致，不破坏技能核心「按类别上色」铁律。**v1.4 楼层/房间层次**：`roomShade` 极弱（~0.05，仅微微读出楼层，不破坏单色）；楼层之间用浅灰 `building.dividerColor`（`#c8ced8`）虚线分隔，接受阴影、不发光。
- **后处理**：无 bloom。
- **环境（§10）材质**：低饱和鼠尾草色系——草地浅鼠尾草绿、树冠灰绿、树干暖灰、道路/铺装中性灰，全部 `MeshStandardMaterial` 接受软阴影；路灯灯头浅色金属玻璃感，**不挂 PointLight**（白模不打点光）。围墙用浅灰混凝土。绿植保留景观语义但饱和度压低，维持单色氛围。`environment.groundGlow` 默认关。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**浅灰底 + 深字**」——底取白/`tile-bg` 浅灰，字取 `text-hi` 深色或类别色，克制不发光。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门白色磨砂 + 绿色描边（接受阴影）；P 牌/楼顶名称标签走对比配对（白底深字）；**地面车位为长方形浅灰铺装（`stallFill`）+ 深描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 哑光灰车辆（`car`）**；POI 图标用低饱和色（按 `poi.<type>`）+ 白底，接受阴影、不发光。

---

## isometric（等距插画 / 信息图）

目标是「扁平但好看的友好信息图」——cel 着色感的彩色楼栋，鲜活但和谐。这是「扁平」生态位里比旧 `minimal` 更讨喜的版本。
- **渲染器**：`NoToneMapping`（保持饱和、色值可预测）；关闭 `shadowMap`（插画风靠 flatShading 的面明度分层，不靠投影）。
- **环境**：**不要** PMREM/HDR。
- **灯光**：一盏暖色 `DirectionalLight`（暖白 ~0xfff0e0，强度 ~1.2，**从等轴斜上方**与相机同向）——让 `flatShading` 的每个面得到不同的平涂明度，形成 cel/插画感；可加一个低强度 `HemisphereLight` 补暗部。
- **地面**：**不接入 grid.glsl**。暖色扁平 `MeshStandardMaterial({ color: palette.city-ground, roughness: 1, metalness: 0, flatShading: true })` 大平面。
- **楼栋材质**：**flatShading cel 着色**——`MeshStandardMaterial({ color: category.building, roughness: 1, metalness: 0, flatShading: true })`。**`flatShading: true` 是关键**：BoxGeometry 等几何体的每个面被当作一个平涂色块，配合方向光得到 cel 明度阶梯。可选略深同色 `EdgesGeometry` 作插画描边（不强制）。**v1.4 楼层/房间层次**：`roomShade` 较大（~0.18，强化 cel 阶梯）；楼层之间用深海军蓝 `building.dividerColor`（`#3a4660`）虚线分隔（在彩色面上可读）。
- **后处理**：无 bloom。
- **环境（§10）材质**：鲜活但和谐的插画配色——道路暖棕沥青、车道线奶油色、草地鲜活草绿、树冠鲜绿、树干暖棕，全部 `flatShading` 的 `MeshStandardMaterial`/`MeshLambertMaterial`；路灯灯头暖色小球不发光。`environment.groundGlow` 默认关。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**暖白底 + 深海军蓝字**」——底取白/暖白，字取 `text-hi` 深色或类别色，不发光、保持扁平插画统一。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门友好绿色 `flatShading` 材质 + 略深描边；P 牌/楼顶名称标签走对比配对（白底深字）；**地面车位为长方形暖色铺装（`stallFill`）+ 深描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 友好色车身车辆（`car`）**；POI 图标用鲜活友好色（按 `poi.<type>`）+ 白底，不发光、不加阴影——保持扁平插画统一。

---

## 选择与换肤

- **首次生成**：第 3 步用 `AskUserQuestion` 让用户在 7 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 的部分覆盖），重新派生 `_tokens.scss` / `theme.ts` / Three.js 材质。换到/换自 `cyber` 或 `blueprint` 时记得接入或移除 grid pass（这两者消费 `gridGround.glsl`，其余 5 种不消费）。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。（`white-model` 例外：楼栋体纯白，类别色体现在屋顶描边——图例色块仍取 `category` 映射，与描边一致。）
