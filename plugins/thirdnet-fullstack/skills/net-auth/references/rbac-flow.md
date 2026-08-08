# RBAC 权限解析流程

## 完整请求生命周期

以下是一个带权限校验的 API 请求从登录到授权的完整流程。

### 1. 用户登录

```
客户端 → POST /api/manager/auth/login (Basic Auth, HMAC-SM3 签名)
         │
         ├── AdminAccountValidator.ValidateAsync()
         │     ├── 从 AdminDbContext 查询用户
         │     ├── PBKDF2 验证密码
         │     ├── 检查账户锁定状态
         │     └── 返回 AccountValidationResult { user_id, role_keys }
         │
         ├── 生成 JWT（包含 user_id claim）
         ├── 缓存用户权限到 Redis
         └── 返回 { access_token, refresh_token }
```

### 2. 带 Token 的请求到达 Controller

```
客户端 → GET /api/manager/user/list
         Header: Authorization: Bearer <JWT>
         │
         ├── JWT 中间件验证 Token 有效性
         │     ├── 检查签名（SM2）
         │     ├── 检查过期时间
         │     ├── 检查 Token 失效时间（TokenCache）
         │     └── 解析 Claims（user_id, role_keys）
         │
         ├── AdminControllerBase.OnActionExecuting()
         │     └── OperatorContext.Initialize(userId)
         │         └── 设置 _operatorId，后续调用 GetPermissions/GetUserInfo 等懒加载
         │
         └── 进入 Controller Action 方法
```

### 3. PermissionAuthorize 权限校验流程

```
[PermissionAuthorize("sys:user:list")]
         │
         ├── PermissionAuthorizationHandler.HandleAsync()
         │     │
         │     ├── 获取用户的 role_keys（从 JWT Claims）
         │     │
         │     ├── IPermissionProvider.GetPermissionsAsync(roleKeys)
         │     │     │
         │     │     └── CachePermissionProvider
         │     │           └── RoleCache.GetRolePermissions(roleKeys)
         │     │                 │
         │     │                 ├── Redis 命中 → 直接返回
         │     │                 └── Redis 未命中 → DB 回退查询
         │     │                       └── SQL: SELECT DISTINCT permission_string
         │     │                             FROM t_sys_role_menu rm
         │     │                             JOIN t_sys_user_role ur ON ...
         │     │                             WHERE ur.user_id = {userId}
         │     │                             → 写入 Redis (TTL 8h) → 返回
         │     │
         │     └── PermissionMatcher.Match(requiredPermission, userPermissions)
         │           │
         │           ├── 精确匹配: "sys:user:list" == "sys:user:list" → ✅
         │           ├── 模块通配: "sys:*" 包含 "sys:user:list" → ✅
         │           ├── 实体通配: "sys:user:*" 包含 "sys:user:list" → ✅
         │           ├── 全局通配: "*" 匹配一切 → ✅
         │           └── 无匹配 → ❌ → HTTP 403 Forbidden
         │
         └── 权限校验通过 → 继续执行 Controller Action
```

## CachePermissionProvider 代码追踪

```csharp
// 1. 框架调用 IPermissionProvider
public interface IPermissionProvider
{
    Task<List<string>> GetPermissionsAsync(string[] roleKeys);
}

// 2. Admin 实现类
public class CachePermissionProvider(RoleCache roleCache) : IPermissionProvider
{
    public async Task<List<string>> GetPermissionsAsync(string[] roleKeys)
    {
        return await roleCache.GetRolePermissions(roleKeys);
    }
}

// 3. RoleCache 内部
// Redis key: admin.role.perm.{roleKey}
// SQL fallback:
//   SELECT DISTINCT rm.permission_string
//   FROM admin.t_sys_role_menu rm
//   INNER JOIN admin.t_sys_user_role ur ON rm.role_id = ur.role_id
//   INNER JOIN admin.t_sys_role r ON r.id = ur.role_id
//   INNER JOIN admin.t_sys_menu m ON m.id = rm.menu_id
//   WHERE ur.user_id = {userId}
//     AND r.status = 0 AND m.status = 0
//     AND rm.permission_string IS NOT NULL AND rm.permission_string != ''
```

## PermissionMatcher 通配符匹配

```csharp
// 匹配规则（简化版）：
// 1. 全局通配: "*" → 匹配一切
// 2. 模块通配: "sys:*" → 匹配 "sys:" 开头的所有权限
// 3. 实体通配: "sys:user:*" → 匹配 "sys:user:" 开头的所有权限
// 4. 精确匹配: "sys:user:list" → 只匹配 "sys:user:list"

// 匹配示例：
//   用户权限 ["*"]                    → 匹配任何请求
//   用户权限 ["sys:*"]                → 匹配 sys 模块的所有操作
//   用户权限 ["sys:user:*"]           → 匹配 sys:user 的所有操作
//   用户权限 ["sys:user:list"]        → 只匹配 sys:user:list
//   用户权限 ["sys:user:list","sys:user:add"] → 匹配这两个操作
```

## 新增权限保护模块的完整步骤

新增权限保护模块的 5 步流程（定义权限字符串 → Controller 标注 `[PermissionAuthorize]` → 添加菜单树条目 SQL → 分配权限给角色 → Service 层用 `OperatorContext`）见 [net-auth SKILL.md → 新增权限保护模块的步骤](../SKILL.md)（含完整 SQL 与代码）。注意第 3 步 `PermissionCatalog` 会在启动时自动扫描所有 `[PermissionAuthorize]` 写入权限目录表，无需手动注册权限字符串。
