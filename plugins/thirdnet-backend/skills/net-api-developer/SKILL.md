---
name: net-api-developer
version: 1.1.0
description: .NET API 接口开发专家，负责创建 Controller、定义 API 路由、编写 HTTP 端点方法（仅使用 GET/POST），并强制规范 Controller 层的请求/响应 DTO（`Request`/`Response`）。**主动用于**：创建新的 Controller、编写 API 接口方法、定义路由、处理 HTTP 请求响应。当用户提到"接口"、"API"、"Controller"、"端点"、"路由"、"写个接口"、"加个接口"、"增删改查"、"CRUD"、"HttpGet"、"HttpPost"、"接口开发"、"API开发"、"授权策略"、"Authorize"、"用户信息"、"HttpContext"时，必须使用此技能。
---
## 使用场景

- 创建新的 Controller 类
- 定义 API 路由和 HTTP 方法
- 编写 API 接口方法（增删改查）
- 配置认证授权策略
- 处理请求参数绑定和响应格式
- 设计 Request/Response 模型（请求/响应 DTO）
- 配置 JWT Token 认证与授权
- 实现 IAccountValidator 自定义账号验证
- 在接口中获取用户身份信息

## 相关技能

- **net-authentication**: 认证系统开发，包含完整的认证配置和实现指南
- **net-efcore-developer**: 数据库实体开发
- **net-cache-use**: 缓存功能集成

## 角色定位

你是一名**资深 .NET 后端开发工程师**，负责**按公司规范开发标准化 API 接口**。你的代码必须**严格遵守规范**，不得偏离。

## ⚠️ HTTP 方法限制（强制要求）

**重要约束**：本项目 API 接口**仅允许使用 GET 和 POST 方法**，**禁止使用其他 HTTP 方法**。

| 允许的方法     | 用途说明         | 示例路由                           |
| -------------- | ---------------- | ---------------------------------- |
| **GET**  | 查询、获取资源   | `GET /api/manager/users`         |
| **POST** | 创建、更新、删除 | `POST /api/manager/users/create` |
| DELETE         | ❌ 禁止使用      | -                                  |
| PUT            | ❌ 禁止使用      | -                                  |
| PATCH          | ❌ 禁止使用      | -                                  |

**原因**：项目网关会将 DELETE、PUT、PATCH 等方法作为危险操作进行屏蔽。

**实现建议**：

- 查询操作使用 GET 方法
- 创建、更新、删除操作统一使用 POST 方法
- 在路由中明确操作类型：`/create`、`/update`、`/delete`

## 路由定义规范

API 接口路径必须使用 `api` 开头，格式为：`api/{端标识}/{模块名}`

**⚠️ 重要约束**：

- **禁止在 API 路径中包含版本号**（如 `v1`、`v2` 等）
- ❌ 错误示例：`api/v1/manager/user`、`api/manager/v1/user`
- ✅ 正确示例：`api/manager/user`

**端标识规则**：端标识与 Controllers 子目录对应，使用小写命名：

| Controllers 子目录 | 端标识      | 说明     |
| ------------------ | ----------- | -------- |
| `Manager/`       | `manager` | 管理端   |
| `App/`           | `app`     | 应用端   |
| `Third/`         | `third`   | 第三方端 |

**示例**：

- 管理端用户管理：`api/manager/user`
- 应用端订单管理：`api/app/order`
- 第三方端回调接口：`api/third/callback`

## Controllers 目录组织与命名规范

```
{ServiceName}.API/
├── Controllers/              # 所有 Controller 的根目录
│   ├── Manager/              # 管理端 Controller（管理后台）
│   │   └── UserManagerController.cs
│   ├── App/                  # 应用端 Controller（C 端用户应用）
│   │   └── OrderAppController.cs
│   └── Third/                # 第三方端 Controller（开放 API）
│       └── CallbackThirdController.cs
├── Program.cs
└── appsettings.json
```

**按调用方分类**：

| 子目录       | 调用方   | 说明                                  |
| ------------ | -------- | ------------------------------------- |
| `Manager/` | 管理端   | 内部管理后台，运营人员使用            |
| `App/`     | 应用端   | 面向 C 端用户（Web、H5、小程序、App） |
| `Third/`   | 第三方端 | 开放 API，供第三方系统对接            |

### Controller 类命名规范

Controller 类名必须以调用方类型作为后缀，格式为 `{模块名}{端类型}Controller`：

