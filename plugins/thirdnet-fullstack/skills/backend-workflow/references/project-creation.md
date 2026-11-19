# 项目创建完整步骤（project-creation）

> 本文件是 `backend-workflow` 技能的项目创建执行参考：创建 Admin 管理后台项目时用 Read 打开，按步骤执行。核心约束（模板取最新强制流程、占位符警示）以 SKILL.md 为准。

## 创建 Admin 管理后台项目

```bash
# 1. 配置 NuGet 源（一次性；地址唯一来源见 [internal-registry](internal-registry.md)，勿在正文写死）
dotnet nuget add source <NUGET_REGISTRY_URL> -n ThirdNet

# 2. 安装最新模板（强制流程：清 http-cache → 卸载 → --force 安装 → list 核对；
#    四步作用与"为何要清 http-cache"见 [template-install](template-install.md)）
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
    │   ├── {ProjectName}.Admin.APIService/    # API 宿主（Controllers、Services、DTOs；三层各自内部按 Manager/App/Cockpit/Third/Shared 分端，Cockpit 按需）
    │   └── {ProjectName}.Admin.Database/      # AdminDbContext + 实体 + EntityConfigurations
    └── Tools/
        ├── {ProjectName}.Common/              # 常量、枚举、DI 扩展、AdminControllerBase
        └── {ProjectName}.Cache/               # Redis 缓存域
```

## 创建 Service 微服务项目

参考 `net-microservice-generator` 技能获取完整指南。

```bash
# 前提：已有 Admin 项目
# 安装最新模板（强制流程与四步作用见 [template-install](template-install.md)）
dotnet nuget locals http-cache clear
dotnet new uninstall ThirdNet.Service.Template 2>/dev/null || true
dotnet new install ThirdNet.Service.Template --force
dotnet new list thirdnet-service
cd backend
# 完整创建命令（含 --AdminName 说明）见 net-microservice-generator
```
