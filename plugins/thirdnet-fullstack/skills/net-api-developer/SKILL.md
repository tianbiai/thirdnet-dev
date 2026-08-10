---
name: net-api-developer
description: >
  ThirdNet API 接口开发规范：AdminControllerBase（自动 OperatorContext）、端类型分层
  （Controller/Service/DTO 统一按 Manager/App/Third 分目录 + 类名带端后缀，跨端共用放 Shared/）、
  GET/POST-only、DTO 命名（{Entity}{Action}{Endpoint}Map）、OperLog 操作日志、
  Service 层模式（IDbContextFactory + 缓存 + 部门过滤）。禁止匿名对象与直接返回 EF Core 实体。
  当用户提到"controller"、"AdminControllerBase"、"service"、"DTO"、"OperLog"、"API"、
  "接口开发"、"写接口"、"CRUD"、"HttpGet"、"HttpPost"时，必须使用此技能。
license: MIT
metadata:
  version: "1.2.0"
  author: thirdnet
---

# ThirdNet API 接口开发

## Controller 规范

### AdminControllerBase

所有管理端 Controller **必须继承 AdminControllerBase**（而非 ControllerBase）：

```csharp
[Route("api/manager/notice")]
public class NoticeManagerController : AdminControllerBase
{
    private readonly NoticeManagerService _noticeManagerService;

    public NoticeManagerController(NoticeManagerService noticeManagerService)
    {
        _noticeManagerService = noticeManagerService;
    }
}
```

AdminControllerBase 提供：
- `CurrentUserId` — 当前登录用户 ID（从 JWT 提取）
- `CurrentUserName` — 当前登录用户名
- `CurrentDeptId` — 当前用户部门 ID
- 自动初始化 `IOperatorContext`（在 OnActionExecuting 中调用）
- 内置 `[ApiController]` 和 `[Authorize]`

> **例外**：当 Controller 包含不经过 JWT 认证的端点（如登录、刷新 Token 使用 Basic Auth）时，应直接继承 `ControllerBase`，而非 `AdminControllerBase`。原因是 `AdminControllerBase.OnActionExecuting` 会从 JWT Claims 提取 `user_id` 来初始化 `OperatorContext`，在 Basic Auth 请求中会导致 401 错误。典型示例：`AuthManagerController`。

### 端类型分层组织（Manager / App / Third / Shared）

一个业务模块通常会同时面向多个调用端：管理后台（Manager）、C 端应用（App）、第三方开放接口（Third）。不同端的**权限范围、返回字段、入参校验都不一样**——管理端的 `UserItemManagerMap` 字段最全（含部门、角色、状态），而 App 端的 `UserItemAppMap` 只暴露昵称、头像等公开字段。如果 Controller / Service / DTO 混在同一目录、共用类名，同一模块的多端代码会纠缠在一起，难以隔离、难以定位、容易越权泄露字段。

因此**所有随端点变化的代码**——Controller、Service、DTO(Map)——统一按端类型分目录，且类名带端后缀；**真正跨端共用**的逻辑放 `Shared/`、类名不带端后缀。命名、文件夹、URL 路由三者一一对齐，看任意一处即能定位另两处。

> 以下结构以 **Service 微服务项目**为例（`{ServiceName}.API`）；Admin 项目把根换成 `{ProjectName}.Admin.APIService/`，规则完全相同。详见 backend-workflow。

```
{ServiceName}.API/   （Admin 项目同理，根为 {ProjectName}.Admin.APIService/）
├── Controllers/
│   ├── Manager/              # 管理端（管理后台）
│   │   └── UserManagerController.cs
│   ├── App/                  # 应用端（C 端用户）
│   │   └── UserAppController.cs
│   ├── Third/                # 第三方端（开放 API）
│   │   └── CallbackThirdController.cs
│   └── Shared/               # 跨端共用 Controller（少见，如多端复用的健康检查）
├── Services/
│   ├── Manager/              # SysUserManagerService.cs
│   ├── App/                  # SysUserAppService.cs
│   ├── Third/                # 第三方回调/推送处理
│   └── Shared/               # 跨端共用业务逻辑，类名无端后缀（如 SysUserSharedService.cs）
└── DTOs/                     # 端类型优先，再按业务模块
    ├── Manager/System/       # UserItemManagerMap.cs / UserCreateManagerMap.cs ...
    ├── App/System/           # UserItemAppMap.cs
    ├── Third/                # 第三方出入参
    └── Shared/               # 跨端通用 Map，类名无端后缀（如 UserItemMap.cs）
```

