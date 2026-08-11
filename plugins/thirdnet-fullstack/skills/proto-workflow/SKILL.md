---
name: proto-workflow
description: >
  项目「原型驱动」迭代的 SVN 原型分支同步编排器：维护固定命名的原型分支 {Project}.Proto，把它与 main（主干）
  做双向同步——把 main 最新代码（或指定 revision）拉取进 {Project}.Proto 作为原型初始基线，原型做完再把
  {Project}.Proto 合并回 main。**支持多个原型功能分支 {Project}.Proto.{Feature} 并行开发、选择性合并到主干**
  （一个功能完成合并回 main、另一个暂不合并、留在功能分支）。本技能执行建分支(svn copy)、同步/合并(svn merge)与读命令；
  **提交(svn commit)由用户手动执行、技能绝不自动提交**。每个操作前设确认门。分支上的编码（前端契约/Mock、
  真实后端实现）、测试、发布均委托既有技能或由人完成。遵循同级目录 + 固定命名约定
  （{Project} / {Project}.Proto / {Project}.Proto.{Feature}），适用于所有 thirdnet 全栈技能开发的项目，项目名与路径自动探测、不硬编码。
  当任务涉及「拉原型分支 / 同步原型与 main / 把 main 拉进原型分支做原型 / 原型做好了合并回 main /
  基于原型分支创建原型功能分支 / 原型功能分支合并到主干 / 把原型分支同步到原型功能分支 / 并行原型 / 选择性合并 /
  新建迭代原型」等场景时必须使用，即使任务看起来简单也需遵循，以保证分支命名、双向合并纪律、不污染主干历史。
license: MIT
metadata:
  version: "1.3.0"
  author: thirdnet
---
# 原型驱动迭代 · SVN 原型分支同步编排

本技能维护固定命名的原型分支 `{Project}.Proto`，把它与 main（主干）做**双向同步**：开新功能原型时，把 main 最新代码（或指定 revision）拉取进 `{Project}.Proto` 作为初始基线，原型做完再把 `{Project}.Proto` 合并回 main，随后基于 main 做真实功能开发。**多个功能并行原型时**，从 `{Project}.Proto` 派生原型功能分支 `{Project}.Proto.{Feature}`，每支承载一个功能的 Mock 原型；功能完成时把该功能分支**选择性**合并回 main（只带该功能、其它功能分支不动）。适用于所有用 thirdnet 全栈技能开发的项目，项目名与路径在首次交互自动探测、不硬编码。

分支承载的工作由别的技能/角色负责，**不在本技能范围**：原型分支上跑以 Mock 模式运行的前端原型（`VITE_MOCK_ENABLED=true`），编码委托 `frontend-workflow` + `api-typescript-spec`；真实后端实现在 main 上由 `backend-workflow` 补齐；测试与发布由 `fullstack-review` 与人完成。

> **三个不可偏离的设计决策**
> 1. **执行式但不自动提交**：本技能实际执行 svn 命令——`svn info` / `svn status` 探测与检查、`svn copy` 建原型分支（确认门 A）/ 建原型功能分支（确认门 D）、`svn merge` 把变更应用到工作副本（可 `svn revert` 回退、不产生仓库版本）。**唯独 `svn commit`（提交）不自动执行**，由技能给出确切命令、用户手动运行。每个操作前必有确认门。
> 2. **只管分支同步**：本技能只管 `{Project}.Proto` 及其派生的 `{Project}.Proto.{Feature}` 与 main 之间的分支同步与合并。编码、测试、发布一律不在本技能范围。
> 3. **`.Proto` 是纯基线镜像、功能分支是选择性合并的单位**：并行多功能时，`.Proto` 只从 main 同步进来作派生起点、自身不攒任何功能代码（永远干净）；每个功能活在自己的 `{Project}.Proto.{Feature}` 分支上，做完哪个就把哪个 `svn merge` 到 main（直接到 main、不经 `.Proto`），从而实现「只带该功能、不带其它功能」。

## 迭代参数

本技能的所有命令通过以下参数指代当前项目，**不硬编码任何项目名或路径**。参数在「首次建原型分支」探测并经你确认后贯穿整个迭代：

