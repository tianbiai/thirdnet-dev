---
name: backend-workflow
description: >
  ThirdNet 后端开发入口与路由器：项目创建、功能开发全流程（entity → controller → DI 注册）、
  文档驱动开发（plan/changelog/spec → 编码 → 校验）、技能路由表。当用户提到"后端开发"、
  "创建 admin"、"thirdnet-admin"、"thirdnet-service"、"后端工作流"、"新模块"、
  "backend"、"开发流程"时，必须使用此技能。
license: MIT
metadata:
  version: "1.3.0"
  author: thirdnet
---

# ThirdNet 后端开发工作流

本技能是 ThirdNet 后端开发的入口和路由器，定义工作流步骤、项目创建、架构概览、文档驱动开发流程和技能路由。

> **技术栈版本锚点**：所有 ThirdNet 后端项目目标 **.NET 10（`net10.0`）**，数据访问用 **EF Core 10.x** + **Npgsql 10.x**（`Npgsql.EntityFrameworkCore.PostgreSQL` 10.x）。新建 `.csproj` 的 `TargetFramework` 一律写 `net10.0`，NuGet 包版本以模板的 `Directory.Build.props` 为准——不要自行降级或混用 8.x/9.x，否则会与框架库 `ThirdNet.Vibe.Common`/`ThirdNet.Vibe.WebAPI` 的依赖不兼容。

## 架构三层与能力目录

写任何后端代码前，先认清代码落在这三层中的哪一层，并**优先复用框架已有的能力**：

| 层 | 位置 | 说明 |
|----|------|------|
| **① 框架库** | NuGet 包 `ThirdNet.Vibe.Common` / `ThirdNet.Vibe.WebAPI` | 加密、分组查询、Redis 缓存/锁、批量、限流、multipart、CIDR、JWT、RBAC、操作日志、访问日志、分页等——**最优先复用**。 |
| **② 模板生成层** | 生成项目的 `Tools/{ProjectName}.Common` / `.Admin.Cache` / `Admin/{ProjectName}.Admin.APIService` | `AdminControllerBase`、`OperatorContext`、`SystemConfigKeys`、`[OperLog]`、`[SystemDict]`、各缓存域等。随 `dotnet new thirdnet-admin` 生成。 |
| **③ 业务代码** | 生成项目的 `Admin/{ProjectName}.Admin.APIService`（Controllers/Services/DTOs）与 `.Database`（Models/EntityConfigurations） | 你自己写的实体、Service、Controller。 |

**完整的可复用类清单（命名空间 + 文件 + 用途）见 [framework-and-template-catalog](references/framework-and-template-catalog.md)**。不确定「框架是否已提供某个能力」时，先查目录，不要重复造轮子。

> 命名校准：生成项目中类命名空间以 `{ProjectName}` 前缀（由模板 `sourceName` 替换而来）；描述文件位置时一律用生成路径 `Admin/{ProjectName}.Admin.APIService/...`、`Tools/{ProjectName}.Common/...`。

## 框架内置能力（开箱即用，无需自研）

下列能力已由框架提供，遇到对应需求**直接用**，不要自己实现：分页（`ToPageListAsync`）、限流（`AddThirdNetIpAndApplicationPathRateLimiting`，超限 429）、文件上传（`MultipartData`）、IP 黑/白名单（`BlackIpMiddleware` + CIDR）、访问日志（`RequestLoggerMiddleware`）、分布式锁（`RedisLock`）、模板升级（`thirdnet-migrate`，**非数据库迁移工具**）。各项命名空间、方法签名与配置详见 [能力目录](references/framework-and-template-catalog.md)。

### 框架过滤器（由 `AddThirdNetDefaultMvc` 自动注册）

框架自动注册三个过滤器，开发者无需手动处理：`ValidateModelAttribute`（`ModelState` 无效抛 `WebApiException(400)`，**Controller 无需手查 `ModelState.IsValid`**）、`CustomExceptionFilter`（`WebApiException`→结构化 JSON，其它异常→500）、`DefaultResultHeaderFilter`（自动加 `nosniff`/`deny` 安全头）。详见 [能力目录](references/framework-and-template-catalog.md)「过滤器」。

## 相关技能

当同时涉及前后端时，配合：`frontend-workflow`（前端开发入口）、`thirdnet-fullstack`（全栈协调：后端 DTO→前端 TS 类型映射、RBAC 桥接、开发顺序）、`admin-template-setup`（前端 Admin 项目创建）、`api-typescript-spec`（前端消费 API 的策略工厂规范）、`thirdnet-template-upgrade`（`thirdnet-migrate` 模板升级的单一事实来源）。

## 工作流步骤

所有后端任务按以下顺序执行：

