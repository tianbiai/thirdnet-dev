# 审查规则目录（review-rules）

> 本文件是 fullstack-review 技能的**可检查规则索引**，按七大维度组织。每条规则给：**规则陈述**、**来源技能/文件**、**检查方法**。规则原文以来源技能为权威源——本目录是审查时的速查与执行指引，不替代原技能。
>
> 判定原则：按**项目内一致性**判定，遇技能间分歧按 [SKILL.md「已知歧义与例外」](../SKILL.md) 处理，不臆断。

---

## A. 后端规范遵守

### A1. 命名规范

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 实体类用 `Model` 后缀（`SysUserModel`），纯 POCO | `net-efcore-developer` | `Database/Models/*.cs` 类名以 `Model` 结尾 |
| DTO **必须** `Map` 后缀，**禁止** `Request`/`Response`/`Dto`（`{Entity}CreateMap` / `UpdateMap` / `QueryMap`(继承 `PageQueryDto`) / `ItemMap` / `DetailMap`） | `net-api-developer` | grep DTO 目录类名 `Request\|Response\|Dto$` → 命中即违例 |
| 全链路 snake_case（C# 属性 ↔ JSON ↔ DB 列） | `backend-workflow` / `net-efcore-developer` | 实体/DTO 公共属性为小写 snake_case，无 PascalCase |
| Controller 类名带端类型后缀：`{Module}ManagerController` / `AppController` / `ThirdController` | `net-api-developer` | `*Controller.cs` 文件名与类名匹配 `*(Manager\|App\|Third)Controller` |
| Service 类名 `{Entity}Service`，**无** `I` 前缀，DI 注入具体类型 | `net-api-developer` | `services.AddScoped<XxxService>()`，非 `IXxxService` |
| Cache 类 `{Domain}Cache : RedisCacheManager`，置于 `{Project}.Cache/Domain/` | `net-cache-use` | 类名 `Cache` 结尾、继承 `RedisCacheManager`、命名空间无 `.Admin.` |
| View 模型 `View` 后缀（`UserView`），无 Fluent 配置 | `net-efcore-developer` | `View/*.cs` 以 `View` 结尾，无对应 `IEntityTypeConfiguration<>` |
| 缓存键 `const string` 于 `AdminCacheKeys`，格式 `admin.{module}.{id}` 全小写点分 | `net-cache-use` | 键常量匹配 `^admin\.[a-z_]+(\.[a-z_0-9]+)*$` |
| 表名 `t_` + snake_case；索引名 `idx_xxx` | `net-efcore-developer` | `ToTable("...")` 参数匹配 `^t_[a-z_]+$` |
| 权限串格式 `module:entity:action`（module ∈ `sys`/`api`/`biz`/`monitor`） | `net-auth` | `[PermissionAuthorize("...")]` 参数匹配 `^[a-z_]+:[a-z_]+:[a-z_]+$` |
| 枚举单文件，`[SystemDict("snake_type","中文名")]` + 成员 `[EnumMeta("中文")]` 显式值从 0 | `net-enum-dict` | `Common/Enums/` 一文件一枚举；`[SystemDict]` 首参匹配 `^[a-z_]+$` |
| 一文件一类型（class/enum/interface） | `backend-workflow` | 单 `.cs` 顶级类型声明数 ≤ 1（排除 Designer/ModelSnapshot） |

