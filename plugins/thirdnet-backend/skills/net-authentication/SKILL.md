---
name: net-authentication
version: 1.0.0
description: .NET 认证系统开发专家，负责配置 Basic/Bearer 认证、实现账号验证器、管理 Token 流程。**主动用于**：认证配置、IAccountValidator 实现、Token 获取/刷新、授权策略使用。当用户提到"认证"、"授权"、"登录"、"Token"、"JWT"、"Basic"、"Bearer"、"IAccountValidator"、"策略"、"Policy"、"用户验证"时，必须使用此技能。
---

## 使用场景

- 配置服务端认证（Basic + Bearer）
- 实现 `IAccountValidator` 自定义账号验证
- 实现 `ICheckClient` 自定义客户端验证
- 理解 Token 获取和刷新流程
- 前后端认证对接参考

## 角色定位

你是一名**资深 .NET 认证系统开发工程师**，负责**按公司规范配置和实现认证授权功能**。你的代码必须**严格遵守框架规范**。

## 相关技能

- **net-api-developer**: API 接口开发
- **net-microservice-generator**: 微服务项目生成
- **net-efcore-developer**: 数据库实体开发（认证器常访问用户表）
- **net-cache-use**: 缓存功能集成（Token 过期缓存可使用 Redis）

## 认证方式概览

### Basic 认证

框架支持两种 Basic 认证方式：

#### 1. IP 认证

适用于有固定 IP 的应用。

**请求头格式**：
```
Authorization: Basic base64(application:)
```

**说明**：
- `application` 为管理员分配的应用标识
- 冒号后为空（无密码）
- 需要将调用方 IP 添加到白名单

**示例**：
```
应用标识: swkj_web
Basic 原文: swkj_web:
Base64 编码: c3dral93ZWI6
请求头: Authorization: Basic c3dral93ZWI6
```

#### 2. 应用加密认证

适用于无固定 IP 的应用。

**请求头格式**：
```
Authorization: Basic base64(application:base64(HMacSHA512(url,key)))
```

**说明**：
- `url` 为当前请求的相对路径（含查询参数）
- `key` 为 `prekey + 从服务端获取的密钥`
- 必须包含 `timestamp` 参数，5分钟内有效

**示例**：
```
应用标识: swkj_web
加密前缀: swkj
加密密钥: 1111
完整密钥: swkj1111
请求路径: /api/application/1?timestamp=1634719924

步骤：
1. 对相对路径进行 HMacSHA512 哈希
2. 对哈希结果进行 Base64 编码得到密码
3. 组合 application:password 进行 Base64 编码
```

### Bearer 认证

基于 JWT Token 的用户认证。

**使用流程**：
1. 获取 Token：`POST /connect/token`
2. 刷新 Token：`POST /connect/token/refresh`
3. 使用 Token：`Authorization: bearer {access_token}`

## 服务端配置

> 标准 Startup.cs 配置（服务注册顺序、中间件配置）请参阅 **net-microservice-generator** 技能。以下仅说明认证相关的额外配置。

### IdentityService 认证专属配置

在标准 Startup.cs 基础上，IdentityService 需额外注册以下服务：

```csharp
// ConfigureServices 中，在 AddThirdNetDefaultRSAJwt 之后添加：

// 自定义 Token 过期时间缓存（可选，默认使用内存缓存）
services.AddSingleton<IAccountTokenTimeCache, CustomAccountTokenTimeCache>();

// 配置账号验证器（必须）
services.AddScoped<IAccountValidator, DefaultAccountValidator>();
```

### WebApiService 认证专属配置

WebApiService 仅需标准配置中的 `AddThirdNetDefaultRSAJwt`（验证 Token），无需额外认证注册。无需注册 `IAccountValidator`（仅 IdentityService 需要）。

## IAccountValidator 实现

`IAccountValidator` 接口用于验证用户账号密码并返回自定义 Claims。

### 接口定义

```csharp
namespace ThirdNet.Core.AspNetCore
{
    public interface IAccountValidator
    {
        Task<List<Claim>> Validate(string account, string password, string[] scopes);
    }
}
```

### 实现示例

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using ThirdNet.Core.AspNetCore;

public class DefaultAccountValidator : IAccountValidator
{
    private readonly MyDbContext _dbContext;

    public DefaultAccountValidator(MyDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Claim>> Validate(string account, string password, string[] scopes)
    {
        // 1. 根据 account 验证账号密码
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.account == account);

        if (user == null || !VerifyPassword(password, user.password_hash))
        {
            throw new WebApiException(HttpStatusCode.Unauthorized, "用户名或密码错误", "invalid_credentials");
        }

        // 2. 创建自定义 claims（不应保存敏感信息，只保存标识信息）
        var custom_claims = new List<Claim>();

        // 身份提供者（如：password、wechat、tourist、wechatapp）
        custom_claims.Add(new Claim("idp", "password"));

        // 用户唯一标识
        custom_claims.Add(new Claim(ClaimTypes.NameIdentifier, user.id.ToString()));

        // 可选：添加其他自定义 claims
        custom_claims.Add(new Claim("user_name", user.user_name));

        return custom_claims;
    }

