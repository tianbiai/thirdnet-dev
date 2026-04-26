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
3. Agent 将按文档驱动开发流程执行（详见 **backend-developer** Agent）

## 技术栈

> 参阅 **net-microservice-generator** 技能中的技术栈定义。

## 注意事项

- 确保项目已初始化后端框架
- 描述 API 的输入输出要求
- 如有特殊的认证或授权需求，请说明
- 复杂的业务逻辑建议分步实现
- 遵循文档驱动开发：先有 plan.md 和 spec.md 再编写代码
- 项目目录结构：后端服务创建在 `backend/<ServiceName>/`，前端项目创建在 `frontend/<ServiceName>/`
