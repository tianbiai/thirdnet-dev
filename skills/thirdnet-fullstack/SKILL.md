---
name: thirdnet-fullstack
description: >
  全栈 Admin 功能开发协调指南。当同时开发前端页面和后端 API 时使用此技能，
  提供从前端页面到后端 API 的完整开发顺序（前端先行）、Admin 模板 CRUD 页面开发模式
  （useCrudTable + PaginationBar + validators）、前后端类型映射规则、
  RBAC 权限前后端桥接、以及共享 API 约定的同步检查清单。适用于：
  新增一个完整 Admin 模块（前端 + 后端）、修改跨前后端的 API 契约、
  理解前端类型与后端 DTO 的映射关系、排查前后端数据格式不一致的问题。
  本技能在执行前会检查 thirdnet-backend 和 thirdnet-frontend 插件是否已安装，缺少任一插件时会阻止执行并提示安装方式。
  也提供任务路由（全栈 vs 仅前端/仅后端）与全新 Admin 全栈项目创建的协调路径。
license: MIT
metadata:
  version: "1.5.0"
  author: thirdnet
---

# 全栈 Admin 功能开发协调指南

本技能是前后端协同开发的桥梁，定义全栈功能开发顺序、类型映射规则、权限桥接和约定同步机制。需要 `thirdnet-backend` 和 `thirdnet-frontend` 插件同时安装。

> 后端可复用的框架/模板能力（命名空间 + 用途）见 `thirdnet-backend` 的 [framework-and-template-catalog](../../plugins/thirdnet-backend/skills/backend-workflow/references/framework-and-template-catalog.md)；各能力的"参考文件"列已标注生成项目内相对路径。

## 前置条件检查

本技能依赖以下两个插件，**执行任何任务前必须先检查它们是否可用**：

- **thirdnet-backend** — 提供 `net-api-developer`、`net-efcore-developer`、`net-rbac` 等后端技能
- **thirdnet-frontend** — 提供 `api-typescript-spec`、`vue-best-practices`、`frontend-workflow` 等前端技能

**检查方法**：查看当前环境中的可用技能列表，确认是否包含 `thirdnet-backend:` 和 `thirdnet-frontend:` 前缀的技能。

**缺少任一插件时，必须阻止执行并提示用户**：

> ⚠️ 全栈技能依赖检查失败：未检测到 `[插件名]` 插件。本技能需要 `thirdnet-backend` 和 `thirdnet-frontend` 两个插件同时安装。请在项目的 `.claude-plugin/marketplace.json` 中注册缺失的插件后重试。

不要在缺少插件的情况下继续执行，否则产出的代码可能不符合两端约定。

## 任务路由（何时用本技能）

接到请求后先判断范围，再决定用本技能还是直接委派单侧工作流：

| 任务特征 | 走法 |
|---------|------|
| **全新 Admin 全栈项目**（后端 + 前端从零创建） | 见下文「全栈项目创建（Admin 模板）」，两端各自走模板创建例外流程 |
| **同时改前端页面 + 后端 API**（新增模块、改跨端契约） | 用本技能的「全栈功能开发流程」（前端先行） |
| **仅后端**（实体/接口/权限/缓存/任务） | 委派 `thirdnet-backend:backend-workflow`，不必进本技能 |
| **仅前端**（页面/组件/路由/类型） | 委派 `thirdnet-frontend:frontend-workflow`，不必进本技能 |
| **新建 Service 微服务** | 委派 `thirdnet-backend:net-microservice-generator`，不必进本技能 |
| **排查前后端数据/格式/权限不一致** | 用本技能的「类型映射」「RBAC 桥接」「共享 API 约定」对照排查 |

本技能与 `backend-workflow`、`frontend-workflow` 互为入口：单侧任务直接用对应工作流，跨端协同用本技能协调。

## 全栈项目创建（Admin 模板）

当任务是**从零创建一个 Admin 全栈项目**（用户说"创建 admin""新建管理后台"等），**不要**套用下面的模块开发流程——两端模板都已内置完整功能，走各自的「模板创建例外流程」（仅确认必要参数、跳过需求澄清）。

### 目标目录布局（本技能强制）

