---
name: thirdnet-template-upgrade
description: >
  ThirdNet 模板升级操作指南（前后端通用）——把已生成的 ThirdNet 项目升级到最新模板版本：
  后端用 thirdnet-migrate CLI（admin/service），前端用 npx create-thirdnet-admin check/diff/apply。
  覆盖预检、check/diff/apply 主流程、文件状态分类（后端 6 态 / 前端 4 态）、冲突逐个决策、
  清单/基线模式、override 品牌文件人工集成、离线流程、版本漂移处理、回滚预案与禁止事项。
  当用户提到"模板升级"、"模板迁移"、"升级模板"、"跟进模板"、"同步模板"、"模板更新"、
  "脚手架更新"、"脚手架升级"、"对齐模板版本"、"跟版"、"thirdnet-migrate"、"create-thirdnet-admin"、
  "upgrade template"、"template sync"、"scaffold"、".template-version.json"、".template-manifest.json"、
  "前端模板升级"、"升级前端"、"前后端一起升级"时，必须使用此技能；
  即便用户只说"项目模板是不是该更新了"、"怎么同步最新模板改动"、"把旧项目跟到新模板"、
  "前端项目怎么跟进模板改动"、"两端模板一起升"也要触发。前后端均适用——进入后先按项目类型选轨道。
metadata:
  version: "0.3.1"
---

# ThirdNet 模板升级（前后端通用）

模板（脚手架）会持续修 bug、优化结构，但用模板生成的旧项目是**一次性快照**——模板改了，旧项目不会自动跟着改。本技能指导你在**任意一个已用 ThirdNet 模板创建的旧项目**上执行模板升级，让它跟进模板的新版本，且**绝不覆盖用户的业务代码**。

两条轨道，机制高度平行：

- **后端轨道**：用 `thirdnet-migrate` CLI（命令名 `thirdnet-migrate`，≥ 0.0.23），针对 `dotnet new thirdnet-admin` / `thirdnet-service` 创建的项目。
- **前端轨道**：用 `create-thirdnet-admin` 包内嵌的更新子命令（`npx create-thirdnet-admin check|diff|apply`），针对 `create-thirdnet-admin` 创建的项目。

两者共享同一套心智模型：`check`（查是否最新）→ `diff`（只读预览差异）→ `apply`（应用，冲突逐个决策）→ 验证 → 收尾出报告；共享同名版本标记 `.template-version.json`、同样的 `.thirdnet-backup/<时间戳>/` 备份机制、同样的安全铁律。

> 本技能是模板升级流程的**单一事实来源**（前后端通用、为逐条执行而写）。两端各自的具体命令、状态表、注册表、边界情况分别在 [backend-flow](references/backend-flow.md) 与 [frontend-flow](references/frontend-flow.md)；冲突决策、回滚预案、命令速查见对应 references。
>
> 若执行中发现工具行为与本技能不符，具体实现以发布工具源码为准（`thirdnet-migrate` CLI 与 `create-thirdnet-admin` 包）。

## 适用范围

- ✅ 后端：用 `dotnet new thirdnet-admin` 创建的 Admin 项目，或 `dotnet new thirdnet-service` 创建的微服务。
- ✅ 前端：用 `create-thirdnet-admin` 创建的 Admin 管理后台前端项目。
- ❌ 非 ThirdNet 模板创建的项目。

> **多服务仓库**：一个仓库里有多个 ThirdNet 后端服务时，每个含 `.template-version.json` 的解决方案**各自独立**运行一次 check/diff/apply（工具不批量处理）；若升级带了新的框架库版本，所有引用 `ThirdNet.Vibe.Common`/`WebAPI` 的 `.csproj` 须统一同步版本号，否则 `dotnet restore` 失败。

## 第一步：判断项目类型（选轨道）

读项目根的 `.template-version.json`，按 `templateIdentity` 选轨道：

| 判定 | 轨道 | 接下来读 |
|------|------|----------|
| `templateIdentity === "ThirdNet.Admin.Frontend"`（或根目录有 `package.json` + `vite.config.ts`） | **前端** | [frontend-flow](references/frontend-flow.md) |
| 其它（根目录有 `.csproj` / `Tools/` 子项目 / Admin·Service 结构） | **后端** | [backend-flow](references/backend-flow.md) |
| 无 `.template-version.json` | 非 ThirdNet 模板项目 | 退出，本技能不适用 |

选好轨道后，按该 flow 文档的 Phase 0–5 执行。下文的安全铁律、核心概念、主流程骨架对**两条轨道都适用**，先在这里建立共识。

## 安全铁律（SAFETY INVARIANTS —— 任何情况下不得违反）

这些是不可妥协的硬约束，两端通用。违反即视为升级失败，必须回滚。理解它们存在的原因：模板升级最怕的是**误删/误覆盖用户的业务代码**，而这些规则把"不可逆的破坏"全部堵死。

