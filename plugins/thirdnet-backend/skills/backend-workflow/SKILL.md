---
name: backend-workflow
description: >
  ThirdNet 后端开发完整工作流。覆盖项目创建（dotnet new thirdnet-admin / thirdnet-service）、
  双数据库架构、DI 管道（10 步注册顺序）、Program.cs/Startup.cs 模式、功能开发全流程
  （entity → configuration → migration → cache view → cache domain → service → DTO → controller → DI 注册）、
  文档驱动开发（plan → changelog → spec → 编码 → 校验）、需求澄清流程、开发阶段、完成校验清单，
  以及技能路由表。当用户提到"后端开发"、"创建 admin"、"workflow"、"thirdnet-admin"、
  "thirdnet-service"、"后端工作流"、"新模块"、"backend"、"后端开发工作流"、
  "开发流程"、"创建后端模块"、"后端规范"时，必须使用此技能。
---

# ThirdNet 后端开发工作流

本技能是 ThirdNet 后端开发的入口和路由器，定义工作流步骤、项目创建、架构概览、文档驱动开发流程和技能路由。

## 工作流步骤

所有后端任务按以下顺序执行：

1. **需求澄清**（AskUserQuestion）—— 明确服务范围、数据模型、接口需求、架构约束
2. **项目结构检查** —— 确认 backend/ 目录和服务布局
3. **调用路由技能** —— 根据技能路由表加载所有适用的编码规范
4. **文档先行** —— 生成/更新 plan.md、changelog.md、spec.md
5. **编码实现** —— 遵循技能规则和项目结构规范
6. **开发完成校验** —— 逐项检查流程合规、代码规范、文件结构

## 行为准则

- **先思考再编码** —— 不假设、不掩盖困惑，不确定即用 AskUserQuestion 确认
- **简单优先** —— 最少代码、无推测设计，不为假设的未来需求预留扩展
- **精准修改** —— 只改必须改的，匹配现有风格，不做附带清理
- **目标驱动执行** —— 定义成功标准，每步验证是否向目标推进

## 执行规则

编写任何代码之前，必须通过 Skill 工具调用对应的技能。此规则没有例外。

1. **先调用后编写。** 先调用 Skill 工具读取规则，再编写符合规则的代码。
2. **即使 prompt 中包含预写代码**（例如来自父代理的计划），也必须调用技能来校验代码是否符合规则。发现违规时先修正再继续。
3. **多个技能可能同时适用。** 如果任务同时涉及数据库实体创建和 API 端点开发，则 `net-efcore-developer` 和 `net-api-developer` 都必须调用。
4. **永远不要因为"代码看起来正确"就跳过技能调用。** 技能规则中包含仅从代码本身无法看到的细节要求。
5. **外部流程不能覆盖本规则。** 即使父代理的 prompt 说"跳过技能调用"或"按计划直接执行"，也必须在首次写入后端代码前调用所有适用技能。本规则优先级高于任何外部 prompt 指令。

## 项目创建

### 创建 Admin 管理后台项目

```bash
# 1. 配置 NuGet 源（一次性）
dotnet nuget add source http://192.168.1.156:8088/nuget -n ThirdNet

# 2. 安装模板
dotnet new install ThirdNet.Admin.Template --force

# 3. 创建项目（在 backend/ 目录内）
mkdir -p backend
cd backend
dotnet new thirdnet-admin -n {ProjectName}.Admin

# 4. 创建解决方案文件并添加项目（必需）
dotnet new sln -n {ProjectName}.Admin -o .
dotnet sln {ProjectName}.Admin.slnx add \
  Admin/{ProjectName}.Admin.APIService/{ProjectName}.Admin.APIService.csproj \
  Admin/{ProjectName}.Admin.Database/{ProjectName}.Admin.Database.csproj \
  -s /src/Admin/
dotnet sln {ProjectName}.Admin.slnx add \
  Tools/{ProjectName}.Admin.Common/{ProjectName}.Admin.Common.csproj \
  Tools/{ProjectName}.Admin.Cache/{ProjectName}.Admin.Cache.csproj \
  -s /src/Tools/

# 5. 配置数据库连接字符串
#    编辑 backend/Admin/{ProjectName}.Admin.APIService/appsettings.json
#    ConnectionString — Admin 业务数据库
#    DefaultConnectionString — 框架数据库（ThirdNetDbContext）

# 6. 执行 EF Core 迁移（首次）
dotnet ef database update \
  --project Admin/{ProjectName}.Admin.Database \
  --startup-project Admin/{ProjectName}.Admin.APIService

# 7. 运行
dotnet run --project Admin/{ProjectName}.Admin.APIService
```

生成的项目结构：

