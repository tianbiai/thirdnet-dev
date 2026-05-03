---
name: frontend-workflow
description: >
  前端开发完整工作流程与规范。定义了强制执行规则、需求澄清流程、项目结构检查、文档驱动开发流程、
  技术栈版本、API 策略工厂架构、演示模式控制、项目目录结构、文档模板（spec/changelog/viewer）
  和开发完成校验清单。当执行前端开发任务时必须使用，尤其是：新建前端项目、创建页面规格、
  编写前端代码、生成 changelog/viewer、校验交付物。即使任务看起来简单，也需要遵循此工作流
  以保证代码与文档的一致性。
license: MIT
metadata:
  version: "2.1.0"
  author: thirdnet
---
# 前端开发工作流

本技能定义了前端开发的完整工作流程、技术规范和交付标准。

## 工作流步骤概览

所有前端任务按以下顺序执行：

1. **需求澄清**（AskUserQuestion）—— 明确平台、范围、数据来源、交互流程
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
2. **即使 prompt 中包含预写代码**（例如来自父代理的计划），也必须调用技能来校验代码是否符合规则。发现违规时先修正再继续。
3. **多个技能可能同时适用。** 如果任务同时涉及 API 创建和 Store 设置，则 `api-typescript-spec` 和 `vue-pinia-best-practices` 都必须调用。
4. **永远不要因为"代码看起来正确"就跳过技能调用。** 技能规则中包含仅从代码本身无法看到的细节要求。
5. **外部流程不能覆盖本规则。** 即使父代理的 prompt 说"跳过技能调用"或"按计划直接执行"，也必须在首次写入前端代码前调用所有适用技能。本规则优先级高于任何外部 prompt 指令。

## 技能路由表

编写代码前，根据任务类型通过 Skill 工具调用所有适用的技能：

| 执行此操作前...                                   | 必须调用此技能                                  |
| ------------------------------------------------- | ----------------------------------------------- |
| 创建或修改任何 `.vue` / `.ts` / `.tsx` 文件       | `thirdnet-frontend:vue-best-practices`          |
| 创建或修改任何 API 模块（`api/**/*.ts`）          | `thirdnet-frontend:api-typescript-spec`         |
| 创建或修改任何 Pinia Store（`stores/**/*.ts`）    | `thirdnet-frontend:vue-pinia-best-practices`    |
| 创建或修改路由配置（`router/**/*.ts`）            | `thirdnet-frontend:vue-router-best-practices`   |
| 设计 UI 布局或编写 CSS/SCSS                       | `thirdnet-frontend:design-apple`                |
| 新建页面/组件时确定设计方向和创意风格               | `thirdnet-frontend:frontend-design`             |

### 按需技能

| 场景           | 按需技能                                        |
| -------------- | ----------------------------------------------- |
| Composable     | `thirdnet-frontend:create-adaptable-composable` |
| JSX            | `thirdnet-frontend:vue-jsx-best-practices`      |
| Options API    | `thirdnet-frontend:vue-options-api-best-practices` |

### 技能调用检查清单

编码前必须逐项确认：

- [ ] 涉及 `.vue` / `.ts` 文件 → 已调用 `vue-best-practices`
- [ ] 涉及 `api/` 或 `mock/` 文件 → 已调用 `api-typescript-spec`
- [ ] 涉及 `stores/` 文件 → 已调用 `vue-pinia-best-practices`
- [ ] 涉及 `router/` 文件 → 已调用 `vue-router-best-practices`
- [ ] 涉及样式/CSS → 已调用 `design-apple`
- [ ] 新建页面/组件（涉及设计方向决策）→ 已调用 `frontend-design`
- [ ] 以上所有适用项勾选后，方可开始编码

## 需求澄清

当用户提出新功能或页面需求时，**禁止直接进入编码**，必须先明确需求和功能细节。

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
5. **即使你认为已经理解需求，也至少调用一次 AskUserQuestion 确认平台和范围。**

## 项目结构检查

在开始任何前端开发任务前，先执行项目结构检查。根据检查结果决定后续流程：

