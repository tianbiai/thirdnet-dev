---
name: net-auth
description: >
  ThirdNet 认证与授权（AuthN + AuthZ）开发规范，一个安全域一份技能。认证：三层（Basic 国密 /
  Bearer-JWT 签名 / API Key）、IAccountValidator/ICheckClient 客户端验证、Token 获取/刷新端点、
  Token 失效链路。授权：RBAC 权限体系（User→Role→Menu）、权限字符串（module:entity:action）、
  三层授权（角色/范围/权限+通配符）、CachePermissionProvider 解析、PermissionCatalog 自动同步、
  OperatorContext、新增权限保护模块步骤。当用户提到"认证"、"登录"、"Token"、"JWT"、"Basic"、
  "Bearer"、"ApiKey"、"X-API-Key"、"IAccountValidator"、"ICheckClient"、"RBAC"、"permission"、
  "角色权限"、"菜单权限"、"权限"、"授权"、"PermissionAuthorize"、"PermissionCatalog"、
  "OperatorContext"、"Policy"时，必须使用此技能。
license: MIT
metadata:
  version: "1.0.1"
  author: thirdnet
---

# ThirdNet 认证与授权

认证（你是谁）与授权（你能做什么）本就是一个安全域，合并为一份技能。

> 类的归属：授权相关类（`[PermissionAuthorize]`/`[ProviderAuthorize]`/`PermissionMatcher`/`IPermissionProvider`）命名空间在框架库 `ThirdNet.Vibe.WebAPI`；`OperatorContext`/`CachePermissionProvider` 在模板生成层 `{ProjectName}.Cache.*`（即 `Tools/{ProjectName}.Cache`，命名空间**无 `.Admin.` 中缀**）。完整可复用类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)。

---

## 一、认证（Authentication）

### 认证方式概览

框架支持三层认证：Basic（应用级）+ Bearer/JWT（用户级）+ API Key（外部调用级）。

#### Basic 认证

框架支持两种 Basic 认证方式：

**1. IP 认证**（适用于有固定 IP 的应用）：

```
Authorization: Basic base64(application:)
```

- `application` 为管理员分配的应用标识；冒号后为空（无密码）；需将调用方 IP 加到白名单。

**2. 应用加密认证**（适用于无固定 IP 的应用）：

```
Authorization: Basic base64(application:base64(HMacSM3(url,key)))
```

- `url` 为当前请求的相对路径（含查询参数）；`key` 为 `prekey + 从服务端获取的密钥`；必须包含 `timestamp` 参数，5 分钟内有效。

#### Bearer 认证

基于 JWT Token 的用户认证。Admin 项目使用 SM2 算法签名 JWT，也支持 RSA。

使用流程：
1. 获取 Token：`POST /api/manager/auth/login`
2. 刷新 Token：`POST /api/manager/auth/refresh`
3. 使用 Token：`Authorization: bearer {access_token}`

#### API Key 认证

适用于外部应用通过密钥调用 API 的场景（开放平台、第三方集成），无需用户登录流程。

```
X-API-Key: {api_key}
```

- 请求头名称：`X-API-Key`（`ApiKeyAuthenticationHandler.HeaderName`）；值为明文 API Key（如 `sk-a1b2c3d4...`），框架自动 SHA256 哈希后验证；不包含该头时返回 `NoResult`，不阻断其他认证方式（Basic/Bearer 可正常使用）。

验证流程：

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

| 组件 | 命名空间 | 说明 |
|------|---------|------|
| `IApiKeyValidator` | `ThirdNet.Vibe.WebAPI` | 验证接口：`ValidateAsync(apiKeyPlain) -> ApiKeyValidationResult?` |
| `DefaultApiKeyValidator` | `ThirdNet.Vibe.WebAPI` | 框架默认实现（始终返回 null，占位用） |
| `CachedApiKeyValidator` | `{ProjectName}.Cache.Auth` | Admin 层实现：SHA256 哈希 → Redis 缓存 → DB 回退 |
| `ApiKeyCache` | `{ProjectName}.Cache.Domain` | 缓存域：key `admin.apikey.hash.{hash[:16]}`，TTL 8h |
| `ApiKeyAuthenticationHandler` | `ThirdNet.Vibe.WebAPI` | 认证处理器（Scheme "ApiKey"，读取 `X-API-Key` 头） |

