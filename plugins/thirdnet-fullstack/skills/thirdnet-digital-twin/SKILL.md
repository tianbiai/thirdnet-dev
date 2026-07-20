---
name: thirdnet-digital-twin
description: >
  根据文字需求、手绘草图、效果图或 Pencil `.pen` 设计源，生成一个 园区数字孪生（park digital-twin）3D 模块——
  固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器 + 点击选中/详情交互。产出 Vue 3 + TypeScript + Three.js
  场景：按类别上色的楼栋（楼幢/地下车库入口）、每栋楼顶常驻名称标签、屏幕图例，由一份经过用户确认的 Park Spec 驱动。
  v1.2 起场景包含完整园区环境——内部道路、地面车位、绿化景观（草地/行道树/广场）、周边市政道路、围墙、路灯，
  默认取景为一张能看全园区轮廓与紧邻环境的全景图（园区占画面 ~2/3），不再只是「楼栋 + 空地」。
  v1.3 起：地下车库简化为「半金字塔三角门入口 + P 牌」（不再显示车位数）；地面车位为正方形车位框 + 区域 P 牌；
  楼幢顶部常驻楼名标签；新增「兴趣点 POI」打点（类型+坐标+楼层归属+tooltip/popup），全部数据由后台 Park Spec 配置。
  v1.4 起：楼幢立面画楼层虚线分隔 + 每层 1–5 间不同明度房间（程序化，确定性随机）；所有标签（楼名/车库 P/车位 P/POI）高对比可读（亮底深字或暗底亮字）；
  地面车位改为长方形车位 + 每位直接印 P + 默认约 30% 车位放置汽车示意停放（不再用正方形框/区域 P 牌）。
  支持 4 种视觉风格由用户选择——赛博（grid.glsl 着色器地面 + 自发光霓虹）、真实物体（日间 PBR）、
  简约科技（浅色扁平）、夜间写实（PBR + 灯光）。本技能只生成数字孪生模块本身，外围面板留空由调用方自行填充。
  只要用户想构建、生成、复刻或换肤一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏、数字孪生驾驶舱、社区驾驶舱，
  或者提供了一张园区/社区的草图/效果图/`.pen` 并希望得到可运行的前端，就必须使用本技能，
  即使他们没有明确说出“数字孪生”或“技能”这些词。同样适用于扩展或修复一个已存在的园区/社区驾驶舱——
  补上缺失的着色器、添加图例、按类别重上色、切换风格、丰富园区环境（道路/车位/绿化）、打 POI 点位等。
license: MIT
metadata:
  version: "1.4.0"
  author: park-cockpit
compatibility: Vue 3 + TypeScript + Vite + Three.js 项目；赛博风格下消费 WebGL1 片元着色器（grid.glsl）。可在 d:\Vibe\社区 仓库或任何最小化的 Vite+Vue+Three 脚手架中运行。
---

# 园区数字孪生（Park Digital Twin）

根据园区需求，生成一个 **园区数字孪生** 3D 模块（固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器；**外围留空**，不生成 TopBar / 角括号 / 数据面板）。生成器构建的一切都源自一份你从用户输入中抽取、并与用户确认过的 **Park Spec**——任何园区特定的内容都不会被硬编码。

