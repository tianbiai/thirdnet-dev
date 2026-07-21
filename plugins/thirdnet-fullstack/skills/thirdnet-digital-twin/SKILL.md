---
name: thirdnet-digital-twin
description: >
  根据文字需求、手绘草图、效果图或 Pencil `.pen` 设计源，生成一个 园区数字孪生（park digital-twin）3D 模块——
  固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器 + 点击选中/详情交互。产出 Vue 3 + TypeScript + Three.js
  场景：按类别上色的楼栋（楼幢/地下车库入口）、每栋楼顶常驻名称标签、屏幕图例、完整园区环境（内部道路/地面车位/
  绿化/周边市政道路/围墙/路灯）、POI 兴趣点打点（类型+坐标+楼层归属+tooltip/popup），由一份经过用户确认的 Park Spec 驱动。
  支持 7 种视觉风格（赛博/真实物体/夜间写实/蓝图/全息/白模/等距插画）；楼栋立面程序化楼层虚线 + 贴砖拼花（相邻两色强对比交替）；
  所有标签高对比可读。数据分层：基础信息静态内联，动态数据（楼幢名/楼层数/楼层详情/POI 点位及实时状态）走 `IDigitalTwinApi`
  契约层（`getBuildings`/`getFloorDetail`/`getPois`，遵循 `api-typescript-spec` 的 5 文件契约 + Real/Mock 工厂，
  `VITE_MOCK_ENABLED` 切换），「脚手架先行再水合」加载。v1.8：补齐 poi.status/groundGlow/lights token、JSON Schema、
  validator 跨字段校验、性能纪律（night-realistic PointLight 上限、holographic 禁用 transmission、MeshLambert 降级、DPR≤2、
  InstancedMesh）、健壮性（WebGL context loss、Promise.allSettled、AbortSignal 防 race）、响应式与可访问性规范。
  v1.9：防黑屏——显式 `scene.background`（token `scene` 顶→底渐变）+ 所有风格环境光下限 `lights.ambientFloor`；
  地面纹理——非 cyber/blueprint 风格叠程序化 `makeGroundTexture` `CanvasTexture`（grid/tiles/dots）+ cyber/blueprint shader 失败降级；
  POI 名称仅悬停——POI Sprite 只画类型图标、显示名走 HTML tooltip/卡片（楼幢楼顶名/车库 P 牌/车位 P 牌保持常驻）。
  v2.0：写实增强层——随包发布完整范式实现 `assets/park-scene.impl.ts`（生成器「拷贝-改」而非从散文合成，消灭环境贴图/bloom/环境光下限/渐变背景的漂移）；
  realistc/night-realistic 放宽上限——RoomEnvironment 环境贴图（玻璃/金属有反射、不发黑）+ EffectComposer/UnrealBloomPass（夜景辉光）+ GTAO 接触阴影 + 夜间地面湿润反射；
  其余 5 风格守纪律（无 env/AO/反射、PointLight≤8、transmission 禁用、DPR≤2）。新增 token.realism 旋钮块（material/bloom/ao/reflection/fog/sun）+ assets/tokens.schema.json 结构校验。
  本技能只生成数字孪生模块本身，外围面板留空由调用方自行填充。
  只要用户想构建、生成、复刻或换肤一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏、数字孪生驾驶舱、社区驾驶舱，
  或者提供了一张园区/社区的草图/效果图/`.pen` 并希望得到可运行的前端，就必须使用本技能，
  即使他们没有明确说出“数字孪生”或“技能”这些词。同样适用于扩展或修复一个已存在的园区/社区驾驶舱——
  补上缺失的着色器、添加图例、按类别重上色、切换风格、丰富园区环境（道路/车位/绿化）、打 POI 点位、
  把写死的数据改成走后端 API（含 Mock/Real 工厂与 `VITE_MOCK_ENABLED` 切换）等。
license: MIT
metadata:
  version: "2.0.0"
  author: park-cockpit
