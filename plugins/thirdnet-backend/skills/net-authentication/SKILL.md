---
name: net-authentication
description: >
  ThirdNet 认证系统开发规范：三层认证（Basic 国密、Bearer/JWT 签名、API Key）、
  IAccountValidator/ICheckClient 客户端验证、Token 获取/刷新端点、授权策略（Default/Logon/Basic/Both）。
  当用户提到"认证"、"登录"、"Token"、"JWT"、"Basic"、"Bearer"、"ApiKey"、"X-API-Key"、
  "IAccountValidator"、"ICheckClient"、"Policy"时，必须使用此技能。
  （权限/授权见 net-rbac 技能）
---

# ThirdNet 认证系统

## 认证方式概览

框架支持三层认证：Basic（应用级）+ Bearer/JWT（用户级）+ API Key（外部调用级）。

### Basic 认证

框架支持两种 Basic 认证方式：

#### 1. IP 认证

适用于有固定 IP 的应用：

```
Authorization: Basic base64(application:)
```

- `application` 为管理员分配的应用标识
- 冒号后为空（无密码）
- 需要将调用方 IP 添加到白名单

#### 2. 应用加密认证

适用于无固定 IP 的应用：

```
Authorization: Basic base64(application:base64(HMacSM3(url,key)))
```

- `url` 为当前请求的相对路径（含查询参数）
- `key` 为 `prekey + 从服务端获取的密钥`
- 必须包含 `timestamp` 参数，5分钟内有效

### Bearer 认证

基于 JWT Token 的用户认证。Admin 项目使用 SM2 算法签名 JWT，也支持 RSA。

使用流程：
1. 获取 Token：`POST /api/manager/auth/login`
2. 刷新 Token：`POST /api/manager/auth/refresh`
3. 使用 Token：`Authorization: bearer {access_token}`

### API Key 认证

适用于外部应用通过密钥调用 API 的场景（如开放平台、第三方集成），无需用户登录流程。

#### 请求方式

```
X-API-Key: {api_key}
```

- 请求头名称：`X-API-Key`（`ApiKeyAuthenticationHandler.HeaderName`）
- 值为明文 API Key（如 `sk-a1b2c3d4...`），框架自动进行 SHA256 哈希后验证
- 不包含 `X-API-Key` 头时返回 `NoResult`，不阻断其他认证方式（Basic/Bearer 可正常使用）

#### 验证流程

```
请求 X-API-Key 头
  → ApiKeyAuthenticationHandler（Scheme: "ApiKey"）
  → IApiKeyValidator.ValidateAsync(明文Key)
  → CachedApiKeyValidator（Admin 层实现）
      → SHA256 哈希明文 Key
      → ApiKeyCache.GetByHash(哈希值)
      → Redis 查找（未命中 → DB 回退 SQL 查 admin.t_sys_api_key）
      → 检查 status（0=启用）+ expires_at（未过期）
      → 解析 scopes（逗号分隔）
  → 验证通过：创建 ClaimsIdentity（client_id + scope Claims）
  → 验证失败：返回 null → 401
```

#### 核心接口与实现

| 组件 | 命名空间 | 说明 |
|------|---------|------|
| `IApiKeyValidator` | `ThirdNet.Vibe.WebAPI` | 验证接口：`ValidateAsync(apiKeyPlain) -> ApiKeyValidationResult?` |
| `DefaultApiKeyValidator` | `ThirdNet.Vibe.WebAPI` | 框架默认实现（始终返回 null，占位用） |
| `CachedApiKeyValidator` | `{ProjectName}.Cache.Auth` | Admin 层实现：SHA256 哈希 → Redis 缓存 → DB 回退 |
| `ApiKeyCache` | `{ProjectName}.Cache.Domain` | 缓存域：key `admin.apikey.hash.{hash[:16]}`，TTL 8h |
| `ApiKeyAuthenticationHandler` | `ThirdNet.Vibe.WebAPI` | 认证处理器（Scheme "ApiKey"，读取 `X-API-Key` 头） |