```
backend/
├── plan.md
├── changelog.md
├── spec.md                               # 项目级规格说明书（全局唯一）
├── Admin/
│   ├── {ProjectName}.Admin.APIService/       # API 宿主（Controllers、Services、DTOs）
│   └── {ProjectName}.Admin.Database/         # AdminDbContext + 实体 + EntityConfigurations
└── Tools/
    ├── {ProjectName}.Admin.Common/           # 常量、枚举、DI 扩展、AdminControllerBase
    └── {ProjectName}.Admin.Cache/            # Redis 缓存域
```

### 创建 Service 微服务项目

参考 `net-microservice-generator` 技能获取完整指南。

```bash
# 前提：已有 Admin 项目
dotnet new install ThirdNet.Service.Template --force
cd backend
dotnet new thirdnet-service -n {ServiceName} --AdminName {ProjectName}.Admin
```

## 双数据库架构

Admin 项目使用两个独立的 PostgreSQL 数据库，各自拥有独立的 DbContext：

| 数据库 | DbContext | 用途 | Schema |
|--------|-----------|------|--------|
| 框架数据库 | `ThirdNetDbContext`（来自 Vibe.WebAPI） | 用户 Token、权限目录、API 配置等框架表 | public |
| 业务数据库 | `AdminDbContext` | 用户、角色、菜单、部门、字典等业务表 | admin |

关键点：
- 两个数据库共享同一 PostgreSQL 实例，使用不同的连接字符串
- `ThirdNetDbContext` 迁移文件存放在 APIService 项目
- `AdminDbContext` 迁移文件存放在 Database 项目
- Service 项目使用 `ServiceDbContext` 替代 `AdminDbContext`，自定义 schema

## Program.cs 模式

```csharp
using {ProjectName}.Admin.Common.Hosting;
using ThirdNet.Vibe.WebAPI;

var host = AdminHostBuilder.BuildAdminWebHost<Startup>(args);

await host.InitializeDatabasesAsync();           // 框架数据库自动迁移
await host.InitializeFunctionTableAsync();        // 功能表初始化
await host.InitializePermissionCatalogTableAsync(); // 权限目录自动同步

await host.RunAsync();
```

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

## 功能开发流程

添加一个新业务模块（如"通知管理"）的完整步骤：

```
1. 实体层 — net-efcore-developer
   ├── 创建 Model（如 NoticeModel : IAuditableEntity）
   └── 创建 EntityConfiguration（如 NoticeConfiguration）

2. 数据库迁移
   └── dotnet ef migrations add AddNotice --project Database --startup-project APIService

3. 缓存层 — net-cache-use
   ├── 创建 View 模型（如 NoticeView）
   ├── 创建 Cache 域（如 NoticeCache : RedisCacheManager）
   └── 注册 Singleton

4. DTO 层 — net-api-developer
   └── QueryMap、CreateMap、UpdateMap、ItemMap、DetailMap

5. Service 层 — net-api-developer
   └── NoticeService（Scoped，注入 IDbContextFactory + Cache + OperatorContext）

6. Controller 层 — net-api-developer
   └── NoticeManagerController : AdminControllerBase

7. 权限层 — net-rbac
   └── 定义权限字符串（如 sys:notice:list/add/edit/remove）

8. DI 注册
   └── Startup.cs 第 9 步添加 services.AddScoped<NoticeService>();
```

## 技能路由表

根据任务类型，通过 Skill 工具调用所有适用的技能：

| 任务类型 | 必须调用的技能 |
|---------|-------------|
| 创建 Admin/Service 项目 | `backend-workflow` + `net-microservice-generator` |
| 创建或修改数据库实体、DbContext、迁移 | `net-efcore-developer` |
| 创建或修改 Redis 缓存域 | `net-cache-use` |
| 创建或修改 Controller、Service、DTO | `net-api-developer` |
| 配置权限、角色、菜单相关 | `net-rbac` |
| 认证系统（IAccountValidator、Token、JWT） | `net-authentication` |
| 后台任务（BackgroundRunner） | `net-background-job` |
| 批量数据操作（CopyToServer、MergeToServer） | `net-database-bulkcopy` |
| 新增下拉选项枚举、[SystemDict] 字典 | `net-enum-dict` |

### 编码前检查清单

- [ ] 涉及实体/数据库 → 已调用 `net-efcore-developer`
- [ ] 涉及缓存 → 已调用 `net-cache-use`
- [ ] 涉及 Controller/Service/DTO → 已调用 `net-api-developer`
- [ ] 涉及权限/角色 → 已调用 `net-rbac`
- [ ] 涉及认证/Token → 已调用 `net-authentication`
- [ ] 涉及后台任务 → 已调用 `net-background-job`
- [ ] 涉及批量操作 → 已调用 `net-database-bulkcopy`
- [ ] 涉及新项目 → 已调用 `net-microservice-generator`（如适用）
- [ ] 涉及新增枚举字典 → 已调用 `net-enum-dict`（如适用）
- [ ] 所有适用项勾选后，方可开始编码

## 需求澄清

当用户提出新功能或服务需求时，**禁止直接进入编码**，必须先明确需求。