compatibility: Vue 3 + TypeScript + Vite + Three.js 项目；赛博与蓝图风格下消费 WebGL 片段着色器（grid.glsl/gridGround.glsl）。动态数据契约层遵循 `api-typescript-spec`（`IDigitalTwinApi` + Real/Mock 工厂，`VITE_MOCK_ENABLED` 切换）。可在范例仓库、create-thirdnet-admin 项目或任何最小化的 Vite+Vue+Three 脚手架中运行。
---

# 园区数字孪生（Park Digital Twin）

根据园区需求，生成一个 **园区数字孪生** 3D 模块（固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器；**外围留空**，不生成 TopBar / 角括号 / 数据面板）。生成器构建的一切都源自一份你从用户输入中抽取、并与用户确认过的 **Park Spec**——任何园区特定的内容都不会被硬编码。

中央场景**按所选风格构建**——赛博与蓝图风格用 `grid.glsl` 着色器地面（赛博霓虹青网格、蓝图深蓝图底 + 淡白青坐标网格）；真实物体/夜间写实用 PBR，全息用半透体 + 边缘辉光，白模用全白磨砂 + 软阴影，等距插画用 flatShading cel 着色（见 `references/styles.md`）。所有风格都包含：按类别上色的楼栋、**每栋楼顶常驻的名称标签**、车库入口标记（半金字塔三角门 + P 牌）、屏幕图例，以及点击楼栋→聚焦→详情的交互。**v1.2 起还包含完整园区环境**——内部道路、地面车位（**v1.4 起为长方形车位 + 每位印 P + 约 30% 车辆示意停放**）、绿化景观（草地/行道树/中央广场）、周边市政道路、围墙与出入口、路灯（夜间写实风格下发光）；默认取景为一张能看全园区轮廓与紧邻环境的全景图（园区内容占画面 ~2/3，四周留白显示周边道路/绿化/围墙）。**v1.3 起新增 POI 兴趣点打点**（类型驱动图标/颜色 + 坐标/楼层归属 + 悬停/点击 tooltip），全部数据由后台 Park Spec 配置。**v1.4 起**：楼幢立面画**楼层虚线分隔 + 每层 1–5 块贴砖**（程序化装饰，确定性随机、不进 spec），并强制所有 CanvasTexture 标签（楼名/车库 P/车位 P/POI 图标）**高对比可读**（亮底深字 / 暗底亮字），杜绝「霓虹底 + 白字」看不清的问题。**v1.7 起**：贴砖升级为**相邻两块深浅两色强对比交替 + 高对比深色竖实线分隔**（楼层横向分隔仍为虚线）；楼层选中交互闭环——**悬停即金色边框、点击锁定（移开保留）、点空白取消并回全局**。（如果你是在扩展一个已有的社区驾驶舱项目，请注意其当前场景可能已偏离成"夜间写实"风格，并且从未接入着色器——本技能产出的是符合所选风格规范的版本；参见 `references/exemplar.md`。）

## 何时使用

- 用户想 构建 / 生成 / 复刻 / 换肤 一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏，或数字孪生驾驶舱。
- 用户提供了园区的 **草图**、**效果图/rendering** 或 **`.pen`**，希望得到可运行的前端。
- 用户用文字描述了一个园区，希望得到 3D 大屏。
- 用户想 **修复/扩展** 一个已存在的园区驾驶舱（接入着色器、添加图例、按类别重上色、让数据由 spec 驱动）。
- 用户想把驾驶舱里**写死的数据改成走后端 API**——基础信息仍静态内联，动态数据（楼幢名/楼层数/楼层详情/POI 点位）通过 `IDigitalTwinApi` 契约层获取，开发期 Mock、正式环境真实 API。

## 何时不要使用

