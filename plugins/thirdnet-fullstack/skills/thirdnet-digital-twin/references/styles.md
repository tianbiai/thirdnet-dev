# 风格（Styles）—— 4 种视觉模板

园区数字孪生支持 4 种视觉风格，由 `spec.style` 选择（在第 3 步用 `AskUserQuestion` 让用户挑，默认 `cyber`）。每种风格的**配色唯一事实来源**是对应的 token 文件：

| `spec.style` | 风格 | 配色文件 | grid.glsl |
|---|---|---|---|
| `cyber`（默认） | 赛博 | `assets/themes/cyber.tokens.json` | ✅ 使用（着色器地面） |
| `realistic` | 真实物体（日间 PBR） | `assets/themes/realistic.tokens.json` | ❌ 不使用 |
| `minimal` | 简约科技（浅色扁平） | `assets/themes/minimal.tokens.json` | ❌ 不使用 |
| `night-realistic` | 夜间写实（PBR + 灯光） | `assets/themes/night-realistic.tokens.json` | ❌ 不使用 |

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色思路（§4，含楼顶名称标签）、车库入口标记（§5，v1.3 半金字塔三角门 + P 牌）、地面车位正方形框（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建，并跳过 §3（网格着色器）。

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

## minimal（简约科技 / 浅色扁平）

目标是「干净、汇报友好、打印可读」。
- **渲染器**：关闭 `shadowMap`；`toneMapping = NoToneMapping`（保持色值线性可预测）。
- **灯光**：单个 `AmbientLight(0xffffff, ~1.0)` 即可；不需要方向光/环境贴图。
- **楼栋材质**：`MeshBasicMaterial({ color })`——扁平、纯色、无光照衰减。颜色取自类别 token。每个楼栋加 `EdgesGeometry` + `LineBasicMaterial`（单一主色描边）勾勒轮廓。**v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间，明度阶梯幅度较小（`roomShade` ~0.12）以保持汇报友好、可打印；楼层之间用单一主色 `building.dividerColor` 虚线分隔，克制不发光。
- **地面**：纯色或极淡网格的 `MeshBasicMaterial` 平面（背景取 `palette.void-bg` 浅色）。可用 CSS 画网格，不要 `grid.glsl`。
- **后处理**：无。无 bloom。
- **UI**：切换器/详情面板克制发光（`_glow.scss` 的 mixin 在此风格下基本不用或极弱）。
- **环境（§10）材质**：全部用 `MeshBasicMaterial` 扁平单色——道路浅灰、车道线白色细条、草地浅绿、树干棕、树冠单一绿；`environment.groundGlow` 默认关（保持汇报友好、可打印）；路灯灯头浅色不发光，**不挂 PointLight**。简约风格下环境元素可进一步降密度，避免画面嘈杂。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**浅底深字**」——白/浅灰底 + 深主色字，打印可读、不发光。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用扁平 `MeshBasicMaterial`（`category.garage` 色）+ `EdgesGeometry` 主色描边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg`/`signFg`，浅底深字）；**地面车位为长方形浅色铺装（`stallFill`）+ 深描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 哑光车辆（`car`）**，不再用正方形框/区域 P 牌；POI 图标用扁平单色（按 `poi.<type>`）+ 高对比底，不发光、不加阴影——保持打印可读。

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

## 选择与换肤

- **首次生成**：第 3 步用 `AskUserQuestion` 让用户在 4 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 的部分覆盖），重新派生 `_tokens.scss` / `theme.ts` / Three.js 材质。换到/换自 `cyber` 时记得接入或移除 grid pass。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。
