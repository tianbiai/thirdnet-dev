---
name: net-background-job
version: 0.1.0
description: 后台定时任务开发专家，基于 BackgroundRunner 框架生成循环执行的后台任务代码（使用 SleepTime 毫秒间隔，非 Cron 表达式）。**主动用于**：定时任务、后台作业、周期性数据处理、数据同步、定时检查。当用户提到"定时"、"周期"、"后台任务"、"Job"、"Worker"、"每隔"、"自动执行"、"BackgroundService"、"定时同步"、"后台处理"、"循环任务"时，必须使用此技能。
---

## 使用场景

- **定时数据同步**：从外部系统同步数据到本地数据库
- **周期性数据处理**：生成统计报表、清理过期数据、归档历史记录
- **后台作业执行**：批量发送通知、处理消息队列、异步任务处理
- **定时检查和告警**：健康检查、异常监控、阈值告警
- **数据预热**：缓存预热、索引重建、统计数据计算

## 核心特性

- 循环执行任务，可配置休眠间隔
- 支持 ASP.NET Core 依赖注入
- 内置异常捕获和日志记录
- 支持优雅停止和取消操作
- 可配置任务执行条件

## 核心类

**命名空间**: `ThirdNet.Core.Common`
**基类**: `BackgroundRunner`

## 核心属性

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| `SleepTime` | int | 3600000 (1小时) | 每次任务执行后的休眠时间（毫秒） |
| `Name` | string | null | 任务名称，用于日志标识 |
| `Check` | bool | - | 抽象属性，判断是否执行任务 |
| `Logger` | ILogger | - | 标准日志记录器 |

## 核心方法

| 方法 | 类型 | 说明 |
|-----|------|------|
| `WorkAsync` | 抽象方法 | 需要子类实现，定义具体任务逻辑 |
| `ExecuteAsync` | 重写方法 | 后台服务主执行逻辑 |
| `StartAsync` | 重写方法 | 服务启动时的日志记录 |
| `StopAsync` | 重写方法 | 服务停止时的日志记录 |

## 开发步骤

### 1. 创建自定义任务类

继承 `BackgroundRunner` 并实现抽象成员：

```csharp
using Microsoft.Extensions.Logging;

public class DataSyncBackgroundTask : BackgroundRunner
{
    private readonly IDataSyncService _syncService;

    public DataSyncBackgroundTask(
        ILogger<DataSyncBackgroundTask> logger,
        IDataSyncService syncService)
        : base(logger)
    {
        _syncService = syncService;
        Name = "数据同步任务";
        SleepTime = 60000; // 1分钟执行一次
    }

    // 根据业务逻辑判断是否执行任务
    // 例如：仅在工作时间执行
    public override bool Check => DateTime.Now.Hour >= 9 && DateTime.Now.Hour <= 18;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        Logger.LogInformation("开始执行数据同步任务");

        try
        {
            await _syncService.SyncDataAsync(cancellationToken);
            Logger.LogInformation("数据同步任务执行完成");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "数据同步任务执行失败");
            throw;
        }
    }
}
```

### 2. 注册服务

在 `Program.cs` 中注册：

```csharp
builder.Services.AddHostedService<DataSyncBackgroundTask>();
```

## 常见场景示例

### 定时清理过期数据

```csharp
public class CleanupBackgroundTask : BackgroundRunner
{
    private readonly ILogCleanupService _cleanupService;

    public CleanupBackgroundTask(
        ILogger<CleanupBackgroundTask> logger,
        ILogCleanupService cleanupService)
        : base(logger)
    {
        _cleanupService = cleanupService;
        Name = "日志清理任务";
        SleepTime = 86400000; // 24小时执行一次
    }

    public override bool Check => true; // 始终执行

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        var expireDays = 30;
        await _cleanupService.DeleteOldLogsAsync(expireDays);
        Logger.LogInformation("已清理 {Days} 天前的日志", expireDays);
    }
}
```

### 批量通知发送

```csharp
public class NotificationBackgroundTask : BackgroundRunner
{
    private readonly INotificationService _notificationService;

    public NotificationBackgroundTask(
        ILogger<NotificationBackgroundTask> logger,
        INotificationService notificationService)
        : base(logger)
    {
        _notificationService = notificationService;
        Name = "通知发送任务";
        SleepTime = 300000; // 5分钟执行一次
    }

    public override bool Check => true;

    public override async Task WorkAsync(CancellationToken cancellationToken)
    {
        var pendingNotifications = await _notificationService.GetPendingAsync();

        foreach (var notification in pendingNotifications)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            await _notificationService.SendAsync(notification);
        }
    }
}
```

## 注意事项

- **自动启动**：任务会在应用启动后自动开始执行
- **优雅停止**：任务在应用关闭时会优雅停止
- **异常恢复**：即使发生异常，任务也会继续循环执行
- **永久停止**：如需永久停止任务，需要重新部署或修改 `Check` 属性返回 `false`
- **异步处理**：确保在 `WorkAsync` 中正确处理异步操作
- **取消令牌**：检查 `cancellationToken` 以响应停止请求
- **资源释放**：长时间运行的任务注意释放资源，避免内存泄漏

## 在后台任务中使用 Scoped 服务

`BackgroundRunner` 注册为 Singleton，无法直接注入 Scoped 服务（如 DbContext）。需要通过 `IServiceScopeFactory` 创建作用域：

```csharp
public class DataSyncBackgroundTask : BackgroundRunner
{
    private readonly IServiceScopeFactory _scopeFactory;

    public DataSyncBackgroundTask(
        ILogger<DataSyncBackgroundTask> logger,
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
        var dbContext = scope.ServiceProvider.GetRequiredService<MyDbContext>();
        var cacheReader = scope.ServiceProvider.GetRequiredService<ICacheReader>();

        // 使用 dbContext 和 cacheReader 进行业务操作
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

## SleepTime 常用值参考

| 场景 | 建议值 | 毫秒数 |
|-----|-------|-------|
| 高频检查（队列处理） | 10秒 | 10000 |
| 常规同步（数据同步） | 1分钟 | 60000 |
| 中频任务（状态更新） | 5分钟 | 300000 |
| 低频任务（报表生成） | 1小时 | 3600000 |
| 每日任务（日志清理） | 24小时 | 86400000 |