1. **需求澄清**（AskUserQuestion）—— 明确服务范围、数据模型、接口需求、架构约束

   > **例外：Admin 模板项目创建**（`dotnet new thirdnet-admin`）跳过 3 轮澄清——模板功能固定，仅一次 AskUserQuestion 确认项目名称。详见下文「需求澄清 → Admin 模板项目创建」。

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
# 1. 配置 NuGet 源（一次性；地址与内外网切换见 references/internal-registry.md）
dotnet nuget add source http://192.168.1.156:8088/nuget -n ThirdNet

# 2. 安装最新模板（强制流程：清 http-cache → 卸载 → --force 安装 → list 核对；
#    四步作用与"为何要清 http-cache"见 references/template-install.md）
dotnet nuget locals http-cache clear
dotnet new uninstall ThirdNet.Admin.Template 2>/dev/null || true
dotnet new install ThirdNet.Admin.Template --force
dotnet new list thirdnet-admin

# 3. 创建项目（在 backend/ 目录内）
mkdir -p backend
cd backend
dotnet new thirdnet-admin -n {ProjectName} -o {ProjectName}.Admin

# 4. 进入解决方案根目录，创建 .slnx 并按解决方案文件夹归集项目
#    （cwd = backend/{ProjectName}.Admin/，步骤 4–7 所有相对路径以此为准）
cd {ProjectName}.Admin
dotnet new sln -n {ProjectName}.Admin
# Admin 层项目 → "Admin" 解决方案文件夹：
#   -s 用裸名字（不是 /src/Admin/）；--include-references:false 防止把 Common/Cache 递归拖进 Admin
dotnet sln {ProjectName}.Admin.slnx add \
  Admin/{ProjectName}.Admin.APIService/{ProjectName}.Admin.APIService.csproj \
  Admin/{ProjectName}.Admin.Database/{ProjectName}.Admin.Database.csproj \
  -s Admin --include-references:false
# Tools 层项目 → "Tools" 解决方案文件夹
dotnet sln {ProjectName}.Admin.slnx add \
  Tools/{ProjectName}.Common/{ProjectName}.Common.csproj \
  Tools/{ProjectName}.Cache/{ProjectName}.Cache.csproj \
  -s Tools --include-references:false

# 5. 配置数据库连接字符串
#    编辑 backend/{ProjectName}.Admin/Admin/{ProjectName}.Admin.APIService/appsettings.json
#    ConnectionString — Admin 业务数据库
#    DefaultConnectionString — 框架数据库（ThirdNetDbContext）

# 6. 执行 EF Core 迁移（首次，cwd 仍为 backend/{ProjectName}.Admin/）
dotnet ef database update \
  --project Admin/{ProjectName}.Admin.Database \
  --startup-project Admin/{ProjectName}.Admin.APIService

# 7. 运行
dotnet run --project Admin/{ProjectName}.Admin.APIService

# 8.（默认开启，可跳过）配置 Postgres MCP —— 让 Claude Code 能在本工程内直查 PostgreSQL
#    调用技能 thirdnet-fullstack:thirdnet-mcp-setup：读取第 5 步配好的 appsettings 连接串、
#    AskUserQuestion 让你确认暴露框架库(DefaultConnectionString) 还是业务库(ConnectionString)，
#    把选中的真实 DSN 写入 backend/{ProjectName}.Admin/.mcp.json，并把 .mcp.json 加入工程 .gitignore
#    （与 appsettings.Development.json 同约定，真实账密不入库）。不想用就跳过；后续随时用同技能补装。
```

生成结果（`dotnet new thirdnet-admin` 模板产物 = `{ProjectName}.Admin.slnx`、`Admin/`、`Tools/`；`plan.md`/`changelog.md`/`spec.md` **不是模板产物**，由后续「文档先行」阶段生成，Admin 模板创建例外流程暂不生成）：

```
backend/
└── {ProjectName}.Admin/                       # 解决方案根（dotnet new thirdnet-admin -o 产物）
    ├── {ProjectName}.Admin.slnx
    ├── plan.md                                # 非模板产物——backend-workflow「文档先行」生成（Admin 创建例外暂不生成）
    ├── changelog.md                           # 非模板产物——同上
    ├── spec.md                                # 非模板产物——项目级规格说明书（全局唯一），同上
    ├── .mcp.json                              # 第 8 步写入——默认含真实账密→已 .gitignore；DSN 由 thirdnet-mcp-setup 从 appsettings 读出、用户确认
    ├── Admin/
    │   ├── {ProjectName}.Admin.APIService/    # API 宿主（Controllers、Services、DTOs；三层各自内部按 Manager/App/Third/Shared 分端）
    │   └── {ProjectName}.Admin.Database/      # AdminDbContext + 实体 + EntityConfigurations
    └── Tools/
        ├── {ProjectName}.Common/              # 常量、枚举、DI 扩展、AdminControllerBase
        └── {ProjectName}.Cache/               # Redis 缓存域
