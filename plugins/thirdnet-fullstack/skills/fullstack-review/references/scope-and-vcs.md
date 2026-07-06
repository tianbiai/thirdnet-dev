# 审查范围与 VCS 识别（scope-and-vcs）

> 本文件说明 fullstack-review 技能如何确定「审什么」：VCS 检测、三种范围模式、从路径推断模块、聚合到模块产物。目标项目通常基于 **SVN**；git 作为兜底。

---

## 一、VCS 检测

在被审项目根（或当前 cwd）判断版本控制系统：

```
if 存在 .svn 目录或 svn info 可成功执行 → SVN 模式
elif 存在 .git 目录 → git 模式
else → 无 VCS，全项目扫描 backend/ + frontend/src/
```

- **SVN**：检查 `.svn/`（工作副本根有，子目录也有）；或运行 `svn info` 看是否返回仓库信息。
- **git**：检查 `.git/`。
- 若 `svn`/`git` 不在 PATH，降级为「全项目扫描」并在报告中注明「未做 VCS 范围识别，按全项目扫描」。

> 注意：本插件仓库（`thirdnet-dev`）本身是 git；但用户实际开发的目标项目（含 `backend/` + `frontend/`）多基于 SVN。检测以**被审项目**为准，不要假设。

---

## 二、三种范围模式

### 模式 1：未提交内容（默认，最贴合「刚写完」）

**SVN**：
- `svn status` —— 列出改动文件（A 新增 / M 修改 / D 删除 / ! 缺失 / ? 未纳管 / C 冲突）
- `svn diff` —— 查看修改内容（用于业务正确性 / 安全审查）
- `svn diff --summarize` —— 仅文件清单（大改动时先拿清单）

**git**：
- `git status --porcelain` —— 改动文件清单
- `git diff` —— 未暂存改动
- `git diff --cached` —— 已暂存改动

> 关注 `A`/`M`/`C`（新增/修改/冲突）；`?`（未纳管）按需纳入（可能是新模块未 `svn add`）。冲突 `C` 必报 Critical。

### 模式 2：最近一段时间的提交

**SVN**：
- 按次数：`svn log -l N --verbose` —— 最近 N 次提交及其涉及文件
- 按版本范围：`svn diff -r BASE:HEAD` —— 本地副本基线到最新（更新带来的差异）
- 按日期：`svn diff -r {YYYY-MM-DD}:HEAD` —— 某日期至今（如 `{2026-07-01}:HEAD`）
- 看历史：`svn log -v -r REV1:REV2` —— 区间提交明细

**git**：
- `git log --oneline -N` —— 最近 N 次提交
- `git diff branch...HEAD` —— 某分支至今
- `git diff --since="YYYY-MM-DD"` 或 `git log --since=...`

> 用户说「最近一周的改动」→ SVN `svn diff -r {一周前日期}:HEAD`；说「最近 5 次提交」→ `svn log -l 5 --verbose`。

### 模式 3：整个项目

无 VCS 过滤，递归扫描：
- 后端：`backend/**/*.cs`（排除 `bin/`、`obj/`、`Migrations/*.Designer.cs`、`*ModelSnapshot.cs`）
- 前端：`frontend/**/src/**/*.{vue,ts,tsx}`（排除 `node_modules/`、`dist/`）

> 全项目审查耗时长、噪声多，适合定期体检；单次功能验收优先用模式 1/2。

### 模式 4：显式覆盖

用户直接给模块名或路径：
- 模块名（如 `notice`）→ 据下文「模块推断」定位该模块全部产物
- 路径列表 → 以这些路径为审查对象，并推断所属模块补全产物

---

## 三、模块推断（从文件路径反推 {module} / {Entity}）

把「受影响文件」聚合到「受影响模块」，再定位该模块的完整产物。

### 路径模式 → 模块/实体