中央场景**按所选风格构建**——赛博风格用 `grid.glsl` 着色器地面 + 自发光霓虹；真实物体/简约科技/夜间写实风格用 PBR 或扁平材质（见 `references/styles.md`）。所有风格都包含：按类别上色的楼栋、**每栋楼顶常驻的名称标签**、车库入口标记（半金字塔三角门 + P 牌）、屏幕图例，以及点击楼栋→聚焦→详情的交互。**v1.2 起还包含完整园区环境**——内部道路、地面车位（**v1.4 起为长方形车位 + 每位印 P + 约 30% 车辆示意停放**）、绿化景观（草地/行道树/中央广场）、周边市政道路、围墙与出入口、路灯（夜间写实风格下发光）；默认取景为一张能看全园区轮廓与紧邻环境的全景图（园区内容占画面 ~2/3，四周留白显示周边道路/绿化/围墙）。**v1.3 起新增 POI 兴趣点打点**（类型驱动图标/颜色 + 坐标/楼层归属 + 悬停/点击 tooltip），全部数据由后台 Park Spec 配置。**v1.4 起**：楼幢立面画**楼层虚线分隔 + 每层 1–5 间不同明度房间**（程序化装饰，确定性随机、不进 spec），并强制所有 CanvasTexture 标签（楼名/车库 P/车位 P/POI 图标）**高对比可读**（亮底深字 / 暗底亮字），杜绝「霓虹底 + 白字」看不清的问题。（如果你是在扩展 `d:\Vibe\社区` 仓库，请注意其当前场景已偏离成“夜间写实”风格，并且从未接入着色器——本技能产出的是符合所选风格规范的版本；参见 `references/exemplar.md`。）

## 何时使用

- 用户想 构建 / 生成 / 复刻 / 换肤 一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏，或数字孪生驾驶舱。
- 用户提供了园区的 **草图**、**效果图/rendering** 或 **`.pen`**，希望得到可运行的前端。
- 用户用文字描述了一个园区，希望得到 3D 大屏。
- 用户想 **修复/扩展** 一个已存在的园区驾驶舱（接入着色器、添加图例、按类别重上色、让数据由 spec 驱动）。

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
对任何你无法推断的内容用 `AskUserQuestion` 确认——标题、车库入口位置/朝向、位置/尺寸（**v1.3 起不再问车库车位数**）。**同时让用户选择视觉风格**（赛博 / 真实物体 / 简约科技 / 夜间写实，默认赛博），写入 `spec.style`。**v1.2 起追加一组「环境与氛围」问题**（地面车位 / 绿化密度 / 周边道路 / 氛围细节；智能默认 + 询问——用户不答就用默认，详见 `references/intake.md`），把答复写入 `spec.environment`。**v1.3 起追加一组「兴趣点 POI」问题**（要打哪些类型的点、名称、位置、tooltip 内容；不答则 `pois: []`），把答复写入 `spec.pois`。然后校验：
```bash
python scripts/validate_spec.py spec.json
```
生成前修掉每一个 `FAIL:`。展示一段摘要（标题、楼栋、车库入口、风格、**环境元素清单**、**POI 清单**），确认后继续。

### 4. 生成数据层
从 spec 生成 `src/data/<park>.ts`（楼栋、车库、楼层/单位详情）。从 `references/exemplar.md`（`parkModel.ts`、`unit.ts`、`buildings.ts`）拷贝数据形状。绝不硬编码园区内容——一切都来自 spec。

### 5. 生成 3D 场景
遵循 `references/scene-recipe.md`（赛博详细配方 + 所有风格共用的部分）和 `references/styles.md`（按 `spec.style` 分支渲染器/灯光/材质/地面）。赛博风格下不可妥协的内容：把 `assets/gridGround.glsl` 接为着色器地面；其它风格跳过这块，改用 PBR/扁平材质。所有风格都按类别给楼栋上色、**在每栋楼顶加常驻名称标签**（§4）；**v1.4 起楼栋立面必须画楼层虚线分隔 + 每层 1–5 间不同明度房间**（§4.1，程序化、确定性随机）；**所有 CanvasTexture 标签走高对比配对**（§4.2，亮底深字 / 暗底亮字）；**把地下车库渲染成半金字塔三角门入口 + P 牌**（§5，v1.3，不再有占用标牌）；添加 Legend 叠加层。**v1.2 起按 `references/scene-recipe.md §10` 生成园区环境**（内部道路 / 地面车位 / 绿化 / 周边市政道路 / 围墙 / 路灯），由 `spec.environment` 驱动，缺失时走智能默认——**v1.4 起地面车位为长方形车位 + 每位印 P + 约 30% 车辆示意停放**（`occupied` 控制放车数）；**v1.3 起按 §11 `buildPOIs` 生成兴趣点**（类型化标记 + tooltip/popup），由 `spec.pois` 驱动，缺省不生成；并按 §2 的 `frameCamera()`（默认 K=0.66）取景，确保默认就是一张看全园区与周边环境的全景图。