```

### 创建 Service 微服务项目

参考 `net-microservice-generator` 技能获取完整指南。

```bash
# 前提：已有 Admin 项目
# 安装最新模板（强制流程与四步作用见 references/template-install.md）
dotnet nuget locals http-cache clear
dotnet new uninstall ThirdNet.Service.Template 2>/dev/null || true
dotnet new install ThirdNet.Service.Template --force
dotnet new list thirdnet-service
cd backend
# 完整创建命令（含 --AdminName 说明）见 net-microservice-generator
```

## 双数据库架构

Admin 使用框架数据库（`ThirdNetDbContext`，public schema）+ 业务数据库（`AdminDbContext`，admin schema）双库；Service 用 `ServiceDbContext` 替代 `AdminDbContext` 并自定义 schema。完整对照见 net-efcore-developer「双数据库上下文区别」。

## Program.cs 与 Startup.cs DI 管道

Admin 项目的 Program.cs 和 Startup.cs 遵循固定的启动模式和 10 步 DI 注册顺序（不可调换）。新增模块时只需在第 9 步添加 `services.AddScoped<YourService>();`。

完整的代码模板和每一步的详细说明见 [di-pipeline-and-startup](references/di-pipeline-and-startup.md)。

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
   └── 按端类型放在 DTOs/{Manager,App,Third}/<模块>/：QueryManagerMap、CreateManagerMap、UpdateManagerMap、ItemManagerMap、DetailManagerMap（跨端共用放 DTOs/Shared/，类名无端段）

5. Service 层 — net-api-developer
   └── 按端类型放在 Services/{Manager,App,Third}/：NoticeManagerService（Scoped，注入 IDbContextFactory + Cache + OperatorContext）；跨端共用逻辑抽到 Services/Shared/ 由各端注入

6. Controller 层 — net-api-developer
   └── 按端类型放在 Controllers/{Manager,App,Third}/：NoticeManagerController : AdminControllerBase（路由 api/manager/notice）

7. 权限层 — net-auth
   └── 定义权限字符串（如 sys:notice:list/add/edit/remove）

8. DI 注册
   └── Startup.cs 第 9 步添加 services.AddScoped<NoticeService>();
```

## 技能路由表

根据任务类型，通过 Skill 工具调用所有适用的技能：

| 任务类型 | 必须调用的技能 |
|---------|-------------|
| 创建 Admin/Service 项目 | `backend-workflow` + `net-microservice-generator` |
| 配置 Postgres MCP（让 Claude 直查数据库）/ Admin 创建时默认装配 | `thirdnet-mcp-setup` |
| 创建或修改数据库实体、DbContext、迁移、批量操作 | `net-efcore-developer` |
| 创建或修改 Redis 缓存域 | `net-cache-use` |
| 创建或修改 Controller、Service、DTO | `net-api-developer` |
| 认证（IAccountValidator/Token/JWT）与授权（权限/角色/菜单 RBAC） | `net-auth` |
| 后台任务（BackgroundRunner） | `net-background-job` |
| 新增下拉选项枚举、[SystemDict] 字典 | `net-enum-dict` |
| 功能开发完成后 / 交付前全栈审查（编码后） | `fullstack-review`（Stop Hook 强制） |

### 编码前检查清单

- [ ] 涉及实体/数据库/批量操作 → 已调用 `net-efcore-developer`
- [ ] 涉及缓存 → 已调用 `net-cache-use`
- [ ] 涉及 Controller/Service/DTO → 已调用 `net-api-developer`
- [ ] 涉及认证/Token/权限/角色 → 已调用 `net-auth`
- [ ] 涉及后台任务 → 已调用 `net-background-job`
- [ ] 涉及新项目 → 已调用 `net-microservice-generator`（如适用）
- [ ] 涉及新增枚举字典 → 已调用 `net-enum-dict`（如适用）
- [ ] 所有适用项勾选后，方可开始编码

## 需求澄清

### Admin 模板项目创建 —— 直接跳过

如果当前任务为**创建 Admin 管理后台项目**（用户明确提出"创建 admin"、"新建管理后台"、"thirdnet-admin"等），**直接跳过本节后续的 3 轮澄清流程**。原因：Admin 模板已内置完整的系统管理和 API 管理模块，功能范围固定不变，无需确认。

**替代操作**：使用一次 `AskUserQuestion` 仅确认项目名称（`{ProjectName}`，用于 `dotnet new thirdnet-admin -n {ProjectName} -o {ProjectName}.Admin`）。NuGet 源地址见 [internal-registry](references/internal-registry.md)（默认内网，不可达改外网）。

