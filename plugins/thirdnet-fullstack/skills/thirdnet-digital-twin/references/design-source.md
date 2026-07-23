# 读取 Pencil `.pen` 设计源

当输入是一份 Pencil `.pen` 设计源时，它是事实来源。用本参考从它精确地抽取一份 Park Spec。

> **本文给出的图层名、占用数字、uniform 值都是某一具体 `.pen` 的示例**——你的 `.pen` 的帧/图层命名很可能不同。请按本文的「抽取思路」对号入座，而不是按具体名字。随包发布的 `evals/files/sample-pen-extract.json` 是一份**已抽好的草稿样例**，可对照查看输出形状。

## 两条路径

**路径 1 —— 抽取脚本（当 `.pen` 是普通 JSON 时首选）。**
```bash
python scripts/extract_pen.py <file.pen> --out spec.json
```
若 `.pen` 在磁盘上是 UTF-8 JSON（文本），这条路径可行。脚本把 token、grid uniform、楼栋头信息（楼名/楼层数/单位数）、图例类别、标题拉进一份草稿，把 `id`/`w`/`d`/`x`/`z` 留为 null（等轴矢量插图取不到占地几何，需后续填）。**v1.3 起脚本不再抽取车库占用数字**——车库占用走 `garages[]`（v2.6，含 `capacity`/`occupied`）或停车场 POI 的 `occupancy`（动态数据）。Windows 上始终用 `--out` 并把文件读回来——绝不用 `--stdout`（中文标签在控制台会乱码）。脚本退出码 3 表示「文件加密/二进制」，此时改走路径 2。

**路径 2 —— pencil MCP（当脚本说文件加密/二进制，或你需要几何时）。**
`.pen` 在某些环境下**在磁盘上是加密的**——绝不要直接 `Read` 或 `Grep` 它。用 **pencil MCP** 工具：
1. `get_editor_state(include_schema: true)` —— 确认活动文件、列出顶层帧 ID、并为其他每次调用加载你需要的 schema。
2. `get_variables` —— 设计 token 配色。
3. `batch_get({ nodeIds: [<frameId>], readDepth: 4, resolveVariables: true })` —— 节点树。
4. `get_screenshot({ nodeId: <sceneFrameId> })` —— 填 `w`/`d`/`x`/`z` 时目视位置。

## `.pen` 里通常有什么（示例结构）

一份园区全局 `.pen` 顶层通常是一个 1920×1080 帧（可能带一个并列的单楼栋详情帧——你关心的是含 3D/等轴场景的那个**全局帧**）。全局帧里常见的角色划分：

- **标题/图例头**：标题文字 + 图例（每个类别一个色块 + 标签，例如「楼幢 / 地下车库」）。
- **等轴插图帧**（`layout: "none"`）——一幅**等轴矢量插图**，不是 3D 渲染。每栋楼常被拆成一组绝对定位的 path 图层：两个可见盒体面、顶面、横向楼层线、一条垂直边、选中高亮、楼下径向发光等；并配文字头标（楼名 +「NF · M单位」）、每层标签、方位/等距标记。脚本用正则从这类头标里抽 `楼名`/`楼层数`/`单位数`。
- **标牌图层**：如车库标牌（标题 + 占用数字 + 进度条）——**v1.3 起脚本不再抽占用数字**（见上）。
- **场景装饰图层**：地面、地面网格、道路、路中线、树/树干、绿地、底光、连线等。

**关键认识：** `.pen` 的场景是数字孪生的一幅*画面*。你的工作是把它作为真实 Three.js 场景**复刻其内容**（按 `references/scene-recipe.md` / 以 `assets/park-scene.impl.ts` 为基线），而不是把 SVG 路径解析成 3D。用画面确认布局和颜色。

## 着色器填充（着色器如何附加）

全局帧的 `fill` 数组里可能含一个 `shader` 填充，形如：
```jsonc
{ "type": "shader", "url": "<某 glsl>", "uniforms": { "u_cell": <数>, "u_gridColor": "<hex>", "u_strength": <数> } }
```
这些 uniform 值是该设计的**赛博地面参数**——把它们拷进 `spec.shaders.grid`。运行时消费的是 `assets/gridGround.glsl`（基于 UV 的 Three.js 网格地面着色器），与 `.pen` 内嵌引用的源 glsl **不是同一份文件**——别去找 `.pen` 里 `url` 指向的那个 glsl。

`.glsl` 文件用块注释里的 `@directive` 注解（`@resolution`、`@color`、`@default`、`@min`/`@max`、`@label`）声明 uniform——编辑器就是据此绑定它们的。

## 抽取 `w`/`d`/`x`/`z` 的几何

抽取器无法从等轴路径拿到占地尺寸/位置（留为 null）。要填补它们：
1. 在 `readDepth: 4` 下 `batch_get` 场景帧 —— 记下每栋楼各盒体面/顶面节点的 `x`/`y`/`width`/`height`（这些在插图像素空间里）。
2. 用插图中楼栋的包围盒作为相对 `w`/`d` 的代理；把插图的延展映射到 spec 的世界 `boundary` 上来缩放。
3. 用场景帧的 `get_screenshot` 确认 —— 生成的 3D 应大致坐在相同排布里。

这是有意为之的近似；用户从截图确认最终布局；也可直接在步骤 3 用 `scripts/layout_park.py` 自动排布，或手填后跑 `scripts/validate_spec.py` 复核（楼栋出界/重叠/POI 越界会 FAIL）。

## UTF-8 抽取模式

当自己写任何 `.pen` 抽取脚本时，把输出写进 UTF-8 文件并读回来，而不是打印到 Windows 控制台（控制台会把中文搞乱）：
```bash
python -c "import json,io; d=json.load(open('your.pen',encoding='utf-8')); \
io.open('out.txt','w',encoding='utf-8').write(json.dumps(d['variables'],ensure_ascii=False,indent=2))"
```
`scripts/extract_pen.py` 已遵循此模式（默认写 UTF-8；用 `--out`）。
