---
name: net-rbac
description: >
  ThirdNet RBAC 权限体系完整指南。覆盖 RBAC 数据模型（User→UserRole→Role→RoleMenu→Menu）、
  权限字符串格式（module:entity:action）、三层授权（角色/范围/权限+通配符）、
  CachePermissionProvider 权限解析流程、PermissionCatalog 自动同步、菜单树结构、
  OperatorContext 请求级缓存、新增权限保护模块的步骤。
  当用户提到"RBAC"、"permission"、"角色权限"、"菜单权限"、"PermissionAuthorize"、
  "PermissionCatalog"、"permission provider"、"权限"、"角色菜单"、"用户角色"、
  "权限开发"、"权限配置"、"OperatorContext"时，必须使用此技能。
---

# ThirdNet RBAC 权限体系

## 前置技能

了解认证系统基础，建议同时加载 `net-authentication`。

> 授权相关类（`[PermissionAuthorize]`/`[ProviderAuthorize]`/`PermissionMatcher`/`IPermissionProvider`）命名空间均在框架库 `ThirdNet.Vibe.WebAPI`；`OperatorContext`/`CachePermissionProvider` 在模板生成层 `{ProjectName}.Cache.*`（即 `Tools/{ProjectName}.Cache`，命名空间**无 `.Admin.` 中缀**）。完整清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「授权」小节。

## RBAC 数据模型

```
用户 (SysUserModel)
  │  N:M (SysUserRoleModel)
  ▼
角色 (SysRoleModel)
  │  N:M (SysRoleMenuModel)
  ▼
菜单/按钮 (SysMenuModel) + permission_string
```

### 核心实体

| 实体 | 表名 | 用途 |
|------|------|------|
| SysUserModel | t_sys_user | 用户账户 |
| SysRoleModel | t_sys_role | 角色定义 |
| SysMenuModel | t_sys_menu | 目录/菜单/按钮（三级树形） |
| SysUserRoleModel | t_sys_user_role | 用户-角色多对多关联 |
| SysRoleMenuModel | t_sys_role_menu | 角色-菜单多对多关联（含 permission_string） |

### SysMenuModel 菜单类型

```csharp
public enum MenuTypeEnum
{
    Directory = 0,  // 目录（一级，如"系统管理"）
    Page = 1,       // 菜单页面（二级，如"用户管理"）
    Button = 2      // 按钮/操作（三级，如"新增用户"）
}
```

菜单树结构：
```
系统管理 (Directory, id=1)
  ├── 用户管理 (Page, id=10, path="/system/user")
  │     ├── 用户新增 (Button, permission="sys:user:add")
  │     ├── 用户编辑 (Button, permission="sys:user:edit")
  │     ├── 用户删除 (Button, permission="sys:user:remove")
  │     └── 用户查询 (Button, permission="sys:user:query")
  ├── 角色管理 (Page, id=20, path="/system/role")
  │     └── ...
```

## 权限字符串格式

权限字符串格式为 `module:entity:action`，三级结构：

| 级别 | 含义 | 示例 |
|------|------|------|
| module | 模块 | `sys`（系统管理）、`api`（API 管理）、`monitor`（监控） |
| entity | 实体 | `user`、`role`、`menu`、`dict` |
| action | 操作 | `list`、`query`、`add`、`edit`、`remove` |

常见权限标识：

```
sys:user:list      — 用户列表
sys:user:query     — 用户详情
sys:user:add       — 新增用户
sys:user:edit      — 编辑用户
sys:user:remove    — 删除用户
sys:user:resetPwd  — 重置密码
sys:role:list      — 角色列表
sys:menu:list      — 菜单列表
api:service:list   — API 服务列表
```

## 三层授权体系

Admin 项目使用三层授权机制：

### 第一层：角色授权

```csharp
[Authorize(Roles = "admin,editor")]
```

基于 JWT 中的 role claims 进行角色匹配。较少使用。

