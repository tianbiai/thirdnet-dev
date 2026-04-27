---
name: thirdnet-frontend
description: 创建或修改前端页面和组件
argument-hint: '"页面描述" - 例如: "创建登录页面" 或 "修改首页布局"'
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
# 前端开发命令

使用前端开发专家 Agent 来创建或修改前端代码。

## 使用方法

```
/thirdnet-frontend "你的需求描述"
```

## 示例

```
/thirdnet-frontend "创建一个用户个人资料页面"
/thirdnet-frontend "在首页添加一个轮播图组件"
/thirdnet-frontend "修复移动端导航栏的显示问题"
/thirdnet-frontend "优化登录表单的验证逻辑"
```

## 执行流程（严格按阶段顺序，不可跳过任何阶段）

### 阶段一：需求澄清

1. 分析用户提供的需求描述
2. 判断需求清晰度：
   - **模糊需求**（缺少功能范围、交互流程、设计风格、目标平台等）→ 调用 `superpowers:brainstorming` 进行需求澄清
   - **明确需求**（功能范围、交互、设计、平台均已确定）→ 跳过 brainstorming，直接进入阶段二
   - **部分明确** → 用 AskUserQuestion 补充确认后进入阶段二
3. **关键约束：** brainstorming 完成后，流程必须回到本命令继续执行阶段二。禁止直接跳转到 superpowers 的 writing-plans 或 subagent-driven-development 流程。

### 阶段二：技能加载（不可跳过）

4. 根据需求涉及的技术领域，通过 Skill 工具调用以下技能（按需匹配，至少调用 vue-best-practices）：
   - 所有 Vue 开发任务 → `thirdnet-frontend:vue-best-practices`
   - API / Mock 模块开发 → `thirdnet-frontend:api-typescript-spec`
   - Pinia 状态管理 → `thirdnet-frontend:vue-pinia-best-practices`
   - Vue Router 路由 → `thirdnet-frontend:vue-router-best-practices`
   - 新建页面/功能 → `thirdnet-frontend:doc-templates`（先写 spec.md）
   - UI 设计 / 样式 → `thirdnet-frontend:design-apple`
5. 技能规则加载完成后，进入阶段三

### 阶段三：开发执行

6. 调用前端开发专家 Agent（`agents/frontend-developer.md`），将技能输出作为上下文传递
7. Agent 按文档驱动开发流程执行：spec.md → 编码 → 审查

### 阶段四：完成校验

8. 执行开发完成校验清单（见 agent 中的校验部分）

## 必须调用的技能（不可跳过）

代理执行任何代码编写前，必须通过 Skill 工具调用以下技能：

1. **所有 Vue 开发任务** → 调用 `thirdnet-frontend:vue-best-practices`
2. **API / Mock 模块开发** → 调用 `thirdnet-frontend:api-typescript-spec`
3. **Pinia 状态管理** → 调用 `thirdnet-frontend:vue-pinia-best-practices`
4. **Vue Router 路由** → 调用 `thirdnet-frontend:vue-router-best-practices`
5. **新建页面/功能** → 调用 `thirdnet-frontend:doc-templates`（先写 spec.md）
6. **UI 设计 / 样式** → 调用 `thirdnet-frontend:design-apple`

## 必须遵循的约定

- API 模块采用接口契约策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`），与 Mock 数据（`mock/data/{endpoint}/*.ts`）文件名一致
- `MOCK_ENABLED` 开关控制帮助气泡显示与数据来源
- 文档驱动开发：先有 spec.md 再编写代码

## 注意事项

- 确保项目已初始化前端框架
- 描述尽量具体，包含必要的功能点
- 如需特定样式或交互，请详细说明
- 遵循文档驱动开发：先有 spec.md 再编写代码
- 设计或开发过程中，可使用 `/ui-ux-pro-max` 全局技能对页面进行优化
