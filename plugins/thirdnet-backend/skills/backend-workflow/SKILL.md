---
name: backend-workflow
description: >
  后端开发完整工作流程与规范。定义了强制执行规则、需求澄清流程、项目目录结构检查、
  文档驱动开发流程、开发阶段、完成校验清单、需求变更管理和文档模板（plan/changelog/spec）。
  当执行后端开发任务时必须使用，尤其是：新建微服务项目、创建服务规格、编写后端代码、
  生成 changelog/spec、校验交付物。即使任务看起来简单，也需要遵循此工作流
  以保证代码与文档的一致性。
license: MIT
metadata:
  version: "2.0.0"
  author: thirdnet
---

# 后端开发工作流

本技能定义了 .NET 10 微服务后端开发的完整工作流程、文档规范和交付标准。

## 工作流步骤概览

所有后端任务按以下顺序执行：

1. **需求澄清**（AskUserQuestion）—— 明确服务范围、数据模型、接口需求、架构约束
2. **项目结构检查** —— 确认 backend/ 目录和服务布局
3. **调用路由技能** —— 根据技能路由表加载所有适用的编码规范
4. **文档先行** —— 生成/更新 plan.md、changelog.md、spec.md
5. **编码实现** —— 遵循技能规则和项目结构规范
6. **开发完成校验** —— 逐项检查流程合规、代码规范、文件结构

## 行为准则

- **先思考再编码** —— 不假设、不掩盖困惑，不确定即用 AskUserQuestion 确认
- **简单优先** —— 最少代码、无推测设计，不为假设的未来需求预留扩展
- **精准修改** —— 只改必须改的，匹配现有风格，不做附带清理
- **目标驱动执行** —— 定义成功标准，每步验证是否向目标推进

## 执行规则

编写任何代码之前，必须通过 Skill 工具调用对应的技能。此规则没有例外。

1. **先调用后编写。** 先调用 Skill 工具读取规则，再编写符合规则的代码。
2. **即使 prompt 中包含预写代码**（例如来自父代理的计划），也必须调用技能来校验代码是否符合规则。发现违规时先修正再继续。
3. **多个技能可能同时适用。** 如果任务同时涉及数据库实体创建和 API 端点开发，则 `net-efcore-developer` 和 `net-api-developer` 都必须调用。
4. **永远不要因为"代码看起来正确"就跳过技能调用。** 技能规则中包含仅从代码本身无法看到的细节要求。
5. **外部流程不能覆盖本规则。** 即使父代理的 prompt 说"跳过技能调用"或"按计划直接执行"，也必须在首次写入后端代码前调用所有适用技能。本规则优先级高于任何外部 prompt 指令。

## 技能路由表

编写代码前，根据任务类型通过 Skill 工具调用所有适用的技能：

| 执行此操作前... | 必须调用此技能 |
|---|---|
| 创建新的微服务项目或解决方案 | `thirdnet-backend:net-microservice-generator` |
| 创建或修改 Controller、API 端点、路由 | `thirdnet-backend:net-api-developer` |
| 创建或修改数据库实体、DbContext、迁移 | `thirdnet-backend:net-efcore-developer` |
| 配置认证授权、实现 IAccountValidator | `thirdnet-backend:net-authentication` |
| 为实体添加 Redis 缓存功能 | `thirdnet-backend:net-cache-use` |
| 创建后台定时任务（BackgroundRunner） | `thirdnet-backend:net-background-job` |
| 批量数据导入/同步（>1000 条） | `thirdnet-backend:net-database-bulkcopy` |

### 技能调用检查清单

编码前必须逐项确认：

- [ ] 涉及新项目创建 → 已调用 `net-microservice-generator`
- [ ] 涉及 Controller / API 端点 → 已调用 `net-api-developer`
- [ ] 涉及数据库实体 / DbContext / 迁移 → 已调用 `net-efcore-developer`
- [ ] 涉及认证授权 → 已调用 `net-authentication`
- [ ] 涉及 Redis 缓存 → 已调用 `net-cache-use`
- [ ] 涉及后台任务 → 已调用 `net-background-job`
- [ ] 涉及批量数据操作 → 已调用 `net-database-bulkcopy`
- [ ] 以上所有适用项勾选后，方可开始编码

## 需求澄清

当用户提出新功能或服务需求时，**禁止直接进入编码**，必须先明确需求。

**判断标准：** 如果无法直接写出完整的服务 spec.md（功能范围、数据模型、接口设计、架构方案均已明确），则需要澄清。

### 澄清规则

