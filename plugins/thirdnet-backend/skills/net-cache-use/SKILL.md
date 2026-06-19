---
name: net-cache-use
description: >
  ThirdNet Redis 缓存域开发规范：缓存键命名、View 投影、CacheDbContext 回退查询、
  缓存域三区域结构（Reader/Remove/Query）、RedisCacheManager（熔断/防击穿/TTL 抖动）、
  RedisLock 分布式锁、缓存失效策略。
  当用户提到"cache"、"缓存域"、"redis"、"RedisCacheManager"、"RedisLock"、
  "分布式锁"、"加缓存"、"CacheDbContext"时，必须使用此技能。
---

# ThirdNet Redis 缓存域开发

## 架构概览

缓存层采用 Read-Through + DB 回退模式：

```
请求 → Cache.Reader → Redis 命中？
                          ├─ 是 → 返回缓存数据
                          └─ 否 → Cache.Query (原始 SQL → DB)
                                   → 写入 Redis (TTL)
                                   → 返回数据
```

### 核心架构

框架提供 `RedisCacheManager` 基类（**非抽象**，命名空间 `ThirdNet.Vibe.Common`，直接继承即可），每个业务领域创建独立的自包含缓存类：

```
RedisCacheManager（框架基类）
  └── {Domain}Cache（继承基类，自包含）
        ├── #region Query（private，DB 回退查询）
        ├── #region Reader（public virtual，缓存读取）
        └── #region Remove（public virtual，缓存失效）
```

### RedisCacheManager 基类内置能力

继承 `RedisCacheManager` 即可获得以下能力，无需重复实现：

| 能力 | 说明 |
|------|------|
| **Polly 熔断** | 连续 3 次 Redis 异常后自动熔断 5 分钟，熔断期间直接返回默认值 |
| **缓存击穿防护** | 进程内 `SemaphoreSlim` 锁 + Double-check，同一 key 只允许一个请求穿透到数据库 |
| **TTL 抖动** | `GetSingle` 写入时自动添加 ±10% 随机抖动，防止缓存雪崩 |
| **异常回退** | Redis 不可用时返回 `default_value`，不抛异常影响业务 |

## 基类方法签名

### 读取方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetSingle` | `Task<TResult> GetSingle<TResult>(string key, Func<Task<TResult>> func, TimeSpan? timespan = null, TResult default_value = default)` | 获取单个缓存。不存在时通过 `func` 加载并写入，带击穿防护和 TTL 抖动 |
| `GetMultiple` | `Task<IDictionary<string, TResult>> GetMultiple<TResult>(string[] keys, Func<string[], Task<IDictionary<string, TResult>>> func, DateTimeOffset? offset = null, TResult default_value = default)` | 批量获取。自动识别缺失 key，只对缺失的调用 `func` 查询并回写 |

### 写入/删除方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `AddOrUpdate` | `Task<bool> AddOrUpdate<TResult>(string key, TResult model, TimeSpan? timespan = null)` | 添加或更新单个缓存 |
| `AddOrUpdateMultiple` | `Task<bool> AddOrUpdateMultiple<TResult>(Tuple<string, TResult>[] list, DateTimeOffset? offset = null)` | 批量添加或更新 |
| `RemoveSingle` | `Task<bool> RemoveSingle(string key)` | 删除单个缓存 |
| `RemoveMultiple` | `Task<bool> RemoveMultiple(string[] keys)` | 批量删除 |

### TTL 参数类型规则

- `GetSingle`、`AddOrUpdate`、`RemoveSingle` 使用 **`TimeSpan?`** 表示过期时长
- `GetMultiple`、`AddOrUpdateMultiple` 使用 **`DateTimeOffset?`** 表示过期时间点

## 三区域结构

每个缓存域类包含三个区域：

| 区域 | 可见性 | 职责 | 方法命名 |
|------|--------|------|---------|
| `#region Reader` | public virtual | 对外提供缓存读取 | `GetXxx`、`GetXxxDic` |
| `#region Remove` | public virtual | 缓存失效（变更后调用） | `RemoveXxx` |
| `#region Query` | private | DB 回退查询（原始 SQL） | `QueryXxx` |

## 缓存键命名规范

所有缓存键定义在 `AdminCacheKeys` 静态类中，格式为 `admin.{模块}.{标识}`：

```csharp
public static class AdminCacheKeys
{
    // 单条缓存前缀（拼接 ID 使用）
    public const string UserPrefix = "admin.user.";         // admin.user.{id}
    public const string RolePrefix = "admin.role.";         // admin.role.{id}

    // 全量/集合缓存
    public const string UserDic = "admin.user.dic";         // 全量用户字典
    public const string MenuTree = "admin.menu.tree";       // 菜单树
}
```

