# 新建项目初始化流程（project-init）

> 本文件是 `frontend-workflow` 技能的初始化执行参考：`frontend/` 不存在且任务为新建项目时用 Read 打开，按步骤执行。核心规则（强制 uniapp、禁止手动搭建 Admin、步骤完成前禁写业务代码）以 SKILL.md 为准。

**前置判断——按项目类型选择初始化路径**：

| 项目类型 | 初始化方式 | 说明 |
|----------|-----------|------|
| 管理后台 Web（Admin） | **调用 `admin-template-setup` 技能**，使用 `npm exec --registry <NPM_REGISTRY> -- create-thirdnet-admin` 创建（在 `frontend/` 目录内执行、项目名传 `web`；registry 地址唯一来源见 backend-workflow 的 [internal-registry](../../backend-workflow/references/internal-registry.md)，默认内网） | 模板已实现完整后台功能（用户/角色/菜单/权限等），采用真实 API + Mock 数据并行模式，禁止手动搭建 |
| 用户端 / 小程序（Client / Minigram） | 继续执行以下手动初始化步骤 | **强制 uniapp + Vant**（见 SKILL.md「平台技术栈分工总则」），面向 C 端用户的移动端项目（H5 + 微信小程序双端编译） |

**判断依据**：如果项目需要登录认证、RBAC 权限管理、后台菜单管理等管理后台特征，则为 Admin 类型；面向终端用户的移动应用（无论 H5 还是小程序）均为用户端，**框架锁定 uniapp，禁止原生小程序 / Taro / mpvue 等任何其他方案**。API 后端一律 .NET 栈，由 `backend-workflow` 负责，不在前端初始化范围内。

当项目结构检查发现 `frontend/` 不存在且任务为新建项目时，**严格按以下步骤顺序执行**：

1. **创建顶层目录**：在工作区根目录创建 `frontend/` 文件夹
2. **创建子项目目录**：根据平台类型创建 `frontend/{子系统名}/`（如 `frontend/minigram/`；Admin 工程除外——`frontend/web/` 由 `create-thirdnet-admin` 模板命令在 `frontend/` 目录内以项目名 `web` 创建，勿预建空目录，见 `admin-template-setup` 落点约束）
3. **初始化项目（按平台执行对应命令，禁止通用 Vite 脚手架创建小程序工程）**：
   - **Admin / Web 工程（`frontend/web/`）**：本手动流程不适用——改走 `admin-template-setup` 技能用 `create-thirdnet-admin` 模板安装（在 `frontend/` 目录内执行、项目名传 `web`）
   - **小程序 / 用户端工程（`frontend/minigram/`）**：使用 uniapp 官方 Vite + TS 模板创建：`npx degit dcloudio/uni-preset-vue#vite-ts frontend/minigram`（degit 不可达时退回 `git clone -b vite-ts https://github.com/dcloudio/uni-preset-vue.git frontend/minigram`；团队若有私有 uniapp 模板则优先使用）。**注意：该模板产物把 `manifest.json`/`pages.json`/`static/`/`pages/` 放在 `src/` 目录下**。创建后进入目录 `npm install`，再按双端组件策略安装组件库——H5 端：`npm i vant`；微信小程序端：`npm i @vant/weapp -S --production` 并在 `src/pages.json` 配置 easycom 规则 `"^van-(.*)": "@vant/weapp/lib/$1/index"`（Vant 4 仅支持 H5，无法编译进小程序，详见 [tech-stack-and-templates](tech-stack-and-templates.md)「组件双端策略」）。**禁止** `npm create vite` 创建普通 Vue 工程再改造为小程序
4. **生成强制文件**：changelog.md、viewer.html、marked.min.js（见下方表格）
5. **生成子项目级 spec.md**：读取 [project-spec-template](project-spec-template.md) 按模板生成
6. **生成页面级 specs**：为每个页面创建 `specs/{页面名}.md`（读取 [page-spec-template](page-spec-template.md)）
7. **开始编码**：所有文档就绪后，按 spec 逐页实现

**关键**：步骤 1-6 完成前，禁止编写任何业务代码。`frontend/` 目录必须在第一步创建，不可延后。

## 新建项目时必须生成的文件

步骤 4 中提到的强制文件清单：

| 文件          | Web 应用                 | 小程序应用                    | 操作                                                               |
| ------------- | ------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| changelog.md  | `public/changelog.md`  | `src/static/changelog.md`  | 读取[changelog-template](changelog-template.md) 按模板生成 |
| viewer.html   | `public/viewer.html`   | `src/static/viewer.html`   | 读取[markdown-viewer](markdown-viewer.md) 按模板生成       |
| marked.min.js | `public/marked.min.js` | `src/static/marked.min.js` | 读取[marked-js-setup](marked-js-setup.md) 获取文件         |

**执行步骤**：判断项目类型 → 逐一读取对应 reference 文件 → 按模板生成到目标路径。