注册（`CachedApiKeyValidator` 在 Admin Startup.cs 第 6 步注册）：

```csharp
services.AddAdminCacheServices();  // 注册 ApiKeyCache（Singleton）
services.AddSingleton<IApiKeyValidator>(sp =>
    sp.GetRequiredService<CachedApiKeyValidator>());
```

Service 微服务**不需要**单独注册，共享 Admin 的认证体系即可。

> API Key 的 scope Claims 与 JWT 的 scope Claim 使用相同的类型名称，因此 `[ProviderAuthorize("scope1")]`（见下「范围授权」）对 API Key 和 JWT 用户同样生效，无需区分。

### 加密算法框架（AddCrypto）

密码哈希、JWT 签名、应用 HMAC 都建立在框架加密套件上——**国密（GM）与国际双标准统一通过 `AddCrypto(CryptoStandard.xxx)` DI 注册，不要手写加密算法**。完整算法族对应表（IHashAlgorithm/IHmacAlgorithm/ISymmetricAlgorithm/IAsymmetricAlgorithm/IPasswordHasher 在国密与国际标准下的实现）与 JWT 签名机制见 [crypto-catalog.md](references/crypto-catalog.md)。

### IAccountValidator 实现

`IAccountValidator` 验证用户账号密码并返回自定义 Claims：

```csharp
namespace ThirdNet.Vibe.WebAPI
{
    public interface IAccountValidator
    {
        Task<List<Claim>> Validate(string account, string password);
    }
}
```

Admin 项目中的 `AdminAccountValidator` 查询 `AdminDbContext`，用 PBKDF2 验证密码，含账户锁定和原子 SQL 操作：

- 注入 `IDbContextFactory<AdminDbContext>`、`IPasswordHasher`、`ConfigCache`、`UserCache`、`RoleCache`、`ILogger`
- 通过 `ConfigCache` 读取锁定策略配置（`MaxLoginAttempts` 默认 5、`LockoutDurationHours` 默认 12、`ShowLoginErrorDetail`）
- 查 `SysUsers` → 校验 `status`（禁用抛错）→ 检查账户锁定状态
- 用 `IPasswordHasher.Verify` 校验密码；失败时**原子递增**失败次数（防并发竞态），达上限抛锁定错误；成功时**原子重置**
- 从 `UserCache`/`RoleCache` 查用户关联的启用角色 key 集合
- 构造 Claims：`user_id`、`dept_id`、`admin_roles`（逗号分隔）、`name`

> 完整源码（含 `AtomicIncrementFailedAttempts`/`AtomicResetFailedAttempts` 等原子 SQL）见生成项目 `Admin/{ProjectName}.Admin.APIService/Auth/AdminAccountValidator.cs`。上例用到的 `SystemConfigKeys`（`{ProjectName}.Common.Constants`）对应 `t_sys_config.config_key`，避免硬编码字符串；本处相关键：`MaxLoginAttempts`（默认 5）、`LockoutDurationHours`（默认 12）、`ShowLoginErrorDetail`，经 `ConfigCache.GetConfigInt/GetConfigBool` 读取，完整键清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)。

注册：
- **AdminService（Admin 主项目）**：必须注册 `services.AddScoped<IAccountValidator, AdminAccountValidator>();`
- **WebApiService（微服务）**：不需要注册，仅验证 Token 即可。

### ICheckClient 客户端验证

`ICheckClient` 验证 Basic 认证中的客户端应用，框架提供 `DefaultCheckClient` 默认实现（从配置库验证应用信息，支持两种 Basic 认证方式）：

```csharp
public interface ICheckClient
{
    Task<bool> Check(string name, string password, HttpRequest request);
}
```

自定义场景（特殊客户端验证逻辑）可实现此接口。

