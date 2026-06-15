---
name: admin-template-setup
description: >
  Admin 管理后台前端模板安装与使用指南。模板已实现完整的后台基础管理功能（用户管理、角色管理、
  菜单管理、权限管理、部门管理、字典管理、配置管理、操作日志、缓存管理）和 API 管理功能（应用管理、
  IP 黑白名单、访问日志等）。前端采用真实 API + Mock 数据并行开发模式，通过环境变量配置切换
  数据来源——开发阶段用 Mock 数据独立开发，后端就绪后切换为真实 API，无需改动业务代码。
  覆盖 npm exec --registry 模板安装、品牌定制参数、生成项目结构、安装后验证。
  当用户需要创建新的管理后台前端项目时必须使用此技能——禁止从零开始手动搭建 admin 前端项目。
  触发关键词：新建管理后台、创建 admin 前端、thirdnet-admin、create-thirdnet-admin、
  项目脚手架、模板安装、品牌定制、初始化 admin 项目。
license: MIT
metadata:
  version: "1.1.0"
  author: thirdnet
---
# Admin 管理后台前端模板安装指南

本技能定义了如何使用 `create-thirdnet-admin` npm 包模板创建管理后台前端项目。模板提供完整的管理后台基础功能，无需从零搭建。

## 核心原则

- **所有新的 admin 前端项目必须使用模板创建**——模板不仅是脚手架，而是已实现完整功能的可运行管理后台：
  - 系统管理：用户管理、角色管理（含权限分配）、菜单管理、部门管理、字典管理、配置管理、操作日志、缓存管理
  - API 管理：应用管理、IP 黑白名单、角色权限、访问日志
  - 认证授权：登录/登出、Token 自动刷新、RBAC 三层权限（角色/范围/权限码）、动态菜单路由
- 前端采用**真实 API + Mock 数据并行**开发模式——通过 `VITE_MOCK_ENABLED` 环境变量切换，开发阶段无需后端即可完整运行。API 策略工厂的完整规范（5 文件模块结构、Real/Mock 实现、生产构建排除机制）详见 `api-typescript-spec` 技能
- **模板内置模块的业务逻辑受保护，安装后不可修改**——模板已实现的系统管理（用户、角色、菜单、部门、权限、操作日志、配置、字典、缓存）和 API 管理（应用、角色权限、IP 黑白名单、访问日志、接口列表、服务管理）功能模块的**业务逻辑代码**（script 部分、API 调用、组件嵌套关系、事件处理）属于模板资产，安装后禁止修改。页面样式（CSS/SCSS、布局、配色）可以自由调整。如需调整功能逻辑或扩展功能，应通过后端菜单配置新增页面，或新建独立的业务模块来实现。这条规则的目的是保证模板升级时不会与用户定制代码冲突。
- 后端 API 服务需单独安装（参见 `thirdnet-backend:backend-workflow` 技能），本技能仅负责前端

## 前置条件

| 条件         | 要求                                             |
| ------------ | ------------------------------------------------ |
| Node.js      | ≥ 18.0.0                                        |
| npm          | 随 Node.js 安装                                  |
| npm registry（内网） | Verdaccio 私有仓库 `http://192.168.1.207:4873`（内网不可达时改用外网，见下方说明） |

> **网络环境说明**：模板包同时通过内网和外网两条路径提供，二选一即可。默认使用内网 registry `http://192.168.1.207:4873`；若处于非内网环境或内网不可达，改用外网 registry `http://61.164.57.61:14873/`（命令中替换 `--registry` 后的地址即可）。两条路径均能访问 `create-thirdnet-admin` 包。

## 安装步骤

### 创建项目

使用 `npm exec` 命令从私有 registry 安装并执行模板脚手架：

```bash
# 基础安装（使用默认品牌 ThirdNet）
npm exec --registry http://192.168.1.207:4873/ -- create-thirdnet-admin my-admin

# 内网不可达时，改用外网 registry
npm exec --registry http://61.164.57.61:14873/ -- create-thirdnet-admin my-admin

# 带品牌定制
npm exec --registry http://192.168.1.207:4873/ -- create-thirdnet-admin my-admin \
  --brand MyApp --initial M --abbr MA
```

**命令说明：**

