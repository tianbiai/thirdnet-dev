# E2E 测试目录索引

> 何时需要读：当要为新增业务页面编写 Playwright E2E 测试、或学习现有测试模式时再读。

参考仓库 `code/frontend/e2e-tests/` 包含 48 个 Playwright E2E 测试，覆盖 Admin 模板全部主要模块，可作为新页面测试的参考模式：

| 测试目录 | 覆盖模块 |
|---------|---------|
| `01-auth/` | 登录、密码过期、Token 生命周期 |
| `02-user-lifecycle/` | 密码修改、密码重置、用户 CRUD |
| `03-role-lifecycle/` | 角色 CRUD、角色权限分配 |
| `04-menu-management/` | 菜单树管理 |
| `05-dept-management/` | 部门树管理 |
| `06-config-management/` | 配置 CRUD、配置生效 |
| `07-dict-management/` | 字典 CRUD |
| `08-gateway/` | 应用管理 |
| `09-permission-matrix/` | 权限访问、权限视图 |
| `12-security/` | 注入防护、上传安全 |
| `13-api-management/` | API 端点列表、API 角色、应用、黑白名单、访问日志 |
| `10-frontend-integration/` | 前后端联调、全栈集成 |
| `11-operation-log/` | 操作日志记录与查询 |
| `14-i18n/` | 国际化（多语言切换） |
| `15-cache-management/` | 缓存管理（Redis 缓存域） |
| `16-theme/` | 主题切换（6 套品牌色预设 + 亮/暗模式） |
| `17-tags-view/` | 标签页导航（多标签打开/关闭/缓存） |
| `18-error-pages/` | 错误页（404 等） |

新增业务页面后，可参照上述测试目录的模式编写对应的 E2E 测试。