### Token 端点

**获取 Token**：`POST /api/manager/auth/login`，请求使用 Basic Auth + HMAC-SM3 签名（完整登录→授权流程见 [rbac-flow.md](references/rbac-flow.md)）。响应：

```json
{
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi..."
}
```

**刷新 Token**：`POST /api/manager/auth/refresh`，携带 `refresh_token`，使用与登录一致的 Basic Auth + HMAC-SM3 签名。refresh_token 只能使用一次，使用后失效，返回新的 access_token 和 refresh_token。

### HttpContext 用户信息

| 方法 | 说明 |
|-----|------|
| `User.FindFirst("user_id")?.Value` | 用户 ID（long） |
| `User.FindFirst("dept_id")?.Value` | 用户部门 ID |
| `User.FindFirst("admin_roles")?.Value` | 角色标识（逗号分隔） |
| `User.FindFirst("name")?.Value` | 用户名 |
| `HttpContext.GetCurrentClientId()` | 客户端应用 ID |
| `HttpContext.User.Identity?.IsAuthenticated` | 是否已认证 |

### Token 过期检查（失效链路）

用户信息（密码、权限、角色）变更后需要让旧 Token 失效，框架提供完整链路（命名空间均在 `ThirdNet.Vibe.WebAPI`）：

| 组件 | 角色 |
|------|------|
| `AccountTokenCheckMiddleware` | 每次请求比对 Token 的 `nbf`（签发时间）与缓存中的失效时间；若失效时间更新则抛 `WebApiException(Unauthorized, "token_need_change")`。 |
| `IGetAccountTokenKey` / `AccountTokenKeyProvider` | 从 `HttpContext` 生成缓存 key（Admin 基于 Redis 实现，模板生成层）。 |
| `IAccountTokenTimeCache` | 存取失效时间戳（`DefaultAccountTokenTimeCache` 为内存实现）。 |

**触发失效**：业务侧**不要直接调用** `_tokenCache.SetTokenInvalidationTime(userId)`——改用统一助手 `UserCacheInvalidation.InvalidateUserAuthAsync(_userCache, _tokenCache, userId)`（`{ProjectName}.Admin.APIService.Services`）：一次清掉用户权限缓存 + 角色缓存，并写入 Token 失效时间，用户下次请求即被中间件拦截重签。详见 net-cache-use（`UserCacheInvalidation` 的权威定义在此处）。

---

## 二、授权（Authorization / RBAC）

### RBAC 数据模型

```
用户 (SysUserModel)
  │  N:M (SysUserRoleModel)
  ▼
角色 (SysRoleModel)
  │  N:M (SysRoleMenuModel)
  ▼
菜单/按钮 (SysMenuModel) + permission_string
```

| 实体 | 表名 | 用途 |
|------|------|------|
| SysUserModel | t_sys_user | 用户账户 |
| SysRoleModel | t_sys_role | 角色定义 |
| SysMenuModel | t_sys_menu | 目录/菜单/按钮（三级树形） |
| SysUserRoleModel | t_sys_user_role | 用户-角色多对多关联 |
| SysRoleMenuModel | t_sys_role_menu | 角色-菜单多对多关联（含 permission_string） |

`SysMenuModel` 菜单类型：

```csharp
public enum MenuTypeEnum
{
    Directory = 0,  // 目录（一级，如"系统管理"）
    Page = 1,       // 菜单页面（二级，如"用户管理"）
    Button = 2      // 按钮/操作（三级，如"新增用户"）
}
```

菜单树结构示例：
```
系统管理 (Directory, id=1)
  ├── 用户管理 (Page, id=10, path="/system/user")
  │     ├── 用户新增 (Button, permission="sys:user:add")
  │     ├── 用户编辑 (Button, permission="sys:user:edit")
  │     ├── 用户删除 (Button, permission="sys:user:remove")
  │     └── 用户查询 (Button, permission="sys:user:query")
  ├── 角色管理 (Page, id=20, path="/system/role")
  │     └── ...
```