**新增缓存域时**，必须在 `AdminCacheKeys` 中添加对应的常量。缓存键必须小写、点号分隔。

## View 模型

View 是实体的轻量投影，只包含缓存需要的字段：

```csharp
public class UserView
{
    public long id { get; set; }
    public string user_name { get; set; }
    public string nick_name { get; set; }
    public long dept_id { get; set; }
    public StatusEnum status { get; set; }
    // 注意：不含 password_hash 等敏感字段
}
```

**原则**：View 只包含非敏感、高频访问的字段。密码哈希、详细联系方式等不应放入缓存。

### 缓存对象复用原则

同一实体的所有消费方应共享**一个 View + 一个 key**，View 包含所有场景需要的字段合集。消费方按需读取自己关心的字段，而不是为不同场景分别创建字段子集的缓存。

**反模式**：同一实体拆成 BriefView + DetailView，各用不同的 key → 删除时容易遗漏，数据不一致。

**何时可以拆分**：不同实体、不同数据来源、多键索引（如 `user.{id}` + `user.phone.{phone}`）。

## CacheDbContext

CacheDbContext 是专门用于缓存回退查询的轻量 DbContext，与业务 DbContext 共享同一连接字符串但独立注册：

- 不定义 DbSet（所有查询使用原始 SQL）
- 不需要迁移
- 注册为 PooledDbContextFactory

## 缓存域类模板

```csharp
public class XxxCache : RedisCacheManager
{
    private readonly IDbContextFactory<CacheDbContext> _dbFactory;
    private static readonly TimeSpan _ttl8 = TimeSpan.FromHours(8);
    private static readonly TimeSpan _ttl24 = TimeSpan.FromHours(24);

    public XxxCache(IRedisDatabase redis, ILogger<XxxCache> log,
        IDbContextFactory<CacheDbContext> dbFactory)
        : base(redis, log)
    {
        _dbFactory = dbFactory;
    }

    #region Reader

    /// <summary>
    /// 根据ID获取单条缓存，TTL 8 小时。
    /// </summary>
    public virtual Task<XxxView?> GetXxx(long id)
        => GetSingle<XxxView?>($"{AdminCacheKeys.XxxPrefix}{id}",
            () => QueryXxx(id), _ttl8);

    /// <summary>
    /// 获取全量字典，TTL 24 小时。
    /// </summary>
    public virtual async Task<Dictionary<long, XxxView>> GetXxxDic()
        => await GetSingle(AdminCacheKeys.XxxDic,
            () => QueryXxxList(), _ttl24) ?? new();

    #endregion

    #region Remove

    public virtual Task RemoveXxx(long id)
        => RemoveSingle($"{AdminCacheKeys.XxxPrefix}{id}");

    public virtual Task RemoveXxxDic()
        => RemoveSingle(AdminCacheKeys.XxxDic);

    #endregion

    #region Query

    private async Task<XxxView?> QueryXxx(long id)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var sql = @"SELECT id, field1, field2
                    FROM admin.t_xxx_xxx WHERE id = {0} AND status = 0";
        return await db.Database.SqlQueryRaw<XxxView>(sql, id)
            .FirstOrDefaultAsync();
    }

    private async Task<Dictionary<long, XxxView>> QueryXxxList()
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        var sql = @"SELECT id, field1, field2
                    FROM admin.t_xxx_xxx WHERE status = 0";
        var list = await db.Database.SqlQueryRaw<XxxView>(sql).ToListAsync();
        return list.ToDictionary(x => x.id);
    }

    #endregion
}
```

## TTL 约定

TTL 根据数据特性选取，范围从 540 秒（在线状态，3× 心跳，默认心跳 180s）到 7 天（Token 时间）。完整的 TTL 对照表见 [admin-cache-domains](references/admin-cache-domains.md)。

## 缓存失效策略

采用"变更后删除"策略（Cache-Aside），而非"变更后更新"：

```csharp
// 在 Service 的变更方法中
public async Task<IdResult> Update(XxxUpdateMap dto, long operatorId)
{
    // ... 数据库更新操作 ...
    await db.SaveChangesAsync();

    // 变更后删除相关缓存
    await _xxxCache.RemoveXxx(dto.id);      // 单条缓存
    await _xxxCache.RemoveXxxDic();          // 全量字典
}
```

**原则**：
1. 数据库变更成功后，再删除缓存
2. 删除所有相关的缓存键（单条 + 字典 + 关联缓存）
3. 下次读取时 Read-Through 自动从 DB 加载
4. 多个 key 使用 `RemoveMultiple` 一次完成，减少 Redis 网络往返

