# 前端模板生成项目结构

本文档详细描述 `npx create-thirdnet-admin` 模板安装后生成的项目结构。模板安装后的项目是一个完整的 Vue 3 + TypeScript 管理后台前端应用。

## 技术栈版本

| 依赖 | 版本 |
|------|------|
| Vue | 3.5.x |
| Vite | 8.x |
| Pinia | 3.x（以 npm 最新稳定版为准） |
| Element Plus | 2.x |
| Vue Router | 4.x |
| Axios | 1.x |
| TypeScript | 6.x（以 npm 最新稳定版为准） |

## 项目根目录

```
my-admin/
├── index.html              # SPA 入口 HTML（品牌名称已替换）
├── package.json            # 项目名称已替换为实际品牌名
├── vite.config.ts          # API 代理目标已替换
├── .env.development        # VITE_MOCK_ENABLED=true（开发模式）
├── .env.prototype          # VITE_MOCK_ENABLED=true（原型演示）
├── .env.production         # VITE_MOCK_ENABLED=false（生产模式）
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── .eslintrc.cjs
├── .prettierrc
├── env.d.ts
├── public/
│   ├── changelog.md        # 版本变更日志
│   ├── viewer.html         # Markdown 查看器
│   └── marked.min.js       # Markdown 渲染引擎
└── src/
```

## src/ 目录结构

```
src/
├── main.ts                 # 应用入口（Vue + Pinia + Router + Element Plus）
├── App.vue                 # 根组件
│
├── api/                    # API 策略工厂模块
│   ├── adapter.ts          # API 适配器接口
│   ├── adapter.web.ts      # Web 适配器（Axios + token 刷新队列）
│   ├── request.ts          # Axios 请求封装
│   ├── interfaces/         # 18 个接口契约文件
│   ├── modules/manager/    # 18 个 API 实现 + 工厂函数
│   └── types/              # 21 个 TypeScript 类型定义
│
├── views/                  # 页面组件
│   ├── login/              # 登录页（粒子动画背景）
│   ├── welcome/            # 首页/欢迎页
│   ├── error/              # 404 错误页
│   ├── redirect/           # 路由重定向辅助
│   ├── system/             # 系统管理页面
│   └── api/                # API 管理页面
│
├── layouts/                # 布局组件
│   ├── AdminLayout.vue     # 主布局外壳
│   ├── Navbar.vue          # 顶部导航栏
│   ├── Sidebar.vue         # 侧边栏菜单
│   ├── TagsView.vue        # 标签页导航
│   └── components/         # 布局子组件（修改密码/个人资料/设置面板）
│
├── components/             # 公共组件
│   ├── HelpBubble.vue      # 帮助气泡（演示模式专用）
│   ├── IconSelect.vue      # 图标选择器
│   ├── TableEmpty.vue      # 表格空状态
│   └── TableSkeleton.vue   # 表格骨架屏
│
├── composables/            # 11 个组合式函数
│   ├── useActionLoading.ts
│   ├── useBreadcrumb.ts
│   ├── useBreakpoint.ts
│   ├── useComponentPrefetch.ts
│   ├── useCrudTable.ts
│   ├── useDialogFocus.ts
│   ├── useHeartbeat.ts
│   ├── useIdleTimeout.ts
│   ├── useMenuItems.ts
│   ├── usePagination.ts
│   └── usePermission.ts
│
├── stores/                 # Pinia Store
│   ├── app.ts              # 应用全局状态（loading、菜单折叠等）
│   ├── auth.ts             # 认证与权限（token、用户信息、权限码列表）
│   ├── theme.ts            # 主题配置（亮/暗模式）
│   └── tagsView.ts         # 标签页导航状态
│
├── router/                 # 路由配置
│   ├── index.ts            # 路由实例 + 导航守卫
│   └── dynamic.ts          # 动态路由生成（菜单树 → 路由）
│
├── config/                 # 配置文件
│   ├── index.ts            # 应用配置（Mock 模式、API 地址、Basic Auth）
│   └── brand.ts            # 品牌常量（BRAND_NAME、BRAND_INITIAL、BRAND_ABBR）
│
├── mock/                   # Mock 数据与实现
│   ├── api/manager/        # 18 个 Mock API 处理器
│   ├── api/helpers.ts      # Mock 辅助工具
│   └── data/manager/       # 18 个 Mock 数据文件（与 API 模块一一对应）
│
├── styles/                 # 样式文件
│   ├── index.scss           # 主样式表（Element Plus 主题覆盖 + 布局）
│   ├── _mixins.scss         # SCSS 混入
│   ├── themes.ts            # 主题配置
│   └── variables.css        # CSS 自定义属性
│
├── directives/             # 自定义指令
│   └── permission.ts       # v-permission（声明式权限控制）
│
├── icons/                  # 图标注册
│   ├── SettingIcon.ts       # 自定义设置图标
│   └── registered.ts        # Element Plus 图标注册
│
├── utils/                  # 工具函数
│   ├── basicAuth.ts         # HMAC-SM3 Basic Auth 签名
│   ├── confirm.ts           # 确认对话框封装
│   ├── debounce.ts          # 防抖
│   ├── format.ts            # 格式化（日期、数字）
│   ├── iconMap.ts           # 图标名称映射
│   ├── menuPath.ts          # 菜单路径工具
│   ├── permission.ts        # 权限匹配（通配符支持）
│   ├── token.ts             # Token 存储（localStorage）
│   ├── tree.ts              # 树形数据工具
│   ├── validators.ts        # 表单验证规则
│   └── componentModules.ts  # 动态组件加载
│
└── types/                  # 全局类型定义
```