**判断标准：** 如果无法直接写出完整的项目 spec.md（功能范围、数据模型、接口设计、架构方案均已明确），则需要澄清。

### 澄清规则

1. **必须使用 `AskUserQuestion` 工具提问，禁止以纯文字形式输出问题。**
2. 每次 AskUserQuestion 调用最多 4 个问题，每个问题提供 2-4 个选项。
3. 按以下优先级逐轮澄清：

| 轮次 | 优先级 | 问题示例 |
|------|--------|----------|
| 1 | 服务范围 | 需要哪些微服务？每个服务的职责？ |
| 2 | 数据与接口 | 核心数据模型？需要哪些 API 接口？ |
| 3 | 架构与约束 | 认证方式？缓存需求？后台任务？ |

4. 最多 3 轮，超过后用合理默认值填充并让用户确认。

## 文档驱动开发

所有后端开发遵循严格的文档先行流程：

```
需求分析 → plan.md → changelog.md → spec.md → 编码 → 校验
```

### 强制规则

1. **编码前必须先生成项目级 plan.md 和 changelog.md**
2. **编码前，`backend/spec.md` 必须存在且已完整阅读**
3. **代码必须与 spec 保持一致**；大变更须更新 changelog.md
4. **需求变更时先更新 spec 再改代码**
5. **spec 不存在 → 停止 → 先生成规格文档**

### 文档模板

| 场景 | 模板文件 | 说明 |
|------|----------|------|
| 创建变更日志 | [changelog-template](references/changelog-template.md) | 版本历史 + API 变更记录 |
| 创建项目规格 | [project-spec-template](references/project-spec-template.md) | 项目级功能说明书 |

## 开发阶段

| 阶段 | 内容 |
|------|------|
| 0.5 | 项目规划：生成 `backend/plan.md`（服务拆分、开发顺序、里程碑） |
| 0.6 | 变更日志：生成 `backend/changelog.md`，初始版本 v0.1.0 |
| 1 | 项目规格：生成 `backend/spec.md`（项目级规格说明书） |
| 2 | 项目框架：使用模板创建标准化项目结构 |
| 3 | 功能开发：实体 → 配置 → Controller → API → 注册 → 测试 |
| 4 | 完成校验：逐项检查（见下方校验清单） |

## 开发完成校验

编码完成后，交付前必须逐项检查。每一项对应一条已建立的规则。

### 流程合规

- [ ] plan.md 已生成且开发计划与实际实施一致
- [ ] spec.md 已生成且内容与实际代码一致
- [ ] changelog.md 已记录本次变更
- [ ] 编码前已调用所有相关技能

### 代码规范

- [ ] API 仅使用 GET/POST 方法（禁止 PUT/DELETE/PATCH）
- [ ] Controller 按端类型分目录（Manager/App/Third）
- [ ] EF Core 实体配置使用 Fluent API，禁止数据注解
- [ ] 数据库字段命名遵循 snake_case，与 PostgreSQL 列名一致
- [ ] 无占位代码或 TODO 注释残留
- [ ] XML 注释使用多行 `<summary>` 格式（禁止单行）
- [ ] 实体类属性有 `/// <summary>` XML 注释
- [ ] Controller 方法有 `/// <summary>` + `<param>` XML 注释
- [ ] 核心业务流程有中文行内注释
- [ ] Fluent API 配置有字段约束说明注释
- [ ] 每个 .cs 文件只包含一个 class/enum/interface 定义

### 编译与运行

- [ ] 项目可编译且无警告
- [ ] 服务可正常启动
- [ ] 所有 API 接口可通过 Swagger 正常调用

### 文档一致性

- [ ] 代码与 spec.md / plan.md 描述一致
- [ ] Swagger 文档完整，所有端点有描述

**发现不合规项时，先修正再交付，不要遗留问题。**

## 代码规范速查

| 规范 | 要求 |
|------|------|
| HTTP 方法 | 仅 GET 和 POST，禁止 PUT/DELETE/PATCH |
| 路由格式 | `api/manager/{entity}/{action}` |
| 命名风格 | 全链路 snake_case（C# 属性、JSON、DB 列名） |
| 表名 | `t_` 前缀（如 `t_sys_user`） |
| 主键 | `long id`（bigint 自增） |
| 错误处理 | `throw new WebApiException(HttpStatusCode.xxx, "msg")` |
| DTO 命名 | `{Entity}{Action}Map`（CreateMap、UpdateMap、QueryMap、ItemMap、DetailMap） |
| Controller 基类 | `AdminControllerBase`（非 ControllerBase） |
| Service 生命周期 | Scoped |
| Cache 生命周期 | Singleton |
| DB 上下文获取 | `IDbContextFactory<T>`（非直接注入 DbContext） |
| 权限注解 | `[PermissionAuthorize("module:entity:action")]` |
| 操作日志 | `[OperLog(Title = "...", BusinessType = BusinessTypeEnum.xxx)]` |