    private bool VerifyPassword(string password, string hash)
    {
        // 实现密码验证逻辑（如使用 BCrypt）
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
```

### 注册服务

```csharp
// 在 Startup.ConfigureServices 中
services.AddScoped<IAccountValidator, DefaultAccountValidator>();
```

## ICheckClient 客户端验证

`ICheckClient` 接口用于验证 Basic 认证中的客户端应用。

### 接口定义

```csharp
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace ThirdNet.Core.AspNetCore
{
    /// <summary>
    /// 应用验证接口
    /// </summary>
    public interface ICheckClient
    {
        /// <summary>
        /// 验证用户名和密码
        /// </summary>
        Task<bool> Check(string name, string password, HttpRequest request);
    }
}
```

### 框架默认实现

- `DefaultCheckClient`：从配置库中验证应用信息
- 支持两种 Basic 认证方式（IP 认证、应用加密认证）

### 自定义实现场景

当需要特殊的客户端验证逻辑时，可以实现自定义的 `ICheckClient`：

```csharp
public class CustomCheckClient : ICheckClient
{
    public async Task<bool> Check(string name, string password, HttpRequest request)
    {
        // 自定义验证逻辑
        // name: 应用标识
        // password: 认证密码（可能是空或 HMAC 签名）
        // request: 当前 HTTP 请求
        return true;
    }
}
```

## Token 端点规范

### 获取 Token

**端点**：`POST /connect/token`

**请求头**：
```
Authorization: Basic base64(application:)
Content-Type: application/x-www-form-urlencoded
```

**请求参数**（form-data）：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| scope | string | 否 | 权限范围，包含 `offline_access` 可获取 refresh_token |

**请求示例**：
```http
POST /connect/token HTTP/1.1
Authorization: Basic c3dral93ZWI6
Content-Type: application/x-www-form-urlencoded

username=test&password=123&scope=offline_access
```

**响应示例**：
```json
{
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

### 刷新 Token

**端点**：`POST /connect/token/refresh`

**请求头**：
```
Authorization: Basic base64(application:)
Content-Type: application/x-www-form-urlencoded
```

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| refresh_token | string | 是 | 之前获取的 refresh_token |

**注意事项**：
- refresh_token 只能使用一次，使用后失效
- 会返回新的 access_token 和 refresh_token

## 在接口中获取用户信息

框架提供了 `HttpContext` 扩展方法来获取用户信息。

### 可用方法

| 方法 | 返回类型 | 说明 |
|-----|---------|------|
| `HttpContext.GetCurrentClientId()` | string | 获取客户端应用 ID |
| `HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value` | string | 获取用户 ID |
| `HttpContext.User.FindFirst("idp")?.Value` | string | 获取身份提供者 |
| `HttpContext.User.Identity?.IsAuthenticated` | bool | 判断是否已认证 |

### 使用示例

```csharp
[HttpGet("profile")]
public async Task<IActionResult> GetProfile()
{
    // 获取用户 ID
    var userId = HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    if (string.IsNullOrEmpty(userId))
    {
        throw new WebApiException(HttpStatusCode.Unauthorized, "未登录");
    }

    // 获取客户端应用 ID
    var clientId = HttpContext.GetCurrentClientId();

    // 获取身份提供者
    var idp = HttpContext.User.FindFirst("idp")?.Value;

    // 判断是否已认证
    var isAuthenticated = HttpContext.User.Identity?.IsAuthenticated ?? false;

    // ...
    return Ok(new { userId, clientId, idp });
}
```

## 授权策略

框架内置以下授权策略（定义于 `ExtensionHelper.cs`）：

| 策略名 | 认证方式 | 说明 |
|-------|---------|------|
| Default | Basic + Bearer | 默认策略，支持两种认证 |
| Logon | Bearer | 必须登录后使用 Token |
| Basic | Basic | 仅允许 Basic 认证 |
| Both | Basic + Bearer | 支持两种认证 |

### 使用示例

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MyApp.Service.Controllers
{
    // 使用默认策略（Basic + Bearer）
    [Authorize]
    public class UserController : ControllerBase { }

    // 必须用户登录
    [Authorize(Policy = "Logon")]
    public class ProfileController : ControllerBase { }

    // 仅应用调用
    [Authorize(Policy = "Basic")]
    public class CallbackController : ControllerBase { }
}
```

### 自定义策略

如需自定义策略，参考框架的 `ProviderPolicyProvider` 和 `ProviderAuthorizationHandler` 实现。

## Token 过期检查

`IAccountTokenTimeCache` 接口用于控制 Token 的有效性检查。

### 接口定义

```csharp
namespace ThirdNet.Core.AspNetCore
{
    /// <summary>
    /// 账号对应 token 的更新时间缓存，用于判断 token 是否过期
    /// </summary>
    public interface IAccountTokenTimeCache
    {
        /// <summary>
        /// 查找对应用户名 key 对应的时间
        /// </summary>
        bool TryGet(string key, out DateTime time);
    }
}
```

### 工作原理

1. 框架在 `AccountTokenCheckMiddleware` 中间件中检查 Token 的 `nbf` (Not Before) 时间
2. 如果缓存中存在该用户的时间，且大于 Token 的签发时间，则 Token 失效
3. 框架默认使用 `DefaultAccountTokenTimeCache`（内存缓存）

### 自定义实现（Redis 示例）

```csharp
using System;
using StackExchange.Redis;
using ThirdNet.Core.AspNetCore;

public class RedisAccountTokenTimeCache : IAccountTokenTimeCache
{
    private readonly IConnectionMultiplexer _redis;

    public RedisAccountTokenTimeCache(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public bool TryGet(string key, out DateTime time)
    {
        var db = _redis.GetDatabase();
        var value = db.StringGet($"token_time:{key}");
        if (value.HasValue)
        {
            time = DateTime.Parse(value!);
            return true;
        }
        time = default;
        return false;
    }
}
```

### 使用场景

当用户信息（如密码、权限）变更后，在缓存中更新该用户的时间，可使之前的 Token 失效。
