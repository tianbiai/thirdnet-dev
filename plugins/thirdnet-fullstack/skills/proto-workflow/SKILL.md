---
name: proto-workflow
description: >
  项目迭代「原型驱动发布流程」的编排器：执行 SVN 原型分支创建、整体合并回主干、用毕分支删除，
  生成原型 / 测试 / 正式三套环境的 Jenkins 构建参数与发布检查清单，在编码环节委托
  frontend-workflow / backend-workflow / api-typescript-spec。遵循《代码发布管理-原型驱动流程》的
  主干开发 + {revision} 同级目录分支约定（Park / Park-PT{r} / Park-BF{r}）。当任务涉及「拉原型分支 /
  新建迭代原型 / 基于主干拉分支做原型 / 原型做好了合并回主干 / 发布原型服务器 / 发布测试服务器 /
  迭代发布到正式 / 对照原型测试验收 / 线上 bug 走分支」等场景时必须使用，即使任务看起来简单也需遵循，
  以保证分支命名、合并纪律、三环境构建参数一致、不污染主干历史。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---
# 原型驱动迭代编排工作流

本技能是 SmartPark 仓库「原型展示」与「实际开发」双用途的 SVN 迭代编排器，驱动一个迭代版本从原型到发布的全流程。事实来源为《代码发布管理-原型驱动流程.md》（v1.0），其已逐条对齐既有《代码发布管理.docx》约定。

> **两个不可偏离的设计决策**
> 1. **执行式**：本技能**实际执行** svn 命令（`svn copy` 建分支、`svn merge` 合并、`svn delete` 删分支、`svn commit` 提交）。每个不可逆操作前必有**确认门**（见「确认门清单」）。Jenkins/Octopus 发布仍由人触发，技能只生成构建参数清单。
> 2. **纯编排**：本技能只管迭代编排（分支 / 合并 / 发布清单 / 确认门 / 状态检查）。编码环节一律**委托**既有技能，本技能不重复其规则。

## 相关技能

编码环节委托以下技能，本技能本身不写业务代码：

| 场景 | 相关技能 | 说明 |
|------|---------|------|
| 原型阶段前端编码（契约 + Mock + 页面） | `thirdnet-fullstack:frontend-workflow` + `thirdnet-fullstack:api-typescript-spec` | 前端先行定义 `IXxxApi` 契约 + `MockXxxApi` + 页面，`VITE_MOCK_ENABLED=true`，不依赖真实后端 |
| 真实实现阶段后端编码 | `thirdnet-fullstack:backend-workflow` + `thirdnet-fullstack:api-typescript-spec` | 按已冻结契约补 `RealXxxApi` + .NET（Controller / Service / DTO / EF） |
| Mock 剥离（测试/正式构建） | [mock-stripping.md](../api-typescript-spec/references/mock-stripping.md) | `VITE_MOCK_ENABLED=false` 时 tree-shake 掉 Mock 的机制 |
| 功能完成全栈审查 | `thirdnet-fullstack:fullstack-review` | 真实实现完成后收尾审查 |
| 全栈协调（前后端类型映射、RBAC） | `thirdnet-fullstack` | 跨端协同入口 |

## 边界 / 不做

- **不替代编码技能**：前端契约 / Mock、后端 Real 实现交给上表技能。
- **不触发 Jenkins / Octopus**：只生成构建参数清单（分支、`VITE_MOCK_ENABLED`、环境、release 备注），由人在 Jenkins / Octopus 执行。
- **不自动解决业务代码冲突**：`svn merge` 后检测冲突标记，有冲突则暂停、提示人工解决。
- **不处理微信小程序审核排期**：仅在发布清单中提醒「小程序多一道审核，周期错开」。
- **不自动处理 DB schema 中断性变更**：提示联系运维还原测试库。

## 工作流步骤概览

所有迭代任务按以下顺序执行（5 阶段 + 起点，与源文档 §4 一一对应）：

