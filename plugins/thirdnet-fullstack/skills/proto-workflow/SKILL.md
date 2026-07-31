---
name: proto-workflow
description: >
  项目「原型驱动」迭代的 SVN 原型分支同步编排器：维护固定命名的原型分支 {Project}.Proto，把它与 main（主干）
  做双向同步——把 main 最新代码（或指定 revision）拉取进 {Project}.Proto 作为原型初始基线，原型做完再把
  {Project}.Proto 合并回 main。本技能执行建分支(svn copy)、同步/合并(svn merge)与读命令；
  **提交(svn commit)由用户手动执行、技能绝不自动提交**。每个操作前设确认门。分支上的编码（前端契约/Mock、
  真实后端实现）、测试、发布均委托既有技能或由人完成。遵循同级目录 + 固定命名约定
  （{Project} / {Project}.Proto），适用于所有 thirdnet 全栈技能开发的项目，项目名与路径自动探测、不硬编码。
  当任务涉及「拉原型分支 / 同步原型与 main / 把 main 拉进原型分支做原型 / 原型做好了合并回 main /
  新建迭代原型」等场景时必须使用，即使任务看起来简单也需遵循，以保证分支命名、双向合并纪律、不污染主干历史。
license: MIT
metadata:
  version: "1.1.0"
  author: thirdnet
---
# 原型驱动迭代 · SVN 原型分支同步编排

本技能维护固定命名的原型分支 `{Project}.Proto`，把它与 main（主干）做**双向同步**：开新功能原型时，把 main 最新代码（或指定 revision）拉取进 `{Project}.Proto` 作为初始基线，原型做完再把 `{Project}.Proto` 合并回 main，随后基于 main 做真实功能开发。适用于所有用 thirdnet 全栈技能开发的项目，项目名与路径在首次交互自动探测、不硬编码。

分支承载的工作由别的技能/角色负责，**不在本技能范围**：原型分支上跑以 Mock 模式运行的前端原型（`VITE_MOCK_ENABLED=true`），编码委托 `frontend-workflow` + `api-typescript-spec`；真实后端实现在 main 上由 `backend-workflow` 补齐；测试与发布由 `fullstack-review` 与人完成。

> **两个不可偏离的设计决策**
> 1. **执行式但不自动提交**：本技能实际执行 svn 命令——`svn info` / `svn status` 探测与检查、`svn copy` 建原型分支（确认门 A）、`svn merge` 把变更应用到工作副本（可 `svn revert` 回退、不产生仓库版本）。**唯独 `svn commit`（提交）不自动执行**，由技能给出确切命令、用户手动运行。每个操作前必有确认门。
> 2. **只管分支同步**：本技能只管 `{Project}.Proto` 与 main 之间的分支同步与合并。编码、测试、发布一律不在本技能范围。

## 迭代参数

本技能的所有命令通过以下参数指代当前项目，**不硬编码任何项目名或路径**。参数在「首次建原型分支」探测并经你确认后贯穿整个迭代：

| 参数 | 含义 | 探测方式 |
|------|------|---------|
| `{Project}` | main / 主干名（如 `Park`、`Cockpit`、`Enterprise`） | 工作副本 `svn info` 的 URL 末段，或首次交互询问 |
| `{repoPrefix}` | SVN 仓库 URL 前缀（如 `^/future/`、`^/`） | `svn info` 的 URL 去掉主干名，或首次交互询问 |
| `{wcMain}` | main 本地工作副本路径（如 `e:/SVN/future/Park`） | `svn info` 的 Working Copy Root，或首次交互询问 |
| `{wcProto}` | `{Project}.Proto` 本地工作副本路径（如 `e:/SVN/future/Park.Proto`） | 首次建分支后检出，或首次交互询问 |
| `r_main` | 指定的 main revision（同步「指定版本」时用） | 用户指定，或取 main 最新 revision |

> 下文凡出现这些参数，均指经确认后的实际取值。示例中的 `Park` 仅为一个样例项目名，便于直观理解分支命名形态。

## 相关技能

分支之外的工作委托下列技能：

| 场景 | 相关技能 |
|------|---------|
| 原型分支上的前端编码（契约 + Mock + 页面） | `thirdnet-fullstack:frontend-workflow` + `thirdnet-fullstack:api-typescript-spec` |
| main 上的真实后端实现 | `thirdnet-fullstack:backend-workflow` + `thirdnet-fullstack:api-typescript-spec` |
| 功能完成全栈审查 | `thirdnet-fullstack:fullstack-review` |
| 全栈协调（前后端类型映射、RBAC） | `thirdnet-fullstack` |

