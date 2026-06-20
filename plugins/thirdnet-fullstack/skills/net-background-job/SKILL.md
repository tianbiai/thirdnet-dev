---
name: net-background-job
description: >
  ThirdNet 后台任务开发规范。基于 BackgroundRunner 创建循环执行的后台任务
  （SleepTime 毫秒间隔，非 Cron 表达式）：核心属性、Scoped 服务模式、常见场景示例。
  当用户提到"定时"、"后台任务"、"Job"、"Worker"、"每隔"、"自动执行"、
  "BackgroundRunner"、"循环任务"、"心跳检测"时，必须使用此技能。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---

# ThirdNet 后台任务开发

## 核心类

**命名空间**: `ThirdNet.Vibe.Common`（NuGet 包，`async/` 目录）

框架提供一组后台任务相关类，**按需求选用，不要自造**：

| 类 | 用途 |
|----|------|
| `BackgroundRunner` | 循环执行的后台任务基类（本技能主用）。设 `SleepTime`/`Check`，实现 `WorkAsync`。 |
| `SessionRunner<Key,Value>` | **字典缓存型**后台任务（继承 `BackgroundRunner`）。实现 `ISessionReader<Key,Value>` + `ISessionRefresh`，周期性刷新一个内存字典供高频读取（`TryGet`/`GetAll`/`RefreshAsync`）。适合「热数据定期预热、请求时零延迟读取」场景，而非每次查库/查 Redis。 |
| `AsyncMemo<T>` | 轻量异步记忆化：`GetOrFetchAsync(fetchFunc)`，请求级懒加载缓存。`OperatorContext` 即基于它。 |
| `IBackgroundLogger` / `BackgroundLog` | 后台任务日志接口与日志条目 POCO。`DatabaseBackgroundLogger`（框架 `ThirdNet.Vibe.WebAPI`）为写库实现。 |

> 完整类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「后台任务与异步缓存」小节。

## 核心属性

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| `SleepTime` | int | 3600000 (1小时) | 每次任务执行后的休眠时间（毫秒） |
| `Name` | string | null | 任务名称，用于日志标识 |
| `Check` | bool | - | 抽象属性，判断是否执行任务 |
| `Logger` | ILogger | - | 标准日志记录器 |
| `BackgroundLogger` | IBackgroundLogger | - | 后台批量日志记录器（用于操作日志等批量写入场景） |

## 核心方法

| 方法 | 类型 | 说明 |
|-----|------|------|
| `WorkAsync` | 抽象方法 | 子类实现，定义具体任务逻辑 |
| `ExecuteAsync` | 重写方法 | 后台服务主执行逻辑 |
| `StartAsync` | 重写方法 | 服务启动时的日志记录 |
| `StopAsync` | 重写方法 | 服务停止时的日志记录 |

## 开发步骤

### 1. 创建任务类

继承 `BackgroundRunner` 并实现抽象成员：

```csharp
public class DataSyncTask : BackgroundRunner
{
    private readonly IDataSyncService _syncService;

    public DataSyncTask(
        ILogger<DataSyncTask> logger,
        IDataSyncService syncService)
        : base(logger)
    {
        _syncService = syncService;
        Name = "数据同步任务";
        SleepTime = 60000; // 1分钟
    }

    // 根据业务逻辑判断是否执行
    public override bool Check => DateTime.Now.Hour >= 9 && DateTime.Now.Hour <= 18;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        Logger.LogInformation("开始执行 {Name}", Name);
        await _syncService.SyncDataAsync(cancellationToken);
        Logger.LogInformation("{Name} 执行完成", Name);
    }
}
```

### 2. 注册服务

在 `Startup.cs` 的 DI 管道中注册后台任务。根据是否需要暴露接口，分为两种模式：

#### 两行注册（基础模式）

大多数后台任务使用此模式——仅需要具体类型注入和托管服务生命周期：

```csharp
services.AddSingleton<DataSyncTask>();                                              // 1. 具体类注册（Singleton）
services.AddHostedService(sp => sp.GetRequiredService<DataSyncTask>());             // 2. 托管服务（IHostedService）
```

#### 三行注册（接口暴露模式）

如果后台任务需要暴露接口供其他服务注入（如操作日志、心跳检测），则需增加接口转发：

