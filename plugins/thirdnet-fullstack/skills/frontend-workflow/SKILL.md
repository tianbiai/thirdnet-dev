---
name: frontend-workflow
description: >
  前端开发工作流程与规范：需求澄清、文档驱动（plan/changelog/spec）、演示模式控制、技术栈强制分工。
  微信小程序/C 端移动应用一律 uniapp + Vant（禁止原生小程序、Taro）；管理后台（Admin）与用户 Web 一律
  thirdnet Vue 栈（create-thirdnet-admin + Element Plus）；后端 .NET 由 backend-workflow 负责。
  当执行前端开发任务时必须使用，尤其是新建前端项目、创建页面规格、生成 changelog/viewer、校验交付物。
license: MIT
metadata:
  version: "2.7.0"
  author: thirdnet
---
# 前端开发工作流

本技能定义了前端开发的完整工作流程、技术规范和交付标准。

## 相关技能

涉及前后端协同时配合：`thirdnet-fullstack`（全栈协调：后端 DTO → 前端类型映射、RBAC 桥接、开发顺序）与 `thirdnet-fullstack:backend-workflow`（后端开发入口、`dotnet new thirdnet-admin` 创建后端项目）。

## 平台技术栈分工总则（强制）

**框架由平台决定，是固定映射，不进入需求澄清议题、不由代理或用户另行选型**：

| 目标平台                                   | 强制技术栈                                              | 创建方式                                                                                   |
| ------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 微信小程序 / C 端移动应用（H5 + 小程序双端） | **uniapp**（Vue 3.4 + Vite 5 + Pinia 2；组件库双端策略：H5 用 Vant 4、微信小程序用 @vant/weapp） | 按 [project-init](references/project-init.md) 用官方 `uni-preset-vue`（vite-ts）模板创建，禁止其他方案 |
| 管理后台 / 用户 Web（Admin）                | **thirdnet Vue 栈**（Vue 3.5 + Vite 8 + Element Plus）   | `admin-template-setup` 技能 + `create-thirdnet-admin` 模板安装，禁止手动搭建                 |
| 后端 API / 服务                             | **.NET 10 微服务**（thirdnet 模板）                      | `backend-workflow` 技能 + `dotnet new thirdnet-admin`，不属于前端技能范围                     |

**禁止项**：

- 小程序**禁止**使用原生微信小程序、Taro、mpvue、Remax 或任何非 uniapp 方案——代码必须同时编译 H5 与 `mp-weixin` 两个目标
- Admin / Web 工程**禁止** `npm create vite` 从零手动搭建——必须走 `create-thirdnet-admin` 模板
- 所有前端工程**禁止**引入本表之外的框架（React / Angular 等；3D 数字孪生场景的 Three.js 由 `thirdnet-fullstack:thirdnet-digital-twin` 技能豁免，仅经该技能引入）

## 工作流步骤概览

所有前端任务按以下顺序执行：

1. **需求澄清**（AskUserQuestion）—— 明确平台、范围、数据来源、交互流程

   > **例外：Admin 模板项目创建**（`create-thirdnet-admin`）跳过多轮澄清——模板功能固定，仅一次 AskUserQuestion 确认品牌参数。详见下文「需求澄清 → Admin 模板项目创建」。

> **说明**：`AskUserQuestion` 指 Claude Code Agent 内置的用户交互能力——通过向用户输出结构化问题列表（含选项）并等待回复来实现需求澄清。在 Claude Code 环境中直接使用 `AskUserQuestion` 工具，在其他环境中通过等价的用户提问机制实现。
2. **项目结构检查** —— 确认 frontend/ 目录和子系统布局
3. **调用路由技能** —— 根据技能路由表加载所有适用的编码规范
4. **文档先行** —— 生成/更新 changelog.md、spec.md、specs/{页面名}.md
5. **编码实现** —— 遵循技能规则和项目结构规范
6. **开发完成校验** —— 逐项检查流程合规、代码规范、文件结构

## 行为准则