全栈项目统一在工作区根目录采用**嵌套布局**，两端脚手架命令必须落在对应目录内：

```
{项目根}/
├── README.md                 # 项目总览 + 三端协调说明
├── backend/                  # .NET Admin 后端（dotnet new thirdnet-admin）
│   └── {ProjectName}.Admin/  # 模板产物（Admin/、Tools/、plan.md/changelog.md/spec.md）
└── frontend/
    ├── web/                  # 管理后台前端（create-thirdnet-admin，项目名传 web）
    └── minigram/             # 用户端小程序（uni-app + Vant，按需创建）
```

> ⚠️ 协调技能只规定"在哪个目录跑"，**不重复**两端工作流技能已有的命令细节（NuGet 源、品牌参数、EF 迁移等仍由各工作流技能负责）。两端脚手架都在 cwd 下创建命名文件夹，因此**cwd 必须精确**——否则会产生扁平布局（如 `admin-frontend/` 直接出现在根目录）。

### 创建步骤

1. **建顶层目录**：在工作区根目录创建 `backend/` 与 `frontend/` 两个文件夹（小程序按需再建 `frontend/minigram/`）。

2. **后端**（`backend-workflow` 例外流程）：用一次 `AskUserQuestion` 确认项目名 `{ProjectName}`，然后**在工作区根目录执行** `dotnet new thirdnet-admin -n {ProjectName}.Admin`（backend-workflow 自带 `mkdir -p backend; cd backend`，产出 `backend/{ProjectName}.Admin/`）。跳过需求澄清直接进入项目框架阶段（NuGet 源、连接串用默认配置）。

3. **前端 Admin**（`frontend-workflow` + `admin-template-setup` 例外流程）：确认品牌参数（`--brand`、`--initial`、`--abbr`，可用默认值），然后**在 `frontend/` 目录内执行** `npm exec --registry http://192.168.1.207:4873/ -- create-thirdnet-admin web --brand …`，项目名传 `web`（落地为 `frontend/web/`，npm 包名为 `web`）。后端 API 地址默认 `http://localhost:5000`。

   > `create-thirdnet-admin` 的项目名即目录名，无 `--out-dir`/`--parent` 参数，故必须用 cwd 控制落点。

4. **用户端小程序（按需）**：若用户同时要 C 端小程序，按 `frontend-workflow` 的手动初始化流程在 `frontend/minigram/` 创建 uni-app + Vant 项目；无此需求则跳过。

5. **README.md**：在项目根创建 `README.md`，记录三端协调说明与目录布局（指向 `backend/` 与 `frontend/{web,minigram}/`）。

模板内置 19 个管理端模块（用户/角色/菜单/部门/字典/配置/权限/操作日志/缓存/在线用户/API Key + API 应用/服务/操作/黑白名单/角色/访问日志 + 认证授权），功能固定无需澄清。创建后如需新增**业务模块**，再进入下面的全栈功能开发流程。

## 全栈功能开发流程

新增一个完整 Admin 模块（如"通知管理"）的推荐开发顺序——**前端先行，后端跟随**：

### 前端阶段（先行）

先定义前端 API 接口契约和页面，明确需要哪些数据结构和接口：

| 步骤 | 内容 | 调用技能 | 产出文件 |
|------|------|---------|---------|
| 1 | TypeScript 类型定义 | `api-typescript-spec` | `api/types/{module}.ts`（枚举 + 出入参接口） |
| 2 | 接口契约 | `api-typescript-spec` | `api/interfaces/manager/{module}.ts`（`I{Entity}Api`） |
| 3 | Mock 数据 | `api-typescript-spec` | `mock/data/manager/{module}.ts` |
| 4 | Mock 实现 | `api-typescript-spec` | `mock/api/manager/{module}.ts` |
| 5 | Real 实现 + 工厂函数 | `api-typescript-spec` | `api/modules/manager/{module}.ts` |
| 6 | CRUD 页面开发 | `admin-template-setup`（CRUD 指南） + `vue-best-practices` | `src/views/{module}/index.vue` 等 |

前端阶段完成后，页面已可通过 Mock 数据独立运行和验证交互。