- 通用的 3D 游戏场景、建筑可视化或产品配置器（不是园区运营驾驶舱）。
- 没有 3D 数字孪生的 图表 / 数据可视化 / 分析仪表盘 → 使用 `dataviz` 技能。
- 非园区类运营中心（城市大脑、工厂车间），除非用户明确要求这种布局。

## 工作流

### 1. 对输入分类
判断用户处于哪种模式，并按 `references/intake.md` 中对应的路径执行：
- **文字 + 访谈** —— 散文式描述或楼栋/楼层/车库清单。
- **手绘草图** —— 一张布局的照片/扫描件。
- **效果图** —— 目标 效果图/截图。
- **`.pen` 设计源** —— 一个 Pencil 文件。

### 2. 抽取 Park Spec 草稿
按 `references/park-spec.md`（schema 是唯一事实来源）产出一份草稿 `spec.json`。对于 `.pen`，先运行抽取器：
```bash
python scripts/extract_pen.py <file.pen> --out spec.json
```
对于草图/效果图，用 `Read` 工具读取图像（或 `zai` 的 analyze_image MCP）提取拓扑/配色，然后通过提问补全数字。

### 3. 与用户确认 spec
对任何你无法推断的内容用 `AskUserQuestion` 确认——标题、车库入口位置/朝向、位置/尺寸（**v1.3 起不再问车库车位数**）。**同时让用户选择视觉风格**（赛博 / 真实物体 / 夜间写实 / 蓝图 / 全息 / 白模 / 等距插画，默认赛博），写入 `spec.style`。**v1.2 起追加一组「环境与氛围」问题**（地面车位 / 绿化密度 / 周边道路 / 氛围细节；智能默认 + 询问——用户不答就用默认，详见 `references/intake.md`），把答复写入 `spec.environment`。**v1.3 起追加一组「兴趣点 POI」问题**（要打哪些类型的点、名称、位置、tooltip 内容；不答则 `pois: []`），把答复写入 `spec.pois`。然后校验：
```bash
python scripts/validate_spec.py spec.json
```
生成前修掉每一个 `FAIL:`。展示一段摘要（标题、楼栋、车库入口、风格、**环境元素清单**、**POI 清单**），确认后继续。

### 4. 生成数据层（基础信息静态 + 动态数据 API 化）

v1.5 起数据分两层（详见 `references/dynamic-data-api.md`）。**spec 仍是创作唯一事实来源**——生成器把它的内容分区输出：

**4a. 生成静态脚手架 `src/data/<park>.ts`** —— 只含**基础信息**：楼栋**占地几何**（id / w / d / x / z / category / facing，车库入口位置也在这）、园区环境驱动数据。数据形状从 `references/exemplar.md`（`buildings.ts`）拷贝。**不含**楼幢名/楼层数/floor_ids/楼层详情/POI——这些是动态数据。绝不硬编码园区内容——一切都来自 spec。

**4b. 生成动态数据契约层** —— 按 `references/dynamic-data-api.md` 产出 `IDigitalTwinApi` 的 5 文件契约层（`api/types/` + `api/interfaces/manager/` + `api/modules/manager/` + `mock/api/manager/` + `mock/data/manager/`，遵循 `api-typescript-spec`）。**Mock 数据从 spec 派生**：`buildings[].name/floors/floors_detail` → `mockBuildings` / `mockFloorDetails`；`pois[]` → `mockPois`（含状态与停车场 `occupancy`——v1.3 外包的车库占用并入 POI）。**宿主自适应**：若 `src/api/request.ts` + `src/config/index.ts` 已存在（create-thirdnet-admin 项目）则复用，接口契约文件放扁平 `api/interfaces/digital-twin.ts`；否则生成最小 fetch 封装 + config + `.env`（见 `dynamic-data-api.md` §10）。

**4c. 接入组件水合** —— `GlobalTwin.vue` 在 `onMounted` 并行拉 `getBuildings()` + `getPois()` 水合场景，点击楼层按需拉 `getFloorDetail()`；`BuildingSwitcher` 标签与 `UnitDetail` 数据源改为来自这两个 API。详见 `references/dynamic-data-api.md` §9 与 `references/scene-recipe.md` §12。