1. **阶段 0 ｜ 主干状态检查**（AskUserQuestion 确认 SVN 路径参数）—— 取主干最新 revision `r_base`，检查工作副本干净
2. **阶段 1 ｜ 原型设计（前端先行）** —— 确认门 A 建原型分支 → 委托 `frontend-workflow`+`api-typescript-spec` 编码 → 生成原型发布清单 → 确认门 B 冻结
3. **阶段 2 ｜ 合并回主干** —— 合并预检 → 确认门 C → `svn merge` → 冲突检测（预警工厂文件）→ 提交
4. **阶段 3 ｜ 真实实现（开发）** —— 委托 `backend-workflow`+`api-typescript-spec` 在主干补 Real + 后端 → 生成测试发布清单
5. **阶段 4 ｜ 测试** —— 生成对照验收清单 → Bug 分流（当前迭代小 bug 主干直修 / 已发布正式版 bug 走 BF）
6. **阶段 5 ｜ 发布与收尾** —— 生成正式发布清单 → 确认门 D 删原型分支 → 迭代 N+1 回到阶段 0

> **说明**：`AskUserQuestion` 指 Claude Code Agent 内置的用户交互能力。在本技能中用于两类场景——阶段 0 的路径参数确认，以及四个不可逆操作前的确认门。

## 环境模型

源自源文档 §2。在既有 测试 / 预发布 / 正式 三套环境之上**新增原型服务器**：

| 环境 | 来源分支 | 前端构建参数 | 后端状态 | 用途 |
|---|---|---|---|---|
| **原型服务器** | 原型分支 `Park-PT{r}` | `VITE_MOCK_ENABLED=true` | 不强依赖（可缺省） | 产品/客户功能原型评审 |
| 测试服务器 | 主干 `Park` | `VITE_MOCK_ENABLED=false` + Mock 剥离 | 真实 | 开发测试 |
| 预发布服务器 | — | — | — | 正式前验证（暂不实现） |
| 正式服务器 | 主干 / 发布分支 | `VITE_MOCK_ENABLED=false` + Mock 剥离 | 真实 | 生产 |

**关键差异**：原型服务器跑 Mock 数据（前端独立可运行，后端可缺失）；测试/正式跑真实后端，且构建必须剥离 Mock。

## 分支命名与创建

完全遵循「同级目录 + `{revision}` 命名 + `svn copy` 创建」规范，仅以类型前缀区分用途（源文档 §3）：

| 分支类型 | 命名规则 | 示例 | 说明 |
|---|---|---|---|
| 主干 | `Park` | `Park` | 新功能开发主阵地，保持最新代码（不一定可发布） |
| 原型分支 | `Park-PT{revision}` | `Park-PT120` | 基于主干 r120 创建，做原型（Mock）演进 |
| Bug 分支 | `Park-BF{revision}` | `Park-BF087` | 已发布正式版 bug 修复 |

- 前缀含义：`PT` = Prototype，`BF` = Bugfix。
- `{revision}` = 创建时所基于的 SVN 版本号。
- 分支与主干同级（同在 `^/future/` 下，互为兄弟目录），用 `svn copy` 廉价拷贝创建，用毕 `svn delete` 删除。

## 确认门清单

本技能在以下**不可逆**操作前必须用 `AskUserQuestion` 确认，默认选项即「确认执行」：

| 门 | 时机 | 确认内容 |
|---|---|---|
| **A** | 建原型分支前 | 确认基于 `r_base` 创建 `Park-PT{r_base}` |
| **B** | 原型冻结前（阶段 1→2） | 确认已清理废弃实验代码、可进入合并 |
| **C** | `svn merge` 前 | 确认将原型分支整体合并到主干 |
| **D** | `svn delete` 删分支前 | 确认分支用毕可删 |

> 确认门的意义：SVN 分支创建/合并/删除都会改写仓库历史或主干内容，且整体合并不易回退。门的存在是为防止误操作污染主干历史（源文档 §8.1）。用户未确认前，绝不执行对应命令。

## 关键规则与约束

