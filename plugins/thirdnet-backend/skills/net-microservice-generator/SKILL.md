---
name: net-microservice-generator
description: .NET 微服务解决方案生成器，负责创建标准化的项目结构和代码骨架。**主动用于**：创建新项目、初始化微服务架构、搭建项目框架、生成解决方案结构。当用户提到"创建项目"、"新建服务"、"项目结构"、"解决方案"、"初始化"时，必须使用此技能。
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
            └── Configurations/              # Fluent API 配置
```

**命名规范（均使用英文名）**：

| 层级           | 格式                              | 示例                           |
| -------------- | --------------------------------- | ------------------------------ |
| 项目文件夹     | `{ProjectName}`                   | `MyApp`                        |
| 服务文件夹     | `{ProjectName}.{ServiceName}`     | `MyApp.User`, `MyApp.Order`    |
| 解决方案文件   | `{ProjectName}.{ServiceName}.slnx`| `MyApp.User.slnx`              |
| API 项目       | `{ProjectName}.{ServiceName}.API` | `MyApp.User.API`               |
| Database 项目  | `{ProjectName}.{ServiceName}.Database` | `MyApp.User.Database`     |

## 解决方案引用关系

每个服务的 `.slnx` 文件需要引用：
- 通用类库 Common + Cache
- API 服务层 + Database 数据层

## 强禁止

**在项目生成阶段（MVP 框架），不要添加以下功能：**

- ❌ Minimal API
- ❌ 合并 Api 与 Database
- ❌ 省略 Database 项目
- ❌ 擅自扩展技术栈

## 输出要求

- 所有命令必须可直接复制执行
- 目录结构必须符合标准规范
- 不得添加未明确要求的额外功能
- 保持技术栈严格一致

## 后续开发指引

**项目框架生成完成后，在业务功能开发阶段：**

| 开发内容 | 使用技能 |
|---------|---------|
| API 创建 | `net-api-developer` |
| 数据库实体开发 | `net-efcore-developer` |
| 缓存功能集成 | `net-cache-use` |
| 后台任务开发 | `net-background-job` |
| 批量数据操作 | `net-database-bulkcopy` |

**注意**：虽然在项目生成阶段不添加缓存功能，但已预留 `{ProjectName}.Cache` 工具类库。在后续业务开发中，如需为特定实体添加缓存功能，应使用 `net-cache-use` 技能来实现。