| 参数 | 含义 | 探测方式 |
|------|------|---------|
| `{Project}` | main / 主干名（如 `Park`、`Cockpit`、`Enterprise`） | 工作副本 `svn info` 的 URL 末段，或首次交互询问 |
| `{repoPrefix}` | SVN 仓库 URL 前缀（如 `^/future/`、`^/`） | `svn info` 的 URL 去掉主干名，或首次交互询问 |
| `{wcMain}` | main 本地工作副本路径（如 `e:/SVN/future/Park`） | `svn info` 的 Working Copy Root，或首次交互询问 |
| `{wcProto}` | `{Project}.Proto` 本地工作副本路径（如 `e:/SVN/future/Park.Proto`） | 首次建分支后检出，或首次交互询问 |
| `{Feature}` | 原型功能分支的功能名（PascalCase，如 `Alarm`、`Map`） | 用户在「创建原型功能分支」时指定 |
| `{wcProtoFeat}` | `{Project}.Proto.{Feature}` 本地工作副本路径（如 `e:/SVN/future/Park.Proto.Alarm`） | 建功能分支后检出，或首次交互询问 |
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
- **不删除原型分支**：`{Project}.Proto` 长期存在、跨迭代复用。原型功能分支 `{Project}.Proto.{Feature}` 合并进 main 并验证后**可删除**（避免分支堆积）。
- **不管线上 bug 分支**：本技能聚焦原型↔main 双向同步，不含 BF 等其它分支流程。
- **不自动解决业务代码冲突**：`svn merge` 后检测冲突标记，有冲突则暂停、提示人工解决。
- **不自动决定哪个功能先合并**：并行场景下哪个功能分支走门 E 合并到主干、哪个暂留，由用户在门 E 显式指定，技能不替用户做选择性决策。

## 分支模型

| 分支 | 命名 | 说明 |
|---|---|---|
| main（主干） | `{Project}` | 真实开发主阵地，保持最新代码 |
| 原型分支 | `{Project}.Proto` | 固定命名，与 main 同级目录，长期存在、不删除；**纯基线镜像**——从 main 同步进来，作功能分支派生起点，自身不攒功能代码 |
| 原型功能分支 | `{Project}.Proto.{Feature}` | 从 `.Proto` 派生（`svn copy`），承载**单个功能**的 Mock 原型；并行多功能时每功能一支；合并进 main 并验证后可删除 |

- 原型分支首次用 `svn copy` 从 main 创建；之后**不重建、不删除**，靠双向 `svn merge` 与 main 同步。
- 原型功能分支用 `svn copy` 从 `.Proto` 创建（门 D）；合并进 main（门 E）并验证后**可删除**，避免分支堆积。
- 分支与 main 同级（同在 `{repoPrefix}` 下，互为兄弟目录）。
- 示例中的 `Park` 仅为样例项目名；实际取本项目的 `{Project}`。

## 确认门清单

六类操作对应六道确认门，均用 `AskUserQuestion`，默认选项即「确认执行」。门确认后技能执行 `svn copy` / `svn merge`（非提交）；合并完成后，**提交命令交用户手动执行**：

| 门 | 时机 | 确认内容 |
|---|---|---|
| **A** | 首次建 `.Proto` 分支 | 确认从 main 创建 `{Project}.Proto`（仅 `.Proto` 不存在时执行一次）→ 技能执行 `svn copy` |
| **B** | 同步 main→Proto | 确认把 main（最新或指定 revision）合并进 `{Project}.Proto` → 技能执行 `svn merge`，提交交用户手动 |
| **C** | 合并 Proto→main | 确认把 `{Project}.Proto` 合并回 main（单功能迭代整体合并）→ 技能执行 `svn merge`，提交交用户手动 |
| **D** | 创建原型功能分支 | 确认从 `.Proto` 创建 `{Project}.Proto.{Feature}`（并行多功能时每功能一支）→ 技能执行 `svn copy` |
| **E** | 合并功能分支→main | 确认把 `{Project}.Proto.{Feature}` 合并回 main（**选择性**，只带该功能、其它功能分支不动）→ 技能执行 `svn merge`，提交交用户手动 |
| **F** | 同步 .Proto→功能分支 | 确认把 `.Proto`（含已落地功能）合并进 `{Project}.Proto.{Feature}`（功能分支合并主干前的基线回灌）→ 技能执行 `svn merge`，提交交用户手动 |

> 确认门的意义：SVN 合并会改写主干或分支内容，且双向合并不易回退。门是为防止误操作污染主干与原型分支历史。用户未确认前，绝不执行对应命令。

## 关键规则与约束