- `--registry http://192.168.1.207:4873/` — 指定从私有 npm registry 获取模板包。内网地址，外网环境用 `--registry http://61.164.57.61:14873/`，两者二选一
- `--` — 分隔 npm 参数和包名参数
- `my-admin` — 项目名称（会成为目录名和 npm 包名）
- `--brand` — 品牌名称，出现在登录页、侧边栏、导航栏、HTML 标题
- `--initial` — 品牌首字母，显示在 Logo 图标方块内
- `--abbr` — 品牌缩写，侧边栏折叠时显示
- `--api-target` — 后端 API 服务地址，用于 Vite 开发代理

### 品牌定制参数详解

| 参数             | 占位符                   | 默认值                    | 说明         | 影响范围                                             |
| ---------------- | ------------------------ | ------------------------- | ------------ | ---------------------------------------------------- |
| `--brand`      | `__BRAND_NAME__`       | `ThirdNet`              | 品牌名称     | 登录页标题、侧边栏、导航栏、欢迎页、HTML `<title>` |
| `--initial`    | `__BRAND_INITIAL__`    | `T`                     | 品牌首字母   | Logo 图标方块（导航栏 + 侧边栏）                     |
| `--abbr`       | `__BRAND_ABBR__`       | `TN`                    | 品牌缩写     | 侧边栏折叠状态的 Logo                                |
| `--api-target` | `__API_PROXY_TARGET__` | `http://localhost:5000` | API 代理目标 | `vite.config.ts` 中的 proxy 配置                   |
| （项目名）       | `__PROJECT_NAME__`     | —                        | npm 包名     | `package.json` 的 name 字段                        |

> **注意**：所有品牌参数可独立使用，未指定的参数保持默认值。`--brand`、`--initial`、`--abbr` 三者独立替换，不会联动推导（例如仅传 `--brand MyApp` 不会自动将 `--initial` 改为 `M`）。

### 安装依赖并启动

```bash
cd my-admin
npm install
npm run dev
```

开发服务器默认在端口 3000 启动，访问 `http://localhost:3000` 即可看到登录页。

## 生成项目结构概览

模板安装后生成的项目包含完整的 Vue 3 + TypeScript 管理后台。以下是主要目录：

```
my-admin/
├── src/
│   ├── api/              # 19 个 API 模块（策略工厂模式）
│   ├── views/            # 页面：系统管理 + API 管理 + 登录 + 欢迎页
│   ├── stores/           # 4 个 Pinia Store（auth / app / theme / tagsView）
│   ├── layouts/          # 布局：AdminLayout / Navbar / Sidebar / TagsView
│   ├── composables/      # 11 个组合式函数
│   ├── router/           # 动态路由（菜单树 → 路由）
│   ├── config/           # 品牌常量 + 应用配置（MOCK_ENABLED 等）
│   ├── mock/             # Mock 数据 + 19 个 Mock API 实现
│   ├── styles/           # 全局样式 + Element Plus 主题覆盖
│   ├── directives/       # v-permission 权限指令
│   ├── components/       # 公共组件（HelpBubble、IconSelect、PaginationBar 等）
│   └── utils/            # 工具函数（basicAuth、token、tree、permission 等）
├── public/               # changelog.md + viewer.html
├── .env                  # 单一环境文件：VITE_MOCK_ENABLED（默认 false 连真实 API；设 true 走 Mock）、VITE_API_BASE_URL、VITE_BASIC_AUTH_APP/KEY、VITE_API_TARGET
├── vite.config.ts        # API 代理已配置指向 --api-target；生产构建经 mockDataStripPlugin 剥离 Mock 数据
└── package.json          # 项目名称已替换
```

详细的项目结构、页面清单、API 模块列表和 Composable 列表参见 [frontend-template-structure](references/frontend-template-structure.md)。

CRUD 页面开发详细指南（Composable 使用、页面布局模板、工具函数）参见 [crud-page-development-guide](references/crud-page-development-guide.md)。

## 安装后验证清单

模板安装完成后，逐项验证：

- [ ] `npm install` 无错误
- [ ] `npm run dev` 启动成功，终端显示 `Local: http://localhost:3000/`
- [ ] 浏览器访问 `http://localhost:3000`，登录页正常显示
- [ ] 品牌名称在登录页标题正确显示（非默认 `ThirdNet`）
- [ ] 品牌首字母在 Logo 图标方块内正确显示
- [ ] API 代理指向正确的后端地址（检查 `vite.config.ts` 中的 proxy target）
- [ ] Mock 模式：在 `.env` 中将 `VITE_MOCK_ENABLED` 设为 `true`，重启 `npm run dev`，可无后端独立运行全部管理功能
- [ ] 切换为真实 API：在 `.env` 中将 `VITE_MOCK_ENABLED` 设为 `false`（脚手架默认值），需后端服务已启动且 `--api-target` 正确