### 5. 生成 3D 场景
**v2.0 起，先读 `references/park-scene-impl.md`，然后以 `assets/park-scene.impl.ts` 为基线「拷贝-改」产出 `src/scene/ParkScene.ts`**（同时拷贝 `assets/building-geometry.ts` → `src/scene/building-geometry.ts`，楼栋几何装配的单一事实来源）——不要从散文合成渲染管线（v1.x 实测会让 LLM 漂移，丢掉环境贴图/bloom/环境光下限/渐变背景，并手写错位楼栋几何）。范式实现已落地全部 v1.9 防黑屏项 + v2.0 写实增强层：只需替换脚手架数据源（对齐 `ParkScaffold`/`ScaffoldBuilding`/`BuildingRuntimeItem`/`PoiRuntimeItem` 到本项目的 data/api 类型），按 `spec.style` 选 profile（**不要手改 PROFILES 表**），写实观感改 `assets/themes/<style>.tokens.json` 的 `realism` 块。设计原理与逐风格材质/灯光说明仍见 `references/scene-recipe.md`（§2 渲染器、§3 地面）与 `references/styles.md`（每风格段）；冲突时以范式实现代码为准。

赛博与蓝图风格下不可妥协的内容：把 `assets/gridGround.glsl` 接为着色器地面（赛博霓虹青、蓝图深蓝图底 + 淡白青网格，uniform 取各自 token 的 `shaders.grid`）；其它风格跳过这块，改用 PBR/半透/扁平/flatShading 材质。所有风格都按类别给楼栋上色、**在每栋楼顶加常驻名称标签**（§4）；**v1.4 起楼栋立面必须画楼层虚线分隔 + 每层 1–5 块贴砖**（§4.1，程序化、确定性随机），**v1.7 起贴砖必须相邻两块深浅两色强对比交替 + 高对比深色竖实线分隔**；**所有 CanvasTexture 标签走高对比配对**（§4.2，亮底深字 / 暗底亮字）；**把地下车库渲染成半金字塔三角门入口 + P 牌**（§5，v1.3，不再有占用标牌）；添加 Legend 叠加层。**v1.2 起按 `references/scene-recipe.md §10` 生成园区环境**（内部道路 / 地面车位 / 绿化 / 周边市政道路 / 围墙 / 路灯），由 `spec.environment` 驱动，缺失时走智能默认——**v1.4 起地面车位为长方形车位 + 每位印 P + 约 30% 车辆示意停放**（`occupied` 控制放车数）；**v1.3 起按 §11 `buildPOIs` 生成兴趣点**（类型化标记 + tooltip/popup），由 `spec.pois` 驱动，缺省不生成；并按 §2 的 `frameCamera()`（默认 K=0.66）取景，确保默认就是一张看全园区与周边环境的全景图。

### 6. 生成舞台 + 楼栋切换器
遵循 `references/shell.md`——1920×1080 舞台（`useScaleBoard` 信箱式缩放）+ BuildingSwitcher + CenterStage/GlobalTwin/UnitDetail。**不再生成 TopBar、CornerBrackets 或任何外围数据面板；舞台左右两侧与底部留空**，由调用方自行填充。

### 7. 接入切换器 + 选中
从范例原样拷贝 `useSelection.ts`（见 `references/shell.md`）。切换器标签页和 3D 点击都通过它写入；当某栋楼被聚焦时 `CenterStage` 显示 `UnitDetail`。包含 地下车库 标签页。

### 8. 验证
`npm run dev`（端口 3000），并执行 `references/scene-recipe.md` 和 `references/shell.md` 中的检查清单。然后 `npm run typecheck`。截图并与用户确认布局与风格。

## 数据分层：基础信息 vs 动态数据（v1.5）