### 权限字符串格式

格式为 `module:entity:action`，三级结构：

| 级别 | 含义 | 示例 |
|------|------|------|
| module | 模块 | `sys`（系统管理）、`api`（API 管理）、`monitor`（监控） |
| entity | 实体 | `user`、`role`、`menu`、`dict` |
| action | 操作 | `list`、`query`、`add`、`edit`、`remove` |

常见权限标识：

```
sys:user:list      — 用户列表
sys:user:query     — 用户详情
sys:user:add       — 新增用户
sys:user:edit      — 编辑用户
sys:user:remove    — 删除用户
sys:user:resetPwd  — 重置密码
sys:role:list      — 角色列表
sys:menu:list      — 菜单列表
api:service:list   — API 服务列表
```

### 三层授权体系

Admin 项目使用三层授权机制：

**第一层：角色授权**（较少使用）

```csharp
[Authorize(Roles = "admin,editor")]
```

基于 JWT 中的 role claims 进行角色匹配。

**第二层：范围授权（`[ProviderAuthorize]`）**

`[ProviderAuthorize("scope")]`（`ThirdNet.Vibe.WebAPI`，`Authorization/Provider/ProviderAuthorizeAttribute.cs`）基于 JWT 的 **scope claim** 做范围授权，常用于 API Key / 第三方接口的 scope 控制（如 `[ProviderAuthorize("order:read")]`）。多个 scope 逗号分隔（`"order:read,order:write"`），命中任一即通过。策略路由由 `ProviderPolicyProvider` 完成：`Permission*` 策略走权限授权、`Provider*` 策略走范围授权。

```csharp
[ProviderAuthorize("order:read")]   // 要求 Token 的 scope claim 含 order:read
[HttpGet("list")]
public async Task<IActionResult> GetList() { ... }
```

> 与 `[PermissionAuthorize]` 的区别：权限授权读 `admin_roles` claim → 经 `CachePermissionProvider` 查角色权限；范围授权直接读 `scope` claim，不查角色，适合无用户身份的 API Key 场景（`AdminControllerBase` 对 ApiKey 鉴权会跳过 `OperatorContext` 初始化）。

**第三层：权限 + 通配符授权（最常用）**

```csharp
[PermissionAuthorize("sys:user:add")]
```

这是 Admin 项目最核心的授权方式：`[PermissionAuthorize]` 触发 `PermissionAuthorizationHandler` → 从 JWT 取 `role_keys` → `CachePermissionProvider`/`RoleCache`（Redis 命中或 DB 回退）取权限 → `PermissionMatcher` 匹配（精确 / 模块通配 / 实体通配 / 全局通配，无匹配→403）。完整运行时流程见 [rbac-flow.md](references/rbac-flow.md)「§3 PermissionAuthorize 权限校验流程」。

### CachePermissionProvider

参考文件：生成项目 `Tools/{ProjectName}.Cache/Auth/CachePermissionProvider.cs`。连接缓存层与授权框架：`IPermissionProvider` → `CachePermissionProvider` → `RoleCache` → Redis/DB。接口 + 实现类 + `RoleCache` 内部（Redis key 与 SQL fallback）见 [rbac-flow.md](references/rbac-flow.md)「CachePermissionProvider 代码追踪」。

### PermissionCatalog 自动同步

框架在启动时自动扫描所有 Controller 中的 `[PermissionAuthorize]` 属性，将发现的权限字符串写入 `ThirdNetDbContext` 的权限目录表：

```csharp
// 在 Program.cs 中
await host.InitializePermissionCatalogTableAsync();
```

这意味着：只需在 Controller 端点上标注 `[PermissionAuthorize("sys:notice:list")]`，权限字符串就会自动出现在管理后台的权限目录中，无需手动注册。

### 通配符匹配规则