### A2. API 规范

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| **仅 GET/POST**（网关屏蔽 PUT/DELETE/PATCH） | `backend-workflow` / `net-api-developer` | grep `[HttpPut]`/`[HttpDelete]`/`[HttpPatch]` → 命中即违例 |
| 路由 `api/{端标识}/{模块}/{操作}`，**禁止**版本号（v1/v2） | `net-api-developer` | `[Route]`/`[Http*]` 路径无 `v1`/`v2` |
| Controller 继承 `AdminControllerBase`（非 `ControllerBase`）；例外：Basic Auth 登录/刷新端点直接继承 `ControllerBase` | `net-api-developer` | `Controllers/Manager/` 下非 auth 控制器 derive `AdminControllerBase` |
| 端点模板合规：list=`[HttpGet("list")]+[FromQuery]QueryMap`→`PageListInfo`；detail=`[HttpGet("{id}")]`→`DetailMap`；create/update=`[HttpPost]+[FromBody]`；delete=`[HttpPost("delete/{id}")]`/`delete-batch` | `net-api-developer` | 动词/路由/DTO 类型与模板表对照 |
| 变更端点（create/update/delete）**同时**带 `[PermissionAuthorize]` + `[OperLog]`；查询端点只 `[PermissionAuthorize]` | `net-api-developer` | 每个 POST 端点两特性齐全 |
| **禁**返回匿名对象（`return Ok(new {...})`） | `net-api-developer` | grep `return Ok(new {` / `return NotFound(new {` |
| **禁** Controller 直接返回 EF 实体（`*Model`） | `net-api-developer` | 返回类型须为 `Map`/`PageListInfo<>`/`IdResult`/void |
| **禁**引入 AutoMapper/Mapster，手写 `new XxxMap{...}` | `net-api-developer` | `.csproj` 无 AutoMapper/Mapster |
| 每个端点方法带 `[ProducesResponseType]`（有返回带 typeof，无返回不带） | `net-api-developer` | 公共 action 方法均有该特性 |
| 错误用 `throw new WebApiException(HttpStatusCode.xxx,"msg")`，**禁** `NotFound()`/`BadRequest()` | `net-api-developer` | grep `return NotFound` / `return BadRequest` |
| 分页用 `.ToPageListAsync(page_index,page_size)`，QueryMap 继承 `PageQueryDto` | `net-api-developer` | 无手写 `Skip/Take` 分页 |
| 不手动 `ModelState.IsValid`、不重复 `[ApiController]`/`[Authorize]`（基类已含） | `backend-workflow` / `net-api-developer` | grep `ModelState.IsValid` → 命中即多余 |

### A3. EF Core / 数据库规范

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 实体纯 POCO，**仅** Fluent API 配置（唯一例外 `[DbBulk]`） | `net-efcore-developer` | `*Model.cs` 无 `[Table]`/`[Key]`/`[Required]` 等数据注解 |
| 主键 `public long id`，`builder.HasKey(x=>x.id)` | `net-efcore-developer` | 每实体一个 `long id` |
| **不创建外键**，用 `long xxx_id` 列 + 复合唯一索引关联 | `net-efcore-developer` | 无 `HasOne`/`HasMany`/`HasForeignKey` |
| 字符串不设 `HasMaxLength`，默认映射 `text` | `net-efcore-developer` | grep `.HasMaxLength(` → 命中即违例（除非有明确业务约束） |
| `IAuditableEntity` 5 审计字段（`created_by`/`created_time`/`updated_by`/`updated_time`/`remark`），`ConfigureAuditFields()`；`created_time`/`updated_time` 用 `HasDefaultValueSql("now()")`；中间表/日志表例外 | `net-efcore-developer` | 审计实体 5 字段齐全且可空性正确 |
| **时间类型**：所有 `DateTime`/`DateTime?` 映射 `timestamptz`（`OnModelCreating` 全局循环 或 逐列 `.HasColumnType("timestamptz")`） | `net-efcore-developer` | `OnModelCreating` 有全局 timestamptz 循环 或 每个时间属性显式标注 |
| **时间赋值**：应用层用 `DateTime.UtcNow`，**禁** `DateTime.Now`（`timestamptz` 要求 `Kind==Utc`，否则 Npgsql 抛 `InvalidCastException`） | `net-efcore-developer` | grep Service/Handler 中 `DateTime.Now` → 命中即 Critical |
| 数据范围过滤列（`dept_id` 等）**必建索引**；jsonb/array 用 GIN | `net-auth` / `net-efcore-developer` | 含 `dept_id` 属性的实体有 `HasIndex(x=>x.dept_id)` |
| DbContext 用 `AddPooledDbContextFactory`，经 `IDbContextFactory<>` + `await using`，**禁**直接注入 `DbContext` | `net-efcore-developer` | 构造参数为 `IDbContextFactory<>`，无裸 `AdminDbContext` |
| Admin `OnModelCreating` 自动注册 `xmin` 乐观并发；Service `ServiceDbContext` **不**注册 | `net-efcore-developer` / `net-microservice-generator` | Admin 有 xmin 循环，Service 无 |
| 中间关联表为独立实体（`long id` + 两 FK 列 + 复合唯一索引），**不**实现 `IAuditableEntity`，**不**用导航属性 | `net-efcore-developer` | 无 `HasMany`/`WithMany`；`SysUserRoleModel` 等为纯 POCO |
| 批量操作用 `IDbAsyncBulk`（COPY 协议），**禁** `SaveChanges` 循环；**批量后必须手动删缓存** | `net-efcore-developer` | `_bulkCopy.*` 调用后紧跟 `_xxxCache.Remove*` |
| 已在库的多步操作用**单语句 CTE**，**禁**拆成多次 `SaveChanges()`；SQL 必参数化、表名带 schema 前缀 | `net-efcore-developer` | 无字符串拼接 SQL；多步未拆 SaveChanges |
| 软删用 `StatusEnum`（0=正常,1=停用），**非** `deleted_at` 列 | `postgres-best-practices` | 新实体无 `deleted_at`/`is_deleted` |
| 迁移仅在用户明确要求时创建；生产迁移走 expand/contract | `net-efcore-developer` | 无对大表 `AddColumn ... NOT NULL` 无默认 |