**步骤 6 详细指引**：Admin 模板提供了完整的 CRUD 页面开发基础设施，新增页面时必须复用：

- **useCrudTable\<T, Q\>**（`src/composables/useCrudTable.ts`）：分页 + 搜索 + 防抖 + 加载 + 删除一体化，禁止手写 `usePagination + useActionLoading + debounced search` 样板
- **PaginationBar**（`src/components/PaginationBar.vue`）：统一分页栏组件，禁止直接使用 `el-pagination`
- **useDialogFocus**（`src/composables/useDialogFocus.ts`）：弹窗焦点管理
- **validators**（`src/utils/validators.ts`）：`requiredRule`、`requiredSelectRule` 等表单验证规则工厂
- **confirmAction**（`src/utils/confirm.ts`）：二次确认对话框（`useCrudTable.remove()` 已内置）
- **formatDateTime**（`src/utils/format.ts`）：日期时间格式化

完整开发指南参见 `admin-template-setup` 技能的 [crud-page-development-guide](../../plugins/thirdnet-frontend/skills/admin-template-setup/references/crud-page-development-guide.md)。

**标准参考实现**：`src/views/api/blacklist/index.vue`

### 后端阶段（跟随前端契约）

根据前端定义的接口契约，在后端实现对应的 API：

| 步骤 | 内容 | 调用技能 | 产出文件 |
|------|------|---------|---------|
| 7 | 定义实体 + 配置 + 迁移 | `net-efcore-developer` | Models + Configurations + Migration |
| 8 | 缓存视图 + 缓存域 | `net-cache-use` | View 模型 + Cache 域 |
| 9 | Service + DTO + Controller | `net-api-developer` | 按前端契约实现 API，DTO 字段与前端类型一一对应 |
| 10 | 权限定义 + DI 注册 | `net-rbac` | 权限字符串（如 `sys:notice:list/add/edit/remove`）+ `Startup.cs` 第 9 步注册 |
| 11 | 菜单/路由数据配置 | `net-rbac`（菜单树设计）+ 运行中的 Admin | 在 `t_sys_menu` 插入目录/页面/按钮三级菜单条目（含 `permission`），启动后经 `PermissionCatalog` 自动同步；可写种子数据或用运行中的 `MenuManagerController` 维护。**这不是一个技能，而是数据配置** |

后端 API 开发完成后，前端切换 `VITE_MOCK_ENABLED=false` 即可对接真实 API。

**关键原则**：前端先定义接口契约（`IXxxApi`）和数据类型，后端按契约实现。前端定义了"需要什么"，后端负责"如何提供"。

## 前后端类型映射规则

前端 TypeScript 类型与后端 C# DTO 的映射关系（前端先行定义，后端跟随实现）：

### 命名映射

| 前端（TypeScript） | 后端（C# DTO） | 示例 |
|-------------------|---------------|------|
| `{Entity}QueryParams` | `{Entity}QueryMap` | `NoticeQueryParams` → `NoticeQueryMap` |
| `{Entity}CreateParams` | `{Entity}CreateMap` | `NoticeCreateParams` → `NoticeCreateMap` |
| `{Entity}UpdateParams` | `{Entity}UpdateMap` | `NoticeUpdateParams` → `NoticeUpdateMap` |
| `{Entity}Item` | `{Entity}ItemMap` | `NoticeItem` → `NoticeItemMap`（前端详情接口 `getXxxDetail()` 同样返回 `{Entity}Item`） |

### 字段映射

| 规则 | 说明 |
|------|------|
| **字段名保持 snake_case** | 前端定义 `snake_case` 字段名，后端 DTO 用 `[JsonPropertyName("snake_case")]` 保持一致 |
| **类型对应** | `number` ← `long`、`string` ← `string`/`DateTime`（ISO 8601）、`boolean` ← `bool`、`enum` ← `enum`（值完全一致） |
| **可空类型** | TypeScript `?` 可选属性 ↔ C# `?` 标记，两端保持一致 |
| **分页参数** | 前端 `PaginatedResponse<T>` ↔ 后端 `PageListInfo<List<T>>`（响应字段：`list`、`total`、`index`、`pages`，两端一致；页大小在请求 `QueryMap.page_size`，响应不重复） |
| **枚举值** | 前端 `enum` 值与后端 `[SystemDict]` 枚举值完全一致 |

