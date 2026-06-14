---
name: net-microservice-generator
description: >
  ThirdNet Service 微服务模板开发指南。覆盖 dotnet new thirdnet-service 创建微服务、
  跨项目引用（Admin.Common、Admin.Cache）、ServiceDbContext 自定义 schema、
  共享认证（CachePermissionProvider）、Startup.cs 配置详解、中间件执行顺序、
  AddThirdNetMvcWithPostgresql 内部注册内容、Redis 配置、appsettings 配置文件管理、
  健康检查、按 Admin 模式添加业务模块。
  当用户提到"new service"、"微服务"、"thirdnet-service"、"ServiceDbContext"、
  "跨项目引用"、"service template"、"创建微服务"、"新建服务"、"AddThirdNetMvc"、
  "appsettings"、"中间件"时，必须使用此技能。
---

# ThirdNet Service 微服务模板开发

## 概述

Service 模板用于创建独立微服务，它与 Admin 项目共享认证和权限体系，但拥有独立的业务数据库。

> 创建/维护微服务时，可复用的框架与模板类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)。

```
Admin 项目                    Service 项目
├── Admin.Common ──────────→ 引用（ProjectReference）
├── Admin.Cache ───────────→ 引用（ProjectReference）
├── Admin.Database              ├── Service.Database（独立 schema）
└── Admin.APIService            └── Service.API（独立 Controllers/Services）
```

## 创建微服务

### 前提条件

- 已安装 ThirdNet.Service.Template 模板
- 已创建 Admin 项目（Service 需要引用 Admin.Common 和 Admin.Cache）

### 创建命令

```bash
# 安装模板
dotnet new install ThirdNet.Service.Template --force

# 创建微服务（在 backend/ 目录内）
mkdir -p backend
cd backend
dotnet new thirdnet-service -n {ServiceName}

# 如果 Admin 使用了自定义名称
dotnet new thirdnet-service -n {ServiceName} --AdminName {ProjectName}.Admin

# 可选：指定框架版本
dotnet new thirdnet-service -n {ServiceName} \
  --VibeCommonVersion 0.0.6 \
  --VibeWebAPIVersion 0.0.6
```

### 解决方案文件管理

创建微服务后，**必须**将生成的项目添加到解决方案文件中。

#### 场景 A：添加到已有 Admin 解决方案（推荐）

当 `backend/` 目录下已存在 Admin 的 `.slnx` 文件时，将 Service 项目添加进去：

```bash
cd backend

# 添加 Service 项目到已有解决方案
dotnet sln {ProjectName}.Admin.slnx add \
  {ServiceName}/Service/{ServiceName}.API/{ServiceName}.API.csproj \
  {ServiceName}/Service/{ServiceName}.Database/{ServiceName}.Database.csproj \
  -s /src/Service/
```

#### 场景 B：创建独立解决方案

当没有已有的 `.slnx` 文件时（独立 Service 项目），创建新的解决方案：

```bash
cd backend

# 创建解决方案文件
dotnet new sln -n {ServiceName} -o .

# 添加 Service 项目
dotnet sln {ServiceName}.slnx add \
  {ServiceName}/Service/{ServiceName}.API/{ServiceName}.API.csproj \
  {ServiceName}/Service/{ServiceName}.Database/{ServiceName}.Database.csproj \
  -s /src/Service/
```

### 生成的项目结构

```
backend/
├── plan.md
├── changelog.md
├── spec.md                              # 项目级规格说明书（全局唯一）
├── Admin/                               ← 已有的 Admin 项目
│   ├── {ProjectName}.Admin.APIService/
│   └── {ProjectName}.Admin.Database/
├── Tools/                               ← 已有的工具类库
│   ├── {ProjectName}.Common/
│   └── {ProjectName}.Cache/
└── {ServiceName}/              ← 新创建的 Service 项目
    └── Service/
        ├── {ServiceName}.API/       # API 宿主
        │   ├── Controllers/Manager/
        │   │   └── HealthManagerController.cs
        │   ├── Program.cs
        │   ├── Startup.cs
        │   └── appsettings.json
        └── {ServiceName}.Database/  # 数据层
            ├── DbContext/
            │   └── ServiceDbContext.cs
            └── Models/                     # 空，待开发
```

## 模板升级（ThirdNet.Migrate）

