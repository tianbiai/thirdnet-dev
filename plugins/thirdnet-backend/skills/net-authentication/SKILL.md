---
name: net-authentication
description: >
  ThirdNet 认证系统开发规范。覆盖 Basic 认证（IP 白名单、HMAC-SM3 国密应用加密）、
  Bearer/JWT 认证（SM2/RSA 签名）、IAccountValidator 实现、ICheckClient 客户端验证、
  Token 获取/刷新端点、授权策略（Default/Logon/Basic/Both）、Token 过期检查、
  AdminAccountValidator 模式。
  当用户提到"认证"、"授权"、"登录"、"Token"、"JWT"、"Basic"、"Bearer"、
  "IAccountValidator"、"ICheckClient"、"策略"、"Policy"、"用户验证"、"密码"、
  "登录接口"、"刷新Token"、"AdminAccountValidator"时，必须使用此技能。
---

# ThirdNet 认证系统

## 认证方式概览

框架支持双层认证：Basic（应用级）+ Bearer/JWT（用户级）。

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
1. 获取 Token：`POST /connect/token`
2. 刷新 Token：`POST /connect/token/refresh`
3. 使用 Token：`Authorization: bearer {access_token}`

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

> 完整源码参考：`backend/src/Admin/ThirdNet.Admin.APIService/Auth/AdminAccountValidator.cs`

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

**端点**：`POST /connect/token`

```
Authorization: Basic base64(application:)
Content-Type: application/x-www-form-urlencoded

username=test&password=123&scope=offline_access
```

响应：
```json
{
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi..."
}
```

### 刷新 Token

**端点**：`POST /connect/token/refresh`

```
Authorization: Basic base64(application:)
Content-Type: application/x-www-form-urlencoded

refresh_token=xxx
```

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
| Default | Basic + Bearer | 默认策略 |
| Logon | Bearer | 必须登录 |
| Basic | Basic | 仅应用调用 |
| Both | Basic + Bearer | 两种都支持 |

```csharp
[Authorize]                          // Default 策略
[Authorize(Policy = "Logon")]        // 必须用户登录
[Authorize(Policy = "Basic")]        // 仅应用调用
```

对于 PermissionAuthorize（权限码授权），详见 `net-rbac` 技能。

## Token 过期检查

`IAccountTokenTimeCache` 接口用于控制 Token 的有效性检查。

### 工作原理

1. `AccountTokenCheckMiddleware` 检查 Token 的 `nbf` (Not Before) 时间
2. 如果缓存中存在该用户的时间，且大于 Token 的签发时间，则 Token 失效
3. Admin 使用 `AccountTokenKeyProvider`（`IGetAccountTokenKey`），基于 Redis 实现

### 使用场景

当用户信息（如密码、权限）变更后，通过 `_tokenCache.SetTokenInvalidationTime(userId)` 更新时间戳，使之前的 Token 失效，强制用户重新登录。

## 相关技能

- **backend-workflow**: 完整工作流和 DI 管道
- **net-rbac**: 权限体系（PermissionAuthorize 三层授权）
- **net-api-developer**: API 接口开发
- **net-efcore-developer**: 数据库实体（认证器访问用户表）
