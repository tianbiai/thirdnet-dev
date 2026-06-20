# 合并协议（`merge-protocol.md`）

`thirdnet-template-upgrade` 技能里"Claude 充当合并器"的权威规范。本文件镜像前端 `frontend/create-thirdnet-admin/scripts/merge-workdir.js` 的 `buildPrompt()` / `resolveOutput()`，以及后端 `backend/Template/ThirdNet.Migrate/Services/WorkDirWriter.cs` / `WorkDirReader.cs` / `RoleClassifier.cs` 的行为——以源码为最终事实源。

## 工作目录布局

`export-merge` 产出，`import-merge` 消费。**前后端格式完全一致**（故一个 `merge-workdir` 脚本通吃）：

```
<workdir>/                         # 默认 ./.thirdnet-merge-work
├── manifest.json                  # 顶层元数据（import 离线所需全部上下文）
├── reference/                     # 新模板 reference 快照（import 据此重算哈希清单）
└── units/
    <unitId>/                      # unitId = sha256(relativePath)[..16]，确定性、导出幂等
        ├── meta.json              # 该文件的合并上下文
        ├── base                   # 旧模板（共同祖先）；2-way 模式缺省
        ├── mine                   # 用户当前版本
        ├── theirs                 # 新模板版本
        ├── merged                 # AI 产出；存在 = 已解决
        └── declined               # （空文件）AI 主动放弃
```

- **内容寻址 unitId**：`sha256(相对路径)[..16]`。子目录 / 同名文件靠它区分，`relativePath` 只存在 `meta.json`。
- **幂等导出**：重跑 `export-merge` 会清理"不再冲突"的旧 unit（防陈旧 merged 误落盘），但**保留仍冲突 unit 里已有的 `merged`/`declined`**（断点续做）。

### `manifest.json` 字段

| 字段 | 说明 |
|---|---|
| `tool` | `thirdnet-migrate` / `create-thirdnet-admin` |
| `mode` | `3-way` 或 `2-way`（整体倾向，取决于基线是否可得） |
| `templateIdentity` / `targetTemplateVersion` | 模板标识与目标版本 |
| `prefix` / `sourceName` / `symbols` | 命名空间替换上下文（后端 import 重算清单需要） |
| `projectPath` | 项目绝对路径 |
| `unitCount` / `exportedAt` | unit 数量与导出时间 |

### `meta.json` 字段（每个 unit）

| 字段 | 说明 |
|---|---|
| `relativePath` | 文件相对项目根的路径 |
| `role` | 语义角色：`config` / `framework` / `unknown`（后端 RoleClassifier）；前端另有 `brand` |
| `mode` | `3-way`（有 base）/ `2-way`（无 base，更保守） |
| `mineHash` / `baseHash` / `theirsHash` | 三份内容哈希；`mineHash` 供 import 陈旧检查 |
| `isBinary` | 二进制 → 合并器放弃 |
| `upstreamDiff` | base→theirs 的 unified diff（参考用） |
| `recommendation` | `trust-template` / `trust-user` / `merge`（来自 RecommendationEngine） |

---

## 角色分类规则

后端 `RoleClassifier.Classify(relPath)`（前端 `brand` 由 override 清单判定）：

- **`config`**：文件名为 `appsettings*`、`*.csproj`、`*.props`、`*.targets`、`web.config`、`launchSettings.json`、`.npmrc`
- **`framework`**：`Program.cs`、`Startup.cs`、`_GlobalVibeUsings.cs`、`*DbContext.cs`；或路径含 `/Authentication/` `/Authorization/` `/Middlewares/` `/Middleware/` `/Filters/` `/Extensions/` `/HealthManager`
- **`unknown`**：以上都不命中（业务代码多落此，但业务代码通常根本不在 Conflict 集）
- **`brand`**（前端）：品牌 override 文件（package.json / brand.ts / index.html 等）；默认 export 跳过，`--include-override` 才纳入

## 信任矩阵（按 `meta.role` 给倾向，非硬规则——仍读全文判断）

| role | 倾向 | 含义 |
|---|---|---|
| `framework` / `infra` / `config` | 信 **THEIRS** | 吸收模板的 bugfix 与结构调整 |
| `business` | 信 **MINE** | 保留用户的业务逻辑、自定义、注释 |
| `brand` | **DECLINED** | 不合并，交回人工 |
| `unknown` | 当 `business`（保守） | 优先保留用户改动 |

## 产出纪律（写 `merged` 时）

