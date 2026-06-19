# 后端模板升级流程（thirdnet-migrate）

> **适用对象**：用 `dotnet new thirdnet-admin` 创建的 Admin 后端项目（4 子项目：APIService / Database / Common / Cache），或 `dotnet new thirdnet-service` 创建的微服务（2 子项目：API / Database）。
>
> 本文件只讲**后端专属**的命令、状态分类与判定。共享的安全铁律、`check→diff→apply` 心智模型、回滚预案见 [SKILL.md](../SKILL.md)；冲突决策见 [conflict-resolution](conflict-resolution.md)，边界情况见 [edge-cases](edge-cases.md)。

`ThirdNet.Migrate` 是随模板提供的**模板升级 CLI（命令名 `thirdnet-migrate`，≥ 0.0.23）**。注意它**不是数据库迁移工具**（数据库迁移是 `dotnet ef`，与本文无关）——作用是让已生成的项目跟进模板的新版本，避免模板修复 bug、改进结构后旧项目无法同步。本流程对应 **工具 ≥ 0.0.23、模板 ≥ 0.0.24**。

> 若执行中发现工具行为与本文件不符，以工具源码为准（位于内部模板仓库 `code/backend/Template/ThirdNet.Migrate/`；发布 marketplace 不含 `code/` 目录，故该路径不可从已安装技能解析），并反馈修订。

## 后端文件 6 态分类

工具把每个模板下发文件分到以下状态之一（由「用户是否改过 × 模板是否改过」两个信号决定）。读懂这张表是正确决策的前提：

| 状态 | 图标 | 含义 | apply 默认行为 |
|------|------|------|----------------|
| `Unchanged` | — | 用户文件 == 新模板 | 跳过 |
| `Added` | 📄 | 新模板有、项目无 | 交互式 apply 逐个 `[y/N]` 确认（默认 N）；仅 `--force`/`--non-interactive` 自动添加 |
| `Deleted` | 🗑️ | 旧基线/清单有、新模板已移除、用户仍保留 | **仅提示，永不删** |
| `UpstreamOnly` | 🔄 | 用户没改 + 模板改了 | **自动套用**（安全） |
| `UserOnly` | 🔒 | 用户改了 + 模板没改 | **保留**（你的定制） |
| `Conflict` | ⚠️ | 用户改了 + 模板也改了 | **逐个给建议、交你决定** |

> 此外：项目里既不在新模板、也不在旧基线/清单中的文件 = **用户业务代码**（业务 Controller / 实体 / EntityConfiguration / 业务 DbContext / Service / DTO 等），工具完全忽略，计入 `N 个用户自定义文件未参与对比`。

## 两种识别模式

| 模式 | 触发条件 | 识别「用户是否改过」的方式 | 说明 |
|------|----------|---------------------------|------|
| **清单模式** | 项目根有 `.template-manifest.json` | 比对当前磁盘文件哈希 vs 清单哈希（**离线可靠，推荐**） | 哈希算在 `sourceName`+占位符替换后的内容上，命名空间差异不会误报 |
| **基线模式** | 无清单，但标记版本号有效 | 下载旧版本 nupkg 作基线，3-way 比对 | 需服务器保留旧包；旧包缺失则降级 2-way（每处差异都当用户改过，需更多人工判断） |

> **后端版本标记字段**：`.template-version.json` 仅 3 字段——`templateIdentity` / `templateVersion` / `sourceName`（前端那种 `tokens` / `overrideFiles` 后端没有）。

## 升级主流程（Phase 0–5）

> 以下为**在线、主流程**。离线变体见 [edge-cases](edge-cases.md)。所有命令在**解决方案根目录**（含 `.template-version.json` 的目录）执行，或用 `-p <路径>` 指定。

### Phase 0：预检（执行升级前逐项确认）

**0.1 工具版本**
```bash
dotnet tool list -g | grep -i thirdnet
# 期望：ThirdNet.Migrate 版本 ≥ 0.0.23
```
若未装或版本过低：
```bash
dotnet tool install -g ThirdNet.Migrate --add-source http://192.168.1.156:8088/nuget
# 或更新：
dotnet tool update  -g ThirdNet.Migrate --add-source http://192.168.1.156:8088/nuget
```

**0.2 NuGet 服务器与最新版本**
```bash
dotnet package search ThirdNet.Admin.Template    --source http://192.168.1.156:8088/nuget   # Admin
dotnet package search ThirdNet.Service.Template  --source http://192.168.1.156:8088/nuget   # Service
```
记录服务器最新版本号 `LATEST`。**若 `LATEST` < 你要升级到的版本，说明模板新改动尚未发布 —— 停止，先回 ThirdNet.AI 仓库发版。** 未发布的改动无法迁移，强行升级只会拿到旧模板。