### 第二层：范围授权（`[ProviderAuthorize]`）

`[ProviderAuthorize("scope")]`（`ThirdNet.Vibe.WebAPI`，`Authorization/Provider/ProviderAuthorizeAttribute.cs`）基于 JWT 的 **scope claim** 做范围授权，常用于 API Key / 第三方接口的 scope 控制（如 `[ProviderAuthorize("order:read")]`）。多个 scope 逗号分隔（`"order:read,order:write"`），命中任一即通过。策略路由由 `ProviderPolicyProvider` 完成：`Permission*` 策略走权限授权、`Provider*` 策略走范围授权。

```csharp
[ProviderAuthorize("order:read")]   // 要求 Token 的 scope claim 含 order:read
[HttpGet("list")]
public async Task<IActionResult> GetList() { ... }
```

> 与 `[PermissionAuthorize]` 的区别：权限授权读 `admin_roles` claim → 经 `CachePermissionProvider` 查角色权限；范围授权直接读 `scope` claim，不查角色，适合无用户身份的 API Key 场景（`AdminControllerBase` 对 ApiKey 鉴权会跳过 `OperatorContext` 初始化）。

### 第三层：权限 + 通配符授权（最常用）

```csharp
[PermissionAuthorize("sys:user:add")]
```

这是 Admin 项目最核心的授权方式，运行时流程：

```
1. 请求到达 Controller 端点
2. PermissionAuthorizeAttribute 触发 PermissionAuthorizationHandler
3. Handler 从 JWT 获取 user_id
4. 通过 IPermissionProvider（CachePermissionProvider）获取用户权限列表
5. CachePermissionProvider 调用 RoleCache.GetRolePermissions(roleKeys)
6. RoleCache 先查 Redis，miss 则从 DB 查询
7. PermissionMatcher 进行匹配：
   ├─ 精确匹配："sys:user:add" == "sys:user:add" ✅
   ├─ 模块通配："sys:*" 匹配 "sys:user:add" ✅
   └─ 全局通配："*" 匹配一切 ✅
```

### CachePermissionProvider

参考文件：生成项目 `Tools/{ProjectName}.Cache/Auth/CachePermissionProvider.cs`。

```csharp
public class CachePermissionProvider(RoleCache roleCache) : IPermissionProvider
{
    public async Task<List<string>> GetPermissionsAsync(string[] roleKeys)
    {
        return await _roleCache.GetRolePermissions(roleKeys);
    }
}
```

连接缓存层和授权框架：IPermissionProvider 接口 → CachePermissionProvider → RoleCache → Redis/DB。

## PermissionCatalog 自动同步

框架在启动时自动扫描所有 Controller 中的 `[PermissionAuthorize]` 属性，将发现的权限字符串写入 `ThirdNetDbContext` 的权限目录表。

```csharp
// 在 Program.cs 中
await host.InitializePermissionCatalogTableAsync();
```

这意味着：只需在 Controller 端点上标注 `[PermissionAuthorize("sys:notice:list")]`，权限字符串就会自动出现在管理后台的权限目录中，无需手动注册。

## 新增权限保护模块的步骤

### 1. 定义权限字符串

为模块设计权限标识，遵循 `module:entity:action` 格式：

```
sys:notice:list      — 通知列表
sys:notice:query     — 通知详情
sys:notice:add       — 新增通知
sys:notice:edit      — 编辑通知
sys:notice:remove    — 删除通知
```

### 2. 在 Controller 端点标注权限

```csharp
[PermissionAuthorize("sys:notice:list")]
[HttpGet("list")]
public async Task<IActionResult> GetList([FromQuery] NoticeQueryMap query)
{
    // ...
}
```

### 3. 添加菜单树条目

在数据库中插入菜单记录：

