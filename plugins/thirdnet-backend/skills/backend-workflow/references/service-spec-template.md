# [服务名称]

> 服务级规格说明。编写前必须阅读相关技能文档。

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

> ⚠️ **API 接口规范请参阅 **net-api-developer** 技能**（路径规范、HTTP 方法限制、响应格式、Controller 命名规则等）。

| 方法 | 路由 | Controller | 功能 | 优先级 | 认证 |
|------|------|------------|------|--------|------|
| POST | `/api/[module]/[resource]/create` | `[Resource]ManagerController` | 创建资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/update` | `[Resource]ManagerController` | 更新资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/delete` | `[Resource]ManagerController` | 删除资源 | P0 | ✅ |
| GET | `/api/[module]/[resource]` | `[Resource]ManagerController` | 获取资源 | P0 | ✅ |

---

## 数据模型

### 数据库表

| 表名 | 说明 | 主键类型 |
|------|------|----------|
| `t_table1` | [说明] | `long` |
| `t_table2` | [说明] | `long` |

### 字段配置规范

> 字段配置、命名规范、主键要求等请遵循 **net-efcore-developer** 技能的 Fluent API 配置规范。

---

## 架构设计

### 项目结构

> 项目结构请参阅 **net-microservice-generator** 技能中的"标准目录结构"章节。

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

**注册方式**：在 `Startup.ConfigureServices` 中 `services.AddHostedService<[TaskName]>()`

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