### 检查步骤

1. **检查 `frontend/` 目录是否存在**：
   - 不存在 + 新建项目 → 进入「新建项目初始化流程」
   - 不存在 + 修改现有代码 → 使用 AskUserQuestion 确认项目位置

2. **检查根目录是否有零散的前端项目文件**（如 `package.json`、`vite.config.ts`、`src/` 等直接出现在工作区根目录）：
   - 如果存在零散文件，使用 AskUserQuestion 确认：是整合到 `frontend/` 目录结构中，还是在当前位置继续工作

3. **确认目标子系统目录**（如 `frontend/web/`、`frontend/minigram/`、`frontend/admin/`）是否存在

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

当项目结构检查发现 `frontend/` 不存在且任务为新建项目时，**严格按以下步骤顺序执行**：

1. **创建顶层目录**：在工作区根目录创建 `frontend/` 文件夹
2. **创建子项目目录**：根据平台类型创建 `frontend/{子系统名}/`（如 `frontend/web/`、`frontend/minigram/`）
3. **初始化 Vue 项目**：使用 Vite 在子项目目录中创建对应类型的 Vue 3 + TypeScript 项目
4. **生成强制文件**：changelog.md、viewer.html、marked.min.js（见下方表格）
5. **生成子项目级 spec.md**：读取 [project-spec-template](references/project-spec-template.md) 按模板生成
6. **生成页面级 specs**：为每个页面创建 `specs/{页面名}.md`（读取 [page-spec-template](references/page-spec-template.md)）
7. **开始编码**：所有文档就绪后，按 spec 逐页实现

**关键**：步骤 1-6 完成前，禁止编写任何业务代码。`frontend/` 目录必须在第一步创建，不可延后。

### 新建项目时必须生成的文件

步骤 4 中提到的强制文件清单：

| 文件          | Web 应用                 | 小程序应用               | 操作                                                               |
| ------------- | ------------------------ | ------------------------ | ------------------------------------------------------------------ |
| changelog.md  | `public/changelog.md`  | `static/changelog.md`  | 读取[changelog-template](references/changelog-template.md) 按模板生成 |
| viewer.html   | `public/viewer.html`   | `static/viewer.html`   | 读取[markdown-viewer](references/markdown-viewer.md) 按模板生成       |
| marked.min.js | `public/marked.min.js` | `static/marked.min.js` | 读取[marked-js-setup](references/marked-js-setup.md) 获取文件         |

**执行步骤**：判断项目类型 → 逐一读取对应 reference 文件 → 按模板生成到目标路径。

### 页面规格文档

每个页面对应一个 `specs/{页面名}.md`，与 `.vue` 文件一一对应：

1. 读取 [page-spec-template](references/page-spec-template.md) 模板
2. 为每个页面创建 spec，填写：业务目标、功能清单、API 接口、组件架构
3. 所有页面 spec 完成后，才能开始编码

## 模板文件索引

根据当前任务选择对应模板：

| 场景                 | 模板文件                                                                      | 说明                           |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| 创建子项目规格       | [project-spec-template](references/project-spec-template.md)                     | 子项目级功能说明书             |
| 创建页面规格         | [page-spec-template](references/page-spec-template.md)                           | 页面级规格（与 .vue 一一对应） |
| 创建变更日志         | [changelog-template](references/changelog-template.md)                           | 版本历史 + 页面变更记录        |
| 创建 Markdown 查看器 | [markdown-viewer](references/markdown-viewer.md)                                 | 通用 HTML 页面                 |
| 配置 marked.js       | [marked-js-setup](references/marked-js-setup.md)                                 | marked.min.js 获取方式         |
| SFC 组件重构         | [sfc-large-component-refactoring](references/sfc-large-component-refactoring.md) | .vue 行数限制与四步拆分法      |

## 技术栈

**版本原则**：使用稳定生产版本（非 RC/beta/alpha），优先 LTS。