```sql
-- 目录级
INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, ...)
VALUES ('通知管理', {系统管理ID}, 0, ...);

-- 页面级
INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, path, ...)
VALUES ('通知列表', {通知管理ID}, 1, '/system/notice', ...);

-- 按钮级（每个操作一个）
INSERT INTO admin.t_sys_menu (menu_name, parent_id, menu_type, permission, ...)
VALUES ('通知新增', {通知列表ID}, 2, 'sys:notice:add', ...);
VALUES ('通知编辑', {通知列表ID}, 2, 'sys:notice:edit', ...);
VALUES ('通知删除', {通知列表ID}, 2, 'sys:notice:remove', ...);
```

### 4. 分配权限给角色

通过管理后台的角色管理界面，将菜单/按钮权限分配给角色。

### 5. Service 层使用 OperatorContext

在需要范围校验的 Service 方法中：

```csharp
_operatorContext.Initialize(operatorId);

// 检查是否有通配符权限
var hasWildcard = await _operatorContext.HasWildcardPermission();

// 获取可见部门范围
var visibleDeptIds = await _operatorContext.GetVisibleDeptIds();
```

## OperatorContext 详解

参考文件：生成项目 `Tools/{ProjectName}.Cache/Context/OperatorContext.cs`。命名空间 `{ProjectName}.Cache.Context`，实现 `IOperatorContext`（`{ProjectName}.Common.Interfaces`）。

OperatorContext 是请求级别的 Memoization 容器（Scoped 生命周期），避免同一请求内重复的 Redis 查询：

```csharp
// 初始化（幂等，通常由 AdminControllerBase 自动调用）
_operatorContext.Initialize(operatorId);

// 获取当前用户的权限列表（第一次 Redis 查询，后续直接返回缓存值）
var permissions = await _operatorContext.GetPermissions();

// 检查是否有通配符权限（permissions 包含 "*"）
var isAdmin = await _operatorContext.HasWildcardPermission();

// 获取用户信息
var userInfo = await _operatorContext.GetUserInfo();

// 获取用户的角色 ID 列表
var roleIds = await _operatorContext.GetUserRoleIds();

// 获取用户可见的部门 ID 列表（用于数据范围过滤）
var visibleDeptIds = await _operatorContext.GetVisibleDeptIds();
```

> **数据范围过滤列必须建索引**：`GetVisibleDeptIds()` 返回的部门集合最终会拼成 `Where(x => visibleDeptIds.Contains(x.dept_id))`，对应的 `dept_id` 等过滤列**必须建索引**（`HasIndex(x => x.dept_id)`），否则每次权限过滤触发 Seq Scan。本插件不做 RLS、数据权限走应用层（设计取舍理由见 [net-efcore-developer → 设计取舍说明](../net-efcore-developer/SKILL.md)），所以应用层过滤列的索引是性能关键。

## 通配符匹配规则

| 用户权限 | 请求的权限 | 是否匹配 |
|---------|----------|---------|
| `*` | 任何 | ✅ 匹配所有 |
| `sys:*` | `sys:user:list` | ✅ 模块级通配 |
| `sys:*` | `api:service:list` | ❌ 不同模块 |
| `sys:user:*` | `sys:user:add` | ✅ 实体级通配 |
| `sys:user:add` | `sys:user:add` | ✅ 精确匹配 |
| `sys:user:add` | `sys:user:edit` | ❌ 操作不同 |

## 完整流程

参考 `references/rbac-flow.md` 查看从登录到授权完成的完整请求生命周期图。

## 相关技能

- **backend-workflow**：后端开发入口与文档驱动开发流程（**编码前确认 `backend/spec.md` 已存在并已阅读**，否则文档驱动流程会被跳过）
- **net-authentication** — 认证机制（Basic Auth + JWT），RBAC 的前置依赖
- **net-api-developer** — Controller 和 Service 开发规范，`[PermissionAuthorize]` 的使用位置
- **net-cache-use** — 缓存域开发，`CachePermissionProvider` 基于缓存层的权限加载
- **net-efcore-developer** — 数据库实体建模，RBAC 相关表（用户、角色、菜单）的实体定义
