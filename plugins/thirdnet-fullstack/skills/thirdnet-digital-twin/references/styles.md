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

> **grid.glsl 的归属**：只有 `cyber` 与 `blueprint` 接入 `gridGround.glsl` 着色器地面（两者用**同一个着色器资产**，仅 uniform 调色不同——cyber 是霓虹青网格、blueprint 是深蓝图底 + 淡白青坐标网格）。其余 5 种风格跳过 §3 的 shader 地面，但 **v1.9 起都叠一层 `makeGroundTexture` 程序化 `CanvasTexture`**（§3.1）——不再是纯色色片。`spec.style` 为 `cyber` 或 `blueprint` 时，生成器把 `assets/gridGround.glsl` 接为着色器地面、读 `shaders.grid` uniform；其它风格忽略 `shaders.grid`。

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色思路（§4，含楼顶名称标签）、车库入口标记（§5，v1.3 半金字塔三角门 + P 牌）、地面车位正方形框（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建；`blueprint` 同样接入 §3 的网格着色器（仅 uniform 不同）。

颜色规则不变：**所有颜色都从所选风格的 token 派生**（SCSS 变量、`:root` CSS 变量、`theme.ts`、Three.js `Color`、uniform）。绝不在场景代码里散落 hex 字面量。

> **v1.8 性能与色彩纪律（所有风格）**：
> - **灯光色也走 token**：每风格 token 新增顶层 `lights` 块（`sun`/`hemiSky`/`hemiGround`/`ambient`/`point` + 各自 intensity/distance）。下文每段的灯光 hex 一律改为引用 `lights.*`，不再散落 `0xRRGGBB` 灯光字面量。`null` 表示该风格不用此光源。
> - **`outputColorSpace = SRGB` 统一**：所有走 `ACESFilmicToneMapping` 的风格（cyber/realistic/night-realistic/holographic/white-model）都必须显式 `renderer.outputColorSpace = THREE.SRGBColorSpace`，否则换肤时会出现色调漂移。blueprint/isometric 用 `NoToneMapping`，仍设 `outputColorSpace = SRGB` 让色值可预测。
> - **`devicePixelRatio` 上限 2**：`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`——4K/retina 不限制会分配超大 framebuffer 拖垮帧率（见 `scene-recipe.md` §2）。
> - **材质能降则降**：`roughness ≥ 0.9 && metalness == 0` 的表面（道路、白模楼体、等距楼栋）用 `MeshLambertMaterial`，视觉等价、~30% 更便宜。
> - **WebGL2 能力检测**：无 WebGL2 时禁用 transmission/reflector/高级阴影过滤，降级到轻量风格路径（见 `scene-recipe.md` §1）。

> **v1.9 防黑屏 + 地面纹理（所有风格）**——修复「整屏一片黑、地面没纹理」痛点：
> - **显式 `scene.background`**：每风格 token 新增顶层 `scene` 块（`bgTop`/`bgBottom`），生成器画成顶→底渐变 `CanvasTexture` 设给 `scene.background`（见 `scene-recipe.md` §2）。`alpha:true` 不再依赖页面底色，暗色风格也有空气感。
> - **环境光下限 `lights.ambientFloor`**：所有风格都额外补一盏低强度 `AmbientLight`（暗色风格 ~0.18–0.20、亮色风格 ~0.08、blueprint=0），消灭未受光面纯黑。暗色风格（cyber/holographic/night-realistic）的 `sunIntensity`/`hemiIntensity` 在本文件对应段已微调上调。

