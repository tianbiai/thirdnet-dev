# 缓存实现详细示例

本文档提供完整的缓存实现示例，涵盖各种常见场景。

## 完整示例：部门缓存

### 1. 视图模型 (View/DepartmentView.cs)

```csharp
namespace {项目名}.Cache.View
{
    /// <summary>
    /// 部门视图模型
    /// </summary>
    public class DepartmentView
    {
        /// <summary>
        /// 主键ID
        /// </summary>
        public long id { get; set; }

        /// <summary>
        /// 部门名称
        /// </summary>
        public string name { get; set; }

        /// <summary>
        /// 上级部门ID
        /// </summary>
        public long? parent_id { get; set; }

        /// <summary>
        /// 部门状态（1:启用 0:禁用）
        /// </summary>
        public int state { get; set; }

        /// <summary>
        /// 排序号
        /// </summary>
        public int sort { get; set; }
    }
}
```

### 2. RedisHandler 查询方法

```csharp
/// <summary>
/// 获取单个部门
/// </summary>
public async Task<DepartmentView?> GetDepartment(long id)
{
    // 注意：使用对应服务的 schema（如 contract）
    var sql = @"SELECT id, name, parent_id, state, sort
                FROM contract.t_department
                WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<DepartmentView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 获取部门列表
/// </summary>
public async Task<Dictionary<long, DepartmentView>> GetDepartmentList()
{
    var sql = @"SELECT id, name, parent_id, state, sort
                FROM contract.t_department
                WHERE state = 1
                ORDER BY sort";
    var list = await _dbcontext.Database
        .SqlQueryRaw<DepartmentView>(sql)
        .AsNoTracking()
        .ToListAsync();
    return list.ToDictionary(f => f.id, f => f);
}

/// <summary>
/// 批量获取部门
/// </summary>
public async Task<List<DepartmentView>> GetDepartments(List<long> ids)
{
    if (ids == null || ids.Count == 0)
        return new List<DepartmentView>();

    var sql = @"SELECT id, name, parent_id, state, sort
                FROM contract.t_department
                WHERE id = ANY(@ids)";
    return await _dbcontext.Database
        .SqlQueryRaw<DepartmentView>(sql, new NpgsqlParameter("ids", ids))
        .AsNoTracking()
        .ToListAsync();
}

/// <summary>
/// 获取子部门列表
/// </summary>
public async Task<List<DepartmentView>> GetChildDepartments(long parentId)
{
    var sql = @"SELECT id, name, parent_id, state, sort
                FROM contract.t_department
                WHERE parent_id = {0} AND state = 1
                ORDER BY sort";
    return await _dbcontext.Database
        .SqlQueryRaw<DepartmentView>(sql, parentId)
        .AsNoTracking()
        .ToListAsync();
}
```

### 3. CacheManager 读取方法

```csharp
#region Reader - 部门相关

/// <summary>
/// 获取单个部门
/// </summary>
/// <param name="id">部门ID</param>
public async Task<DepartmentView?> GetDepartmentInfo(long id)
{
    string key = $"department.{id}";
    return await GetSingle(key, () => reader.GetDepartment(id), _stime24);
}

/// <summary>
/// 获取部门字典
/// </summary>
public async Task<Dictionary<long, DepartmentView>> GetDepartmentDic()
{
    var key = "department";
    return await GetSingle(key, reader.GetDepartmentList, _stime24);
}

/// <summary>
/// 批量获取部门
/// </summary>
/// <param name="ids">部门ID列表</param>
public async Task<Dictionary<long, DepartmentView>> GetDepartmentInfo(List<long> ids)
{
    if (ids == null || ids.Count == 0)
        return new Dictionary<long, DepartmentView>();

    string key = "department.";
    var dic = await GetMultiple(
        ids.Distinct().Select(s => $"{key}{s}").ToArray(),
        func,
        _stime24
    );
    return dic.ToDictionary(f => long.Parse(f.Key.Replace(key, "")), v => v.Value);

    async Task<IDictionary<string, DepartmentView>> func(string[] keys)
    {
        var ids = keys.Select(s => long.Parse(s.Replace(key, ""))).ToList();
        using var dbcontext = new CacheViewDBContext(viewDbOp);
        var sql = @"SELECT id, name, parent_id, state, sort
                    FROM contract.t_department
                    WHERE id = ANY(@ids)";
        var list = await dbcontext.Database
            .SqlQueryRaw<DepartmentView>(sql, new NpgsqlParameter("ids", ids))
            .AsNoTracking()
            .ToListAsync();
        return list.ToDictionary(f => $"{key}{f.id}");
    }
}

/// <summary>
/// 获取子部门列表
/// </summary>
/// <param name="parentId">父部门ID</param>
public async Task<List<DepartmentView>> GetChildDepartments(long parentId)
{
    var allDepts = await GetDepartmentDic();
    return allDepts.Values.Where(d => d.parent_id == parentId).OrderBy(d => d.sort).ToList();
}

#endregion
```