| 文件路径模式 | 模块 | 实体（PascalCase） |
|--------------|------|--------------------|
| `frontend/.../src/views/{module}/index.vue` | `{module}` | 首字母大写 `{Module}` |
| `frontend/.../src/api/types/{module}.ts` | `{module}` | `{Module}` |
| `frontend/.../src/api/interfaces/manager/{module}.ts` | `{module}` | `{Module}` |
| `frontend/.../src/api/modules/manager/{module}.ts` | `{module}` | `{Module}` |
| `frontend/.../src/mock/{api,data}/manager/{module}.ts` | `{module}` | `{Module}` |
| `backend/.../Controllers/Manager/{Entity}ManagerController.cs` | 小写 `{entity}` | `{Entity}` |
| `backend/.../Models/{Entity}Model.cs` | 小写 `{entity}` | `{Entity}` |
| `backend/.../EntityConfigurations/{Entity}Configuration.cs` | 小写 `{entity}` | `{Entity}` |
| `backend/.../DTOs/{Entity}*/...Map.cs` | 小写 `{entity}` | `{Entity}` |
| `backend/.../Services/{Entity}Service.cs` | 小写 `{entity}` | `{Entity}` |

### 实体名转换

- `NoticeManagerController` → 实体 `Notice` → 模块 `notice`
- `SysUserModel` → 实体 `SysUser`（注意 `Sys` 前缀——见下文）
- `OnlineUser` → 模块 `online-user`（kebab）

> **`Sys` 前缀例外**：多数实体无 `Sys` 前缀（`Notice`、`Order`），仅部分系统模块带（`SysUser`、`SysRole`、`SysConfig`）。读实际类名，不要假设增删前缀。

### 聚合到模块产物

确定受影响模块 `{module}` / `{Entity}` 后，定位其完整产物一并审查：

**前端 5 类契约 + 页面**：
- `api/types/{module}.ts`
- `api/interfaces/manager/{module}.ts`
- `mock/data/manager/{module}.ts`
- `mock/api/manager/{module}.ts`
- `api/modules/manager/{module}.ts`
- `src/views/{module}/index.vue`（及该目录下其他组件）

**后端 8 件套**：
- `Models/{Entity}Model.cs` + `EntityConfigurations/{Entity}Configuration.cs`
- `DTOs/` 下的 `{Entity}*Map.cs`（Query/Create/Update/Item/Detail）
- `Services/{Entity}Service.cs`
- `Controllers/{Manager,App,Third}/{Entity}*Controller.cs`
- 权限注解（`[PermissionAuthorize("...:{entity}:...")]`）
- `Startup.cs` 中 `{Entity}Service` 的 DI 注册（第 9 步）
- 菜单数据（`t_sys_menu` 中该模块的目录/页面/按钮条目，若可查）

> 若某产物缺失（如改了 Controller 却无对应 DTO），本身即一个 finding（维度 A 或 C）。

---

## 四、Windows / bash 注意事项

- **路径分隔**：Windows 路径用反斜杠，bash（Git Bash）用正斜杠；`svn`/`git` 命令的路径参数用正斜杠更稳。
- **中文路径**：SVN/git 一般兼容，但 shell 转义需注意（引号包裹含空格/中文的路径）。
- **svn 是否在 PATH**：Windows 上 SVN 需安装 TortoiseSVN 命令行工具或 CollabNet/Slik；若 `svn` 不可用，提示用户或降级全扫描。
- **超长 diff**：`svn diff`/`git diff` 可能极长，先 `--summarize`/`--stat` 拿文件清单，再按需取单文件 diff（`svn diff path/to/file` / `git diff -- file`）。
- **大仓库性能**：全项目扫描前先 `find`/`glob` 限定 `backend/**/*.cs` 与 `frontend/**/src/**`，排除 `bin/obj/node_modules/dist`。

---

## 五、范围确定后的输出

确定范围后，先在对话中简述（让用户确认或调整）：

```
审查范围：
- VCS：SVN（未提交）
- 受影响模块：notice（后端 6 文件 + 前端 5 文件）、order（后端 3 文件）
- 模式：未提交内容（svn status + svn diff）
- 运行时校验：将跑 dotnet build + vue-tsc
是否继续？或指定其他范围。
```

然后进入 [SKILL.md「审查执行流程」](../SKILL.md) 第 2 步（加载规范）。
