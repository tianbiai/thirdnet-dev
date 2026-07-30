---
name: proto-workflow
description: >
  项目迭代「原型驱动」流程的 SVN 分支生命周期编排器：只做原型/Bug 分支的**创建、合并回主干、删除**三类操作，
  每个不可逆操作前设确认门。分支上的编码（前端契约/Mock、真实后端实现）、测试、发布均委托既有技能或由人完成，
  本技能不碰。遵循主干开发 + {revision} 同级目录分支约定（{Project} / {Project}-PT{r} / {Project}-BF{r}），
  适用于所有 thirdnet 全栈技能开发的项目，项目名与路径在创建分支时自动探测、不硬编码。当任务涉及「拉原型分支 /
  新建迭代原型 / 基于主干拉分支做原型 / 原型做好了合并回主干 / 用毕分支删除 / 线上 bug 走分支」等场景时必须使用，
  即使任务看起来简单也需遵循，以保证分支命名、合并纪律、不污染主干历史。
license: MIT
metadata:
  version: "1.1.0"
  author: thirdnet
---
# 原型驱动迭代 · SVN 分支生命周期编排

本技能只管原型驱动迭代中的 **SVN 分支生命周期**——原型分支与 Bug 分支的**创建、合并回主干、删除**。适用于所有用 thirdnet 全栈技能开发的项目，项目名与路径在首次交互自动探测、不硬编码。

分支承载的工作由别的技能/角色负责，**不在本技能范围**：原型分支上跑以 Mock 模式运行的前端原型（`VITE_MOCK_ENABLED=true`），编码委托 `frontend-workflow` + `api-typescript-spec`；真实后端实现在主干上由 `backend-workflow` 补齐；测试与发布由 `fullstack-review` 与人完成。

> **两个不可偏离的设计决策**
> 1. **执行式**：本技能**实际执行** svn 命令（`svn copy` 建分支、`svn merge` 合并、`svn delete` 删分支、`svn commit` 提交）。每个不可逆操作前必有**确认门**（见「确认门清单」）。
> 2. **只管分支**：本技能只管分支生命周期（创建 / 合并 / 删除 + 确认门 + 状态检查）。编码、测试、发布一律不在本技能范围。

## 迭代参数

本技能的所有命令与模板都通过以下四个参数指代当前项目，**不硬编码任何项目名或路径**。参数在「创建原型分支」首次探测并经你确认后，贯穿整个迭代：

| 参数 | 含义 | 探测方式 |
|------|------|---------|
| `{Project}` | 项目 / 主干名（如 `Park`、`Cockpit`、`Enterprise`） | 工作副本 `svn info` 的 URL 末段，或首次交互询问 |
| `{repoPrefix}` | SVN 仓库 URL 前缀（如 `^/future/`、`^/`） | `svn info` 的 URL 去掉主干名，或首次交互询问 |
| `{wcTrunk}` | 主干本地工作副本路径（如 `e:/SVN/future/Park`） | `svn info` 的 Working Copy Root，或首次交互询问 |
| `r_base` | 主干最新 revision | `svn info {repoPrefix}{Project}` 的 Last Changed Rev |

> 下文凡出现 `{Project}` / `{repoPrefix}` / `{wcTrunk}` / `r_base`，均指上述参数经确认后的实际取值。本文示例中出现的 `Park` 仅为一个样例项目名，便于直观理解分支命名形态。

## 相关技能

分支之外的工作委托下列技能：

| 场景 | 相关技能 |
|------|---------|
| 原型分支上的前端编码（契约 + Mock + 页面） | `thirdnet-fullstack:frontend-workflow` + `thirdnet-fullstack:api-typescript-spec` |
| 主干上的真实后端实现 | `thirdnet-fullstack:backend-workflow` + `thirdnet-fullstack:api-typescript-spec` |
| 功能完成全栈审查 | `thirdnet-fullstack:fullstack-review` |
| 全栈协调（前后端类型映射、RBAC） | `thirdnet-fullstack` |

