---
name: net-microservice-generator
version: 1.0.0
description: .NET 微服务解决方案生成器，负责创建标准化的项目结构和代码骨架（Common、Cache、API、Database 分层）。**主动用于**：创建新的微服务项目、初始化项目架构、生成解决方案结构、搭建脚手架。当用户提到"创建项目"、"新建服务"、"新建微服务"、"项目结构"、"解决方案"、"sln"、"初始化项目"、"脚手架"、"scaffold"、"dotnet new"、"搭建框架"、"新建服务端"、"Startup"、"Program"、"中间件"、"配置"、"数据库连接"、"Redis"、"appsettings"时，必须使用此技能。
---

## 使用场景

- 创建新的 .NET 微服务项目
- 初始化项目架构和目录结构
- 生成标准化解决方案文件
- 搭建多服务项目框架

## 文档生成

> 新建项目时的文档生成（plan.md、changelog.md、spec.md）由 **backend-workflow** 技能统一管理。
> 本技能专注于项目结构生成。使用本技能前，确保已通过 `backend-workflow` 创建了必要的文档。

### 前置条件

在执行项目框架生成之前，必须确认以下文档已存在：

- [ ] `backend/plan.md` — 全局开发计划
- [ ] `backend/changelog.md` — 变更日志
- [ ] `backend/<ServiceName>/spec.md` — 每个服务的功能说明书

**文档不存在 → 停止 → 先通过 `backend-workflow` 技能生成文档**

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

在 `backend/` 下创建 `Tools` 作为根文件夹：

```bash
cd backend/Tools
dotnet new classlib -n Common -o Common
dotnet new classlib -n Cache -o Cache
```

### 认证服务（IdentityService）

```bash
cd backend/identity
dotnet new IdentityService -n identity.API -o identity.API
dotnet new classlib -n identity.Database -o identity.Database
```

### 业务微服务

```bash
cd backend/{ServiceName}
dotnet new WebApiService -n {ServiceName}.API -o {ServiceName}.API
dotnet new classlib -n {ServiceName}.Database -o {ServiceName}.Database
```

## 标准目录结构

```
backend/
├── plan.md                              # 项目规划文档（全局）
├── changelog.md                         # 变更日志（全局）
├── Tools/
│   ├── Common/                          # 通用工具类库
│   └── Cache/                           # 缓存工具类库
├── identity/                            # 认证服务（如需要）
│   ├── spec.md                          # 服务功能说明书
│   ├── identity.slnx
│   ├── identity.API/
│   └── identity.Database/
└── {ServiceName}/                       # 业务服务
    ├── spec.md                          # 服务功能说明书
    ├── {ServiceName}.slnx
    ├── {ServiceName}.API/
    │   ├── Controllers/
    │   │   ├── Manager/                 # 管理端 Controller
    │   │   ├── App/                     # 应用端 Controller
    │   │   └── Third/                   # 第三方端 Controller
    │   ├── Program.cs
    │   └── appsettings.json
    └── {ServiceName}.Database/
        ├── Models/                      # 实体模型
        ├── Configurations/              # Fluent API 配置
        └── Migrations/                  # 数据库迁移文件
            └── {DbContextName}/         # 按 DbContext 分目录
```

**命名规范（均使用英文名）**：

| 层级           | 格式                        | 示例                        |
| -------------- | --------------------------- | --------------------------- |
| 服务文件夹     | `{ServiceName}`             | `identity`, `coin`          |
| 解决方案文件   | `{ServiceName}.slnx`        | `identity.slnx`             |
| API 项目       | `{ServiceName}.API`         | `identity.API`              |
| Database 项目  | `{ServiceName}.Database`    | `identity.Database`         |

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
| 6 | 配置 MVC | `AddThirdNetMvcWithPostgresql` | MVC + 框架核心组件（详见下方） |
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

## AddThirdNetMvcWithPostgresql 内部注册内容

`AddThirdNetMvcWithPostgresql` 是框架核心注册方法，一次调用自动注册以下组件：