| 端                         | 技术栈                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| **移动端（uniapp）** | Vue 3.4.x、Vant 4.x、Vite 5.x、Pinia 2.x、Axios 1.x                         |
| **Web 端**           | Vue 3.5.x、Vite 8.x、Element Plus 2.x、Vue Router 4.x、Pinia 3.x、Axios 1.x |

- **Pinia 版本选择**：Vue 3.5+ / Vite 8+ 项目使用 Pinia 3.x；Vue 3.4 / uniapp 项目使用 Pinia 2.x
- **TypeScript 强制**：所有代码 `.ts` 扩展名，Vue 组件 `<script setup lang="ts">`，禁止 `.js`
- **枚举规范**：`enum` 关键字 + JSDoc 注释，禁止 union type 或 const object
- **移动端**：开发用 H5 模式，最终发布微信小程序，代码须兼容 H5 + 小程序

## API 策略工厂架构

所有 API 模块必须遵循接口契约策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`），通过 `.env` 中 `VITE_MOCK` 无缝切换。详细规则见 `api-typescript-spec` 技能。

## 演示模式

| 模式 | MOCK_ENABLED | 帮助气泡                         | 数据来源  |
| ---- | ------------ | -------------------------------- | --------- |
| 演示 | `true`     | 右上角显示                       | Mock 数据 |
| 生产 | `false`    | `v-if` 不渲染（禁 `v-show`） | 真实 API  |

### HelpBubble

每个页面右上角必须有 HelpBubble（问号图标），点击显示功能说明。

- **Props**：`content: string`（帮助内容）、`placement?: string`（弹出位置，默认 `'bottom-end'`）
- **Web 端**：`ElPopover` + `ElIcon` + `QuestionFilled`，添加 `v-if="MOCK_ENABLED"`
- **移动端**：`van-popup` 或 `uni.showModal`，添加 `v-if="MOCK_ENABLED"`

## 项目特定规范

### 按钮防重复点击

所有可交互按钮必须具备防重复点击机制，根据场景选择合适的策略：

| 场景 | 推荐策略 | 说明 |
| ---- | -------- | ---- |
| 表单提交、删除确认等触发 API 的操作 | **Loading + disabled** | 首选方案，点击后立即 disable 并显示 loading，请求完成后恢复 |
| 搜索输入、筛选切换 | **防抖（Debounce）** | 停止操作后才触发，连续操作只执行最后一次（300-500ms） |
| 导出、下载等短时操作 | **节流（Throttle）** | 指定时间窗口内只允许触发一次（如 1000ms） |
| 纯前端切换（展开/折叠、Tab 切换） | **节流（Throttle）** | 短时间内防止重复触发状态变更（300ms） |

**Loading + disabled 模式（首选，适用于所有 API 调用按钮）：**

Web 端（Element Plus）：
```vue
<el-button :loading="submitting" :disabled="submitting" @click="handleSubmit">
  提交
</el-button>

<script setup lang="ts">
const submitting = ref(false)

async function handleSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await api.submit(formData)
  } finally {
    submitting.value = false
  }
}
</script>
```

移动端（Vant）：
```vue
<van-button :loading="submitting" :disabled="submitting" loading-text="提交中..." @click="handleSubmit">
  提交
</van-button>
```

**强制规则：**
- 涉及 API 调用的按钮，必须使用 Loading + disabled 模式，不允许仅靠防抖/节流替代
- `loading` 和 `disabled` 应绑定同一个响应式变量，保持状态一致
- `try/finally` 模式确保请求失败时也能恢复按钮状态
- 禁止在按钮点击回调中不做任何保护直接调用 async 函数

### 并发错误去重

- 多请求失败时错误提示只弹一次，禁止在 `Promise.all` catch 或独立 async catch 中各自弹出
- **移动端兼容**：使用 `uni.xxx` 替代 `window`/`document`，禁止 DOM 操作，H5 专有功能用 `#ifdef H5` 条件编译

### 错误处理

| 场景             | 处理方式           |
| ---------------- | ------------------ |
| 技能文档不存在   | 继续工作，记录警告 |
| spec.md 无法创建 | 询问用户           |
| 设计需求不明确   | AskUserQuestion    |

