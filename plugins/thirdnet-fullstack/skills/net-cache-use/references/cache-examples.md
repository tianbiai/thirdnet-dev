# 缓存域开发完整示例

本文档包含从代码库提取的完整缓存域代码示例。

## 目录

1. [UserCache — 标准缓存域](#usercache)
2. [MenuCache — 树形缓存域](#menucache)
3. [CacheDbContext 设置](#cachedbcontext)

---

## UserCache

**参考文件**（生成项目）：`Tools/{ProjectName}.Cache/Domain/UserCache.cs`

UserCache 是最典型的缓存域示例，展示了所有核心模式：单条缓存、全量字典、关联查询、批量操作。

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis.Extensions.Core.Abstractions;
using {ProjectName}.Cache.DbContext;
using {ProjectName}.Cache.View;
using {ProjectName}.Common.Constants;
using ThirdNet.Vibe.Common;

namespace {ProjectName}.Cache.Domain
{
    public class UserCache : RedisCacheManager
    {
        private readonly IDbContextFactory<CacheDbContext> _dbFactory;
        private static readonly TimeSpan _ttl8 = TimeSpan.FromHours(8);
        private static readonly TimeSpan _ttl24 = TimeSpan.FromHours(24);

        public UserCache(IRedisDatabase redis, ILogger<UserCache> log,
            IDbContextFactory<CacheDbContext> dbFactory)
            : base(redis, log)
        {
            _dbFactory = dbFactory;
        }

        #region Reader

        /// <summary>
        /// 根据用户 ID 获取用户缓存视图，TTL 8 小时。
        /// Redis key: admin.user.{id}
        /// </summary>
        public virtual Task<UserView?> GetUserInfo(long id)
            => GetSingle<UserView?>($"{AdminCacheKeys.UserPrefix}{id}",
                () => QueryUser(id), _ttl8);

        /// <summary>
        /// 获取全量用户字典（id → UserView），TTL 8 小时。
        /// Redis key: admin.user.dic
        /// </summary>
        public virtual async Task<Dictionary<long, UserView>> GetUserDic()
            => await GetSingle(AdminCacheKeys.UserDic,
                () => QueryUserList(), _ttl8) ?? new();

        /// <summary>
        /// 获取用户的所有权限标识列表，TTL 8 小时。
        /// Redis key: admin.perm.{userId}
        /// </summary>
        public virtual async Task<List<string>> GetUserPermissions(long userId)
            => await GetSingle($"{AdminCacheKeys.PermPrefix}{userId}",
                () => QueryUserPermissions(userId), _ttl8) ?? new();

        /// <summary>
        /// 获取用户关联的角色 ID 列表，TTL 24 小时。
        /// Redis key: admin.user.roles.{userId}
        /// </summary>
        public virtual async Task<List<long>> GetUserRoleIds(long userId)
            => await GetSingle($"{AdminCacheKeys.UserRolePrefix}{userId}",
                () => QueryUserRoleIds(userId), _ttl24) ?? new();

        #endregion

        #region Remove

        public virtual Task RemoveUser(long id)
            => RemoveSingle($"{AdminCacheKeys.UserPrefix}{id}");

        public virtual Task RemoveUserDic()
            => RemoveSingle(AdminCacheKeys.UserDic);

        public virtual Task RemovePermissionCache(long userId)
            => RemoveSingle($"{AdminCacheKeys.PermPrefix}{userId}");

        public virtual Task RemoveUserRoleIds(long userId)
            => RemoveSingle($"{AdminCacheKeys.UserRolePrefix}{userId}");

        #endregion

        #region Query

        /// <summary>
        /// 查询单个用户 — 使用 CacheDbContext 原始 SQL。
        /// SQL 中的 admin.t_sys_user 是完全限定表名。
        /// </summary>
        private async Task<UserView?> QueryUser(long id)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sql = @"SELECT id, user_name, nick_name, dept_id, include_sub_depts, status, avatar
                        FROM admin.t_sys_user WHERE id = {0} AND status = 0";
            return await db.Database.SqlQueryRaw<UserView>(sql, id)
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// 查询全量用户列表 — 返回 Dictionary。
        /// </summary>
        private async Task<Dictionary<long, UserView>> QueryUserList()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sql = @"SELECT id, user_name, nick_name, dept_id, include_sub_depts, status, avatar
                        FROM admin.t_sys_user WHERE status = 0";
            var list = await db.Database.SqlQueryRaw<UserView>(sql).ToListAsync();
            return list.ToDictionary(x => x.id);
        }

        /// <summary>
        /// 查询用户权限 — 跨表 JOIN 查询。
        /// 关联 user_role → role_menu → role + menu 四张表。
        /// </summary>
        private async Task<List<string>> QueryUserPermissions(long userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sql = @"SELECT DISTINCT rm.permission_string
                        FROM admin.t_sys_user_role ur
                        INNER JOIN admin.t_sys_role_menu rm ON rm.role_id = ur.role_id
                        INNER JOIN admin.t_sys_role r ON r.id = ur.role_id
                        INNER JOIN admin.t_sys_menu m ON m.id = rm.menu_id
                        WHERE ur.user_id = {0}
                          AND r.status = 0
                          AND m.status = 0
                          AND rm.permission_string IS NOT NULL
                          AND rm.permission_string != ''";
            return await db.Database.SqlQueryRaw<string>(sql, userId).ToListAsync();
        }

        /// <summary>
        /// 查询用户角色 ID 列表。
        /// </summary>
        private async Task<List<long>> QueryUserRoleIds(long userId)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sql = @"SELECT role_id FROM admin.t_sys_user_role WHERE user_id = {0}";
            return await db.Database.SqlQueryRaw<long>(sql, userId).ToListAsync();
        }

        #endregion
    }
}
```

### 设计要点（代码已自解释，以下为非显而易见处）

- Reader 方法标记 `virtual`（允许测试 mock）；集合返回用 `?? new()` 防 null
- SQL 用 `{0}` 占位符，Npgsql 自动转为参数化查询（防注入）；表名用完全限定名 `admin.t_xxx_xxx`
- TTL 常量提为静态字段（避免每次创建 TimeSpan）；不同数据 TTL 不同（见 SKILL「TTL 约定」）

---

## MenuCache

**参考文件**（生成项目）：`Tools/{ProjectName}.Cache/Domain/MenuCache.cs`

MenuCache 展示了树形数据的缓存模式：缓存扁平列表，在内存中构建树。

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackExchange.Redis.Extensions.Core.Abstractions;
using {ProjectName}.Cache.DbContext;
using {ProjectName}.Cache.View;
using {ProjectName}.Common.Constants;
using {ProjectName}.Common.Extensions;
using ThirdNet.Vibe.Common;

namespace {ProjectName}.Cache.Domain
{
    public class MenuCache : RedisCacheManager
    {
        private readonly IDbContextFactory<CacheDbContext> _dbFactory;
        private static readonly TimeSpan _ttl24 = TimeSpan.FromHours(24);

        public MenuCache(IRedisDatabase redis, ILogger<MenuCache> log,
            IDbContextFactory<CacheDbContext> dbFactory)
            : base(redis, log)
        {
            _dbFactory = dbFactory;
        }

        #region Reader

        /// <summary>
        /// 获取菜单树形结构（扁平列表缓存 + 内存构建树），TTL 24 小时。
        /// </summary>
        public virtual async Task<List<MenuView>> GetMenuTree()
        {
            var flatList = await GetSingle(AdminCacheKeys.MenuTree,
                () => QueryMenuList(), _ttl24);
            return flatList != null ? BuildTree(flatList) : new List<MenuView>();
        }

        private static List<MenuView> BuildTree(List<MenuView> flatList) =>
            TreeBuilder.BuildForest(flatList,
                x => x.id,
                x => x.parent_id,
                x => x.children!,
                (x, v) => x.children = v);

        #endregion

        #region Remove

        public virtual Task RemoveMenuTree()
            => RemoveSingle(AdminCacheKeys.MenuTree);

        #endregion

        #region Query

        private async Task<List<MenuView>> QueryMenuList()
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sql = @"SELECT id, parent_id, menu_name, menu_type,
                               path, component, permission, permission_prefix,
                               icon, order_num, visible, status, is_external
                        FROM admin.t_sys_menu WHERE status = 0 ORDER BY order_num";
            return await db.Database.SqlQueryRaw<MenuView>(sql).ToListAsync();
        }

        #endregion
    }
}
```

### 树形缓存模式说明

1. Redis 存**扁平列表**（非树形），Reader 取出后用 `TreeBuilder.BuildForest()`（参数：items/idSelector/parentIdSelector/childrenGetter/childrenSetter）在内存构建树
2. 比缓存整个树更灵活（可按需过滤、排序）

---

## CacheDbContext

CacheDbContext 是专门用于缓存回退查询的轻量 DbContext：

```csharp
// 注册方式（在 Startup.cs）
services.AddPooledDbContextFactory<CacheDbContext>(options =>
{
    options.UseNpgsql(connectionString);  // 与 AdminDbContext 共享连接字符串
});
```

**使用方式**（在 Query 方法中）：
```csharp
await using var db = await _dbFactory.CreateDbContextAsync();
var result = await db.Database.SqlQueryRaw<T>(sql, params).ToListAsync();
```
