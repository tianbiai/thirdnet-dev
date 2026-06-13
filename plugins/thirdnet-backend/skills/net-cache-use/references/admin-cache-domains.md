# Admin 缓存域参考

## TTL 约定

| 数据类型 | TTL | 说明 |
|----------|-----|------|
| 会话 | 10 分钟 | 短期会话状态 |
| 外部 API Token | 2 小时 | Token 有效期 |
| 用户相关（信息、权限、角色） | 8 小时 | 变更较频繁 |
| 引用数据（角色字典、菜单树、配置） | 24 小时 | 变更较少 |
| Token 时间 | 7 天 | 与 JWT 有效期匹配 |
| 验证码 | 5 分钟 | 安全要求 |
| 在线状态 | 90 秒 | 心跳驱动 |

## Admin 内置缓存域

Admin 项目已提供一组缓存域（参考实现 `code/backend/src/Tools/ThirdNetVibe.Cache/Domain/`），新增业务缓存前先确认能否复用：

| 缓存域 | 主要读取方法 | 用途 |
|--------|------------|------|
| `UserCache` | `GetUser`/`GetUserRoleIds`/`GetUserPermissions` | 用户信息、角色、权限；配合 `UserCacheInvalidation` 失效 |
| `RoleCache` | `GetRoleDic`/`GetRolePermissions` | 角色→权限（`CachePermissionProvider` 依赖） |
| `MenuCache` | 菜单树（用 `TreeBuilder.BuildForest`） | 菜单/路由 |
| `DeptCache` | 部门树/可见部门 | 部门数据范围过滤 |
| `ConfigCache` | `GetConfigInt`/`GetConfigBool`/`RemoveConfigDic` | 系统配置（`SystemConfigKeys`） |
| `DictCache` | `GetDictData`/`RemoveDictData` | 字典数据按 dict_type 缓存（含系统枚举和自定义字典）；key `admin.dict.data.{dictType}`，TTL 24h |
| `TokenCache` | `SetTokenInvalidationTime`/`GetUserRoleIds` | Token 失效时间 |
| `OnlineCache` | `BatchCheckOnlineStatus` | 在线状态（心跳驱动） |
| `ApiKeyCache` | `GetByHash`/`RemoveKey` | API Key SHA256 哈希验证；key `admin.apikey.hash.{hash[:16]}`，TTL 8h |

> 新增业务实体才需要新建 `{Entity}Cache`；系统级数据优先复用上表。完整类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「缓存域」。
