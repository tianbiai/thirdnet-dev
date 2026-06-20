# [项目名称]

> 项目级规格说明。覆盖项目中所有服务的功能、数据模型和接口设计。编写前必须阅读相关技能文档。

---

## 项目概述

**项目名称**：[ProjectName]

**核心目标**：
- [目标1]
- [目标2]

**技术栈**：.NET 10 + PostgreSQL + EF Core + Redis + ThirdNet 框架

---

## 服务 [ServiceName]

> 每个服务作为一个独立的二级章节，可按需复制此模板块。

### 服务职责

- [职责1]
- [职责2]

### 依赖服务

- AdminService — 认证授权（ThirdNet 框架）
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

> ⚠️ **API 接口规范请参阅 net-api-developer 技能**（路径规范、HTTP 方法限制、响应格式、Controller 命名规则等）。

| 方法 | 路由 | Controller | 功能 | 优先级 | 认证 |
|------|------|------------|------|--------|------|
| POST | `/api/[module]/[resource]/create` | `[Resource]ManagerController` | 创建资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/update` | `[Resource]ManagerController` | 更新资源 | P0 | ✅ |
| POST | `/api/[module]/[resource]/delete` | `[Resource]ManagerController` | 删除资源 | P0 | ✅ |
| GET | `/api/[module]/[resource]` | `[Resource]ManagerController` | 获取资源 | P0 | ✅ |

### 数据模型

| 表名 | Schema | 说明 | 主键类型 |
|------|--------|------|----------|
| `t_table1` | [schema] | [说明] | `long` |
| `t_table2` | [schema] | [说明] | `long` |

> 字段配置、命名规范、主键要求等请遵循 **net-efcore-developer** 技能的 Fluent API 配置规范。

---

## 安全与认证

### 认证机制

- **认证方式**：Basic Auth + Bearer Token（JWT）
- **认证服务**：Admin（IAccountValidator）

### 授权策略

使用 ThirdNet 框架自定义授权（`[PermissionAuthorize]`）。

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

- [ ] 避免 N+1 查询（优先 `Select` 投影；多集合 `Include` 用 `AsSplitQuery`）
- [ ] 使用投影（Select）
- [ ] 分页查询（常规 `ToPageListAsync`，深翻页/实时流用 keyset）
- [ ] jsonb/数组列配 GIN 索引
- [ ] 高频过滤列/FK 关联列建索引（含 `dept_id` 等数据权限过滤列）
- [ ] `DateTime` 列映射为 `timestamptz`
- [ ] 慢查询经 `EXPLAIN (ANALYZE, BUFFERS)` 验证

> 完整最佳实践（索引策略/连接管理/监控诊断/迁移安全/并发锁）见 [net-efcore-developer → postgres-best-practices.md](../../net-efcore-developer/references/postgres-best-practices.md)。

### 批量操作

根据数据来源选择合适的批量操作方式：

- **外部数据导入/同步**（>1000 条，数据来自 Excel/API/外部系统）：使用 `net-efcore-developer` 技能（批量操作小节）
- **数据库内批量处理**（归档/级联清理/状态迁移，数据已在数据库中）：使用 `net-efcore-developer` 技能的 CTE 批量模式

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

- **配置源**：`appsettings.json`（模板）+ `appsettings.Development.json`（本地开发）
- **模板格式**：`appsettings.json` 使用说明性字符串标识字段用途，CI/CD 直接替换属性值
- **详细规范**：参阅 `net-microservice-generator` 技能的 `references/appsettings-management.md`

| 文件 | 提交 Git | 用途 |
|------|---------|------|
| `appsettings.json` | ✅ | 配置模板，使用说明性字符串，定义所有配置节结构 |
| `appsettings.Development.json` | ❌ | 本地开发真实值，覆盖模板中的对应项 |

### 日志策略

| 级别 | 适用场景 |
|------|----------|
| Information | 一般信息 |
| Warning | 警告信息 |
| Error | 错误信息 |
| Critical | 严重错误 |
