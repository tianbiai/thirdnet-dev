# Controller + Service 完整示例

本文档包含从代码库提取的完整 Controller 和 Service 代码示例，展示所有端点模式和 Service 层核心模式。

> 以下为**管理端（Manager）**示例：Controller 在 `Controllers/Manager/`、Service 在 `Services/Manager/`、DTO 在 `DTOs/Manager/System/`，类名与命名空间均带 `Manager` 端段。App/Third 端把 `Manager` 换成对应端、目录与路由前缀同步即可。

## 目录

1. [UserManagerController — 完整 Controller 示例](#usermanagercontroller)
2. [SysUserManagerService — 核心 Service 方法](#sysusermanagerservice)

---

## UserManagerController

**参考文件**（生成项目）：`Admin/{ProjectName}.Admin.APIService/Controllers/Manager/UserManagerController.cs`

展示所有常见端点模式：列表、详情、新增、更新、删除、批量删除、特殊操作。

```csharp
using Microsoft.AspNetCore.Mvc;
using {ProjectName}.Common.Controllers;
using {ProjectName}.Admin.APIService.DTOs.Manager.System;   // 端类型优先：DTOs/Manager/System/
using {ProjectName}.Common.OperLog;
using {ProjectName}.Admin.APIService.Services.Manager;      // Services/Manager/
using {ProjectName}.Common.DTOs;
using ThirdNet.Vibe.WebAPI;

namespace {ProjectName}.Admin.APIService.Controllers.Manager
{
    [Route("api/manager/user")]
    public class UserManagerController : AdminControllerBase
    {
        private readonly SysUserManagerService _sysUserManagerService;
        private readonly OnlineUserManagerService _onlineUserManagerService;

        public UserManagerController(
            SysUserManagerService sysUserManagerService,
            OnlineUserManagerService onlineUserManagerService)
        {
            _sysUserManagerService = sysUserManagerService;
            _onlineUserManagerService = onlineUserManagerService;
        }

        // ====== GET: 列表查询（分页 + 条件筛选） ======
        [ProducesResponseType(typeof(PageListInfo<List<UserItemManagerMap>>), 200)]
        [PermissionAuthorize("sys:user:list")]
        [HttpGet("list")]
        public async Task<IActionResult> GetList([FromQuery] UserQueryManagerMap query)
        {
            var result = await _sysUserManagerService.GetList(query, CurrentUserId);
            return Ok(result);
        }

        // ====== GET: 详情查询 ======
        [ProducesResponseType(typeof(UserDetailManagerMap), 200)]
        [PermissionAuthorize("sys:user:query")]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(long id)
        {
            var result = await _sysUserManagerService.GetById(id, CurrentUserId);
            return Ok(result);
        }

        // ====== POST: 新增 ======
        [ProducesResponseType(200)]
        [PermissionAuthorize("sys:user:add")]
        [OperLog(Title = "用户管理", BusinessType = BusinessTypeEnum.Create)]
        [HttpPost("create")]
        public async Task<IActionResult> Add([FromBody] UserCreateManagerMap dto)
        {
            await _sysUserManagerService.Add(dto, CurrentUserId, CurrentUserName);
            return Ok();
        }

        // ====== POST: 更新 ======
        [ProducesResponseType(typeof(IdResult), 200)]
        [PermissionAuthorize("sys:user:edit")]
        [OperLog(Title = "用户管理", BusinessType = BusinessTypeEnum.Update)]
        [HttpPost("update")]
        public async Task<IActionResult> Update([FromBody] UserUpdateManagerMap dto)
        {
            var result = await _sysUserManagerService.Update(dto, CurrentUserId, CurrentUserName);
            return Ok(result);
        }

        // ====== POST: 删除单个 ======
        [ProducesResponseType(200)]
        [PermissionAuthorize("sys:user:remove")]
        [OperLog(Title = "用户管理", BusinessType = BusinessTypeEnum.Delete)]
        [HttpPost("delete/{id}")]
        public async Task<IActionResult> Delete(long id)
        {
            await _sysUserManagerService.Delete(id, CurrentUserId);
            return Ok();
        }

        // ====== POST: 批量删除 ======
        [ProducesResponseType(200)]
        [PermissionAuthorize("sys:user:remove")]
        [OperLog(Title = "用户管理", BusinessType = BusinessTypeEnum.Delete)]
        [HttpPost("delete-batch")]
        public async Task<IActionResult> DeleteBatch([FromBody] List<long> ids)
        {
            await _sysUserManagerService.DeleteBatch(ids, CurrentUserId);
            return Ok();
        }

        // ====== POST: 仅登录即可访问（无特定权限） ======
        [ProducesResponseType(200)]
        [HttpPost("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileManagerMap dto)
        {
            await _sysUserManagerService.UpdateProfile(CurrentUserId, dto);
            return Ok();
        }

        // ====== POST: 带子资源的路由 ======
        [ProducesResponseType(200)]
        [PermissionAuthorize("sys:user:edit")]
        [OperLog(Title = "用户管理", BusinessType = BusinessTypeEnum.Update)]
        [HttpPost("{id}/roles")]
        public async Task<IActionResult> AssignRoles(long id, [FromBody] AssignRolesManagerMap dto)
        {
            await _sysUserManagerService.AssignRoles(id, dto, CurrentUserId);
            return Ok();
        }
    }
}
```

### 端点模式总结

| 模式 | 路由 | 方法 | DTO | 权限 | 日志 |
|------|------|------|-----|------|------|
| 列表 | `list` | GET | QueryMap (FromQuery) | ✅ | ❌ |
| 详情 | `{id}` | GET | 无 (route param) | ✅ | ❌ |
| 新增 | `create` | POST | CreateMap (FromBody) | ✅ | ✅ |
| 更新 | `update` | POST | UpdateMap (FromBody) | ✅ | ✅ |
| 删除 | `delete/{id}` | POST | 无 (route param) | ✅ | ✅ |
| 批量删除 | `delete-batch` | POST | List\<long\> (FromBody) | ✅ | ✅ |
| 个人操作 | `profile` | POST | DTO (FromBody) | ❌ (仅需登录) | ❌ |

> 表中 DTO 均带端段（如 `UserQueryManagerMap`），与本 Controller 所属端一致。

---

## SysUserManagerService

**参考文件**（生成项目）：`Admin/{ProjectName}.Admin.APIService/Services/Manager/SysUserManagerService.cs`

展示 Service 层的核心模式：IDbContextFactory、缓存注入、OperatorContext、部门过滤、缓存失效、事务。

### 构造函数 — 依赖注入

```csharp
// 文件：Services/Manager/SysUserManagerService.cs   命名空间：...Services.Manager
public class SysUserManagerService
{
    private readonly IDbContextFactory<AdminDbContext> _dbFactory;
    private readonly UserCache _userCache;
    private readonly DeptCache _deptCache;
    private readonly RoleCache _roleCache;
    private readonly TokenCache _tokenCache;
    private readonly IPasswordHasher _passwordHasher;
    private readonly OnlineCache _onlineCache;
    private readonly OperatorContext _operatorContext;

    public SysUserManagerService(
        IDbContextFactory<AdminDbContext> dbFactory,
        UserCache userCache,
        DeptCache deptCache,
        RoleCache roleCache,
        TokenCache tokenCache,
        IPasswordHasher passwordHasher,
        OnlineCache onlineCache,
        OperatorContext operatorContext)
    {
        _dbFactory = dbFactory;
        _userCache = userCache;
        _deptCache = deptCache;
        _roleCache = roleCache;
        _tokenCache = tokenCache;
        _passwordHasher = passwordHasher;
        _onlineCache = onlineCache;
        _operatorContext = operatorContext;
    }
}
```

> 缓存域（`UserCache` / `DeptCache` 等）属于端无关的数据层，位于 `{ProjectName}.Cache/Domain/`，**不**按端类型划分——它们被各端 Service 共用注入。

### 查询方法 — GetList

```csharp
public async Task<PageListInfo<List<UserItemManagerMap>>> GetList(UserQueryManagerMap query, long currentUserId)
{
    await using var db = await _dbFactory.CreateDbContextAsync();

    var queryable = db.SysUsers.AsNoTracking().AsQueryable();

    // 条件筛选
    if (!string.IsNullOrWhiteSpace(query.user_name))
        queryable = queryable.Where(u => u.user_name.Contains(query.user_name));
    if (query.status.HasValue)
        queryable = queryable.Where(u => u.status == (StatusEnum)query.status.Value);

    // 部门筛选（含子部门）
    // 注意：dept_id 须 > 0——真实 SysUserManagerService.GetList 会拒绝 dept_id == 0 与 -1（返 400 BadRequest），
    // 因此前端/调用方传入前必须保证 dept_id 为正整数（前端下拉默认/未选时不要传 0 或 -1）。
    if (query.dept_id.HasValue && query.dept_id.Value > 0)
    {
        var deptIds = await DeptFilterHelper.GetVisibleDeptIds(
            query.dept_id.Value, true, id => _deptCache.GetDeptChildren(id));
        queryable = queryable.Where(u => deptIds.Contains(u.dept_id));
    }

    // 数据范围过滤（基于当前用户的部门归属）
    var currentUser = await _userCache.GetUserInfo(currentUserId);
    if (currentUser == null)
        return new PageListInfo<List<UserItemManagerMap>> { List = [], Total = 0, Index = query.page_index, Pages = 0 };

    var visibleDeptIds = await DeptFilterHelper.GetVisibleDeptIds(
        currentUser.dept_id, currentUser.include_sub_depts,
        id => _deptCache.GetDeptChildren(id));
    queryable = queryable.Where(u => visibleDeptIds.Contains(u.dept_id));

    // 分页 + 投影（绝不返回实体）
    var page = await queryable
        .OrderByDescending(u => u.created_time)
        .Select(u => new UserItemManagerMap
        {
            id = u.id,
            user_name = u.user_name,
            nick_name = u.nick_name,
            // ... 其他字段
        })
        .ToPageListAsync(query.page_index, query.page_size);

    // 缓存补充数据（部门名称、在线状态）
    var deptTree = await _deptCache.GetDeptTree();
    var deptMap = TreeHelper.BuildNameMap(deptTree, d => d.id, d => d.dept_name, d => d.children);
    var onlineStatusMap = await _onlineCache.BatchCheckOnlineStatus(
        page.List.Select(u => u.id).ToList());

    for (var i = 0; i < page.List.Count; i++)
    {
        page.List[i].dept_name = deptMap.GetValueOrDefault(page.List[i].dept_id);
        page.List[i].is_online = onlineStatusMap.GetValueOrDefault(page.List[i].id);
    }

    return page;
}
```

### 新增方法 — Add

```csharp
public async Task<IdResult> Add(UserCreateManagerMap dto, long operatorId, string operatorName)
{
    _operatorContext.Initialize(operatorId);
    await using var db = await _dbFactory.CreateDbContextAsync();

    // 1. 安全校验
    await ValidateRoleAssignmentScope(db, dto.role_ids);
    await ValidateDeptScope(dto.dept_id);

    // 2. 唯一性检查
    var exists = await db.SysUsers.AnyAsync(u => u.user_name == dto.user_name);
    if (exists)
        throw new WebApiException(HttpStatusCode.BadRequest, "用户名已存在");

    // 3. 创建实体
    var user = new SysUserModel
    {
        user_name = dto.user_name,
        password_hash = _passwordHasher.Hash(dto.password),
        nick_name = dto.nick_name,
        dept_id = dto.dept_id,
        status = (StatusEnum)dto.status,
        created_by = operatorName,
        // created_time 由 DB 默认值 now() 自动填充
    };
    db.SysUsers.Add(user);

    // 4. TOCTOU 兜底：捕获唯一冲突转译为 WebApiException（code/message 须与第 2 步一致；语义见 SKILL #4）。
    await db.SaveChangesWithUniqueGuardAsync(HttpStatusCode.BadRequest, "用户名已存在");

    // 5. 创建关联记录
    if (dto.role_ids?.Any() == true)
    {
        foreach (var roleId in dto.role_ids)
        {
            db.SysUserRoles.Add(new SysUserRoleModel
            {
                user_id = user.id,
                role_id = roleId
            });
        }
        await db.SaveChangesAsync();
    }

    // 6. 缓存失效（数据库操作成功后）
    await _userCache.RemoveUserDic();
    await _userCache.RemoveUser(user.id);
    if (dto.role_ids?.Any() == true)
    {
        await _userCache.RemovePermissionCache(user.id);
        await _userCache.RemoveUserRoleIds(user.id);
    }

    return new IdResult { id = user.id };
}
```

### 更新方法 — Update（含事务）

```csharp
public async Task<IdResult> Update(UserUpdateManagerMap dto, long operatorId, string operatorName)
{
    _operatorContext.Initialize(operatorId);

    // 安全护栏
    if (dto.id == operatorId)
    {
        if (dto.role_ids != null)
            throw new WebApiException(HttpStatusCode.Forbidden, "不能修改自己的角色");
        if (dto.status != (int)StatusEnum.Normal)
            throw new WebApiException(HttpStatusCode.Forbidden, "不能禁用自己");
    }

    await using var db = await _dbFactory.CreateDbContextAsync();

    // 范围校验（事务外）
    await ValidateDeptScope(dto.dept_id);

    // 事务保护（Serializable 隔离级别）
    await using var tx = await db.Database.BeginTransactionAsync(
        System.Data.IsolationLevel.Serializable);
    try
    {
        var user = await db.SysUsers.FirstOrDefaultAsync(u => u.id == dto.id);
        if (user == null)
            throw new WebApiException(HttpStatusCode.NotFound, "用户不存在");

        // 事务内重新校验
        await ValidateRoleAssignmentScope(db, dto.role_ids);

        // 更新字段
        user.nick_name = dto.nick_name ?? string.Empty;
        user.dept_id = dto.dept_id;
        user.status = (StatusEnum)dto.status;
        user.updated_by = operatorName;
        user.updated_time = DateTime.UtcNow;

        // 替换式角色关联
        var oldRoles = await db.SysUserRoles.Where(ur => ur.user_id == dto.id).ToListAsync();
        db.SysUserRoles.RemoveRange(oldRoles);
        if (dto.role_ids?.Any() == true)
        {
            foreach (var roleId in dto.role_ids)
                db.SysUserRoles.Add(new SysUserRoleModel { user_id = dto.id, role_id = roleId });
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        // 缓存失效
        await _userCache.RemoveUserDic();
        await _userCache.RemoveUser(dto.id);
        if (dto.status != (int)StatusEnum.Normal)
            await UserCacheInvalidation.InvalidateUserAuthAsync(_userCache, _tokenCache, dto.id);
        else
        {
            await _userCache.RemovePermissionCache(dto.id);
            await _userCache.RemoveUserRoleIds(dto.id);
        }

        return new IdResult { id = user.id };
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}
```

### 核心模式总结

| 模式 | 代码 |
|------|------|
| DbContext 获取 | `await using var db = await _dbFactory.CreateDbContextAsync();` |
| OperatorContext | `_operatorContext.Initialize(operatorId);` |
| 只读查询 | `AsNoTracking()` + `.Select()` 投影 |
| 分页 | `.ToPageListAsync(pageIndex, pageSize)` |
| 错误 | `throw new WebApiException(HttpStatusCode.xxx, "msg");` |
| 缓存失效 | `await _cache.RemoveXxx();` (在 SaveChanges 后) |
| 事务 | `BeginTransactionAsync(IsolationLevel.Serializable)` + try/catch/rollback |
| 部门过滤 | `DeptFilterHelper.GetVisibleDeptIds(deptId, includeSubs, childrenFunc)` |