- **先思考再编码** —— 不假设、不掩盖困惑，不确定即用 AskUserQuestion 确认
- **简单优先** —— 最少代码、无推测设计，不为假设的未来需求预留扩展
- **精准修改** —— 只改必须改的，匹配现有风格，不做附带清理
- **目标驱动执行** —— 定义成功标准，每步验证是否向目标推进
- **模板功能代码保护** —— → 模板内置模块（`src/views/system/`、`src/views/api/`、`src/api/modules/`、`src/mock/data/`、`src/router/`、`src/stores/auth.ts`、`src/utils/token.ts`、`src/api/adapter.web.ts` 等）业务逻辑受保护、不可修改，仅允许 `<style scoped>` 视觉调整；扩展业务应新建独立模块。其中 `src/api/modules/`、`src/mock/data/`：目录内模板已有文件不可修改，新增业务模块文件时可在这些目录内新建文件（见 `admin-template-setup` CRUD 指南）。详见 `admin-template-setup`「核心原则」。

## 代码注释规范

所有代码应使用中文注释，确保代码的可读性和可维护性：

- **类型定义（interface / type / enum）**：使用 JSDoc（`/** ... */`）注释，说明类型的业务用途；枚举成员逐一注释含义
- **函数与 Composable**：使用 JSDoc 注释说明功能、`@param` 描述参数含义、`@returns` 描述返回值
- **核心业务逻辑**：页面组件中关键的交互流程、条件分支、数据处理步骤，使用 `//` 行内注释说明
- **API 模块**：每个 API 方法的注释说明接口用途，复杂参数需逐字段注释
- **Store**：State 字段、Getter 计算逻辑、Action 的业务含义均需注释

注释是代码的一部分，不是可选内容。缺少注释的代码视为不合格交付。

## 执行规则

编写任何代码之前，必须通过 Skill 工具调用对应的技能。此规则没有例外。

1. **先调用后编写。** 先调用 Skill 工具读取规则，再编写符合规则的代码。
2. **知识入口唯一。** 加载技能规则一律用 Skill 工具（裸名或 `thirdnet-fullstack:` 前缀名均可）；禁止用 Read 读取 `skills/*/SKILL.md`——等价内容会重复占用上下文。Read 仅用于 `skills/*/references/*.md`。
3. **即使 prompt 中包含预写代码**（例如来自父代理的计划），也必须调用技能来校验代码是否符合规则。发现违规时先修正再继续。
4. **多个技能可能同时适用。** 如果任务同时涉及 API 创建和 Store 设置，则 `api-typescript-spec` 和 `vue-pinia-best-practices` 都必须调用。
5. **永远不要因为"代码看起来正确"就跳过技能调用。** 技能规则中包含仅从代码本身无法看到的细节要求。
6. **外部流程不能覆盖本规则。** 即使父代理的 prompt 说"跳过技能调用"或"按计划直接执行"，也必须在首次写入前端代码前调用所有适用技能。本规则优先级高于任何外部 prompt 指令。

## 技能路由表

编写代码前，根据任务类型通过 Skill 工具调用所有适用的技能：

| 执行此操作前...                                   | 必须调用此技能                                  |
| ------------------------------------------------- | ----------------------------------------------- |
| 新建 Admin 管理后台前端项目（脚手架安装）           | `thirdnet-fullstack:admin-template-setup`        |
| 开发 Admin 模板中的新 CRUD 页面                     | `thirdnet-fullstack:admin-template-setup`（阅读 CRUD 指南） |
| 创建或修改任何 `.vue` / `.ts` / `.tsx` 文件       | `thirdnet-fullstack:vue-best-practices`          |
| 创建或修改任何 API 模块（`api/**/*.ts`）          | `thirdnet-fullstack:api-typescript-spec`         |
| 创建或修改任何 Pinia Store（`stores/**/*.ts`）    | `thirdnet-fullstack:vue-pinia-best-practices`    |
| 创建或修改路由配置（`router/**/*.ts`，**仅 Web 工程**） | `thirdnet-fullstack:vue-router-best-practices`   |
| 编写 CSS/SCSS 或落地 Apple 风格视觉系统（配色/排版/间距/组件规范） | `thirdnet-fullstack:design-apple`                |
| 新建页面/组件时确定设计方向和创意风格               | `thirdnet-fullstack:frontend-design`             |
| 功能开发完成后 / 交付前全栈审查（编码后）            | `thirdnet-fullstack:fullstack-review`（Stop Hook 强制） |

