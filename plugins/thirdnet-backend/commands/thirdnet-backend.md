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

## 执行流程（严格按阶段顺序，不可跳过任何阶段）

### 阶段一：需求澄清

1. 分析用户提供的需求描述
2. 判断需求清晰度：
   - **模糊需求**（缺少功能范围、数据模型、接口设计、架构方案等）→ 调用 `superpowers:brainstorming` 进行需求澄清
   - **明确需求**（功能范围、数据模型、接口、架构均已确定）→ 跳过 brainstorming，直接进入阶段二
   - **部分明确** → 用 AskUserQuestion 补充确认后进入阶段二
3. **关键约束：** brainstorming 完成后，流程必须回到本命令继续执行阶段二。禁止直接跳转到 superpowers 的 writing-plans 或 subagent-driven-development 流程。

### 阶段二：技能加载（不可跳过）

4. 根据需求涉及的技术领域，通过 Skill 工具调用以下技能（按需匹配）：
   - 创建微服务项目 → `thirdnet-backend:net-microservice-generator`
   - 开发 API 接口 / Controller → `thirdnet-backend:net-api-developer`
   - 数据库实体 / 迁移 / Fluent API → `thirdnet-backend:net-efcore-developer`
   - 认证授权配置 → `thirdnet-backend:net-authentication`
   - Redis 缓存功能 → `thirdnet-backend:net-cache-use`
   - 后台定时任务 → `thirdnet-backend:net-background-job`
   - 批量数据操作 → `thirdnet-backend:net-database-bulkcopy`
5. 技能规则加载完成后，进入阶段三

### 阶段三：开发执行

6. 调用后端开发专家 Agent（`agents/backend-developer.md`），将技能输出作为上下文传递
7. Agent 按文档驱动开发流程执行：plan.md → spec.md → 编码 → 审查

### 阶段四：完成校验

8. 执行开发完成校验清单（见 agent 中的校验部分）

## 必须调用的技能（不可跳过）

代理执行任何代码编写前，必须通过 Skill 工具调用以下技能：

1. **创建微服务项目** → 调用 `thirdnet-backend:net-microservice-generator`
2. **开发 API 接口 / Controller** → 调用 `thirdnet-backend:net-api-developer`
3. **数据库实体 / 迁移 / Fluent API** → 调用 `thirdnet-backend:net-efcore-developer`
4. **认证授权配置** → 调用 `thirdnet-backend:net-authentication`
5. **Redis 缓存功能** → 调用 `thirdnet-backend:net-cache-use`
6. **后台定时任务** → 调用 `thirdnet-backend:net-background-job`
7. **批量数据操作** → 调用 `thirdnet-backend:net-database-bulkcopy`

## 必须遵循的约定

- .NET 10 + PostgreSQL + EF Core 技术栈，不可替换
- 禁止 Minimal API，API 和 Database 项目必须分离
- EF Core 实体禁止使用数据注解，统一使用 Fluent API
- API 仅允许 GET 和 POST 方法，禁止 DELETE/PUT/PATCH
- 数据库字段使用 snake_case 命名
- 文档驱动开发：plan.md → spec.md → changelog.md → 代码

## 技术栈

> 参阅 **net-microservice-generator** 技能中的技术栈定义。

## 注意事项

- 确保项目已初始化后端框架
- 描述 API 的输入输出要求
- 如有特殊的认证或授权需求，请说明
- 复杂的业务逻辑建议分步实现
- 遵循文档驱动开发：先有 plan.md 和 spec.md 再编写代码
- 项目目录结构：后端服务创建在 `backend/<ServiceName>/`，前端项目创建在 `frontend/<ServiceName>/`
