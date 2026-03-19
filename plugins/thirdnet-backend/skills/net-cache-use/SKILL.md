---
name: net-cache-use
description: 缓存功能开发专家，为业务实体添加完整的 Redis 缓存功能。**主动用于**：字典数据缓存、配置信息缓存、高频查询数据缓存、性能优化。当用户提到"缓存"、"Cache"、"Redis"、"字典"、"配置"、"高频查询"、"性能优化"时，必须使用此技能。
---
## 使用场景

- **字典数据缓存**：部门、角色、地区等参考数据
- **配置信息缓存**：系统配置、业务参数
- **高频查询数据**：用户信息、商品信息
- **性能优化**：减少数据库查询、提升响应速度

## 核心功能

生成符合三层架构的缓存代码：

- **Interface 层**：`ICacheReader`（读取接口）、`ICacheRefresh`（刷新接口）
- **Cache 层**：`CacheManager`（缓存管理器）
- **Data 层**：`RedisHandler`（数据查询）、`View`（视图模型）

## 执行步骤

### 步骤 1：收集实体信息

**必需信息**：

| 信息             | 说明                          | 示例                               |
| ---------------- | ----------------------------- | ---------------------------------- |
| 实体名称（英文） | 用于类命名                    | `User`、`Role`、`Department` |
| 主键类型         | 通常是 `long` 或 `string` | `long`                           |
| 数据库表名       | PostgreSQL 表名               | `t_user`、`t_role`             |
| 字段列表         | 实体包含的所有字段            | `id`、`name`、`state`        |

**可选信息**：

| 信息             | 说明                                     |
| ---------------- | ---------------------------------------- |
| 唯一索引字段     | 除主键外的唯一查询字段（如手机号、账号） |
| TTL 时长         | 缓存过期时间                             |
| 是否需要嵌套结构 | 是否需要树形结构或复杂关联               |
| 自定义查询条件   | 是否需要 JOIN、WHERE 等复杂查询          |

### 步骤 2：生成缓存视图模型

在 `View/` 目录下创建 `{Entity}View.cs`：

```csharp
/// <summary>
/// 用户视图模型
/// </summary>
public class UserView
{
    /// <summary>
    /// 主键ID
    /// </summary>
    public long id { get; set; }

    /// <summary>
    /// 用户名
    /// </summary>
    public string user_name { get; set; }

    /// <summary>
    /// 状态
    /// </summary>
    public int state { get; set; }
}
```

**要点**：

- 类名以 `View` 结尾
- 属性名使用小写（与数据库字段一致）
- 必须包含 `id` 属性

### 步骤 3：实现 RedisHandler 查询方法

在 `RedisHandler.cs` 中添加查询方法：

```csharp
/// <summary>
/// 获取单个用户
/// </summary>
public async Task<UserView> GetUser(long id)
{
    var sql = @"SELECT * FROM public.t_user WHERE id = {0}";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

/// <summary>
/// 获取用户列表
/// </summary>
public async Task<Dictionary<long, UserView>> GetUserList()
{
    var sql = @"SELECT * FROM public.t_user";
    var list = await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql)
        .AsNoTracking()
        .ToListAsync();
    return list.ToDictionary(f => f.id, f => f);
}

/// <summary>
/// 批量获取用户
/// </summary>
public async Task<List<UserView>> GetUsers(List<long> ids)
{
    var sql = @"SELECT * FROM public.t_user WHERE id = ANY(@ids)";
    return await _dbcontext.Database
        .SqlQueryRaw<UserView>(sql, new NpgsqlParameter("ids", ids))
        .AsNoTracking()
        .ToListAsync();
}
```

### 步骤 4：实现 CacheManager 读取方法

在 `CacheManager.cs` 的 Reader 部分添加：

```csharp
#region Reader - 用户相关

/// <summary>
/// 获取单个用户
/// </summary>
public async Task<UserView> GetUserInfo(long id)
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
    string key = "user.";
    var dic = await GetMultiple(
        ids.Distinct().Select(s => $"{key}{s}").ToArray(),
        func,
        DateTime.Now.AddHours(8)
    );
    return dic.ToDictionary(f => long.Parse(f.Key.Replace(key, "")), v => v.Value);

    async Task<IDictionary<string, UserView>> func(string[] keys)
    {
        var ids = keys.Select(s => long.Parse(s.Replace(key, ""))).ToList();
        using var dbcontext = new CacheViewDBContext(viewDbOp);
        var sql = @"SELECT * FROM public.t_user WHERE id = ANY(@ids)";
        var list = await dbcontext.Database
            .SqlQueryRaw<UserView>(sql, new NpgsqlParameter("ids", ids))
            .AsNoTracking()
            .ToListAsync();
        return list.ToDictionary(f => $"{key}{f.id}");
    }
}

#endregion
```

