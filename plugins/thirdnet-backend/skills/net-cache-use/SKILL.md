---
name: net-cache-use
version: 3.0.0
description: 缓存功能开发专家，基于 RedisCacheManager 基类为业务实体添加完整的 Redis 缓存功能（CacheManager、RedisHandler、View 三层架构）及 RedisLock 分布式锁。**主动用于**：为实体添加缓存、字典数据缓存、配置信息缓存、高频查询缓存、缓存预热、性能优化、分布式锁。当用户提到"缓存"、"Cache"、"Redis"、"加缓存"、"缓存数据"、"字典缓存"、"配置缓存"、"高频查询"、"性能优化"、"预热"、"ICacheReader"、"ICacheRefresh"、"CacheManager"、"RedisCacheManager"、"分布式锁"、"RedisLock"、"并发控制"、"防重复"时，必须使用此技能。
---
## 使用场景

- **字典数据缓存**：部门、角色、地区等参考数据
- **配置信息缓存**：系统配置、业务参数
- **高频查询数据**：用户信息、商品信息
- **性能优化**：减少数据库查询、提升响应速度
- **分布式锁**：防止并发重复操作、资源互斥访问

## 核心架构

**命名空间**: `ThirdNet.Core.Common`

框架提供 `RedisCacheManager` 抽象基类，业务层基于它构建三层缓存架构：

```
RedisCacheManager（框架基类，Polly 熔断 + SemaphoreSlim 防击穿 + TTL 抖动）
  └── 业务 CacheManager（继承基类，组合 RedisHandler）
        ├── ICacheReader 接口（业务读取接口）
        ├── ICacheRefresh 接口（业务刷新接口）
        ├── RedisHandler（数据查询层，原生 SQL 查询 PostgreSQL）
        └── View/（视图模型目录）
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

以下是 `RedisCacheManager` 提供的完整方法。业务 CacheManager 子类直接调用这些方法，无需重写。

### 读取方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `GetSingle` | `Task<TResult> GetSingle<TResult>(string key, Func<Task<TResult>> func, TimeSpan? timespan = null, bool refresh = false, TResult default_value = default)` | 获取单个缓存。不存在时通过 `func` 加载并写入，带击穿防护和 TTL 抖动 |
| `GetMultiple` | `Task<IDictionary<string, TResult>> GetMultiple<TResult>(string[] keys, Func<string[], Task<IDictionary<string, TResult>>> func, DateTimeOffset? offset = null, TResult default_value = default)` | 批量获取。自动识别缺失 key，只对缺失的调用 `func` 查询并回写 |

### 写入/删除方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `AddOrUpdate` | `Task<bool> AddOrUpdate<TResult>(string key, TResult model, TimeSpan? timespan = null)` | 添加或更新单个缓存 |
| `AddOrUpdateMultiple` | `Task<bool> AddOrUpdateMultiple<TResult>(Tuple<string, TResult>[] list, DateTimeOffset? offset = null)` | 批量添加或更新 |
| `RemoveSingle` | `Task<bool> RemoveSingle(string key)` | 删除单个缓存 |
| `RemoveMultiple` | `Task<bool> RemoveMultiple(string[] keys)` | 批量删除，全部删除返回 true |

### 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 缓存键，必须小写、点号分隔（如 `user.123`） |
| `func` | `Func<Task<TResult>>` | 缓存未命中时的数据加载回调 |
| `timespan` | `TimeSpan?` | 单个操作的过期时间，null 表示永不过期。`GetSingle` 写入时自动加 ±10% 抖动 |
| `offset` | `DateTimeOffset?` | 批量操作的过期时间点，null 表示永不过期 |
| `refresh` | `bool` | 读取缓存后是否刷新 TTL，默认 false |
| `default_value` | `TResult` | 缓存不存在或 Redis 异常时返回的默认值 |

### TTL 参数类型规则

- `GetSingle`、`AddOrUpdate`、`RemoveSingle` 使用 **`TimeSpan?`** 表示过期时长（如 `_stime8`）
- `GetMultiple`、`AddOrUpdateMultiple` 使用 **`DateTimeOffset?`** 表示过期时间点（如 `DateTimeOffset.Now.Add(_stime8)`）

## TTL 选择指南

| 字段名 | 值 | 适用场景 |
|--------|------|------|
| `_stime010` | 10 分钟 | 临时会话数据 |
| `_stime2` | 2 小时 | 外部 API Token |
| `_stime8` | 8 小时 | 用户相关数据（房屋、住户、积分） |
| `_stime24` | 24 小时 | 大部分参考数据（字典、配置、角色） |

## 执行步骤

### 步骤 1：收集实体信息

**必需**：实体英文名、主键类型、数据库表名、字段列表

**可选**：唯一索引字段（手机号/账号等）、TTL 时长、是否需要树形结构、自定义查询条件

### 步骤 2：生成 View 视图模型

在 `View/` 目录下创建 `{Entity}View.cs`，类名以 `View` 结尾，属性小写与数据库字段一致，必须包含 `id`。

> 完整代码示例见 `references/cache-examples.md`「基础模式」章节

### 步骤 3：实现 RedisHandler 查询方法

在 `RedisHandler.cs` 中添加三类查询方法：
- **单个查询**：`SqlQueryRaw` + `FirstOrDefaultAsync`，按主键查询
- **列表查询**：`SqlQueryRaw` + `ToListAsync`，返回 `Dictionary<key, View>`
- **批量查询**：`SqlQueryRaw` + `ANY(@ids)` + `NpgsqlParameter`，用于 `GetMultiple` 的 func 回调

> 完整代码示例见 `references/cache-examples.md`「基础模式」章节

### 步骤 4：实现 CacheManager 读取方法

业务 CacheManager 继承 `RedisCacheManager`，通过 `ICacheReader` 暴露读取方法：

- **单个读取**：`GetSingle(key, () => reader.GetXxx(id), _stimeX)`
- **字典读取**：`GetSingle("entity", reader.GetXxxList, _stime24)`，缓存整个字典
- **批量读取**：`GetMultiple(keys, func, DateTimeOffset.Now.Add(_stimeX))`，func 内部解析缺失 key，查询后返回 `IDictionary<string, TResult>`

> 完整代码示例（含批量查询 func 写法）见 `references/cache-examples.md`「基础模式」章节

### 步骤 5：实现 CacheManager 刷新方法

通过 `ICacheRefresh` 暴露刷新方法：

- **按 ID 刷新**：先查询最新数据，存在则 `AddOrUpdate`，不存在则 `RemoveSingle`
- **按模型刷新**：直接 `AddOrUpdate(key, model, ttl)`
- **整集刷新**：重新加载列表后 `AddOrUpdate`

多键场景（如用户同时缓存 `user.{id}`、`user.phone.{phone}`、`user.email.{email}`）刷新时需处理 key 迁移——先删旧键再建新键。

> 多键场景完整示例见 `references/cache-examples.md`「多键场景」章节

### 步骤 6：定义接口

```csharp
// ICacheReader.cs
public interface ICacheReader
{
    Task<EntityView?> GetEntityInfo(long id);
    Task<Dictionary<long, EntityView>> GetEntityDic();
    Task<Dictionary<long, EntityView>> GetEntityInfo(List<long> ids);
}