> **端无关的层不参与此划分**：Models / EntityConfigurations / Cache 域 / Jobs / Auth 基础设施等是数据层或全局设施，不随端点变化，保持原有目录（如 `Models/`、`...Cache/Domain/`）。只有 Controller / Service / DTO 三层按端分。

#### 类名后缀规则

| 层 | 端特定（带后缀，放对应端目录） | 跨端共用（无后缀，放 Shared/） |
|----|------------------------------|------------------------------|
| Controller | `{Module}{Endpoint}Controller`：`UserManagerController` / `UserAppController` / `CallbackThirdController` | `{Module}Controller`（少见） |
| Service | `{Module}{Endpoint}Service`：`SysUserManagerService` / `SysUserAppService` | `{Module}SharedService` 或 `{Module}Service`（如 `SysUserSharedService`） |
| DTO(Map) | `{Entity}{Action}{Endpoint}Map`：`UserItemManagerMap` / `UserCreateAppMap` | `{Entity}{Action}Map`（如 `UserItemMap`） |

`{Endpoint}` 取值固定三选一：`Manager` / `App` / `Third`，与 URL 路由前缀、目录名、命名空间完全一致。

#### 命名 ↔ 文件夹 ↔ 路由 统一对照

以 `User` 模块为例，端类型在三个维度上一一对齐——只需知道其中一处，即可推出另两处：

| 端 | URL 路由前缀 | Controller | Service | 列表 DTO |
|----|------------|-----------|---------|---------|
| Manager | `api/manager/user/...` | `Controllers/Manager/UserManagerController.cs` | `Services/Manager/SysUserManagerService.cs` | `DTOs/Manager/System/UserItemManagerMap.cs` |
| App | `api/app/user/...` | `Controllers/App/UserAppController.cs` | `Services/App/SysUserAppService.cs` | `DTOs/App/System/UserItemAppMap.cs` |
| Third | `api/third/user/...` | `Controllers/Third/UserThirdController.cs` | `Services/Third/SysUserThirdService.cs` | `DTOs/Third/System/UserItemThirdMap.cs` |
| 共用 | — | `Controllers/Shared/`（如有） | `Services/Shared/SysUserSharedService.cs` | `DTOs/Shared/System/UserItemMap.cs` |

命名空间随之分层：`{ProjectName}.Admin.APIService.Controllers.Manager`、`...Services.App`、`...DTOs.Manager.System` 等。

#### 拆分原则：何时放 Shared/，何时各端一份

- **各端字段/权限不同** → 各端独立的 Service + DTO（如用户管理：Manager 端可改角色/状态，App 端只能改自己昵称）。这是**常态**，默认按端拆。
- **多端调用的同一段纯业务逻辑**（如发短信、算价格、生成订单号） → 抽到 `Shared/` 的共用 Service，各端 Service 注入并复用；不要为复用就把端特定的字段混进去。
- **DTO 共用判断**：若某 Map 被两个以上端原样使用、字段完全一致 → 放 `Shared/`；只要任一端字段不同，就拆成带端后缀的两份。宁可各端一份清晰，不要一份 Map 靠端类型 if 分支填字段。

### HTTP 方法限制

| 方法 | 用途 | 示例路由 |
|------|------|---------|
| **GET** | 查询、获取资源 | `GET /api/manager/notice/list` |
| **POST** | 创建、更新、删除 | `POST /api/manager/notice/create` |
| DELETE/PUT/PATCH | **禁止** | 网关会屏蔽这些方法 |

### 路由模式