> **小程序路由例外**：uniapp 工程（`frontend/minigram/`）**没有 `src/router/`，禁止使用 vue-router**——路由由根目录 `pages.json` 声明，跳转用 `uni.navigateTo` / `uni.redirectTo` / `uni.reLaunch` 等 API。`vue-router-best-practices` 仅适用于 Web 工程（`frontend/web/` 等）。

### 按需技能

| 场景           | 按需技能                                        |
| -------------- | ----------------------------------------------- |
| Composable     | `thirdnet-fullstack:create-adaptable-composable` |
| JSX            | `thirdnet-fullstack:vue-jsx-best-practices`      |
| 枚举字典 / 自定义字典 / 下拉选项 / `*_label` | `thirdnet-fullstack:vue-enum-dict` |

### 技能调用检查清单

编码前必须逐项确认：

- [ ] 涉及 `.vue` / `.ts` 文件 → 已调用 `vue-best-practices`
- [ ] 涉及 `api/` 或 `mock/` 文件 → 已调用 `api-typescript-spec`
- [ ] 涉及下拉选项 / 字典字段（`*_label`、`useDict`、`getDictDataByType`）→ 已调用 `vue-enum-dict`
- [ ] 涉及 `stores/` 文件 → 已调用 `vue-pinia-best-practices`
- [ ] 涉及 `router/` 文件 → 已调用 `vue-router-best-practices`（仅 Web 工程；uniapp 工程无 `router/`，路由走 `pages.json`）
- [ ] 涉及样式/CSS → 已调用 `design-apple`
- [ ] 新建页面/组件（涉及设计方向决策）→ 已调用 `frontend-design`
- [ ] 以上所有适用项勾选后，方可开始编码

## 需求澄清

### Admin 模板项目创建 —— 直接跳过

如果当前任务为**创建 Admin 管理后台前端项目**（用户明确提出"创建 admin 前端"、"新建管理后台"、"create-thirdnet-admin"等），**直接跳过本节后续的多轮澄清流程**。原因：Admin 前端模板已内置完整的系统管理、API 管理和认证授权功能（19 个 API 模块，页面清单见 `admin-template-setup`），功能范围固定不变，无需确认。

**替代操作**：使用一次 `AskUserQuestion` 仅确认品牌参数（项目名称、`--brand` 品牌名称、`--initial` 首字母、`--abbr` 缩写，均可使用默认值）。后端 API 地址使用默认 `http://localhost:5000`，无需确认。

确认后直接按 [project-init](references/project-init.md) 中的 Admin 路径，调用 `admin-template-setup` 技能执行安装。

**此例外不适用于以下场景**（这些场景仍须执行完整澄清流程）：
- 在已有 Admin 项目上新增业务页面或模块
- 创建用户端/小程序项目
- 修改或扩展现有项目的功能

### 新功能/新页面需求 —— 必须澄清

当用户提出新功能或页面需求时（非 Admin 模板项目创建），**禁止直接进入编码**，必须先明确需求和功能细节。

**判断标准：** 如果无法直接写出完整的 spec.md（功能范围、交互流程、UI 结构、数据来源均已明确），则需要澄清。

### 澄清规则

1. **必须使用 `AskUserQuestion` 工具提问，禁止以纯文字形式输出问题。**
2. 每次 AskUserQuestion 调用最多 4 个问题，每个问题提供 2-4 个选项。
3. 按以下优先级逐轮澄清：

| 轮次 | 优先级     | 问题示例                      |
| ---- | ---------- | ----------------------------- |
| 1    | 平台与范围 | 目标平台？包含哪些页面/功能？ |
| 2    | 数据与交互 | 数据来源？核心交互流程？      |
| 3    | 设计风格   | 有设计稿？参考风格？          |