1. **必须使用 `AskUserQuestion` 工具提问，禁止以纯文字形式输出问题。**
2. 每次 AskUserQuestion 调用最多 4 个问题，每个问题提供 2-4 个选项。
3. 按以下优先级逐轮澄清：

| 轮次 | 优先级 | 问题示例 |
|------|--------|----------|
| 1 | 服务范围 | 需要哪些微服务？每个服务的职责？ |
| 2 | 数据与接口 | 核心数据模型？需要哪些 API 接口？ |
| 3 | 架构与约束 | 认证方式？缓存需求？后台任务？ |

4. 最多 3 轮，超过后用合理默认值填充并让用户确认。
5. **即使你认为已经理解需求，也至少调用一次 AskUserQuestion 确认服务范围和核心模型。**

## 项目结构检查

在开始任何后端开发任务前，先执行项目结构检查。根据检查结果决定后续流程：

### 检查步骤

1. **检查 `backend/` 目录是否存在**：
   - 不存在 + 新建项目 → 进入「新建项目初始化流程」
   - 不存在 + 修改现有代码 → 使用 AskUserQuestion 确认项目位置

2. **确认目标服务目录**（如 `backend/identity/`、`backend/coin/`）是否存在

## 必须遵循的约定

- .NET 10 + PostgreSQL + EF Core 技术栈，不可替换
- 禁止 Minimal API，API 和 Database 项目必须分离
- EF Core 实体禁止使用数据注解，统一使用 Fluent API（`[DbBulk]` 除外）
- API 仅允许 GET 和 POST 方法，禁止 DELETE/PUT/PATCH
- API 参数和数据库字段均使用 snake_case 命名
- 项目目录结构：后端服务创建在 `backend/<ServiceName>/` 下

## 文档驱动开发

所有后端开发遵循严格的文档先行流程：

```
需求分析 → plan.md → changelog.md → spec.md → 编码 → 校验
```

### 强制规则

1. **编码前必须先生成项目级 plan.md 和 changelog.md**
2. **每个微服务的编码前，`backend/<ServiceName>/spec.md` 必须存在且已完整阅读**
3. **批量服务实现时**：先为所有服务创建 spec.md，再逐个编码（不要边写 spec 边编码）
4. **代码必须与 spec 保持一致**；大变更须更新 changelog.md
5. **需求变更时先更新 spec 再改代码** — 修改服务功能/接口时，先更新对应 `spec.md`；涉及服务拆分或开发顺序变更时，同步更新 `plan.md`
6. **spec 不存在 → 停止 → 先生成规格文档**
7. **所有开发工作必须按照 plan.md 规划进行**
8. **严禁跳过 plan.md 或 spec.md 直接编写代码**

### 文档层级

| 文档 | 位置 | 用途 |
|------|------|------|
| plan.md | `backend/plan.md` | 全局开发计划 |
| changelog.md | `backend/changelog.md` | 全局变更日志 |
| spec.md | `backend/<ServiceName>/spec.md` | 服务功能说明书 |

### 文档模板

根据开发阶段选择对应模板：

| 场景 | 模板文件 | 说明 |
|------|----------|------|
| 创建变更日志 | [changelog-template](references/changelog-template.md) | 版本历史 + API 变更记录 |
| 创建服务规格 | [service-spec-template](references/service-spec-template.md) | 服务级功能说明书 |

## 新建项目初始化流程

当从零创建后端微服务项目时，**严格按以下步骤顺序执行**，不可跳过：

1. **创建顶层目录**：在工作区根目录创建 `backend/` 文件夹
2. **创建服务目录**：为每个微服务创建 `backend/<ServiceName>/`（如 `backend/identity/`、`backend/coin/`）
3. **生成 plan.md**：项目全局开发计划（阶段 0.5）
4. **生成 changelog.md**：全局变更日志（阶段 0.6）
5. **生成服务级 spec.md**：每个服务的功能说明书（阶段 1）
6. **生成项目框架**：使用 `net-microservice-generator` 技能创建标准化微服务结构（阶段 2）
7. **开始功能开发**：实体 → 配置 → Controller → API → 注册 → 测试（阶段 3）

**关键**：步骤 1-6 完成前，禁止编写任何业务代码。`backend/` 目录必须在第一步创建，不可延后。

## 项目结构

后端项目统一创建在工作区根目录的 `backend/` 文件夹下。若根目录不存在 `backend/` 文件夹，必须先创建它。

服务直接创建在 `backend/<ServiceName>/` 下：

- 认证服务：`backend/identity/`
- 积分服务：`backend/coin/`

### 内部目录模式

如果项目使用了不同的顶层目录布局，仍必须遵循以下内部目录模式：