1. **绝不覆盖用户业务代码。** 任何被工具识别为用户改动/用户专属的文件——后端是业务 Controller / 实体 / EntityConfiguration / 业务 DbContext / Service / DTO 等；前端是 `src/views/` 下的业务页面与任何用户自定义——**一律保留**，绝不套用模板版。业务代码是用户最宝贵的资产，模板升级只动框架结构。
2. **绝不自动删除用户文件。** 即便模板删除了某文件（🗑️ `Deleted`），apply 也只提示、永不删。**不得手动删除任何用户文件。** 模板删某个文件可能只是因为重构，但用户项目里那文件可能仍承载业务——删了找不回。
3. **冲突文件必须逐个决定**，不得用 `--force` 批量覆盖业务相关改动。`--force` 仅允许用于确认为「纯框架基础设施、无业务逻辑」的文件。`--force` 绕过逐个确认，等于盲覆盖，对业务文件是灾难。
4. **每次覆盖既有文件前，工具会自动备份到 `.thirdnet-backup/<时间戳>/`**；但更可靠的保险是**升级前 git 工作区干净**（见各轨道 Phase 0）。备份是第二道防线，git 才是第一道。
5. **升级全程不手动编辑命名空间 / 品牌占位符引用。** 工具会在比对前自动完成占位符替换——后端是 `sourceName`（`ThirdNetVibe`→项目前缀）+ 版本占位符（`VIBE_COMMON_VERSION` 等）；前端是品牌 token（`__BRAND_NAME__` / `__BRAND_INITIAL__` / `__BRAND_ABBR__` / `__PROJECT_NAME__` / `__API_PROXY_TARGET__`）。手动改这些会制造伪冲突，让干净的安全更新变成假的需确认项。
6. **升级目标版本必须已发布到对应注册表**。后端发到 NuGet（内网 `192.168.1.156:8088/nuget`，可用 `--nupkg` 离线）；前端发到 Verdaccio（内网 `192.168.1.207:4873`，**无离线模式**）。未发布的模板改动无法迁移。

完整的禁止事项清单见 [rollback-and-do-not](references/rollback-and-do-not.md)。

## 核心概念（读懂工具输出必备）

### check → diff → apply 心智模型

| 阶段 | 作用 | 是否写盘 |
|------|------|----------|
| `check` | 读版本标记、查注册表最新版，报告是否需要升级 | 否 |
| `diff` | 下载最新模板、替换占位符、与项目逐文件比对，按类别预览差异 | **否（只读）** |
| `apply` | 应用差异：安全的自动套用、用户改过的逐个决策、品牌文件跳过、模板删除只提示 | 是（覆盖前自动备份） |

### 文件状态分类

工具把每个模板下发文件分到一个状态。两端状态数不同（**后端 6 态、前端 4 态**），但判定内核一致——「用户是否改过 × 模板是否改过」：

- 两端共有：`Unchanged`（无变化）、`Added` 📄（新增）、`Deleted` 🗑️（模板已删、仅提示永不删）。
- 后端把"模板改了/用户改了"细分为 `UpstreamOnly` 🔄（自动套用）/ `UserOnly` 🔒（保留）/ `Conflict` ⚠️（逐个决策）三态；详见 [backend-flow](references/backend-flow.md)。
- 前端用单个 `Modified` 态，再按 `userModified × isOverride` 细分为 ✅安全自动 / ⚠️需确认 / 🔒品牌跳过；详见 [frontend-flow](references/frontend-flow.md)。
- 项目里既不在新模板、也不在旧基线/清单中的文件 = **用户业务代码**，工具完全忽略，不参与对比。

### 关键产物文件

| 文件 | 适用 | 作用 | 何时关心 |
|------|------|------|----------|
| `.template-version.json` | 两端 | 记录项目当前所用模板版本（diff 基准） | `check` 读它判断是否过期；apply 成功后自动前进 |
| `.template-manifest.json` | **仅后端** | 逐文件哈希清单（清单模式基准） | 有它=清单模式；无它=基线/2-way 模式 |
| `.thirdnet-backup/<时间戳>/` | 两端 | 被覆盖文件的备份（文件名扁平化） | 仅当确有文件被覆盖时才生成；回滚用 |
| `<file>.thirdnet.merge` | **仅后端** | 冲突标记文件（选 `[m]` 生成） | 需在编辑器手动合并后落地；**前端无此文件** |

## 升级主流程（Phase 0–5，共享骨架）

两端流程对仗，每阶段的**共性**如下；**具体命令、判定与边界见所属轨道的 flow 文档**。

