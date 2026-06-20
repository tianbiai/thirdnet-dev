# Program.cs 与 Startup.cs DI 管道参考

本文档包含 Admin 项目的 Program.cs 启动模式和 Startup.cs 完整的 10 步 DI 注册顺序。

## Program.cs

```csharp
using {ProjectName}.Common.Hosting;
using ThirdNet.Vibe.WebAPI;

var host = AdminHostBuilder.BuildAdminWebHost<Startup>(args);

await host.InitializeDatabasesAsync();           // 框架数据库自动迁移
await host.InitializeFunctionTableAsync();        // 功能表初始化
await host.InitializePermissionCatalogTableAsync(); // 权限目录自动同步

await host.RunAsync();
```

> 说明：
> - `AdminHostBuilder.BuildAdminWebHost<Startup>(args)` 虽然名字带"Admin"，但它是**通用宿主构建方法**（`{ProjectName}.Common.Hosting` 命名空间），返回标准 `IHost`，Service 微服务也用它。
> - `host.InitializeDatabasesAsync()` 是 `{ProjectName}.Admin.APIService` 里 `MigrateHelper` 提供的扩展：依次迁移 `ThirdNetDbContext`（seed）与 `AdminDbContext`（seed + **枚举字典自动同步** `SystemEnumDictSync.SyncAsync`）。
> - `InitializeFunctionTableAsync()` 扫描端点生成功能表；`InitializePermissionCatalogTableAsync()` 扫描 `[PermissionAuthorize]` 同步权限目录。

## Startup.cs DI 管道（10 步注册顺序）

以下顺序不可调换，每一步依赖前一步的注册结果：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    // 第 1 步：响应压缩 + CORS
    services.AddResponseCompression(options => { options.EnableForHttps = true; });
    services.AddThirdNetCors(Configuration);

    // 第 2 步：基础设施（框架DB、JWT、Redis、限流、加密、MVC）
    services.AddAdminCommonInfrastructure(Configuration, "{ProjectName}.Admin.APIService");

    // 第 3 步：业务数据库（AdminDbContext）
    services.AddPooledDbContextFactory<AdminDbContext>(...);

    // 第 4 步：缓存专用数据库上下文（CacheDbContext，共享连接字符串）
    services.AddPooledDbContextFactory<CacheDbContext>(...);

    // 第 5 步：健康检查
    services.AddHealthChecks().AddNpgSql(...).AddRedisHealthCheck();

    // 第 6 步：认证授权层
    services.AddScoped<IAccountValidator, AdminAccountValidator>();
    services.AddAdminCacheServices();                              // 所有缓存域（Singleton）
    services.AddScoped<IPermissionProvider, CachePermissionProvider>();
    services.AddSingleton<IGetAccountTokenKey, AccountTokenKeyProvider>();
    services.AddScoped<OperatorContext>();
    services.AddScoped<IOperatorContext>(sp => sp.GetRequiredService<OperatorContext>());

    // 第 7 步：操作日志
    services.AddSingleton<DatabaseOperLogLogger>(...);
    services.AddSingleton<IOperLogLogger>(sp => sp.GetRequiredService<DatabaseOperLogLogger>());
    services.AddHostedService(sp => sp.GetRequiredService<DatabaseOperLogLogger>());
    services.AddScoped<OperLogFilter>();

    // 第 8 步：在线用户心跳
    services.AddSingleton<OnlineUserHeartbeatLogger>();
    services.AddSingleton<IOnlineUserHeartbeatLogger>(sp => sp.GetRequiredService<OnlineUserHeartbeatLogger>());
    services.AddHostedService(sp => sp.GetRequiredService<OnlineUserHeartbeatLogger>());

    // 第 9 步：业务服务（Scoped）
    services.AddScoped<SysUserService>();
    services.AddScoped<SysRoleService>();

    // 第 10 步：帮助页 + 控制器
    services.AddAdminCommonHelpPage(Configuration);
    services.AddAdminCommonControllers(options => { options.Filters.Add<OperLogFilter>(); });
}
```

**新增模块时**：只需在第 9 步添加 `services.AddScoped<YourService>();`。

> 第 2 步的 `AddAdminCommonInfrastructure` 内部会调用框架的 `AddThirdNetMvcWithPostgresql`（一次注册 MVC/认证/授权/缓存/日志/批量等组件）与 `UseThirdNetMvc`（9 个中间件的执行顺序）。这些**框架级**注册清单与中间件顺序见 [`net-microservice-generator` 的 framework-pipeline.md](../../net-microservice-generator/references/framework-pipeline.md)——本文档只管「你在 Startup.cs 里要写的项目级 10 步」，框架内部细节不在本文重复。