### 6. 生成舞台 + 楼栋切换器
遵循 `references/shell.md`——1920×1080 舞台（`useScaleBoard` 信箱式缩放）+ BuildingSwitcher + CenterStage/GlobalTwin/UnitDetail。**不再生成 TopBar、CornerBrackets 或任何外围数据面板；舞台左右两侧与底部留空**，由调用方自行填充。

### 7. 接入切换器 + 选中
从范例原样拷贝 `useSelection.ts`（见 `references/shell.md`）。切换器标签页和 3D 点击都通过它写入；当某栋楼被聚焦时 `CenterStage` 显示 `UnitDetail`。包含 地下车库 标签页。

### 8. 验证
`npm run dev`（端口 3000），并执行 `references/scene-recipe.md` 和 `references/shell.md` 中的检查清单。然后 `npm run typecheck`。截图并与用户确认布局与风格。

## Park Spec（速查）

完整 schema 见 `references/park-spec.md`。完整且通过校验的示例在 `evals/files/example-spec.json`；从 `.pen` 抽取的草稿在 `evals/files/sample-pen-extract.json`。坐标系：世界单位，Y 轴朝上，`floorHeight` 为 24，`boundary` 为 {x:360, z:220}。类别：`building`（青色，楼顶显示楼名）和 `garage`（薄荷绿，**v1.3 起渲染为半金字塔三角门入口 + P 牌，不再有占用数据**）——至多一个车库。**v1.2 新增可选字段 `environment`**（内部道路/地面车位/绿化/周边道路/氛围）；**v1.3 新增可选字段 `pois`**（兴趣点：类型+坐标+楼层归属+tooltip）；两者缺省即智能默认/不生成。

## 设计 token（唯一事实来源）

`assets/themes/<style>.tokens.json`（按 `spec.style` 选取，默认 `cyber`）存放该风格的配色、类别→颜色映射、着色器 uniform 默认值（仅赛博）和字体名。生成器从它派生**所有**颜色——SCSS 变量、`:root` CSS 变量、`theme.ts`、Three.js `Color` 实例和着色器 uniform。要给园区换肤，编辑 `spec.tokens` 覆盖（或改 `spec.style` 换整套模板）；绝不要在各文件里散落 hex 字面量。

## 风格（Styles）

4 种视觉模板，由 `spec.style` 选择，第 3 步用 `AskUserQuestion` 让用户挑：

- **`cyber`（默认）** —— 赛博：`grid.glsl` 着色器地面 + 自发光霓虹。
- **`realistic`** —— 真实物体：日间 PBR（玻璃/混凝土）+ 天空/太阳环境光 + 柔和阴影。
- **`minimal`** —— 简约科技：浅色扁平 + 单一主色描边，无阴影/着色器。
- **`night-realistic`** —— 夜间写实：PBR + 深蓝夜空 + 窗户自发光 + 路灯 + 微反射。

各风格的渲染器/灯光/材质/地面分支细则见 `references/styles.md`；配色见对应 `assets/themes/*.tokens.json`。

## 参考文件（按需阅读）

| 文件 | 何时阅读 |
|---|---|
| `references/intake.md` | 步骤 1–3：把任何输入模式转换为已确认的 Park Spec |
| `references/park-spec.md` | 编写/编辑 spec —— 规范 schema + 完整示例 |
| `references/styles.md` | 步骤 3/5：4 种风格的渲染器/灯光/材质/地面分支（含 v1.3 车库入口/地面车位/POI 材质） |
| `references/scene-recipe.md` | 步骤 5：赛博详细配方 + 所有风格共用部分（楼顶标签、车库入口、地面车位、POI、图例、交互、生命周期） |
| `references/shell.md` | 步骤 6/7：1920×1080 舞台 + 楼栋切换器 + 中央组件 + 选中 |
| `references/design-source.md` | 输入是 `.pen` —— 如何通过脚本 + pencil MCP 读取 |
| `references/exemplar.md` | 向 `d:\Vibe\社区` 仓库生成 —— 该拷贝什么 vs 该修什么 |

