# 后端技能文档清单

本文档列出了 `skills/` 目录下所有可用的后端技能。

---

## ⚙️ 后端技能

### 项目架构

- `net-microservice-generator` ⭐⭐⭐
  - .NET 微服务解决方案生成器
  - 涵盖：项目结构、解决方案生成、模板安装
  - **适用场景**: 创建新项目、初始化微服务架构

### API 开发

- `net-api-developer` ⭐⭐⭐
  - .NET API 接口开发专家
  - 涵盖：Controller 创建、API 路由定义、HTTP 端点开发
  - **适用场景**: 创建 Controller、定义 API、编写接口
  - **重要约束**：仅允许使用 GET 和 POST 方法

### 数据库开发

- `net-efcore-developer` ⭐⭐⭐
  - EF Core 数据库开发专家
  - 涵盖：实体模型、Fluent API 配置、DbContext、迁移文件
  - **适用场景**: 创建数据库实体、定义表结构、数据库迁移
  - **重要约束**：禁止使用数据注解，实体必须是纯净的 POCO 类

- `net-database-bulkcopy`
  - PostgreSQL 批量数据操作专家
  - 涵盖：批量导入、批量更新、数据同步、ETL
  - **适用场景**: 大数据量导入（>1000条）、Excel导入、数据迁移

### 缓存与后台任务

- `net-cache-use`
  - 缓存功能开发专家
  - 涵盖：Redis 缓存、字典缓存、配置缓存
  - **适用场景**: 添加缓存功能、性能优化

- `net-background-job`
  - 后台定时任务开发专家
  - 涵盖：定时任务、数据同步、周期性处理
  - **适用场景**: 定时任务、后台作业、自动执行

---

## 📋 技能使用流程

### 新建微服务项目

```
1. net-microservice-generator  → 生成项目结构
2. net-efcore-developer        → 创建数据库实体
3. net-api-developer           → 开发 API 接口
4. net-cache-use               → 添加缓存（按需）
5. net-background-job          → 添加定时任务（按需）
6. net-database-bulkcopy       → 批量数据操作（按需）
```
