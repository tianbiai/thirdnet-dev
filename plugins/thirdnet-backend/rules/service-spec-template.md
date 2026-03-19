# [服务名称]

> ⚠️ **强制要求**：在编写本服务 spec.md 之前，必须先完整阅读 `skills/` 目录下的相关技能文档，并严格遵循其中的最佳实践和指导原则。

## 📋 业务与功能

### 1.1 服务概述

> 简要说明该服务的核心定位、解决的问题、业务价值

**服务名称**：[ServiceName]

**服务职责**：

- [职责1]
- [职责2]
- [职责3]

**依赖服务**：

- IdentityService - 认证授权服务
- [其他依赖服务]

### 1.2 核心目标

> 该服务的核心业务目标

[在此描述核心目标...]

### 1.3 功能模块清单

> 列出该服务包含的所有功能模块及其优先级

- **P0 [模块1]**：[功能描述]
- **P0 [模块2]**：[功能描述]
- **P1 [模块3]**：[功能描述]
- **P2 [模块4]**：[功能描述]

### 1.4 业务流程要点

> 关键的业务流程、事务边界、数据一致性要求

- [流程1]：[步骤1] → [步骤2] → [步骤3]
- [流程2]：[步骤1] → [步骤2] → [步骤3]

### 1.5 Controller 功能描述

> ⚠️ **重要**：本节列出该服务的所有 Controller 及其功能描述。每次新增、修改或删除 Controller 时都必须更新本节内容。

**API 接口清单**：

| 方法 | 路由                             | 功能                         | 优先级 | 认证 |
| ---- | -------------------------------- | ---------------------------- | ------ | ---- |
| POST | `/api/[module]/[resource]/create` | 创建资源 | P0     | ✅   |
| POST | `/api/[module]/[resource]/update` | 更新资源 | P0     | ✅   |
| POST | `/api/[module]/[resource]/delete` | 删除资源 | P0     | ✅   |
| GET  | `/api/[module]/[resource]`     | 获取资源（查询、列表）      | P0     | ✅   |

> ⚠️ **API 接口规范（强制）**：
> - **路径不含版本号**：禁止在 API 路径中包含版本号（如 `v1`、`v2`），例如 ❌ `api/v1/manager/user` ✅ `api/manager/user`
> - **仅允许使用 GET 和 POST 方法**：禁止使用 DELETE、PUT、PATCH 等其他 HTTP 方法
> - **响应格式**：API 默认直接返回实体 JSON，不包装状态码；状态码通过 HTTP 状态码返回
> - **原因**：项目网关会将 DELETE、PUT 等方法作为危险操作进行屏蔽
> - 所有增删改操作统一使用 POST 方法，并在路由中明确操作类型

---

## 📊 数据模型设计

### 2.1 数据库表清单

> 列出该服务涉及的所有数据库表

| 表名         | 说明   | 主键类型 | 备注   |
| ------------ | ------ | -------- | ------ |
| `t_table1` | [说明] | `long` | [备注] |
| `t_table2` | [说明] | `long` | [备注] |
| `t_table3` | [说明] | `long` | [备注] |

### 2.2 数据访问策略

> 数据访问模式和策略

- **ORM**：Entity Framework Core (Code First)
- **数据库**：~~Post~~greSQL
- **连接管理**：连接池配置

### 2.3 数据库字段配置规范

> ⚠️ **必须遵循**：本项目严格遵循 Fluent API 配置规范，所有数据库配置通过 `IEntityTypeConfiguration<TEntity>` 接口实现。
>
> **详细规范**：请参考 `skills/net-efcore-developer/SKILL.md` 的"EF Core Code First 数据库规则"章节。

**核心原则概要**：

1. **禁止使用数据注解**：实体模型类严禁使用任何数据注解标签（Data Annotations）
2. **命名规范**：
   - **实体类**：类名以 `Model` 结尾（如 `UserInfoModel`）
   - **数据库字段**：实体类属性统一使用小写字母（如 `id`、`user_name`、`create_time`）
   - **数据库表名**：表名添加 `t_` 前缀，使用小写下划线命名（如 `t_user_info`）
3. **主键限制**：主键 `id` 字段必须使用 `long` 类型，禁止使用 `int`
4. **字符串长度配置**：字符串类型默认不需要配置 MaxLength
5. **实体关系**：不创建外键关系，直接通过对应 id 字段关联

---

## 🏗️ 架构与设计

> ⚠️ **必须遵循**：本部分设计必须严格基于 `dotnet-architect/SKILL.md` 中的架构设计原则和最佳实践。

### 3.1 项目结构

> 该服务的标准项目结构

