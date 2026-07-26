# 需求收集（Intake）—— 把用户输入转成 Park Spec

每一次任务都从对输入分类、把它转换成一份 **Park Spec 草稿**（`references/park-spec.md`）开始，然后与用户确认。四种输入模式需要不同的工具。在下文挑选匹配的章节。

无论哪种模式，需求收集的目标都一样：结束时拿到一份完整且通过校验的 spec（`python scripts/validate_spec.py <spec.json>` 返回 `OK`）。用 `AskUserQuestion` 来填补缺口而不是瞎猜——尤其位置和尺寸应由用户决定。

## 通用访谈问题（每种模式都要问）

这些字段无法从任何输入中推断，必须确认：
- **标题** —— 「{园区名}」（页面/文档标题）。
- **视觉风格** —— 赛博（默认）/ 写实日景 / 写实夜景，3 选 1（写入 `spec.style`；细则见 `references/styles.md`）。
- **位置/尺寸** —— 每栋楼的占地与坐标应由用户决定（你只能给默认排布）。地下车库只需确认入口位置与朝向（`facing`，默认朝南），**不再问车位数**（车库不显示占用）。

## 园区类型（通用化——不假设办公楼）

技能**不假设园区是办公楼**。办公园区是默认（缺省 8 行业租户池 + 8 办公字段），但工业/物流/住宅/商业等园区都能表达：

- **自定义楼栋类别**：`buildings[].category` 可给 `factory`/`warehouse`/`residential`/`office`/`amenity` 等任意串。非 `garage` 类别都按挤出楼栋渲染（`floors` 必填）；用 `spec.tokens` 的 `category.<cat>` 或 `legend.color` 单独定色，图例自成一类。`garage` 可有多栋（多入口）。
- **自定义 POI 类型**：`pois[].type` 可给 `loading-dock`/`crane`/`ev-charger` 等任意串；未知类型以通用圆点标记渲染，名称走 `label`/`tooltip`。
- **自定义单位字段/租户池**（`spec.unitTemplate`）：非办公园区楼层单位详情可改由 `unitTemplate.fields` 描述（如 产线/产能/住户/户型），租户池可改由 `unitTemplate.tenants` 提供。详见 `references/park-spec.md`「楼层单位模板」。

> 抽取 spec 草稿时若判断**不是办公园区**（出现「厂房/仓库/住宅/产线/产能」等词），主动询问：楼栋有哪些类别？要打哪些类型的 POI？楼层单位该展示哪些字段、租户/实体是什么？把答复写进对应的 `category`/`type`/`unitTemplate`。

### 调色指引

| 园区类型 | category | 推荐 `spec.tokens.category` 覆盖 | 备注 |
|---|---|---|---|
| 办公园区 | `building`（默认 cyan `#27a8ff`） | 不必覆盖 | 缺省走 cyber 主题 |
| 工业园区 | `factory`/`warehouse`/`office` | `category: { factory: "#5b8def", warehouse: "#f0a040", office: "" }` | 参考 `evals/files/generality/industrial.json` |
| 政务/事业单位园区 | `building` 或自定义 `government` | `category: { government: "#c8102e" }`（中国红），或保留 cyan 走现代政务风 | 综治中心/党群服务中心见 `government-complex.json` |
| 商业/医院/学校 | 自定义 | 用户自由 | 可在 spec.tokens 覆盖任何路径 |

**注入位置**：`spec.tokens` 顶层覆盖（详见 `park-spec.md`「设计 token」+ `SKILL.md`「Park Spec 速查」）。**不要**改 `assets/themes/*.tokens.json`——后者是固化的主题事实来源。

## 环境与氛围（智能默认 + 询问）

场景生成园区内部道路、地面车位、绿化、周边市政道路、路灯等环境元素（见 `references/scene-recipe.md §10`）。**这组问题不是必答**：用户不答就用智能默认产出一张完整全景；但主动询问能更贴近真实园区。用 `AskUserQuestion` 分批问（每次 ≤4 个）：