### 步骤 5：实现 CacheManager 刷新方法

在 `CacheManager.cs` 的 Refresh 部分添加：

```csharp
#region Refresh - 用户相关

/// <summary>
/// 刷新单个用户
/// </summary>
public async Task RefreshUser(long id)
{
    string key = $"user.{id}";
    var info = await reader.GetUser(id);
    await AddOrUpdate(key, info, _stime8);
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

## TTL 选择指南

| TTL 变量      | 时长   | 适用场景                           |
| ------------- | ------ | ---------------------------------- |
| `_stime010` | 10分钟 | 临时会话数据                       |
| `_stime2`   | 2小时  | 外部 API Token                     |
| `_stime8`   | 8小时  | 用户相关数据（房屋、住户、积分）   |
| `_stime24`  | 24小时 | 大部分参考数据（字典、配置、角色） |

## 代码审查清单

### 文件结构

- [ ] 在 `View/` 创建了 `{Entity}View.cs`
- [ ] 在 `RedisHandler.cs` 添加了查询方法
- [ ] 在 `CacheManager.cs` 添加了 Reader 和 Refresh 方法
- [ ] 在 `ICacheReader.cs` 添加了接口定义
- [ ] 在 `ICacheRefresh.cs` 添加了接口定义

### 代码质量

- [ ] 缓存键命名符合规范（小写、点号分隔）
- [ ] 使用了正确的 TTL（根据数据特性）
- [ ] 所有查询使用了 `AsNoTracking()`
- [ ] 多键场景更新了所有相关键
- [ ] 添加了完整的 XML 注释

### 性能优化

- [ ] 批量查询使用了 PostgreSQL `ANY` 数组参数
- [ ] 所有查询使用原生 SQL
- [ ] 大批量数据考虑了分批处理

## 使用示例

### 调用技能

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

### 业务代码调用

```csharp
public class DepartmentService
{
    private readonly ICacheReader _cacheReader;
    private readonly ICacheRefresh _cacheRefresh;

    // 获取单个部门
    public async Task<DepartmentView> GetDepartment(long id)
    {
        return await _cacheReader.GetDepartmentInfo(id);
    }

    // 获取所有部门字典
    public async Task<Dictionary<long, DepartmentView>> GetAllDepartments()
    {
        return await _cacheReader.GetDepartmentDic();
    }

    // 批量获取部门
    public async Task<Dictionary<long, DepartmentView>> GetDepartments(List<long> ids)
    {
        return await _cacheReader.GetDepartmentInfo(ids);
    }

    // 更新部门后刷新缓存
    public async Task UpdateDepartment(DepartmentView dept)
    {
        // 1. 更新数据库
        await _dbcontext.SaveChangesAsync();

        // 2. 刷新缓存
        await _cacheRefresh.RefreshDepartment(dept);
    }
}
```

## ⚠️ 重要注意事项

### 禁止使用数据验证注解

本项目**严格禁止**在实体模型中使用数据验证相关的注解（如 `[Required]`、`[MaxLength]`、`[Key]` 等），所有数据库配置必须通过 Fluent API 实现。

**例外**：`[DbBulk]` 特性是批量操作框架的特殊要求，**不是数据验证注解**，可以安全使用。

### 必须遵循的规范

1. **命名规范**

   - 缓存键必须小写，使用点号分隔
   - 类名以 `View` 结尾
   - 属性名使用小写（与数据库一致）
2. **性能规范**

   - 必须使用 `AsNoTracking()`
   - 批量查询使用 `ANY` 语句
   - 避免循环查询
3. **一致性规范**

   - 数据变更后立即刷新缓存
   - 多键场景更新所有相关键
   - 使用正确的 TTL

## 详细示例

完整的缓存实现示例（包括多键场景、树形结构等），请参阅：`references/cache-examples.md`