页面数据分两层，**spec.json 仍是创作唯一事实来源**，生成器分区输出：

| 数据 | 归属 | 运行期来源 |
|---|---|---|
| 风格 / tokens / shaders / 字体 / 舞台 / boundary / floorHeight | 基础信息 | 静态内联 |
| **楼栋位置与占地**（id / w / d / x / z / category / facing） | 基础信息 | 静态内联（`src/data/<park>.ts`） |
| 园区环境（道路 / 绿化 / 周边市政 / 围墙 / 路灯） | 基础信息 | 静态内联（`spec.environment`） |
| Legend 类别 / switcher 骨架 | 基础信息 | 静态内联 |
| **楼幢业务数据**（name / floors 楼层数 / floor_ids / header） | **动态** | `getBuildings()` |
| **楼层详情**（租户/单位，点击楼层后取） | **动态** | `getFloorDetail()` |
| **POI 点位**（设备 / 停车场位置 / 监控 + 实时状态 + 占用） | **动态** | `getPois()` |

**「脚手架先行，再水合」加载序列**：① 同步渲染静态脚手架（环境 + 楼栋占地底板 + Legend + 相机取景，**取景只用静态几何，不等动态数据**）→ ② `Promise.allSettled([getBuildings(), getPois()])`（v1.8：POI 失败不连累楼栋）→ 水合楼栋（按 `floors` 挤出高度 + 楼顶标签 + 楼层拾取板）与 POI（标记 + 状态色）→ ③ 点击楼层 → `getFloorDetail({signal})`（v1.8：AbortSignal + onCleanup 防快速切换 race）弹 `UnitDetail`。

**动态数据走 `IDigitalTwinApi` 契约层**（遵循 `api-typescript-spec`：5 文件契约 + Real/Mock 工厂 + `VITE_MOCK_ENABLED` 切换；GET-only、snake_case、响应无信封）。开发/演示期 Mock 返回由 spec 派生的数据，正式环境调真实后端（前端先行，含后端接口契约）。完整规范、代码示例、宿主自适应、后端端点契约见 `references/dynamic-data-api.md`。

## Park Spec（速查）

完整 schema 见 `references/park-spec.md`。完整且通过校验的示例在 `evals/files/example-spec.json`；从 `.pen` 抽取的草稿在 `evals/files/sample-pen-extract.json`。坐标系：世界单位，Y 轴朝上，`floorHeight` 为 24，`boundary` 为 {x:360, z:220}。类别：`building`（青色，楼顶显示楼名）和 `garage`（薄荷绿，**v1.3 起渲染为半金字塔三角门入口 + P 牌，不再有占用数据**）——至多一个车库。**v1.2 新增可选字段 `environment`**（内部道路/地面车位/绿化/周边道路/氛围）；**v1.3 新增可选字段 `pois`**（兴趣点：类型+坐标+楼层归属+tooltip）；两者缺省即智能默认/不生成。

## 设计 token（唯一事实来源）

`assets/themes/<style>.tokens.json`（按 `spec.style` 选取，默认 `cyber`）存放该风格的配色、类别→颜色映射、着色器 uniform 默认值（仅赛博）和字体名。生成器从它派生**所有**颜色——SCSS 变量、`:root` CSS 变量、`theme.ts`、Three.js `Color` 实例和着色器 uniform。要给园区换肤，编辑 `spec.tokens` 覆盖（或改 `spec.style` 换整套模板）；绝不要在各文件里散落 hex 字面量。

## 风格（Styles）

7 种视觉模板，由 `spec.style` 选择，第 3 步用 `AskUserQuestion` 让用户挑：