```
格式：api/{端标识}/{模块名}/{操作}
端标识：manager / app / third
禁止在路由中包含版本号（v1、v2）
```

## 端点模板

以下为**管理端（Manager）** Controller 模板（路由 `api/manager/xxx/...`，类 `XxxManagerController`，注入 `XxxManagerService`）。App/Third 端把 `Manager` 段换成对应端、路由前缀换成 `app`/`third` 即可，DTO 与 Service 同步换端段。

```csharp
// ====== 列表查询 ======
[ProducesResponseType(typeof(PageListInfo<List<XxxItemManagerMap>>), 200)]
[PermissionAuthorize("module:xxx:list")]
[HttpGet("list")]
public async Task<IActionResult> GetList([FromQuery] XxxQueryManagerMap query)
{
    var result = await _xxxManagerService.GetList(query, CurrentUserId);
    return Ok(result);
}

// ====== 详情查询 ======
[ProducesResponseType(typeof(XxxDetailManagerMap), 200)]
[PermissionAuthorize("module:xxx:query")]
[HttpGet("{id}")]
public async Task<IActionResult> GetById(long id)
{
    var result = await _xxxManagerService.GetById(id, CurrentUserId);
    return Ok(result);
}

// ====== 新增 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:add")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Create)]
[HttpPost("create")]
public async Task<IActionResult> Add([FromBody] XxxCreateManagerMap dto)
{
    await _xxxManagerService.Add(dto, CurrentUserId, CurrentUserName);
    return Ok();
}

// ====== 更新 ======
[ProducesResponseType(typeof(IdResult), 200)]
[PermissionAuthorize("module:xxx:edit")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Update)]
[HttpPost("update")]
public async Task<IActionResult> Update([FromBody] XxxUpdateManagerMap dto)
{
    var result = await _xxxManagerService.Update(dto, CurrentUserId, CurrentUserName);
    return Ok(result);
}

// ====== 删除单个 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:remove")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Delete)]
[HttpPost("delete/{id}")]
public async Task<IActionResult> Delete(long id)
{
    await _xxxManagerService.Delete(id, CurrentUserId);
    return Ok();
}

// ====== 批量删除 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:remove")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Delete)]
[HttpPost("delete-batch")]
public async Task<IActionResult> DeleteBatch([FromBody] List<long> ids)
{
    await _xxxManagerService.DeleteBatch(ids, CurrentUserId);
    return Ok();
}
```

### 权限 + 操作日志组合

所有变更端点（create/update/delete）必须同时标注 `[PermissionAuthorize]` + `[OperLog]`。仅查询端点只需 `[PermissionAuthorize]`。

## 返回类型规范

### 禁止匿名对象返回

所有 API 返回值必须使用**类型化的 Map DTO**，禁止返回匿名对象（`new { ... }`）。

**原因**：匿名对象缺少类型定义，前端无法生成 TypeScript 类型，Swagger 无法生成准确文档。

### 禁止直接返回 EF Core 实体

Controller 层**禁止直接返回 EF Core 实体**。Entity → DTO 转换必须在 Service 层完成。

**原因**：实体含敏感字段（password_hash）、导航属性（循环引用）、字段命名与 API 契约不匹配。

| 返回方式 | 是否允许 |
|---------|---------|
| `return Ok(typedMap)` | ✅ |
| `return Ok(entity)` | ❌ 禁止 |
| `return Ok(new { ... })` | ❌ 禁止 |
| `return Ok()` | ✅ 无返回内容 |

### 映射策略

- 所有映射均手写：Service 层使用 `new XxxMap { ... }` 构造 DTO
- 复杂映射：将映射逻辑封装为私有方法或扩展方法，保持手写风格
- 分页结果：使用 `PageListInfo<T>`
- **禁止引入 AutoMapper、Mapster 等映射框架**

### ProducesResponseType 声明

每个端点方法必须添加 `[ProducesResponseType]`，有返回值时指定 `typeof`，无返回值时不带 `typeof`。

## DTO 规范

### 命名约定