| 用户权限 | 请求的权限 | 是否匹配 |
|---------|----------|---------|
| `*` | 任何 | ✅ 匹配所有 |
| `sys:*` | `sys:user:list` | ✅ 模块级通配 |
| `sys:*` | `api:service:list` | ❌ 不同模块 |
| `sys:user:*` | `sys:user:add` | ✅ 实体级通配 |
| `sys:user:add` | `sys:user:add` | ✅ 精确匹配 |
| `sys:user:add` | `sys:user:edit` | ❌ 操作不同 |

### OperatorContext 详解

参考文件：生成项目 `Tools/{ProjectName}.Cache/Context/OperatorContext.cs`。命名空间 `{ProjectName}.Cache.Context`，实现 `IOperatorContext`（`{ProjectName}.Common.Interfaces`）。

OperatorContext 是请求级别的 Memoization 容器（Scoped 生命周期），避免同一请求内重复的 Redis 查询：

```csharp
// 初始化（幂等，通常由 AdminControllerBase 自动调用）
_operatorContext.Initialize(operatorId);

// 获取当前用户的权限列表（第一次 Redis 查询，后续直接返回缓存值）
var permissions = await _operatorContext.GetPermissions();

// 检查是否有通配符权限（permissions 包含 "*"）
var isAdmin = await _operatorContext.HasWildcardPermission();

// 获取用户信息
var userInfo = await _operatorContext.GetUserInfo();

// 获取用户的角色 ID 列表
var roleIds = await _operatorContext.GetUserRoleIds();

// 获取用户可见的部门 ID 列表（用于数据范围过滤）
var visibleDeptIds = await _operatorContext.GetVisibleDeptIds();
```

> **数据范围过滤列必须建索引**：`GetVisibleDeptIds()` 返回的部门集合最终会拼成 `Where(x => visibleDeptIds.Contains(x.dept_id))`，对应的 `dept_id` 等过滤列**必须建索引**（`HasIndex(x => x.dept_id)`），否则每次权限过滤触发 Seq Scan。本插件不做 RLS、数据权限走应用层（设计取舍理由见 [net-efcore-developer → 设计取舍说明](../net-efcore-developer/SKILL.md)），所以应用层过滤列的索引是性能关键。

### 新增权限保护模块的步骤

1. **定义权限字符串**（`module:entity:action`）：

   ```
   sys:notice:list      — 通知列表
   sys:notice:query     — 通知详情
   sys:notice:add       — 新增通知
   sys:notice:edit      — 编辑通知
   sys:notice:remove    — 删除通知
   ```

2. **在 Controller 端点标注权限**：

   ```csharp
   [PermissionAuthorize("sys:notice:list")]
   [HttpGet("list")]
   public async Task<IActionResult> GetList([FromQuery] NoticeQueryMap query)
   {
       // ...
   }
   ```

3. **添加菜单树条目**（目录/页面/按钮三级）：

   ```sql
   INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, ...)
   VALUES ('通知管理', {系统管理ID}, 0, ...);            -- 目录级
   INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, path, ...)
   VALUES ('通知列表', {通知管理ID}, 1, '/system/notice', ...);  -- 页面级
   INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, permission, ...)
   VALUES ('通知新增', {通知列表ID}, 2, 'sys:notice:add', ...);  -- 按钮级（每个操作一个）
   ```

4. **分配权限给角色**：通过管理后台的角色管理界面，将菜单/按钮权限分配给角色。

5. **Service 层使用 OperatorContext**（需要范围校验时）：

   ```csharp
   _operatorContext.Initialize(operatorId);
   var hasWildcard = await _operatorContext.HasWildcardPermission();
   var visibleDeptIds = await _operatorContext.GetVisibleDeptIds();
   ```

---

## 完整流程

从登录到授权完成的完整请求生命周期图见 [rbac-flow.md](references/rbac-flow.md)。

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动流程（→ 见该技能）
- **net-api-developer**：Controller 和 Service 开发规范，`[PermissionAuthorize]` 的使用位置
- **net-cache-use**：缓存域开发，`CachePermissionProvider` 基于缓存层的权限加载；`UserCacheInvalidation` 的权威定义
- **net-efcore-developer**：数据库实体建模，RBAC 相关表（用户、角色、菜单）的实体定义