> **v2.1 真实感细节层（所有风格，token 新块）**——细节参数固化在范式实现，配色走 token：
> - **`scene.sky: {clouds, stars, moon}`**：程序化天空开关。realistic 开白云；night-realistic 开星空+月亮；cyber/holographic 开暗淡星点（须低于 bloom 阈值）；blueprint/white-model/isometric 全关（保持图纸/幕布/插画纯净）。
> - **`environment.roadMarking` / `water` / `rooftop`**：地面标线色（各风格与路面高对比：写实白漆、夜间反光淡色、cyber/全息发光青、蓝图淡白青、白模白、等距奶油）、水景水面色、楼顶设备色。
> - **`ui` 块**：2D 组件观感旋钮（`panelOpacity/panelBlur/panelRadius/glowStrength/glowColor/borderWidth/labelBg/labelText/switcherStyle`）。赛博/全息 = neon 描边发光 pill；其余 5 风格 = flat 克制（glowStrength 0 时组件退化为中性投影）。楼名标签配色统一走 `ui.labelBg/labelText`（v2.1 修复浅色风格黑标签）。
> - **程序化地面纹理 `ground.texture`**：每风格 token 新增顶层 `ground.texture` 块（`{ type, base, line, cell }`）。非 cyber/blueprint 风格的园区地面叠一层 `makeGroundTexture(token)` 的 `CanvasTexture`（见 `scene-recipe.md` §3.1），消灭「纯色色片」——realistic/night-realistic 用 `tiles`、holographic 用 `dots`、white-model/isometric 用 `grid`。cyber/blueprint 仍用 `gridGround.glsl` shader 地面，`ground.texture` 仅作 shader 失败降级。

---

## cyber（赛博，默认）

完整配方见 `references/scene-recipe.md` §2–§3。要点：
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0，偏平；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8 强制）；`EffectComposer` 可选（仅当要用 bloom 时）。DPR ≤ 2。
- **相机取景（所有风格共用）**：正交等轴相机，取景**从 spec 几何推导**——测内容包围盒设非对称视锥，把地面最近端钉到距舞台底边 ~6%，下方不留大片空白。详见 `scene-recipe.md §2` 的 `frameCamera()`；该取景跨风格共享（相机不分风格）。
- **灯光**：刻意平——一个 `HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` + 一盏柔和 `DirectionalLight(lights.sun, lights.sunIntensity)`，让着色器地面 + 自发光边线读起来像「数字孪生」而非「建筑可视化」。不要 VSM 阴影 / PMREM。**v1.9**：`sunIntensity`/`hemiIntensity` 微调上调（见 token）+ 补一盏 `ambientFloor`（~0.2）环境光兜底，消灭未受光面纯黑。
- **地面**：`gridGround.glsl` 着色器平面（青色网格 + 径向晕影）。**v1.9**：shader 编译/uniform 失败时降级为 `environment.city-ground` 纯色 + `makeGroundTexture('grid')` 网格 `CanvasTexture`（见 `scene-recipe.md` §3.1），地面永不消失。
- **后处理**：`UnrealBloomPass` 若启用强度建议 ≥0.25（v1.8：~0.15 在 ACES 下几乎不可见，要么提高要么别付 composer 的 render-target 成本）。
- **楼栋材质**：`MeshStandardMaterial`，颜色取自类别 token，`emissive = color`、`emissiveIntensity ≈ 0.12`，搭配程序化幕墙画布 + 楼层环线 + 屋顶 EdgesGeometry。**v1.4/v1.7 楼层/贴砖层次**：幕墙画布按 §4.1 切每层 1–5 块贴砖、**相邻贴砖按类别色 HSL lightness `±roomShade`（cyber ~0.16）派生的 light/dark 两色交替**（v1.7）、贴砖之间用 `building.dividerColor`（亮青）自发光**竖实线**分隔；楼层之间用同色**横向虚线**分隔。
- **环境（§10）材质**：道路用深蓝灰 `MeshBasicMaterial`（带轻微自发光）；车道线/地面发光标线用自发光青色 `Line2`（`environment.groundGlow` 默认开）；草地暗紫青低饱和；树冠可加一圈青色边光（`EdgesGeometry`）；路灯灯头自发光青/白，**不挂 PointLight**（赛博靠自发光+bloom 表现灯光）。围墙顶部可加一条发光线。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底亮字**」——底取 `palette.void-bg`/`panel-top` 深色，字取亮霓虹（`mint`/`cyan-bright`）+ 霓虹描边。**不要**再用霓虹底 + 白字（旧版赛博 P 牌因此看不清）。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshBasicMaterial`（`category.garage` 色）+ 自发光 `EdgesGeometry` 勾边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg/signFg`）；**地面车位为长方形铺装（`surfaceParking.stallFill`）+ 自发光描边（`stallLine`）+ 每位印 P（`pMarkBg`/`pMark`，深底亮字）+ ~30% 自发光车辆（`car`）**，不再用正方形框/区域 P 牌；POI 图标按 `poi.<type>` 自发光色 + 高对比底，bloom 让标记在夜里溢出。