1. **不自动 svn commit（最高优先级，硬性）**：本技能**绝不执行 `svn commit`**——提交由用户手动运行。`svn merge` 后工作副本处于「已合并未提交」状态，技能给出建议的提交命令，由用户**手动运行、核对内容后再提交**。这是为了让用户在变更进入仓库（尤其 main）前有最后的人工把关。即便用户或上游指令说「自动提交 / 直接 commit」，也应拒绝执行、改为输出命令交用户。（建分支的 `svn copy` 经确认门 A 由技能执行，属此规则的例外。）
2. **双向合并纪律**：`main→.Proto`（同步）与 `.Proto→main`（合并回）两个方向都用 `svn merge`（非提交，只改工作副本），SVN 自动记录 mergeinfo。双向合并冲突高发，**每次合并后必查冲突**，工厂文件尤其注意。
3. **同步是合并、非重置**：门 B 是把 main 的变更**合并进** `.Proto`，不是把 `.Proto` 重置成 main 的纯净拷贝。要让 `.Proto` 干净地「以 main@r 为基线」，需保证上轮原型已合并回 main、实验代码已清理。
4. **工厂文件冲突热点**：`src/api/modules/**/*.ts` 工厂文件（同时 `import` Mock 与 Real）双向都易冲突；页面层 `views/` 对 Mock 零依赖，预期不冲突。合并前建议与前端协同。（前端工程内 `api/`、`mock/` 默认扁平；仅多端工程如 protohub 例外按端建子目录，冲突热点同上。）
5. **时序纪律**：先同步（main→.Proto）再做原型；原型合并回 main（.Proto→main）后再做真实实现，不要并行。
6. **DB schema 谨慎**：原型阶段一般不动数据库；合并回 main 后真实实现改 schema 时警惕冲突。
7. **功能分支是选择性合并的单位（并行场景核心）**：`svn merge {repoPrefix}{Project}.Proto.{Feature}` 到 main（门 E）只带该功能；`.Proto` 不经手功能合并、保持基线纯净。这是 SVN 下实现「多个功能并行、选择性合并到主干」的唯一稳妥方式——靠物理分支隔离，而非靠人脑记 revision。
8. **功能分支合并主干前必须先同步基线（门 F）**：xxx2 等活跃功能分支在走门 E 合并主干前，**必须先经门 F** 把含已落地功能（如 xxx1）的最新 `.Proto` 同步进来。否则共享脚手架（`src/router/index.ts` 路由表、`src/api/modules/index.ts` 工厂注册）必然冲突——两个功能都改过这些文件，而功能分支工作副本里没有已落地功能的版本。门 F 前应先经门 B 让 `.Proto` 基线新鲜（含 main 上已落地的真实实现）。
9. **功能分支可删除、`.Proto` 不可**：门 E 合并进 main 并验证后 `{Project}.Proto.{Feature}` 可删，避免分支堆积；`{Project}.Proto` 长期存在、跨迭代复用。

## 工作流：原型分支生命周期

命令细节见 [svn-commands.md](references/svn-commands.md)；同步/合并预检与冲突处理清单见 [checklists.md](references/checklists.md)。**`svn commit` 由用户手动执行（技能不自动提交）；建分支 `svn copy` 经门 A（建 `.Proto`）/ 门 D（建 `.Proto.{Feature}`）由技能执行。**

> **两种迭代模式**：① **单功能迭代**（下文「首次」+「每次迭代」）——整个原型在一个 `.Proto` 上做完、整体合并回 main（门 C）；② **并行功能迭代**（下文「并行功能分支生命周期」）——多个功能各起 `.Proto.{Feature}` 分支并行原型、选择性合并到主干（门 D/E/F）。两种模式向后兼容，单功能场景沿用门 A/B/C 即可。

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

## 工作流：并行功能分支生命周期（多功能并行原型 + 选择性合并）

当**多个功能要在原型上并行开发、且各自独立决定何时合并到主干**时启用。核心：从 `.Proto` 派生每功能一支的 `{Project}.Proto.{Feature}`，功能完成时把该功能分支**直接**合并到 main（门 E，只带该功能），`.Proto` 全程只当派生基线、不经手功能代码。

以两个功能 `A` / `B`（如 `{Feature}=Alarm` / `Map`）为例，完整 7 步流程：

**① 同步 main → .Proto（确认门 B）**——建立/刷新共享基线，作为功能分支的派生起点：

1. **合并预检 + 确认门 B + 执行 + 冲突检测**：同「每次迭代①」。技能执行 `cd {wcProto} && svn merge {repoPrefix}{Project}`，提交交用户手动。`.Proto` 此刻为干净基线。

**② 派生原型功能分支（确认门 D）**——每功能一支：

2. **确认门 D（功能 A）**：向用户确认「从 `{Project}.Proto` 创建原型功能分支 `{Project}.Proto.Alarm`」。
3. **技能执行**（门 D 后）：`svn copy {repoPrefix}{Project}.Proto {repoPrefix}{Project}.Proto.Alarm -m "原型功能分支：Alarm"`。建后技能用 `svn info` 确认，并检出 `{wcProtoFeat}`：`svn co {repoPrefix}{Project}.Proto.Alarm {wcProtoFeat}`。
4. **确认门 D（功能 B）**：同上，创建 `{Project}.Proto.Map` 并检出。并行多功能时重复此步。