`ThirdNet.Migrate` 是随模板提供的**模板升级 CLI**（**不是数据库迁移工具**），用于让已生成的项目跟进模板的新版本——避免模板修复了 bug 或改进了结构后，旧项目无法同步。

```bash
thirdnet-migrate check                       # 检查 NuGet 源上模板是否有新版本
thirdnet-migrate diff                        # 下载最新模板、替换 sourceName、预览与当前项目的差异
thirdnet-migrate apply                       # 应用差异到当前项目（支持 --dry-run / --force / --non-interactive）
```

内部经 `ProjectScanner`→`TemplateExtractor`→`SourceNameReplacer`→`FileDiffer`→`MigrationPreparer` 完成「扫描→下载→替换项目前缀→三方 diff→应用」。**先用 `diff` 预览、确认无误再 `apply`**；生产项目务必先提交 Git 以便回滚。

## ServiceDbContext

Service 使用独立的 DbContext 和 schema：

```csharp
public class ServiceDbContext : DbContext
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 自定义 schema（如 "order"、"inventory" 等）
        modelBuilder.HasDefaultSchema("service");

        // 自动扫描配置类
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ServiceDbContext).Assembly);

        // xmin 乐观并发
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            modelBuilder.Entity(entityType.ClrType, b =>
                b.Property<uint>("xmin").IsRowVersion().ValueGeneratedOnAddOrUpdate());
        }
    }
}
```

## Startup.cs 配置

Service 的 Startup.cs 复用 Admin 的基础设施层：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    // 1. 基础设施（与 Admin 完全一致）
    services.AddResponseCompression(options => { options.EnableForHttps = true; });
    services.AddThirdNetCors(Configuration);
    services.AddAdminCommonInfrastructure(Configuration, assembly);

    // 2. Service 数据库
    services.AddPooledDbContextFactory<ServiceDbContext>(options =>
    {
        options.UseNpgsql(connectionString,
            b => b.MigrationsAssembly("{ServiceName}.Database"));
    });

    // 3. 缓存上下文（使用 Admin 的 DefaultConnectionString）
    services.AddPooledDbContextFactory<CacheDbContext>(options =>
    {
        options.UseNpgsql(defaultConnStr);
    });

    // 4. 健康检查
    services.AddHealthChecks()
        .AddNpgSql(...).AddRedisHealthCheck();

    // 5. 认证授权（与 Admin 共享，无需 IAccountValidator）
    services.AddAdminCacheServices();
    services.AddScoped<OperatorContext>();
    services.AddScoped<IPermissionProvider, CachePermissionProvider>();

    // 6. 业务服务（按需添加）
    // services.AddScoped<OrderService>();

    // 7. 帮助页 + 控制器
    services.AddAdminCommonHelpPage(Configuration);
    services.AddAdminCommonControllers();
}
```

**与 Admin 的区别**：
- Service 不注册 `IAccountValidator`（用户认证由 Admin 处理）
- Service 不注册 `OperLogFilter`（操作日志由 Admin 处理）
- Service 使用 `ServiceDbContext` 而非 `AdminDbContext`
- CacheDbContext 使用 Admin 的 `DefaultConnectionString`

## 中间件执行顺序

`UseThirdNetMvc` 内部中间件执行顺序：

| 序号 | 中间件 | 说明 |
|-----|-------|------|
| 1 | `UseForwardedHeaders` | 处理反向代理头 |
| 2 | `UseThirdNetUseExceptionHandler` | 全局异常处理 |
| 3 | `UseRouting` | 路由匹配 |
| 4 | `RequestLoggerMiddleware` | 访问日志记录 |
| 5 | `UseAuthentication` | 认证中间件 |
| 6 | `UseAuthorization` | 授权中间件 |
| 7 | `AccountTokenCheckMiddleware` | Token 有效性检查 |
| 8 | `MapControllers` | 映射控制器路由 |

**注意**：不要在 `UseThirdNetMvc` 外部手动添加认证/授权中间件，会导致重复执行。

## AddThirdNetMvcWithPostgresql 内部注册

`AddThirdNetMvcWithPostgresql` 是框架核心注册方法，一次调用自动注册以下组件：

| 分类 | 注册内容 | 说明 |
|------|---------|------|
| MVC | `CustomExceptionFilter` | 全局异常，`WebApiException` 返回对应 HTTP 状态码 |
| MVC | `ValidateModelAttribute` | 自动校验 ModelState |
| MVC | JSON 序列化 | 小写策略 + DateTime 转换器 |
| 认证 | Basic + Bearer | 双层认证 |
| 授权 | 四个策略 | Default、Logon、Basic、Both |
| 授权 | 通配符授权 | 支持角色通配符 `*` |
| 缓存 | 应用/IP/角色缓存 | 内存缓存 |
| 日志 | 访问日志 + 后台日志 | 批量写入 |
| 批量 | `IDbAsyncBulk` | PostgreSQL 批量操作（Transient） |
| 其他 | `ICheckClient`/`IAccountTokenTimeCache` 等 | 客户端签名、Token 检测 |

> **Redis 不在此方法内注册**。Redis 需通过 `AddRedisExtensionService` 单独注册，且必须在 `AddThirdNetMvcWithPostgresql` 之前调用。

## Redis 配置

在 `Startup.ConfigureServices` 中配置：

```csharp
services.AddRedisExtensionService(Configuration);
```

`appsettings.json` 配置节：

```json
{
  "RedisExtension": {
    "Connection": "Redis连接地址（host:port,password=xxx）",
    "KeyPrefix": "myapp",
    "DefaultDatabase": 0
  }
}
```

| 属性 | 说明 |
|------|------|
| `Connection` | Redis 连接字符串 |
| `KeyPrefix` | 缓存键前缀，多应用隔离 |
| `DefaultDatabase` | 默认数据库编号 |

## 配置文件管理

采用三层配置文件模型：

| 文件 | 提交 Git | 内容 |
|------|---------|------|
| `appsettings.json` | ✅ | 配置模板，使用说明性字符串标识字段用途 |
| `appsettings.Development.json` | ❌ | 本地开发真实值，覆盖模板中的对应项 |
| 生产环境配置 | ❌ | CI/CD 部署时直接替换 JSON 属性值 |

**核心规则**：
- 敏感值在 `appsettings.json` 中使用说明性字符串，不使用占位符
- 两个文件的配置节结构必须保持一致
- **禁止**将包含真实密码/密钥的文件提交至版本库

详细规范见 [appsettings-management.md](references/appsettings-management.md)。

## Program.cs

> **关于 `BuildAdminWebHost` 命名**：虽然方法名包含"Admin"，但它是框架提供的通用构建方法，Admin 和 Service 项目均使用此方法。名称中的"Admin"是框架历史命名，不影响 Service 项目的功能。

```csharp
using {ProjectName}.Common.Hosting;
using ThirdNet.Vibe.WebAPI;