---

## realistic（真实物体 / 日间 PBR）

> **v2.0 放宽上限**：realistic 与 night-realistic 是允许牺牲 ~15–25% 帧率换取更接近建筑可视化真实感的两个风格。范式实现 [`assets/park-scene.impl.ts`](../assets/park-scene.impl.ts) 为它们启用 RoomEnvironment PMREM 环境贴图 + GTAO 接触阴影（夜再 + 地面湿润反射）。所有写实旋钮走 token 的 `realism` 块（`material`/`bloom`/`ao`/`reflection`/`fog`/`sun`），**不要把数值硬编码进 ParkScene.ts**。无 WebGL2 时自动降级（关 AO/反射/PMREM，env 退化为更高强度 ambient）。

目标是「真实建筑可视化」，不是「数字孪生仪表盘」。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.1；`outputColorSpace = SRGB`；启用 `shadowMap`（`PCFSoftShadowMap`）。DPR ≤ 2。
- **环境**：**v1.8 推荐「预烘焙 HDR / `RoomEnvironment`」**而非运行时 `PMREMGenerator.fromScene(new Sky())`——运行时 Sky+PMREM 在慢 GPU 上多秒卡顿且玻璃易出低分辨率立方体贴图瑕疵。预烘焙一次生成 `.hdr`/环境贴图，加载即用；仅在确实需要动态天空时才退回运行时 Sky。
- **灯光**：一盏 `DirectionalLight(lights.sun, lights.sunIntensity)`（暖白太阳，强度 ~2.5）投射柔和阴影；一个低强度 `HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` 补光。**阴影相机正交范围按 `boundary` 包络推导**（`left/right/top/bottom = ±boundary.x/±boundary.z` 留余量），`shadow.mapSize` 2048²、`shadow.radius` 给具体值（如 4）。
- **楼栋材质**：
  - 玻璃幕墙：`MeshStandardMaterial({ metalness: 0.9, roughness: 0.1, envMapIntensity: 1.0 })`，颜色取自类别 token（玻璃蓝）。
  - 混凝土/实体：**v1.8 用 `MeshLambertMaterial`**（`roughness 0.9、metalness 0` 时视觉等价、更便宜），灰白基色 + 程序化噪声纹理。
  - **v1.4/v1.7 楼层/贴砖层次**：幕墙画布按 §4.1 切贴砖，**相邻贴砖深浅两色交替**模拟不同反射的玻璃单元（`roomShade` ~0.14）；贴砖之间用中性深色 `building.dividerColor` 竖实线分隔，楼层之间用同色横向虚线分隔，接受阳光、不发光。