若后端 API 已启动且 `--api-target` 配置正确，还可验证：

- [ ] Mock 模式下可直接登录进入管理页面（无需输入凭据，Mock 数据直接放行）
- [ ] 侧边栏菜单正常加载
- [ ] 系统管理页面（用户、角色、菜单等）可正常访问

## 常见问题

### npm registry 不可达

**现象**：`npm exec` 报错 `ERR! 404 Not Found` 或连接超时。

**解决**：

模板包提供内网、外网两条路径，二选一即可。**先尝试内网，内网不可达时改用外网：**

1. 确认 Verdaccio 服务器可达——内网 `http://192.168.1.207:4873` 或外网 `http://61.164.57.61:14873/`
2. 在浏览器中访问对应地址下的 `/create-thirdnet-admin` 确认包存在（如 `http://192.168.1.207:4873/create-thirdnet-admin` 或 `http://61.164.57.61:14873/create-thirdnet-admin`）
3. 若当前网络无法访问内网，直接在命令中将 `--registry` 替换为外网地址 `http://61.164.57.61:14873/`

### 前端代理 404

**现象**：前端启动正常，但 API 请求返回 404。

**解决**：

1. 确认后端 API 服务已启动（默认 `http://localhost:5000`）
2. 检查 `vite.config.ts` 中 proxy target 是否指向正确的后端地址
3. 若后端不在本机，重新安装模板并指定 `--api-target` 参数

### 登录页品牌名称仍显示 ThirdNet

**现象**：使用了 `--brand` 参数但登录页仍显示默认品牌。

**解决**：

1. 检查 `src/config/brand.ts` 中的常量值是否已替换
2. 若值仍为 `__BRAND_NAME__`，说明替换未生效，重新执行模板安装命令

## CRUD 页面开发

安装模板后，新增业务页面是主要开发任务。模板提供了完整的 Composable、组件和工具函数来消除样板代码。

**开发新页面时，必须阅读**：[crud-page-development-guide](references/crud-page-development-guide.md)

该指南涵盖：
- 页面布局结构（page-container / page-header / search-bar / toolbar / pagination-bar）
- 核心 Composable（useCrudTable / useDialogFocus / useActionLoading / usePermission）
- 公共组件（PaginationBar / HelpBubble / TableEmpty / TableSkeleton）
- 工具函数（validators / confirmAction / formatDateTime）
- 权限系统三层架构（v-permission 指令 / usePermission composable / matchPermission 工具函数）
- CSS 变量（对话框尺寸、表单标签宽度）
- 弹窗表单完整代码模板

**标准参考实现**：`src/views/api/blacklist/index.vue` — 展示了 useCrudTable + PaginationBar + useDialogFocus + validators + confirmAction 的完整组合。

**关键原则**：
- **禁止重复造轮子** — 使用模板已有的 Composable 和组件
- 所有列表页使用 `useCrudTable` 管理分页、搜索、加载、删除（禁止手写 `usePagination + useActionLoading + debounced search` 样板）
- 所有弹窗使用 `useDialogFocus` 管理焦点
- 所有表单验证使用 `validators.ts` 的规则工厂（`requiredRule`、`requiredSelectRule` 等）
- 所有删除确认使用 `confirmAction()`（`useCrudTable.remove()` 已内置）
- 所有分页使用 `PaginationBar` 组件（禁止直接使用 `el-pagination`）

## 参考代码

参考仓库 `code/frontend/` 包含前端相关的源码和测试，可供深入学习：

| 目录 | 内容 | 用途 |
|------|------|------|
| `code/frontend/create-thirdnet-admin/` | npm 模板包源码（`template/` + `overrides/`） | 了解模板生成逻辑、自定义模板内容 |
| `code/frontend/web/` | 在线 Admin Web 应用（Vue 3 + Element Plus + Vite） | 参考真实页面实现、API 模块写法 |
| `code/frontend/e2e-tests/` | Playwright E2E 测试套件（48 个测试文件） | 验证新页面功能、学习测试模式 |