所有 DTO **必须以 `Map` 结尾**，**禁止使用 Request/Response/Dto 后缀**。端特定的 DTO 在 `{Action}` 与 `Map` 之间插入端段 `{Endpoint}`（`Manager`/`App`/`Third`），与所在目录、命名空间一致；只有放在 `DTOs/Shared/` 的跨端共用 DTO 不带端段：

| 类型 | 命名格式（端特定） | 示例（Manager 端） | 共用（Shared/） |
|-----|------------------|-------------------|----------------|
| 创建请求 | `{Entity}Create{Endpoint}Map` | `NoticeCreateManagerMap` | `NoticeCreateMap` |
| 更新请求 | `{Entity}Update{Endpoint}Map` | `NoticeUpdateManagerMap` | `NoticeUpdateMap` |
| 查询请求 | `{Entity}Query{Endpoint}Map` | `NoticeQueryManagerMap` | `NoticeQueryMap` |
| 列表项响应 | `{Entity}Item{Endpoint}Map` | `NoticeItemManagerMap` | `NoticeItemMap` |
| 详情响应 | `{Entity}Detail{Endpoint}Map` | `NoticeDetailManagerMap` | `NoticeDetailMap` |
| 通用响应 | `{Entity}{Endpoint}Map` | `UserManagerMap`、`TokenManagerMap` | `UserMap`、`TokenMap` |

> **注**：少量简单场景的响应 DTO 也使用 `Item` 或 `Detail` 后缀（如 `CacheKeyItem`、`OnlineUserItem`），但同样禁止 `Request/Response/Dto` 后缀。这些全局工具型 DTO（无明确端归属）放 `DTOs/Shared/`，不带端段。

所有字段使用 snake_case，与前端 JSON 格式一致。每个 Map DTO 类独立一个 .cs 文件。文件按「端类型优先、模块次之」存放：`DTOs/Manager/{Module}/NoticeItemManagerMap.cs`。

### QueryMap

```csharp
public class XxxQueryMap : PageQueryDto
{
    public string? field_name { get; set; }
    public int? status { get; set; }
}
```

`PageQueryDto` 基类提供 `page_index`（默认 1）和 `page_size`（默认 20，范围 1-1000）。

### CreateMap / UpdateMap

验证使用 DataAnnotations：`[Required]`、`[StringLength]`、`[Range]`、`[OptionalEmail]`、`[OptionalPhone]`。

## 错误处理

使用 `WebApiException`，不使用 NotFound/BadRequest：

```csharp
throw new WebApiException(HttpStatusCode.NotFound, "记录不存在");
throw new WebApiException(HttpStatusCode.BadRequest, "参数无效");
throw new WebApiException(HttpStatusCode.Forbidden, "无权操作");
```

## Service 层规范

### Service 模板

Service 按端类型命名并归档：管理端 `Services/Manager/XxxManagerService.cs`，应用端 `Services/App/XxxAppService.cs`；跨端共用逻辑放 `Services/Shared/XxxSharedService.cs`（类名无端后缀），由各端 Service 注入复用。

```csharp
// 文件：Services/Manager/XxxManagerService.cs   命名空间：...Services.Manager
public class XxxManagerService
{
    private readonly IDbContextFactory<AdminDbContext> _dbFactory;
    private readonly XxxCache _xxxCache;
    private readonly OperatorContext _operatorContext;

    public XxxManagerService(
        IDbContextFactory<AdminDbContext> dbFactory,
        XxxCache xxxCache,
        OperatorContext operatorContext)
    {
        _dbFactory = dbFactory;
        _xxxCache = xxxCache;
        _operatorContext = operatorContext;
    }
}
```

### 核心模式

**1. 获取 DbContext**：每次方法调用 `await _dbFactory.CreateDbContextAsync()`。→ DbContext 必须用 `IDbContextFactory<T>` 获取，详见 net-efcore-developer。

**2. 初始化 OperatorContext**：`_operatorContext.Initialize(operatorId)`（幂等）。需要权限校验的增删改方法必须调用。