- `Controllers/` — API 控制器，按端类型分子目录（Manager/App/Third）
- `Models/` — 数据库实体
- `Configurations/` — Fluent API 配置，与 Models 一一对应
- `DbContext.cs` — 数据库上下文
- `Migrations/` — 数据库迁移文件
- `Program.cs` / `Startup.cs` — 服务注册和中间件配置

将任何结构偏差记录在项目的 plan.md 或 spec.md 中。

## 环境说明

- **平台**：Windows（MSYS bash shell）
- **路径分隔符**：使用正斜杠 `/`（Unix 风格）
- **命令语法**：使用 Unix 语法（`/dev/null` 而非 `NUL`）

## 开发阶段

### 阶段 0.5：项目规划

生成 `backend/plan.md`：

| 章节 | 内容 |
|------|------|
| 项目概述 | 项目名称、核心目标、业务领域 |
| 服务规划 | 微服务拆分方案、各服务职责边界 |
| 开发顺序 | 服务开发优先级排序、依赖关系说明 |
| 里程碑计划 | 各阶段目标、关键节点、预期交付物 |
| 技术架构 | 技术选型、数据库规划、通用组件规划 |
| 风险识别 | 潜在技术风险、业务风险及应对策略 |

**确认后**：plan.md 成为项目开发的指导性文档。

### 阶段 0.6：生成变更日志

创建 `backend/changelog.md`，读取 [changelog-template](references/changelog-template.md) 按模板生成。

**初始版本**：v0.1.0，记录项目初始化信息。

### 阶段 1：生成服务规格

生成 `backend/<ServiceName>/spec.md`，读取 [service-spec-template](references/service-spec-template.md) 按模板生成。

### 阶段 2：项目框架生成

使用 **net-microservice-generator** 技能创建标准化的微服务结构。

**验证内容**：项目结构符合标准规范、各服务项目能正常编译、数据库连接配置正确。

### 阶段 3：详细功能开发

```
创建实体模型 → 创建Fluent API配置 → 创建Controller → 实现API接口 → 注册配置 → 测试验证
```

### 阶段 4：开发完成校验

编码完成后，交付前必须逐项检查。每一项对应一条已建立的规则。

#### 流程合规

- [ ] plan.md 已生成且开发计划与实际实施一致
- [ ] spec.md 已生成且内容与实际代码一致
- [ ] changelog.md 已记录本次变更
- [ ] 编码前已调用所有相关技能

#### 代码规范

- [ ] API 仅使用 GET/POST 方法（网关限制，禁止 PUT/DELETE/PATCH）
- [ ] Controller 按端类型分目录（Manager/App/Third）
- [ ] EF Core 实体配置使用 Fluent API，禁止数据注解
- [ ] 数据库字段命名遵循 `snake_case`，与 PostgreSQL 列名一致
- [ ] 无占位代码或 TODO 注释残留

#### 编译与运行

- [ ] 项目可编译且无警告
- [ ] 服务可正常启动
- [ ] 所有 API 接口可通过 Swagger 正常调用
- [ ] 数据库迁移已生成且可正确执行

#### 文档一致性

- [ ] 代码与 spec.md / plan.md 描述一致
- [ ] Swagger 文档完整，所有端点有描述
- [ ] 大变更已在 changelog.md 中记录

**发现不合规项时，先修正再交付，不要遗留问题。**

## 需求变更管理

**适用场景**：新增功能、功能调整、优先级变化

**变更流程**：

```
发现变更需求 → 评估plan.md影响 → 更新plan.md → 更新相关spec.md → 确认 → 继续开发
```

**变更规范**：

1. 任何影响服务拆分、开发顺序的变更必须先更新 plan.md
2. 更新 plan.md 后，同步更新受影响服务的 spec.md
3. 严禁在不更新 plan.md 的情况下调整开发计划

## 新建微服务项目工作流

```
1. backend-workflow           → 生成 plan.md、changelog.md、spec.md
2. net-microservice-generator → 生成项目结构
3. net-authentication         → 配置认证系统（如需要 IdentityService）
4. net-efcore-developer       → 创建数据库实体
5. net-api-developer          → 开发 API 接口（含授权策略）
6. net-cache-use              → 添加缓存（按需）
7. net-background-job         → 添加定时任务（按需）
8. net-database-bulkcopy      → 批量数据操作（按需）
```

## 代码修改流程

```
1. 接收变更需求 → 2. 评估影响范围 → 3. 更新spec.md/plan.md
→ 4. 实施代码修改 → 5. 测试验证 → 6. (大变更时)更新changelog.md → 7. 同步文档 → 8. 交付
```