### A4. 认证授权规范

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 三层认证（Basic + Bearer/JWT(SM2) + APIKey），加密走 `AddCrypto`，**禁**自实现 | `net-auth` | 无自研加密代码 |
| 登录 `POST /api/manager/auth/login`、刷新 `POST /api/manager/auth/refresh`（Basic+HMAC-SM3），refresh_token 单次失效 | `net-auth` | 端点路径/方法匹配；刷新逻辑作废旧 token |
| JWT claim 名固定：`user_id`(long)/`dept_id`/`admin_roles`/`name` | `net-auth` | `User.FindFirst("user_id")` 等 |
| Admin **必须**注册 `IAccountValidator`；Service **不**注册 | `net-auth` / `net-microservice-generator` | Admin Startup 有注册，Service 无 |
| `[PermissionAuthorize("m:e:a")]` 走角色权限；`[ProviderAuthorize("scope")]` 读 scope claim | `net-auth` | 特性参数格式正确，未混用 |
| Admin `Program.cs` 调 `InitializePermissionCatalogTableAsync()`；Service **不**调 | `net-auth` / `net-microservice-generator` | Admin 有调用，Service 只有同步 `InitializeDatabases()` |
| Token 失效用 `UserCacheInvalidation.InvalidateUserAuthAsync(...)`，**禁**直接 `_tokenCache.SetTokenInvalidationTime` | `net-auth` / `net-cache-use` | grep `_tokenCache.SetTokenInvalidationTime` → 命中即违例 |
| Service **不**注册 `OperLogFilter`、端点**不**加 `[OperLog]`（操作日志统一由 Admin 处理） | `net-microservice-generator` | Service 控制器无 `[OperLog]` |
| 数据权限走应用层（`DeptFilterHelper` + `OperatorContext`），**禁** Postgres RLS | `net-auth` / `net-efcore-developer` | 用 `OperatorContext`，无 RLS |