### 4. CacheManager 刷新方法

```csharp
#region Refresh - 部门相关

/// <summary>
/// 刷新单个部门
/// </summary>
/// <param name="id">部门ID</param>
public async Task RefreshDepartment(long id)
{
    string key = $"department.{id}";
    var info = await reader.GetDepartment(id);
    if (info != null)
    {
        await AddOrUpdate(key, info, _stime24);
    }
    else
    {
        await RemoveSingle(key);
    }
}

/// <summary>
/// 刷新整个部门集合
/// </summary>
public async Task RefreshDepartment()
{
    var key = "department";
    var dic = await reader.GetDepartmentList();
    await AddOrUpdate(key, dic, _stime24);
}

/// <summary>
/// 刷新特定部门（使用模型）
/// </summary>
/// <param name="model">部门视图模型</param>
public async Task RefreshDepartment(DepartmentView model)
{
    string key = $"department.{model.id}";
    await AddOrUpdate(key, model, _stime24);
}

/// <summary>
/// 删除部门缓存
/// </summary>
/// <param name="id">部门ID</param>
public async Task RemoveDepartment(long id)
{
    string key = $"department.{id}";
    await RemoveSingle(key);
    // 同时刷新整个字典
    await RefreshDepartment();
}

#endregion
```

### 5. 接口定义

```csharp
// ICacheReader.cs
public interface ICacheReader
{
    // 部门相关
    Task<DepartmentView?> GetDepartmentInfo(long id);
    Task<Dictionary<long, DepartmentView>> GetDepartmentDic();
    Task<Dictionary<long, DepartmentView>> GetDepartmentInfo(List<long> ids);
    Task<List<DepartmentView>> GetChildDepartments(long parentId);
}

// ICacheRefresh.cs
public interface ICacheRefresh
{
    // 部门相关
    Task RefreshDepartment(long id);
    Task RefreshDepartment();
    Task RefreshDepartment(DepartmentView model);
    Task RemoveDepartment(long id);
}
```

## 完整示例：用户缓存（带多键场景）

### 1. 视图模型

```csharp
public class UserView
{
    public long id { get; set; }
    public string user_name { get; set; }
    public string phone { get; set; }
    public string email { get; set; }
    public int state { get; set; }
    public long department_id { get; set; }
}
```

### 2. RedisHandler（多键查询）

```csharp
/// <summary>
/// 根据ID获取用户
/// </summary>
public async Task<UserView?> GetUser(long id)
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id
                FROM contract.t_user
                WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 根据手机号获取用户
/// </summary>
public async Task<UserView?> GetUserByPhone(string phone)
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id
                FROM contract.t_user
                WHERE phone = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, phone)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 根据邮箱获取用户
/// </summary>
public async Task<UserView?> GetUserByEmail(string email)
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id
                FROM contract.t_user
                WHERE email = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, email)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 获取用户列表
/// </summary>
public async Task<Dictionary<long, UserView>> GetUserList()
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id
                FROM contract.t_user
                WHERE state = 1";
    var list = await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql)
        .AsNoTracking()
        .ToListAsync();
    return list.ToDictionary(f => f.id, f => f);
}
```

