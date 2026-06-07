# 缓存实现详细示例

本文件包含完整的缓存实现代码示例，作为 SKILL.md 的补充参考。

所有示例基于 `RedisCacheManager` 基类（`ThirdNet.Core.Common` 命名空间），该基类内置 Polly 熔断、SemaphoreSlim 防击穿、TTL 抖动等能力。

## 目录

- [基础模式：用户缓存](#基础模式用户缓存) — 单个/列表/批量查询的标准实现
- [缓存更新策略对比：Cache Invalidation vs Write-Through](#缓存更新策略对比cache-invalidation-vs-write-through) — 两种模式的对比示例
- [扩展场景：部门缓存](#扩展场景部门缓存) — 子部门查询 + 联动刷新（基于基础模式的差异部分）
- [多键场景：用户缓存（多索引）](#完整示例用户缓存带多键场景) — 多 key 索引同一数据
- [树形结构：地区缓存](#树形结构示例地区缓存) — 扁平数据构建树
- [批量操作：AddOrUpdateMultiple / RemoveMultiple](#批量操作示例使用-addorupdatemultiple-和-removemultiple) — 批量刷新/删除
- [Controller 中使用缓存](#使用示例) — API 层调用示例
- [缓存对象复用示例](#缓存对象复用示例) — 消除冗余查询与缓存键的正反例对比

---

## 基础模式：用户缓存

以下是最标准的缓存实现模式：View → RedisHandler → CacheManager（Reader + Refresh）→ 接口定义。

### 1. 视图模型 (View/UserView.cs)

```csharp
namespace {项目名}.Cache.View
{
    /// <summary>
    /// 用户视图模型
    /// </summary>
    public class UserView
    {
        public long id { get; set; }
        public string user_name { get; set; }
        public int state { get; set; }
    }
}
```

### 2. RedisHandler 查询方法

```csharp
/// <summary>
/// 获取单个用户
/// </summary>
public async Task<UserView?> GetUser(long id)
{
    var sql = @"SELECT * FROM contract.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 获取用户列表（返回字典）
/// </summary>
public async Task<Dictionary<long, UserView>> GetUserList()
{
    var sql = @"SELECT * FROM contract.t_user";
    var list = await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql)
        .AsNoTracking()
        .ToListAsync();
    return list.ToDictionary(f => f.id, f => f);
}

/// <summary>
/// 批量获取用户（用于 GetMultiple 的 func 回调）
/// </summary>
public async Task<List<UserView>> GetUsers(List<long> ids)
{
    var sql = @"SELECT * FROM contract.t_user WHERE id = ANY(@ids)";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, new NpgsqlParameter("ids", ids))
        .AsNoTracking()
        .ToListAsync();
}
```

### 3. CacheManager 读取方法

```csharp
#region Reader - 用户相关

/// <summary>
/// 获取单个用户
/// </summary>
public async Task<UserView?> GetUserInfo(long id)
{
    string key = $"user.{id}";
    return await GetSingle(key, () => reader.GetUser(id), _stime8);
}

/// <summary>
/// 获取用户字典
/// </summary>
public async Task<Dictionary<long, UserView>> GetUserDic()
{
    var key = "user";
    return await GetSingle(key, reader.GetUserList, _stime24);
}

/// <summary>
/// 批量获取用户
/// </summary>
public async Task<Dictionary<long, UserView>> GetUserInfo(List<long> ids)
{
    if (ids == null || ids.Count == 0)
        return new Dictionary<long, UserView>();

    string key = "user.";
    var dic = await GetMultiple(
        ids.Distinct().Select(s => $"{key}{s}").ToArray(),
        func,
        DateTimeOffset.Now.Add(_stime8)
    );
    return dic.ToDictionary(f => long.Parse(f.Key.Replace(key, "")), v => v.Value);

    async Task<IDictionary<string, UserView>> func(string[] keys)
    {
        var ids = keys.Select(s => long.Parse(s.Replace(key, ""))).ToList();
        var list = await reader.GetUsers(ids);
        return list.ToDictionary(f => $"{key}{f.id}");
    }
}

#endregion
```

### 4. CacheManager 刷新方法

```csharp
#region Refresh - 用户相关

/// <summary>
/// 刷新单个用户
/// </summary>
public async Task RefreshUser(long id)
{
    string key = $"user.{id}";
    var info = await reader.GetUser(id);
    if (info != null)
    {
        await AddOrUpdate(key, info, _stime8);
    }
    else
    {
        await RemoveSingle(key);
    }
}

/// <summary>
/// 刷新整个用户集合
/// </summary>
public async Task RefreshUser()
{
    var key = "user";
    var dic = await reader.GetUserList();
    await AddOrUpdate(key, dic, _stime24);
}

/// <summary>
/// 刷新特定用户（使用模型）
/// </summary>
public async Task RefreshUser(UserView model)
{
    string key = $"user.{model.id}";
    await AddOrUpdate(key, model, _stime8);
}

#endregion
```

### 5. 接口定义

```csharp
// ICacheReader.cs
public interface ICacheReader
{
    Task<UserView?> GetUserInfo(long id);
    Task<Dictionary<long, UserView>> GetUserDic();
    Task<Dictionary<long, UserView>> GetUserInfo(List<long> ids);
}

// ICacheRefresh.cs
public interface ICacheRefresh
{
    Task RefreshUser(long id);
    Task RefreshUser();
    Task RefreshUser(UserView model);
}
```

---

## 缓存更新策略对比：Cache Invalidation vs Write-Through

以下通过同一业务场景（刷新单个用户缓存）对比两种模式的实现差异。

### Cache Invalidation 模式（推荐）

数据变更时只删除缓存。`GetSingle` 内置 Read-Through 机制，缓存 miss 时自动调用 `func` 查询数据库并写回 Redis。

```csharp
#region Refresh - 用户相关（Cache Invalidation 模式）

/// <summary>
/// 刷新单个用户 — Cache Invalidation 模式
/// 数据变更后只删除缓存，下次 GetUserInfo(id) 时自动触发 Read-Through 加载
/// </summary>
public async Task RefreshUser(long id)
{
    string key = $"user.{id}";
    await RemoveSingle(key);
}

/// <summary>
/// 刷新用户（使用模型）— Write-Through 模式
/// 已有模型数据时直接更新，避免额外查询
/// </summary>
public async Task RefreshUser(UserView model)
{
    string key = $"user.{model.id}";
    await AddOrUpdate(key, model, _stime8);
}

/// <summary>
/// 删除用户缓存
/// </summary>
public async Task RemoveUser(long id)
{
    string key = $"user.{id}";
    await RemoveSingle(key);
}

#endregion
```

**Read-Through 保障链路**：

```
数据变更 → RefreshUser(id) → RemoveSingle("user.123")
                                         ↓
下次请求 GetUserInfo(123)
    → GetSingle("user.123", () => reader.GetUser(123), _stime8)
    → Redis miss → 调用 func → reader.GetUser(123) → 查询数据库
    → 将结果写入 Redis（带 TTL 抖动）
    → 返回最新数据
```

### Write-Through Refresh 模式（备选）

数据变更后主动查询数据库，获取最新数据后用 `AddOrUpdate` 更新缓存。

```csharp
#region Refresh - 用户相关（Write-Through 模式）

/// <summary>
/// 刷新单个用户 — Write-Through 模式
/// 主动查询数据库获取最新数据，然后更新缓存
/// </summary>
public async Task RefreshUser(long id)
{
    string key = $"user.{id}";
    var info = await reader.GetUser(id);
    if (info != null)
    {
        await AddOrUpdate(key, info, _stime8);
    }
    else
    {
        await RemoveSingle(key);
    }
}

/// <summary>
/// 刷新用户（使用模型）— Write-Through 模式
/// </summary>
public async Task RefreshUser(UserView model)
{
    string key = $"user.{model.id}";
    await AddOrUpdate(key, model, _stime8);
}

#endregion
```

### 对比总结

| 维度 | Cache Invalidation | Write-Through |
|------|-------------------|---------------|
| 刷新操作 | `RemoveSingle(key)` | 查询 DB + `AddOrUpdate(key, data, ttl)` |
| 数据库查询 | 刷新时不查询，读取时按需查询 | 刷新时立即查询 |
| 代码复杂度 | 低（一行代码） | 中（需处理 null 判断） |
| 实时性 | 下次读取时生效 | 立即生效 |
| 适用场景 | 变更后不需要立即读取 | 变更后需要立即返回最新数据 |
| 事务安全性 | 高（不依赖事务时序） | 需确保 DB 已提交后再刷新 |
| 多键场景 | 不适合（索引键需同步处理） | 适合（可同时更新所有索引键） |

---

## 扩展场景：部门缓存

部门缓存在基础模式之上增加了两个独特能力：**子部门查询**（从字典中过滤子节点）和**联动刷新**（删除单个缓存时同时刷新整个字典）。View、RedisHandler 的标准查询方法、单个读取、批量读取、按模型刷新等与基础模式一致，此处只展示差异部分。

### 1. 视图模型 (View/DepartmentView.cs)

```csharp
namespace {项目名}.Cache.View
{
    /// <summary>
    /// 部门视图模型
    /// </summary>
    public class DepartmentView
    {
        public long id { get; set; }
        public string name { get; set; }
        public long? parent_id { get; set; }
        public int state { get; set; }
        public int sort { get; set; }
    }
}
```

### 2. RedisHandler 差异：子部门查询

除基础模式的三个标准查询方法（单个、列表、批量）外，部门需要额外的子部门查询：

```csharp
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

### 3. CacheManager 差异：子部门读取 + 联动刷新

```csharp
#region Reader - 部门差异方法

/// <summary>
/// 获取子部门列表（从字典缓存中过滤，无需额外 Redis key）
/// </summary>
public async Task<List<DepartmentView>> GetChildDepartments(long parentId)
{
    var allDepts = await GetDepartmentDic();
    return allDepts.Values.Where(d => d.parent_id == parentId).OrderBy(d => d.sort).ToList();
}

#endregion

#region Refresh - 部门差异方法

/// <summary>
/// 删除部门缓存（联动刷新：同时删除单个缓存和刷新整个字典）
/// </summary>
public async Task RemoveDepartment(long id)
{
    string key = $"department.{id}";
    await RemoveSingle(key);
    // 同时刷新整个字典，确保列表数据一致
    await RefreshDepartment();
}

#endregion
```

### 4. 接口定义

```csharp
// ICacheReader.cs — 部门相关（包含基础模式的三个标准方法 + 子部门查询）
public interface ICacheReader
{
    Task<DepartmentView?> GetDepartmentInfo(long id);
    Task<Dictionary<long, DepartmentView>> GetDepartmentDic();
    Task<Dictionary<long, DepartmentView>> GetDepartmentInfo(List<long> ids);
    Task<List<DepartmentView>> GetChildDepartments(long parentId);
}

// ICacheRefresh.cs — 部门相关（包含基础模式的三个标准方法 + 联动删除）
public interface ICacheRefresh
{
    Task RefreshDepartment(long id);
    Task RefreshDepartment();
    Task RefreshDepartment(DepartmentView model);
    Task RemoveDepartment(long id);
}
```

## 完整示例：用户缓存（带多键场景）

用户缓存通过多个 key（ID、手机号、邮箱）索引同一份数据，刷新时需要处理字段变更导致的 key 迁移。

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

// 注意：多键场景推荐使用 Write-Through 模式（AddOrUpdate），因为需要同步更新所有索引键。
// 如果使用 Cache Invalidation（RemoveSingle），删除某个索引键后，下次通过该索引键读取时
// Read-Through 会触发查询，但其他索引键可能仍然持有旧数据，导致不一致。

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

## 批量操作示例：使用 AddOrUpdateMultiple 和 RemoveMultiple

当需要一次性刷新大量缓存时，使用批量方法比循环调用单个方法更高效：

```csharp
/// <summary>
/// 批量刷新部门缓存
/// </summary>
public async Task RefreshDepartments(List<DepartmentView> departments)
{
    if (departments == null || departments.Count == 0)
        return;

    var items = departments.Select(d =>
        new Tuple<string, DepartmentView>($"department.{d.id}", d)).ToArray();

    await AddOrUpdateMultiple(items, DateTimeOffset.Now.Add(_stime24));
}

/// <summary>
/// 批量删除部门缓存
/// </summary>
public async Task RemoveDepartments(List<long> ids)
{
    if (ids == null || ids.Count == 0)
        return;

    var keys = ids.Select(id => $"department.{id}").ToArray();
    await RemoveMultiple(keys);
}
```

## 使用示例

### 调用技能时的信息提供方式

```
请添加缓存实体：
- 实体名称：Department
- 中文名称：部门
- 主键类型：long
- 数据库表名：t_department
- 字段列表：
  - name (string) - 部门名称
  - state (int) - 状态
  - add_time (DateTime) - 添加时间
- TTL：24小时
- 需要：单个查询、字典查询、批量查询
```

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

        // Cache Invalidation 模式：删除缓存，下次读取时由 Read-Through 自动加载
        // Refresh 方法内部调用 RemoveSingle，GetSingle 的 func 回调保证数据正确性
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

---

## 缓存对象复用示例

本节通过正反例对比，说明如何避免同一实体创建多个字段子集的缓存。

### 反模式：按场景拆分字段子集

假设系统中有两个场景需要用户数据：
- **列表页**：只需要 `id`、`user_name`、`state`
- **详情页**：需要 `id`、`user_name`、`phone`、`email`、`state`、`department_id`、`create_time`、`avatar`

```csharp
// ❌ 反模式：为每个场景创建不同的 View 和不同的缓存 key

namespace {项目名}.Cache.View
{
    /// <summary>
    /// 用户简要信息（列表页使用）
    /// </summary>
    public class UserBriefView
    {
        public long id { get; set; }
        public string user_name { get; set; }
        public int state { get; set; }
    }

    /// <summary>
    /// 用户详细信息（详情页使用）
    /// </summary>
    public class UserDetailView
    {
        public long id { get; set; }
        public string user_name { get; set; }
        public string phone { get; set; }
        public string email { get; set; }
        public int state { get; set; }
        public long department_id { get; set; }
        public DateTime create_time { get; set; }
        public string avatar { get; set; }
    }
}

// RedisHandler 需要两套查询方法：
public async Task<UserBriefView?> GetUserBrief(long id)
{
    var sql = @"SELECT id, user_name, state FROM contract.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserBriefView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

public async Task<UserDetailView?> GetUserDetail(long id)
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id, create_time, avatar
                FROM contract.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserDetailView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

// CacheManager 需要两套 Reader：
public async Task<UserBriefView?> GetUserBriefInfo(long id)
{
    string key = $"user.brief.{id}";
    return await GetSingle(key, () => reader.GetUserBrief(id), _stime8);
}

public async Task<UserDetailView?> GetUserDetailInfo(long id)
{
    string key = $"user.detail.{id}";
    return await GetSingle(key, () => reader.GetUserDetail(id), _stime8);
}

// 刷新时需要维护两个 key：
public async Task RefreshUser(long id)
{
    // 如果只刷新了一个 key，另一个 key 持有旧数据，导致不一致
    await RemoveSingle($"user.brief.{id}");
    await RemoveSingle($"user.detail.{id}");
    // 维护成本随场景数量线性增长
}
```

**问题总结**：
- Redis 中同一用户存了两份数据（`user.brief.123` 和 `user.detail.123`），内存浪费
- 数据库查询了两次（一次查 3 字段，一次查 8 字段），查询冗余
- 刷新时需要维护多个 key，容易遗漏，导致数据不一致
- 每增加一个场景，就要新增 View + RedisHandler 方法 + CacheManager 方法 + 接口

### 正确做法：统一 View + 统一 key

View 定义和 RedisHandler 查询方法与「基础模式」完全一致——只需一个 `UserView`（包含所有 8 个字段）和一套标准查询方法。差异仅在刷新和消费方式：

```csharp
// 刷新时只需处理一个 key（对比反模式需要维护多个 key）
public async Task RefreshUser(long id)
{
    await RemoveSingle($"user.{id}");
}

// 消费方按需取字段——不需要为不同场景创建不同 View：
// 列表页：只用 id、user_name、state
var userInfo = await _cacheReader.GetUserInfo(id);
var displayName = userInfo?.user_name;

// 详情页：使用全部字段
var userInfo = await _cacheReader.GetUserInfo(id);
return new UserDetailResponse
{
    user_name = userInfo.user_name,
    phone = userInfo.phone,
    email = userInfo.email,
    department_id = userInfo.department_id,
    avatar = userInfo.avatar
};
```

### 复用决策速查

| 情况 | 做法 | 示例 |
|------|------|------|
| 同一实体，不同消费方需要不同字段 | 合并为一个 View，消费方按需取字段 | 用户缓存统一 `UserView` |
| 同一实体，通过不同字段索引 | 同一个 View，多个 key 指向同一份数据 | `user.{id}` 和 `user.phone.{phone}` |
| 不同实体 | 各自独立缓存 | `UserView` 和 `DepartmentView` |
| 同一实体但 TTL 差异极大（如 10 分钟 vs 24 小时） | 可考虑拆分，但需有充分理由 | 高频变化的积分 vs 稳定的基本信息 |