### A5. 缓存规范

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 缓存域三区域：`Reader`(public virtual)/`Remove`(public virtual)/`Query`(private, `SqlQueryRaw`)，继承 `RedisCacheManager` | `net-cache-use` | 类含三区域、可见性正确 |
| TTL 参数类型：`GetSingle`/`AddOrUpdate`/`RemoveSingle` 用 `TimeSpan?`；`GetMultiple`/`AddOrUpdateMultiple` 用 `DateTimeOffset?` | `net-cache-use` | 方法签名匹配 |
| TTL 取值符合数据类型（用户/权限 8h、引用数据 24h、token 7d、会话 10min、验证码 5min、在线 540s） | `net-cache-use` | TTL 常量与表一致 |
| 全部 Singleton，注册于 `AddAdminCacheServices()` | `net-cache-use` | `AddSingleton<XxxCache>()`，非 Scoped/Transient |
| Cache-Aside「变更后删除」：`SaveChangesAsync` → `RemoveXxx`；多键用 `RemoveMultiple`/`GetMultiple`，**禁**循环 `RemoveSingle` | `net-cache-use` | 变更方法在 SaveChanges 后 Remove；无循环单键 |
| 单实体单 View + 单 key，**禁** `BriefView`+`DetailView` 拆 key | `net-cache-use` | 每实体一个 `{Entity}View` |
| View **不含**敏感字段（`password_hash` 等） | `net-cache-use` | `{Entity}View` 无 password/secret/PII |
| `CacheDbContext` 无 DbSet、无迁移 | `net-cache-use` | 无 `DbSet<>` 属性 |
| `RedisLock` 必须 `await using`，每锁新实例 | `net-cache-use` | `new RedisLock(...)` 在 `await using` 内 |

### A6. 结构 / DI / 配置

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| `.csproj` 的 `TargetFramework` 一律 `net10.0`，EF Core/Npgsql 10.x | `backend-workflow` | 所有后端 `.csproj` 有 `<TargetFramework>net10.0</TargetFramework>` |
| Admin 目录布局（`Admin/{Project}.Admin.APIService` + `Database`、`Tools/{Project}.Common` + `Cache`），解决方案文件夹分离 | `backend-workflow` | 目录树匹配 |
| Controller 按端分目录 `Controllers/{Manager,App,Third}/` | `net-api-developer` | `*Controller.cs` 在匹配后缀的子目录 |
| Service 微服务引用 Admin.Common + Admin.Cache（`ProjectReference`），无 `Service/` 子层 | `net-microservice-generator` | Service `.csproj` 有两条 ProjectReference |
| 双数据库：Admin 用 `ThirdNetDbContext`+`AdminDbContext`；Service 用 `ServiceDbContext`；appsettings 有 `DefaultConnectionString`+`ConnectionString` | `backend-workflow` / `net-microservice-generator` | 配置键齐全 |
| 10 步 DI 注册顺序（不可调换），业务 Service 在第 9 步 | `backend-workflow` | 新 Service 注册在步骤 9 |
| 中间件顺序固定（`UseThirdNetMvc` 内），不在外部重复加认证/授权/路由中间件 | `net-microservice-generator` | `Startup.Configure` 无重复中间件 |
| 新模块 8 件套齐全（Model→Configuration→migration→View+Cache→DTO→Service→Controller→权限→DI） | `backend-workflow` | 各产物文件均存在 |
| Tools 层命名空间**无** `.Admin.` 中缀（`{Project}.Common.*` / `{Project}.Cache.*`） | `net-api-developer` / `net-cache-use` | `Tools/**/*.cs` 命名空间正确 |
| `appsettings.json` 提交且用占位描述串（非真实密钥）；`Development.json`/`Production.json` 不提交（`.gitignore`）；`JwtOptions.type=SM2` | `net-microservice-generator` | `.gitignore` 含 Development/Production；无真实密钥入库 |