var host = AdminHostBuilder.BuildAdminWebHost<Startup>(args);

await host.InitializeDatabasesAsync();
await host.InitializeFunctionTableAsync();
await host.InitializePermissionCatalogTableAsync();

await host.RunAsync();
```

## 添加业务模块

在 Service 中添加业务模块的步骤与 Admin 一致，请参考以下技能：

1. **实体** — `net-efcore-developer`（使用 ServiceDbContext 和自定义 schema）
2. **缓存** — `net-cache-use`（在 CacheServiceExtensions 中注册）
3. **API** — `net-api-developer`（Controller、Service、DTO）
4. **权限** — `net-rbac`（使用 `module:entity:action` 格式的权限字符串）

### 迁移命令

在 `backend/` 目录下执行（路径相对 `backend/`）：

```bash
dotnet ef migrations add AddOrderEntity \
  --project {ServiceName}/Service/{ServiceName}.Database \
  --startup-project {ServiceName}/Service/{ServiceName}.API

dotnet ef database update \
  --project {ServiceName}/Service/{ServiceName}.Database \
  --startup-project {ServiceName}/Service/{ServiceName}.API
```

## 连接字符串配置

| 连接字符串 | 用途 |
|-----------|------|
| ConnectionString | Service 业务数据库（ServiceDbContext） |
| DefaultConnectionString | 框架数据库（ThirdNetDbContext）+ 缓存回退查询 |

## 参考文件索引

| 文件 | 内容 | 何时读取 |
|-----|------|---------|
| [appsettings-management.md](references/appsettings-management.md) | 配置文件管理规范、完整模板、入职指南 | 创建项目配置或修改 appsettings 时 |

## 相关技能

- **backend-workflow**: 完整工作流和文档驱动开发
- **net-efcore-developer**: 数据库实体开发
- **net-api-developer**: API 接口开发
- **net-cache-use**: 缓存集成
- **net-rbac**: 权限体系
- **net-authentication**: 认证系统配置
