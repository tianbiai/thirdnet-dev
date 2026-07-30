# SVN 命令参考与执行细节

> 何时读：执行 svn 操作（建分支 / 合并 / 提交 / 删分支 / 状态检查）时。
> 参数 `{Project}` / `{repoPrefix}` / `{wcTrunk}` 在创建分支时探测确认（见 SKILL.md「迭代参数」），下文命令均以参数指代，不硬编码任何项目名。

## 路径约定

- 主干仓库路径：`{repoPrefix}{Project}`（`{repoPrefix}` = 仓库 URL 前缀，`{Project}` = 主干名；如 `^/future/Park`）。
- 主干工作副本：`{wcTrunk}`（本地检出目录，如 `e:/SVN/future/Park`）。
- 上述三值由创建分支前在工作副本 `svn info` 探测、并经 `AskUserQuestion` 确认；换项目时覆盖即可，下文命令无需改动。

## 命令总表

| 用途 | 命令 |
|---|---|
| 取主干最新 revision / 分支信息 | `svn info {repoPrefix}{Project}` |
| 检查工作副本状态（未提交改动 / 冲突标记） | `svn status` |
| 创建原型分支 | `svn copy {repoPrefix}{Project} {repoPrefix}{Project}-PT{r} -m "..."` |
| 创建 Bug 分支（基于历史 revision） | `svn copy {repoPrefix}{Project}@{r} {repoPrefix}{Project}-BF{r} -m "..."` |
| 整体合并分支到主干 | `svn merge {repoPrefix}{Project}-PT{r}`（在主干工作副本执行） |
| 提交合并 / 改动 | `svn commit -m "..."` |
| 删除用毕分支 | `svn delete {repoPrefix}{Project}-PT{r} -m "..."` |

## 各操作执行细节

### 主干状态检查（创建分支前）

```bash
svn info {repoPrefix}{Project}   # 取 Last Changed Rev 作为 r_base
svn status                       # 在 {wcTrunk} 执行；有输出则工作副本不干净
```

- `svn status` 无输出 = 工作副本干净。有任何改动 → 提示用户先提交或搁置，**不强行建分支**。

### 创建原型分支（确认门 A 后）

```bash
svn copy {repoPrefix}{Project} {repoPrefix}{Project}-PT{r_base} -m "原型分支：迭代N 基于 r{base}"
```

- `svn copy` 为廉价拷贝（cheap copy），服务端仅记录差异，开销极低。
- 分支与主干同级（均在 `{repoPrefix}` 下），命名 `{Project}-PT{r_base}`。

### 合并回主干（确认门 B 后）

```bash
cd {wcTrunk}
svn merge {repoPrefix}{Project}-PT{r_base}
```

- **整体合并**（不 cherry-pick），SVN 自动记录 mergeinfo。
- 合并前**两边工作副本都必须提交到最新**，且**废弃实验代码已清理**（见合并预检）。

#### 合并预检

```bash
# 主干工作副本
cd {wcTrunk} && svn status      # 应无输出
# 原型分支工作副本（若独立检出，路径按实际位置；常见约定为 {wcTrunk} 同级加 -PT{r_base} 后缀）
cd <原型分支工作副本> && svn status   # 应无输出
```

任一边有未提交改动 → 提示先提交，再合并。

#### 冲突检测与处理

```bash
svn status        # 合并后在主干工作副本执行
```

- 关注冲突标记 `C`（conflict）。`svn status` 第 1 列为 `C` 表示该文件冲突。
- **预警热点**：`src/api/modules/**/*.ts`（或本项目按端/模块分的 `app/`、`manager/` 等子目录）工厂文件——同时 `import` Mock 与 Real，是合并高发冲突点。
- **页面层** `src/views/` 对 Mock 零依赖，预期不冲突。
- 有冲突 → **暂停**，列出所有 `C` 文件，提示人工解决（不自动改业务代码）。解决后用户回复继续 → 提交。
- 无冲突 → 直接提交。

### 提交合并 / 改动

```bash
svn commit -m "merge: 合并原型分支 {Project}-PT{r_base} 到主干"
```

### 删除分支（确认门 C 后）

```bash
svn delete {repoPrefix}{Project}-PT{r_base} -m "迭代N 原型分支用毕删除"
```

## Bug 分支（BF）命令

```bash
# 基于 r_bf 创建 BF 分支（@{r_bf} 为历史版本 peg revision）
svn copy {repoPrefix}{Project}@{r_bf} {repoPrefix}{Project}-BF{r_bf} -m "Bug 分支：基于 r{bf}"

# 在主干合并 BF 分支
cd {wcTrunk} && svn merge {repoPrefix}{Project}-BF{r_bf}

# 删除用毕 BF 分支
svn delete {repoPrefix}{Project}-BF{r_bf} -m "Bug 分支用毕删除"
```

> BF 创建用 `@{r_bf}` peg revision 定位历史版本（基于已发布的正式版 revision），原型分支创建用主干当前 HEAD，二者区别在此。

## 提交信息（-m）模板

| 场景 | 模板 |
|---|---|
| 建原型分支 | `原型分支：迭代N 基于 r{base}` |
| 建 Bug 分支 | `Bug 分支：基于 r{bf}` |
| 合并提交 | `merge: 合并原型分支 {Project}-PT{r_base} 到主干` |
| 删原型分支 | `迭代N 原型分支用毕删除` |
| 删 BF 分支 | `Bug 分支用毕删除` |

## DB schema 风险

- 原型阶段一般不动数据库。
- BF 分支修 bug 若改 schema，警惕与主干的数据库冲突。
- 涉及中断性 schema 变更 → **提示联系运维还原测试库**，本技能不自动处理。