### A7. 枚举 / 字典 / 后台任务

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 枚举字典（`dict_source=0`，int）与自定义字典（`dict_source=1`，string）**不混**用 API | `net-enum-dict` | 前端调用与 `dict_source` 类型匹配 |
| 响应 DTO 的字典字段**必须** `{field}`+`{field}_label` 配对 | `net-enum-dict` | `*ItemMap`/`*DetailMap` 字典字段有成对 `_label` |
| DTO 字段类型：枚举字典 `int`/`int?`；自定义字典 `string`/`string?`（DB 列 `text`） | `net-enum-dict` | 字段类型匹配 |
| 自定义字典**全程不写 C# 代码**（无对应枚举） | `net-enum-dict` | 自定义字典类型在 `Common/Enums` 无对应枚举 |
| 后台任务继承 `BackgroundRunner`（设 `SleepTime`/`Name`，实现 `Check`+`WorkAsync`） | `net-background-job` | 任务类 derive `BackgroundRunner` |
| `BackgroundRunner` 为 Singleton，通过 `IServiceScopeFactory` 取 Scoped 服务，**禁**直接注入 `DbContext` | `net-background-job` | 构造参数含 `IServiceScopeFactory` |
| 内置任务（`DatabaseOperLogLogger`/`OnlineUserHeartbeatLogger`/`VisitLogCleanupRunner`）**不重复注册** | `net-background-job` | 业务代码无重复 `AddHostedService<...>` |

---

## B. 前端规范遵守

### B1. TypeScript 契约层（策略工厂）

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 每模块 5 文件齐全：`api/types/{module}.ts`、`api/interfaces/{endpoint}/{module}.ts`、`api/modules/{endpoint}/{module}.ts`、`mock/api/{endpoint}/{module}.ts`、`mock/data/{endpoint}/{module}.ts` | `api-typescript-spec` | 对每个 `api/modules/manager/{m}.ts`，4 个兄弟文件存在 |
| 接口名 `I{Entity}Api`，仅接口定义无实现 | `api-typescript-spec` | 文件含 `export interface I{Entity}Api` |
| `api/modules/{m}.ts` 含三件：`class Real{Entity}Api implements I{Entity}Api` + `export function create{Entity}Api(): I{Entity}Api` + `export const {entity}Api` 单例 | `api-typescript-spec` | 三件齐全，工厂返回类型为接口 |
| Mock 类数据取自 `@/mock/data/`，非硬编码；方法签名与接口一致 | `api-typescript-spec` | Mock 类无内联数据字面量 |
| DTO 命名 `{Entity}QueryParams`/`CreateParams`/`UpdateParams`/`Item`，QueryParams 继承 `PaginationParams` | `api-typescript-spec` | 类型名匹配 |
| **仅** GET/POST，`request.ts` **禁**导出 PUT/DELETE/PATCH 便捷方法 | `api-typescript-spec` | grep `export.*put\|delete\|patch` → 命中即违例 |
| 字段全 snake_case，**禁** camelCase | `api-typescript-spec` | 接口/mock 字段为 snake_case |
| 成功响应直接返回实体或 `PaginatedResponse<T>`，**禁** `{code,message,data}` 信封 | `api-typescript-spec` | 无信封包装 |
| URL 模式 `/api/{endpoint}/{module}/{action}`（action 项目内一致；`/add` vs `/create` 见已知歧义） | `api-typescript-spec` | URL 与项目既有约定一致 |
| TS `enum` **仅**用于纯前端常量（每成员 JSDoc）；后端字典字段用 `number`/`string`，**禁** union/const object 替代 | `api-typescript-spec` | 字典驱动字段未用 enum；无非 enum 替代 |

### B2. CRUD 页面（Admin 模板）

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 布局类结构：`page-container`→`page-header`(`page-title`+`HelpBubble`)→`search-bar`→`toolbar`→`el-table`(v-loading/border/stripe/`#empty`)→`PaginationBar`→`el-dialog` | `admin-template-setup` | 页面结构匹配 |
| 列表页**必须**用 `useCrudTable`，**禁**手写 `usePagination+useActionLoading` 样板 | `admin-template-setup` / `thirdnet-fullstack` | 用 `useCrudTable` |
| **禁**直接用 `el-pagination`，必须 `PaginationBar` | `admin-template-setup` | grep `<el-pagination` → 命中即违例 |
| 编辑弹窗**必须**用 `useDialogFocus` | `frontend-workflow` | 弹窗用 `useDialogFocus` |
| 表单校验**必须**用 `@/utils/validators` 工厂（`requiredRule`/`requiredSelectRule` 等） | `frontend-workflow` | 用 validators 工厂 |
| 弹窗/表单宽度用 CSS 变量（`var(--dialog-md)` 等），非硬编码 | `admin-template-setup` | 无硬编码 px 宽度 |
| 删除用 `confirmAction`（`useCrudTable.remove` 内置，勿重复调） | `admin-template-setup` | 无重复 confirmAction |

