---
name: net-microservice-generator
version: 0.1.0
description: .NET 微服务解决方案生成器，负责创建标准化的项目结构和代码骨架（Common、Cache、API、Database 分层）。**主动用于**：创建新的微服务项目、初始化项目架构、生成解决方案结构、搭建脚手架。当用户提到"创建项目"、"新建服务"、"新建微服务"、"项目结构"、"解决方案"、"sln"、"初始化项目"、"脚手架"、"scaffold"、"dotnet new"、"搭建框架"、"新建服务端"、"Startup"、"Program"、"中间件"、"配置"、"数据库连接"、"Redis"、"appsettings"时，必须使用此技能。
---

## 使用场景

- 创建新的 .NET 微服务项目
- 初始化项目架构和目录结构
- 生成标准化解决方案文件
- 搭建多服务项目框架

## 角色定位

你是一名**资深 .NET 企业级解决方案架构师**，负责**按公司规范生成标准化微服务 API 解决方案结构与代码骨架**。你的输出必须**可直接落地**，不得自由发挥。

## 技术栈（不可变）

- **.NET 10**
- **PostgreSQL**
- **Entity Framework Core（Code First）**
- **微服务架构**

## ⚠️ 强禁止

**在项目生成阶段（MVP 框架），不要添加以下功能：**

- ❌ Minimal API
- ❌ 合并 Api 与 Database
- ❌ 省略 Database 项目
- ❌ 擅自扩展技术栈

## 工作流程

当用户请求创建微服务项目时，按以下步骤执行：

1. 确认项目名和服务列表
2. 检查并安装必要的模板
3. 创建项目根目录结构
4. 创建工具类库（Common、Cache）
5. 创建 IdentityService（如需要）
6. 创建各业务微服务
7. 配置解决方案引用关系
8. 生成完整的目录结构说明

## 模板安装

通过 `dotnet new list` 判断是否存在 `ThirdNet.Core.WebApiService` 和 `ThirdNet.Core.IdentityService` 模板。

若不存在，则先安装：

```bash
dotnet new --debug:reinit
dotnet new install ThirdNet.Core.WebApiService --force
dotnet new install ThirdNet.Core.IdentityService --force
```

**安装失败处理**：如果模板包不在本地 NuGet 缓存中，需要先确认模板包的 NuGet 源地址，然后通过 `dotnet new install <包路径或NuGet包ID>` 安装。安装后再次运行 `dotnet new list` 确认模板可用。

## 项目类型

### 工具类库

在 `backend/{ProjectName}/` 下创建 `Tools` 作为根文件夹：

```bash
cd backend/{ProjectName}/Tools
dotnet new classlib -n {ProjectName}.Common -o {ProjectName}.Common
dotnet new classlib -n {ProjectName}.Cache -o {ProjectName}.Cache
```

### 认证服务（IdentityService）

```bash
cd backend/{ProjectName}/{ProjectName}.Identity
dotnet new IdentityService -n {ProjectName}.Identity.API -o {ProjectName}.Identity.API
dotnet new classlib -n {ProjectName}.Identity.Database -o {ProjectName}.Identity.Database
```

### 业务微服务

```bash
cd backend/{ProjectName}/{ProjectName}.{ServiceName}
dotnet new WebApiService -n {ProjectName}.{ServiceName}.API -o {ProjectName}.{ServiceName}.API
dotnet new classlib -n {ProjectName}.{ServiceName}.Database -o {ProjectName}.{ServiceName}.Database
```

## 标准目录结构

```
backend/
└── {ProjectName}/                           # 项目文件夹（英文名）
    ├── plan.md                              # 项目规划文档
    ├── changelog.md                         # 变更日志
    ├── Tools/
    │   ├── {ProjectName}.Common/            # 通用工具类库
    │   └── {ProjectName}.Cache/             # 缓存工具类库
    ├── {ProjectName}.Identity/              # 认证服务（如需要）
    │   ├── spec.md                          # 服务功能说明书
    │   ├── {ProjectName}.Identity.slnx
    │   ├── {ProjectName}.Identity.API/
    │   └── {ProjectName}.Identity.Database/
    └── {ProjectName}.{ServiceName}/         # 业务服务：项目名.服务名
        ├── spec.md                          # 服务功能说明书
        ├── {ProjectName}.{ServiceName}.slnx
        ├── {ProjectName}.{ServiceName}.API/
        │   ├── Controllers/
        │   │   ├── Manager/                 # 管理端 Controller
        │   │   ├── App/                     # 应用端 Controller
        │   │   └── Third/                   # 第三方端 Controller
        │   ├── Program.cs
        │   └── appsettings.json
        └── {ProjectName}.{ServiceName}.Database/
            ├── Models/                      # 实体模型
            ├── Configurations/              # Fluent API 配置
            └── Migrations/                  # 数据库迁移文件
                └── {DbContextName}/         # 按 DbContext 分目录
```

**命名规范（均使用英文名）**：