4. 进行多轮提问，直到所有需求和功能均已明确。
5. **即使你认为已经理解需求，也至少调用一次 AskUserQuestion 确认平台和范围。**（Admin 模板项目创建除外——该场景使用上述简化的一次性品牌参数确认即可）
6. **框架选型不在澄清范围内**：平台确认后，框架即由「平台技术栈分工总则」锁定（微信小程序/C 端移动 → uniapp + Vant）。第 1 轮澄清平台后，直接向用户**声明**将采用的固定框架，不要把"原生小程序 / Taro / 其他框架"作为选项提供；仅当用户明确反对该总则时才升级讨论。

## 项目结构检查

在开始任何前端开发任务前，先执行项目结构检查。根据检查结果决定后续流程：

### 检查步骤

1. **检查 `frontend/` 目录是否存在**：
   - 不存在 + 新建项目 → 读取 [project-init](references/project-init.md) 执行初始化
   - 不存在 + 修改现有代码 → 使用 AskUserQuestion 确认项目位置

2. **检查根目录是否有零散的前端项目文件**（如 `package.json`、`vite.config.ts`、`src/` 等直接出现在工作区根目录）：
   - 如果存在零散文件，使用 AskUserQuestion 确认：是整合到 `frontend/` 目录结构中，还是在当前位置继续工作

3. **确认目标子系统目录**（如 `frontend/web/`、`frontend/minigram/`）是否存在
   - 管理后台工程由模板安装命令创建（须在 `frontend/` 目录内执行、项目名传 `web`，见 `admin-template-setup` 落点约束），不要再手动预建 `frontend/web` 空目录再往里装

## 文档驱动开发

所有前端开发遵循严格的文档先行流程：

```
需求分析 → changelog.md → spec.md → specs/{页面名}.md → 编码 → 校验
```

### 强制规则

1. **编码前必须先生成子项目级 spec.md** — 覆盖功能架构、技术栈、设计系统
2. **每个页面的编码前，`specs/{页面名}.md` 必须存在且已完整阅读**
3. **批量页面实现时**：先为所有页面创建 specs，再逐页编码（不要边写 spec 边编码）
4. **代码必须与 spec 保持一致**；大变更须更新 changelog.md
5. **需求变更时先更新 spec 再改代码** — 修改页面功能/交互时，先更新对应 `specs/{页面名}.md`；涉及业务流程、架构或跨页面变更时，同步更新子项目级 spec.md
6. **spec 不存在 → 停止 → 先生成规格文档**

### 新建项目初始化流程

**前置判断**：管理后台 Web（Admin）→ 调用 `thirdnet-fullstack:admin-template-setup` 技能用 `create-thirdnet-admin` 创建（在 `frontend/` 目录内执行、项目名传 `web`），**禁止手动搭建**；用户端 / 小程序 → **强制 uniapp + Vant**（见「平台技术栈分工总则」），按手动初始化步骤创建（官方 `uni-preset-vue#vite-ts` 模板，**禁止 `npm create vite` 改造**）。

完整分步命令、强制文件三件套（changelog.md / viewer.html / marked.min.js，Web 在 `public/`、小程序在 `src/static/`）与页面 specs 生成顺序，见 [project-init](references/project-init.md)（用 Read 打开）。

**关键**：初始化步骤全部完成前，禁止编写任何业务代码；`frontend/` 目录必须第一步创建，不可延后。

### 页面规格文档

每个页面对应一个 `specs/{页面名}.md`，与 `.vue` 文件一一对应：

1. 读取 [page-spec-template](references/page-spec-template.md) 模板
2. 为每个页面创建 spec，填写：业务目标、功能清单、API 接口、组件架构
3. 所有页面 spec 完成后，才能开始编码

## 模板文件索引与技术栈