#### 注册方式

`CachedApiKeyValidator` 在 Admin Startup.cs 第 6 步（认证授权层）注册：

```csharp
// Admin Startup.cs — 注册缓存版 API Key 验证器（替换框架默认的 no-op 实现）
services.AddAdminCacheServices();  // 注册 ApiKeyCache（Singleton）
services.AddSingleton<IApiKeyValidator>(sp =>
    sp.GetRequiredService<CachedApiKeyValidator>());
```

Service 微服务**不需要**单独注册，共享 Admin 的认证体系即可。

#### API Key 管理

Admin 项目内置完整的 API Key 管理功能（`ApiKeyService` + `ApiKeyManagerController`），支持：
- 创建 / 更新 / 删除 API Key
- 设置 Key 名称、scope 权限范围、过期时间
- 启用 / 禁用 Key
- Key 的 secret 只在创建时返回一次，之后只存储 SHA256 哈希

> API Key 的 scope Claims 与 JWT 的 scope Claim 使用相同的类型名称，因此 `[ProviderAuthorize("scope1")]` 对 API Key 和 JWT 用户同样生效，无需区分。详见 `net-rbac`。

## 加密算法框架（AddCrypto）

本系统的密码哈希、JWT 签名、应用 HMAC 都建立在框架的加密套件上——**国密（GM）与国际双标准统一通过 DI 注册，不要手写加密算法**。

### 一次性注册整套算法

`ThirdNet.Vibe.Common.Algorithm.CryptoServiceExtensions.AddCrypto(...)`（NuGet 包内 `algorithm/CryptoServiceExtensions.cs`）：

```csharp
// 选标准即注册全部 5 个算法接口：IHashAlgorithm / IHmacAlgorithm / ISymmetricAlgorithm / IAsymmetricAlgorithm / IPasswordHasher
services.AddCrypto(CryptoStandard.NationalStandard);   // 国密：SM3/SM4/SM2，密码用 Pbkdf2SM3
services.AddCrypto(CryptoStandard.International);      // 国际：SHA512/AES/RSA，密码用 BCrypt（可选 usePbkdf2:true 用 PBKDF2）
// 可选参数：bcryptWorkFactor=11、usePbkdf2=false、pbkdf2Iterations=100000
```

需要混搭或单独替换某一项时，用构建器：`services.AddCrypto(b => b.UseHash<...>().UsePasswordHasher<...>())`。

### 算法族对应

| 接口 | 国际（International） | 国密（NationalStandard） |
|------|---------------------|------------------------|
| `IHashAlgorithm` | SHA512 | SM3 |
| `IHmacAlgorithm` | HMACSHA512 | HMACSM3（Basic 应用加密认证用） |
| `ISymmetricAlgorithm` | AES-128-CBC | SM4-CBC |
| `IAsymmetricAlgorithm` | RSA | SM2 |
| `IPasswordHasher` | BCrypt / PBKDF2(HMAC-SHA512) | PBKDF2(HMAC-SM3) |

> `IPasswordHasher` 命名空间 `ThirdNet.Vibe.Common.Algorithm.Abstractions`，方法 `Hash(plain)` / `Verify(plain, hash)`。`AdminAccountValidator` 即注入它来校验密码。

### JWT 签名

签名算法由 `JwtSignType`（枚举 `SM2`/`RSA`，定义顺序即如此）配置，框架经 `ISigner` 抽象派发到 `RSASigner`/`SM2Signer`（`ThirdNet.Vibe.WebAPI.Authentication.Bearer.Signing`）。切换签名算法只改配置，不改业务代码。

完整的算法类与签名类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md) 的「加密算法」「认证」小节。

## IAccountValidator 实现

`IAccountValidator` 接口用于验证用户账号密码并返回自定义 Claims。

### 接口定义

```csharp
namespace ThirdNet.Vibe.WebAPI
{
    public interface IAccountValidator
    {
        Task<List<Claim>> Validate(string account, string password);
    }
}
```

### AdminAccountValidator 示例

