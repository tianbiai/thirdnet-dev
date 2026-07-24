---
name: thirdnet-digital-twin
description: >
  根据文字需求、手绘草图、效果图或 Pencil `.pen` 设计源，生成一个**园区数字孪生**（park digital-twin）3D 模块——
  固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器 + 点击选中/详情交互（外围留空）。产出 Vue 3 + TypeScript + Three.js
  场景：按类别上色的楼栋、每栋楼顶常驻名称标签、屏幕图例、完整园区环境（内部道路/地面车位/绿化/周边市政道路/路灯）、
  POI 兴趣点打点、地下车库多层剖面与楼栋间空中连廊；全部由一份用户确认的 Park Spec 驱动、绝不硬编码园区内容。
  支持 6 种视觉风格（赛博/全息/等距/深空星云/写实日景/写实夜景）。写实夜景发光窗走 Park 驾驶舱同款程序化流水线——
  逐层砖错位面板窗、分层点亮（底层 0%/中层/顶层）、暖冷双辉光、dirty-gated 开关灯翻转动画（reduced-motion 关闭）。
  数据分层：基础信息静态内联，动态数据（楼幢名/楼层数/楼层详情/POI 点位/**POI 业务详情**）走 `IDigitalTwinApi` 契约层
  （Mock/Real 工厂，`VITE_MOCK_ENABLED` 切换）。
  只要用户想 构建 / 生成 / 复刻 / 换肤 一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏、数字孪生驾驶舱、社区驾驶舱，
  或提供了园区/社区的草图/效果图/`.pen` 想得到可运行前端，**就必须使用本技能**（即使没明说「数字孪生」这些词）；
  同样适用于扩展/修复已存在驾驶舱——接入着色器、加图例、按类别重上色、切换风格、丰富环境、打 POI、把写死数据改走后端 API、
  增加地下场景/连廊等。
license: MIT
metadata:
  version: "2.16.0"
  author: park-cockpit
compatibility: Vue 3 + TypeScript + Vite + Three.js 项目；赛博风格消费 WebGL 片段着色器（`gridGround.glsl` 网格地面），全息/星云消费菲涅尔边缘辉光注入（`fresnelRim.glsl`）。动态数据契约层遵循 `api-typescript-spec`（`IDigitalTwinApi` + Real/Mock 工厂，`VITE_MOCK_ENABLED` 切换）。可在范例仓库、create-thirdnet-admin 项目或任何最小化的 Vite+Vue+Three 脚手架中运行。
---

# 园区数字孪生（Park Digital Twin）

根据园区需求，生成一个 **园区数字孪生** 3D 模块（固定 1920×1080 舞台内的中央 Three.js 场景 + 楼栋切换器；**外围留空**，不生成 TopBar / 角括号 / 数据面板）。生成器构建的一切都源自一份你从用户输入中抽取、并与用户确认过的 **Park Spec**——任何园区特定的内容都不会被硬编码。

> 本文件是**工作流入口 + 文件索引**。完整规范在 `references/` 各专题文件；完整范式代码在 `assets/`。版本演进见 `CHANGELOG.md`——生成器无需读它。冲突时以 `assets/park-scene.impl.ts` 代码为准。

## 何时使用

- 用户想 构建 / 生成 / 复刻 / 换肤 一个 园区数字孪生、智慧园区驾驶舱、园区 3D 大屏或数字孪生驾驶舱。
- 用户提供了园区的 **草图**、**效果图/rendering** 或 **`.pen`**，希望得到可运行的前端。
- 用户用文字描述了一个园区，希望得到 3D 大屏。
- 用户想 **修复/扩展** 一个已存在的园区驾驶舱（接入着色器、添加图例、按类别重上色、让数据由 spec 驱动、改走后端 API、加地下场景/连廊）。

## 何时不要使用

- 通用的 3D 游戏场景、建筑可视化或产品配置器（不是园区运营驾驶舱）。
- 没有 3D 数字孪生的 图表 / 数据可视化 / 分析仪表盘 → 使用 `dataviz` 技能。
- 非园区类运营中心（城市大脑、工厂车间），除非用户明确要求这种布局。

## 工作流

### 1. 对输入分类
判断用户处于哪种模式（文字+访谈 / 手绘草图 / 效果图 / `.pen` 设计源 / 建筑平面图），按 `references/intake.md` 对应路径执行。

### 2. 抽取 Park Spec 草稿
按 `references/park-spec.md`（schema 是唯一事实来源）产出草稿 `spec.json`。`.pen` 输入先跑抽取器 `python scripts/extract_pen.py <file.pen> --out spec.json`；草图/效果图用 `Read` 工具或 `zai` 的 `analyze_image` MCP 提取拓扑/配色，再通过提问补全数字。文字访谈模式下楼栋只有尺寸没有坐标时，先跑 `python scripts/layout_park.py spec.json` 自动排布。

### 3. 与用户确认 spec
对无法推断的内容用 `AskUserQuestion` 确认——标题、车库入口位置/朝向、位置/尺寸（**不再问车库车位数**——车库不显示占用）；同时让用户**选择视觉风格**（6 选 1，默认赛博），写入 `spec.style`；按需追加「环境与氛围」「兴趣点 POI」「航拍巡航」问题组（均智能默认，用户不答就走默认）。然后校验：
```bash
python scripts/validate_spec.py spec.json
```
生成前修掉每一个 `FAIL:`。展示摘要（标题、楼栋、车库入口、风格、环境元素、POI 清单），确认后继续。

### 4. 生成数据层
数据分两层（详见 `references/dynamic-data-api.md`）：**基础信息静态内联**，**动态数据 API 化**。两个数据产物都由脚本确定性生成：
```bash
python scripts/generate_data.py spec.json --out-dir <项目根>      # → src/data/<park>.ts + src/mock/data/manager/digital-twin.ts
python scripts/generate_theme.py <style> --out <项目根>/src/styles/tokens.css
```
- **静态脚手架** `src/data/<park>.ts`：占地几何（id/w/d/x/z/category/facing）+ 环境驱动 + style + legend。**不含** name/floors/POI。
- **动态数据契约层**（5 文件）：types/interfaces/modules/mock-api **逐字拷贝 `assets/api/` 模板**（仅对齐 import 路径）；Mock 数据文件由 `generate_data.py` 从 spec 派生。
- **主题 CSS 变量** `src/styles/tokens.css`：`main.ts` 顶部 import；per-park 的 `spec.tokens` 覆盖在 `GlobalTwin` onMounted 里 `applyCssVars()` 注入。

### 5. 生成 3D 场景
**先读 `references/park-scene-impl.md`，然后以 `assets/park-scene.impl.ts` 为基线「拷贝-改」产出 `src/scene/ParkScene.ts`**——同时拷贝 `assets/building-geometry.ts`（楼栋几何装配单一事实来源）、`assets/gridGround.glsl`（cyber 网格地面）、`assets/fresnelRim.glsl`（holographic/nebula 菲涅尔边缘辉光）。**不要从散文合成渲染管线**——范式实现已落地全部防黑屏项 + 写实增强层；只需替换脚手架数据源、按 `spec.style` 选 profile（**不要手改 PROFILES 表**），逐风格观感改 `assets/themes/<style>.tokens.json`。设计原理见 `references/scene-recipe.md`（§2 渲染器、§3 地面）与 `references/styles.md`。

### 6. 生成舞台 + 楼栋切换器
2D 层全部从 `assets/components/` 拷贝范式文件（清单见 `references/shell.md`）：`GlobalTwin/CenterStage/BuildingSwitcher/UnitDetail/GarageCard/LegendPanel/PoiOverlay/TourToggleButton/StyleSwitcher.vue`（9 个）+ `useSelection/useScaleBoard/useTwinData/useTour/useStyle.ts`（5 个）+ `theme.ts`。同时把 `assets/themes/*.tokens.json` 6 个文件拷到 `src/scene/themes/`。组件 CSS 全走 `var(--twin-*)`，零 hex 字面量；风格观感差异由 token `ui` 块驱动。**不生成 TopBar、角括号或任何外围数据面板；舞台左右与底部留空**。

### 7. 接入切换器 + 选中
选中接线已固化在拷贝的 `GlobalTwin.vue` + `useSelection.ts` 里——**不要临场改写**（铁律见 `references/scene-recipe.md §8`：楼层点击只调 `selectFloor`、相机聚焦走 `watch(focusedBuildingId)`、点空白 `clearFocus`）。

### 8. 验证
`npm run dev`（端口 3000），执行下方「验证」清单 + `references/scene-recipe.md`/`shell.md` 的检查清单。然后 `npm run typecheck`。截图与用户确认布局与风格。

## 数据分层（速查）

| 数据 | 归属 | 运行期来源 |
|---|---|---|
| 风格 / tokens / shaders / 字体 / 舞台 / boundary / floorHeight | 基础信息 | 静态内联 |
| 楼栋位置与占地（id/w/d/x/z/category/facing）+ 园区环境 + Legend | 基础信息 | 静态内联（`src/data/<park>.ts`） |
| 航拍巡航参数（cameraTour）+ 连廊（corridor）+ 地下车库坑体（garages） | 基础信息 | 静态内联（`ParkScaffold`） |
| 楼幢业务数据（name/floors/floor_ids/header）+ 楼层详情（含叙事档案块）+ POI 点位（含状态+占用）+ POI 业务详情 | **动态** | `IDigitalTwinApi`（`getBuildings`/`getFloorDetail`/`getPois`/`getPoiDetail`） |

加载序列「脚手架先行，再水合」：① 同步渲染静态脚手架（取景只用静态几何）→ ② `Promise.allSettled([getBuildings(), getPois()])`（POI 失败不连累楼栋）→ ③ 点击楼层 → `getFloorDetail({signal})` / 点击 POI → `getPoiDetail({signal})`（AbortSignal + onCleanup 防 race；POI 详情失败降级读列表 inline tooltip，不阻断）。详见 `references/dynamic-data-api.md §2`。

## Park Spec（速查）

完整 schema 见 `references/park-spec.md`，完整示例在 `evals/files/example-spec.json`。坐标系：世界单位，Y 轴朝上，`floorHeight`=40，`boundary`={x:360, z:220}。类别：`building`（青色，楼顶显示楼名）/ `garage`（薄荷绿，渲染为半金字塔三角门入口 + P 牌，可多栋多入口）/ 任意自定义串（factory/warehouse/residential/office…，按挤出楼栋渲染，配色取 `tokens.category.<cat>`）。POI `type` 同样开放（自定义类型以通用圆点渲染）。非办公园区可用 `spec.unitTemplate` 定制单位字段与租户池。

## 设计 token（唯一事实来源）

`assets/themes/<style>.tokens.json`（按 `spec.style` 选取，默认 `cyber`）存放配色、类别→颜色映射、着色器 uniform（仅赛博）和字体名。生成器从它派生**所有**颜色——CSS 变量、`theme.ts`、Three.js `Color` 实例和着色器 uniform。换肤改 `spec.tokens` 覆盖（或改 `spec.style` 换整套模板）；绝不在各文件里散落 hex 字面量。

## 风格（Styles）

6 种视觉模板，由 `spec.style` 选择（步骤 3 让用户挑）。逐风格渲染器/灯光/材质/地面分支见 `references/styles.md`；配色见对应 `assets/themes/*.tokens.json`。

| `spec.style` | 风格 | 着色器地面 | 写实引擎 |
|---|---|---|---|
| `cyber`（默认） | 赛博：霓虹青网格 + 自发光 | ✅ `gridGround.glsl` | ❌ |
| `holographic` | 全息：半透青玻璃体 + 边缘辉光 + bloom | ❌ | ❌ |
| `nebula` | 深空星云：紫蓝 + 星空月 + 虹彩辉光 + 强 bloom | ❌ | ❌ |
| `isometric` | 等距插画：flatShading cel 着色 | ❌ | ❌ |
| `realistic` | 写实日景：PBR + 环境贴图 + GTAO + 2048² 软阴影 + 真实窗户立面 | ❌ | ✅ |
| `night-realistic` | 写实夜景：日景 + **程序化分层发光窗**（逐层面板窗/暖冷双辉光/dirty-gated 开关灯动画）+ 湿润反射 + 雾 + 强 bloom + 暖色路灯 | ❌ | ✅ |

仅 `cyber` 消费 `gridGround.glsl`；写实两风格激活引擎内置的 envMap/GTAO/反射/软阴影/雾（`realism` token 旋钮块），其余 4 风格守纪律不启用。

## 参考文件（按需阅读）

| 文件 | 何时阅读 |
|---|---|
| `references/intake.md` | 步骤 1–3：把任何输入模式转换为已确认的 Park Spec |
| `references/park-spec.md` | 编写/编辑 spec —— 规范 schema + 完整示例 |
| `references/dynamic-data-api.md` | 步骤 4b：动态数据 API 契约层（`IDigitalTwinApi` + Real/Mock 工厂 + 宿主自适应 + 后端契约） |
| `references/styles.md` | 步骤 3/5：6 种风格的渲染器/灯光/材质/地面分支 |
| `references/scene-recipe.md` | 步骤 5：场景配方（渲染器/取景/楼栋/车库/POI/环境/交互/生命周期/巡航/地下） |
| `references/park-scene-impl.md` | 步骤 5：范式实现 `park-scene.impl.ts` 的使用说明与「不要做什么」 |
| `references/shell.md` | 步骤 6/7：1920×1080 舞台 + 组件拷贝清单 + 选中接线 + 响应式/a11y/空错态 |
| `references/design-source.md` | 输入是 `.pen` —— 如何通过脚本 + pencil MCP 读取 |

## 脚本（黑盒——先用 `--help` 运行，不要读进上下文）

- `extract_pen.py <file.pen> --out spec.json` —— `.pen` → Park Spec 草稿。仅对明文 JSON 的 `.pen` 生效；加密 `.pen` exit 3，改走 pencil MCP（见 `references/design-source.md`）。Windows 用 `--out`。
- `validate_spec.py spec.json` —— schema + 业务规则校验（楼栋出界/重叠/POI 越界 FAIL、cameraTour/underground 字段校验、token 结构校验、`spec.tokens` 覆盖白名单 WARN）。退出码 0=通过。可选 `pip install -r scripts/requirements.txt` 启用全量 token 校验。
- `generate_data.py spec.json --out-dir <项目根>` —— spec → `src/data/<park>.ts` 静态脚手架 + `src/mock/data/manager/digital-twin.ts` Mock 数据（确定性；`--scaffold-only`/`--mock-only` 可单独生成）。
- `generate_theme.py <style> --out <项目根>/src/styles/tokens.css` —— 主题 token → `:root` `--twin-*` CSS 变量（含 `ui` 块）。`--brand <hex>` 单品牌色按 HSL 派生整套强调色族。
- `layout_park.py spec.json [--in-place]` —— 楼栋自动行式布局（文字访谈模式下楼栋无坐标时用）。

## 约定

- **Vue 3 `<script setup lang="ts">`**，Composition API，严格 TS。除非项目已存在，否则不用 router/pinia。
- **开发服务器端口 3000。** 脚本：`dev`、`build`（`vue-tsc --noEmit && vite build`）、`typecheck`。
- **字体**：Noto Sans SC（中文）+ Rajdhani（拉丁/数字），来自 Google Fonts。
- **固定 1920×1080 舞台**，通过 `useScaleBoard` 信箱式缩放（非响应式）。
- **数据分层**：基础信息静态内联，动态数据走 `IDigitalTwinApi`（GET-only、snake_case、响应无 `{code,message,data}` 信封；`VITE_MOCK_ENABLED` 字符串 `"true"`/`"false"` 切 Mock/Real——**非** `VITE_USE_MOCK`）。
- **图片 URL**：每张 `<img>` 配 `@error` 兜底；图床遇 403/屏蔽换源即可。
- **性能纪律**：`setPixelRatio(Math.min(dpr, 2))`、SRGB、`PointLight ≤ 8`、InstancedMesh ≥10、resize 防抖 150ms。
- **Three.js 游离于 Vue 响应式之外**：场景实例用 `let` 而非 `ref`/`shallowRef`，否则 modelViewMatrix 代理错致黑屏。

## 验证（端到端）

80+ 条 checklist 按 spec 配置分基础 + 6 个条件子清单（POI/地下/写实/航拍/多风格/连廊），完整清单见 `references/scene-recipe.md` 末「验证」段与 `references/shell.md`。**基础必查项**：

- [ ] `validate_spec.py` 对 spec 返回 `OK`（含 `style` 枚举校验）。
- [ ] 舞台 1920×1080 信箱式缩放；外围为空（无 TopBar / 角括号 / 数据面板）。
- [ ] 楼栋按类别上色且与图例一致；每栋楼顶常驻名称标签；立面有楼层虚线分隔 + 贴砖（相邻两块深浅交替）。
- [ ] 所有标签（楼名/车库 P/车位 P/POI）高对比可读。
- [ ] 赛博风格下着色器网格地面可见；其它风格按 `styles.md` 材质构建且未接入 grid。
- [ ] 切换器含所有标签页；点击楼层金色高亮 + 打开 UnitDetail（含叙事档案块时显示「业务范围/介绍/职责/结尾语」）；悬停金边、点击锁定、点空白取消。
- [ ] 点击 POI 出详情卡（`getPoiDetail` 的 fields/live 表格；失败降级 inline tooltip）；快速切点不串显。
- [ ] 滚轮可缩放、右键平移、左键旋转，松手后视角保持；默认取景为全景（K=0.66，四周可见周边环境）。
- [ ] 园区环境完整（内部道路、地面车位带、行道树/绿地、四向市政道路、主出入口、路灯）。
- [ ] 动态数据契约层齐全（四方法含 `getPoiDetail`）；脚手架先行再水合；正式环境走真实 API（404 属预期）；三态兜底。
- [ ] night-realistic 程序化发光窗：分层点亮（底层 0/中层密/顶层稀）+ 暖冷双辉光 + 开关灯动画（reduced-motion 关闭）。
- [ ] 性能/健壮性/a11y/token 自洽（详见条件子清单）。
- [ ] `npm run typecheck` 干净通过。

版本演进与设计动机见 `CHANGELOG.md`。