- **只输出合并后的完整文件内容**。不要任何解释、前言、代码围栏（```）、"以下是合并结果"之类。
- 保留原文件缩进、换行风格、编码。
- 只做必要的调和；不要重排或重格式化无关代码。
- 这是镜像 `merge-workdir.js` 的 system prompt 铁律——目的是让 `merged` 文件可直接落盘，无需任何后处理。

## DECLINED 纪律（写空 `declined` 而非 `merged`）

判定放弃（交回人工）的情形：

- `mine` 与 `theirs` 在**同一处**做了真正冲突的编辑，且没有 >90% 把握 → DECLINED
- `meta.mode === "2-way"`（无 BASE 共同祖先）→ 更保守，任何拿不准的块都 DECLINED
- `meta.isBinary === true` → DECLINED（二进制不能按文本合并）
- `meta.role === "brand"` → DECLINED（品牌文件）
- headless 脚本额外情形：`stop_reason === 'max_tokens'`（输出可能截断）→ DECLINED；API 调用报错 → DECLINED

放弃 = 在 unit 目录写一个**空 `declined` 文件**（不写 `merged`）。`import-merge` 据此报"未决"，文件保持原样、版本不推进。

> 解析细节（headless 脚本 `resolveOutput`）：整份输出被成对 \`\`\` 围栏包裹时解包当 `merged`；输出（trim 后）恰为单词 `DECLINED` 时算放弃。

## 2-way 何时降级

3-way 需要旧模板基线。基线不可得时该 unit 标 `2-way`：
- 后端：未提供 `--base-nupkg`（或基线 nupkg 内无该文件）
- 前端：约定位置找不到旧版 tgz

2-way 无共同祖先，合并器更保守——拿不准的块一律 DECLINED。

## `import-merge` 安全语义（落盘，AI 不参与）

1. **覆盖前必备份**：写入 `.thirdnet-backup/<时间戳>/`（与 `apply` 一致）。
2. **陈旧保护**：导入时重算磁盘文件哈希，与 `meta.mineHash` 比；不一致（导出后文件又被改）→ 报 `stale`、**不覆盖、不推进版本**。
3. **永不删文件**；**永不碰业务代码**（`UserOnly` 不进工作目录）。
4. **版本仅 `applied > 0` 时推进**（与 `apply` 一致）。
5. **后端清单语义**：用 `reference/` 快照重算哈希清单，记录**模板哈希**；合并后的磁盘文件 ≠ 模板 → 下次 `diff` 归 `UserOnly`，不再反复提示（符合预期）。
6. **前端**：无逐文件哈希清单，import 仅推进 `.template-version.json`（保留 tokens / overrideFiles）。

## `merge-workdir` headless 脚本（备选）

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # 绝不作 CLI 参数，避免落入 shell history
npx create-thirdnet-admin@latest merge-workdir ./.tw [--model claude-sonnet-4-6] [--max-tokens 8192] [--dry-run]
```

- 逐 unit 调一次 Claude（`thinking: disabled`，纯文件输出，不要推理链）
- 跳过：已有 `merged`/`declined`、`isBinary`、`role=brand`（后两者直接写 `declined`，不调 API）
- 退出码：`0` 全部已决；`2` 有放弃/未决（CI 据此失败）；`1` 致命错误（无 SDK / 无 key / workdir 无效）
- 依赖 `@anthropic-ai/sdk`（懒加载；核心 scaffold/update 流程不依赖它）

## 失败模式速查

- **AI 放弃（declined）**：二进制、品牌文件、`max_tokens` 截断、同线冲突无把握、调用报错 → 写空 `declined`，import 报未决（退出 2），文件保持原样
- **部分合并**：只合并了部分文件 → 版本仍推进（`applied>0`），其余未决；可再次 `export-merge`（已解决文件自动移出冲突集）
- **2-way 降级**：基线不可得 → 该 unit 标 `2-way`，合并器更保守

## 权威实现位置

- 后端导出/导入：`backend/Template/ThirdNet.Migrate/Services/WorkDirWriter.cs`、`WorkDirReader.cs`
- 后端共用辅助：`Services/ApplyHelpers.cs`（备份/复制/版本/清单，apply 与 import 共用）
- 后端分类/检测：`Services/RoleClassifier.cs`、`BinaryDetector.cs`、`RecommendationEngine.cs`
- 后端命令：`Commands/ExportMergeCommand.cs`、`ImportMergeCommand.cs`
- 前端工作目录：`frontend/create-thirdnet-admin/lib/update/workdir.js`
- 前端合并脚本（提示词权威）：`frontend/create-thirdnet-admin/scripts/merge-workdir.js`
- 设计原文：`docs/ai-template-merge.md`
