# 后端技能文档清单

> 本文档列出 `skills/` 目录下所有可用的后端技能及其适用场景。

## 基础行为准则

> 所有开发任务必须遵循 `rules/guidelines.md` 中定义的开发准则（先思考再编码、简单优先、精准修改、目标驱动执行）。在应用下方技能之前，先确认行为准则已满足。

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

## 新建微服务项目工作流

```
1. net-microservice-generator  → 生成项目结构
2. net-authentication          → 配置认证系统（如需要 IdentityService）
3. net-efcore-developer        → 创建数据库实体
4. net-api-developer           → 开发 API 接口（含授权策略）
5. net-cache-use               → 添加缓存（按需）
6. net-background-job          → 添加定时任务（按需）
7. net-database-bulkcopy       → 批量数据操作（按需）
```
