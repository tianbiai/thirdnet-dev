# DbContext 配置与原生 SQL 查询参考

## DbContext 模板

```csharp
using Microsoft.EntityFrameworkCore;
using ContractService.Database.Models;
using ContractService.Database.Configurations;

namespace ContractService.Database
{
    /// <summary>
    /// 合同服务数据库上下文
    /// </summary>
    public class ContractDbContext : DbContext
    {
        public ContractDbContext(DbContextOptions<ContractDbContext> options) : base(options) { }

        public DbSet<UserInfoModel> UserInfo { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfiguration(new UserInfoConfiguration());
        }
    }
}
```

## DbContext 注册

在 `Startup.cs` 的 `ConfigureServices` 方法中：

```csharp
// 注册主数据库
services.AddDbContextPool<ContractDbContext>(options =>
    options.UseNpgsql(Configuration.GetConnectionString("ConnectionString")));

// 注册其他数据库（如需要）
services.AddDbContextPool<LogDbContext>(options =>
    options.UseNpgsql(Configuration.GetConnectionString("LogConnectionString")));
```

## 连接字符串配置

在 `appsettings.json` 中：

```json
{
  "DefaultConnectionString": "框架配置库连接字符串",
  "ConnectionString": "主业务数据库连接字符串",
  "LogConnectionString": "其他数据库连接字符串（按需配置）"
}
```

| Key 名称 | 用途 |
|---------|------|
| `DefaultConnectionString` | 框架内置配置库 |
| `ConnectionString` | 服务主业务数据库 |
| `{业务名}ConnectionString` | 其他业务数据库 |

## 迁移自动应用

在 `Startup.cs` 的 `Configure` 方法中自动应用迁移，禁止手动执行迁移命令：

```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    using (var serviceScope = app.ApplicationServices.GetService<IServiceScopeFactory>().CreateScope())
    {
        serviceScope.ServiceProvider.GetRequiredService<ContractDbContext>().Database.Migrate();
        // 多 DbContext 时逐个注册
        serviceScope.ServiceProvider.GetRequiredService<AuditDbContext>().Database.Migrate();
    }
    // ... 其他中间件配置
}
```

## 原生 SQL 查询模式

SQL 查询中表名必须带 schema 前缀（如 `contract.t_user_info`）。视图模型命名：`{Entity}View`。

```csharp
// 单条查询
var sql = @"SELECT * FROM contract.t_user_info WHERE id = {0}";
return await _dbcontext.Database.SqlQueryRaw<UserView>(sql, id)
    .AsNoTracking().FirstOrDefaultAsync();

// 列表查询
var sql = @"SELECT * FROM contract.t_user_info";
return await _dbcontext.Database.SqlQueryRaw<UserView>(sql)
    .AsNoTracking().ToListAsync();

// 批量查询（PostgreSQL ANY）
var sql = @"SELECT * FROM contract.t_user_info WHERE id = ANY(@ids)";
return await _dbcontext.Database.SqlQueryRaw<UserView>(
    sql, new NpgsqlParameter("ids", ids)).AsNoTracking().ToListAsync();

// 多表 JOIN
var sql = @"SELECT u.id, u.user_name, d.name as department_name
            FROM contract.t_user_info u
            LEFT JOIN contract.t_department d ON u.department_id = d.id";
return await _dbcontext.Database.SqlQueryRaw<UserWithDeptView>(sql)
    .AsNoTracking().ToListAsync();

// 字典查询
var list = await _dbcontext.Database.SqlQueryRaw<UserView>(
    @"SELECT * FROM contract.t_user_info").AsNoTracking().ToListAsync();
return list.ToDictionary(f => f.id, f => f);
```