### 3. CacheManager（多键管理）

```csharp
#region Reader - 用户相关

/// <summary>
/// 根据ID获取用户
/// </summary>
public async Task<UserView?> GetUserInfo(long id)
{
    string key = $"user.{id}";
    return await GetSingle(key, () => reader.GetUser(id), _stime8);
}

/// <summary>
/// 根据手机号获取用户
/// </summary>
public async Task<UserView?> GetUserByPhone(string phone)
{
    string key = $"user.phone.{phone}";
    return await GetSingle(key, () => reader.GetUserByPhone(phone), _stime8);
}

/// <summary>
/// 根据邮箱获取用户
/// </summary>
public async Task<UserView?> GetUserByEmail(string email)
{
    string key = $"user.email.{email}";
    return await GetSingle(key, () => reader.GetUserByEmail(email), _stime8);
}

#endregion

#region Refresh - 用户相关

/// <summary>
/// 刷新用户（刷新所有相关键）
/// </summary>
public async Task RefreshUser(long id)
{
    // 先获取旧数据，用于清除旧的辅助键
    var oldKey = $"user.{id}";
    var oldInfo = await GetSingle(oldKey, () => reader.GetUser(id), _stime8);

    // 获取最新数据
    var info = await reader.GetUser(id);
    if (info == null)
    {
        // 用户不存在，清除所有相关缓存
        await RemoveSingle($"user.{id}");
        if (oldInfo != null)
        {
            if (!string.IsNullOrEmpty(oldInfo.phone))
                await RemoveSingle($"user.phone.{oldInfo.phone}");
            if (!string.IsNullOrEmpty(oldInfo.email))
                await RemoveSingle($"user.email.{oldInfo.email}");
        }
        return;
    }

    // 刷新ID键
    await AddOrUpdate($"user.{id}", info, _stime8);

    // 刷新手机号键（如果手机号变更，清除旧键）
    if (oldInfo != null && !string.IsNullOrEmpty(oldInfo.phone) && oldInfo.phone != info.phone)
    {
        await RemoveSingle($"user.phone.{oldInfo.phone}");
    }
    if (!string.IsNullOrEmpty(info.phone))
    {
        await AddOrUpdate($"user.phone.{info.phone}", info, _stime8);
    }

    // 刷新邮箱键（如果邮箱变更，清除旧键）
    if (oldInfo != null && !string.IsNullOrEmpty(oldInfo.email) && oldInfo.email != info.email)
    {
        await RemoveSingle($"user.email.{oldInfo.email}");
    }
    if (!string.IsNullOrEmpty(info.email))
    {
        await AddOrUpdate($"user.email.{info.email}", info, _stime8);
    }
}

/// <summary>
/// 刷新用户（使用模型）
/// </summary>
public async Task RefreshUser(UserView model)
{
    // 直接使用传入的模型更新缓存
    await AddOrUpdate($"user.{model.id}", model, _stime8);

    if (!string.IsNullOrEmpty(model.phone))
    {
        await AddOrUpdate($"user.phone.{model.phone}", model, _stime8);
    }

    if (!string.IsNullOrEmpty(model.email))
    {
        await AddOrUpdate($"user.email.{model.email}", model, _stime8);
    }
}

#endregion
```

## 树形结构示例：地区缓存

### 1. 视图模型

```csharp
public class RegionView
{
    public long id { get; set; }
    public string name { get; set; }
    public long? parent_id { get; set; }
    public int level { get; set; }  // 1:省 2:市 3:区
    public int sort { get; set; }

    // 子节点（仅用于树形结构）
    public List<RegionView>? children { get; set; }
}
```

