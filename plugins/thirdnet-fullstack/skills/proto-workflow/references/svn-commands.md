# SVN 命令参考与执行细节

> 何时读：执行 svn 操作（建分支 / 同步 / 合并 / 状态检查）时。
> 参数 `{Project}` / `{repoPrefix}` / `{wcMain}` / `{wcProto}` 在首次建分支时探测确认（见 SKILL.md「迭代参数」），下文命令均以参数指代，不硬编码任何项目名。
> **不自动提交**：本技能执行 `svn info` / `svn status` / `svn copy`（建原型分支门 A / 建原型功能分支门 D）/ `svn merge`（仅改工作副本、可 `svn revert` 回退、不产生仓库版本）；**唯独 `svn commit`（提交）由用户手动执行**——技能给出确切命令、用户手动运行。

## 路径约定

- main（主干）仓库路径：`{repoPrefix}{Project}`（`{repoPrefix}` = 仓库 URL 前缀，`{Project}` = 主干名；如 `^/future/Park`）。
- main 工作副本：`{wcMain}`（如 `e:/SVN/future/Park`）。
- 原型分支仓库路径：`{repoPrefix}{Project}.Proto`（与 main 同级；如 `^/future/Park.Proto`）。
- 原型分支工作副本：`{wcProto}`（如 `e:/SVN/future/Park.Proto`）。
- 原型功能分支仓库路径：`{repoPrefix}{Project}.Proto.{Feature}`（从 `.Proto` 派生；`{Feature}` = 功能名 PascalCase，如 `Alarm`；完整路径如 `^/future/Park.Proto.Alarm`）。
- 原型功能分支工作副本：`{wcProtoFeat}`（如 `e:/SVN/future/Park.Proto.Alarm`）。
- 上述参数由首次建分支前在工作副本 `svn info` 探测、并经 `AskUserQuestion` 确认；换项目时覆盖即可，下文命令无需改动。

## 命令总表

| 用途 | 命令 | 执行方 |
|---|---|---|
| 取 main 最新 revision / 分支信息 | `svn info {repoPrefix}{Project}` | 技能 |
| 检查工作副本状态（未提交改动 / 冲突标记） | `svn status` | 技能 |
| 首次创建原型分支（门 A） | `svn copy {repoPrefix}{Project} {repoPrefix}{Project}.Proto -m "..."` | 技能（门 A 后） |
| 创建原型功能分支（门 D） | `svn copy {repoPrefix}{Project}.Proto {repoPrefix}{Project}.Proto.{Feature} -m "..."` | 技能（门 D 后） |
| 同步 main→Proto（最新 HEAD，门 B） | `svn merge {repoPrefix}{Project}`（在 `{wcProto}` 执行） | 技能（非提交） |
| 同步 main→Proto（指定 revision，门 B） | `svn merge {repoPrefix}{Project}@{r_main}`（在 `{wcProto}` 执行） | 技能（非提交） |
| 合并 Proto→main（门 C，单功能整体合并） | `svn merge {repoPrefix}{Project}.Proto`（在 `{wcMain}` 执行） | 技能（非提交） |
| 合并功能分支→main（门 E，选择性） | `svn merge {repoPrefix}{Project}.Proto.{Feature}`（在 `{wcMain}` 执行） | 技能（非提交） |
| 同步 .Proto→功能分支（门 F，基线回灌） | `svn merge {repoPrefix}{Project}.Proto`（在 `{wcProtoFeat}` 执行） | 技能（非提交） |
| 提交合并 / 改动 | `svn commit -m "..."` | **用户手动**（技能给出） |

> 原型分支**不删除**——长期存在，靠双向 `svn merge` 与 main 同步。原型功能分支合并进 main 并验证后**可删除**。

## 各操作执行细节

### 主干状态检查 + 参数探测（首次建分支前）· 技能执行

```bash
svn info {repoPrefix}{Project}          # 取 main 最新 revision；并从 URL 解析 {Project}/{repoPrefix}/{wcMain}
svn status                               # 在 {wcMain} 执行；有输出则工作副本不干净
```

- `svn status` 无输出 = 干净。有任何改动 → 提示用户先提交或搁置。

### 首次建原型分支（确认门 A 后）· 技能执行

确认门 A 后**技能执行**（`svn copy` 建分支；技术上有一次仓库版本写入，但属你已确认的建分支操作）：

```bash
svn copy {repoPrefix}{Project} {repoPrefix}{Project}.Proto -m "原型分支：首次创建"
```

- 建后技能用 `svn info {repoPrefix}{Project}.Proto` 确认分支已建（只读检查）。
- 之后技能检出原型分支工作副本：`svn co {repoPrefix}{Project}.Proto {wcProto}`。

### 同步 main → .Proto（确认门 B 后）· 技能执行 merge + 用户手动提交

把 main 最新（或指定 revision）合并进原型分支作基线。**技能执行 merge**（非提交），在 `{wcProto}` 执行：

```bash
cd {wcProto}
svn merge {repoPrefix}{Project}            # 合并最新 main（HEAD）
# 或指定 revision：
svn merge {repoPrefix}{Project}@{r_main}   # 合并到 r_main 为止
```