```csharp
services.AddSingleton<DataSyncTask>();                                              // 1. 具体类注册（Singleton）
services.AddSingleton<IDataSyncService>(sp => sp.GetRequiredService<DataSyncTask>()); // 2. 接口转发（允许其他服务通过接口注入）
services.AddHostedService(sp => sp.GetRequiredService<DataSyncTask>());             // 3. 托管服务（IHostedService）
```

**为何共享同一个实例**：两种模式都确保 `AddSingleton`、接口转发、`AddHostedService` 三者共享同一个 Singleton 实例，分别满足三种角色——具体类型注入、接口类型注入、`IHostedService` 生命周期管理。如果只写 `AddHostedService`，其他服务将无法通过接口注入该后台任务实例。

**DI 管道位置**：通常在 DI 管道的最后阶段注册（Admin 项目中，操作日志在第 7 步、心跳在第 8 步，自定义任务在第 9 步业务服务之前或之后均可）。

## Scoped 服务模式

`BackgroundRunner` 注册为 Singleton，无法直接注入 Scoped 服务（如 DbContext、缓存域）。必须通过 `IServiceScopeFactory` 创建作用域：

```csharp
public class DataSyncTask : BackgroundRunner
{
    private readonly IServiceScopeFactory _scopeFactory;

    public DataSyncTask(
        ILogger<DataSyncTask> logger,
        IServiceScopeFactory scopeFactory)
        : base(logger)
    {
        _scopeFactory = scopeFactory;
        Name = "数据同步任务";
        SleepTime = 60000;
    }

    public override bool Check => true;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        // DbContext 必须经 IDbContextFactory 取出（DI 容器里没有裸 DbContext）→ 详见 net-efcore-developer
        var dbFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<AdminDbContext>>();
        await using var dbContext = await dbFactory.CreateDbContextAsync();
        var userCache = scope.ServiceProvider.GetRequiredService<UserCache>();

        // 使用 dbContext 和 userCache 进行业务操作
        var pendingItems = await dbContext.TaskQueue
            .Where(t => t.status == 0)
            .ToListAsync(cancellationToken);

        foreach (var item in pendingItems)
        {
            if (cancellationToken.IsCancellationRequested) break;
            // 处理逻辑...
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
```

**关键**：每次 `WorkAsync` 执行时创建新的 scope，确保 DbContext 和 Scoped 服务正确释放。

## Admin 内置后台任务

Admin 项目的 DI 管道中已注册两个内置后台任务（二者源码位置不同：`DatabaseOperLogLogger` 在 `Tools/{ProjectName}.Common/OperLog/`，`OnlineUserHeartbeatLogger` 在 `Admin/{ProjectName}.Admin.APIService/Jobs/`——不要到 `OperLog/` 里找心跳任务）：

### 操作日志后台写入（DatabaseOperLogLogger）

```csharp
// DI 管道第 7 步 — 三行注册模式
services.AddSingleton<DatabaseOperLogLogger>(sp =>
    new DatabaseOperLogLogger(
        sp.GetRequiredService<IDbAsyncBulk>(),
        sp.GetRequiredService<IConfiguration>(),
        sp.GetRequiredService<ILogger<DatabaseOperLogLogger>>(),
        tableName: "admin.t_sys_oper_log"));
services.AddSingleton<IOperLogLogger>(sp => sp.GetRequiredService<DatabaseOperLogLogger>());
services.AddHostedService(sp => sp.GetRequiredService<DatabaseOperLogLogger>());
```

负责将 `[OperLog]` 标注的接口操作日志批量写入数据库。

### 在线用户心跳（OnlineUserHeartbeatLogger）

```csharp
// DI 管道第 8 步 — 三行注册模式
services.AddSingleton<OnlineUserHeartbeatLogger>();
services.AddSingleton<IOnlineUserHeartbeatLogger>(sp => sp.GetRequiredService<OnlineUserHeartbeatLogger>());
services.AddHostedService(sp => sp.GetRequiredService<OnlineUserHeartbeatLogger>());
```

负责维护在线用户状态（在线阈值 = 3 × 心跳间隔；默认心跳 `HeartbeatIntervalSeconds = 180`，故离线判定阈值约 **540 秒 / 9 分钟**；该任务自身 `SleepTime = 30000`，即每 30 秒扫描一次心跳）。

