---
name: frontend-workflow
description: >
  前端开发完整工作流程与规范。定义了文档驱动开发流程、技术栈版本、API 策略工厂架构、
  演示模式控制、项目目录结构、文档模板（spec/changelog/viewer）和开发完成校验清单。
  当执行前端开发任务时必须使用，尤其是：新建前端项目、创建页面规格、编写前端代码、
  生成 changelog/viewer、校验交付物。即使任务看起来简单，也需要遵循此工作流以保证
  代码与文档的一致性。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---
# 前端开发工作流

本技能定义了前端开发的完整工作流程、技术规范和交付标准。

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

### 新建项目时必须生成的文件

当创建新的前端项目时（Web 应用或小程序），以下文件不可跳过：

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

采用接口契约策略工厂模式，通过 `.env` 中 `VITE_MOCK` 无缝切换：

```
IXxxApi（接口契约）
├── RealXxxApi（HTTP 实现）
├── MockXxxApi（本地数据实现）
└── createXxxApi()（工厂函数，根据配置返回对应实例）
```

详细规则见 `api-typescript-spec` 技能。

## 演示模式

| 模式 | MOCK_ENABLED | 帮助气泡                         | 数据来源  |
| ---- | ------------ | -------------------------------- | --------- |
| 演示 | `true`     | 右上角显示                       | Mock 数据 |
| 生产 | `false`    | `v-if` 不渲染（禁 `v-show`） | 真实 API  |

每个页面右上角必须有 HelpBubble（问号图标），点击显示功能说明。

### HelpBubble 组件

**组件 Props**：
- `content: string` — 帮助内容（纯文本或 Markdown）
- `placement?: string` — 弹出位置（默认 `'bottom-end'`）

**Web 端实现**（Element Plus）：
- 使用 `ElPopover` + `ElIcon` + `QuestionFilled` 图标
- 添加 `v-if="MOCK_ENABLED"` 条件渲染

**移动端实现**（uni-app / Vant）：
- 使用 `van-popup` 或 `uni.showModal`
- 添加 `v-if="MOCK_ENABLED"` 条件渲染

## 项目特定规范

- **按钮防连续点击**：涉及 API 调用的按钮须有 Loading/防抖/禁用机制
- **并发错误去重**：多请求失败时错误提示只弹一次，禁止在 `Promise.all` catch 或独立 async catch 中各自弹出
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
- [ ] 涉及 API 调用的按钮有 Loading/防抖/禁用机制
- [ ] 多请求失败时错误提示只弹一次（并发错误去重）

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