- **地面**：**不要**着色器网格。用一张草地/铺装纹理的 `MeshStandardMaterial` 大平面（或带轻微凹凸的法线贴图）；可叠一条隐含的园区轮廓。**v1.9**：纹理用 `makeGroundTexture(token)` 的 `tiles` 程序化 `CanvasTexture`（草地底 + 深草线 + 确定性伪随机洒点，见 `scene-recipe.md` §3.1），消灭「纯色色片」，接受阳光阴影。
- **后处理**：**v1.8 删除 strength ~0.05 的「高光收敛」bloom**——ACES 下不可见，纯 render-target 开销。需要 bloom 再给可见强度（≥0.2），否则不开 composer。
- **环境（§10）材质**：道路用哑光沥青 **`MeshLambertMaterial`（`roughness 0.95`，可投/接阴影）**——roughness≥0.9 时 Lambert 视觉等价更便宜；车道线用白/黄扁平条；草地自然草绿（可叠草纹理）；树干棕、树冠绿（`MeshLambertMaterial`，接受阳光阴影）；路灯灯头用 `MeshStandardMaterial`（金属玻璃质感），**不挂 PointLight**（日光下不需要）。围墙用混凝土材质。大园区阴影可考虑 CSM（级联）。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**浅底深字**」——中性浅底（`tile-bg`/米白）+ 深主色字，日光下清晰、接受环境光。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshStandardMaterial`（绿色金属玻璃感，接受阳光阴影）+ 描边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg`/`signFg`）；**地面车位为长方形哑光沥青铺装（`stallFill`）+ 白描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 真实车身色车辆（`car`）**，不再用正方形框/区域 P 牌；POI 图标用 `MeshStandardMaterial`（按 `poi.<type>` 色）+ 高对比底，日光下接受阴影、不发光。

---

## night-realistic（夜间写实）

> **v2.0 放宽上限**：见 realistic 段——night-realistic 是第二个允许放宽的风格。范式实现为其启用 RoomEnvironment PMREM（`envMapIntensity` 调低 ~0.35 避免把夜照亮）+ `EffectComposer`/`UnrealBloomPass`（强度走 `realism.bloom.strength`，是夜景灵魂）+ GTAO + 地面湿润反射（`Reflector`，`realism.reflection.enabled`）。亮窗 emissiveMap、PointLight≤8/不投影、车灯自发光球等 v1.8 纪律不变。所有数值走 token `realism` 块。

介于赛博与真实之间——真实材质，但夜景灯光。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；`outputColorSpace = SRGB`；启用 `shadowMap`（`PCFSoftShadowMap`）；`toneMappingExposure` 略低让夜色沉下去。DPR ≤ 2。
- **环境**：一张深蓝夜空 HDR（或低强度 `Sky` + 偏蓝 sun）经 PMREM 生成环境贴图，强度调低（`envMapIntensity ~0.3`），避免把夜晚照亮。
- **灯光**：一盏冷色 `DirectionalLight(lights.sun, lights.sunIntensity)`（月光，强度 ~0.4，可投微弱阴影）+ **v1.8 受控 PointLight**（见下「性能约束」）。**v1.9**：月光强度微调上调（见 token）+ 补一盏 `ambientFloor`（~0.18）环境光兜底，让楼栋/地面在夜里仍可辨而非纯黑（仍保持夜景沉静）。
- **楼栋材质**：PBR（`MeshStandardMaterial`，玻璃 `metalness: 0.8, roughness: 0.2`），关键是给幕墙画布叠加**窗户自发光**——程序化生成「亮窗网格」`emissiveMap`（暖琥珀 `accents.amber`），让楼栋在夜里「亮起来」。**亮窗纹理一次性烘焙进 facade CanvasTexture，不每帧重算**。**v1.4/v1.7 楼层/贴砖层次**：幕墙画布按 §4.1 切贴砖，**相邻贴砖深浅两色交替**（`roomShade` ~0.16）配合窗户自发光，亮窗只落在部分贴砖；贴砖之间用自发光暖色 `building.dividerColor` 竖实线分隔，楼层之间用同色横向虚线分隔，夜间可见、bloom 微溢。
- **地面**：深色 `MeshStandardMaterial`（粗糙、`roughness: 0.4, metalness: 0.0`）+ **v1.8 预烘焙模糊反射纹理**（夜地面本就暗、反射微妙，`MeshReflectorMaterial` 是整张 render-target 镜像、与 bloom+阴影+N 点光叠加易掉帧，预烘焙纹理视觉等价）。不要 `grid.glsl`。**v1.9**：再叠一层 `makeGroundTexture(token)` 的 `tiles` 深色沥青 `CanvasTexture`（见 `scene-recipe.md` §3.1），地面不再是死黑色片、读出湿润沥青质感。
- **后处理**：可加 `UnrealBloomPass`（强度 ~0.4），让窗户/路灯的亮部溢出——这是夜景的灵魂。
- **环境（§10）材质**：这是环境发光最有戏的风格——路灯灯头沿道路布点；湿润沥青道路深色 + 雨后反光（`roughness 0.25`）；车道线可微弱自发光；草地深绿；树冠深绿带偶发暖光点缀；车辆代理体加车灯（**v1.8 自发光球，禁用真 PointLight**）；围墙顶部可加暗灯带。bloom 会让所有这些亮部在夜里溢出，是夜景氛围的关键。
- **⚡ 性能约束（v1.8，必须遵守）**：night-realistic 是最高风险风格，PointLight 不加限制会在大园区掉到 <30fps。规则：① **PointLight 总数硬上限 ≤ 8**，且 `castShadow = false`（PointLight 投影 = 立方体深度图 × N，灾难性）；② 路灯用**自发光 Sprite 光晕 + 共享 1–2 盏 hero PointLight**（关键路口）承载氛围，而非每盏一盏真光源；③ 车灯一律自发光小球、**禁用真光源**；④ PointLight 色取 `lights.point`、强度 `lights.pointIntensity`、距离 `lights.pointDistance`。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底亮字**」——深底（`panel-bot`/夜空蓝）+ 自发光暖/亮字（`amber`/`online-light`），夜间可见、bloom 微溢。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用 `MeshStandardMaterial`（`category.garage` 色）+ 自发光描边，P 牌走对比配对（`garageEntrance.signBg`/`signFg`，深底亮字自发光）；**地面车位为长方形湿润沥青铺装（`stallFill`）+ 自发光暖描边（`stallLine`）+ 每位印 P（深底亮字）+ ~30% 深色车身车辆（`car`）**，不再用正方形框/区域 P 牌；**POI 图标按 `poi.<type>` 自发光色 + 高对比底 + bloom**——夜景下 POI 标记是画面的亮点，监控/闸机类可用各自类型的暖/冷发光色让它们在夜里跳出来。