### 访问日志清理（VisitLogCleanupRunner）

框架内置的访问日志定期清理任务（`ThirdNet.Vibe.WebAPI.Logging`），由 `AddThirdNetMvcWithPostgresql` 自动注册为 `IHostedService`，**不需要手动注册**。

**执行条件**：
- `CleanupEnabled` 为 `true`（默认）
- `CleanupStrategy` 不为 `"None"`
- 当前小时为 1 点（即每日凌晨 1 点执行一次）
- SleepTime = 3600000（1 小时检查周期）

**清理策略**：

| 策略 | 说明 |
|------|------|
| `"Delete"` | 直接删除过期记录（`DELETE FROM t_visitlog WHERE time < @cutoff`） |
| `"Archive"` | 先归档到 `t_visitloghistory` 再删除（CTE: `DELETE ... RETURNING *` → `INSERT INTO t_visitloghistory`） |
| `"None"` | 不执行清理（等同于禁用） |

**配置**（`appsettings.json` → `"DefaultOptions"` → `"VisitLog"` 节）：

```json
{
  "DefaultOptions": {
    "VisitLog": {
      "CleanupEnabled": true,
      "CleanupStrategy": "Archive",
      "CleanupRetentionDays": 30
    }
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `CleanupEnabled` | bool | true | 是否启用清理（设 false 完全跳过 Check） |
| `CleanupStrategy` | string | "Archive" | 清理策略：Delete / Archive / None |
| `CleanupRetentionDays` | int | 30 | 保留天数（删除早于此天数的记录） |

> 日志清理使用框架数据库连接（`DefaultConnectionString`，即 `ThirdNetDbContext` 所在库），而非业务数据库。

## 常见场景

### 缓存刷新任务

```csharp
public class CacheRefreshTask : BackgroundRunner
{
    private readonly IServiceScopeFactory _scopeFactory;

    public CacheRefreshTask(ILogger<CacheRefreshTask> logger,
        IServiceScopeFactory scopeFactory) : base(logger)
    {
        _scopeFactory = scopeFactory;
        Name = "缓存刷新任务";
        SleepTime = 3600000; // 1小时
    }

    public override bool Check => true;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var configCache = scope.ServiceProvider.GetRequiredService<ConfigCache>();
        await configCache.RemoveConfigDic(); // 删除缓存，下次读取时自动重新加载
    }
}
```

### 日志清理任务

```csharp
public class LogCleanupTask : BackgroundRunner
{
    private readonly IServiceScopeFactory _scopeFactory;

    public LogCleanupTask(ILogger<LogCleanupTask> logger,
        IServiceScopeFactory scopeFactory) : base(logger)
    {
        _scopeFactory = scopeFactory;
        Name = "日志清理任务";
        SleepTime = 86400000; // 24小时
    }

    public override bool Check => true;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        // 同上：AdminDbContext 必须经 IDbContextFactory 取出
        var dbFactory = scope.ServiceProvider.GetRequiredService<IDbContextFactory<AdminDbContext>>();
        await using var db = await dbFactory.CreateDbContextAsync();
        // 清理 30 天前的操作日志
    }
}
```

## SleepTime 参考表

| 场景 | 建议值 | 毫秒数 |
|-----|-------|-------|
| 高频检查（队列处理） | 10秒 | 10000 |
| 常规同步（数据同步） | 1分钟 | 60000 |
| 中频任务（状态更新） | 5分钟 | 300000 |
| 低频任务（报表生成） | 1小时 | 3600000 |
| 每日任务（日志清理） | 24小时 | 86400000 |

## 注意事项

- **自动启动**：应用启动后自动开始执行
- **优雅停止**：应用关闭时优雅停止
- **异常恢复**：即使发生异常，任务也会继续循环执行
- **取消令牌**：在 `WorkAsync` 中检查 `cancellationToken` 以响应停止请求
- **资源释放**：长时间运行的任务注意释放资源，避免内存泄漏

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动流程（→ 见该技能）
- **net-efcore-developer**: 数据库实体（后台任务常操作数据库）
- **net-cache-use**: 缓存功能（后台任务常刷新缓存）
- **net-api-developer**: API 接口开发
