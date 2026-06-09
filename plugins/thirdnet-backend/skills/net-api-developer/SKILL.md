---
name: net-api-developer
description: >
  ThirdNet API 接口开发规范。覆盖 AdminControllerBase（CurrentUserId/Name/DeptId、
  自动 OperatorContext 初始化）、Controller 目录组织（Manager/App/Three）、
  GET/POST-only 约定、DTO 命名（{Entity}{Action}Map）、PermissionAuthorize 属性、
  OperLog 操作日志、WebApiException 错误处理、PageListInfo 分页、
  Service 层完整模式（IDbContextFactory + 缓存注入 + OperatorContext + 部门过滤 + 缓存失效）。
  禁止匿名对象返回、禁止直接返回 EF Core 实体、ProducesResponseType 声明要求。
  当用户提到"controller"、"AdminControllerBase"、"service"、"DTO"、
  "PermissionAuthorize"、"OperLog"、"API"、"snake_case API"、"端点"、
  "写接口"、"创建接口"、"接口开发"、"CRUD"、"HttpGet"、"HttpPost"时，必须使用此技能。
---

# ThirdNet API 接口开发

## Controller 规范

### AdminControllerBase

所有管理端 Controller **必须继承 AdminControllerBase**（而非 ControllerBase）：

```csharp
[Route("api/manager/notice")]
public class NoticeManagerController : AdminControllerBase
{
    private readonly NoticeService _noticeService;

    public NoticeManagerController(NoticeService noticeService)
    {
        _noticeService = noticeService;
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

### Controllers 目录组织

```
{ServiceName}.API/
├── Controllers/
│   ├── Manager/              # 管理端（管理后台）
│   │   └── UserManagerController.cs
│   ├── App/                  # 应用端（C 端用户）
│   │   └── OrderAppController.cs
│   └── Third/                # 第三方端（开放 API）
│       └── CallbackThirdController.cs
```

Controller 类名必须以端类型作为后缀：`{Module}ManagerController`、`{Module}AppController`、`{Module}ThirdController`。

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

```csharp
// ====== 列表查询 ======
[ProducesResponseType(typeof(PageListInfo<List<XxxItemMap>>), 200)]
[PermissionAuthorize("module:xxx:list")]
[HttpGet("list")]
public async Task<IActionResult> GetList([FromQuery] XxxQueryMap query)
{
    var result = await _xxxService.GetList(query, CurrentUserId);
    return Ok(result);
}

// ====== 详情查询 ======
[ProducesResponseType(typeof(XxxDetailMap), 200)]
[PermissionAuthorize("module:xxx:query")]
[HttpGet("{id}")]
public async Task<IActionResult> GetById(long id)
{
    var result = await _xxxService.GetById(id, CurrentUserId);
    return Ok(result);
}

// ====== 新增 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:add")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Create)]
[HttpPost("create")]
public async Task<IActionResult> Add([FromBody] XxxCreateMap dto)
{
    await _xxxService.Add(dto, CurrentUserId, CurrentUserName);
    return Ok();
}

// ====== 更新 ======
[ProducesResponseType(typeof(IdResult), 200)]
[PermissionAuthorize("module:xxx:edit")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Update)]
[HttpPost("update")]
public async Task<IActionResult> Update([FromBody] XxxUpdateMap dto)
{
    var result = await _xxxService.Update(dto, CurrentUserId, CurrentUserName);
    return Ok(result);
}

// ====== 删除单个 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:remove")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Delete)]
[HttpPost("delete/{id}")]
public async Task<IActionResult> Delete(long id)
{
    await _xxxService.Delete(id, CurrentUserId);
    return Ok();
}