**③ 功能原型开发**——在各自 `{wcProtoFeat}` 上做 Mock 前端原型（委托 `frontend-workflow`+`api-typescript-spec`，`VITE_MOCK_ENABLED=true`）。**编码细节不在本技能范围**。

**④ 功能 A 合并到主干（确认门 E，选择性）**——A 完成、要进入实际开发时：

5. **合并预检**：`{wcProtoFeat}`（A）与 `{wcMain}` 两边 `svn status` 已提交到最新；A 上废弃实验代码已清理。预检清单见 [checklists.md](references/checklists.md)。
6. **确认门 E（功能 A）**：向用户确认「把 `{Project}.Proto.Alarm` 合并回 main（只带 Alarm、不带 Map）」。
7. **技能执行**（非提交）：`cd {wcMain} && svn merge {repoPrefix}{Project}.Proto.Alarm`。
8. **冲突检测**：`svn status` 检测冲突标记（`C`），预警工厂文件热点。有冲突 → **暂停**、提示人工解决；无冲突 → 进入下一步。**不自动提交**——给出命令 `svn commit -m "merge: 合并 {Project}.Proto.Alarm 回 main"` 由用户手动执行。

**⑤ 真实开发（功能 A）**——在 main 上做 A 的真实功能开发（委托 `backend-workflow`+`api-typescript-spec`）。功能 B 仍在 `.Proto.Map` 分支上、**不被带入 main**。

**⑥ 回灌基线（确认门 B → 门 F）**——让 `.Proto` 与功能 B 拿到 A 的真实实现，为 B 后续合并做准备：

9. **确认门 B**：先把 main（含 A 的原型 + 真实实现）同步进 `.Proto`：`cd {wcProto} && svn merge {repoPrefix}{Project}`，提交交用户手动。`.Proto` 重新镜像 main、仍是干净基线。
10. **确认门 F（功能 B）**：向用户确认「把 `{Project}.Proto`（含已落地的 Alarm）合并进 `{Project}.Proto.Map`」。
11. **技能执行**（非提交）：`cd {wcProtoFeat}(B) && svn merge {repoPrefix}{Project}.Proto`。
12. **冲突检测**：`svn status` 检测冲突标记（`C`）。**门 F 高发共享脚手架冲突**（路由表、工厂注册——A、B 都改过），逐个文件人工解决。无冲突残留 → 进入下一步。**不自动提交**——给出命令 `svn commit -m "sync: 合并 {Project}.Proto 进 {Project}.Proto.Map"` 由用户手动执行。

> **纪律（关键）**：功能 B 在走下一步（门 E 合并主干）前，**必须先完成第 9-12 步**（门 B + 门 F）。跳过则 B 工作副本缺 A 的脚手架版本，门 E 必撞冲突。

**⑦ 功能 B 合并到主干（确认门 E，选择性）**——B 完成、基线已同步：

13. **确认门 E（功能 B）**：向用户确认「把 `{Project}.Proto.Map` 合并回 main（只带 Map）」。
14. **技能执行**（非提交）：`cd {wcMain} && svn merge {repoPrefix}{Project}.Proto.Map`。
15. **冲突检测 + 用户手动提交**：同第 8 步。`svn commit -m "merge: 合并 {Project}.Proto.Map 回 main"`。

**⑧ 收尾**：功能分支 `{Project}.Proto.Alarm` / `{Project}.Proto.Map` 合并进 main 并验证后**可删除**（避免分支堆积）；`{Project}.Proto` 长期保留，下一轮迭代回到 ①。

## 交付校验清单

每次迭代收尾或阶段性暂停前，逐项确认：

- [ ] 三个确认门（A/B/C）均已经用户确认后才执行对应命令
- [ ] **`svn commit` 由用户手动执行，技能未自动提交**（建分支 `svn copy` 经门 A / 门 D 由技能执行）
- [ ] 分支命名合规（main `{Project}` / 原型分支 `{Project}.Proto` / 原型功能分支 `{Project}.Proto.{Feature}`）
- [ ] 每次合并前两边工作副本均已提交到最新，废弃实验代码已清理
- [ ] 同步（门 B）理解正确——是合并 main 进 `.Proto`，非重置
- [ ] 每次合并后冲突标记（`C`）已全部解决
- [ ] **并行场景**：每个原型功能分支合并主干（门 E）前，已先经门 B + 门 F 把含已落地功能的最新 `.Proto` 同步进来、共享脚手架冲突已解决
- [ ] **并行场景**：门 E 合并的选择性正确——只带目标功能，其它功能分支未被带入 main

**发现不合规项时，先修正再继续，不要遗留问题。**
