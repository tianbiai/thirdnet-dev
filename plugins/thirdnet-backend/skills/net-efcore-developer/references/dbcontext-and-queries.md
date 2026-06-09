# DbContext 配置与原生 SQL 查询参考

## 目录

1. [AdminDbContext 模板](#admin-dbcontext-模板)
2. [ServiceDbContext 模板](#service-dbcontext-模板)
3. [DbContext 注册](#dbcontext-注册)
4. [连接字符串配置](#连接字符串配置)
5. [迁移自动应用](#迁移自动应用)
6. [原生 SQL 查询模式](#原生-sql-查询模式)

---

## AdminDbContext 模板

AdminDbContext 使用 `HasDefaultSchema("admin")`，所有表自动归属 admin schema：

```csharp
using Microsoft.EntityFrameworkCore;
using {ProjectName}.Admin.Database.Configurations;

namespace {ProjectName}.Admin.Database
{
    /// <summary>
    /// Admin 主数据库上下文。
    /// <para>默认 schema: admin。所有 EntityConfiguration 中无需再指定 schema。</para>
    /// </summary>
    public class AdminDbContext : DbContext
    {
        public AdminDbContext(DbContextOptions<AdminDbContext> options) : base(options) { }

        // DbSet 属性
        public DbSet<SysUserModel> SysUsers { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasDefaultSchema("admin");
            // 自动扫描程序集中所有 IConfiguration<T> 实现类
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(AdminDbContext).Assembly);

            // xmin 并发令牌 — 自动对所有实体注册
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
                modelBuilder.Entity(entityType.ClrType, b =>
                    b.Property<uint>("xmin").IsRowVersion().ValueGeneratedOnAddOrUpdate());
        }
    }
}
```

## ServiceDbContext 模板

微服务项目使用自定义 schema（如 `contract`、`product`），需要在每个 `ToTable()` 中显式指定：

```csharp
using Microsoft.EntityFrameworkCore;
using ContractService.Database.Configurations;

namespace ContractService.Database
{
    /// <summary>
    /// 合同服务数据库上下文。
    /// <para>自定义 schema: contract。每个 EntityConfiguration 的 ToTable 必须显式指定。</para>
    /// </summary>
    public class ContractDbContext : DbContext
    {
        public ContractDbContext(DbContextOptions<ContractDbContext> options) : base(options) { }

        public DbSet<ContractModel> Contracts { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Service 项目可使用 HasDefaultSchema，也可在每个 ToTable 中分别指定
            modelBuilder.HasDefaultSchema("contract");
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(ContractDbContext).Assembly);
        }
    }
}
```

> **Admin vs Service 的 schema 区别**：Admin 项目使用 `HasDefaultSchema("admin")` 后，EntityConfiguration 的 `ToTable("t_xxx")` 无需再写 schema 名称。Service 项目使用自定义 schema 时同理——设置了 `HasDefaultSchema` 后就无需在每个配置中重复。仅在需要跨 schema 访问时才在 `ToTable` 中显式指定第二个参数。

## DbContext 注册

**必须**使用 `AddPooledDbContextFactory`（非 `AddDbContextPool` 或直接注入 `DbContext`）：

```csharp
// 在 Startup.cs 的 ConfigureServices 方法中

// 注册主数据库
services.AddPooledDbContextFactory<AdminDbContext>(options =>
{
    options.UseNpgsql(Configuration.GetConnectionString("ConnectionString"),
        b => b.MigrationsAssembly("{ProjectName}.Admin.Database"));
});

// 注册缓存查询用 DbContext（共享连接字符串，无需迁移）
services.AddPooledDbContextFactory<CacheDbContext>(options =>
{
    options.UseNpgsql(Configuration.GetConnectionString("ConnectionString"));
});

// 微服务项目注册（指定独立迁移程序集）
services.AddPooledDbContextFactory<ContractDbContext>(options =>
{
    options.UseNpgsql(Configuration.GetConnectionString("ConnectionString"),
        b => b.MigrationsAssembly("ContractService.Database"));
});
```

在 Service 中通过 `IDbContextFactory<T>` 获取 DbContext 实例：

```csharp
public class SomeService
{
    private readonly IDbContextFactory<AdminDbContext> _dbFactory;

    public SomeService(IDbContextFactory<AdminDbContext> dbFactory)
    {
        _dbFactory = dbFactory;
    }

    public async Task DoSomethingAsync()
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        // ... 使用 db 操作数据库
    }
}
```

**为什么用 Pooled DbContextFactory？**
- 性能更好：DbContext 实例被池化复用，避免频繁创建/销毁
- 生命周期安全：每次操作获取独立实例，避免长生命周期 DbContext 导致的并发问题
- 与 ThirdNet.Vibe 框架的 `InitializeDatabasesAsync` 兼容

## 连接字符串配置

在 `appsettings.json` 中：

```json
{
  "DefaultConnectionString": "框架配置库连接字符串",
  "ConnectionString": "主业务数据库连接字符串"
}
```

| Key 名称 | 用途 |
|---------|------|
| `DefaultConnectionString` | 框架内置配置库（由框架自动使用） |
| `ConnectionString` | 服务主业务数据库（Admin 和 Service 均使用此 Key） |

> **注意**：ThirdNet 框架约定使用 `ConnectionString`（非 `DefaultConnectionString`）作为主业务数据库的连接字符串。`DefaultConnectionString` 由框架内部管理，开发者通常无需直接操作。

## 迁移自动应用

**禁止手动执行迁移命令**。框架通过 `InitializeDatabasesAsync()` 在应用启动时自动应用迁移：

```csharp
// 在 Program.cs 中（Admin 项目）
var host = AdminHostBuilder.BuildAdminWebHost<Startup>(args);
await host.InitializeDatabasesAsync();           // 框架数据库自动迁移
await host.RunAsync();

// 在 Program.cs 中（Service 项目）
var host = AdminHostBuilder.BuildAdminWebHost<Startup>(args);
await host.InitializeDatabasesAsync();
await host.RunAsync();
```

`InitializeDatabasesAsync` 会自动发现所有已注册的 DbContext 并执行 `Database.Migrate()`。

## 原生 SQL 查询模式

SQL 查询中表名必须带 schema 前缀。视图模型命名：`{Entity}View`。

> **schema 前缀**：Admin 项目使用 `admin.t_xxx`，Service 项目使用各自的自定义 schema（如 `contract.t_xxx`）。以下示例均使用 Admin 的 `admin.` 前缀，Service 项目请替换为对应 schema。

```csharp
// 单条查询
var sql = @"SELECT * FROM admin.t_sys_user WHERE id = {0}";
return await _db.Database.SqlQueryRaw<UserView>(sql, id)
    .AsNoTracking().FirstOrDefaultAsync();

// 列表查询
var sql = @"SELECT * FROM admin.t_sys_user WHERE status = 0";
return await _db.Database.SqlQueryRaw<UserView>(sql)
    .AsNoTracking().ToListAsync();

// 批量查询（PostgreSQL ANY）
var sql = @"SELECT * FROM admin.t_sys_user WHERE id = ANY(@ids)";
return await _db.Database.SqlQueryRaw<UserView>(
    sql, new NpgsqlParameter("ids", ids)).AsNoTracking().ToListAsync();

// 多表 JOIN
var sql = @"SELECT u.id, u.user_name, d.name as department_name
            FROM admin.t_sys_user u
            LEFT JOIN admin.t_sys_department d ON u.department_id = d.id
            WHERE u.status = 0";
return await _db.Database.SqlQueryRaw<UserWithDeptView>(sql)
    .AsNoTracking().ToListAsync();

// 字典查询
var list = await _db.Database.SqlQueryRaw<UserView>(
    @"SELECT * FROM admin.t_sys_user WHERE status = 0").AsNoTracking().ToListAsync();
return list.ToDictionary(f => f.id, f => f);
```

### 参数绑定方式

| 方式 | 示例 | 适用场景 |
|------|------|----------|
| 位置参数 `{0}` | `SqlQueryRaw<UserView>(sql, id)` | 单参数、简单查询 |
| NpgsqlParameter | `SqlQueryRaw<UserView>(sql, new NpgsqlParameter("ids", ids))` | 数组参数（ANY）、需指定类型 |
| 字符串插值 | `SqlQueryRaw<UserView>($@"... WHERE id = {id}")` | EF Core 会自动参数化，与位置参数等效 |
