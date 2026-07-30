# SVN 命令参考与执行细节

> 何时读：执行 svn 操作（建分支 / 合并 / 提交 / 删分支 / 状态检查）时。
> 权威源：《代码发布管理-原型驱动流程.md》§3 / §4 / §8。该文档已逐条对齐《代码发布管理.docx》既有约定（同级目录、`{revision}` 命名、`svn copy` 创建、合并前两边提交最新、分支用毕删除）。

## 路径约定

- 主干仓库路径：`^/future/Park`（`^` = 仓库根，`/future/` 为主干所在目录）。
- 主干工作副本：`e:/SVN/future/Park`。
- 阶段 0 用 `AskUserQuestion` 确认这三个值（主干名 / 工作副本目录 / 仓库前缀），默认即上述值，换项目可覆盖。下文示例以默认值为准。

## 命令总表

| 用途 | 命令 |
|---|---|
| 取主干最新 revision / 分支信息 | `svn info ^/future/Park` |
| 检查工作副本状态（未提交改动 / 冲突标记） | `svn status` |
| 创建原型分支 | `svn copy ^/future/Park ^/future/Park-PT{r} -m "..."` |
| 创建 Bug 分支（基于历史 revision） | `svn copy ^/future/Park@{r} ^/future/Park-BF{r} -m "..."` |
| 整体合并分支到主干 | `svn merge ^/future/Park-PT{r}`（在主干工作副本执行） |
| 提交合并 / 改动 | `svn commit -m "..."` |
| 删除用毕分支 | `svn delete ^/future/Park-PT{r} -m "..."` |

## 各阶段执行细节

### 阶段 0 ｜ 取主干 revision + 工作副本干净度

```bash
svn info ^/future/Park          # 取 Last Changed Rev 作为 r_base
svn status                       # 在 e:/SVN/future/Park 执行；有输出则工作副本不干净
```

- `svn status` 无输出 = 工作副本干净。有任何改动 → 提示用户先提交或搁置，**不强行建分支**。

### 阶段 1 ｜ 创建原型分支（确认门 A 后）

```bash
svn copy ^/future/Park ^/future/Park-PT{r_base} -m "原型分支：迭代N 基于 r{base}"
```

- `svn copy` 为廉价拷贝（cheap copy），服务端仅记录差异，开销极低。
- 分支与主干同级（均在 `^/future/` 下），命名 `Park-PT{r_base}`。

### 阶段 2 ｜ 整体合并（确认门 C 后）

```bash
cd e:/SVN/future/Park
svn merge ^/future/Park-PT{r_base}
```

- **整体合并**（不 cherry-pick），SVN 自动记录 mergeinfo。
- 合并前**两边工作副本都必须提交到最新**（见合并预检）。

#### 合并预检

```bash
# 主干工作副本
cd e:/SVN/future/Park && svn status      # 应无输出
# 原型分支工作副本（若有独立检出）
cd e:/SVN/future/Park-PT{r_base} && svn status   # 应无输出
```

任一边有未提交改动 → 提示先提交，再合并。

#### 冲突检测与处理

```bash
svn status        # 合并后在主干工作副本执行
```

- 关注冲突标记 `C`（conflict）。`svn status` 第 1 列为 `C` 表示该文件冲突。
- **预警热点**：`frontend/web/src/api/modules/manager/*.ts`（或 `app/`）工厂文件——同时 `import` Mock 与 Real，是合并高发冲突点。
- **页面层** `src/views/` 对 Mock 零依赖，预期不冲突。
- 有冲突 → **暂停**，列出所有 `C` 文件，提示人工解决（不自动改业务代码）。解决后用户回复继续 → 提交。
- 无冲突 → 直接提交。

### 提交合并 / 改动

```bash
svn commit -m "merge: 合并原型分支 Park-PT{r_base} 到主干"
```

### 阶段 5 ｜ 删除原型分支（确认门 D 后）

```bash
svn delete ^/future/Park-PT{r_base} -m "迭代N 原型分支用毕删除"
```

## Bug 分支（BF）命令

```bash
# 基于 r_bf 创建 BF 分支（@{r_bf} 为历史版本 peg revision）
svn copy ^/future/Park@{r_bf} ^/future/Park-BF{r_bf} -m "Bug 分支：基于 r{bf}"

# 在主干合并 BF 分支
cd e:/SVN/future/Park && svn merge ^/future/Park-BF{r_bf}

# 删除用毕 BF 分支
svn delete ^/future/Park-BF{r_bf} -m "Bug 分支用毕删除"
```

> BF 创建用 `@{r_bf}` peg revision 定位历史版本（基于已发布的正式版 revision），原型分支创建用主干当前 HEAD，二者区别在此。

## 提交信息（-m）模板

| 场景 | 模板 |
|---|---|
| 建原型分支 | `原型分支：迭代N 基于 r{base}` |
| 建 Bug 分支 | `Bug 分支：基于 r{bf}` |
| 合并提交 | `merge: 合并原型分支 Park-PT{r_base} 到主干` |
| 删原型分支 | `迭代N 原型分支用毕删除` |
| 删 BF 分支 | `Bug 分支用毕删除` |

## DB schema 风险

- 原型阶段一般不动数据库。
- 真实实现阶段若改 schema，警惕与并行 BF 分支的数据库冲突。
- 涉及中断性 schema 变更 → **提示联系运维还原测试库**，本技能不自动处理（源文档 §8.4）。