## 脚本（黑盒——先用 `--help` 运行，不要读进上下文）

- `scripts/extract_pen.py <file.pen> --out spec.json` —— `.pen` → Park Spec 草稿（token、grid uniform、楼栋头信息、图例、标题；v1.3 起不再抽车库占用数字）。Windows 上用 `--out`，不要用 `--stdout`。
- `scripts/validate_spec.py spec.json` —— schema 校验（含 `pois` 类型/坐标/楼层归属校验、`environment` 智能默认提示）；退出码 0 = 通过。

## 约定

- **Vue 3 `<script setup lang="ts">`**，Composition API，严格 TS。除非项目已存在，否则不用 router/pinia。
- **开发服务器端口 3000。** 脚本：`dev`、`build`（`vue-tsc --noEmit && vite build`）、`typecheck`。
- **字体：** Noto Sans SC（中文）+ Rajdhani（拉丁/数字），来自 Google Fonts。
- **固定 1920×1080 舞台**，通过 `useScaleBoard` 缩放适配（信箱式，非响应式）。
- **Mock 优先**的数据，带类型，为未来的 API 层留出干净的接缝。
- **图片 URL：** 每张 `<img>` 都配一个 `@error` 兜底；randomuser.me / loremflickr / picsum / unsplash 可用，pravatar.cc 被屏蔽。

## 验证（端到端）

- [ ] `python scripts/validate_spec.py` 对 spec 返回 `OK`（含 `style` 枚举校验）。
- [ ] 舞台 1920×1080 信箱式缩放到视口；**外围区域为空**（无 TopBar / 角括号 / 5 个数据面板）。
- [ ] `npm run dev`（端口 3000）：楼栋按类别上色且与图例色块一致；**每栋楼顶常驻显示名称标签**（v1.3）；**楼栋立面有楼层虚线分隔 + 每层 1–5 间不同明度房间，重复生成一致**（v1.4）；**所有标签（楼名/车库 P/车位 P/POI）高对比可读，远观不糊**（v1.4）；**地下车库为半金字塔三角门入口 + P 牌，无车位数/进度条**（v1.3）；**地面车位为长方形车位 + 每位印 P + 约 30% 车辆示意停放，无正方形框/区域 P 牌**（v1.4）。
- [ ] **赛博风格下**：着色器网格地面可见。**其它风格下**：按 `references/styles.md` 的材质/灯光构建（如真实物体有 PBR 反射与柔和阴影、夜间写实有窗户自发光），且未接入 grid。
- [ ] **POI（v1.3）**：标记按类型上色；悬停高亮、点击弹出 tooltip（含 `description` + `meta`）；点 POI 不误触楼栋聚焦；`pois` 缺省时不生成任何标记。
- [ ] 切换器包含所有标签页，含 地下车库；点击某楼层会金色高亮它并打开详情面板（UnitDetail）。
- [ ] **滚轮可缩放、右键可平移、左键可旋转**，松手后视角保持（聚焦补间是「事件触发 + 有限时长」tween，结束后不抢占 OrbitControls；详见 `references/scene-recipe.md` §9）。
- [ ] **默认取景是全景**：园区内容约占画面 2/3（K=0.66），四周能看到周边市政道路/绿化/围墙；滚轮可继续拉远到 zoom≈0.45。
- [ ] **园区环境完整**：场景里有内部道路、地面车位带、行道树与绿地、四向市政道路、围墙与主出入口、路灯（夜间写实风格下路灯发光，cyber 风格下地面发光标线可见）；环境元素不影响楼栋点击选中。
- [ ] `npm run typecheck` 干净通过。
