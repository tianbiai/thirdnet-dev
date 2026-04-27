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
  - TodoWrite
  - WebSearch
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

### 阶段一：需求澄清（内置流程）

分析用户提供的需求描述，判断清晰度并分类处理。

**判断标准：** 如果你能直接写出完整的服务 spec.md（功能范围、数据模型、接口设计、架构方案均已明确），则为"明确需求"。否则需要澄清。

#### 模糊需求 → 内置澄清对话

一次通过 `AskUserQuestion` 提出 1-2 个关键问题（不要一次问太多）。按以下优先级逐轮澄清：

1. **服务范围** — 需要哪些微服务？每个服务的职责是什么？
2. **数据与接口** — 核心数据模型是什么？需要哪些 API 接口？
3. **架构与约束** — 认证方式？缓存需求？后台任务？

每轮根据用户回答追问不明确的部分，直到能写出 spec.md。**最多 3 轮提问**，超过后用合理默认值填充并让用户确认。

#### 明确需求 → 直接进入阶段二

#### 部分明确 → 只对模糊部分使用 AskUserQuestion，1 轮内解决

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

6. 按照「文档驱动开发」流程执行，严格按以下顺序：
   a. 编写项目级 `plan.md`（服务规划、开发顺序、技术架构）
   b. 编写 `changelog.md`（初始化版本记录，读取 `net-microservice-generator` 技能中的变更日志模板）
   c. 为每个待开发的微服务创建 `backend/{ServiceName}/spec.md`（读取 `net-microservice-generator` 技能中的服务规格模板）
   d. 服务级 spec 必须在对应代码编写前完成
   e. 编码实现（代码必须与 spec 保持一致）
   f. 自查
7. 所有代码编写必须遵循阶段二中已加载的技能规则

### 阶段四：完成校验

8. 执行开发完成校验清单（见 agent 中的校验部分）

## 必须调用的技能（不可跳过）

代理执行任何代码编写前，必须通过 Skill 工具调用以下技能：

1. **创建微服务项目** → 调用 `thirdnet-backend:net-microservice-generator`（必须按模板生成 plan.md、changelog.md、spec.md，详见该技能"强制规则"）
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
- 文档驱动开发：先有 plan.md，再生成 changelog.md，再为每个服务编写 spec.md，最后再编写代码
- 服务级 spec 不可跳过：任何微服务的代码编写前，对应的 `backend/{ServiceName}/spec.md` 必须已存在

## 技术栈

> 参阅 **net-microservice-generator** 技能中的技术栈定义。

## 注意事项

- 确保项目已初始化后端框架
- 描述 API 的输入输出要求
- 如有特殊的认证或授权需求，请说明
- 复杂的业务逻辑建议分步实现
- 遵循文档驱动开发：先有 plan.md，再生成 changelog.md，再为每个服务编写 spec.md，最后再编写代码
- 项目目录结构：后端服务创建在 `backend/<ServiceName>/` 下