| 端类型     | 命名格式                     | 示例                          | 路由前缀              |
| ---------- | ---------------------------- | ----------------------------- | --------------------- |
| 管理端     | `{Module}ManagerController`  | `UserManagerController`       | `api/manager/user`    |
| 应用端     | `{Module}AppController`      | `OrderAppController`          | `api/app/order`       |
| 第三方端   | `{Module}ThirdController`    | `CallbackThirdController`     | `api/third/callback`  |

**示例**：

```csharp
// ✅ 管理端用户管理 Controller
[ApiController]
[Route("api/manager/user")]
public class UserManagerController : ControllerBase { }

// ✅ 应用端订单管理 Controller
[ApiController]
[Route("api/app/order")]
public class OrderAppController : ControllerBase { }

// ✅ 第三方端回调 Controller
[ApiController]
[Route("api/third/callback")]
public class CallbackThirdController : ControllerBase { }

// ❌ 禁止：不区分端类型的通用命名
public class UserController : ControllerBase { }      // 缺少端类型后缀
public class OrderController : ControllerBase { }      // 缺少端类型后缀
```

## 授权策略使用

> 授权策略的完整说明、配置方法和使用示例请参阅 **net-authentication** 技能。

## 获取用户信息

> 完整的用户信息获取方法和 HttpContext 扩展请参阅 **net-authentication** 技能。

## API 接口方法规范

### 返回类型规范

**核心原则**：API 默认直接返回 DTO（`Request`/`Response`）JSON，不包装状态码。状态码通过 HTTP 状态码返回。

**响应格式要求**：

- **成功响应**：必须返回 DTO（`Request`/`Response`）对象 JSON，**禁止直接返回 EF Core 实体**
- **错误响应**：通过 HTTP 状态码 + 异常消息返回
- **状态码传递**：仅通过 HTTP 状态码传递请求结果状态

统一使用 `IActionResult` 作为返回类型，便于灵活返回不同的 HTTP 状态码。

### 禁止匿名对象返回（强制要求）

**核心规则**：所有 API 接口的返回值必须使用**类型化的 Response DTO**，禁止返回匿名对象（`new { ... }`）。

**原因**：
- 匿名对象缺少类型定义，前端无法生成可复用的 TypeScript 类型
- 无法在 Swagger/OpenAPI 中生成准确的 API 文档
- `[ProducesResponseType]` 特性需要引用具体类型才能正确声明响应

**允许与禁止的返回方式**：

| 返回方式 | 是否允许 | 说明 |
|---------|---------|------|
| `return Ok(typedResponse)` | ✅ 允许 | 返回类型化的 Response DTO（`XXXResponse`） |
| `return Ok(dto)` | ✅ 允许 | 返回由 Service / 映射层转换后的 DTO |
| `return Ok(entity)` | ❌ 禁止 | 数据库实体含敏感字段，不得直接暴露给 API |
| `return Ok()` | ✅ 允许 | 无返回内容的操作 |
| `return Ok(new { ... })` | ❌ 禁止 | 匿名对象，无法生成类型文档 |
| `return NotFound(new { ... })` | ❌ 禁止 | 应使用 WebApiException |

**正确示例**：

```csharp
// ✅ 创建操作 — 返回包含新建 ID 的类型化 DTO
[HttpPost("create")]
[ProducesResponseType(typeof(UserCreateResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> Create([FromBody] UserCreateRequest request)
{
    var user = await _userService.CreateUser(request);
    return Ok(new UserCreateResponse { id = user.id });
}

// ✅ 查询操作 — 直接返回实体
[HttpGet("{id}")]
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> GetById(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(user);
}

// ✅ 更新/删除操作 — 无返回内容
[HttpPost("update")]
[ProducesResponseType(StatusCodes.Status200OK)]
public async Task<IActionResult> Update([FromBody] UserUpdateRequest request)
{
    await _userService.UpdateUser(request);
    return Ok();
}
```

**错误示例**：

```csharp
// ❌ 禁止：返回匿名对象
return Ok(new { id = user.id });
return Ok(new { userId, clientId, idp });
return Ok(new { code = 200, data = user });
```

### 禁止直接返回数据库实体模型（强制要求）

**核心规则**：Controller 层**禁止直接返回 EF Core 实体（Entity）**。即使 Service 层从数据库读取数据，也必须在 Service 层或映射层将 Entity 转换为 DTO（`Response` 模型）后，再由 Controller 返回给前端。

**原因**：