Admin 项目中的实现查询 AdminDbContext，使用 PBKDF2 验证密码，包含账户锁定和原子 SQL 操作。

> 参考文件：生成项目 `Admin/{ProjectName}.Admin.APIService/Auth/AdminAccountValidator.cs`。

```csharp
public class AdminAccountValidator : IAccountValidator
{
    private readonly IDbContextFactory<AdminDbContext> _dbContextFactory;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ConfigCache _configCache;
    private readonly UserCache _userCache;
    private readonly RoleCache _roleCache;
    private readonly ILogger<AdminAccountValidator> _logger;

    public AdminAccountValidator(
        IDbContextFactory<AdminDbContext> dbContextFactory,
        IPasswordHasher passwordHasher,
        ConfigCache configCache,
        UserCache userCache,
        RoleCache roleCache,
        ILogger<AdminAccountValidator> logger)
    {
        _dbContextFactory = dbContextFactory;
        _passwordHasher = passwordHasher;
        _configCache = configCache;
        _userCache = userCache;
        _roleCache = roleCache;
        _logger = logger;
    }

    public async Task<List<Claim>> Validate(string account, string password)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync();

        // 读取锁定策略配置
        int maxAttempts = await _configCache.GetConfigInt(SystemConfigKeys.MaxLoginAttempts, 5);
        int lockoutHours = await _configCache.GetConfigInt(SystemConfigKeys.LockoutDurationHours, 12);
        bool showDetail = await _configCache.GetConfigBool(SystemConfigKeys.ShowLoginErrorDetail);

        var user = await dbContext.SysUsers
            .FirstOrDefaultAsync(u => u.user_name == account);

        if (user == null)
            throw new WebApiException(HttpStatusCode.BadRequest, "帐号密码错误");

        if (user.status == StatusEnum.Disabled)
            throw new WebApiException(HttpStatusCode.BadRequest,
                showDetail ? "帐号已被禁用" : "帐号密码错误");

        // 检查账户锁定状态（略，见完整源码）
        // ...

        // 密码验证
        if (!_passwordHasher.Verify(password, user.password_hash))
        {
            // 原子递增失败次数（避免并发竞态）
            var newAttempts = await AtomicIncrementFailedAttempts(
                dbContext, user.id, maxAttempts, lockoutHours);

            if (newAttempts >= maxAttempts)
                throw new WebApiException(HttpStatusCode.BadRequest,
                    showDetail ? $"连续登录失败{maxAttempts}次，账户已锁定{lockoutHours}小时" : "帐号密码错误");

            throw new WebApiException(HttpStatusCode.BadRequest, "帐号密码错误");
        }

        // 密码正确：原子重置失败次数
        await AtomicResetFailedAttempts(dbContext, user.id);

        // 从缓存查询用户关联的角色
        var roleIds = await _userCache.GetUserRoleIds(user.id);
        var roleDic = await _roleCache.GetRoleDic();
        var roleKeys = roleIds
            .Where(id => roleDic.TryGetValue(id, out var r) && r.status == 0)
            .Select(id => roleDic[id].role_key)
            .ToList();

        // 构造 JWT Claims
        var claims = new List<Claim>
        {
            new Claim("user_id", user.id.ToString()),
            new Claim("dept_id", user.dept_id.ToString()),
            new Claim("admin_roles", string.Join(",", roleKeys)),
            new Claim("name", user.user_name)
        };

        return claims;
    }
}
```

> 上例用到的 `SystemConfigKeys`（`{ProjectName}.Common.Constants`）是系统配置键常量，对应 `t_sys_config.config_key`，避免硬编码字符串。常用键：`MaxLoginAttempts`（默认 5）、`LockoutDurationHours`（默认 12）、`SessionTimeoutMinutes`、`PasswordExpiryDays`、`ShowLoginErrorDetail`、`CaptchaEnabled`、`UploadAllowedExtensions`、`HeartbeatIntervalSeconds`。配置值经 `ConfigCache.GetConfigInt/GetConfigBool` 读取。完整清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)。

### 注册方式