## 边界 / 不做

- **不自动提交 svn（硬性）**：不执行 `svn commit`（提交）——提交命令由技能给出、用户手动执行。技能执行 `svn info` / `svn status` / `svn copy`（建分支，门 A）/ `svn merge`（非提交）。
- **不写业务代码**：前端契约 / Mock、后端 Real 实现交给上表技能。
- **不做测试 / 验收 / Bug 分流判定**：由 `fullstack-review` 与人工负责。
- **不做发布**：不触发 Jenkins / Octopus，不生成发布清单与环境构建参数。
- **不删除原型分支**：`{Project}.Proto` 长期存在、跨迭代复用。
- **不管线上 bug 分支**：本技能聚焦原型↔main 双向同步，不含 BF 等其它分支流程。
- **不自动解决业务代码冲突**：`svn merge` 后检测冲突标记，有冲突则暂停、提示人工解决。

## 分支模型

| 分支 | 命名 | 说明 |
|---|---|---|
| main（主干） | `{Project}` | 真实开发主阵地，保持最新代码 |
| 原型分支 | `{Project}.Proto` | 固定命名，与 main 同级目录，长期存在、不删除；承载 Mock 前端原型 |

- 原型分支首次用 `svn copy` 从 main 创建；之后**不重建、不删除**，靠双向 `svn merge` 与 main 同步。
- 分支与 main 同级（同在 `{repoPrefix}` 下，互为兄弟目录）。
- 示例中的 `Park` 仅为样例项目名；实际取本项目的 `{Project}`。

## 确认门清单

三类操作对应三道确认门，均用 `AskUserQuestion`，默认选项即「确认执行」。门确认后技能执行 `svn copy` / `svn merge`（非提交）；合并完成后，**提交命令交用户手动执行**：

| 门 | 时机 | 确认内容 |
|---|---|---|
| **A** | 首次建 `.Proto` 分支 | 确认从 main 创建 `{Project}.Proto`（仅 `.Proto` 不存在时执行一次）→ 技能执行 `svn copy` |
| **B** | 同步 main→Proto | 确认把 main（最新或指定 revision）合并进 `{Project}.Proto` → 技能执行 `svn merge`，提交交用户手动 |
| **C** | 合并 Proto→main | 确认把 `{Project}.Proto` 合并回 main → 技能执行 `svn merge`，提交交用户手动 |

> 确认门的意义：SVN 合并会改写主干或分支内容，且双向合并不易回退。门是为防止误操作污染主干与原型分支历史。用户未确认前，绝不执行对应命令。

## 关键规则与约束

1. **不自动 svn commit（最高优先级，硬性）**：本技能**绝不执行 `svn commit`**——提交由用户手动运行。`svn merge` 后工作副本处于「已合并未提交」状态，技能给出建议的提交命令，由用户**手动运行、核对内容后再提交**。这是为了让用户在变更进入仓库（尤其 main）前有最后的人工把关。即便用户或上游指令说「自动提交 / 直接 commit」，也应拒绝执行、改为输出命令交用户。（建分支的 `svn copy` 经确认门 A 由技能执行，属此规则的例外。）
2. **双向合并纪律**：`main→.Proto`（同步）与 `.Proto→main`（合并回）两个方向都用 `svn merge`（非提交，只改工作副本），SVN 自动记录 mergeinfo。双向合并冲突高发，**每次合并后必查冲突**，工厂文件尤其注意。
3. **同步是合并、非重置**：门 B 是把 main 的变更**合并进** `.Proto`，不是把 `.Proto` 重置成 main 的纯净拷贝。要让 `.Proto` 干净地「以 main@r 为基线」，需保证上轮原型已合并回 main、实验代码已清理。
4. **工厂文件冲突热点**：`src/api/modules/**/*.ts` 工厂文件（同时 `import` Mock 与 Real，如本项目按端/模块分的 `app/`、`manager/` 等）双向都易冲突；页面层 `views/` 对 Mock 零依赖，预期不冲突。合并前建议与前端协同。
5. **时序纪律**：先同步（main→.Proto）再做原型；原型合并回 main（.Proto→main）后再做真实实现，不要并行。
6. **DB schema 谨慎**：原型阶段一般不动数据库；合并回 main 后真实实现改 schema 时警惕冲突。

