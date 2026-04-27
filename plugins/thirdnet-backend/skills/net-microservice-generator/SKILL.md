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

## 强制规则

### 新建项目时必须生成的文档

当创建新的后端微服务项目时，**必须**生成以下文档，不可跳过：

| 文档 | 位置 | 操作 |
|------|------|------|
| plan.md | `backend/plan.md` | 编写项目全局规划（服务拆分、开发顺序、技术架构） |
| changelog.md | `backend/changelog.md` | 读取 `references/changelog-template.md`，按模板格式生成初始版本 |
| spec.md | `backend/<ServiceName>/spec.md` | 读取 `references/service-spec-template.md`，为每个服务按模板格式生成 |

**执行步骤**：
1. 先生成项目级 `plan.md`（全局开发计划）
2. 生成 `changelog.md`（初始化版本记录）
3. 为每个待开发的微服务逐一创建 `spec.md`（服务功能说明书）
4. 所有文档完成后，才能开始项目框架生成和编码
5. **文档不存在 → 停止编码 → 先生成文档**

### 编码前必须完成服务规格

每个微服务的编码前，**必须**在对应目录下创建服务规格文件：

**流程**：
1. 根据 plan.md 确定待开发的微服务列表
2. 读取 `references/service-spec-template.md` 模板
3. 为每个微服务创建 `backend/<ServiceName>/spec.md`，填写：业务目标、功能模块、API 接口、数据模型、架构设计
4. **批量服务实现时**：先为所有服务创建 spec.md，再逐个编码（不要边写 spec 边编码）
5. 所有服务 spec 完成后，才能开始项目框架生成
6. **spec 不存在 → 停止编码 → 先生成规格文档**

**注意**：plan.md 定义全局架构和开发顺序，changelog.md 记录版本演变，spec.md 定义每个服务的具体实现规格。三者缺一不可。

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

## 模板文件

创建新项目时，**必须**按以下模板生成文档（详见"强制规则"章节）：

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
