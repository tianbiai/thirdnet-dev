---
name: net-api-developer
description: .NET API 接口开发专家，负责创建 Controller、定义 API 路由、编写 HTTP 端点方法（仅使用 GET/POST）。**主动用于**：创建新的 Controller、编写 API 接口方法、定义路由、处理 HTTP 请求响应。当用户提到"接口"、"API"、"Controller"、"端点"、"路由"、"写个接口"、"加个接口"、"增删改查"、"CRUD"、"HttpGet"、"HttpPost"、"接口开发"、"API开发"、"授权策略"、"Authorize"、"用户信息"、"HttpContext"时，必须使用此技能。
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

## 授权策略使用

> 授权策略的完整说明、认证方式对比和配置方法请参阅 **net-authentication** 技能。

**快速参考**：

| 策略名 | 认证方式 | 使用场景 |
|-------|---------|---------|
| Default | Basic + Bearer | 一般接口，支持应用和用户调用 |
| Logon | Bearer | 需要用户登录的接口 |
| Basic | Basic | 仅允许应用调用的接口 |
| Both | Basic + Bearer | 两种认证都支持 |

```csharp
[Authorize]                              // 默认策略
[Authorize(Policy = "Logon")]            // 需要用户登录
[Authorize(Policy = "Basic")]            // 仅应用间调用
[AllowAnonymous]                         // 无需认证
```

## 获取用户信息

> 完整的用户信息获取方法和 HttpContext 扩展请参阅 **net-authentication** 技能。

**快速参考**：

```csharp
// 获取用户 ID
var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
// 获取客户端应用 ID
var clientId = HttpContext.GetCurrentClientId();
// 判断是否已认证
var isAuth = HttpContext.User.Identity?.IsAuthenticated ?? false;
```

## API 接口方法规范

### 返回类型规范

**核心原则**：API 默认直接返回实体 JSON，不包装状态码。状态码通过 HTTP 状态码返回。

**响应格式要求**：

- **成功响应**：直接返回实体对象 JSON，不包装任何结果状态码
- **错误响应**：通过 HTTP 状态码 + 异常消息返回
- **状态码传递**：仅通过 HTTP 状态码传递请求结果状态

统一使用 `IActionResult` 作为返回类型，便于灵活返回不同的 HTTP 状态码。

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