> 内网/凭证：NuGet 源 `http://192.168.1.156:8088/nuget`，user `admin` / key `swkj_20170505`。内网不可达时改用外网 `http://61.164.57.61:8088/nuget`（`thirdnet-migrate` 自身也支持 `-s, --source <url>` 切换源，如 `thirdnet-migrate check -s http://61.164.57.61:8088/nuget`）。

> **预发布版本会被过滤**：工具查询最新版时自动排除预发布包（`-beta`/`-rc` 等）。若模板只发了预发布版，`check`/`diff` 拿不到，必须用 `--nupkg` 离线比对。

> **发版流程**（仅在需发版时）：见内部仓库 `code/backend/plan.md` 第 8 章「发布与打包」——按依赖顺序 `dotnet pack` 4 个包（Vibe.Common / Vibe.WebAPI / Admin.Template / Service.Template）到 `./artifacts`，中央版本号在 `backend/Directory.Build.props` 的 `ThirdNetPackageVersion`，遵循 semver。

**0.3 Git 工作区必须干净**
```bash
git status --porcelain   # 必须为空
```
若有未提交改动：先 `commit` 或 `stash`。**这是最可靠的回滚保险**（升级出问题可直接 `git reset --hard <升级前 commit>`）。

**0.4 网络判定（决定走在线还是离线流程）**
- 能访问 `http://192.168.1.156:8088/nuget` → **在线流程**（下文 Phase 1–5）。
- 不能访问（内网隔离 / 服务器宕机）→ **离线流程**（用 `--nupkg` 提供本地模板包，见 [edge-cases](edge-cases.md)）。注意 `check` 始终要查服务器，完全离线时 `check` 必失败——直接跳到 `diff --nupkg`。

**0.5 读 changelog（决定冲突取舍前）**
阅读本次版本范围的 changelog：后端在内部仓库 `code/backend/changelog.md`（遵循 semver，含 Security / Fixed / Changed 分类）。它解释"为什么改、是否破坏性、是否跨端"，直接指导 Phase 3 的 `[a]/[k]/[m]` 取舍。**注意：该 changelog 不随 nupkg 发布，已安装环境下拿不到，需从模板仓库获取。**

### Phase 1：探测项目（check）

```bash
thirdnet-migrate check
# 或 thirdnet-migrate check -p /path/to/solution-root
```

读懂输出，判定**属于哪种场景**（决定后续走法）：

| `check` 报告 | 场景 | 后续 |
|--------------|------|------|
| `当前已是最新版本` | 已是最新 | **结束**，无需升级 |
| `哈希清单: 已启用` | 新机制项目 | 走 Phase 2（清单模式 diff） |
| `哈希清单: 未启用` + 当前版本合理 | 旧项目、标记有效 | 走 Phase 2（基线模式 diff，**不要先 init-manifest**） |
| `哈希清单: 未启用` + 当前版本可疑/`未知` | 旧项目、标记丢失或过期 | 先走 [edge-cases](edge-cases.md) 的「旧项目无清单/标记过期」处理，再 Phase 2 |
| `清单版本(X)与标记版本(Y)不一致` | 漂移 | 走 [edge-cases](edge-cases.md) 的「版本漂移」处理 |

> **注意**：`check` 始终会查询 NuGet 服务器取最新版本。完全离线时 `check` 会报连接失败——此时跳过 `check`，直接用 `diff --nupkg`（见 edge-cases）。

### Phase 2：预览差异（diff，只读）

```bash
thirdnet-migrate diff
# 或指定目标版本：
thirdnet-migrate diff -v <LATEST>
```

> `-v` 可指定**任意已发布版本**，不限于最新——可用于降级或钉版到某个版本。降级时大量文件会归入 `Conflict`（用户改了、模板"回退"也视为改了），需更多人工取舍。

**必须完整阅读 diff 输出**，尤其：
- 📄 `新增文件` 列表（通常安全，但留意是否与用户业务文件重名）。
- 🔄 `可安全更新`（UpstreamOnly）—— 将自动套用。
- 🔒 `你的定制`（UserOnly）—— 将保留，确认无误。
- ⚠️ **`冲突`（Conflict）** —— **逐一记录相对路径**，进入 Phase 3 的逐文件决策。
- 🗑️ `模板已删除` —— 仅提示，不动。

> 若 `diff` 报 `无法下载基线版本，将使用清单/2-way 模式`：说明旧版本 nupkg 不在服务器，已自动降级。此时所有差异都会偏向 `Conflict/UserOnly`（保守）。若项目本就是旧项目且无清单，建议改走 edge-cases 的 `init-manifest` 流程以获得更清晰基线。

### Phase 3：应用升级（apply）

**先 dry-run（不写盘）**：
```bash
thirdnet-migrate apply --dry-run
```
确认将要发生的改动符合预期。