### B3. 权限 / 按钮 / 字典 / 防抖

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| `v-permission` 接**数组**（支持 OR），格式 `['sys:notice:add']`；权限 action 用 `query`/`edit`/`remove`，**非** URL action `detail`/`update`/`delete` | `thirdnet-fullstack` / `vue-enum-dict` | 数组形式；action 未与 URL 混用 |
| `usePermission()` 返回 `hasPermi`/`hasPermiOr`（非 `hasPermission`） | `admin-template-setup` | 调用名正确 |
| HelpBubble content 用 `MOCK_ENABLED ? '...' : ''` 守卫（生产构建不含）；用 `v-if` 非 `v-show` | `frontend-workflow` / mock-stripping | content 被 MOCK_ENABLED 守卫 |
| API 调用按钮**必须** Loading+disabled（同变量）+ `try/finally`；**禁**仅靠防抖/节流或裸 async | `frontend-workflow` | 提交/删除按钮有 :loading+:disabled+try/finally |
| 字典字段：枚举字典用 `useDict`(int，`/options`)；自定义字典用 `getDictDataByType`(string，`/data/type`)；**不混** | `vue-enum-dict` | 调用与字典类型匹配 |
| **禁**硬编码下拉选项数组；**禁**提交 label 串；表列**直接用**后端 `*_label`（**禁** `useDict.formatLabel` 在表列） | `vue-enum-dict` | 无硬编码 options；表列用 `*_label` |

### B4. 状态 / 路由 / 移动端 / 注释

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 全 `.ts` + `<script setup lang="ts">`，**禁** `.js` | `frontend-workflow` | 无 `.js` 业务文件 |
| SFC 顺序 `<script>`→`<template>`→`<style>` | `vue-best-practices` | 节顺序正确 |
| Pinia state/getter **禁**直接解构，用 `storeToRefs()`；setup store **必须**返回全部 state | `vue-pinia-best-practices` | 用 storeToRefs；无隐藏私有 state |
| Vue Router 4 守卫**返回式**，**禁** `next()`；异步守卫**必须** await | `vue-router-best-practices` | 无 `next(`；async 守卫有 await |
| 登录/刷新用 `signBasicAuth`(HMAC-SM3 Basic) + `skipAuthRefresh:true`，body 为 JSON（非 form/`grant_type`） | `api-typescript-spec`(auth-module) | 调用含 signBasicAuth + skipAuthRefresh |
| 移动端用 `uni.xxx` 替代 `window`/`document`；H5 专有用 `#ifdef H5` | `frontend-workflow` | 无直接 DOM 操作 |
| 中文注释：类型 JSDoc、函数 `@param`/`@returns`、核心逻辑行内、API 方法、Store State/Action | `frontend-workflow` | 关键位置有注释 |
| 未修改模板内置模块业务逻辑（`system/`、`api/` 视图 script 及对应 API/Mock/router/auth.ts/token.ts/adapter.web.ts） | `admin-template-setup` | 内置模块 script 逻辑未改 |

---

## C. 跨端契约一致性

> 这是最易漏、代价最大的一维。必须同时读前后端产物逐项比对。