**3. 查询模式**：`AsNoTracking()` + 条件筛选 + 部门数据过滤 + `Select` 投影 + `ToPageListAsync` 分页（`ThirdNet.Vibe.WebAPI.ThirdNetWebApiExtensions` 扩展，框架提供，勿自写分页）。绝不返回实体。

**4. 变更模式**：验证（`AnyAsync` 预检唯一性）→ 创建实体 → 保存 → 缓存失效。**写入唯一键字段的保存必须用框架扩展 `SaveChangesWithUniqueGuardAsync(db, code, message)`，而非裸 `SaveChangesAsync`**——它捕获唯一约束冲突并转译为与预检一致的 `WebApiException`，兜底 `AnyAsync` 与落库之间的 TOCTOU 竞态（否则裸 `DbUpdateException` 冒泡成 500）。`code`/`message` 与预检命中时保持一致。完整示例见 [controller-service-examples](references/controller-service-examples.md) 的 Add 方法，方法语义见 net-efcore-developer「保存变更 / 唯一冲突兜底」。

**5. 事务（安全关键操作）**：使用 `Serializable` 隔离级别。

### 部门数据过滤

```csharp
var visibleDeptIds = await DeptFilterHelper.GetVisibleDeptIds(
    user.dept_id, user.include_sub_depts,
    id => _deptCache.GetDeptChildren(id));
queryable = queryable.Where(x => visibleDeptIds.Contains(x.dept_id));
```

### 缓存失效

变更操作完成后，删除所有相关缓存键：单条 + 字典 + 关联缓存。

→ 涉及用户/角色权限变更时，统一调用 `UserCacheInvalidation.InvalidateUserAuthAsync`，详见 net-cache-use。

## DI 注册

在 Startup.cs 第 9 步添加各端 Service 的注册：`services.AddScoped<XxxManagerService>();`（App/Third 端同理，各自一个 `AddScoped`；跨端共用 Service 注册 `XxxSharedService`）。

## 代码审查清单

### 路由与 HTTP 方法
- [ ] 仅使用 GET 和 POST 方法
- [ ] 路由以 `api/` 开头，端标识（manager/app/third）与目标端一致，无版本号

### 端类型分层
- [ ] 端特定类（Controller/Service/DTO）按端类型分目录（Manager/App/Third），跨端共用类放 Shared/
- [ ] 端特定类类名带端后缀：`{Module}{Endpoint}Controller` / `{Module}{Endpoint}Service` / `{Entity}{Action}{Endpoint}Map`
- [ ] 同一模块的 URL 路由前缀、目录、命名空间、类名端段四处一致

### 命名
- [ ] DTO 类名以 `Map` 结尾，属性使用 snake_case
- [ ] 禁止使用 Request/Response/Dto 后缀

### 响应与错误处理
- [ ] 返回 Map DTO，禁止匿名对象和 EF Core 实体
- [ ] Entity → DTO 转换在 Service 层完成
- [ ] 使用 WebApiException 抛出错误
- [ ] 写入唯一键字段的端点用 `SaveChangesWithUniqueGuardAsync` 兜底（而非裸 `SaveChangesAsync` + 手写唯一 catch，或裸 `DbUpdateException` 冒泡成 500）
- [ ] 每个端点有 `[ProducesResponseType]`

### 授权
- [ ] 变更端点标注 `[PermissionAuthorize]` + `[OperLog]`
- [ ] 查询端点标注 `[PermissionAuthorize]`

### 文件组织
- [ ] 每个 .cs 文件只包含一个 class 定义

## 框架类型速查

下列类型在本技能涉及的 Controller/Service 开发中频繁使用。**更完整的可复用类清单（命名空间 + 文件 + 用途）见 [framework-and-template-catalog](../backend-workflow/references/framework-and-template-catalog.md)**。