### 枚举映射

前端定义枚举时，需考虑后端 `[SystemDict]` 的处理方式：

1. **后端管理的枚举**（`dict_source=0`）：前端通过 `/api/manager/dict/type/{dict_type}/data` 接口动态获取，不硬编码
2. **前端先定义的枚举**：如果前端先定义了枚举（稳定不变的选项），后端实现时需在 `[SystemDict]` 中保持相同的值

## RBAC 前后端桥接

权限系统跨越前后端三层：

### 后端层

```csharp
// Controller 方法上的权限注解
[PermissionAuthorize("sys:notice:list")]
[HttpGet("list")]
public async Task<PageListInfo<List<NoticeItemMap>>> GetList([FromQuery] NoticeQueryMap query)
```

### 前端层

```vue
<!-- 模板中的按钮级权限控制（接收数组，支持 OR 逻辑） -->
<el-button v-permission="['sys:notice:add']" @click="handleAdd">新增</el-button>

<!-- 组合式 API 中的权限判断 -->
<script setup lang="ts">
import { usePermission } from '@/composables/usePermission'

const { hasPermi, hasPermiOr } = usePermission()

// 编程式权限检查
const canEdit = computed(() => hasPermi('sys:notice:edit'))
// 同时具备「编辑」或「删除」之一即可显示操作按钮（OR 逻辑）
const canModify = computed(() => hasPermiOr(['sys:notice:edit', 'sys:notice:remove']))
</script>
```

### 权限字符串格式

统一格式：`{module}:{entity}:{action}`

| 组成部分 | 说明 | 示例 |
|---------|------|------|
| module | 模块前缀 | `sys`、`api`、`biz` |
| entity | 实体名称 | `user`、`role`、`notice` |
| action | 操作类型 | `list`、`query`、`add`、`edit`、`remove`；模块特例如 `resetPwd`、`kick`（用户）、`info`/`clear`（缓存）、`view-key`（API 服务）等，以控制器实际 `[PermissionAuthorize]` 为准 |

> **权限 action 以后端 `net-rbac` 为权威源**（`PermissionCatalog` 启动时按 `[PermissionAuthorize]` 实际标注扫描）。注意区分两个命名空间：**权限 action** 用 `query`（详情）、`edit`（编辑）、`remove`（删除）；而前端 **URL 路由 action** 用 `/detail`、`/update`、`/delete`（见 `api-typescript-spec` 的 URL 命名规范）。两者不要混用——例如详情权限是 `sys:notice:query`，不是 `sys:notice:detail`。

**后端定义权限字符串 → 注册到 `PermissionCatalog` 自动同步 → 前端通过 `v-permission` 或 `usePermission()` 使用**。前端不需要硬编码权限列表，权限数据从后端 API 动态获取。

## 共享 API 约定

以下约定是前后端必须共同遵守的 API 契约。两端的技能各自独立描述这些约定，此处列出作为协调参考。前端定义接口契约时必须遵循这些约定，后端实现时保持一致：

| 约定 | 说明 | 后端出处 | 前端出处 |
|------|------|---------|---------|
| 仅 GET / POST | API 网关限制，不允许 PUT/DELETE/PATCH | `net-api-developer` | `api-typescript-spec` |
| snake_case 字段 | 所有 API 字段名使用 snake_case | `backend-workflow` 代码规范速查 | `api-typescript-spec` 核心约定 |
| 无响应包装 | 成功直接返回 JSON，不用 `{code, message, data}` | `net-api-developer` | `api-typescript-spec` |
| HTTP 状态码错误 | 401/403/404/500 区分错误类型 | `net-api-developer` | `api-typescript-spec` |
| DTO Map 后缀 | 后端 `{Entity}{Action}Map` | `net-api-developer` | `api-typescript-spec` URL 命名规范 |
| 路由格式 | `/api/{endpoint}/{module}/{action}` | `net-api-developer` | `api-typescript-spec` URL 命名规范 |
| 认证方式 | IdentityServer `/connect/token` | `net-authentication` | `api-typescript-spec` 认证模块 |

