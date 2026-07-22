# 风格（Styles）—— 4 种视觉模板

园区数字孪生支持 4 种视觉风格，由 `spec.style` 选择（在第 3 步用 `AskUserQuestion` 让用户挑，默认 `cyber`）。每种风格的**配色唯一事实来源**是对应的 token 文件：

| `spec.style` | 风格 | 配色文件 | grid.glsl |
|---|---|---|---|
| `cyber`（默认） | 赛博 | `assets/themes/cyber.tokens.json` | ✅ 使用（霓虹青网格地面） |
| `holographic` | 全息（未来科技） | `assets/themes/holographic.tokens.json` | ❌ 不使用 |
| `nebula` | 深空星云（科幻指挥中心） | `assets/themes/nebula.tokens.json` | ❌ 不使用 |
| `isometric` | 等距插画（信息图） | `assets/themes/isometric.tokens.json` | ❌ 不使用 |

> **grid.glsl 的归属**：只有 `cyber` 接入 `gridGround.glsl` 着色器地面（霓虹青网格）。其余 3 种风格跳过 §3 的 shader 地面，但 **v1.9 起都叠一层 `makeGroundTexture` 程序化 `CanvasTexture`**（§3.1）——不再是纯色色片。`spec.style` 为 `cyber` 时，生成器把 `assets/gridGround.glsl` 接为着色器地面、读 `shaders.grid` uniform；其它风格忽略 `shaders.grid`。

**所有风格共用** `references/scene-recipe.md` 中的：文件布局（§1）、按类别上色思路（§4，含楼顶名称标签）、车库入口标记（§5，v1.3 半金字塔三角门 + P 牌）、地面车位正方形框（§10）、POI 标记 + tooltip（§11）、Legend（§6）、交互/选中（§8）、生命周期（§9）。**只有**「渲染器/灯光/材质/地面/后处理」按风格分支——这就是本文件的内容。`scene-recipe.md` 的 §2–§3 是**赛博**风格的详细配方，其它风格按下文构建。

颜色规则不变：**所有颜色都从所选风格的 token 派生**（SCSS 变量、`:root` CSS 变量、`theme.ts`、Three.js `Color`、uniform）。绝不在场景代码里散落 hex 字面量。

> **v1.8 性能与色彩纪律（所有风格）**：
> - **灯光色也走 token**：每风格 token 新增顶层 `lights` 块（`sun`/`hemiSky`/`hemiGround`/`ambient`/`point` + 各自 intensity/distance）。下文每段的灯光 hex 一律改为引用 `lights.*`，不再散落 `0xRRGGBB` 灯光字面量。`null` 表示该风格不用此光源。
> - **`outputColorSpace = SRGB` 统一**：所有走 `ACESFilmicToneMapping` 的风格（cyber/holographic/nebula）都必须显式 `renderer.outputColorSpace = THREE.SRGBColorSpace`，否则换肤时会出现色调漂移。isometric 用 `NoToneMapping`，仍设 `outputColorSpace = SRGB` 让色值可预测。
> - **`devicePixelRatio` 上限 2**：`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`——4K/retina 不限制会分配超大 framebuffer 拖垮帧率（见 `scene-recipe.md` §2）。
> - **材质能降则降**：`roughness ≥ 0.9 && metalness == 0` 的表面（道路、等距楼栋）用 `MeshLambertMaterial`，视觉等价、~30% 更便宜。
> - **WebGL2 能力检测**：无 WebGL2 时禁用 transmission/reflector/高级阴影过滤，降级到轻量风格路径（见 `scene-recipe.md` §1）。