1. **整体合并、不 cherry-pick**：原型→主干用 `svn merge` 整体合并（记录 mergeinfo）。正因如此，**冻结前必须清理废弃实验代码**——未清理的脏代码会随整体合并进入主干，污染历史（源文档 §8.1）。
2. **冻结纪律**：阶段 1→2 之间必有冻结门 B，强制提示清理脏代码。
3. **工厂文件冲突热点**：`api/modules/{app|manager}/*.ts` 工厂文件同时 `import` Mock 与 Real，是合并高发冲突点；页面层 `views/` 对 Mock 零依赖，预期不冲突（源文档 §8.2）。合并前建议与前端协同。
4. **时序纪律**：同一功能模块，原型（Mock）未冻结前**不要在主干并行写真实实现**，否则合并冲突放大。按「原型冻结 → 合并 → 再补真实实现」串行（源文档 §8.3）。
5. **环境构建参数固化**：原型 `VITE_MOCK_ENABLED=true`；测试/正式 `VITE_MOCK_ENABLED=false`（+ Mock 剥离）。技能生成的 Jenkins 清单必须固化这两组参数，避免人工误填（源文档 §6.4）。
6. **DB schema 谨慎**：原型阶段一般不动数据库；真实实现改 schema 时警惕与并行 BF 分支的数据库冲突，必要时联系运维还原测试库（源文档 §8.4）。
7. **minigram 发布节奏**：小程序多一道微信审核，与 web 同流程但发布周期不同，发布计划需错开（源文档 §8.5）。

## 阶段 0 ｜ 主干状态检查

**首次交互**：用 `AskUserQuestion` 确认 SVN 路径参数（默认值取源文档，换项目可覆盖）：
- 主干名（默认 `Park`）
- 工作副本目录（默认 `e:/SVN/future/Park`）
- 仓库 URL 前缀（默认 `^/future/`）

**skill 动作**：
1. `svn info ^/future/Park` 取主干最新 revision，记为 `r_base`。
2. 在工作副本执行 `svn status` 检查是否有未提交改动——有则提示先提交或搁置，**不强行建分支**。

**产物**：`r_base`、工作副本干净度报告。命令细节见 [svn-commands.md](references/svn-commands.md)，当执行 svn 操作时再读。

## 阶段 1 ｜ 原型设计（前端先行）

1. **建原型分支**（确认门 A + 执行式）：
   - 确认门 A：向用户确认「基于 `r_base` 创建原型分支 `Park-PT{r_base}`」。
   - 用户确认后执行：`svn copy ^/future/Park ^/future/Park-PT{r_base} -m "原型分支：迭代N 基于 r{base}"`。
2. **委托编码**：切到原型分支工作副本，**先 Skill 调用** `frontend-workflow` + `api-typescript-spec` 再编码——按 spec 开发 `IXxxApi` 契约 + `MockXxxApi` + 页面，`VITE_MOCK_ENABLED=true`，不依赖真实后端。
   - 产物路径（对齐 `api-typescript-spec` 约定，`endpoint ∈ {app, manager}`）：
     - `src/api/interfaces/{endpoint}/<entity>.ts`（契约）
     - `src/mock/api/{endpoint}/<entity>.ts`（Mock 实现）
     - `src/mock/data/{endpoint}/<entity>.ts`（Mock 数据）
     - `src/views/<entity>/index.vue`（页面）
3. **生成原型发布清单**（不触发 Jenkins）：Jenkins 任务填分支 `Park-PT{r_base}`、构建参数 `VITE_MOCK_ENABLED=true`、目标「原型服务器」。模板见 [release-params.md](references/release-params.md)，当生成发布清单时再读。
4. **冻结门**（确认门 B）：提示用户「冻结前必须清理废弃实验性代码（整体 merge 会进主干）」，给出清理检查清单（见 [checklists.md](references/checklists.md)）。用户确认冻结后才进入阶段 2。

## 阶段 2 ｜ 合并回主干

5. **合并预检**：`svn status` 确认原型分支与主干工作副本都已提交到最新（源文档纪律：合并前两边都提交到最新）。
6. **执行合并**（确认门 C + 执行式）：
   - 确认门 C：向用户确认「将 `Park-PT{r_base}` 整体合并到主干」。
   - 在主干工作副本执行：`cd e:/SVN/future/Park && svn merge ^/future/Park-PT{r_base}`。
7. **冲突检测**：`svn status` 检测冲突标记（`C`）。
   - 预警热点：`src/api/modules/{app|manager}/*.ts` 工厂文件（同时 import Mock 与 Real）。
   - 有冲突 → **暂停**，列出冲突文件，提示人工解决；解决后用户回复继续 → `svn commit`。
   - 无冲突 → 直接 `svn commit -m "merge: 合并原型分支 Park-PT{r_base} 到主干"`。

## 阶段 3 ｜ 真实实现（开发）

