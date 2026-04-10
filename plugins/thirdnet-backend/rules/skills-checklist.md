# 后端技能文档清单

> 本文档列出 `skills/` 目录下所有可用的后端技能及其适用场景。

---

## 技能速查表

| 技能 | 优先级 | 触发场景 |
|------|--------|----------|
| `net-microservice-generator` | ⭐⭐⭐ | 创建新项目、初始化微服务架构 |
| `net-api-developer` | ⭐⭐⭐ | 创建 Controller、定义 API |
| `net-efcore-developer` | ⭐⭐⭐ | 创建数据库实体、定义表结构、迁移 |
| `net-authentication` | ⭐⭐⭐ | 认证配置、授权策略、Token、登录 |
| `net-cache-use` | ⭐⭐ | 添加缓存功能、性能优化 |
| `net-background-job` | ⭐ | 定时任务、后台作业 |
| `net-database-bulkcopy` | ⭐ | 大数据量导入（>1000条）、Excel导入 |

---

## 核心技能

### net-microservice-generator ⭐⭐⭐

.NET 微服务解决方案生成器，涵盖项目结构、解决方案生成、模板安装、Startup 配置、中间件管道。

**何时使用**：创建新项目、初始化微服务架构、搭建脚手架、配置 appsettings

### net-api-developer ⭐⭐⭐

.NET API 接口开发专家，涵盖 Controller 创建、API 路由定义、HTTP 端点开发、DTO 模型设计、错误处理。

**何时使用**：创建 Controller、定义 API、编写接口

**重要约束**：仅允许使用 GET 和 POST 方法；路由禁止包含版本号

### net-efcore-developer ⭐⭐⭐

EF Core 数据库开发专家，涵盖实体模型、Fluent API 配置、DbContext、迁移文件、原生 SQL 查询。

**何时使用**：创建数据库实体、定义表结构、数据库迁移

**重要约束**：禁止使用数据注解，实体必须是纯净的 POCO 类

### net-authentication ⭐⭐⭐

.NET 认证系统开发专家，涵盖 Basic/Bearer 认证配置、IAccountValidator 实现、ICheckClient 客户端验证、Token 获取/刷新流程、授权策略使用。

**何时使用**：认证配置、登录、Token、JWT、授权策略、用户验证、IAccountValidator

---

## 缓存

### net-cache-use ⭐⭐

缓存功能开发专家，基于 Redis 实现完整的三层缓存架构（CacheManager、RedisHandler、View）。

**何时使用**：添加缓存功能、字典缓存、配置缓存、性能优化、缓存预热

---

## 后台任务

### net-background-job

后台定时任务开发专家，基于 BackgroundRunner 框架实现循环执行的后台任务。

**何时使用**：定时任务、后台作业、周期性数据处理、数据同步

---

## 数据库批量操作

### net-database-bulkcopy

PostgreSQL 批量数据操作专家，基于 PostgresqlAsyncBulk 实现高性能批量操作。

**何时使用**：大数据量导入（>1000条）、Excel导入、数据迁移、数据同步

---

## 开发流程

### 新建微服务项目

```
1. net-microservice-generator  → 生成项目结构
2. net-authentication          → 配置认证系统（如需要 IdentityService）
3. net-efcore-developer        → 创建数据库实体
4. net-api-developer           → 开发 API 接口（含授权策略）
5. net-cache-use               → 添加缓存（按需）
6. net-background-job          → 添加定时任务（按需）
7. net-database-bulkcopy       → 批量数据操作（按需）
```