## 约定同步检查清单

当修改任一插件中的共享约定时，必须检查另一插件是否需要同步更新：

- [ ] HTTP 方法限制变更 → 检查 `net-api-developer` 和 `api-typescript-spec`
- [ ] 字段命名规则变更 → 检查 `backend-workflow` 代码规范速查和 `api-typescript-spec` 核心约定
- [ ] 响应格式变更 → 检查 `net-api-developer` 和 `api-typescript-spec`
- [ ] DTO 命名后缀变更 → 检查 `net-api-developer` 和 `api-typescript-spec` 映射规则
- [ ] 认证流程变更 → 检查 `net-authentication` 和 `api-typescript-spec` 认证模块
- [ ] 权限字符串格式变更 → 检查 `net-rbac` 和前端权限组件
- [ ] API 路由格式变更 → 检查 `net-api-developer` 和 `api-typescript-spec` URL 命名规范

**原则**：前端先定义接口契约，后端按契约实现。当前端契约变更时，需同步检查后端实现是否匹配；当后端架构约束变更时（如网关规则），需同步检查前端约定是否需调整。

## Admin 模板模块对照表

模板内置 19 个管理端模块，前端 `api/modules/manager/` 与后端 `Controllers/Manager/` 基本一一对应：

| 模块 | 后端 Controller | 前端 API 模块 |
|------|----------------|--------------|
| 认证 | `AuthManagerController`（`/connect/token` 等端点由框架内置处理） | `api/modules/manager/auth.ts` |
| 用户管理 | `UserManagerController` | `api/modules/manager/user.ts` |
| 角色管理 | `RoleManagerController` | `api/modules/manager/role.ts` |
| 菜单管理 | `MenuManagerController` | `api/modules/manager/menu.ts` |
| 部门管理 | `DeptManagerController` | `api/modules/manager/dept.ts` |
| 字典管理 | `DictManagerController` | `api/modules/manager/dict.ts` |
| 配置管理 | `SysConfigManagerController` | `api/modules/manager/config.ts` |
| 权限管理 | `PermissionManagerController` | `api/modules/manager/permission.ts` |
| 操作日志 | `OperLogManagerController` | `api/modules/manager/oper-log.ts` |
| 缓存管理 | `CacheAdminManagerController` | `api/modules/manager/cache.ts` |
| API Key | `ApiKeyManagerController` | `api/modules/manager/api-key.ts` |
| API 应用 | `ApiApplicationManagerController` | `api/modules/manager/api-application.ts` |
| API 服务 | `ApiServiceManagerController` | `api/modules/manager/api-service.ts` |
| API 操作 | `ApiActionListManagerController` | `api/modules/manager/api-action.ts` |
| IP 黑名单 | `ApiBlacklistManagerController` | `api/modules/manager/api-blacklist.ts` |
| IP 白名单 | `ApiWhitelistManagerController` | `api/modules/manager/api-whitelist.ts` |
| API 角色 | `ApiRoleManagerController` | `api/modules/manager/api-role.ts` |
| 访问日志 | `ApiVisitLogManagerController` | `api/modules/manager/api-visitlog.ts` |
| 文件上传/下载 | `CommonManagerController`（通用接口，无前端独立模块） | — |

> **关于"在线用户"**：前端保留 `api/modules/manager/online-user.ts`，但其列表/强退功能在后端**没有独立控制器**——已合并进 `UserManagerController`（`/api/manager/user/heartbeat`、`/api/manager/user/kick`）+ `OnlineUserService` + `OnlineUserHeartbeatLogger` 后台任务；前端 `online-user.ts` 现仅保留心跳上报，列表/强退调用走 `user.ts`。新增业务模块时不要照搬一个"在线用户控制器"。

新增业务模块时，参考此对照表的命名模式。

> 上述 Controller 命名遵循 `{Entity}ManagerController` 模式（多数系统/业务实体**不带** `Sys` 前缀，仅 `SysConfigManagerController` 等个别带前缀——以生成代码实际类名为准），权限字符串遵循 `{module}:{entity}:{action}` 格式。
