---
name: net-api-developer
description: .NET API 接口开发专家，负责创建 Controller、定义 API 路由、编写 HTTP 端点方法（仅使用 GET/POST）。**主动用于**：创建新的 Controller、编写 API 接口方法、定义路由、处理 HTTP 请求响应。当用户提到"接口"、"API"、"Controller"、"端点"、"路由"、"写个接口"、"加个接口"、"增删改查"、"CRUD"、"HttpGet"、"HttpPost"、"接口开发"、"API开发"时，必须使用此技能。
---
## 使用场景

- 创建新的 Controller 类
- 定义 API 路由和 HTTP 方法
- 编写 API 接口方法（增删改查）
- 配置认证授权策略
- 处理请求参数绑定和响应格式
- 设计 DTO 请求/响应模型
- 配置 JWT Token 认证与授权
- 实现 IAccountValidator 自定义账号验证
- 在接口中获取用户身份信息

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

**端标识规则**：
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

## Controllers 目录组织规范

```
{ProjectName}.{ServiceName}.API/
├── Controllers/              # 所有 Controller 的根目录
│   ├── Manager/              # 管理端 Controller（管理后台）
│   ├── App/                  # 应用端 Controller（C 端用户应用）
│   └── Third/                # 第三方端 Controller（开放 API）
├── Program.cs
└── appsettings.json
```

**按调用方分类**：

| 子目录       | 调用方   | 说明                                  |
| ------------ | -------- | ------------------------------------- |
| `Manager/` | 管理端   | 内部管理后台，运营人员使用            |
| `App/`     | 应用端   | 面向 C 端用户（Web、H5、小程序、App） |
| `Third/`   | 第三方端 | 开放 API，供第三方系统对接            |

## Controller 开发模板

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ContractService.Api.Controllers.Manager
{
    /// <summary>
    /// 用户管理控制器
    /// </summary>
    [Route("api/manager/user")]  // 注意：路径不含版本号
    [ApiController]
    [ApiExplorerSettings(GroupName = "manager")]
    [SwaggerTag("用户管理")]
    [Authorize(Policy = "manager-policy")]
    public class UserController : ControllerBase
    {
        private readonly ILogger<UserController> _logger;

        public UserController(ILogger<UserController> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// 获取用户列表
        /// </summary>
        /// <param name="page">页码</param>
        /// <param name="pageSize">每页大小</param>
        /// <returns>用户列表（直接返回实体JSON，不包装状态码）</returns>
        [HttpGet("list")]
        public async Task<IActionResult> GetUserList(int page = 1, int pageSize = 10)
        {
            // TODO: 实现业务逻辑，直接返回实体或分页结果
            return Ok(new { list = new List<object>(), total = 0 });
        }

        /// <summary>
        /// 创建用户
        /// </summary>
        /// <param name="request">创建请求</param>
        /// <returns>创建的用户实体</returns>
        [HttpPost("create")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            // TODO: 实现业务逻辑，直接返回创建的实体
            // 错误时抛出 WebApiException
            return Ok(createdUser);  // 直接返回实体
        }
    }
}
```

## Controller 属性说明

| 属性                    | 说明                                              |
| ----------------------- | ------------------------------------------------- |
| `Route`               | 定义路由前缀，必须以 `api` 开头，端标识使用小写 |
| `ApiController`       | 标识为 API 控制器，启用自动模型验证等功能         |
| `ApiExplorerSettings` | 配置 Swagger 文档分组，端标识使用小写             |
| `SwaggerTag`          | Swagger 文档中显示的中文标签                      |
| `Authorize`           | 配置认证授权策略（如不需要认证可省略）            |

## API 接口方法规范

### 返回类型规范

**核心原则**：API 默认直接返回实体 JSON，不包装状态码。状态码通过 HTTP 状态码返回。

**响应格式要求**：

- **成功响应**：直接返回实体对象 JSON，不包装任何结果状态码
- **错误响应**：通过 HTTP 状态码 + 异常消息返回
- **状态码传递**：仅通过 HTTP 状态码传递请求结果状态

统一使用 `IActionResult` 作为返回类型，便于灵活返回不同的 HTTP 状态码。

```csharp
// ✅ 推荐：成功直接返回实体
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        throw new WebApiException(System.Net.HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(user);  // 直接返回实体JSON，不包装
}

// ✅ 推荐：列表查询直接返回列表
public async Task<IActionResult> GetUserList(int page = 1, int pageSize = 10)
{
    var (list, total) = await _userService.GetPagedUsers(page, pageSize);
    return Ok(new { list, total });  // 简单的分页结构
}

// ❌ 禁止：包装状态码的响应格式
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    return Ok(new { code = 200, data = user, message = "success" });  // 禁止这种包装
}