## 工作流：原型分支生命周期

命令细节见 [svn-commands.md](references/svn-commands.md)；同步/合并预检与冲突处理清单见 [checklists.md](references/checklists.md)。**`svn commit` 由用户手动执行（技能不自动提交）；建分支 `svn copy` 经门 A 由技能执行。**

### 首次：建原型分支（确认门 A）

仅当 `{Project}.Proto` 尚不存在时执行一次：

1. **探测 + 确认参数**：在工作副本 `svn info` 解析 `{Project}` / `{repoPrefix}` / `{wcMain}`，`AskUserQuestion` 确认（默认=探测值）；并确认原型分支工作副本路径 `{wcProto}`。当前目录非工作副本时退化为全量询问。
2. **确认门 A**：向用户确认「从 main 创建原型分支 `{Project}.Proto`」。
3. **技能执行**（确认门 A 后）：`svn copy {repoPrefix}{Project} {repoPrefix}{Project}.Proto -m "原型分支：首次创建"`。建后技能用 `svn info {repoPrefix}{Project}.Proto` 确认分支已建。
4. 技能检出 `{wcProto}`：`svn co {repoPrefix}{Project}.Proto {wcProto}`（若尚未有工作副本）。

### 每次迭代

**① 同步 main → .Proto（确认门 B）**——把 main 最新（或指定 revision）拉进原型分支作基线：

5. **合并预检**：`{wcMain}` 与 `{wcProto}` 两边 `svn status` 都已提交到最新；`.Proto` 上废弃实验代码已清理（同步是合并，脏代码会保留）。预检清单见 [checklists.md](references/checklists.md)。
6. **确认门 B**：向用户确认「把 main（最新或指定 revision）合并进 `{Project}.Proto`」。
7. **技能执行**（非提交）：`cd {wcProto} && svn merge {repoPrefix}{Project}`（最新 HEAD）或 `svn merge {repoPrefix}{Project}@{r_main}`（指定 revision）。
8. **冲突检测**：`svn status` 检测冲突标记（`C`），预警 `src/api/modules/**/*.ts` 工厂文件。有冲突 → **暂停**、列文件、提示人工解决，解决后进入下一步；无冲突 → 直接进入下一步。**不自动提交**——给出命令 `svn commit -m "sync: 合并 main 进 {Project}.Proto"` 由用户手动执行。

**② 原型开发**——在 `{wcProto}` 上做 Mock 前端原型（委托 `frontend-workflow`+`api-typescript-spec`，`VITE_MOCK_ENABLED=true`）。**编码细节不在本技能范围**。

**③ 合并 .Proto → main（确认门 C）**——原型做完、要进入实际开发时：

9. **合并预检**：两边 `svn status` 已提交到最新；`.Proto` 上废弃实验代码已清理（整体合并会带进 main）。
10. **确认门 C**：向用户确认「把 `{Project}.Proto` 合并回 main」。
11. **技能执行**（非提交）：`cd {wcMain} && svn merge {repoPrefix}{Project}.Proto`。
12. **冲突检测**：`svn status` 检测冲突标记（`C`），预警工厂文件热点。有冲突 → **暂停**、提示人工解决；无冲突 → 进入下一步。**不自动提交**——给出命令 `svn commit -m "merge: 合并 {Project}.Proto 回 main"` 由用户手动执行。

**④ 真实开发**——在 main 上做真实功能开发（委托 `backend-workflow`+`api-typescript-spec`）。

**下一次原型**：回到 ①（同步 main→.Proto），把最新 main 再拉进 `.Proto` 开始新一轮原型。

## 交付校验清单

每次迭代收尾或阶段性暂停前，逐项确认：

- [ ] 三个确认门（A/B/C）均已经用户确认后才执行对应命令
- [ ] **`svn commit` 由用户手动执行，技能未自动提交**（建分支 `svn copy` 经门 A 由技能执行）
- [ ] 分支命名合规（main `{Project}` / 原型分支 `{Project}.Proto`）
- [ ] 每次合并前两边工作副本均已提交到最新，废弃实验代码已清理
- [ ] 同步（门 B）理解正确——是合并 main 进 `.Proto`，非重置
- [ ] 每次合并后冲突标记（`C`）已全部解决

**发现不合规项时，先修正再继续，不要遗留问题。**