// ICacheRefresh.cs
public interface ICacheRefresh
{
    Task RefreshEntity(long id);
    Task RefreshEntity(EntityView model);
}
```

## 分布式锁：RedisLock

**命名空间**: `ThirdNet.Core.Common.redis`

框架提供 `RedisLock` 分布式锁，基于 Redis `StringSet` + Lua 脚本实现原子加锁/解锁。

### 使用方式

```csharp
// 注入 IDatabase（由 AddRedisExtensionService 注册）
private readonly IDatabase _redis;

// 使用 using 自动释放锁
using (await new RedisLock(_redis, "order.123", TimeSpan.FromSeconds(30)).LockAsync())
{
    // 临界区逻辑：同一 key 只有一个请求能进入
    await ProcessOrder(orderId);
}
```

### 构造函数

```csharp
RedisLock(IDatabase redis, string key, TimeSpan expiry)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `redis` | `IDatabase` | Redis 数据库实例（通过 DI 注入） |
| `key` | `string` | 锁键名，遵循缓存键命名规范（小写、点号分隔） |
| `expiry` | `TimeSpan` | 锁自动过期时间（防止死锁） |

**注意事项**：
- 同时实现 `IAsyncDisposable` 和 `IDisposable`，支持 `using` 自动释放
- 解锁使用 Lua 脚本保证原子性（检查值匹配后才删除）
- 锁过期时间应大于临界区预期执行时间
- Redis 不可用时锁操作会失败，需在 `catch` 中处理降级逻辑

## 代码审查清单

### 文件结构

- [ ] 在 `View/` 创建了 `{Entity}View.cs`
- [ ] 在 `RedisHandler.cs` 添加了查询方法
- [ ] 在 `CacheManager.cs` 添加了 Reader 和 Refresh 方法
- [ ] 在 `ICacheReader.cs` 添加了接口定义
- [ ] 在 `ICacheRefresh.cs` 添加了接口定义

### 代码质量

- [ ] 缓存键命名符合规范（小写、点号分隔）
- [ ] `GetSingle` 使用 `TimeSpan?` 过期参数
- [ ] `GetMultiple` 使用 `DateTimeOffset?` 过期参数
- [ ] 使用了正确的 TTL（根据数据特性）
- [ ] 所有查询使用了 `AsNoTracking()`
- [ ] 多键场景更新了所有相关键

## 重要规范

1. **命名规范**：缓存键小写+点号分隔，View 类名以 `View` 结尾，属性小写与数据库一致
2. **性能规范**：必须 `AsNoTracking()`，批量查询用 `ANY`，避免循环查询
3. **一致性规范**：数据变更后立即刷新缓存，多键场景更新所有相关键

> 实体模型禁止使用数据注解（Fluent API 配置）。**例外**：`[DbBulk]` 特性是批量操作框架要求，可以使用。

## 详细示例

完整的缓存实现示例（基础模式、多键场景、树形结构、Controller 调用），请参阅：`references/cache-examples.md`

## 相关技能

- **backend-workflow**: 文档驱动开发流程和交付标准
- **net-efcore-developer**: 数据库实体开发（缓存基于实体创建 View 和 RedisHandler）
- **net-api-developer**: API 接口开发（缓存通过 API 层的 CacheManager 调用）
- **net-database-bulkcopy**: 批量数据操作（批量导入后需刷新缓存）