> **涉及用户/角色权限变更**：不要手写散落的 `UserCache`/`RoleCache` 失效 + `TokenCache.SetTokenInvalidationTime`。统一调用 `UserCacheInvalidation.InvalidateUserAuthAsync(_userCache, _tokenCache, userId)`（`{ProjectName}.Admin.APIService.Services`），一次清权限+角色缓存并写 Token 失效时间。本节是 `UserCacheInvalidation` 用法的权威定义，其他技能（net-api-developer、net-authentication）均指向此处。

## 分布式锁：RedisLock

**命名空间**: `ThirdNet.Vibe.Common`。构造函数 `RedisLock(IDatabase database, ILogger<RedisLock>? log = null)`；`Lock(key, timespan)` 返回 `bool`（是否抢到），`UnLock()` 释放，实现 `IAsyncDisposable`——用 `await using` 自动释放。`IDatabase` 由 `AddRedisExtensionService` 注册到 DI。

```csharp
// 抢锁：StringSet When.NotExists；超时未抢到返回 false，需自行处理
await using var redisLock = new RedisLock(_database);
if (await redisLock.Lock("order.123", TimeSpan.FromSeconds(30)))
{
    // 临界区：同一 key 同时只有一个请求进入
    await ProcessOrder(orderId);
} // await using 退出时自动 UnLock（Lua 脚本原子释放，校验 lock_id）
```

**注意事项**：
- `RedisLock` 实例**持有所抢的 key 状态**，每次抢锁新建实例（不要跨请求复用同一实例并发抢多个锁）
- 解锁用 Lua 脚本保证原子性（比对 `lock_id` 再 `del`，不会误删别人的锁）
- `timespan` 是锁的自动过期时间，应大于临界区预期执行时间，避免业务未完锁先失效

## DI 注册

所有缓存域注册为 **Singleton**：

```csharp
// 在 CacheServiceExtensions.AddAdminCacheServices() 中添加
services.AddSingleton<XxxCache>();

// 在 Startup.cs 中调用
services.AddAdminCacheServices();  // 一行注册所有缓存域
```

## 批量查询模式

```csharp
// 并行批量获取
public virtual async Task<List<XxxView>> GetXxxList(List<long> ids)
{
    var tasks = ids.Select(id => GetXxx(id));
    var results = await Task.WhenAll(tasks);
    return results.Where(r => r != null).ToList();
}
```

对于需要一次 SQL 查全量的场景，使用 `GetMultiple` 或全量字典模式。

## 代码审查清单

### 文件结构

- [ ] 在 `View/` 创建了 `{Entity}View.cs`
- [ ] 创建了自包含的 `{Domain}Cache.cs`（含 Query + Reader + Remove）

### 代码质量

- [ ] 缓存键命名符合规范（小写、点号分隔）
- [ ] `GetSingle` 使用 `TimeSpan?` 过期参数
- [ ] `GetMultiple` 使用 `DateTimeOffset?` 过期参数
- [ ] 使用了正确的 TTL（根据数据特性）
- [ ] Query 方法用 `SqlQueryRaw` 原生 SQL（本身即 no-tracking，无需 `AsNoTracking()`）；若改用 LINQ 查询则必须加 `AsNoTracking()`
- [ ] 多键场景 Remove 时删除了所有关联 key
- [ ] 多个 key 的删除使用 `RemoveMultiple` 而非循环 `RemoveSingle`
- [ ] 多个 key 的读取使用 `GetMultiple` 而非循环 `GetSingle`
- [ ] 同一实体没有为不同字段子集创建多个 View 或多个 key

## Admin 内置缓存域

Admin 项目已提供 9 个缓存域（UserCache、RoleCache、MenuCache、DeptCache、ConfigCache、DictCache、TokenCache、OnlineCache、ApiKeyCache）。新增业务缓存前先确认能否复用，参考实现见生成项目 `Tools/{ProjectName}.Cache/Domain/`。

完整的缓存域清单、方法列表和用途说明见 [admin-cache-domains](references/admin-cache-domains.md)。

## 完整示例

参考 [cache-examples.md](references/cache-examples.md) 查看 UserCache 和 MenuCache 的完整代码。

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动流程（→ 见该技能）
- **net-efcore-developer**: 数据库实体开发（缓存基于实体创建 View 和 Query）
- **net-api-developer**: API 接口开发（缓存通过 Service 层注入调用）
- **net-database-bulkcopy**: 批量数据操作（批量导入后需删除对应缓存）
