# Admin 模板模块对照表

ThirdNet Admin 模板内置约 19 个管理端模块（以模板实际为准），前端工程内 `api/modules/` 与后端 `Controllers/Manager/` 基本一一对应（前端按工程分端、工程内扁平，URL 走 `/api/manager/...`）。下表用于新增业务模块时的命名参考。

| 模块 | 后端 Controller | 前端 API 模块 |
|------|----------------|--------------|
| 认证 | `AuthManagerController`（`/api/manager/auth/login`、`/api/manager/auth/refresh` 等；JWT 国密 SM2 + HMAC-SM3 Basic + API-Key 三 scheme，由 `ThirdNet.Vibe.WebAPI` 框架内置，**非 IdentityServer**） | `api/modules/auth.ts`、`src/utils/basicAuth.ts`（`sm-crypto`） |
| 用户管理 | `UserManagerController` | `api/modules/user.ts` |
| 角色管理 | `RoleManagerController` | `api/modules/role.ts` |
| 菜单管理 | `MenuManagerController` | `api/modules/menu.ts` |
| 部门管理 | `DeptManagerController` | `api/modules/dept.ts` |
| 字典管理 | `DictManagerController` | `api/modules/dict.ts` |
| 配置管理 | `SysConfigManagerController` | `api/modules/config.ts` |
| 权限管理 | `PermissionManagerController` | `api/modules/permission.ts` |
| 操作日志 | `OperLogManagerController` | `api/modules/oper-log.ts` |
| 缓存管理 | `CacheAdminManagerController` | `api/modules/cache.ts` |
| API Key | `ApiKeyManagerController` | `api/modules/api-key.ts` |
| API 应用 | `ApiApplicationManagerController` | `api/modules/api-application.ts` |
| API 服务 | `ApiServiceManagerController` | `api/modules/api-service.ts` |
| API 操作 | `ApiActionListManagerController` | `api/modules/api-action.ts` |
| IP 黑名单 | `ApiBlacklistManagerController` | `api/modules/api-blacklist.ts` |
| IP 白名单 | `ApiWhitelistManagerController` | `api/modules/api-whitelist.ts` |
| API 角色 | `ApiRoleManagerController` | `api/modules/api-role.ts` |
| 访问日志 | `ApiVisitLogManagerController` | `api/modules/api-visitlog.ts` |
| 文件上传/下载 | `CommonManagerController`（通用接口，无前端独立模块） | — |

> **关于"在线用户"**：前端保留 `api/modules/online-user.ts`，但其列表/强退功能在后端**没有独立控制器**——已合并进 `UserManagerController`（`/api/manager/user/heartbeat`、`/api/manager/user/kick`）+ `OnlineUserService` + `OnlineUserHeartbeatLogger` 后台任务；前端 `online-user.ts` 现仅保留心跳上报，列表/强退调用走 `user.ts`。新增业务模块时不要照搬一个"在线用户控制器"。

新增业务模块时，参考此对照表的命名模式。

> 上述 Controller 命名遵循 `{Entity}ManagerController` 模式（多数系统/业务实体**不带** `Sys` 前缀，仅 `SysConfigManagerController` 等个别带前缀——以生成代码实际类名为准），权限字符串遵循 `{module}:{entity}:{action}` 格式。
