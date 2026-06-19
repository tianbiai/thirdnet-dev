---
name: thirdnet-template-upgrade
description: >
  ThirdNet 后端模板升级操作指南——用 thirdnet-migrate CLI 把已生成的 ThirdNet 后端项目
  (admin/service) 升级到最新模板版本。覆盖预检、check/diff/apply 五阶段主流程、文件 6 态分类、
  冲突文件逐个决策、清单/基线双模式、离线流程、版本漂移处理、回滚预案与禁止事项。
  当用户提到"模板升级"、"模板迁移"、"升级模板"、"跟进模板"、"同步模板"、"模板更新"、
  "thirdnet-migrate"、"upgrade template"、"template-migrate"、".template-version.json"、
  ".template-manifest.json" 时，必须使用此技能；即便用户只说"项目模板是不是该更新了"、
  "怎么同步最新模板改动"、"把旧项目跟到新模板"也要触发。
metadata:
  version: "0.1.0"
---

# ThirdNet 后端模板升级（thirdnet-migrate 操作指南）

本技能指导你在**任意一个已用 ThirdNet 后端模板创建的旧项目**上执行模板升级。`ThirdNet.Migrate` 是随模板提供的**模板升级 CLI（命令名 `thirdnet-migrate`，≥ 0.0.23）**，它不是数据库迁移工具，作用是让已生成的项目跟进模板的新版本——避免模板修复了 bug 或改进结构后，旧项目无法同步。

> 本技能对应 **工具 ≥ 0.0.23、模板 ≥ 0.0.24**，是模板升级流程的**单一事实来源**（聚焦后端、更严格、为逐条执行而写）。前端项目升级不在本技能范围。
>
> 若执行中发现工具行为与本技能不符，以工具源码为准（位于内部模板仓库 `code/backend/Template/ThirdNet.Migrate/`；发布 marketplace 不含 `code/` 目录，故该路径不可从已安装技能解析），并反馈修订本技能。

## 适用范围

- ✅ 用 `dotnet new thirdnet-admin` 创建的 Admin 后端项目（4 子项目：APIService / Database / Common / Cache）。
- ✅ 用 `dotnet new thirdnet-service` 创建的微服务项目（2 子项目：API / Database）。
- ❌ 前端项目（`create-thirdnet-admin`）—— 不在本技能范围。
- ❌ 非 ThirdNet 模板创建的项目。

## 安全铁律（SAFETY INVARIANTS —— 任何情况下不得违反）

这些是不可妥协的硬约束。违反即视为升级失败，必须回滚。理解它们存在的原因：模板升级最怕的是**误删/误覆盖用户的业务代码**，而这些规则把"不可逆的破坏"全部堵死。

1. **绝不覆盖用户业务代码。** 任何被分类为 🔒 `UserOnly`（用户改过、模板未动）或既不在新模板也不在旧基线清单里的文件（业务 Controller / 实体 / EntityConfiguration / 业务 DbContext / Service / DTO 等），**一律保留**，绝不套用模板版。业务代码是用户最宝贵的资产，模板升级只动框架结构。
2. **绝不自动删除用户文件。** 即便模板删除了某文件（🗑️ `Deleted`），apply 也只提示、永不删。**不得手动删除任何用户文件。** 模板删某个文件可能只是因为重构，但用户项目里那文件可能仍承载业务——删了找不回。
3. **冲突文件必须逐个决定**，不得用 `--force` 批量覆盖业务相关改动。`--force` 仅允许用于确认为「纯框架基础设施、无业务逻辑」的文件。`--force` 绕过逐个确认，等于盲覆盖，对业务文件是灾难。
4. **每次覆盖既有文件前，工具会自动备份到 `.thirdnet-backup/<时间戳>/`**；但更可靠的保险是**升级前 git 工作区干净**（见 Phase 0）。备份是第二道防线，git 才是第一道。
5. **升级全程不手动编辑 `ThirdNetVibe` 命名空间引用。** 工具会在比对前自动完成 `sourceName`（`ThirdNetVibe`→项目前缀）+ 版本占位符（`VIBE_COMMON_VERSION` 等）替换。手动改这些会制造伪冲突，让干净的 UpstreamOnly 变成假 Conflict。
6. **升级目标版本必须已发布到 NuGet 服务器**（或以 `--nupkg` 提供本地包）。未发布的模板改动无法迁移。