- **地面车位** —— 园区有没有地面车位？大概多少个？（默认：按楼栋规模推算）。写入 `spec.environment.surfaceParking = { stalls }`；可选问「大概停了几成车？」写入 `occupied`（不问默认 ~30%）。
- **绿化密度** —— 稀疏 / 普通 / 茫密？要中央广场吗？有水景吗？（默认：普通 + 中央广场、无水景）。写入 `spec.environment.greenery`。
- **周边道路** —— 园区四面是否临市政道路？有主出入口闸机吗？（默认：四面临路 + 主闸机）。写入 `spec.environment.surrounding`。
- **氛围细节** —— 要路灯吗？地面发光标线开吗（仅赛博）？周边要放车辆/行人吗？（默认：开路灯；发光标线仅赛博；放车辆）。写入 `spec.environment.ambiance`。

只要用户答了任一项，就把整组写进 `spec.environment`；完全没提时**省略 `environment` 字段**（走智能默认），不要塞空对象。

## 兴趣点 POI（智能默认 + 询问）

数字孪生驾驶舱通常要在地图上打点标注关键设施：出入口、监控、闸机/道闸、服务点、地标等。每个 POI 由**类型（驱动图标+颜色）+ 坐标 + 可选提示数据**描述，写入 `spec.pois`。**不是必答**：用户不答就 `pois: []`（不生成 POI）。用 `AskUserQuestion` 分批问：
- **要打哪些点？** —— 列出类型（entrance/exit/camera/gate/service/landmark/parking/custom）。
- **每个点的位置与名称** —— 名称（`label`）；位置可由用户在草图上指认，或直接给世界坐标 `{x, z}`。室内点位可绑 `buildingId` + `floorIndex`。
- **提示卡内容（可选）** —— `tooltip.description`（简述）和 `tooltip.meta`（键值对）；政务/功能房间推荐用 `roomSpec`（结构化字段 area/capacity/dept/duty）。

只要用户给了任何一个 POI，就写进 `spec.pois`；完全没提则省略 `pois` 字段。

## 楼层单位（后台可配置）

楼层 → 单位映射（`floors_detail`）是 spec 驱动、后台可配置的——每层 `units` 数组承载一个或多个单位。如果用户给了「某层有哪些单位」的清单，务必写进 `floors_detail`，而不要只在 `header` 里写「N单位」。非办公园区单位字段与租户池可由 `spec.unitTemplate` 覆盖。

## 模式 A —— 文字需求 + 访谈

用户用散文或清单描述园区（"3 栋楼：研发楼 12 层、办公楼 6 层、会展中心 3 层，地下车库在南侧"）。

1. 把显式事实解析进 spec 草稿：楼栋（名称、楼层）、关键单位、车库入口位置/朝向。
2. 给 `w`/`d`/`x`/`z` 填默认排布（或先跑 `scripts/layout_park.py`），然后与用户**确认布局**。
3. 用 `AskUserQuestion` 问上面的通用问题及任何缺失项。
4. 写出 spec JSON，运行 `validate_spec.py`，给用户展示精简摘要，确认后继续。

楼层+单位推导出的默认头标文字：`"{floors}F · {units}单位"`（单位可选）。

## 模式 B —— 手绘草图

用户上传一张手绘布局的照片/扫描件。

1. **用 `Read` 工具读取图像**（它会渲染图像），或用 `zai` 的 `analyze_image` MCP 做结构化提取。抽取：楼栋数量与相对位置、相对高度（哪栋塔楼最高）→ 排序后通过提问分配 `floors`、任何手写文字（楼名、入口箭头、P）、道路/绿化/入口。
2. 草图给你的是**拓扑**，不是数字——所以要问：每栋楼的层数、标题、主题。
3. 把草图位置映射到世界坐标：按比例在 `boundary` 内放置楼栋；最高那栋大致居中。生成后用截图确认。
4. 写出 + 校验 spec。

## 模式 C —— 效果图 / rendering

用户上传一张目标效果图或驾驶舱截图。