## 边界 / 不做

- **不写业务代码**：前端契约 / Mock、后端 Real 实现交给上表技能。
- **不做测试 / 验收 / Bug 分流判定**：测试环节由 `fullstack-review` 与人工负责，本技能不管。
- **不做发布**：不触发 Jenkins / Octopus，不生成发布清单与环境构建参数。
- **不自动解决业务代码冲突**：`svn merge` 后检测冲突标记，有冲突则暂停、提示人工解决。
- **不处理微信小程序审核排期**、**不自动处理 DB schema 中断性变更**（提示联系运维）。

## 分支命名与创建

遵循「同级目录 + `{revision}` 命名 + `svn copy` 创建」规范，仅以类型前缀区分用途：

| 分支类型 | 命名规则 | 示例 | 说明 |
|---|---|---|---|
| 主干 | `{Project}` | `Park` | 新功能开发主阵地，保持最新代码（不一定可发布） |
| 原型分支 | `{Project}-PT{revision}` | `Park-PT120` | 基于主干 r120 创建，做原型（Mock）演进 |
| Bug 分支 | `{Project}-BF{revision}` | `Park-BF087` | 已发布正式版 bug 修复 |

- 前缀含义：`PT` = Prototype，`BF` = Bugfix。原型分支 = 项目名 + 所基于的主干 revision（`-PT` 为原型语义标记，用于与 Bug 分支区分）。
- `{revision}` = 创建时所基于的 SVN 版本号。
- 分支与主干同级（同在 `{repoPrefix}` 下，互为兄弟目录），用 `svn copy` 廉价拷贝创建，用毕 `svn delete` 删除。
- 示例中的 `Park` 仅为一个样例项目名；实际取本项目的 `{Project}`。

## 确认门清单

三类操作对应三道确认门，均用 `AskUserQuestion`，默认选项即「确认执行」：

| 门 | 时机 | 确认内容 |
|---|---|---|
| **A** | 建分支前 | 确认基于 `r_base` 创建 `{Project}-PT{r_base}`（或 BF 的 `{Project}-BF{r_bf}`） |
| **B** | `svn merge` 前 | 确认将分支整体合并到主干（含已清理废弃实验代码） |
| **C** | `svn delete` 删分支前 | 确认分支用毕可删 |

> 确认门的意义：SVN 分支创建/合并/删除都会改写仓库历史或主干内容，且整体合并不易回退。门的存在是为防止误操作污染主干历史。用户未确认前，绝不执行对应命令。

## 关键规则与约束

1. **整体合并、不 cherry-pick**：分支→主干用 `svn merge` 整体合并（记录 mergeinfo）。正因如此，**合并前必须清理废弃实验代码**——未清理的脏代码会随整体合并进入主干，污染历史。
2. **工厂文件冲突热点**：`src/api/modules/**/*.ts` 工厂文件（同时 `import` Mock 与 Real，如本项目按端/模块分的 `app/`、`manager/` 等）是合并高发冲突点；页面层 `views/` 对 Mock 零依赖，预期不冲突。合并前建议与前端协同。
3. **时序纪律**：同一功能模块，原型（Mock）未合并回主干前**不要在主干并行写真实实现**，否则冲突放大。按「原型合并 → 再补真实实现」串行。
4. **DB schema 谨慎**：原型阶段一般不动数据库；BF 分支修 bug 改 schema 时警惕与主干的数据库冲突，必要时联系运维还原测试库。

## 工作流：分支生命周期

三类操作按序执行。命令细节见 [svn-commands.md](references/svn-commands.md)；合并预检 / 冲突处理 / 删分支确认清单见 [checklists.md](references/checklists.md)。

### 创建原型分支