---

## blueprint（蓝图 / 工程蓝图）

目标是「专业工程图 / BIM 工业感」——线框主导、可测量、严谨。它和 `cyber` 共用 `gridGround.glsl`，但调色与材质完全不同：深蓝图底 + 淡白青坐标网格 + 白色线框楼栋。
- **渲染器**：`NoToneMapping`（保持线色纯净、可预测）；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8）；关闭 `shadowMap`（蓝图不打阴影，靠线框读形）。DPR ≤ 2。
- **灯光**：单个 `AmbientLight(lights.ambient, lights.ambientIntensity)` 即可；不需要方向光/环境贴图（线框与扁平填充不受光照衰减影响）。
- **地面**：**接入 `gridGround.glsl`**（与 cyber 同资产），uniform 换蓝图调——`u_gridColor=#cfe4ff`（淡白青网格线）、`u_cell=46`、`u_strength=0.6`，底色由 token `palette.void-bg`（深蓝图蓝 `#0a2d6e`）驱动。读起来像一张工程坐标底图。外圈城市地面用更深的蓝图纯色。**v1.9**：shader 失败时降级为深蓝图底 + 淡白青网格 `CanvasTexture`（见 `scene-recipe.md` §3.1），地面不消失。
- **楼栋材质**：**线框主导**——`MeshBasicMaterial({ color: category.building, transparent: true, opacity: 0.25 })` 作淡蓝半透填充 + **白色加粗 `EdgesGeometry`/`Line2`**（`LineBasicMaterial`/`LineMaterial` 用 `palette.cyan-bright` 白）勾勒轮廓与楼层。**v1.4 楼层/房间层次**：幕墙画布按 §4.1 切房间，但 `roomShade` 极小（~0.08）——蓝图里房间靠细线划分而非色块明度；楼层之间用 `building.dividerColor`（淡白青）细虚线分隔。
- **后处理**：无 bloom（保持图纸干燥感）。
- **环境（§10）材质**：全部 `MeshBasicMaterial` 深蓝图单色调——道路深蓝、车道线/标线淡白青、草地/树冠压成蓝灰抽象块（`environment.grass/treeCanopy` 取蓝调）以维持工程图氛围；路灯灯头淡白青小点不发光。`environment.groundGlow` 默认关（保持图纸干燥）；环境元素可降密度。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深蓝图底 + 淡白青/白亮字**」——底取 `palette.void-bg`/`panel-top` 深蓝图，字取 `cyan`/`cyan-bright` 淡白青，描边取类别色。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用淡蓝半透 `MeshBasicMaterial` + 白色 `EdgesGeometry` 描边；P 牌/楼顶名称标签走对比配对（`garageEntrance.signBg`/`signFg`，深蓝图底 + 淡白青字）；**地面车位为长方形深蓝铺装（`stallFill`）+ 淡白青描边（`stallLine`）+ 每位印 P（深底亮字）+ ~30% 蓝色线框车辆（`car`）**；POI 图标用淡白青/克制亮色线框 + 高对比深底，不发光。