- 同步是**合并 main 的变更进 .Proto**，非把 .Proto 重置成 main 纯净拷贝；故同步前 `.Proto` 应已清理废弃实验代码。
- 合并后查冲突（见下）。
- **不自动提交**——提示用户手动执行：`svn commit -m "sync: 合并 main 进 {Project}.Proto"`。

### 合并 .Proto → main（确认门 C 后）· 技能执行 merge + 用户手动提交

把原型分支合并回主干。**技能执行 merge**（非提交），在 `{wcMain}` 执行：

```bash
cd {wcMain}
svn merge {repoPrefix}{Project}.Proto
```

- 合并前两边工作副本都已提交到最新，且 `.Proto` 废弃实验代码已清理（整体合并会带进 main）。
- 合并后查冲突（见下）。
- **不自动提交**——提示用户手动执行：`svn commit -m "merge: 合并 {Project}.Proto 回 main"`。

### 创建原型功能分支（确认门 D 后）· 技能执行

并行多功能原型时，从 `.Proto` 派生每功能一支的 `{Project}.Proto.{Feature}`。确认门 D 后**技能执行**（`svn copy` 建功能分支；同门 A，属你已确认的建分支操作）：

```bash
svn copy {repoPrefix}{Project}.Proto {repoPrefix}{Project}.Proto.{Feature} -m "原型功能分支：{Feature}"
```

- 建后技能用 `svn info {repoPrefix}{Project}.Proto.{Feature}` 确认分支已建（只读检查）。
- 技能检出功能分支工作副本：`svn co {repoPrefix}{Project}.Proto.{Feature} {wcProtoFeat}`。
- 派生前提：`.Proto` 已先经门 B 同步 main 为新鲜基线。功能分支从此刻的 `.Proto` 派生，承载单个功能的 Mock 原型。

### 合并功能分支 → main（确认门 E 后）· 技能执行 merge + 用户手动提交

把**单个**原型功能分支合并回主干（选择性，只带该功能、其它功能分支不动）。**技能执行 merge**（非提交），在 `{wcMain}` 执行：

```bash
cd {wcMain}
svn merge {repoPrefix}{Project}.Proto.{Feature}
```

- 合并前 `{wcProtoFeat}` 与 `{wcMain}` 两边 `svn status` 已提交到最新；该功能分支上废弃实验代码已清理。
- **合并主干前必须先经门 F 同步基线**（见下），否则与已落地功能的共享脚手架冲突。
- 合并后查冲突（见下）。
- **不自动提交**——提示用户手动执行：`svn commit -m "merge: 合并 {Project}.Proto.{Feature} 回 main"`。

### 同步 .Proto → 功能分支（确认门 F 后）· 技能执行 merge + 用户手动提交

把 `.Proto`（含已落地功能，如已合并进 main 并真实实现的功能 A）合并进活跃功能分支（如功能 B），为其后续合并主干做准备。**技能执行 merge**（非提交），在 `{wcProtoFeat}` 执行：

```bash
cd {wcProtoFeat}
svn merge {repoPrefix}{Project}.Proto
```

- **门 F 前应先经门 B** 让 `.Proto` 把最新 main（含已落地功能的原型 + 真实实现）同步进来——基线要先新鲜，门 F 才能把新鲜基线喂给功能分支。
- **门 F 高发共享脚手架冲突**：`src/router/index.ts` 路由表、`src/api/modules/index.ts` 工厂注册等被多功能同时改动的文件，逐个文件人工解决（本技能不自动改业务代码）。
- 合并后查冲突（见下）。
- **不自动提交**——提示用户手动执行：`svn commit -m "sync: 合并 {Project}.Proto 进 {Project}.Proto.{Feature}"`。

### 冲突检测与处理（双向 merge 后通用）· 技能检测 + 人工解决 + 用户手动提交

```bash
svn status        # 合并后在目标工作副本执行（技能执行）
```

- 关注冲突标记 `C`（`svn status` 第 1 列为 `C` 表示该文件冲突）。
- **预警热点**：`src/api/modules/**/*.ts` 工厂文件——同时 `import` Mock 与 Real，双向合并都高发冲突。（前端工程内 `api/`、`mock/` 默认扁平；仅多端工程如 protohub 例外按端建子目录，热点同上。）
- **页面层** `src/views/` 对 Mock 零依赖，预期不冲突。
- 有冲突 → **暂停**，列出所有 `C` 文件，提示人工解决（不自动改业务代码）。解决后用户手动提交（见对应门 B/C 的 commit 命令）。
- 无冲突 → 提示用户手动提交。

## 提交信息（-m）模板（用户手动提交时使用）

| 场景 | 模板 |
|---|---|
| 首次建原型分支 | `原型分支：首次创建` |
| 创建原型功能分支 | `原型功能分支：{Feature}` |
| 同步 main→Proto | `sync: 合并 main 进 {Project}.Proto` |
| 合并 Proto→main | `merge: 合并 {Project}.Proto 回 main` |
| 合并功能分支→main | `merge: 合并 {Project}.Proto.{Feature} 回 main` |
| 同步 .Proto→功能分支 | `sync: 合并 {Project}.Proto 进 {Project}.Proto.{Feature}` |

## DB schema 风险

- 原型阶段一般不动数据库。
- 合并回 main 后真实实现若改 schema，警惕与 main 的数据库冲突。
- 涉及中断性 schema 变更 → **提示联系运维还原测试库**，本技能不自动处理。