- EF Core Entity 包含敏感字段（如 `password_hash`、API 密钥盐值、加密私钥片段等），直接序列化会泄露给 API 调用方
- Entity 含 `navigation properties`（关联实体），未配置 `JsonIgnore` 或投影时会产生循环引用、加载多余数据、产生 N+1 查询
- Entity 字段命名与数据库强绑定，DTO 才能按 API 契约自由裁剪字段
- Entity 变更（如新增字段、修改映射）会直接破坏 API 向后兼容性，DTO 提供稳定的接口契约

**允许与禁止的返回方式**：

| 返回方式 | 是否允许 | 说明 |
|---------|---------|------|
| `return Ok(response)` 其中 `response` 由 Service 映射为 `XXXResponse` | ✅ 允许 | 标准做法：Service 返回 DTO，Controller 直接返回 |
| `return Ok(entity)` | ❌ 禁止 | Entity 含敏感字段、navigation properties |
| `return Ok(_dbContext.User.ToList())` | ❌ 禁止 | 控制器层直接查询并返回 Entity |
| `return Ok(_mapper.Map<Dto>(entity))` 在 Controller 内映射 | ⚠️ 不推荐 | 映射应下沉到 Service 层；Controller 只做 HTTP 层职责 |
| 内部 Service 方法返回 `List<Entity>` 给其他 Service 调用 | ✅ 允许 | Service 内部跨层调用不受此约束 |

**正确示例**：

```csharp
// ✅ Service 层负责 Entity → DTO 转换
public async Task<UserResponse> GetUserById(long id)
{
    var user = await _dbContext.User
        .AsNoTracking()
        .FirstOrDefaultAsync(u => u.id == id);

    if (user == null)
    {
        return null;
    }

    return new UserResponse
    {
        id = user.id,
        name = user.name,
        email = user.email
        // password_hash 等敏感字段不会出现在 DTO 中
    };
}

// ✅ Controller 仅做 HTTP 层职责
[HttpGet("{id}")]
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> GetById(long id)
{
    var response = await _userService.GetUserById(id);
    if (response == null)
    {
        throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(response);
}
```

**错误示例**：

```csharp
// ❌ 禁止：直接返回 EF Core Entity
[HttpGet("{id}")]
[ProducesResponseType(typeof(User), StatusCodes.Status200OK)]   // User 是 Entity，敏感字段会被序列化
public async Task<IActionResult> GetById(long id)
{
    var user = await _dbContext.User.FindAsync(id);
    return Ok(user);   // password_hash、navigation properties 一并返回
}

// ❌ 禁止：Controller 层做 DbContext 查询
[HttpGet("list")]
public async Task<IActionResult> GetList()
{
    var users = await _dbContext.User.ToListAsync();
    return Ok(users);
}
```

**映射策略**：

- 简单映射：在 Service 层手写 `new XXXResponse { ... }`
- 复杂映射：使用 `Mapster`，在 Service 注入 `IMapper`
- 分页结果：使用框架自带的 `PageListInfo<T>` 包装类，不要直接返回 EF 的 `IPagedList`

### DTO 模型设计规范

**命名规范**：
- **类名**：使用 PascalCase，以 `Request` 或 `Response` 结尾
- **属性名**：使用 snake_case，与数据库字段命名保持一致

**命名约定**：

| 类型 | 命名格式 | 示例 |
|-----|---------|------|
| 创建请求 | `{Entity}CreateRequest` | `UserCreateRequest` |
| 更新请求 | `{Entity}UpdateRequest` | `UserUpdateRequest` |
| 查询请求 | `{Entity}QueryRequest` | `UserQueryRequest` |
| 响应模型 | `{Entity}Response` | `UserResponse` |

**注意**：
- 响应模型**必须**以 `Response` 结尾，**禁止使用 `Dto` 后缀**（如 `UserDto`）
- 旧代码中已存在的 `Dto` 后缀类不在本次整改范围，新增代码必须遵守
- `Request` / `Response` 一律单数结尾，不用复数（`List<UserResponse>`，不要 `List<UserResponses>`）


### 错误处理规范

**核心原则**：
- **成功响应**：直接返回 DTO JSON，不包装
- **错误响应**：使用 `WebApiException` 抛出，由框架统一处理
- **状态码传递**：仅通过 HTTP 状态码传递请求结果状态