- **版本原则**：使用稳定生产版本（非 RC/beta/alpha），优先 LTS；**TypeScript 强制**——所有代码 `.ts` 扩展名 + `<script setup lang="ts">`，禁止 `.js`
- **Pinia 版本**：Vue 3.5+ / Vite 8+ 项目用 Pinia 3.x；Vue 3.4 / uniapp 项目用 Pinia 2.x
- **移动端锁定**：微信小程序一律 uniapp（禁止原生小程序 / Taro / mpvue），开发用 H5 模式、发布 `mp-weixin`，代码须双端兼容
- 完整版本矩阵、组件双端策略（Vant 4 仅 H5、`@vant/weapp` 仅 mp-weixin + easycom 规则）、文档模板索引（project-spec / page-spec / changelog / markdown-viewer / marked-js / SFC 重构六模板）见 [tech-stack-and-templates](references/tech-stack-and-templates.md)（用 Read 打开）

## 演示模式与生产剥离

`VITE_MOCK_ENABLED` 控制开发/演示模式（`true`=演示走 Mock、`false`=生产走真实 API）；生产构建经 `mockDataStripPlugin` + tree-shaking 自动剥离 Mock。每个页面右上角必须有 HelpBubble（Web 用 `ElPopover`/`QuestionFilled`，移动端用 `uni.showModal` 跨端实现），用 `v-if="MOCK_ENABLED"` 而非 `v-show`；辅助文案须用 `MOCK_ENABLED` 条件守卫让生产构建彻底移除（不能仅靠 `v-if`）。Admin 模板项目例外：使用单一 `.env` 文件，详见 `admin-template-setup`。

> 完整 `mockDataStripPlugin` 源码、tree-shaking 原理与文案剥离代码示例见 `api-typescript-spec` 的 [mock-stripping.md](../api-typescript-spec/references/mock-stripping.md)。

## 项目特定规范

### 按钮防重复点击

> **Admin 模板项目优先**：CRUD 页面用 `useCrudTable`，操作锁用 `useActionLoading`（`isLoading` / `isAnyLoading` / `withLoading`），禁止手写样板。详见 `admin-template-setup`。下方手动模式适用于非 Admin 模板项目或 Admin 中非 CRUD 场景。

所有可交互按钮必须具备防重复点击机制：

- **API 调用按钮（表单提交/删除确认等）** → Loading + disabled（点击即 disable，`try/finally` 恢复，`loading`/`disabled` 绑同一变量）—— Web 用 `:loading`/`:disabled`，移动端 Vant 同理可加 `loading-text`
- **搜索输入/筛选切换** → 防抖 Debounce（300-500ms）
- **导出/下载、纯前端 Tab 切换** → 节流 Throttle（300-1000ms）

强制规则：涉及 API 调用的按钮必须用 Loading + disabled，禁止仅靠防抖/节流替代，禁止在点击回调中不做任何保护直接调用 async 函数。

### 并发错误去重

- 多请求失败时错误提示只弹一次，禁止在 `Promise.all` catch 或独立 async catch 中各自弹出
- **移动端兼容**：使用 `uni.xxx` 替代 `window`/`document`，禁止 DOM 操作，H5 专有功能用 `#ifdef H5` 条件编译

### 错误处理

| 场景             | 处理方式           |
| ---------------- | ------------------ |
| 技能文档不存在   | 停止，提示用户检查技能插件安装 |
| 参考文档不存在   | 继续工作，记录警告 |
| spec.md 无法创建 | 询问用户           |
| 设计需求不明确   | AskUserQuestion    |

## 项目结构

前端项目统一在工作区根 `frontend/` 下，**按工程分端**：`frontend/web/`（Web，Element Plus）与 `frontend/minigram/`（小程序，uniapp 强制）。工程内 `src/` 扁平组织：`api/`（types/ + interfaces/ + modules/ + adapter + request）、`mock/`（api/ + data/，与 API 模块一一对应）、`stores/`、`router/`（**仅 Web 工程**——uniapp 无 vue-router，路由在 `src/pages.json`）、`views/`（Web）或 `pages/`（移动端）、`components/`、`composables/`、`styles/`；changelog 三件套 Web 放 `public/`、小程序放 `src/static/`。

完整目录树与结构适配规则（保留内部目录模式、任何结构偏差记录进 spec.md）见 [project-structure](references/project-structure.md)（用 Read 打开）。