1. **读取图像**并抽取：配色/风格（先判断最接近 3 种风格里的哪一种，定 `spec.style`；再用 `spec.tokens` 做细微覆盖匹配效果图配色）、相机角度、楼栋风格（玻璃幕墙/边缘发光/天线/屋顶类型）、屏幕界面元素（图例/POI 标记）、任何可读文字。
2. 决策：忠实换肤（选定 `spec.style` + 编辑 `tokens`）vs 保持风格默认但采用效果图的布局。与用户确认。
3. 像模式 B 一样提取拓扑，然后问数字。
4. 写出 + 校验 spec。

## 模式 D —— Pencil `.pen` 设计源

最精确的模式。`.pen` 是事实来源。

1. **运行抽取器**（黑盒）：`python scripts/extract_pen.py <file.pen> --out spec.json`。它把 token、grid uniform、楼栋头信息、图例和标题拉进草稿，把 `id`/`w`/`d`/`x`/`z` 留为 null。若脚本报告 `.pen` 不是 UTF-8 JSON（加密/二进制，exit 3），改用 **pencil MCP**：`get_editor_state` → 对 Scene 帧 `batch_get`（见 `references/design-source.md`）。
2. **填补 null 值**：读取 Scene 布局（pencil `batch_get`，readDepth 4），用部件位置/尺寸在 spec 世界单位里估算 `w`/`d`/`x`/`z`。用截图确认。
3. **分配类别**：为地下车库添加 `garage` 类别的楼栋并设 `facing`；其余每栋楼都是 `building`。
4. 写出 + 校验 spec。

## 模式 E —— 建筑施工平面图（CAD/扫描件）

用户给一张**建筑制图**——通常是首层平面图，标注清晰划出楼体范围、内部房间、出入口、地面车位区。常见于政府/医院/学校/产业园区综合体的前期需求。

**与模式 B/C/D 的关键区别**：草图=自由勾画拓扑不带精确尺寸；平面图=带轴网 + 尺寸标注 + 房间墙线 + 标题栏的 CAD 投影。效果图=3D 渲染要"换肤"；平面图=2D 技术图要"翻译成 3D"。`.pen`=等距矢量插图含 token；平面图=静态图无 token。

**步骤**：
1. **用 `Read` 工具读取图像**或 `zai` 的 `analyze_image` MCP 做结构化抽取。识别：楼体外轮廓（黑色粗实线闭合多边形）、内部房间标注（含房间名 + 面积 + 容纳人数）、地面车位区（虚线框 + 数字）、出入口（门符号 + 箭头）、楼栋高度标注（如「5层」「11层」——建筑总层数，不是平面所在层）、轴网、标题栏。
2. **判读建筑总层数**：平面图通常是首层投影；「5层」/「11层」标注 = 楼体**总层数** → `BuildingSpec.floors`。由此推论：**所有 POI 都在 1F**（除非明确标了「二层平面」），全部 `floorIndex: 0`。
3. **坐标映射**——把制图轴网 → 世界 `boundary` 单位。**优先问用户实际尺寸**（「这张平面图的总长 × 总宽是多少米？」），轴网只是相对位置。
4. **建模建议**：2 栋 `connects` 楼（塔+裙，综治中心/医院常见）、1 块 `surfaceParking`（单 stalls=总车位数）、N 个 POI（功能房间，type 用 `service` 或 `custom`，标 `buildingId` + `floorIndex: 0` + 推荐 `roomSpec`）。
5. **不要走 `extract_pen.py`**——平面图不是 `.pen` 矢量插图，跑脚本只会失败。
6. 写出 + 校验 spec。**首屏用 cyber 默认 + previewStyles 列 3 风格**——让用户能实时切风格看效果。

**完整范式**：见 `evals/files/generality/government-complex.json`（11F 主楼 + 5F 裙楼 + 6 个功能房间 POI + 246 地面车位 + previewStyles 3 风格）。

## 需求收集之后（所有模式）

- `python scripts/validate_spec.py <spec.json>` —— 修掉每一个 `FAIL:`。
- 给用户展示摘要（标题、按类别计的楼栋、车库入口、主题、环境元素清单、POI 清单、切换器标签页列表）。确认后进入生成；如果要改某项，编辑 spec（不要改生成器）。