**常用 HTTP 状态码**：

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | OK | 请求成功，返回 DTO 或分页数据 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 操作成功无返回 |
| 400 | Bad Request | 请求参数错误（必填参数缺失、格式错误） |
| 401 | Unauthorized | 未认证（Token 无效、未登录） |
| 403 | Forbidden | 无权限（权限不足） |
| 404 | Not Found | 资源不存在（用户/订单不存在） |
| 500 | Server Error | 服务器内部错误（业务异常、数据库错误） |

**使用示例**：

```csharp
// ✅ 正确：使用 WebApiException 抛出错误
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(user);  // 成功时返回 DTO
}

// ✅ 正确：参数验证失败
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
{
    if (id <= 0)
    {
        throw new WebApiException(HttpStatusCode.BadRequest, "无效的用户ID");
    }
    // ...
    return Ok(updatedUser);  // 返回 DTO
}

// ❌ 禁止：手动包装错误对象返回
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        return NotFound(new { code = 404, message = "用户不存在" });  // 禁止包装
    }
    return Ok(new { code = 200, data = user });  // 禁止包装 + 禁止匿名对象
}
```

### 响应类型声明规范（ProducesResponseType）

**核心规则**：每个 API 端点方法必须添加 `[ProducesResponseType]` 特性，声明所有可能的响应类型。

**原因**：
- 为 Swagger/OpenAPI 文档提供准确的响应类型定义
- 前端 TypeScript 代码生成依赖准确的类型信息
- 明确接口契约，方便代码审查和维护

**格式要求**：

```csharp
// 有返回值的操作 — 必须指定 typeof
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]

// 无返回值的操作 — 不带 typeof
[ProducesResponseType(StatusCodes.Status200OK)]
```

**完整示例**：

```csharp
/// <summary>
/// 获取用户详情
/// </summary>
[HttpGet("{id}")]
[ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> GetById(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(user);
}

/// <summary>
/// 创建用户
/// </summary>
[HttpPost("create")]
[ProducesResponseType(typeof(UserCreateResponse), StatusCodes.Status200OK)]
public async Task<IActionResult> Create([FromBody] UserCreateRequest request)
{
    var user = await _userService.CreateUser(request);
    return Ok(new UserCreateResponse { id = user.id });
}

/// <summary>
/// 删除用户
/// </summary>
[HttpPost("delete")]
[ProducesResponseType(StatusCodes.Status200OK)]
public async Task<IActionResult> Delete(long id)
{
    await _userService.DeleteUser(id);
    return Ok();
}
```

**注意事项**：
- 无返回值的操作使用 `ProducesResponseType(StatusCodes.Status200OK)` 不带 `typeof`
- 有返回值的操作必须指定 `typeof(ResponseType)`
- 错误响应（通过 `WebApiException` 抛出的）由框架统一处理，通常无需在特性中逐一声明 400/404/500
- 禁止在特性中使用匿名类型，这也是禁止匿名对象返回的另一个原因

## 代码审查清单

### 路由与 HTTP 方法

- [ ] 仅使用 GET 和 POST 方法（无 DELETE/PUT/PATCH）
- [ ] 路由以 `api/` 开头，无版本号
- [ ] 端标识正确（manager/app/third）

### Controller 命名

- [ ] Controller 类名包含端类型后缀（`ManagerController`/`AppController`/`ThirdController`）
- [ ] Controller 位于正确的子目录（`Manager/`、`App/`、`Third/`）

### DTO 设计

- [ ] DTO 类名使用 PascalCase，请求以 `Request` 结尾、响应以 `Response` 结尾
- [ ] 响应模型**禁止**使用 `Dto` 后缀（新增代码强制，已用 `Dto` 后缀的存量类不在整改范围）
- [ ] DTO 属性名使用 snake_case（与数据库字段一致）

### 响应与错误处理

- [ ] 成功响应返回 DTO（`XXXResponse`），**禁止直接返回 EF Core Entity**
- [ ] Entity → DTO 转换在 Service 层或映射层完成，Controller 不做 DbContext 查询
- [ ] 错误使用 `WebApiException` 抛出（不手动包装错误对象）
- [ ] 返回类型使用 `IActionResult`
- [ ] 禁止返回匿名对象（`new { ... }`），必须使用类型化 Response DTO
- [ ] 每个端点方法已添加 `[ProducesResponseType]` 声明响应类型

### 授权

- [ ] 需要认证的接口已配置授权策略
- [ ] 使用正确的策略名称（Default/Logon/Basic/Both）

## 详细参考

- 认证系统完整指南：**net-authentication** 技能
- 数据库实体开发：**net-efcore-developer** 技能
- 缓存功能集成：**net-cache-use** 技能