> **v1.9 防黑屏 + 地面纹理（所有风格）**——修复「整屏一片黑、地面没纹理」痛点：
> - **显式 `scene.background`**：每风格 token 新增顶层 `scene` 块（`bgTop`/`bgBottom`），生成器画成顶→底渐变 `CanvasTexture` 设给 `scene.background`（见 `scene-recipe.md` §2）。`alpha:true` 不再依赖页面底色，暗色风格也有空气感。
> - **环境光下限 `lights.ambientFloor`**：所有风格都额外补一盏低强度 `AmbientLight`（暗色风格 ~0.18–0.20、亮色风格 ~0.08），消灭未受光面纯黑。暗色风格（cyber/holographic/nebula）的 `sunIntensity`/`hemiIntensity` 在本文件对应段已微调上调。

> **v2.1 真实感细节层（所有风格，token 新块）**——细节参数固化在范式实现，配色走 token：
> - **`scene.sky: {clouds, stars, moon}`**：程序化天空开关。nebula 开星空+月亮；holographic 开稀疏星点（须低于 bloom 阈值）；cyber/isometric 无天空元素。
> - **`environment.roadMarking` / `water` / `rooftop`**：地面标线色（各风格与路面高对比：cyber/全息/nebula 发光青/品红、等距奶油）、水景水面色、楼顶设备色。
> - **`ui` 块**：2D 组件观感旋钮（`panelOpacity/panelBlur/panelRadius/glowStrength/glowColor/borderWidth/labelBg/labelText/switcherStyle`）。赛博/全息/nebula = neon 描边发光 pill；其余 2 风格 = flat 克制（glowStrength 0 时组件退化为中性投影）。楼名标签配色统一走 `ui.labelBg/labelText`（v2.1 修复浅色风格黑标签）。
> - **程序化地面纹理 `ground.texture`**：每风格 token 新增顶层 `ground.texture` 块（`{ type, base, line, cell }`）。非 cyber 风格的园区地面叠一层 `makeGroundTexture(token)` 的 `CanvasTexture`（见 `scene-recipe.md` §3.1），消灭「纯色色片」——holographic/nebula 用 `dots`、isometric 用 `grid`。cyber 仍用 `gridGround.glsl` shader 地面，`ground.texture` 仅作 shader 失败降级。

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

## holographic（全息 / 未来科技）

目标是「高端未来科技感」——半透玻璃体 + 边缘辉光 + bloom。「净版未来风」，把「科技感」给到位但不嘈杂。
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

## nebula（深空星云 / 科幻指挥中心）

目标是「深空指挥中心 / 科幻星舰仪表盘」——它**复用全息的渲染路径**（半透体 + 菲涅尔 rim + bloom），但换成**深空紫蓝星云**调色，用星点 + 月亮的天空层与 cyber（明亮青网格）拉开差异：不是「霓虹城市」而是「漂浮在宇宙中的全息投影」。
- **渲染器**：`ACESFilmicToneMapping`，曝光约 1.0；`renderer.outputColorSpace = THREE.SRGBColorSpace`（v1.8）；关闭 `shadowMap`（同全息，靠辉光分层）。DPR ≤ 2。
- **环境**：**不要** PMREM/HDR（同全息——会把半透体照得浑浊）；用一个极低强度 `HemisphereLight` + `AmbientLight` 让半透体保留通透感。**v1.9**：`scene.background` 顶→底渐变（`scene.bgTop` 深紫 `#1a0a2e` → `bgBottom` 近黑 `#05010f`），叠星点 + 月亮（`scene.sky.stars`/`scene.sky.moon` 全开）——这是深空感的来源。
- **灯光**：低强度 `HemisphereLight(lights.hemiSky, lights.hemiGround, lights.hemiIntensity)`（偏紫蓝）+ `AmbientLight(lights.ambient, lights.ambientIntensity)`；无太阳/方向光。补 `ambientFloor` 兜底，半透体在深空底仍可辨（仍通透、不浑浊）。
- **地面**：**不接入 grid.glsl**。近黑 `MeshBasicMaterial`（`palette.void-bg`）大平面 + 自发光品红 `Line2` 园区轮廓勾边 + 可选径向辉光（一个透明渐变 Sprite 或 shader 在地心，色取品红/青），强化「全息投影台」感。**v1.9**：地面叠一层 `makeGroundTexture(token)` 的 `dots` 品红点阵 `CanvasTexture`（作 `map` 或低强度 `emissiveMap`，见 `scene-recipe.md` §3.1），与轮廓/辉光共同消灭死黑地板。
- **楼栋材质**：**半透体 + 边缘辉光（菲涅尔 rim）**——building mode `holo` + `useRim:true`：
  - 体：`MeshStandardMaterial({ color: category.building (#b8a0ff 淡紫), transparent: true, opacity: 0.35, emissive: color, emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.2 })`。
  - 边：高亮自发光**品红/青双色** `EdgesGeometry`/`Line2`（`emissive` 色取 `cyan-bright`、`building.dividerColor` #d8c4ff 淡紫白），让楼栋轮廓在深空底发光——这是星云全息感的来源。菲涅尔 rim 用 `onBeforeCompiler` 注入 `assets/fresnelRim.glsl` 片段做廉价近似即可——这是唯一推荐的边缘辉光增强路径。**v1.8 ⛔ 禁用 `MeshPhysicalMaterial transmission`**（同全息，与 bloom 叠加是性能黑洞）。
  - **v1.4/v1.7 楼层/贴砖层次**：幕墙画布按 §4.1 切贴砖（`roomShade` ~0.14，半透体上的**相邻两色交替**）；贴砖之间用自发光淡紫 `building.dividerColor` 竖实线分隔，楼层之间用同色横向虚线分隔，与边缘辉光融为一体。
