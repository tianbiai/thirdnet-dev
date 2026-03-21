# [服务名称]

> 服务级规格说明。编写前必须阅读 `skills/` 目录下的相关技能文档。

---

## 业务与功能

### 服务概述

**服务名称**：[ServiceName]

**服务职责**：
- [职责1]
- [职责2]

**依赖服务**：
- IdentityService - 认证授权服务
- [其他依赖服务]

### 功能模块

| 优先级 | 模块 | 描述 |
|--------|------|------|
| P0 | [模块1] | [描述] |
| P0 | [模块2] | [描述] |
| P1 | [模块3] | [描述] |

### 业务流程

| 流程 | 步骤 |
|------|------|
| [流程1] | [步骤1] → [步骤2] → [步骤3] |
| [流程2] | [步骤1] → [步骤2] |

### API 接口清单

> ⚠️ **强制规范**：
> - 路径不含版本号（❌ `api/v1/user` ✅ `api/user`）
> - 仅允许 GET 和 POST 方法
> - 响应格式：直接返回实体 JSON，状态码通过 HTTP 状态码返回

| 方法 | 路由 | 功能 | 优先级 | 认证 |
|------|------|------|--------|------|
| POST | `/api/[module]/[resource]/create` | 创建资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/update` | 更新资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/delete` | 删除资源 | P0 | ✅ |
| GET | `/api/[module]/[resource]` | 获取资源 | P0 | ✅ |

---

## 数据模型

### 数据库表

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| `t_table1` | [说明] | `long` |
| `t_table2` | [说明] | `long` |

### 字段配置规范

> 必须遵循 `net-efcore-developer` 技能的 Fluent API 配置规范。

**核心原则**：
1. **禁止数据注解**：实体模型严禁使用 Data Annotations
2. **命名规范**：
   - 实体类：以 `Model` 结尾（如 `UserInfoModel`）
   - 字段：小写下划线（如 `user_name`、`create_time`）
   - 表名：`t_` 前缀（如 `t_user_info`）
3. **主键限制**：`id` 必须使用 `long` 类型
4. **实体关系**：不创建外键关系，通过 id 字段关联

---

## 架构设计

### 项目结构

```
{ProjectName}.{ServiceName}.slnx
├── {ProjectName}.{ServiceName}.API/       # 表示层
│   ├── Controllers/
│   │   ├── Manager/           # 管理端 Controllers
│   │   ├── App/               # 应用端 Controllers
│   │   └── Third/             # 第三方端 Controllers
│   ├── Program.cs
│   └── appsettings.json
└── {ProjectName}.{ServiceName}.Database/  # 数据层
    ├── Models/                # 实体模型
    ├── Configurations/        # Fluent API 配置
    └── {ServiceName}DbContext.cs
```

### 分层架构

- **Api 层**：Controller、路由、认证授权
- **Database 层**：实体模型、Fluent API 配置、DbContext

### 依赖注入

| 生命周期 | 适用场景 |
|----------|----------|
| Transient | 轻量级无状态服务 |
| Scoped | DbContext、业务服务 |
| Singleton | 配置、缓存、HTTP 客户端 |

---

## 安全与认证

### 认证机制

- **认证方式**：[Bearer Token / Basic Auth / 无需认证]
- **认证服务**：[IdentityService]

### 授权策略

使用 ThirdNet 框架自定义授权。

### 安全防护

- [X] SQL 注入防护：ORM 参数化查询
- [X] XSS 防护：输入过滤/输出编码
- [X] HTTPS 强制：生产环境强制 HTTPS
- [X] 速率限制：防止暴力攻击

---

## 性能优化

### 缓存策略

按需创建缓存，参考 `net-cache-use` 技能。

### 异步处理

- **异步原则**：All the way down
- **取消令牌**：支持操作取消

### 数据库优化

- [ ] 避免 N+1 查询
- [ ] 使用投影（Select）
- [ ] 分页查询

### 批量操作

需要时使用 `net-database-bulkcopy` 技能。

---

## 后台任务

| 任务 | 描述 | 执行频率 |
|------|------|----------|
| [Task1] | [描述] | [频率] |

**框架**：BackgroundRunner

**注册方式**：`builder.Services.AddHostedService<[TaskName]>()`

---

## 测试策略

| 场景 | 测试描述 |
|------|----------|
| [场景1] | [描述] |
| [场景2] | [描述] |

---

## 部署与运维

### 配置管理

- **配置源**：appsettings.json

### 日志策略

| 级别 | 适用场景 |
|------|----------|
| Information | 一般信息 |
| Warning | 警告信息 |
| Error | 错误信息 |
| Critical | 严重错误 |