| 类型 | 命名空间 | 说明 |
|------|----------|------|
| `AdminControllerBase` | `{ProjectName}.Common.Controllers` | Admin 控制器基类，提供 `CurrentUserId`/`CurrentUserName`/`CurrentDeptId`，自动初始化 `IOperatorContext` |
| `WebApiException` | `ThirdNet.Vibe.WebAPI` | 业务异常类，构造参数 `(HttpStatusCode, string message)` |
| `SaveChangesWithUniqueGuardAsync` | `ThirdNet.Vibe.WebAPI`（DbContext 扩展） | **保存兜底扩展**：`db.SaveChangesWithUniqueGuardAsync(HttpStatusCode, string)` —— 保存变更并在唯一约束冲突时转译为 `WebApiException`，兜底 `AnyAsync` 查重与落库之间的 TOCTOU 竞态 |
| `PageQueryDto` | `{ProjectName}.Common.DTOs` | 分页查询基类，含 `page_index`、`page_size` |
| `PageListInfo<T>` | `ThirdNet.Vibe.WebAPI` | 分页返回类型，含 `List`、`Total`、`Index`、`Pages` |
| `ToPageListAsync` | `ThirdNet.Vibe.WebAPI.ThirdNetWebApiExtensions` | **分页扩展**：`IQueryable<T>.ToPageListAsync(page_index, page_size) → Task<PageListInfo<List<T>>>`，勿自写分页 |
| `IdResult` | `{ProjectName}.Common.DTOs` | 新增/更新操作的返回类型，含 `id` |
| `UploadResult` | `{ProjectName}.Common.DTOs` | 文件上传响应，含 `file_name`（GUID 文件名 + 扩展名）和 `url`（相对路径如 `/uploads/xxx.jpg`） |
| `IPasswordHasher` | `ThirdNet.Vibe.Common.Algorithm.Abstractions` | 密码哈希接口，`Hash(plainPassword)` / `Verify(...)`；经 `AddCrypto` 注册 |
| `PermissionAuthorizeAttribute` | `ThirdNet.Vibe.WebAPI` | 权限授权特性，参数为权限字符串（如 `"sys:user:list"`） |
| `OperLogAttribute` | `{ProjectName}.Common.OperLog` | 操作日志特性，参数 `Title`、`BusinessType` |
| `IOperatorContext` / `OperatorContext` | | `{ProjectName}.Common.Interfaces` / `{ProjectName}.Cache.Context` | 操作者上下文（Scoped）。`Initialize(operatorId)`（幂等）、`HasWildcardPermission()`、`GetUserInfo()`、`GetUserRoleIds()`、`GetVisibleDeptIds()`——同一请求内懒加载缓存，避免重复读 Redis |
| `DeptFilterHelper` | `{ProjectName}.Common.Extensions` | 部门数据范围过滤，`GetVisibleDeptIds()` |
| `TreeBuilder` | `ThirdNet.Vibe.Common` | 扁平列表 → 树，`BuildForest()`（**仅此方法**） |
| `TreeHelper` | `ThirdNet.Vibe.Common` | 树操作：`FlattenTree()` / `BuildNameMap()` / `ValidateNoCircularReference()`（与 `TreeBuilder` 是两个类，勿混淆） |
| `UserCacheInvalidation` | `{ProjectName}.Admin.APIService.Services` | `InvalidateUserAuthAsync(userCache, tokenCache, userId)`，权限/角色变更后统一失效 |

> `{ProjectName}` = 创建项目时指定的名称前缀（模板默认 `ThirdNetVibe`）；`ThirdNet.Vibe.*` 来自框架 NuGet 库。模板生成层命名空间**并非统一带 `.Admin.`**：主机/数据库层 `{ProjectName}.Admin.APIService`/`.Admin.Database`，但公共工具层 `Tools/{ProjectName}.Common`、`Tools/{ProjectName}.Cache` 的命名空间是 `{ProjectName}.Common.*`/`{ProjectName}.Cache.*`（**无 `.Admin.` 中缀**），注意区分。

## 完整示例

参考 [controller-service-examples.md](references/controller-service-examples.md) 查看 UserManagerController + SysUserManagerService 的完整代码（均位于 Manager 端目录）。

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动流程（→ 见该技能）
- **net-efcore-developer**: 数据库实体开发
- **net-cache-use**: 缓存集成
- **net-auth**: 认证与授权（`[PermissionAuthorize]` 使用位置、权限字符串）
