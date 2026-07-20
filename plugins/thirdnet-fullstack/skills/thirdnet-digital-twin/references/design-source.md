# 读取 Pencil `.pen` 设计源

当输入是 `.pen`（如本仓库的 `数字孪生.pen`）时，它是事实来源。用本参考从它精确地抽取一份 Park Spec。

## 两条路径

**路径 1 —— 抽取脚本（当 `.pen` 是普通 JSON 时首选）。**
```bash
python scripts/extract_pen.py <file.pen> --out spec.json
```
本仓库的 `.pen` 是 UTF-8 JSON，所以这条路径可行（见 `evals/files/sample-pen-extract.json`）。它把 token、grid uniform、楼栋头信息、车库占用、图例和标题拉进一份草稿，把 `id`/`w`/`d`/`x`/`z` 留为 null。Windows 上始终用 `--out` 并把文件读回来——绝不用 `--stdout`（中文标签在控制台会乱码）。

**路径 2 —— pencil MCP（当脚本说文件加密/二进制，或你需要几何时）。**
`.pen` 在某些环境下**在磁盘上是加密的**——绝不要直接 `Read` 或 `Grep` 它。用 **pencil MCP** 工具：
1. `get_editor_state(include_schema: true)` —— 确认活动文件、列出顶层帧 ID、并为其他每次调用加载你需要的 schema。
2. `get_variables` —— 设计 token 配色。
3. `batch_get({ nodeIds: [<frameId>], readDepth: 4, resolveVariables: true })` —— 节点树。
4. `get_screenshot({ nodeId: <sceneFrameId> })` —— 填 `w`/`d`/`x`/`z` 时目视位置。

## `.pen` 里有什么（本仓库的结构）

顶层：两个并列的 1920×1080 帧——**`C2 调整版`**（单楼栋详情）和 **`C2 全局视角`**（园区全局；带 3D 场景的那个）。你关心的是 `C2 全局视角`。

中央面板 **`园区全局数字孪生`** 有：
- **`Hdr`** → `Title`（“园区全局数字孪生”）+ `Legend`（楼幢 / 地下车库 —— 每个是一个色块 + 标签）。
- **`Scene`**（`layout: "none"`）—— 一幅**等轴矢量插图**，不是 3D 渲染。每栋楼是一组绝对定位的 path 图层：
  - `{name}-Right`、`{name}-Left` —— 两个可见的盒体面
  - `{name}-Roof` —— 顶面
  - `{name}-Floors` —— 横向楼层线
  - `{name}-Vert` —— 一条垂直边
  - `{name}-Sel` —— 琥珀色选中高亮
  - `{name}-Glow` —— 楼下的径向发光
  - 加上文字头标如 `H-主楼`（“主楼  10F · 12单位”）、每层标签（`F-10F`/`T-10F`）、以及 `▲ N` / `◢ ISO 3D` 标记。
- **`车库标牌`** —— 车库占用标牌：`T`（“地下车库 B1·B2”）、`Occ`（“空位 96 / 320”）+ `Bar`。
- 场景装饰：`Ground`、`GroundGrid`、`Roads`、`RoadCenter`、`Tree`/`Trunk` 对、`GreenPatch`、`BaseGlow`、`NetLinks`。

**关键认识：** `.pen` 的 Scene 是数字孪生的一幅*画面*。你的工作是把它作为真实 Three.js 场景复刻其内容（`references/scene-recipe.md`），而不是把 SVG 路径解析成 3D。用画面确认布局和颜色。

## 着色器填充（着色器如何附加）

**根帧 `C2 全局视角`** 有一个 `fill` 数组，包含：
- 一个 `mesh_gradient`（深海军蓝背景——`#031a3a`/`#0d5390` 系列），以及
- 一个 `shader` 填充：`{ type: "shader", url: "grid.glsl", uniforms: { u_cell: 46, u_gridColor: "#2a7fff", u_strength: 0.85 } }`。

这些 uniform 值是**赛博地面的默认值**——把它们拷进 `spec.shaders.grid`。

`.glsl` 文件用块注释里的 `@directive` 注解（`@resolution`、`@color`、`@default`、`@min`/`@max`、`@label`）声明 uniform——编辑器就是据此绑定它们的。打包的 `assets/grid.glsl` 是原样；`assets/gridGround.glsl` 是运行时消费的 Three.js 适配变体（基于 UV 的网格）。

## 抽取 `w`/`d`/`x`/`z` 的几何

抽取器无法从等轴路径拿到占地尺寸/位置。要填补它们：
1. 在 `readDepth: 4` 下 `batch_get` `Scene` 帧 —— 记下每个 `{name}-Right`/`-Roof` 节点的 `x`/`y`/`width`/`height`（这些在插图像素空间里）。
2. 用插图中楼栋的包围盒作为相对 `w`/`d` 的代理；把插图的延展映射到 spec 的世界 `boundary` 上来缩放。
3. 用 Scene 的 `get_screenshot` 确认 —— 生成的 3D 应大致坐在相同排布里。

这是有意为之的近似；用户从截图确认最终布局。

## UTF-8 抽取模式（来自仓库的 CLAUDE.md）

当自己写任何 `.pen` 抽取脚本时，把输出写进 UTF-8 文件并读回来，而不是打印到 Windows 控制台（控制台会把中文搞乱）：
```bash
python -c "import json,io; d=json.load(open('数字孪生.pen',encoding='utf-8')); \
io.open('out.txt','w',encoding='utf-8').write(json.dumps(d['variables'],ensure_ascii=False,indent=2))"
```
`scripts/extract_pen.py` 已遵循此模式（默认写 UTF-8；用 `--out`）。