- **`cyber`（默认）** —— 赛博：`grid.glsl` 着色器地面 + 自发光霓虹。
- **`realistic`** —— 真实物体：日间 PBR（玻璃/混凝土）+ 天空/太阳环境光 + 柔和阴影。
- **`night-realistic`** —— 夜间写实：PBR + 深蓝夜空 + 窗户自发光 + 路灯 + 微反射。
- **`blueprint`** —— 蓝图：深蓝图底 + 淡白青坐标网格地面（与 cyber 共用 `grid.glsl`）+ 白线框楼栋。工程/BIM 风。
- **`holographic`** —— 全息：半透青玻璃体 + 自发光边缘辉光 + bloom。未来科技风。
- **`white-model`** —— 白模：全白磨砂 + 柔和接地阴影（类别色转移到屋顶描边）。博物馆/沙盘级纯净汇报。
- **`isometric`** —— 等距插画：`flatShading` cel 着色的鲜活彩色楼栋。扁平信息图风。

各风格的渲染器/灯光/材质/地面分支细则见 `references/styles.md`；配色见对应 `assets/themes/*.tokens.json`。`cyber` 与 `blueprint` 消费 `gridGround.glsl`（仅 uniform 不同），其余 5 种不接入。

## 参考文件（按需阅读）

| 文件 | 何时阅读 |
|---|---|
| `references/intake.md` | 步骤 1–3：把任何输入模式转换为已确认的 Park Spec |
| `references/park-spec.md` | 编写/编辑 spec —— 规范 schema + 完整示例（含 v1.5 数据分层注记） |
| `references/dynamic-data-api.md` | **步骤 4b/4c/5（v1.5）：动态数据 API 契约层** —— `IDigitalTwinApi` + Real/Mock 工厂 + `VITE_MOCK_ENABLED` + 组件水合时序 + 后端接口契约 + 宿主自适应 |
| `references/styles.md` | 步骤 3/5：7 种风格的渲染器/灯光/材质/地面分支（含 v1.3 车库入口/地面车位/POI 材质） |
| `references/scene-recipe.md` | 步骤 5：赛博详细配方 + 所有风格共用部分（楼顶标签、车库入口、地面车位、POI、图例、交互、生命周期、**§12 动态数据接入与水合**） |
| `references/shell.md` | 步骤 6/7：1920×1080 舞台 + 楼栋切换器 + 中央组件 + 选中（含 v1.5 动态数据水合接线） |
| `references/design-source.md` | 输入是 `.pen` —— 如何通过脚本 + pencil MCP 读取 |
| `references/exemplar.md` | 向一个已有的社区驾驶舱范例项目生成 —— 该拷贝什么 vs 该修什么 |

## 脚本（黑盒——先用 `--help` 运行，不要读进上下文）

- `scripts/extract_pen.py <file.pen> --out spec.json` —— `.pen` → Park Spec 草稿（token、grid uniform、楼栋头信息、图例、标题；v1.3 起不再抽车库占用数字）。Windows 上用 `--out`，不要用 `--stdout`。
- `scripts/validate_spec.py spec.json` —— schema 校验（含 `pois` 类型/坐标/楼层归属校验、`environment` 智能默认提示）；退出码 0 = 通过。

## 约定

- **Vue 3 `<script setup lang="ts">`**，Composition API，严格 TS。除非项目已存在，否则不用 router/pinia。
- **开发服务器端口 3000。** 脚本：`dev`、`build`（`vue-tsc --noEmit && vite build`）、`typecheck`。
- **字体：** Noto Sans SC（中文）+ Rajdhani（拉丁/数字），来自 Google Fonts。
- **固定 1920×1080 舞台**，通过 `useScaleBoard` 缩放适配（信箱式，非响应式）。
- **数据分层（v1.5）：基础信息静态内联，动态数据走 `IDigitalTwinApi`**（`getBuildings` / `getFloorDetail` / `getPois`）。遵循 `api-typescript-spec`：5 文件契约层 + `RealDigitalTwinApi`/`MockDigitalTwinApi` + `createDigitalTwinApi()` 工厂，`VITE_MOCK_ENABLED`（字符串 `"true"`/`"false"`，**非** `VITE_USE_MOCK`）切 Mock/Real；GET-only、snake_case、响应无 `{code,message,data}` 信封。宿主自适应（admin 模板复用其 `request`/`config`/`mockDataStripPlugin`；独立项目生成最小 fetch 封装）。详见 `references/dynamic-data-api.md`。
- **图片 URL：** 每张 `<img>` 都配一个 `@error` 兜底；randomuser.me / loremflickr / picsum / unsplash 可用，pravatar.cc 被屏蔽。