8. **委托编码**：在主干**先 Skill 调用** `backend-workflow` + `api-typescript-spec`，为已冻结契约补 `RealXxxApi`（HTTP 实现）+ .NET 后端（Controller / Service / DTO / EF Core 实体与配置），严格按前端契约实现。
   - **以 repair 模块为样板**（源文档 §4.8）：前端 `api/interfaces/manager/repair.ts` ↔ 后端 `RepairManagerController.cs`，路由 `/api/manager/repair`，权限 `park:repair:*`，已闭环。
9. **生成测试发布清单**（不触发 Jenkins）：主干、构建参数 `VITE_MOCK_ENABLED=false`（+ Mock 剥离）、目标「测试服务器」。

## 阶段 4 ｜ 测试

10. **生成对照验收清单**：列出原型服务器功能点，供测试在测试服务器逐项对照真实实现（以原型服务器为功能验收基线）。模板见 [checklists.md](references/checklists.md)。
11. **Bug 分流**：
    - 当前迭代小 bug → 主干直接修。
    - 已发布正式版 bug → 走 BF 子流程（见下文「Bug 分支（BF）子流程」）。

## 阶段 5 ｜ 发布与收尾

12. **生成正式发布清单**（不触发 Jenkins）：主干、`VITE_MOCK_ENABLED=false`（+ Mock 剥离）、目标「正式服务器」、release 备注（供 Octopus）。
13. **删原型分支**（确认门 D + 执行式）：
    - 确认门 D：向用户确认「删除已用毕的原型分支 `Park-PT{r_base}`」。
    - 执行：`svn delete ^/future/Park-PT{r_base} -m "迭代N 原型分支用毕删除"`。

**迭代 N+1**：回到阶段 0，从主干最新 revision 拉新原型分支 `Park-PT{r_new}`。

## Bug 分支（BF）子流程

沿用《代码发布管理.docx》既有约定（源文档 §4.11、§7）：

1. **识别 BF 场景**：用户描述「正式环境某版本有 bug，但主干已在做下一迭代」→ 走 BF。
2. **建 BF 分支**：基于已发布正式版 revision `r_bf` 创建 `Park-BF{r_bf}`：
   `svn copy ^/future/Park@{r_bf} ^/future/Park-BF{r_bf} -m "Bug 分支：基于 r{bf}"`（`@{r_bf}` 为历史版本 peg revision）。
3. 在 BF 分支修 bug → 生成测试发布清单（分支 `Park-BF{r_bf}`）→ 测试通过 → 生成正式发布清单。
4. **合并回主干**：`svn merge ^/future/Park-BF{r_bf}`（在主干工作副本执行）→ 冲突检测 → 提交。
5. **删 BF 分支**：`svn delete ^/future/Park-BF{r_bf} -m "Bug 分支用毕删除"`。
6. **DB 风险提示**：若 bug 修复涉及 DB schema 中断性变更，提示联系运维还原测试库，不自动处理。

## 发布前置项提醒

生成测试/正式发布清单时，提醒确认以下前置项已就绪（源文档 §6，具体代码改动由开发另行实施，本技能只提醒）：

- **minigram Mock 剥离**：`frontend/minigram/vite.config.ts` 需有等价 `mockDataStripPlugin`（参照 web 端），否则小程序测试/正式构建包含 Mock。
- **后端多环境配置**：`appsettings.Staging.json` / `appsettings.Production.json` 齐全，`ASPNETCORE_ENVIRONMENT` 注入方式明确。
- **web 真实签名注入**：`VITE_BASIC_AUTH_APP` / `VITE_BASIC_AUTH_KEY` 在测试/正式构建的注入方式（Jenkins 凭据 / 构建参数）明确。
- **Jenkins 参数化**：原型任务固定 `true`、测试/正式任务固定 `false`。

## 交付校验清单

每次迭代收尾或阶段性暂停前，逐项确认：

- [ ] 四个确认门（A/B/C/D）均已经用户确认后才执行对应命令
- [ ] 分支命名合规（`Park-PT{revision}` / `Park-BF{revision}`，`{revision}` 为所基于版本号）
- [ ] 合并前主干与分支两边工作副本均已提交到最新
- [ ] 冻结门前已清理废弃实验代码（整体合并纪律）
- [ ] 发布清单的 `VITE_MOCK_ENABLED` 与目标环境匹配（原型 true / 测试正式 false）
- [ ] 用毕分支已删除（或已提示用户删除）
- [ ] BF 场景已提示 DB schema 风险（如涉及）

**发现不合规项时，先修正再继续，不要遗留问题。**