```
{ProjectName}.{ServiceName}.slnx
├── {ProjectName}.{ServiceName}.API/       # 表示层
│   ├── Controllers/              # 所有 Controller 的根目录
│   │   ├── Manager/              # 管理端 Controllers
│   │   │   ├── XxxController.cs
│   │   │   └── YyyController.cs
│   │   ├── App/                  # 应用端 Controllers
│   │   │   └── ZzzController.cs
│   │   ├── Third/                # 第三方端 Controllers
│   │   │   └── AaaController.cs
│   ├── Program.cs
│   └── appsettings.json
└── {ProjectName}.{ServiceName}.Database/  # 数据层
    ├── Models/                   # 实体模型
    ├── Configurations/           # Fluent API 配置
    └── {ServiceName}DbContext.cs
```

**Controllers 目录组织说明**：

- `Controllers/` 是所有 Controller 的根目录
- **默认分类方式**：按调用端标识区分，无特殊说明时必须遵循以下分类

  - **Manager**：管理端 Controllers（后台管理、运营管理等场景）
  - **App**：应用端 Controllers（移动应用、Web 应用等用户端场景）
  - **Third**：第三方端 Controllers（开放 API、合作伙伴集成等场景）
- 所有分类文件夹都是 `controllers/` 的子目录

### 3.2 分层架构

> ⚠️ **必须遵循 ASP.NET Core 核心原则**：
>
> - **关注点分离**：不同职责分离到不同层
> - **依赖倒置**：高层模块不依赖低层模块，都依赖抽象
> - **单一职责**：每个类只有一个改变的理由
> - **开闭原则**：对扩展开放，对修改关闭

**标准分层**：

- **Api 层**：Controller、路由、认证授权
- **Database 层**：实体模型、Fluent API 配置、DbContext

### 3.3 依赖注入配置

> 服务生命周期和注册策略

- **Transient**：[轻量级无状态服务]
- **Scoped**：[DbContext、UnitOfWork、业务服务]
- **Singleton**：[配置、缓存、HTTP 客户端]

---

## 🔐 安全与认证

### 4.1 认证机制

> 认证方式和实现策略

- **认证方式**：[Bearer Token / Basic Auth / 两者都支持 / 无需认证]
- **Token 来源**：[HTTP Header]
- **认证服务**：[IdentityService]

### 4.2 授权策略

> 使用ThirdNet框架自定义授权。

### 4.3 数据验证

> 输入验证和业务规则验证。不使用[Data Annotations / FluentValidation]，通过自定义代码验证。

### 4.4 安全防护

> 常见安全威胁防护措施

- [ ] **SQL 注入防护**：[使用 ORM 参数化查询]
- [ ] **XSS 防护**：[输入过滤 / 输出编码]
- [ ] **HTTPS 强制**：[生产环境强制 HTTPS]
- [ ] **速率限制**：[防止暴力攻击]
- [ ] **敏感数据加密**：[加密算法 / 密钥管理]

---

## 🚀 性能与优化

### 5.1 缓存策略

> 按需创建缓存，参考缓存技能 `net-cache-use`

### 5.2 异步处理

> 异步编程模式和最佳实践

- **异步原则**：All the way down
- **取消令牌**：支持操作取消
- **超时控制**：[超时策略]

### 5.3 数据库优化

> 查询优化和索引策略

- **查询优化**：
  - [ ] 避免 N+1 查询
  - [ ] 使用投影（Select）
  - [ ] 分页查询
  - [ ] 延迟加载 vs 预加载
- **索引策略**：
  - `[索引1]`：[字段] - [原因]
  - `[索引2]`：[字段] - [原因]

### 5.4 批量操作

> 大数据量操作策略（如需要）

- [ ] 使用 `net-database-bulkcopy` 进行批量导入
- [ ] 批量更新策略
- [ ] 数据同步方案

---

## ⏰ 后台任务

### 6.1 后台任务清单

> 列出该服务的所有后台任务（如需要）

- **[Task1]**：[任务描述] - [执行频率]
- **[Task2]**：[任务描述] - [执行频率]

### 6.2 任务配置

> 后台任务的配置和实现要求

- **框架**：BackgroundRunner
- **注册方式**：`builder.Services.AddHostedService<[TaskName]>()`
- **异常处理**：内置异常捕获和日志
- **停止策略**：优雅停止

---

## 🧪 测试策略

必须测试的业务场景

- [ ] [场景1]：[测试描述]
- [ ] [场景2]：[测试描述]
- [ ] [场景3]：[测试描述]

---

## 🚢 部署与运维

### 8.1 环境配置

> 环境变量和配置管理

- **配置源**：appsettings.json

### 8.2 日志与监控

> 日志记录和监控策略

- **日志框架**：内置 ILogger
- **日志级别**：
  - **Information**：一般信息
  - **Warning**：警告信息
  - **Error**：错误信息
  - **Critical**：严重错误
