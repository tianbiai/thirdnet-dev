---
name: backend-workflow
version: 1.0.0
description: >
  后端开发完整工作流程与规范。定义了文档驱动开发流程、项目目录结构、开发阶段、
  完成校验清单、需求变更管理和文档模板（plan/changelog/spec）。当执行后端开发任务时
  必须使用，尤其是：新建微服务项目、创建服务规格、编写后端代码、生成 changelog/spec、
  校验交付物。即使任务看起来简单，也需要遵循此工作流以保证代码与文档的一致性。
license: MIT
metadata:
  author: thirdnet
---

# 后端开发工作流

本技能定义了 .NET 10 微服务后端开发的完整工作流程、文档规范和交付标准。

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

编码完成后，交付前必须逐项检查。

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

### 阶段 5：文档生成

使用 `dotnet-docgen` Agent 生成：

- **API 接口文档**：`backend/<ServiceName>/docs/api.md`
- **数据库文档**：`backend/<ServiceName>/docs/database.md`

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

## 技能速查表

| 技能 | 优先级 | 触发场景 |
|------|--------|---------|
| `net-microservice-generator` | ⭐⭐⭐ | 创建新项目、初始化微服务架构 |
| `net-api-developer` | ⭐⭐⭐ | 创建 Controller、定义 API |
| `net-efcore-developer` | ⭐⭐⭐ | 创建数据库实体、定义表结构、迁移 |
| `net-authentication` | ⭐⭐⭐ | 认证配置、授权策略、Token、登录 |
| `net-cache-use` | ⭐⭐ | 添加缓存功能、性能优化 |
| `net-background-job` | ⭐ | 定时任务、后台作业 |
| `net-database-bulkcopy` | ⭐ | 大数据量导入（>1000条）、Excel导入 |
