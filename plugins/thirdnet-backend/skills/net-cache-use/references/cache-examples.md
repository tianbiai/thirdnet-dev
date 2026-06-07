# 缓存实现详细示例

本文件包含完整的缓存实现代码示例，作为 SKILL.md 的补充参考。

所有示例基于 `RedisCacheManager` 基类（`ThirdNet.Core.Common` 命名空间），每个领域实体创建一个自包含的 `{Domain}Cache` 类，内含 DB 查询、缓存读取、缓存删除全部逻辑。

## 目录

- [基础模式：用户缓存](#基础模式用户缓存) — 自包含 Cache 类的标准实现
- [扩展场景：部门缓存](#扩展场景部门缓存) — 子部门查询 + 联动删除（基于基础模式的差异部分）
- [多键场景：用户缓存（多索引）](#多键场景用户缓存多索引) — 多 key 索引同一数据
- [树形结构：地区缓存](#树形结构地区缓存) — 扁平数据构建树
- [批量操作](#批量操作) — 批量删除和批量写入
- [Controller 中使用缓存](#controller-中使用缓存) — API 层调用示例
- [缓存对象复用示例](#缓存对象复用示例) — 消除冗余查询与缓存键的正反例对比

---

## 基础模式：用户缓存

以下是最标准的缓存实现模式：View → 自包含的 `UserCache`（Query + Reader + Remove）。

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

### 2. 自包含缓存类 (UserCache.cs)

```csharp
namespace {项目名}.Cache
{
    /// <summary>
    /// 用户缓存
    /// </summary>
    public class UserCache : RedisCacheManager
    {
        private readonly DbContext _dbcontext;

        public UserCache(DbContext dbcontext, /* RedisCacheManager 依赖 */)
        {
            _dbcontext = dbcontext;
        }

        #region Query - 数据库查询（私有）

        /// <summary>
        /// 查询单个用户
        /// </summary>
        private async Task<UserView?> QueryUser(long id)
        {
            var sql = @"SELECT * FROM contract.t_user WHERE id = {0}";
            return await _dbcontext.Database
                .SqlQueryRaw<UserView>(sql, id)
                .AsNoTracking()
                .FirstOrDefaultAsync();
        }

        /// <summary>
        /// 查询用户列表（返回字典）
        /// </summary>
        private async Task<Dictionary<long, UserView>> QueryUserList()
        {
            var sql = @"SELECT * FROM contract.t_user";
            var list = await _dbcontext.Database
                .SqlQueryRaw<UserView>(sql)
                .AsNoTracking()
                .ToListAsync();
            return list.ToDictionary(f => f.id, f => f);
        }

        /// <summary>
        /// 批量查询用户（用于 GetMultiple 的 func 回调）
        /// </summary>
        private async Task<List<UserView>> QueryUsers(List<long> ids)
        {
            var sql = @"SELECT * FROM contract.t_user WHERE id = ANY(@ids)";
            return await _dbcontext.Database
                .SqlQueryRaw<UserView>(sql, new NpgsqlParameter("ids", ids))
                .AsNoTracking()
                .ToListAsync();
        }

        #endregion

        #region Reader - 缓存读取（公开）

        /// <summary>
        /// 获取单个用户
        /// </summary>
        public async Task<UserView?> GetUserInfo(long id)
        {
            return await GetSingle($"user.{id}", () => QueryUser(id), _stime8);
        }

        /// <summary>
        /// 获取用户字典
        /// </summary>
        public async Task<Dictionary<long, UserView>> GetUserDic()
        {
            return await GetSingle("user", QueryUserList, _stime24);
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
                var list = await QueryUsers(ids);
                return list.ToDictionary(f => $"{key}{f.id}");
            }
        }

        #endregion

        #region Remove - 缓存删除（公开）

        /// <summary>
        /// 删除用户缓存
        /// 下次 GetUserInfo 时由 Read-Through 自动加载最新数据
        /// </summary>
        public async Task RemoveUser(long id)
        {
            await RemoveSingle($"user.{id}");
        }

        /// <summary>
        /// 批量删除用户缓存
        /// 优先使用 RemoveMultiple，一次 Redis 网络往返替代 N 次
        /// </summary>
        public async Task RemoveUsers(List<long> ids)
        {
            if (ids == null || ids.Count == 0)
                return;

            var keys = ids.Distinct().Select(id => $"user.{id}").ToArray();
            await RemoveMultiple(keys);
        }

        /// <summary>
        /// 删除整个用户字典缓存
        /// </summary>
        public async Task RemoveUserDic()
        {
            await RemoveSingle("user");
        }

        #endregion
    }
}
```

---

## 扩展场景：部门缓存

部门缓存在基础模式之上增加了两个独特能力：**子部门查询**（从字典中过滤子节点）和**联动删除**（删除单个缓存时同时删除整个字典缓存）。View 和标准 Query/Reader/Remove 方法与基础模式一致，此处只展示差异部分。

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

### 2. DepartmentCache 差异方法

除基础模式的标准 Query/Reader/Remove 方法外，部门需要额外的子部门查询和联动删除：

```csharp
#region Query - 部门差异方法

/// <summary>
/// 查询子部门列表
/// </summary>
private async Task<List<DepartmentView>> QueryChildDepartments(long parentId)
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

#endregion

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

#region Remove - 部门差异方法

/// <summary>
/// 删除部门缓存（联动删除：同时删除单个缓存和整个字典）
/// 使用 RemoveMultiple 一次完成，减少网络往返
/// </summary>
public async Task RemoveDepartmentWithDic(long id)
{
    await RemoveMultiple(new[] { $"department.{id}", "department" });
}

/// <summary>
/// 批量删除部门缓存
/// </summary>
public async Task RemoveDepartments(List<long> ids)
{
    if (ids == null || ids.Count == 0)
        return;

    var keys = ids.Distinct().Select(id => $"department.{id}").ToArray();
    await RemoveMultiple(keys);
}

#endregion
```

## 多键场景：用户缓存（多索引）

用户缓存通过多个 key（ID、手机号、邮箱）索引同一份数据，删除时需要处理所有关联 key。

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

### 2. UserCache（多键管理）

```csharp
public class UserCache : RedisCacheManager
{
    private readonly DbContext _dbcontext;

    public UserCache(DbContext dbcontext, /* RedisCacheManager 依赖 */)
    {
        _dbcontext = dbcontext;
    }

    #region Query - 多键查询

    /// <summary>
    /// 根据ID查询用户
    /// </summary>
    private async Task<UserView?> QueryUser(long id)
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
    /// 根据手机号查询用户
    /// </summary>
    private async Task<UserView?> QueryUserByPhone(string phone)
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
    /// 根据邮箱查询用户
    /// </summary>
    private async Task<UserView?> QueryUserByEmail(string email)
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
    /// 查询用户列表
    /// </summary>
    private async Task<Dictionary<long, UserView>> QueryUserList()
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

    #endregion

    #region Reader - 多键读取

    /// <summary>
    /// 根据ID获取用户
    /// </summary>
    public async Task<UserView?> GetUserInfo(long id)
    {
        return await GetSingle($"user.{id}", () => QueryUser(id), _stime8);
    }

    /// <summary>
    /// 根据手机号获取用户
    /// </summary>
    public async Task<UserView?> GetUserByPhone(string phone)
    {
        return await GetSingle($"user.phone.{phone}", () => QueryUserByPhone(phone), _stime8);
    }

    /// <summary>
    /// 根据邮箱获取用户
    /// </summary>
    public async Task<UserView?> GetUserByEmail(string email)
    {
        return await GetSingle($"user.email.{email}", () => QueryUserByEmail(email), _stime8);
    }

    #endregion

    #region Remove - 多键删除

    // 注意：多键场景删除时必须同时删除所有关联 key，
    // 否则某个索引键仍持有旧数据，导致不一致。
    // 使用 RemoveMultiple 一次完成所有 key 的删除，减少网络往返。

    /// <summary>
    /// 删除用户缓存（删除所有索引键）
    /// 收集所有关联 key 后一次 RemoveMultiple 完成
    /// </summary>
    public async Task RemoveUser(long id)
    {
        var keys = new List<string> { $"user.{id}" };

        // 先尝试获取当前缓存数据，用于清理辅助索引键
        var cached = await GetUserInfo(id);
        if (cached != null)
        {
            if (!string.IsNullOrEmpty(cached.phone))
                keys.Add($"user.phone.{cached.phone}");
            if (!string.IsNullOrEmpty(cached.email))
                keys.Add($"user.email.{cached.email}");
        }

        await RemoveMultiple(keys.ToArray());
    }

    /// <summary>
    /// 批量删除用户缓存（含索引键清理）
    /// </summary>
    public async Task RemoveUsers(List<long> ids)
    {
        if (ids == null || ids.Count == 0)
            return;

        var allKeys = new List<string>();
        foreach (var id in ids.Distinct())
        {
            allKeys.Add($"user.{id}");
            var cached = await GetUserInfo(id);
            if (cached != null)
            {
                if (!string.IsNullOrEmpty(cached.phone))
                    allKeys.Add($"user.phone.{cached.phone}");
                if (!string.IsNullOrEmpty(cached.email))
                    allKeys.Add($"user.email.{cached.email}");
            }
        }

        await RemoveMultiple(allKeys.ToArray());
    }

    #endregion
}
```

## 树形结构：地区缓存

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

### 2. RegionCache（带树形结构）

```csharp
public class RegionCache : RedisCacheManager
{
    private readonly DbContext _dbcontext;

    public RegionCache(DbContext dbcontext, /* RedisCacheManager 依赖 */)
    {
        _dbcontext = dbcontext;
    }

    #region Query

    /// <summary>
    /// 查询单个地区
    /// </summary>
    private async Task<RegionView?> QueryRegion(long id)
    {
        var sql = @"SELECT * FROM contract.t_region WHERE id = {0}";
        return await _dbcontext.Database
            .SqlQueryRaw<RegionView>(sql, id)
            .AsNoTracking()
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// 查询地区列表
    /// </summary>
    private async Task<Dictionary<long, RegionView>> QueryRegionList()
    {
        var sql = @"SELECT * FROM contract.t_region ORDER BY sort";
        var list = await _dbcontext.Database
            .SqlQueryRaw<RegionView>(sql)
            .AsNoTracking()
            .ToListAsync();
        return list.ToDictionary(f => f.id, f => f);
    }

    #endregion

    #region Reader

    /// <summary>
    /// 获取单个地区
    /// </summary>
    public async Task<RegionView?> GetRegionInfo(long id)
    {
        return await GetSingle($"region.{id}", () => QueryRegion(id), _stime24);
    }

    /// <summary>
    /// 获取地区树形结构
    /// </summary>
    public async Task<List<RegionView>> GetRegionTree()
    {
        return await GetSingle("region.tree", BuildRegionTree, _stime24);
    }

    /// <summary>
    /// 构建地区树形结构
    /// </summary>
    private async Task<List<RegionView>> BuildRegionTree()
    {
        var all = await QueryRegionList();
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

    #region Remove

    /// <summary>
    /// 删除地区缓存（同时删除单个缓存和树形缓存）
    /// 使用 RemoveMultiple 一次完成，减少网络往返
    /// </summary>
    public async Task RemoveRegion(long id)
    {
        await RemoveMultiple(new[] { $"region.{id}", "region.tree" });
    }

    #endregion
}
```

## 批量操作

当需要一次性删除大量缓存时，使用基类的 `RemoveMultiple` / `AddOrUpdateMultiple` 批量方法：

```csharp
#region Remove - 批量操作

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

/// <summary>
/// 批量写入部门缓存（特殊场景，如批量导入后主动填充缓存）
/// </summary>
public async Task WriteDepartments(List<DepartmentView> departments)
{
    if (departments == null || departments.Count == 0)
        return;

    var items = departments.Select(d =>
        new Tuple<string, DepartmentView>($"department.{d.id}", d)).ToArray();

    await AddOrUpdateMultiple(items, DateTimeOffset.Now.Add(_stime24));
}

#endregion
```

## Controller 中使用缓存

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

### Controller 示例

```csharp
[ApiController]
[Route("api/manager/department")]
public class DepartmentController : ControllerBase
{
    private readonly DepartmentCache _departmentCache;
    private readonly DepartmentDbContext _dbContext;

    /// <summary>
    /// 获取部门列表
    /// </summary>
    [HttpGet("list")]
    public async Task<IActionResult> GetList()
    {
        var dic = await _departmentCache.GetDepartmentDic();
        return Ok(dic.Values);
    }

    /// <summary>
    /// 获取部门详情
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(long id)
    {
        var dept = await _departmentCache.GetDepartmentInfo(id);
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

        // 删除字典缓存，下次读取时由 Read-Through 自动加载
        await _departmentCache.RemoveDepartmentDic();

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

        // 删除缓存，下次 GetDepartmentInfo 时由 Read-Through 自动加载最新数据
        await _departmentCache.RemoveDepartment(request.id);

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

        // 删除缓存（联动删除单个缓存 + 字典缓存）
        await _departmentCache.RemoveDepartmentWithDic(id);

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

// UserCache 内需要两套 Query 方法：
private async Task<UserBriefView?> QueryUserBrief(long id)
{
    var sql = @"SELECT id, user_name, state FROM contract.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserBriefView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

private async Task<UserDetailView?> QueryUserDetail(long id)
{
    var sql = @"SELECT id, user_name, phone, email, state, department_id, create_time, avatar
                FROM contract.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserDetailView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

// 需要两套 Reader 方法：
public async Task<UserBriefView?> GetUserBriefInfo(long id)
{
    return await GetSingle($"user.brief.{id}", () => QueryUserBrief(id), _stime8);
}

public async Task<UserDetailView?> GetUserDetailInfo(long id)
{
    return await GetSingle($"user.detail.{id}", () => QueryUserDetail(id), _stime8);
}

// 删除时需要维护两个 key：
public async Task RemoveUser(long id)
{
    // 逐个 RemoveSingle，两次网络往返
    await RemoveSingle($"user.brief.{id}");
    await RemoveSingle($"user.detail.{id}");
    // 维护成本随场景数量线性增长
}
```

**问题总结**：
- Redis 中同一用户存了两份数据（`user.brief.123` 和 `user.detail.123`），内存浪费
- 数据库查询了两次（一次查 3 字段，一次查 8 字段），查询冗余
- 删除时需要维护多个 key，容易遗漏，导致数据不一致
- 每增加一个场景，就要新增 View + Query 方法 + Reader 方法

### 正确做法：统一 View + 统一 key

View 定义和 Query 方法与「基础模式」完全一致——只需一个 `UserView`（包含所有 8 个字段）和一套标准查询方法。差异仅在删除和消费方式：

```csharp
// 删除时只需处理一个 key（对比反模式需要维护多个 key）
public async Task RemoveUser(long id)
{
    await RemoveSingle($"user.{id}");
}

// 批量删除也只需一个 RemoveMultiple
public async Task RemoveUsers(List<long> ids)
{
    var keys = ids.Distinct().Select(id => $"user.{id}").ToArray();
    await RemoveMultiple(keys);
}

// 消费方按需取字段——不需要为不同场景创建不同 View：
// 列表页：只用 id、user_name、state
var userInfo = await _userCache.GetUserInfo(id);
var displayName = userInfo?.user_name;

// 详情页：使用全部字段
var userInfo = await _userCache.GetUserInfo(id);
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
| 不同实体 | 各自独立缓存 | `UserCache` 和 `DepartmentCache` |
| 同一实体但 TTL 差异极大（如 10 分钟 vs 24 小时） | 可考虑拆分，但需有充分理由 | 高频变化的积分 vs 稳定的基本信息 |