| 规则 | 来源 | 检查方法 |
|------|------|----------|
| 命名映射逐项对应：`{Entity}QueryParams`↔`QueryMap`、`CreateParams`↔`CreateMap`、`UpdateParams`↔`UpdateMap`、`Item`↔`ItemMap`（含详情接口 `getXxxDetail()` 返回 `Item`） | `thirdnet-fullstack` | 前后端 DTO 类名一一对应 |
| 字段逐个对照：名称（snake_case）、类型（`number`↔`long`、`string`↔`string`/`DateTime`、`boolean`↔`bool`、`enum`↔`enum` 值同）、可空（`?`↔`?`） | `thirdnet-fullstack` | 字段三要素全匹配 |
| 分页结构：前端 `PaginatedResponse<T>` ↔ 后端 `PageListInfo<List<T>>`（`list`/`total`/`index`/`pages` 一致；页大小只在请求 `QueryMap.page_size`） | `thirdnet-fullstack` | 字段名一致 |
| 权限串逐字比对：前端 `v-permission`/`usePermission` 串 ↔ 后端 `[PermissionAuthorize]` 串 | `thirdnet-fullstack` | 两侧串逐字一致，无遗漏 |
| URL 路由 action（`/detail`/`/update`/`/delete`）≠ 权限 action（`query`/`edit`/`remove`），不混用 | `thirdnet-fullstack` | 详情权限非 `*:detail` |
| `约定同步检查清单` 7 项：HTTP 方法、字段命名、响应格式、DTO 后缀、认证流程、权限串格式、API 路由格式 | `thirdnet-fullstack` | 7 项逐一核验 |
| 创建端点 URL `/add` vs `/create`：被审模块**自身前后端一致**即可（见已知歧义） | `api-typescript-spec` vs `thirdnet-fullstack` | 模块内一致；不一致才报 Major |

---

## D. 业务功能正确性

> 依据 `spec.md` / `specs/{page}.md` 与通用工程准则，判断「实现是否真的对了」。

| 检查点 | 检查方法 |
|--------|----------|
| 业务逻辑与 spec 一致（字段语义、流程顺序、状态流转） | 对照 spec 逐条核验代码实现 |
| 边界与异常：空值/零值/负数/超长字符串/并发写入的兜底 | 审查关键分支与异常路径 |
| 每个变更端点都有对应权限覆盖（无越权裸奔接口） | 端点 ↔ `[PermissionAuthorize]` 全覆盖 |
| 数据完整性：唯一约束/外键关联（应用层）/事务边界/乐观并发 | 检查写入路径与并发控制 |
| 软删语义正确（`StatusEnum` 生效，查询过滤 `status=0`） | 查询是否带状态过滤 |
| 列表查询的过滤条件与 spec 的查询字段一致（模糊、范围、字典） | QueryMap 字段 ↔ spec 查询项 |
| 前端交互闭环：表单校验规则覆盖必填/格式/长度；提交后刷新列表/关弹窗 | 检查 `handleSubmit` 流程 |

---

## E. 性能

| 检查点 | 来源 | 检查方法 |
|--------|------|----------|
| N+1 查询（循环内查询 / 未用 `Include` 替代的应用层批量） | 通用准则 | 审查 Service 查询循环 |
| 只读查询未加 `AsNoTracking()` | `net-efcore-developer` | 查询路径用 AsNoTracking |
| 缺索引：`dept_id` 等过滤列、jsonb/array 未建 GIN | `net-auth` / `net-efcore-developer` | 实体配置有对应 `HasIndex` |
| 缓存误用：`BriefView`+`DetailView` 拆 key、循环 `RemoveSingle`/`GetSingle` 多键 | `net-cache-use` | 单 View 单 key；多键用 Multiple |
| 分页缺失或页大小无上限（`page_size` 应 1-1000） | `net-api-developer` | 用 `ToPageListAsync`，PageQueryDto 限制生效 |
| 批量写用 `SaveChanges` 循环而非 `IDbAsyncBulk`/CTE | `net-efcore-developer` | 大批量用 BulkCopy 或 CTE |
| 大表全表扫描 / `SELECT *` / 缺 `WHERE` | 通用准则 | 审查 SQL 与查询 |
| 前端：列表未分页、未做虚拟滚动的大表、未防抖的搜索 | `frontend-workflow` | 列表有分页；搜索有防抖 |

---

## F. 安全性