| 层级           | 格式                              | 示例                           |
| -------------- | --------------------------------- | ------------------------------ |
| 项目文件夹     | `{ProjectName}`                   | `MyApp`                        |
| 服务文件夹     | `{ProjectName}.{ServiceName}`     | `MyApp.User`, `MyApp.Order`    |
| 解决方案文件   | `{ProjectName}.{ServiceName}.slnx`| `MyApp.User.slnx`              |
| API 项目       | `{ProjectName}.{ServiceName}.API` | `MyApp.User.API`               |
| Database 项目  | `{ProjectName}.{ServiceName}.Database` | `MyApp.User.Database`     |

## 服务启动配置

### Program.cs 模板

```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace MyApp.UserService
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    webBuilder.UseStartup<Startup>();
                });
    }
}
```

### Startup.cs 配置详解

#### ConfigureServices 阶段（服务注册）

| 序号 | 配置项 | 方法 | 说明 |
|-----|-------|------|------|
| 1 | 初始化配置库 | `AddInitDbWithPostgresql` | 连接框架配置数据库 |
| 2 | 启用压缩 | `AddResponseCompression` | 启用响应压缩 |
| 3 | 配置限流 | `AddThirdNetIpAndApplicationPathRateLimiting` | IP + 路径限流 |
| 4 | 配置认证 | `AddThirdNetDefaultRSAJwt` | RSA JWT 认证 |
| 5 | 配置 Redis | `AddRedisExtensionService` | Redis 缓存（WebApiService） |
| 6 | 配置 MVC | `AddThirdNetMvcWithPostgresql` | MVC + PostgreSQL |
| 7 | 配置帮助页面 | `AddThirdNetVersioningHelpPage` | Swagger 文档 |

#### Configure 阶段（中间件配置）

| 序号 | 配置项 | 方法 | 说明 |
|-----|-------|------|------|
| 1 | 初始化数据库 | `InitializeThirdNetDatabase` | 初始化框架数据库 |
| 2 | 启用压缩 | `UseResponseCompression` | 启用响应压缩 |
| 3 | 配置帮助页面 | `UseThirdNetVersioningHelpPage` | Swagger 文档页面 |
| 4 | 启用 MVC | `UseThirdNetMvc` | 启用 MVC 中间件管道 |

## 中间件执行顺序

`UseThirdNetMvc` 内部中间件执行顺序：

| 序号 | 中间件 | 说明 |
|-----|-------|------|
| 1 | `UseForwardedHeaders` | 处理反向代理头（X-Forwarded-For 等） |
| 2 | `UseThirdNetUseExceptionHandler` | 全局异常处理 |
| 3 | `UseRouting` | 路由匹配 |
| 4 | `RequestLoggerMiddleware` | 访问日志记录 |
| 5 | `UseAuthentication` | 认证中间件 |
| 6 | `UseAuthorization` | 授权中间件 |
| 7 | `AccountTokenCheckMiddleware` | Token 有效性检查 |
| 8 | `MapControllers` | 映射控制器路由 |

**注意**：不要在 `UseThirdNetMvc` 外部手动添加认证/授权中间件，会导致重复执行。

## 数据库配置

> 连接字符串配置（`DefaultConnectionString`、`ConnectionString` 等）请参阅 **net-efcore-developer** 技能。

### 多数据库支持

| 方法 | 数据库 | NuGet 包 |
|-----|-------|---------|
| `AddThirdNetMvcWithPostgresql` | PostgreSQL | Npgsql.EntityFrameworkCore.PostgreSQL |
| `AddThirdNetMvcWithMysql` | MySQL | Pomelo.EntityFrameworkCore.MySql |
| `AddThirdNetMvcWithSqlServer` | SQL Server | Microsoft.EntityFrameworkCore.SqlServer |
| `AddThirdNetMvcWithOpenGuass` | OpenGuass | 相应驱动包 |

## Redis 配置

### 启用 Redis

在 `Startup.ConfigureServices` 中配置：

```csharp
services.AddRedisExtensionService(Configuration);
```

### 配置项

在 `appsettings.json` 中配置：

```json
{
  "Redis": {
    "Host": "localhost",
    "Port": 6379,
    "Password": "",
    "InstanceName": "myapp"
  }
}
```

### 使用 Redis

注入 `ICacheReader` 和 `ICacheRefresh` 接口使用缓存功能，详见 @net-cache-use skill。

## 解决方案引用关系

每个服务的 `.slnx` 文件需要引用：
- 通用类库 Common + Cache
- API 服务层 + Database 数据层

## 模板文件（按需读取）

当创建新项目时，按以下模板生成文档：

- 服务规格：[service-spec-template](references/service-spec-template.md)
- 变更日志：[changelog-template](references/changelog-template.md)

## 输出要求

- 所有命令必须可直接复制执行
- 目录结构必须符合标准规范
- 不得添加未明确要求的额外功能
- 保持技术栈严格一致

## 相关技能

- **net-authentication**: 认证系统配置
- **net-api-developer**: API 接口开发
- **net-efcore-developer**: 数据库实体开发
- **net-cache-use**: 缓存功能集成
- **net-background-job**: 后台任务开发
- **net-database-bulkcopy**: 批量数据操作