---

## holographic（全息 / 未来科技）

目标是「高端未来科技感」——半透玻璃体 + 边缘辉光 + bloom。介于赛博与写实之间的「净版未来风」，把「科技感」给到位但不嘈杂。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8）；关闭 `shadowMap`（全息不打实阴影，靠辉光分层）。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR（会把半透体照得浑浊）；用一个极低强度 `HemisphereLight` + `AmbientLight` 让半透体保留通透感。
- **灯光**：低强度 `HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` + `AmbientLight(lights.ambient, lights.ambientIntensity)`；无太阳/方向光。**v1.9**：`hemiIntensity` 微调上调（见 token）+ `ambientFloor` 兜底，半透体在暗底仍可辨（仍通透、不浑浊）。
- **地面**：**不接入 grid.glsl**。深色 `MeshBasicMaterial`（近黑 `palette.void-bg`）大平面 + 自发光青色 `Line2` 园区轮廓勾边 + 可选径向辉光（一个透明渐变 Sprite 或 shader 在地心，色取 `cyan-bright`），强化「全息投影台」感。**v1.9**：地面叠一层 `makeGroundTexture(token)` 的 `dots` 青色点阵 `CanvasTexture`（作 `map` 或低强度 `emissiveMap`，见 `scene-recipe.md` §3.1），与轮廓/辉光共同消灭死黑地板。
- **楼栋材质**：**半透体 + 边缘辉光**（菲涅尔 rim 的廉价近似）——
  - 体：`MeshStandardMaterial({ color: category.building, transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.2 })`。
  - 边：高亮自发光青色 `EdgesGeometry`/`Line2`（`emissive` 色 `cyan-bright`），让楼栋轮廓在暗底发光——这是全息感的来源。
  - **v1.8 ⛔ 禁用 `MeshPhysicalMaterial transmission`**：`transmission` 需要一整张 transmission render pass，与 bloom 叠加是性能黑洞，且暗底下视觉与「半透 Standard + 自发光边」几乎无差别。菲涅尔 rim 用 `onBeforeCompile` 注入 `assets/fresnelRim.glsl` 片段做廉价近似即可——这是唯一推荐的边缘辉光增强路径。
  - **v1.4/v1.7 楼层/贴砖层次**：幕墙画布按 §4.1 切贴砖（`roomShade` ~0.14，半透体上的**相邻两色交替**）；贴砖之间用自发光青 `building.dividerColor` 竖实线分隔，楼层之间用同色横向虚线分隔，与边缘辉光融为一体。