- **Phase 0 预检**：环境/工具就绪（后端 `dotnet tool` ≥ 0.0.23；前端 Node ≥ 18 / npm ≥ 9）；确认注册表可达并记下最新版本号；**git 工作区必须干净**；确定在线/离线（后端可离线，前端不可）；**读本次升级涉及的 changelog**（前端 `public/changelog.md`、后端 `code/backend/changelog.md`，详见各 flow 的 Phase 0）——diff 只告诉你"改了什么"，changelog 告诉你"为什么、是否破坏性、是否跨端"，直接影响 ⚠️ 冲突的取舍。
- **Phase 1 check**：探测项目，判定是否需要升级（已是最新则结束）。
- **Phase 2 diff（只读）**：**必须完整阅读**，重点记录所有需确认/冲突文件与品牌文件的相对路径。
- **Phase 3 apply**：先 `--dry-run`，再正式应用。需确认/冲突文件逐个决策（后端 `[a]/[k]/[m]/[v]/[e]`；前端 `[a]/[s]/[v]`，无 `[m]`），遵循 [conflict-resolution](references/conflict-resolution.md)。
- **Phase 4 验证**：构建必须通过（后端 `dotnet build`；前端 `npm run build`），再 `check` 确认已是最新；**若本次升级触碰了认证/API/mock 等关键模块，加跑单测 + mock 模式冒烟**——`build` 通过 ≠ 行为正确，签名/权限/路由的回归编译期发现不了。
- **Phase 5 收尾**：git 审阅 + 提交（消息建议 `chore: 升级 ThirdNet 模板至 <新版本>`），按 [commands-and-report](references/commands-and-report.md) 输出报告。

## 全栈协同升级（两端都有时）

ThirdNet 项目通常前后端都有（见 `thirdnet-fullstack` 的 `{项目根}/backend/ + /frontend/` 嵌套布局）。**当一次模板升级同时触碰了跨端契约，两端必须配套升级，否则只升一端会导致登录瘫痪。** 最典型的契约是认证（HMAC-SM3 Basic Auth：前端 `src/utils/basicAuth.ts` + `.env` 的 `VITE_BASIC_AUTH_*`，后端框架 `ICheckClient`/`HMACSM3Algorithm`）；其它跨端契约（API 字段命名、权限字符串格式、路由格式、认证三 scheme 等）以 `thirdnet-fullstack` 技能的「共享 API 约定」为准，本技能不复述。

**判定是否属于跨端升级**——Phase 2 diff 里看到任一端触碰以下文件，就按本节配套处理：

- 后端：`Authentication/`、`Startup.cs` 的认证/DI 注册、`appsettings.json` 认证节、`PermissionCatalog` 相关、API 路由/控制器基类。
- 前端：`src/api/adapter.web.ts`、`src/utils/basicAuth.ts`、`src/stores/auth.ts`、`.env` 的 `VITE_BASIC_AUTH_*`/`VITE_API_BASE_URL`、`src/api/types/`、`src/api/interfaces/`。

**推荐顺序**：先升后端（契约权威源在后端）→ 后端 `dotnet build` + 认证相关单测通过 → 再升前端 → 前端 mock 模式（`VITE_MOCK_ENABLED=true`）独立验证 → 最后 `VITE_MOCK_ENABLED=false` 联调。

**配套验证清单**（至少过一遍）：登录、Token 刷新、一个 `v-permission` 按钮、一条分页列表——一次覆盖 HMAC 签名 + JWT + RBAC + snake_case 四类契约。

跨端契约变更的完整复核表见 `thirdnet-fullstack` 技能的「约定同步检查清单」。非跨端变更（纯前端样式、纯后端业务逻辑）按各自轨道独立升级即可。

## 参考文件索引

| 文件 | 内容 | 何时读取 |
|------|------|----------|
| [backend-flow.md](references/backend-flow.md) | 后端轨道：`thirdnet-migrate` 命令、6 态分类、清单/基线模式、框架库同步、NuGet 源、离线流程、后端 checklist | 升级**后端**项目时 |
| [frontend-flow.md](references/frontend-flow.md) | 前端轨道：`npx create-thirdnet-admin` 命令、4 态分类、override 品牌文件人工集成、Verdaccio、前端能力差距、前端 checklist | 升级**前端**项目时 |
| [conflict-resolution.md](references/conflict-resolution.md) | 冲突决策矩阵、逐文件决策步骤、`.thirdnet.merge` 合并规范、前端冲突处理 | Phase 3 遇需确认/冲突文件时**必读** |
| [edge-cases.md](references/edge-cases.md) | 旧项目无清单/标记过期、离线流程、版本漂移、命名空间与占位符；前端边界（无离线/2-way 降级/package.json 人工合并） | check/diff 报异常、或需离线时 |
| [rollback-and-do-not.md](references/rollback-and-do-not.md) | 回滚预案 + 禁止事项清单（DO NOT，前后端通用） | 升级出问题时回滚；执行前复核红线 |
| [commands-and-report.md](references/commands-and-report.md) | 速查命令表（前后端）+ 升级报告格式模板（前后端） | 查命令速查、收尾出报告时 |

## 执行 Checklist

按第一步判定项目类型，使用对应轨道的完整 checklist：

- 后端项目 → [backend-flow 的执行 Checklist](references/backend-flow.md#后端执行-checklist)
- 前端项目 → [frontend-flow 的执行 Checklist](references/frontend-flow.md#前端执行-checklist)