**AdminService（Admin 主项目）**：必须注册 `IAccountValidator`：

```csharp
services.AddScoped<IAccountValidator, AdminAccountValidator>();
```

**WebApiService（微服务）**：不需要注册，仅验证 Token 即可。

## ICheckClient 客户端验证

`ICheckClient` 验证 Basic 认证中的客户端应用。框架提供 `DefaultCheckClient` 默认实现，从配置库中验证应用信息，支持两种 Basic 认证方式。

```csharp
public interface ICheckClient
{
    Task<bool> Check(string name, string password, HttpRequest request);
}
```

自定义场景（特殊客户端验证逻辑）可实现此接口。

## Token 端点

### 获取 Token

**端点**：`POST /api/manager/auth/login`

请求使用 Basic Auth + HMAC-SM3 签名（完整登录流程见 `net-rbac` 的 rbac-flow.md）。

响应：
```json
{
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi..."
}
```

### 刷新 Token

**端点**：`POST /api/manager/auth/refresh`

请求携带 `refresh_token`，使用与登录一致的 Basic Auth + HMAC-SM3 签名。

注意：refresh_token 只能使用一次，使用后失效，返回新的 access_token 和 refresh_token。

## HttpContext 用户信息

| 方法 | 说明 |
|-----|------|
| `User.FindFirst("user_id")?.Value` | 获取用户 ID（long） |
| `User.FindFirst("dept_id")?.Value` | 获取用户部门 ID |
| `User.FindFirst("admin_roles")?.Value` | 获取角色标识（逗号分隔） |
| `User.FindFirst("name")?.Value` | 获取用户名 |
| `HttpContext.GetCurrentClientId()` | 获取客户端应用 ID |
| `HttpContext.User.Identity?.IsAuthenticated` | 判断是否已认证 |

## 授权策略

框架内置四个策略：

| 策略名 | 认证方式 | 说明 |
|-------|---------|------|
| Default | Basic + Bearer + ApiKey | 默认策略，三种方式任一即可 |
| Logon | Bearer | 必须用户登录 |
| Basic | Basic | 仅应用调用 |
| Both | Basic + Bearer | Basic 或 Bearer |

```csharp
[Authorize]                          // Default 策略
[Authorize(Policy = "Logon")]        // 必须用户登录
[Authorize(Policy = "Basic")]        // 仅应用调用
```

对于 PermissionAuthorize（权限码授权），详见 `net-rbac` 技能。

## Token 过期检查（失效链路）

用户信息（密码、权限、角色）变更后需要让旧 Token 失效，框架提供完整链路（命名空间均在 `ThirdNet.Vibe.WebAPI`）：

| 组件 | 角色 |
|------|------|
| `AccountTokenCheckMiddleware` | 每次请求比对 Token 的 `nbf`（签发时间）与缓存中的失效时间；若失效时间更新则抛 `WebApiException(Unauthorized, "token_need_change")`。 |
| `IGetAccountTokenKey` / `AccountTokenKeyProvider` | 从 `HttpContext` 生成缓存 key（Admin 基于 Redis 实现，模板生成层）。 |
| `IAccountTokenTimeCache` | 存取失效时间戳（`DefaultAccountTokenTimeCache` 为内存实现）。 |

### 触发失效

业务侧**不要直接调用** `_tokenCache.SetTokenInvalidationTime(userId)`——改用统一助手 `UserCacheInvalidation.InvalidateUserAuthAsync(_userCache, _tokenCache, userId)`（`{ProjectName}.Admin.APIService.Services`）：一次清掉用户权限缓存 + 角色缓存，并写入 Token 失效时间，用户下次请求即被中间件拦截重签。详见 `net-api-developer` 的「缓存失效」。

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动开发流程（**编码前确认 `backend/spec.md` 已存在并已阅读**，否则文档驱动流程会被跳过）
- **net-rbac**: 权限体系（PermissionAuthorize 三层授权）
- **net-api-developer**: API 接口开发
- **net-efcore-developer**: 数据库实体（认证器访问用户表）