- **后处理**：`UnrealBloomPass` 强度 ~0.3——让半透体的边缘/轮廓在暗底溢出，这是全息感的灵魂。**v1.8 优先选择性 bloom**（只对边缘/POI 自发光层 bloom，避免整屏 bloom 把暗底地面一起提亮）；可选 CSS/Shader 扫描线叠加（注为可选增强）。
- **环境（§10）材质**：极暗深空底 + 自发光青色标线/勾边——道路近黑 `MeshBasicMaterial`、车道线自发光青 `Line2`、草地/树冠压成深蓝绿抽象块；路灯灯头自发光青小点不挂 `PointLight`（靠 bloom 表现）。`environment.groundGlow` 默认开（青色勾边是全息感的一部分）。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深底 + 自发光青亮字**」——底取 `palette.void-bg`/`panel-bot` 近黑，字取自发光青（`cyan-bright`/`mint`），bloom 微溢。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用半透 `MeshStandardMaterial` + 自发光青 `EdgesGeometry` 描边；P 牌/楼顶名称标签自发光（深底亮字）；**地面车位为长方形近黑铺装（`stallFill`）+ 自发光青描边（`stallLine`）+ 每位印 P（深底亮字自发光）+ ~30% 深色车身车辆（`car`）**；**POI 图标按 `poi.<type>` 自发光色 + 深底 + bloom**，暗底下 POI 标记与楼栋边缘辉光共同构成画面亮点。

---

## white-model（白模 / 建筑模型）

目标是「博物馆/沙盘级纯净汇报」——全白磨砂 + 柔和接地阴影，干净但有体积（这正是被移除的扁平 `minimal` 想做却没做到的）。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.05；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8）；启用 `shadowMap`（`PCFSoftShadowMap`）——接地软阴影是体积感的来源。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR（白模要的是干净中性，不是反射）。**v1.8 删除「纯白 Scene PMREM」可选路径**——纯白环境贴图数学上等同 AmbientLight，纯浪费算力；只用半球光即可。
- **灯光**：`HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` 作主光 + 一盏柔和 `DirectionalLight(lights.sun, lights.sunIntensity)`（从等轴斜上方）投射 PCF 软阴影。阴影相机按 `boundary` 包络，`shadow.radius` 调大让阴影虚化。
- **地面**：**不接入 grid.glsl**。浅灰中性 **`MeshLambertMaterial({ color: palette.city-ground, roughness: 0.95, metalness: 0 })`** 大平面，接受软阴影（roughness≥0.9、metalness=0 时 Lambert 视觉等价更便宜）。**v1.9**：叠一层 `makeGroundTexture(token)` 的 `grid` 浅灰建筑网格 `CanvasTexture`（见 `scene-recipe.md` §3.1），地面读出沙盘铺装感而非一片纯色。
- **楼栋材质**：**纯白统一磨砂**——**v1.8 用 `MeshLambertMaterial({ color: '#ffffff' })`**（纯白是白模风格的定义色，非散落 hex；无需高光，Lambert 足够且更便宜）。**按类别上色转移到屋顶描边/轮廓**：楼栋体仍是纯白，但屋顶 `EdgesGeometry`/`Line2` 取 `category.building`（蓝）色、车库入口描边取 `category.garage`（绿）色——这样图例色块与 3D 上色仍一致，不破坏技能核心「按类别上色」铁律。**v1.4 楼层/房间层次**：`roomShade` 极弱（~0.05，仅微微读出楼层，不破坏单色）；楼层之间用浅灰 `building.dividerColor` 虚线分隔，接受阴影、不发光。
- **后处理**：无 bloom。
- **环境（§10）材质**：低饱和鼠尾草色系——草地浅鼠尾草绿、树冠灰绿、树干暖灰、道路/铺装中性灰，全部 **`MeshLambertMaterial`** 接受软阴影；路灯灯头浅色金属玻璃感，**不挂 PointLight**（白模不打点光）。围墙用浅灰混凝土。绿植保留景观语义但饱和度压低，维持单色氛围。`environment.groundGlow` 默认关。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**浅灰底 + 深字**」——底取白/`tile-bg` 浅灰，字取 `text-hi` 深色或类别色，克制不发光。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门白色磨砂 + 绿色描边（接受阴影）；P 牌/楼顶名称标签走对比配对（白底深字）；**地面车位为长方形浅灰铺装（`stallFill`）+ 深描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 哑光灰车辆（`car`）**；POI 图标用低饱和色（按 `poi.<type>`）+ 白底，接受阴影、不发光。