完整的禁止事项清单见 [rollback-and-do-not](references/rollback-and-do-not.md)。

## 核心概念（读懂工具输出必备）

### 文件 6 态分类

工具把每个模板下发文件分到以下状态之一（由「用户是否改过 × 模板是否改过」两个信号决定）。读懂这张表是正确决策的前提：

| 状态 | 图标 | 含义 | apply 默认行为 |
|------|------|------|----------------|
| `Unchanged` | — | 用户文件 == 新模板 | 跳过 |
| `Added` | 📄 | 新模板有、项目无 | 套用（新增） |
| `Deleted` | 🗑️ | 旧基线/清单有、新模板已移除、用户仍保留 | **仅提示，永不删** |
| `UpstreamOnly` | 🔄 | 用户没改 + 模板改了 | **自动套用**（安全） |
| `UserOnly` | 🔒 | 用户改了 + 模板没改 | **保留**（你的定制） |
| `Conflict` | ⚠️ | 用户改了 + 模板也改了 | **逐个给建议、交你决定** |

> 此外：项目里既不在新模板、也不在旧基线/清单中的文件 = **用户业务代码**，工具完全忽略，计入 `N 个用户自定义文件未参与对比`。

### 两种识别模式

| 模式 | 触发条件 | 识别「用户是否改过」的方式 | 说明 |
|------|----------|---------------------------|------|
| **清单模式** | 项目根有 `.template-manifest.json` | 比对当前磁盘文件哈希 vs 清单哈希（**离线可靠，推荐**） | 哈希算在 `sourceName`+占位符替换后的内容上，命名空间差异不会误报 |
| **基线模式** | 无清单，但标记版本号有效 | 下载旧版本 nupkg 作基线，3-way 比对 | 需服务器保留旧包；旧包缺失则降级 2-way（每处差异都当用户改过，需更多人工判断） |

### 关键产物文件

| 文件 | 作用 | 何时关心 |
|------|------|----------|
| `.template-version.json` | 记录项目当前所用模板版本（3-way 基准） | `check` 读取它判断是否过期；apply 成功后自动前进 |
| `.template-manifest.json` | 逐文件哈希清单（清单模式基准） | 有它=清单模式；无它=基线/2-way 模式 |
| `.thirdnet-backup/<时间戳>/` | 被覆盖文件的备份 | 仅当确有文件被覆盖时才生成；回滚用 |
| `<file>.thirdnet.merge` | 冲突标记文件（选 `[m]` 生成） | 需在编辑器里手动合并后落地 |

## 升级主流程（Phase 0–5）

> 以下为**在线、主流程**。离线变体见 [edge-cases](references/edge-cases.md)。所有命令在**解决方案根目录**（含 `.template-version.json` 的目录）执行，或用 `-p <路径>` 指定。

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

> 内网/凭证：NuGet 源 `http://192.168.1.156:8088/nuget`，user `admin` / key `swkj_20170505`。内网不可达时改用外网 `http://61.164.57.61:8088/nuget`。

**0.3 Git 工作区必须干净**
```bash
git status --porcelain   # 必须为空
```
若有未提交改动：先 `commit` 或 `stash`。**这是最可靠的回滚保险**（升级出问题可直接 `git reset --hard <升级前 commit>`）。

**0.4 网络判定（决定走在线还是离线流程）**
- 能访问 `http://192.168.1.156:8088/nuget` → **在线流程**（下文 Phase 1–5）。
- 不能访问（内网隔离 / 服务器宕机）→ **离线流程**（用 `--nupkg` 提供本地模板包，见 [edge-cases](references/edge-cases.md)）。

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
| `哈希清单: 未启用` + 当前版本可疑/`未知` | 旧项目、标记丢失或过期 | 先走 [edge-cases](references/edge-cases.md) 的「旧项目无清单/标记过期」处理，再 Phase 2 |
| `清单版本(X)与标记版本(Y)不一致` | 漂移 | 走 [edge-cases](references/edge-cases.md) 的「版本漂移」处理 |

> **注意**：`check` 始终会查询 NuGet 服务器取最新版本。完全离线时 `check` 会报连接失败——此时跳过 `check`，直接用 `diff --nupkg`（见 edge-cases）。