| 分类 | 注册内容 | 说明 |
|------|---------|------|
| **MVC** | `CustomExceptionFilter` | 全局异常过滤器，`WebApiException` 返回对应 HTTP 状态码 |
| **MVC** | `ValidateModelAttribute` | 自动校验 `ModelState`，无效时返回 400 |
| **MVC** | JSON 序列化 | 小写策略（`JsonLowercasePolicy`）+ DateTime 转换器 |
| **认证** | Basic + Bearer 认证 | 双层认证（应用级 Basic + 用户级 JWT） |
| **授权** | 策略注册 | `Default`、`Logon`、`Basic`、`Both` 四个策略 |
| **授权** | `ThirdNetAuthorizationHandler` | 基于角色的资源授权（支持通配符 `*`） |
| **授权** | `ProviderPolicyProvider` + `ProviderAuthorizationHandler` | 基于 scope 的动态策略授权 |
| **缓存** | `ApplicationInfoCache` | 应用配置内存缓存（`SessionRunner`） |
| **缓存** | `IpWhiteListCache` / `IpBlackListCache` | IP 黑白名单内存缓存 |
| **缓存** | `ApplicationAuthorityCache` / `RolesAuthorityCache` | 角色-权限映射缓存 |
| **日志** | `NpgsqlVisitLogRunner`（`IVisitLogger`） | 访问日志批处理器（30秒批量写入） |
| **日志** | `DatabaseBackgroundLogger`（`IBackgroundLogger`） | 后台任务日志（写入 `BackgroundLog` 表） |
| **批量** | `PostgresqlAsyncBulk`（`IDbAsyncBulk`） | PostgreSQL 批量操作（Transient） |
| **其他** | `DefaultCheckClient`（`ICheckClient`） | 应用认证验证（HMAC-SHA512 签名） |
| **其他** | `HMacClientCryptography`（`IClientCryptography`） | 客户端签名生成 |
| **其他** | `DefaultRolesProvider`（`IRolesProvider`） | 默认角色解析 |
| **其他** | `IAccountTokenTimeCache` / `IGetAccountTokenKey` | Token 凭证变更检测 |

> **Redis 不在此方法内注册**。Redis 需在步骤 5 通过 `AddRedisExtensionService` 单独注册，且必须在 `AddThirdNetMvcWithPostgresql` 之前调用。

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

在 `appsettings.json` 中配置（配置节名称必须为 `RedisExtension`）：

```json
{
  "RedisExtension": {
    "Connection": "192.168.1.178:63790,password=swkj@123",
    "KeyPrefix": "myapp",
    "DefaultDatabase": 0
  }
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `Connection` | `string` | Redis 连接字符串（host:port,password=xxx） |
| `KeyPrefix` | `string` | 缓存键前缀，用于多应用隔离 |
| `DefaultDatabase` | `int` | 默认数据库编号 |

### 使用 Redis

注入 `ICacheReader` 和 `ICacheRefresh` 接口使用缓存功能，详见 **net-cache-use** 技能。

## 解决方案引用关系

每个服务的 `.slnx` 文件需要引用：
- 通用类库 Common + Cache
- API 服务层 + Database 数据层

## 模板文件

> 文档模板已迁移至 **backend-workflow** 技能的 references 目录。本技能保留项目结构模板。

- 服务规格模板：通过 `backend-workflow` 技能获取
- 变更日志模板：通过 `backend-workflow` 技能获取

## 输出要求

- 所有命令必须可直接复制执行
- 目录结构必须符合标准规范
- 不得添加未明确要求的额外功能
- 保持技术栈严格一致

## 相关技能

- **backend-workflow**: 文档驱动开发流程、文档模板和交付标准
- **net-authentication**: 认证系统配置
- **net-api-developer**: API 接口开发
- **net-efcore-developer**: 数据库实体开发
- **net-cache-use**: 缓存功能集成
- **net-background-job**: 后台任务开发
- **net-database-bulkcopy**: 批量数据操作