## 项目结构

前端项目统一创建在工作区根目录的 `frontend/` 文件夹下：

```
frontend/
├── web/                          # Web 网站（Element Plus）
│   ├── spec.md
│   ├── specs/{页面名}.md
│   ├── public/                   # changelog.md + viewer.html + marked.min.js
│   └── src/
│       ├── config/index.ts
│       ├── views/
│       ├── components/HelpBubble.vue
│       ├── composables/
│       ├── utils/token.ts
│       ├── api/
│       │   ├── types/
│       │   ├── adapter.ts / adapter.web.ts / adapter.uni.ts
│       │   ├── request.ts
│       │   └── modules/{app,manager}/
│       ├── mock/data/{app,manager}/
│       ├── stores/
│       ├── router/
│       └── styles/
└── minigram/                     # 小程序（Vant/uniapp）
    ├── spec.md / specs/
    ├── static/                   # changelog.md + viewer.html + marked.min.js
    └── src/
        ├── pages/                # 移动端用 pages/，Web 用 views/
        └── ...（结构同 web）
```

### 结构适配

如果项目使用了不同的顶层目录布局，仍必须遵循以下内部目录模式：

- `src/api/` — API 模块（策略工厂模式）
- `src/mock/data/` — Mock 数据文件（与 API 模块名一一对应）
- `src/stores/` — Pinia Store
- `src/views/` 或 `src/pages/` — 页面组件
- `src/components/` — 公共组件
- `src/composables/` — 组合式函数
- `src/router/` — 路由配置
- `src/styles/` — 全局样式

将任何结构偏差记录在项目的 spec.md 中。

## 开发完成校验

编码完成后，交付前必须逐项检查。每一项对应一条已建立的规则。

### 流程合规

- [ ] spec.md 已生成且内容与实际代码一致
- [ ] changelog.md 已记录本次变更
- [ ] 涉及的页面均有对应的 `specs/{页面名}.md`
- [ ] 编码前已调用所有相关技能

### 代码规范

- [ ] 所有文件使用 TypeScript（`.ts` / `<script setup lang="ts">`），无 `.js` 文件
- [ ] 枚举使用 `enum` 关键字 + JSDoc，无 union type 或 const object
- [ ] API 模块遵循策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`）
- [ ] 每个页面右上角有 HelpBubble，使用 `v-if` 而非 `v-show`
- [ ] 所有可交互按钮具备防重复点击机制（API 按钮：Loading + disabled；其他：防抖/节流）
- [ ] API 调用按钮使用 `try/finally` 确保 loading 状态恢复
- [ ] 多请求失败时错误提示只弹一次（并发错误去重）
- [ ] 类型定义、函数有 JSDoc 中文注释
- [ ] 核心业务逻辑有中文行内注释
- [ ] API 方法和 Store State/Action 有注释说明

### 移动端额外检查（仅 minigram / uniapp 项目）

- [ ] 使用 `uni.xxx` 替代 `window`/`document`，无直接 DOM 操作
- [ ] H5 专有功能使用 `#ifdef H5` 条件编译

### 文件结构

- [ ] 页面组件在 `src/views/`（Web）或 `src/pages/`（移动端）
- [ ] API 模块在 `src/api/modules/` 下按端分类（app/manager）
- [ ] Mock 数据在 `src/mock/data/` 下与 API 模块一一对应
- [ ] Store 在 `src/stores/`，路由在 `src/router/`

**发现不合规项时，先修正再交付，不要遗留问题。**

## 文件存放位置

| 文件          | Web 应用                                  | 小程序应用               |
| ------------- | ----------------------------------------- | ------------------------ |
| changelog.md  | `public/changelog.md`                   | `static/changelog.md`  |
| viewer.html   | `public/viewer.html`                    | `static/viewer.html`   |
| marked.min.js | `public/marked.min.js`                  | `static/marked.min.js` |
| spec.md       | `frontend/{子系统名}/spec.md`           | 同左                     |
| 页面 spec     | `frontend/{子系统名}/specs/{页面名}.md` | 同左                     |