### Phase 2：预览差异（diff，只读）

```bash
thirdnet-migrate diff
# 或指定目标版本：
thirdnet-migrate diff -v <LATEST>
```

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

**代为决策时**：严格遵循 [conflict-resolution](references/conflict-resolution.md) 选择 `[a]`/`[k]`/`[m]`，并在最终报告里记录每个决策与理由。

**CI / 全自动场景**：
```bash
thirdnet-migrate apply --non-interactive
# 行为：🔄 UpstreamOnly 套用、🔒 UserOnly 保留、⚠️ Conflict 保留并报告。
# 退出码：0=全部成功；2=存在未决 Conflict（CI 应据此失败）。
```

### Phase 4：验证

```bash
dotnet restore
dotnet build        # 必须通过，0 error
```
若编译失败：通常是 Phase 3 合并 `Conflict` 文件引入的问题（如 `Startup.cs` 漏注册、类型不匹配）。回到该文件用 `[m]` 生成的冲突标记文件重新合并（合并规范见 conflict-resolution）。

再次确认状态：
```bash
thirdnet-migrate check
# 期望：当前已是最新版本；哈希清单已启用；无漂移告警。
```

### Phase 5：收尾

1. 审阅改动：`git status` + `git diff`。
2. 确认 `.template-manifest.json` 已生成/更新、`.template-version.json` 已前进到新版本。
3. **提交**（消息建议：`chore: 升级 ThirdNet 模板至 <新版本>`）。
4. 按 [commands-and-report](references/commands-and-report.md) 的格式输出升级报告。

## 框架库版本同步（仅当模板升级了 Vibe.Common/WebAPI 时）

若本次模板更新包含了 `ThirdNet.Vibe.Common` / `ThirdNet.Vibe.WebAPI` 的新版本，业务项目里通过 `PackageReference` 引用框架库的 `.csproj` 可能需要同步版本，否则 `dotnet restore` 失败：

```bash
# 在引用框架库的项目目录里
dotnet add package ThirdNet.Vibe.WebAPI -v <新版本> --source http://192.168.1.156:8088/nuget
dotnet add package ThirdNet.Vibe.Common -v <新版本> --source http://192.168.1.156:8088/nuget
```
> 升级目标版本号见 `.template-manifest.json` 的 `context.symbols`（`VIBE_COMMON_VERSION` / `VIBE_WEBAPI_VERSION`）。

## 参考文件索引

| 文件 | 内容 | 何时读取 |
|------|------|----------|
| [conflict-resolution.md](references/conflict-resolution.md) | 第 6 章：冲突决策矩阵、逐文件决策步骤、`.thirdnet.merge` 合并规范 | Phase 3 遇到 ⚠️ Conflict 时**必读** |
| [edge-cases.md](references/edge-cases.md) | 第 7 章：旧项目无清单/标记过期、离线流程、版本漂移、命名空间与占位符 | check/diff 报异常、或需离线时 |
| [rollback-and-do-not.md](references/rollback-and-do-not.md) | 第 8 章回滚预案 + 第 9 章禁止事项清单（DO NOT） | 升级出问题时回滚；执行前复核红线 |
| [commands-and-report.md](references/commands-and-report.md) | 第 11 章速查命令表 + 第 10 章升级报告格式模板 | 查命令速查、收尾出报告时 |

## 执行 Checklist

按顺序逐项确认，全部通过方可继续下一步：

- [ ] Phase 0.1 工具 ≥ 0.0.23 已装
- [ ] Phase 0.2 服务器最新版本 ≥ 目标版本（否则先发版）
- [ ] Phase 0.3 `git status` 干净
- [ ] Phase 0.4 确定在线 / 离线
- [ ] Phase 1 `check`，判定场景（清单/基线/旧项目）
- [ ] Phase 2 `diff`，读完所有 ⚠️ Conflict
- [ ] Phase 3 `apply --dry-run` → `apply`（Conflict 按 conflict-resolution 决策）
- [ ] Phase 4 `dotnet build` 通过；`check` 报「已是最新」
- [ ] Phase 5 `git` 审阅 + 提交
- [ ] 输出升级报告（commands-and-report.md 格式）