## 页面清单

### 系统管理页面（views/system/）

| 页面 | 路径 | 功能 |
|------|------|------|
| 用户管理 | `system/user/` | 用户 CRUD、角色分配、状态管理 |
| 角色管理 | `system/role/` | 角色 CRUD、权限分配 |
| 菜单管理 | `system/menu/` | 菜单树 CRUD、图标配置 |
| 部门管理 | `system/dept/` | 部门树 CRUD |
| 字典管理 | `system/dict/` | 字典类型 + 字典项 CRUD |
| 配置管理 | `system/config/` | 系统参数配置 CRUD |
| 操作日志 | `system/oper-log/` | 操作日志查询（只读） |
| 缓存管理 | `system/cache/` | 缓存查看与清理 |
| 权限管理 | `system/permission/` | 权限码查看与管理 |

### API 管理页面（views/api/）

| 页面 | 路径 | 功能 |
|------|------|------|
| 应用管理 | `api/application/` | API 应用注册管理 |
| 服务管理 | `api/service/` | API 服务配置 |
| 动作列表 | `api/action-list/` | API 动作权限管理 |
| IP 黑名单 | `api/blacklist/` | IP 黑名单管理 |
| IP 白名单 | `api/whitelist/` | IP 白名单管理 |
| 角色权限 | `api/role/` | API 角色权限分配 |
| 访问日志 | `api/visit-log/` | API 访问日志查询 |

### 其他页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 登录 | `login/` | 用户名密码登录（粒子动画背景） |
| 欢迎页 | `welcome/` | 系统首页仪表盘 |
| 404 | `error/` | 页面不存在 |

## API 模块清单（18 个）

每个 API 模块遵循策略工厂模式：`I{Module}Api` 接口 + `Real{Module}Api` 实现 + `create{Module}Api()` 工厂。

| 模块 | 文件 | 对应后端 Controller |
|------|------|---------------------|
| auth | `auth.ts` | AuthManagerController |
| user | `user.ts` | SysUserManagerController |
| role | `role.ts` | SysRoleManagerController |
| menu | `menu.ts` | SysMenuManagerController |
| dept | `dept.ts` | SysDeptManagerController |
| dict | `dict.ts` | SysDictManagerController |
| config | `config.ts` | SysConfigManagerController |
| permission | `permission.ts` | SysPermissionManagerController |
| oper-log | `oper-log.ts` | SysOperLogManagerController |
| cache | `cache.ts` | SysCacheManagerController |
| online-user | `online-user.ts` | SysOnlineUserManagerController |
| api-application | `api-application.ts` | ApiApplicationManagerController |
| api-service | `api-service.ts` | ApiServiceManagerController |
| api-action | `api-action.ts` | ApiActionManagerController |
| api-blacklist | `api-blacklist.ts` | ApiBlacklistManagerController |
| api-whitelist | `api-whitelist.ts` | ApiWhitelistManagerController |
| api-role | `api-role.ts` | ApiRoleManagerController |
| api-visitlog | `api-visitlog.ts` | ApiVisitLogManagerController |

## Composable 清单（11 个）

| Composable | 文件 | 用途 |
|------------|------|------|
| useActionLoading | `useActionLoading.ts` | 按钮级 loading 状态管理 |
| useBreadcrumb | `useBreadcrumb.ts` | 面包屑导航生成 |
| useBreakpoint | `useBreakpoint.ts` | 响应式断点检测 |
| useComponentPrefetch | `useComponentPrefetch.ts` | 组件预加载 |
| useCrudTable | `useCrudTable.ts` | 通用增删改查表格逻辑 |
| useDialogFocus | `useDialogFocus.ts` | 对话框打开后自动聚焦 |
| useHeartbeat | `useHeartbeat.ts` | 心跳检测（在线状态） |
| useIdleTimeout | `useIdleTimeout.ts` | 空闲超时自动登出 |
| useMenuItems | `useMenuItems.ts` | 菜单项构建工具 |
| usePagination | `usePagination.ts` | 分页逻辑封装 |
| usePermission | `usePermission.ts` | 编程式权限检查 |

