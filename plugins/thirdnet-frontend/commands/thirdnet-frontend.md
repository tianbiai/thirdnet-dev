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
  - TodoWrite
  - WebSearch
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

### 阶段一：需求澄清（内置流程）

分析用户提供的需求描述，判断清晰度并分类处理。

**判断标准：** 如果你能直接写出完整的页面 spec.md（功能范围、交互流程、UI 结构、数据来源均已明确），则为"明确需求"。否则需要澄清。

#### 模糊需求 → 内置澄清对话

一次通过 `AskUserQuestion` 提出 1-2 个关键问题（不要一次问太多）。按以下优先级逐轮澄清：

1. **平台与范围** — 目标平台（Web/小程序/H5）？包含哪些页面/功能？
2. **数据与交互** — 数据从哪来（Mock/真实API）？核心交互流程是什么？
3. **设计风格** — 有设计稿吗？参考风格（简约/商务/...）？

每轮根据用户回答追问不明确的部分，直到能写出 spec.md。**最多 3 轮提问**，超过后用合理默认值填充并让用户确认。

#### 明确需求 → 直接进入阶段二

#### 部分明确 → 只对模糊部分使用 AskUserQuestion，1 轮内解决

### 阶段二：技能加载（不可跳过）

4. 根据需求涉及的技术领域，通过 Skill 工具调用以下技能（按需匹配，至少调用 vue-best-practices）：
   - 所有 Vue 开发任务 → `thirdnet-frontend:vue-best-practices`
   - API / Mock 模块开发 → `thirdnet-frontend:api-typescript-spec`
   - Pinia 状态管理 → `thirdnet-frontend:vue-pinia-best-practices`
   - Vue Router 路由 → `thirdnet-frontend:vue-router-best-practices`
   - 新建页面/功能 → `thirdnet-frontend:doc-templates`（先写 spec.md + 生成 changelog.md / viewer.html / marked.min.js 等配套文件，详见该技能"强制规则"）
   - UI 设计 / 样式 → `thirdnet-frontend:design-apple`
5. 技能规则加载完成后，进入阶段三

### 阶段三：开发执行

6. 按照「文档驱动开发」流程执行，严格按以下顺序：
   a. 编写项目级 `spec.md`（功能架构、技术栈、设计系统）
   b. 调用 `doc-templates` 技能，生成配套文件（changelog.md、viewer.html、marked.min.js）
   c. 为每个待实现的页面创建 `specs/{页面名}.md`（读取 `doc-templates` 的 `page-spec-template` 模板）
   d. 页面 spec 必须在对应 .vue 文件编码前完成
   e. 编码实现（代码必须与 spec 保持一致）
   f. 自查
7. 所有代码编写必须遵循阶段二中已加载的技能规则

### 阶段四：完成校验

8. 执行开发完成校验清单（见 agent 中的校验部分）

## 必须调用的技能（不可跳过）

代理执行任何代码编写前，必须通过 Skill 工具调用以下技能：

1. **所有 Vue 开发任务** → 调用 `thirdnet-frontend:vue-best-practices`
2. **API / Mock 模块开发** → 调用 `thirdnet-frontend:api-typescript-spec`
3. **Pinia 状态管理** → 调用 `thirdnet-frontend:vue-pinia-best-practices`
4. **Vue Router 路由** → 调用 `thirdnet-frontend:vue-router-best-practices`
5. **新建页面/功能** → 调用 `thirdnet-frontend:doc-templates`（先写 spec.md + 生成 changelog.md / viewer.html / marked.min.js 等配套文件，详见该技能"强制规则"）
6. **UI 设计 / 样式** → 调用 `thirdnet-frontend:design-apple`

## 必须遵循的约定

- API 模块采用接口契约策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`），与 Mock 数据（`mock/data/{endpoint}/*.ts`）文件名一致
- `MOCK_ENABLED` 开关控制帮助气泡显示与数据来源
- 文档驱动开发：先有项目级 spec.md，再为每个页面编写 specs/{页面名}.md，最后再编写代码
- 页面级 spec 不可跳过：任何 .vue 文件的编码前，对应的 specs/{页面名}.md 必须已存在

## 注意事项

- 确保项目已初始化前端框架
- 描述尽量具体，包含必要的功能点
- 如需特定样式或交互，请详细说明
- 遵循文档驱动开发：先有项目级 spec.md，再为每个页面编写 specs/{页面名}.md，最后再编写代码
- 设计或开发过程中，可使用 `/ui-ux-pro-max` 全局技能对页面进行优化