**正式 apply（交互式，推荐）**：
```bash
thirdnet-migrate apply
```
工具会对每个 ⚠️ `Conflict` 文件：
1. 打印状态 + **建议动作**（如「套用模板版」/「手动编辑(冲突标记)」+ 原因）。
2. 给出预览 diff（你的版本 → 新模板，前 30 行）。
3. 等待选择：
   - `[a]` 套用模板版
   - `[k]` 保留我的版本（业务定制选这个）
   - `[m]` 写冲突标记文件（复杂冲突，随后手动合并）
   - `[v]` 查看完整 diff（含上游变更 baseline→new，信息不足时先看）
   - `[e]` 稍后决定（跳过，不更新该文件清单哈希）

**代为决策时**：严格遵循 [conflict-resolution](conflict-resolution.md) 选择 `[a]`/`[k]`/`[m]`，并在最终报告里记录每个决策与理由。

**CI / 全自动场景**：
```bash
thirdnet-migrate apply --non-interactive
# 行为：📄 Added 自动添加、🔄 UpstreamOnly 套用、🔒 UserOnly 保留、⚠️ Conflict 保留并报告。
# 退出码：0=全部成功；2=存在未决 Conflict（CI 应据此失败）。
```

> **`--force` 是全局开关**：一旦带上，**所有** ⚠️ `Conflict` 文件无差别套用模板版（不能选择性 force 某几个）。仅限确信全部冲突都是纯框架文件时使用，业务文件上用 `--force` = 覆盖丢失。

### Phase 4：验证

```bash
dotnet restore
dotnet build        # 必须通过，0 error
```
若编译失败：通常是 Phase 3 合并 `Conflict` 文件引入的问题（如 `Startup.cs` 漏注册、类型不匹配）。回到该文件用 `[m]` 生成的冲突标记文件重新合并（合并规范见 conflict-resolution）。

> **加深验证（推荐）**：若本次升级触碰了 `Authentication/`、`Authorization/`、`Startup.cs`、`SeedData.cs`、`*DbContext`，`dotnet build` 通过后**加跑后端单元测试**——签名/权限/路由的回归编译期发现不了（changelog 里每次修复通常都带新增测试，可直接复用）。

再次确认状态：
```bash
thirdnet-migrate check
# 期望：当前已是最新版本；哈希清单已启用；无漂移告警。
```

### Phase 5：收尾

1. 审阅改动：`git status` + `git diff`。
2. 确认 `.template-manifest.json` 已生成/更新、`.template-version.json` 已前进到新版本。
3. **提交**（消息建议：`chore: 升级 ThirdNet 模板至 <新版本>`）。
4. 按 [commands-and-report](commands-and-report.md) 的格式输出升级报告。

## 框架库版本同步（仅当模板升级了 Vibe.Common/WebAPI 时）

若本次模板更新包含了 `ThirdNet.Vibe.Common` / `ThirdNet.Vibe.WebAPI` 的新版本，业务项目里通过 `PackageReference` 引用框架库的 `.csproj` 可能需要同步版本，否则 `dotnet restore` 失败：

```bash
# 在引用框架库的项目目录里
dotnet add package ThirdNet.Vibe.WebAPI -v <新版本> --source http://192.168.1.156:8088/nuget
dotnet add package ThirdNet.Vibe.Common -v <新版本> --source http://192.168.1.156:8088/nuget
```
> 升级目标版本号见 `.template-manifest.json` 的 `context.symbols`（`VIBE_COMMON_VERSION` / `VIBE_WEBAPI_VERSION`）。

## 退出码速查（后端）

| 退出码 | 含义 |
|--------|------|
| `0` | 成功 / 已是最新 / 无差异（`check`、`diff`、`apply`、`init-manifest`、`help` 正常均返回 0） |
| `1` | 错误：NuGet 连接失败 / 查不到版本 / `prepare` 失败（项目无法识别）/ 未知命令 |
| `2` | **仅 `apply`**：apply 已完成，但仍有未决 `Conflict`（CI 应据此失败） |

> **`diff` 即使有冲突也返回 0**——diff 是只读预览，不把"有冲突"当错误。只有 `apply` 用退出码 2 表示"有未决冲突"。

## 后端执行 Checklist

按顺序逐项确认，全部通过方可继续下一步：

- [ ] Phase 0.1 工具 ≥ 0.0.23 已装
- [ ] Phase 0.2 服务器最新版本 ≥ 目标版本（否则先发版）
- [ ] Phase 0.3 `git status` 干净
- [ ] Phase 0.4 确定在线 / 离线
- [ ] Phase 0.5 读 changelog（了解"为什么改"，指导冲突取舍）
- [ ] Phase 1 `check`，判定场景（清单/基线/旧项目）
- [ ] Phase 2 `diff`，读完所有 ⚠️ Conflict
- [ ] Phase 3 `apply --dry-run` → `apply`（Conflict 按 conflict-resolution 决策）
- [ ] Phase 4 `dotnet build` 通过；`check` 报「已是最新」（触碰认证/权限/SeedData 时加跑单测）
- [ ] Phase 5 `git` 审阅 + 提交
- [ ] 输出升级报告（commands-and-report.md 格式）