1. **主干状态检查（探测 + 确认）**：
   - 在当前工作副本执行 `svn info`，从 URL 解析 `{Project}`、`{repoPrefix}`，取 Working Copy Root 作为 `{wcTrunk}` 候选；`AskUserQuestion` 让你确认/覆盖（默认值=探测值）。当前目录非工作副本时退化为对三参数的全量询问。
   - `svn info {repoPrefix}{Project}` 取主干最新 revision，记为 `r_base`。
   - 在 `{wcTrunk}` 执行 `svn status` 检查未提交改动——有则提示先提交或搁置，**不强行建分支**。
2. **确认门 A**：向用户确认「基于 `r_base` 创建原型分支 `{Project}-PT{r_base}`」。
3. 用户确认后执行：`svn copy {repoPrefix}{Project} {repoPrefix}{Project}-PT{r_base} -m "原型分支：迭代N 基于 r{base}"`。
4. 此后原型编码在分支上进行（委托 `frontend-workflow`+`api-typescript-spec`，`VITE_MOCK_ENABLED=true`）——**编码细节不在本技能范围**。

### 合并回主干

5. **合并预检**：`svn status` 确认原型分支与主干工作副本都已提交到最新；**废弃实验代码已清理**（整体合并会把它带进主干）。预检清单见 [checklists.md](references/checklists.md)。
6. **确认门 B**：向用户确认「将 `{Project}-PT{r_base}` 整体合并到主干」。
7. 在主干工作副本执行：`cd {wcTrunk} && svn merge {repoPrefix}{Project}-PT{r_base}`。
8. **冲突检测**：`svn status` 检测冲突标记（`C`），预警 `src/api/modules/**/*.ts` 工厂文件热点。有冲突 → **暂停**、列文件、提示人工解决，解决后用户回复继续；无冲突 → `svn commit -m "merge: 合并原型分支 {Project}-PT{r_base} 到主干"`。

### 删除分支

9. **确认门 C**：向用户确认「删除已用毕的原型分支 `{Project}-PT{r_base}`」。
10. 执行：`svn delete {repoPrefix}{Project}-PT{r_base} -m "迭代N 原型分支用毕删除"`。

**迭代 N+1**：回到「创建原型分支」，从主干最新 revision 拉新原型分支 `{Project}-PT{r_new}`。

## Bug 分支（BF）子流程

同一个三步生命周期，用于「正式环境某版本有 bug、但主干已在做下一迭代」：

1. **识别 BF 场景**：用户描述上述情形 → 走 BF。
2. **创建**（确认门 A）：基于已发布正式版 revision `r_bf` 创建 `{Project}-BF{r_bf}`：
   `svn copy {repoPrefix}{Project}@{r_bf} {repoPrefix}{Project}-BF{r_bf} -m "Bug 分支：基于 r{bf}"`（`@{r_bf}` 为历史版本 peg revision）。
3. 在 BF 分支修 bug（编码不在本技能范围）。
4. **合并回主干**（确认门 B）：`svn merge {repoPrefix}{Project}-BF{r_bf}`（在 `{wcTrunk}` 执行）→ 冲突检测 → 提交。
5. **删除**（确认门 C）：`svn delete {repoPrefix}{Project}-BF{r_bf} -m "Bug 分支用毕删除"`。
6. **DB 风险提示**：若涉及 DB schema 中断性变更，提示联系运维还原测试库，不自动处理。

## 交付校验清单

每次迭代收尾或阶段性暂停前，逐项确认：

- [ ] 三个确认门（A/B/C）均已经用户确认后才执行对应命令
- [ ] 分支命名合规（`{Project}-PT{revision}` / `{Project}-BF{revision}`，`{revision}` 为所基于版本号）
- [ ] 合并前主干与分支两边工作副本均已提交到最新，废弃实验代码已清理（整体合并纪律）
- [ ] 用毕分支已删除（或已提示用户删除）
- [ ] BF 场景已提示 DB schema 风险（如涉及）

**发现不合规项时，先修正再继续，不要遗留问题。**