- **后处理**：`UnrealBloomPass` 强度 ~0.5（高于全息）——让半透体的边缘/轮廓/POI 在深空底强烈溢出，这是星云指挥中心感的灵魂。**v1.8 优先选择性 bloom**（只对边缘/POI/星点自发光层 bloom，避免整屏 bloom 把深空底一起提亮）；可选 CSS/Shader 扫描线叠加（注为可选增强）。
- **环境（§10）材质**：深空底 + 自发光品红/青标线/勾边——道路近黑 `MeshBasicMaterial`、车道线自发光品红 `Line2`、草地/树冠压成深紫抽象块；路灯灯头自发光品红/青小点不挂 `PointLight`（靠 bloom 表现）。`environment.groundGlow` 默认开（品红勾边是星云感的一部分）。
- **标签对比（v1.4，§4.2）**：所有 CanvasTexture 标签走「**深空底 + 自发光品红/青亮字**」——底取 `palette.void-bg`/`panel-bot` 近黑紫，字取自发光品红/青（`cyan-bright`/淡紫），bloom 微溢。
- **车库入口 / 地面车位 / POI（v1.4）**：半金字塔三角门用半透 `MeshStandardMaterial` + 自发光品红 `EdgesGeometry` 描边；P 牌/楼顶名称标签自发光（深底亮字）；**地面车位为长方形近黑铺装（`stallFill`）+ 自发光品红描边（`stallLine`）+ 每位印 P（深底亮字自发光）+ ~30% 深色车身车辆（`car`）**；**POI 图标按 `poi.<type>` 自发光色 + 深空底 + bloom**——星云背景下 POI 标记与楼栋边缘辉光共同构成画面亮点。

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

- **首次生成**：第 3 步用 `AskUserQuestion` 让用户在 4 个风格里选，写入 `spec.style`。
- **换肤已有产物**：改 `spec.style`（与/或 `spec.tokens` 的部分覆盖），重新派生 `_tokens.scss` / `theme.ts` / Three.js 材质。`cyber` 消费 grid 着色器、其余 3 种不消费——换到/换自 `cyber` 时记得接入或移除 grid pass。
- **类别颜色一致性**：所有风格的 Legend 与楼栋颜色都来自**该风格** token 的 `category` 映射；图例色块和 3D 上色天然一致。
