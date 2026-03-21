# 后端技能文档清单

> 本文档列出 `skills/` 目录下所有可用的后端技能及其适用场景。

---

## 技能速查表

| 技能 | 优先级 | 触发场景 |
|------|--------|----------|
| `net-microservice-generator` | ⭐⭐⭐ | 创建新项目、初始化微服务架构 |
| `net-api-developer` | ⭐⭐⭐ | 创建 Controller、定义 API |
| `net-efcore-developer` | ⭐⭐⭐ | 创建数据库实体、定义表结构、迁移 |
| `net-database-bulkcopy` | ⭐ | 大数据量导入（>1000条）、Excel导入 |
| `net-cache-use` | ⭐ | 添加缓存功能、性能优化 |
| `net-background-job` | ⭐ | 定时任务、后台作业 |

---

## 核心技能

### net-microservice-generator ⭐⭐⭐

.NET 微服务解决方案生成器，涵盖项目结构、解决方案生成、模板安装。

**何时使用**：创建新项目、初始化微服务架构

### net-api-developer ⭐⭐⭐

.NET API 接口开发专家，涵盖 Controller 创建、API 路由定义、HTTP 端点开发。

**何时使用**：创建 Controller、定义 API、编写接口

**重要约束**：仅允许使用 GET 和 POST 方法

### net-efcore-developer ⭐⭐⭐

EF Core 数据库开发专家，涵盖实体模型、Fluent API 配置、DbContext、迁移文件。

**何时使用**：创建数据库实体、定义表结构、数据库迁移

**重要约束**：禁止使用数据注解，实体必须是纯净的 POCO 类

---

## 数据库操作

### net-database-bulkcopy

PostgreSQL 批量数据操作专家，涵盖批量导入、批量更新、数据同步、ETL。

**何时使用**：大数据量导入（>1000条）、Excel导入、数据迁移

---

## 缓存与后台任务

### net-cache-use

缓存功能开发专家，涵盖 Redis 缓存、字典缓存、配置缓存。

**何时使用**：添加缓存功能、性能优化

### net-background-job

后台定时任务开发专家，涵盖定时任务、数据同步、周期性处理。

**何时使用**：定时任务、后台作业、自动执行

---

## 开发流程

### 新建微服务项目

```
1. net-microservice-generator  → 生成项目结构
2. net-efcore-developer        → 创建数据库实体
3. net-api-developer           → 开发 API 接口
4. net-cache-use               → 添加缓存（按需）
5. net-background-job          → 添加定时任务（按需）
6. net-database-bulkcopy       → 批量数据操作（按需）
```