## 验证（端到端）

- [ ] `python scripts/validate_spec.py` 对 spec 返回 `OK`（含 `style` 枚举校验）。
- [ ] 舞台 1920×1080 信箱式缩放到视口；**外围区域为空**（无 TopBar / 角括号 / 5 个数据面板）。
- [ ] `npm run dev`（端口 3000）：楼栋按类别上色且与图例色块一致；**每栋楼顶常驻显示名称标签**（v1.3）；**楼栋立面有楼层虚线分隔 + 每层 1–5 块贴砖、相邻贴砖深浅两色强对比交替 + 高对比深色竖实线分隔，重复生成一致**（v1.4 / v1.7）；**所有标签（楼名/车库 P/车位 P/POI）高对比可读，远观不糊**（v1.4）；**地下车库为半金字塔三角门入口 + P 牌，无车位数/进度条**（v1.3）；**地面车位为长方形车位 + 每位印 P + 约 30% 车辆示意停放，无正方形框/区域 P 牌**（v1.4）。
- [ ] **赛博 / 蓝图风格下**：着色器网格地面可见（cyber 霓虹青、blueprint 深蓝图底 + 淡白青坐标网格）。**其它风格下**：按 `references/styles.md` 的材质/灯光构建（如真实物体有 PBR 反射与柔和阴影、夜间写实有窗户自发光、全息有半透体 + 边缘辉光、白模有纯白磨砂 + 软阴影、等距插画有 flatShading cel 着色），且除 blueprint 外未接入 grid。
- [ ] **POI（v1.3）**：标记按类型上色；悬停高亮、点击弹出 tooltip（含 `description` + `meta`）；点 POI 不误触楼栋聚焦；`pois` 缺省时不生成任何标记。
- [ ] 切换器包含所有标签页，含 地下车库；点击某楼层会金色高亮它并打开详情面板（UnitDetail）。
- [ ] **楼层选中闭环**（v1.7）：悬停某层立即出金色边框；点击锁定后鼠标移开金边仍保留；**点击空白或非楼栋物体 → 之前选中楼层的金边消失、楼栋聚焦与相机回到全局概览**。
- [ ] **滚轮可缩放、右键可平移、左键可旋转**，松手后视角保持（聚焦补间是「事件触发 + 有限时长」tween，结束后不抢占 OrbitControls；详见 `references/scene-recipe.md` §8）。
- [ ] **默认取景是全景**：园区内容约占画面 2/3（K=0.66），四周能看到周边市政道路/绿化/围墙；滚轮可继续拉远到 zoom≈0.45。
- [ ] **园区环境完整**：场景里有内部道路、地面车位带、行道树与绿地、四向市政道路、围墙与主出入口、路灯（夜间写实风格下路灯发光，cyber 风格下地面发光标线可见）；环境元素不影响楼栋点击选中。
- [ ] **动态数据契约层（v1.5）齐全**：`src/api/types/digital-twin.ts` + `src/api/interfaces/(manager/)digital-twin.ts` + `src/api/modules/manager/digital-twin.ts` + `src/mock/api/manager/digital-twin.ts` + `src/mock/data/manager/digital-twin.ts` 五件齐全；`IDigitalTwinApi` 含 `getBuildings`/`getFloorDetail`/`getPois`；`createDigitalTwinApi()` 工厂按 `VITE_MOCK_ENABLED` 切 Mock/Real。
- [ ] **脚手架先行再水合**：`VITE_MOCK_ENABLED=true` 下 `npm run dev`，页面先出静态脚手架（环境 + 楼栋占地底板 + Legend），随后水合出楼栋高度/楼顶名称、POI 标记；点击楼层弹出由 `getFloorDetail()` 返回的 `UnitDetail`。Mock 数据与 spec 的楼名/楼层数/POI 一致。
- [ ] **正式环境走真实 API**：切 `VITE_MOCK_ENABLED=false`，浏览器 Network 可见请求落到 `/api/manager/park/buildings|floor-detail|pois`（无后端时 404 属预期，证明走真实路径而非 Mock）。
- [ ] **水合三态兜底**：请求中显示骨架/底板（不白屏）；失败显示降级提示且脚手架仍可交互；`getPois()` 返回空数组不报错（不渲染 POI）。
- [ ] **v1.8 性能纪律**：`renderer.setPixelRatio(Math.min(dpr, 2))`；所有风格 `outputColorSpace = SRGB`；night-realistic 的 `PointLight` 总数 ≤8 且 `castShadow=false`、车灯为自发光球；holographic 未使用 `MeshPhysicalMaterial transmission`；roughness≥0.9 & metalness=0 的表面用 `MeshLambertMaterial`；同类环境元素 ≥10 个走 `InstancedMesh`。
- [ ] **v1.8 健壮性**：水合用 `Promise.allSettled`（POI 失败不连累楼栋）；floor-detail `watch` 用 `onCleanup`+`AbortController` 取消旧请求（快速切层不串台）；`request<T>()` 支持超时；Mock/Real 都抛 `ApiError`；canvas 监听 `webglcontextlost/restored`；`onBeforeUnmount` 走完整 `dispose()` 清单。
- [ ] **v1.8 响应式与 a11y**：1280×720 仍可用（舞台等比缩放）；resize 防抖；切换器 `role="tab"` + 方向键导航；canvas 有 `aria-label`；POI/UnitDetail 弹出有焦点管理与 Esc 关闭；`prefers-reduced-motion` 下禁用 tween 与呼吸动画；空态（`getBuildings()` 返 `[]`）有遮罩 + 重试。
- [ ] **v1.8 token/契约自洽**：`assets/themes/*.tokens.json` 7 个文件都含 `poi.status` / `environment.groundGlow` / `lights` 块；`assets/spec.schema.json` 存在且 `validate_spec.py` 对正/负向用例结论一致；styles.md 无散落灯光 hex（全走 `lights.*`）。
- [ ] **v2.0 写实增强层**：以 `assets/park-scene.impl.ts` 为基线生成（非散文合成）。realistic/night-realistic 的 `scene.environment` 已赋值（RoomEnvironment PMREM），玻璃/金属有反射、不发黑；night-realistic/holographic/cyber 的 `EffectComposer`+`UnrealBloomPass` 已实例化，亮部有可见溢光；realistic/night-realistic 的 GTAO 生效、夜间地面湿润反射生效（帧率可接受）。逐风格切换肉眼确认。
- [ ] **v2.0 轮廓对齐**：楼栋几何装配走 `assets/building-geometry.ts` 的 `buildBuilding()`（与 `park-scene.impl.ts` 一起拷贝），**不在 ParkScene 里手写 podium/body/edges/cap/dividers/slab 的 position.y**；`EdgesGeometry` 立体轮廓与楼体同位（`position.y = h/2`），不再半埋地下；金色楼层高亮中心用 `(fin+0.5)*fh`、与 slab 对齐不偏移。
- [ ] **v2.0 token 结构校验**：所选风格 token 通过 `assets/tokens.schema.json` 结构校验（含 `realism` 块）；realistic/night-realistic 的 `realism.material.envMapIntensity` 非 0（否则玻璃发黑 WARN）。
- [ ] `npm run typecheck` 干净通过。