// ❌ 不推荐：直接返回 DTO 类型（无法灵活控制状态码）
public async Task<UserDto> GetUser(long id)
{
    return await _userService.GetUserById(id);
}
```

### 参数绑定规范

| 参数来源    | 特性             | 示例                              |
| ----------- | ---------------- | --------------------------------- |
| URL 路径    | `[FromRoute]`  | `GET /api/users/{id}`           |
| 查询字符串  | `[FromQuery]`  | `GET /api/users?page=1&size=10` |
| 请求 Body   | `[FromBody]`   | `POST /api/users/create`        |
| 请求 Header | `[FromHeader]` | 从 Header 获取参数                |
| 表单数据    | `[FromForm]`   | 表单提交                          |

### DTO 模型设计规范

**命名规范**：
- **类名**：使用 PascalCase，以 `Request` 或 `Response` 结尾
- **属性名**：使用小写，与数据库字段命名保持一致

**命名约定**：

| 类型 | 命名格式 | 示例 |
|-----|---------|------|
| 创建请求 | `{Entity}CreateRequest` | `UserCreateRequest` |
| 更新请求 | `{Entity}UpdateRequest` | `UserUpdateRequest` |
| 查询请求 | `{Entity}QueryRequest` | `UserQueryRequest` |
| 响应模型 | `{Entity}Response` 或 `{Entity}Dto` | `UserResponse`、`UserDto` |

**示例模板**：

```csharp
/// <summary>
/// 用户创建请求
/// </summary>
public class UserCreateRequest
{
    /// <summary>
    /// 用户名
    /// </summary>
    public string user_name { get; set; }

    /// <summary>
    /// 邮箱地址
    /// </summary>
    public string email { get; set; }

    /// <summary>
    /// 部门ID
    /// </summary>
    public long department_id { get; set; }
}

/// <summary>
/// 用户更新请求
/// </summary>
public class UserUpdateRequest
{
    /// <summary>
    /// 用户ID
    /// </summary>
    public long id { get; set; }

    /// <summary>
    /// 用户名
    /// </summary>
    public string user_name { get; set; }

    /// <summary>
    /// 状态
    /// </summary>
    public int state { get; set; }
}
```

### 错误处理规范

**核心原则**：
- **成功响应**：直接返回实体 JSON，不包装
- **错误响应**：使用 `WebApiException` 抛出，由框架统一处理
- **状态码传递**：仅通过 HTTP 状态码传递请求结果状态

**常用 HTTP 状态码**：

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | OK | 请求成功，返回实体或分页数据 |
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
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");
    }
    return Ok(user);  // 成功时直接返回实体
}

// ✅ 正确：参数验证失败
public async Task<IActionResult> UpdateUser(long id, UpdateUserRequest request)
{
    if (id <= 0)
    {
        throw new WebApiException(HttpStatusCode.BadRequest, "无效的用户ID");
    }
    // ...
    return Ok(updatedUser);  // 直接返回更新后的实体
}

// ❌ 禁止：手动包装错误对象返回
public async Task<IActionResult> GetUser(long id)
{
    var user = await _userService.GetUserById(id);
    if (user == null)
    {
        return NotFound(new { code = 404, message = "用户不存在" });  // 禁止包装
    }
    return Ok(new { code = 200, data = user });  // 禁止包装
}
```

## 服务层集成

本项目使用基于 RSA 的 JWT Token 认证机制，通过统一的认证服务（IdentityService）进行身份验证。

### 认证服务端配置

认证服务需要配置以下组件：

```csharp
// Startup.cs 服务注册
public void ConfigureServices(IServiceCollection services)
{
    // 自定义 Token 过期时间缓存（可选）
    services.AddSingleton<IAccountTokenTimeCache, CustomAccountTokenTimeCache>();

    // 配置 RSA JWT 认证
    services.AddThirdNetDefaultRSAJwt(Configuration);

    // 配置账号验证器
    services.AddScoped<IAccountValidator, DefaultAccountValidator>();
}
```

### IAccountValidator 账号验证器

实现 `IAccountValidator` 接口来验证用户账号密码并返回自定义 Claims：

```csharp
public class DefaultAccountValidator : IAccountValidator
{
    public async Task<List<Claim>> Validate(string account, string password, string[] scopes)
    {
        // 1. 根据 scope 验证账号密码
        // 2. 创建自定义 claims（不应保存敏感信息，只保存标识信息）

        var custom_claims = new List<Claim>();

        // 身份提供者（如：wechat、tourist、wechatapp）
        custom_claims.Add(new Claim("idp", "wechat"));

        // 用户唯一标识
        custom_claims.Add(new Claim(ClaimTypes.NameIdentifier, "用户ID"));

        return custom_claims;
    }
}
```

### Token 端点规范

| 端点                       | 方法 | 说明                                    |
| -------------------------- | ---- | --------------------------------------- |
| `/connect/token`         | POST | 获取 access_token（可选 refresh_token） |
| `/connect/token/refresh` | POST | 使用 refresh_token 刷新 access_token    |

**获取 Token 请求参数**（form-data）：

| 参数     | 类型   | 说明                                                                 |
| -------- | ------ | -------------------------------------------------------------------- |
| username | string | 用户名                                                               |
| password | string | 密码                                                                 |
| scope    | string | 权限范围，多个用空格分隔，如 `offline_access` 可获取 refresh_token |

**Token 响应格式**：

```json
{
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIs..."  // 仅当 scope 包含 offline_access 时返回
}
```

**刷新 Token 请求参数**（form-data）：

| 参数          | 类型   | 说明                     |
| ------------- | ------ | ------------------------ |
| refresh_token | string | 之前获取的 refresh_token |
