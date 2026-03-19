---
name: thirdnet-backend
description: 创建或修改后端 API 和服务
argument-hint: '"API描述" - 例如: "创建用户注册接口" 或 "添加分页查询"'
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - LSP
  - AskUserQuestion
---
# 后端开发命令

使用后端开发专家 Agent 来创建或修改后端代码。

## 使用方法

```
/thirdnet-backend "你的需求描述"
```

## 示例

```
/thirdnet-backend "创建一个用户注册 API"
/thirdnet-backend "添加获取文章列表的接口，支持分页"
/thirdnet-backend "实现 JWT 认证中间件"
/thirdnet-backend "优化数据库查询性能"
```

## 执行流程

1. 分析用户提供的需求描述
2. 调用后端开发专家 Agent（`agents/backend-developer.md`）
3. Agent 将：
   - 理解需求和技术上下文
   - 参考后端技能文档：
     - `skills/net-microservice-generator/` - 项目架构生成
     - `skills/net-api-developer/` - API 接口开发
     - `skills/net-efcore-developer/` - 数据库实体开发
     - `skills/net-cache-use/` - 缓存功能
     - `skills/net-background-job/` - 后台定时任务
     - `skills/net-database-bulkcopy/` - 批量数据操作
   - 参考 `rules/service-spec-template.md` 等规范模板
   - 遵循文档驱动开发流程
   - 生成或修改相应的代码文件

## 技术栈

- **框架**: .NET 10
- **数据库**: PostgreSQL
- **ORM**: Entity Framework Core (Code First)
- **架构**: 微服务架构

## 注意事项

- 确保项目已初始化后端框架
- 描述 API 的输入输出要求
- 如有特殊的认证或授权需求，请说明
- 复杂的业务逻辑建议分步实现
- 遵循文档驱动开发：先有 plan.md 和 spec.md 再编写代码