## 开发完成校验

编码完成后，交付前必须逐项检查。每一项对应一条已建立的规则。

### 流程合规

- [ ] spec.md 已生成且内容与实际代码一致
- [ ] changelog.md 已记录本次变更
- [ ] 涉及的页面均有对应的 `specs/{页面名}.md`
- [ ] 编码前已调用所有相关技能
- [ ] 未修改模板内置模块的业务逻辑代码（admin 模板项目：system/、api/ 视图的 script 逻辑及对应 API/Mock 文件保持原样）

### 代码规范

- [ ] 所有文件使用 TypeScript（`.ts` / `<script setup lang="ts">`），无 `.js` 文件
- [ ] 枚举使用 `enum` 关键字 + JSDoc，无 union type 或 const object
- [ ] API 模块遵循策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`）
- [ ] 每个页面右上角有 HelpBubble，使用 `v-if` 而非 `v-show`
- [ ] 开发辅助文案（HelpBubble content、操作提示等）使用 `MOCK_ENABLED` 守卫，生产构建不含这些字符串
- [ ] 所有可交互按钮具备防重复点击机制（API 按钮：Loading + disabled；其他：防抖/节流）
- [ ] API 调用按钮使用 `try/finally` 确保 loading 状态恢复
- [ ] 多请求失败时错误提示只弹一次（并发错误去重）
- [ ] 类型定义、函数有 JSDoc 中文注释
- [ ] 核心业务逻辑有中文行内注释
- [ ] API 方法和 Store State/Action 有注释说明
- [ ] Admin 模板项目：CRUD 页面使用了 useCrudTable 而非手写分页/搜索/删除样板（非 CRUD 页面除外）
- [ ] Admin 模板项目：弹窗使用了 useDialogFocus 焦点管理
- [ ] Admin 模板项目：表单验证使用了 validators.ts 规则工厂（有匹配规则时）

### 移动端额外检查（仅 minigram / uniapp 项目）

- [ ] **工程骨架校验（硬门槛）**：`src/manifest.json` 与 `src/pages.json` 存在（uni-preset-vue Vite 模板默认在 `src/` 下；若为团队私有模板放项目根亦可，二者其一），且 `package.json` 含 `@dcloudio/uni-app` 依赖——缺任一项说明初始化未走 uniapp 模板，**停止交付，按 [project-init](references/project-init.md) 用 uni-preset-vue 模板重建**
- [ ] 未使用 vue-router（uniapp 路由走 `pages.json` + `uni.navigateTo` / `uni.reLaunch`）
- [ ] 使用 `uni.xxx` 替代 `window`/`document`，无直接 DOM 操作
- [ ] H5 专有功能使用 `#ifdef H5` 条件编译

### 文件结构

- [ ] 页面组件在 `src/views/`（Web）或 `src/pages/`（移动端）
- [ ] API 模块在 `src/api/modules/` 下扁平组织（前端按工程分端，工程内不按端分组）
- [ ] Mock 数据在 `src/mock/data/` 下与 API 模块一一对应
- [ ] Store 在 `src/stores/`；路由在 `src/router/`（仅 Web 工程——uniapp 工程路由在根 `pages.json`）

**发现不合规项时，先修正再交付，不要遗留问题。**

> **交付前最后一步（全栈审查）**：完成上述自检后，调用 `thirdnet-fullstack:fullstack-review` 对本次变更做一次全栈代码审查——覆盖前端规范、后端规范、跨端契约一致性（类型映射 / 权限串 / URL 约定）、业务正确性、性能、安全、文档，产出 `review-report.md`（问题清单 + 严重级别 + 修改方案）。本插件 Stop Hook 会在存在未审查或仍有 Critical/Major 的功能性变更时强制阻断完成。

### E2E 测试参考

参考仓库 `code/frontend/e2e-tests/` 包含 48 个 Playwright E2E 测试，覆盖 Admin 模板全部主要模块。新增业务页面后可参照其模式编写对应测试。完整 18 个测试目录索引见 [e2e-test-index](references/e2e-test-index.md)。