| 检查点 | 来源 | 检查方法 |
|--------|------|----------|
| **禁**自实现加密/哈希/随机，必须走框架 `AddCrypto` | `net-auth` | 无自研 crypto 代码 |
| `appsettings.json` 无真实密钥/密码（用占位描述串）；`Development.json`/`Production.json` 在 `.gitignore` | `net-microservice-generator` | 配置文件无真实秘密；gitignore 齐全 |
| `View`/缓存对象**不含**敏感字段（`password_hash`/token/PII） | `net-cache-use` | View/缓存类无敏感字段 |
| SQL **必参数化**，**禁**字符串拼接（`$"{var}"` 拼进 SQL） | `net-efcore-developer` | 用 `NpgsqlParameter` 或安全插值 |
| 权限全覆盖：所有变更端点带 `[PermissionAuthorize]`；公开端点（登录/刷新）例外且有理由 | `net-auth` | 端点权限覆盖核查 |
| refresh_token 单次失效（刷新即作废旧 token） | `net-auth` | 刷新逻辑作废旧 token |
| 文件上传/下载的路径校验、类型白名单、大小限制 | 通用准则 | 检查上传/下载处理 |
| 敏感操作有审计日志（`[OperLog]`） | `net-api-developer` | 变更端点有 OperLog |
| 前端不硬编码权限列表、不存敏感信息到 localStorage（Admin Web 用 sessionStorage） | `thirdnet-fullstack` / `api-typescript-spec` | 权限动态获取；存储介质正确 |
| 越权风险：前端隐藏按钮 ≠ 后端无校验，后端必须独立鉴权 | 通用准则 | 后端端点独立鉴权 |

---

## G. 文档与流程

| 检查点 | 来源 | 检查方法 |
|--------|------|----------|
| `backend/plan.md` / `changelog.md` / `spec.md` 存在且与代码一致 | `backend-workflow` | 文档存在且 changelog 有本次条目 |
| 前端 `frontend/{子系统}/spec.md` + `specs/{页面}.md` 存在且与代码一致 | `frontend-workflow` | 文档存在且反映变更 |
| changelog 渲染文件齐全（Web: `public/changelog.md`+`viewer.html`+`marked.min.js`；小程序: `static/` 同款） | `frontend-workflow` | 三件齐全 |
| 中文注释完整（后端 XML `///`/前端 JSDoc + 行内） | `backend-workflow` / `frontend-workflow` | 关键位置有注释（Stop Hook 也会查） |
| `dotnet build` 0 警告；前端 `vue-tsc --noEmit` / `vite build` 通过 | `backend-workflow` / `frontend-workflow` | 运行构建 |
| 文档驱动流程合规：非模板新功能有需求澄清痕迹；spec 先于编码 | `backend-workflow` | 流程顺序合规 |
| 无 `TODO`/`FIXME`/占位代码残留 | `backend-workflow` | grep `TODO`/`FIXME` |

---

## 速查：最易出 Critical 的高信号规则

审查时优先扫这些（命中即 Critical 或 Major）：

1. `DateTime.Now` 写入 `timestamptz` 列 → **Critical**（运行时必抛 `InvalidCastException`）
2. `[HttpPut]`/`[HttpDelete]`/`[HttpPatch]` → **Major**（网关屏蔽）
3. Controller 返回匿名对象或 EF 实体 → **Major**
4. 变更端点缺 `[PermissionAuthorize]` 或 `[OperLog]` → **Major**
5. 直接 `_tokenCache.SetTokenInvalidationTime` → **Major**
6. `appsettings.json` 含真实密钥 → **Critical**（安全）
7. SQL 字符串拼接 → **Critical**（注入）
8. `View`/缓存含 `password_hash` → **Critical**（敏感泄露）
9. 前后端权限串不一致 → **Major**（按钮不显示或 403）
10. 缺 `dept_id` 索引 → **Major**（权限过滤 Seq Scan）
11. 手写分页 / 直接 `el-pagination` → **Major**
12. 批量操作后未删缓存 → **Major**（脏数据）