// ====== 批量删除 ======
[ProducesResponseType(200)]
[PermissionAuthorize("module:xxx:remove")]
[OperLog(Title = "Xxx管理", BusinessType = BusinessTypeEnum.Delete)]
[HttpPost("delete-batch")]
public async Task<IActionResult> DeleteBatch([FromBody] List<long> ids)
{
    await _xxxService.DeleteBatch(ids, CurrentUserId);
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

### ProduceProducesResponseType 声明

每个端点方法必须添加 `[ProducesResponseType]`，有返回值时指定 `typeof`，无返回值时不带 `typeof`。

## DTO 规范

### 命名约定

所有 DTO **必须以 `Map` 结尾**，**禁止使用 Request/Response/Dto 后缀**：

| 类型 | 命名格式 | 示例 |
|-----|---------|------|
| 创建请求 | `{Entity}CreateMap` | `NoticeCreateMap` |
| 更新请求 | `{Entity}UpdateMap` | `NoticeUpdateMap` |
| 查询请求 | `{Entity}QueryMap` | `NoticeQueryMap` |
| 列表项响应 | `{Entity}ItemMap` | `NoticeItemMap` |
| 详情响应 | `{Entity}DetailMap` | `NoticeDetailMap` |
| 通用响应 | `{Entity}Map` | `UserMap`、`TokenMap` |

> **注**：少量简单场景的响应 DTO 也使用 `Item` 或 `Detail` 后缀（如 `CacheKeyItem`、`OnlineUserItem`），但同样禁止 `Request/Response/Dto` 后缀。

所有字段使用 snake_case，与前端 JSON 格式一致。每个 Map DTO 类独立一个 .cs 文件。

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

```csharp
public class XxxService
{
    private readonly IDbContextFactory<AdminDbContext> _dbFactory;
    private readonly XxxCache _xxxCache;
    private readonly OperatorContext _operatorContext;

    public XxxService(
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

**1. 获取 DbContext**：每次方法调用 `await _dbFactory.CreateDbContextAsync()`，绝不直接注入。

**2. 初始化 OperatorContext**：`_operatorContext.Initialize(operatorId)`（幂等）。需要权限校验的增删改方法必须调用。

**3. 查询模式**：`AsNoTracking()` + 条件筛选 + 部门数据过滤 + `Select` 投影 + `ToPageListAsync` 分页。绝不返回实体。

**4. 变更模式**：验证 → 创建实体 → `SaveChangesAsync` → 缓存失效。

**5. 事务（安全关键操作）**：使用 `Serializable` 隔离级别。

### 部门数据过滤

```csharp
var visibleDeptIds = await DeptFilterHelper.GetVisibleDeptIds(
    user.dept_id, user.include_sub_depts,
    id => _deptCache.GetDeptChildren(id));
queryable = queryable.Where(x => visibleDeptIds.Contains(x.dept_id));
```

### 缓存失效

变更操作完成后，删除所有相关缓存键：单条 + 字典 + 关联缓存。如果涉及权限变更，还需要 `RemovePermissionCache` 和 `SetTokenInvalidationTime`。

## DI 注册

在 Startup.cs 第 9 步添加：`services.AddScoped<XxxService>();`

## 代码审查清单

### 路由与 HTTP 方法
- [ ] 仅使用 GET 和 POST 方法
- [ ] 路由以 `api/` 开头，无版本号
- [ ] Controller 按端类型分目录（Manager/App/Third）

### 命名
- [ ] Controller 类名包含端类型后缀
- [ ] DTO 类名以 `Map` 结尾，属性使用 snake_case
- [ ] 禁止使用 Request/Response/Dto 后缀

### 响应与错误处理
- [ ] 返回 Map DTO，禁止匿名对象和 EF Core 实体
- [ ] Entity → DTO 转换在 Service 层完成
- [ ] 使用 WebApiException 抛出错误
- [ ] 每个端点有 `[ProducesResponseType]`

### 授权
- [ ] 变更端点标注 `[PermissionAuthorize]` + `[OperLog]`
- [ ] 查询端点标注 `[PermissionAuthorize]`

### 文件组织
- [ ] 每个 .cs 文件只包含一个 class 定义

## 框架类型速查

以下类型在 ThirdNet.Vibe 框架中定义，在 Controller 和 Service 开发中频繁使用：

| 类型 | 命名空间 | 说明 |
|------|----------|------|
| `AdminControllerBase` | `{ProjectName}.Admin.Common.Controllers` | Admin 控制器基类，提供 `CurrentUserId`、`CurrentUserName`、`HttpContext` 等 |
| `WebApiException` | `ThirdNet.Vibe.WebAPI` | 业务异常类，构造参数 `(HttpStatusCode, string message)` |
| `PageQueryDto` | `{ProjectName}.Admin.Common.DTOs` | 分页查询基类，含 `page_index`、`page_size` 属性 |
| `PageListInfo<T>` | `ThirdNet.Vibe.Common` | 分页返回类型，含 `List`、`Total`、`Index`、`Pages` 属性 |
| `IdResult` | `ThirdNet.Vibe.Common` | 新增/更新操作的返回类型，含 `id` 属性 |
| `IPasswordHasher` | `ThirdNet.Vibe.WebAPI` | 密码哈希接口，提供 `Hash(plainPassword)` 方法 |
| `PermissionAuthorizeAttribute` | `ThirdNet.Vibe.WebAPI` | 权限授权特性，参数为权限字符串（如 `"sys:user:list"`） |
| `OperLogAttribute` | `{ProjectName}.Admin.Common.OperLog` | 操作日志特性，参数 `Title`、`BusinessType` |
| `BusinessTypeEnum` | `{ProjectName}.Admin.Common.Enums` | 操作日志业务类型枚举（`Create`、`Update`、`Delete` 等） |
| `OperatorContext` | `ThirdNet.Vibe.WebAPI` | 操作者上下文（Scoped），用于请求级数据范围缓存 |
| `DeptFilterHelper` | `{ProjectName}.Admin.Common.Extensions` | 部门数据范围过滤工具，`GetVisibleDeptIds()` 方法 |
| `TreeBuilder` | `{ProjectName}.Admin.Common.Extensions` | 树形数据构建工具，`BuildForest()` / `BuildNameMap()` 方法 |
| `StatusEnum` | `{ProjectName}.Admin.Common.Enums` | 状态枚举（`Normal = 0`、`Disabled = 1`） |

> `{ProjectName}` 是创建项目时指定的名称前缀，如 `ThirdNet`。

## 完整示例

参考 [controller-service-examples.md](references/controller-service-examples.md) 查看 UserManagerController + SysUserService 的完整代码。

## 相关技能

- **backend-workflow**: 完整工作流和文档驱动开发
- **net-efcore-developer**: 数据库实体开发
- **net-cache-use**: 缓存集成
- **net-rbac**: 权限体系
- **net-authentication**: 认证系统
