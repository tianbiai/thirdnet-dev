---
name: net-microservice-generator
description: >
  ThirdNet Service 微服务模板开发指南：dotnet new thirdnet-service 创建微服务、跨项目引用
  （Admin.Common/Admin.Cache）、ServiceDbContext、共享认证、Startup.cs 与中间件顺序、
  appsettings 管理、健康检查、按 Admin 模式添加业务模块。
  当用户提到"new service"、"微服务"、"thirdnet-service"、"ServiceDbContext"、
  "创建微服务"、"新建服务"、"AddThirdNetMvc"、"appsettings"、"中间件"时，必须使用此技能。
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
# 安装模板（先卸载清除混装的旧版本；再用 --force 强制安装，确保拿到最新模板；
#    首次卸载报"找不到"属正常）
dotnet new uninstall ThirdNet.Service.Template 2>/dev/null || true
dotnet new install ThirdNet.Service.Template --force

# 创建微服务（在 backend/ 目录内）
mkdir -p backend
cd backend
dotnet new thirdnet-service -n {ServiceName}

# --AdminName 可选：指定所引用 Admin 项目的公司前缀（裸 {ProjectName}）。
# 缺省时自动从 -n 推导（取第一个 "." 之前的部分，如 -n MyCompany.OrderService → MyCompany）。
# 仅当 -n 无法正确推导出 Admin 前缀时才需显式传入：
dotnet new thirdnet-service -n {ServiceName} --AdminName {ProjectName}

# 框架库版本以模板 `Directory.Build.props` 为准，通常无需指定
```

### 解决方案文件管理

创建微服务后，**必须**将生成的项目添加到解决方案文件中。

#### 场景 A：添加到已有 Admin 解决方案（推荐）

当 `backend/` 目录下已存在 Admin 的 `.slnx` 文件时，将 Service 项目添加进去：

```bash
cd backend

# Admin 解决方案根在 backend/{ProjectName}.Admin/，slnx 在其内部；
# Service 创建在 backend/{ServiceName}/（模板 sourceName 为 "ThirdNetVibe.Service"，
# dotnet new 生成 {ServiceName}/ 包装层，下含 {ServiceName}.API 与 {ServiceName}.Database，无 Service/ 子层）
dotnet new thirdnet-service -n {ServiceName}
# 加入 Admin 解决方案的 "Service" 文件夹：
#   -s 用裸名字；--include-references:false 防止把 Service 引用的 Admin.Common/Admin.Cache 拖进 Service 文件夹
dotnet sln {ProjectName}.Admin/{ProjectName}.Admin.slnx add \
  {ServiceName}/{ServiceName}.API/{ServiceName}.API.csproj \
  {ServiceName}/{ServiceName}.Database/{ServiceName}.Database.csproj \
  -s Service --include-references:false
```

#### 场景 B：创建独立解决方案

当没有已有的 `.slnx` 文件时（独立 Service 项目），创建新的解决方案：

```bash
cd backend

# 创建解决方案文件
dotnet new sln -n {ServiceName} -o .

# 添加 Service 项目
dotnet sln {ServiceName}.slnx add \
  {ServiceName}/{ServiceName}.API/{ServiceName}.API.csproj \
  {ServiceName}/{ServiceName}.Database/{ServiceName}.Database.csproj \
  -s Service --include-references:false
```

### 生成的项目结构

```
backend/
├── {ProjectName}.Admin/                  ← 已有 Admin 解决方案根
│   ├── {ProjectName}.Admin.slnx
│   ├── plan.md
│   ├── changelog.md
│   ├── spec.md                           # 项目级规格说明书（全局唯一）
│   ├── Admin/
│   │   ├── {ProjectName}.Admin.APIService/
│   │   └── {ProjectName}.Admin.Database/
│   └── Tools/
│       ├── {ProjectName}.Common/
│       └── {ProjectName}.Cache/
└── {ServiceName}/              ← 新创建的 Service 项目（dotnet new 生成的包装层）
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

## 模板升级

模板升级（`thirdnet-migrate`）的完整流程见 `thirdnet-template-upgrade` 技能（单一事实来源）。

## ServiceDbContext

Service 使用独立的 DbContext 和 schema：

```csharp
public class ServiceDbContext : DbContext
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // 自定义 schema（如 "order"、"inventory" 等）
        modelBuilder.HasDefaultSchema("service");

        // 自动扫描配置类（实体配置统一放 EntityConfigurations/，约定优于配置）
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ServiceDbContext).Assembly);

        // 注意：Service 模板的 ServiceDbContext 不注册 xmin 乐观并发字段
        // （与 Admin 的 AdminDbContext 不同；如个别实体需要并发控制，请在对应 EntityConfiguration 中单独配置）。
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
- Service 不注册 `OperLogFilter`、其端点也不加 `[OperLog]` 特性（操作日志统一由 Admin 处理）
- Service 使用 `ServiceDbContext` 而非 `AdminDbContext`
- CacheDbContext 使用 Admin 的 `DefaultConnectionString`

## 框架管道与中间件

`AddThirdNetMvcWithPostgresql` 自动注册的组件清单、`UseThirdNetMvc` 中间件执行顺序见 [framework-pipeline.md](references/framework-pipeline.md)——Service 与 Admin 共用同一套框架管道，了解执行顺序有助于排查认证/授权问题。

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

// Service 的 MigrateHelper 只提供【同步】的 InitializeDatabases()（仅迁移 ServiceDbContext）。
// 注意：Service 的 Program.cs 只调 InitializeDatabases()——不像 Admin 那样还调
// InitializeDatabasesAsync() + InitializeFunctionTableAsync() + InitializePermissionCatalogTableAsync()
//（后三者是框架 ThirdNet.Vibe.WebAPI 的扩展方法，定义在 ThirdNetDatabaseHelper，Admin 用于
// 扫描端点功能表 / 权限目录；Service 模板不启用它们）。
host.InitializeDatabases();

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
  --project {ServiceName}/{ServiceName}.Database \
  --startup-project {ServiceName}/{ServiceName}.API

dotnet ef database update \
  --project {ServiceName}/{ServiceName}.Database \
  --startup-project {ServiceName}/{ServiceName}.API
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

- **backend-workflow**：后端开发入口与文档驱动流程（→ 见该技能）
- **net-efcore-developer**: 数据库实体开发
- **net-api-developer**: API 接口开发
- **net-cache-use**: 缓存集成
- **net-rbac**: 权限体系
- **net-authentication**: 认证系统配置