> ⚠️ 模板生成的 `appsettings.json` 仅含占位符（`DefaultConnectionString`/`ConnectionString` 是中文描述串、`RedisExtension.Connection` 为 `"Redis连接地址（host:port,password=xxx）"`、`JwtOptions` 的 `public_key`/`private_key` 为 `"JWT公钥（SM2）"`/`"JWT私钥（SM2）"`、`AdminSecret` 为空串），无可运行默认值。创建阶段不确认这些值，但执行步骤 6（`dotnet ef database update`）/ 步骤 7（`dotnet run`）前，需由用户在 `backend/Admin/{ProjectName}.Admin.APIService/appsettings.json` 中填入真实的 PostgreSQL / Redis / SM2 配置；若本次只想生成代码、暂不运行，可保留占位符并跳过步骤 6/7。

确认后直接跳转至「开发阶段」的阶段 2（项目框架：使用模板创建标准化项目结构）。

**此例外不适用于以下场景**（这些场景仍须执行完整澄清流程）：
- 在已有 Admin 项目上新增业务模块
- 创建 Service 微服务项目（使用 `dotnet new thirdnet-service`）
- 修改或扩展现有项目的功能

### 新功能/新模块需求 —— 必须澄清

当用户提出新功能或服务需求时（非 Admin 模板项目创建），**禁止直接进入编码**，必须先明确需求。

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
| 2 | 项目框架：使用模板创建标准化项目结构。**Admin 模板项目创建时，可直接从本阶段开始执行**（例外说明见「需求澄清」章节） |
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
- [ ] 端特定类（Controller/Service/DTO）按端类型分目录（Manager/App/Third）+ 类名带端后缀，跨端共用类放 Shared/（详见 net-api-developer「端类型分层组织」）
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

> **交付前最后一步（全栈审查）**：完成上述自检后，调用 `thirdnet-fullstack:fullstack-review` 对本次变更做一次全栈代码审查——覆盖后端规范、前端规范、跨端契约一致性、业务正确性、性能、安全、文档，产出 `review-report.md`（问题清单 + 严重级别 + 修改方案）。本插件 Stop Hook 会在存在未审查或仍有 Critical/Major 的功能性变更时强制阻断完成。

## 代码规范速查

本表是索引——每条规则的完整定义见对应技能，不要据此推断细节。

| 规范 | 要求要点 → 见 |
|------|--------------|
| HTTP 方法 | 仅 GET/POST（禁止 PUT/DELETE/PATCH） → 见 net-api-developer |
| 路由格式 | `api/manager/{entity}/{action}` → 见 net-api-developer |
| 命名风格 | 全链路 snake_case（C# 属性、JSON、DB 列名） → 见 net-api-developer / net-efcore-developer |
| 表名 | `t_` 前缀 + snake_case → 见 net-efcore-developer |
| 主键 | `long id`（bigint 自增） → 见 net-efcore-developer |
| 错误处理 | `throw new WebApiException(HttpStatusCode.xxx, "msg")` → 见 net-api-developer |
| DTO 命名 | `{Entity}{Action}{Endpoint}Map`（端特定，带 Manager/App/Third 段）；跨端共用 `{Entity}{Action}Map` 放 Shared/ → 见 net-api-developer |
| 端类型分层 | Controller/Service/DTO 统一按 Manager/App/Third 分目录 + 类名带端后缀，共用放 Shared/（**默认三端、可按项目扩展**如 Cockpit/OpenAPI/Iot）；前端 `api-typescript-spec` 已对齐同一套四桶 → 见 net-api-developer「端类型分层组织」「前后端四桶对照」 |
| Controller 基类 | `AdminControllerBase`（非 ControllerBase） → 见 net-api-developer |
| Service 生命周期 | Scoped → 见 net-api-developer |
| Cache 生命周期 | Singleton → 见 net-cache-use |
| DB 上下文获取 | `IDbContextFactory<T>`（非直接注入 DbContext） → 见 net-efcore-developer |
| Fluent API / 数据注解 | 仅 Fluent API，禁止数据注解（`[DbBulk]` 例外） → 见 net-efcore-developer |
| 权限注解 | `[PermissionAuthorize("module:entity:action")]`、`[ProviderAuthorize]` → 见 net-auth |
| 操作日志 | `[OperLog(Title = "...", BusinessType = BusinessTypeEnum.xxx)]` → 见 net-api-developer |
| 认证/授权 | Basic + Bearer(JWT) + ApiKey；`[PermissionAuthorize]`/`[Authorize(Policy=...)]` → 见 net-auth |
| 后台任务 | `BackgroundRunner`（设 SleepTime/Check，实现 WorkAsync） → 见 net-background-job |
| 批量操作 | `IDbAsyncBulk`（CopyToServer/MergeToServer） → 见 net-efcore-developer |
| 枚举/字典 | `[SystemDict]` + `[EnumMeta]`；自定义字典用 `DictCache` → 见 net-enum-dict |