### 2. CacheManager（带树形结构）

```csharp
#region Reader - 地区相关

/// <summary>
/// 获取单个地区
/// </summary>
public async Task<RegionView?> GetRegionInfo(long id)
{
    string key = $"region.{id}";
    return await GetSingle(key, () => reader.GetRegion(id), _stime24);
}

/// <summary>
/// 获取地区树形结构
/// </summary>
public async Task<List<RegionView>> GetRegionTree()
{
    var key = "region.tree";
    return await GetSingle(key, BuildRegionTree, _stime24);
}

/// <summary>
/// 构建地区树形结构
/// </summary>
private async Task<List<RegionView>> BuildRegionTree()
{
    var all = await reader.GetRegionList();
    var rootNodes = all.Values.Where(r => r.parent_id == null).OrderBy(r => r.sort).ToList();

    foreach (var root in rootNodes)
    {
        BuildChildren(root, all);
    }

    return rootNodes;
}

/// <summary>
/// 递归构建子节点
/// </summary>
private void BuildChildren(RegionView parent, Dictionary<long, RegionView> all)
{
    var children = all.Values
        .Where(r => r.parent_id == parent.id)
        .OrderBy(r => r.sort)
        .ToList();

    if (children.Any())
    {
        parent.children = children;
        foreach (var child in children)
        {
            BuildChildren(child, all);
        }
    }
}

#endregion
```

## 使用示例

### Controller 中使用缓存

```csharp
[ApiController]
[Route("api/manager/department")]
public class DepartmentController : ControllerBase
{
    private readonly ICacheReader _cacheReader;
    private readonly ICacheRefresh _cacheRefresh;
    private readonly DepartmentDbContext _dbContext;

    /// <summary>
    /// 获取部门列表
    /// </summary>
    [HttpGet("list")]
    public async Task<IActionResult> GetList()
    {
        var dic = await _cacheReader.GetDepartmentDic();
        return Ok(dic.Values);
    }

    /// <summary>
    /// 获取部门详情
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(long id)
    {
        var dept = await _cacheReader.GetDepartmentInfo(id);
        if (dept == null)
        {
            throw new WebApiException(HttpStatusCode.NotFound, "部门不存在");
        }
        return Ok(dept);
    }

    /// <summary>
    /// 创建部门
    /// </summary>
    [HttpPost("create")]
    public async Task<IActionResult> Create([FromBody] CreateDepartmentRequest request)
    {
        var dept = new DepartmentModel
        {
            name = request.name,
            parent_id = request.parent_id,
            state = 1,
            sort = request.sort
        };

        _dbContext.Department.Add(dept);
        await _dbContext.SaveChangesAsync();

        // 刷新缓存
        await _cacheRefresh.RefreshDepartment();

        return Ok(new { id = dept.id });
    }

    /// <summary>
    /// 更新部门
    /// </summary>
    [HttpPost("update")]
    public async Task<IActionResult> Update([FromBody] UpdateDepartmentRequest request)
    {
        var dept = await _dbContext.Department.FindAsync(request.id);
        if (dept == null)
        {
            throw new WebApiException(HttpStatusCode.NotFound, "部门不存在");
        }

        dept.name = request.name;
        dept.sort = request.sort;
        await _dbContext.SaveChangesAsync();

        // 刷新单个部门缓存
        await _cacheRefresh.RefreshDepartment(request.id);

        return Ok();
    }

    /// <summary>
    /// 删除部门
    /// </summary>
    [HttpPost("delete")]
    public async Task<IActionResult> Delete(long id)
    {
        var dept = await _dbContext.Department.FindAsync(id);
        if (dept == null)
        {
            throw new WebApiException(HttpStatusCode.NotFound, "部门不存在");
        }

        _dbContext.Department.Remove(dept);
        await _dbContext.SaveChangesAsync();

        // 删除缓存
        await _cacheRefresh.RemoveDepartment(id);

        return Ok();
    }
}
```