---

## isometric（等距插画 / 信息图）

目标是「扁平但好看的友好信息图」——cel 着色感的彩色楼栋，鲜活但和谐。这是「扁平」生态位里比旧 `minimal` 更讨喜的版本。
- **渲染器**：`NoToneMapping`（保持饱和、色值可预测）；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8）；关闭 `shadowMap`（插画风靠 flatShading 的面明度分层，不靠投影）。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR。
- **灯光**：一盏暖色 `DirectionalLight(lights.sun, lights.sunIntensity)`（**从等轴斜上方**与相机同向）——让 `flatShading` 的每个面得到不同的平涂明度，形成 cel/插画感；可加一个低强度 `HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)` 补暗部。**v1.8 ⛔ DO-NOT-ENABLE-SHADOWS**——方向光锁定相机方向，若开投影，背面/侧面阴影会随相机旋转错乱，破坏插画风；cel 分层靠 flatShading 面明度，不靠投影。
- **地面**：**不接入 grid.glsl**。暖色扁平 **`MeshLambertMaterial({ color: palette.city-ground, flatShading: true })`** 大平面（metalness=0 时 Lambert 视觉等价更便宜）。**v1.9**：叠一层 `makeGroundTexture(token)` 的 `grid` 暖色细网格 `CanvasTexture`（见 `scene-recipe.md` §3.1），地面有插画铺装感而非一片纯色。
- **楼栋材质**：**flatShading cel 着色**——**v1.8 用 `MeshLambertMaterial({ color: category.building, flatShading: true })`**（r119+ Lambert 支持 flatShading，metalness=0 时与 Standard 视觉一致、~30% 更便宜）。**`flatShading: true` 是关键**：BoxGeometry 等几何体的每个面被当作一个平涂色块，配合方向光得到 cel 明度阶梯。可选略深同色 `EdgesGeometry` 作插画描边（不强制，开启时翻倍 draw call，默认关）。**v1.4/v1.7 楼层/贴砖层次**：`roomShade` 较大（~0.18，强化 cel 阶梯）；**相邻贴砖深浅两色交替**；贴砖之间用深海军蓝 `building.dividerColor` 竖实线分隔，楼层之间用同色横向虚线分隔（在彩色面上可读）。
- **后处理**：无 bloom。
- **环境（§10）材质**：鲜活但和谐的插画配色——道路暖棕沥青、车道线奶油色、草地鲜活草绿、树冠鲜绿、树干暖棕，全部 `flatShading` 的 `MeshStandardMaterial`/`MeshLambertMaterial`；路灯灯头暖色小球不发光。`environment.groundGlow` 默认关。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**暖白底 + 深海军蓝字**」——底取白/暖白，字取 `text-hi` 深色或类别色，不发光、保持扁平插画统一。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门友好绿色 `flatShading` 材质 + 略深描边；P 牌/楼顶名称标签走对比配对（白底深字）；**地面车位为长方形暖色铺装（`stallFill`）+ 深描边（`stallLine`）+ 每位印 P（浅底深字）+ ~30% 友好色车身车辆（`car`）**；POI 图标用鲜活友好色（按 `poi.<type>`）+ 白底，不发光、不加阴影——保持扁平插画统一。

---

## 选择与换肤

- **首次生成**：第 3 步用 `AskUserQuestion` 让用户在 7 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 的部分覆盖），重新派生 `_tokens.scss` / `theme.ts` / Three.js 材质。换到/换自 `cyber` 或 `blueprint` 时记得接入或移除 grid pass（这两者消费 `gridGround.glsl`，其余 5 种不消费）。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。（`white-model` 例外：楼栋体纯白，类别色体现在屋顶描边——图例色块仍取 `category` 映射，与描边一致。）