## Store 清单（4 个）

| Store | 文件 | 职责 |
|-------|------|------|
| auth | `auth.ts` | Token 管理、用户信息、登录/登出、权限码列表、Token 自动刷新 |
| app | `app.ts` | 侧边栏折叠、全局 loading、设备类型 |
| theme | `theme.ts` | 亮/暗模式切换、Element Plus 主题覆盖 |
| tagsView | `tagsView.ts` | 标签页导航：添加/关闭/缓存已访问路由 |

## Override 文件机制

模板安装时，以下 4 个文件包含品牌占位符，由 `create.js` 在创建项目时替换为用户指定的实际值。

### 占位符对照表

| 占位符 | CLI 参数 | 默认值 | 用途 |
|--------|----------|--------|------|
| `__BRAND_NAME__` | `--brand` | `ThirdNet` | 品牌名称，出现在登录页、侧边栏、导航栏、欢迎页、HTML 标题 |
| `__BRAND_INITIAL__` | `--initial` | `T` | 品牌首字母，显示在 Logo 图标方块内（导航栏和侧边栏） |
| `__BRAND_ABBR__` | `--abbr` | `TN` | 品牌缩写，侧边栏折叠时显示 |
| `__API_PROXY_TARGET__` | `--api-target` | `http://localhost:5000` | Vite 开发服务器 API 代理目标地址 |
| `__PROJECT_NAME__` | 位置参数（项目名） | — | npm 包名，写入 package.json |

### Override 文件清单

| 模板中的 Override 文件 | 替换的原始文件 | 包含的占位符 |
|------------------------|---------------|-------------|
| `overrides/package.json.tmpl` | `web/package.json` | `__PROJECT_NAME__` |
| `overrides/index.html` | `web/index.html` | `__BRAND_NAME__` |
| `overrides/vite.config.ts` | `web/vite.config.ts` | `__API_PROXY_TARGET__` |
| `overrides/src/config/brand.ts` | `web/src/config/brand.ts` | `__BRAND_NAME__`、`__BRAND_INITIAL__`、`__BRAND_ABBR__` |

### 品牌常量在应用中的使用

`src/config/brand.ts` 导出三个常量，被以下组件引用：

- **Navbar.vue** — 导入 `BRAND_NAME`、`BRAND_INITIAL`，渲染顶部导航栏 Logo
- **Sidebar.vue** — 导入 `BRAND_NAME`、`BRAND_INITIAL`、`BRAND_ABBR`，渲染侧边栏 Logo（展开/折叠）
- **login/index.vue** — 导入 `BRAND_NAME`，渲染登录页标题和版权信息
- **welcome/index.vue** — 导入 `BRAND_NAME`，渲染欢迎页标题

## 核心架构模式

### API 策略工厂

每个 API 模块遵循统一的架构模式：

```
api/interfaces/{module}.ts    → I{Module}Api 接口定义
api/modules/manager/{module}.ts → Real{Module}Api（Axios HTTP）+ create{Module}Api() 工厂
mock/api/manager/{module}.ts   → Mock{Module}Api（本地数据）
mock/data/manager/{module}.ts  → 纯数据导出
```

通过 `VITE_MOCK_ENABLED` 环境变量切换 Real/Mock 实现。生产构建时 Vite alias 将 `@/mock/**` 重定向到空模块，配合 tree-shaking 彻底移除 Mock 代码。

### 动态路由

`router/dynamic.ts` 的 `buildDynamicRoutes()` 在运行时从后端菜单树 API 响应生成 Vue Router 路由配置，支持多层嵌套菜单。

### 权限系统

- **声明式**：`v-permission` 指令（接收数组，如 `v-permission="['sys:user:add']"`），隐藏无权限元素
- **编程式**：`usePermission()` composable，返回 `hasPermi()` 和 `hasPermiOr()` 函数
- **通配符**：支持 `*`（所有权限）、`sys:*`（模块级）、`sys:user:add`（精确匹配）

## CRUD 页面开发

新增业务页面时，参见 [crud-page-development-guide](crud-page-development-guide.md) 获取完整的代码模板、Composable 使用说明和标准参考实现。
