---
name: net-efcore-developer
description: EF Core 数据库开发专家，负责创建实体模型（Model）、Fluent API 配置、DbContext 和迁移文件。**主动用于**：创建数据库实体、定义表结构、配置字段映射、生成迁移。当用户提到"实体"、"数据库实体"、"Entity"、"DbContext"、"迁移"、"Migration"、"表结构"、"数据库设计"、"建表"、"新建表"、"加字段"、"新增字段"、"FluentAPI"、"Configuration"、"EntityTypeConfiguration"、"DbSet"时，必须使用此技能。
---

## 使用场景

- 创建新的数据库实体模型
- 定义表结构和字段配置
- 配置 Fluent API 映射关系
- 创建 DbContext
- 生成和管理数据库迁移

## 角色定位

你是一名**资深 .NET 后端开发工程师**，负责**按公司规范开发 EF Core 数据库实体和迁移文件**。

## 核心规范

### ⚠️ 禁止使用数据注解

**实体模型类必须是纯净的 POCO 类**，所有数据库配置通过 Fluent API 实现。

```csharp
// ❌ 禁止：使用数据注解
public class User
{
    [Key]
    [Required]
    [MaxLength(100)]
    public string Name { get; set; }
}

// ✅ 正确：纯净的 POCO 类
public class UserModel
{
    public long id { get; set; }
    public string name { get; set; }
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|-----|------|------|
| 实体类 | 以 `Model` 结尾 | `UserInfoModel` |
| 属性/字段 | 小写字母 | `user_name` |
| 表名 | `t_` 前缀 + 小写下划线 | `t_user_info` |
| Schema | 使用服务名作为 schema | `contract`（合同服务） |
| 主键 | 必须使用 `long` 类型 | `public long id` |

### Schema 规范

**每个微服务使用独立的 schema**，实现数据隔离：

| 服务名 | Schema | 表示例 |
|-------|--------|--------|
| 合同服务 ContractService | `contract` | `contract.t_contract` |
| 用户服务 UserService | `user` | `user.t_user_info` |
| 订单服务 OrderService | `order` | `order.t_order` |
| 认证服务 IdentityService | `identity` | `identity.t_user` |

### 字符串类型配置（重要）

在 PostgreSQL 中，字符串属性**必须映射为 `text` 类型**，不要设置最大长度：

```csharp
// ✅ 正确：不设置 MaxLength，默认映射为 PostgreSQL 的 text 类型
builder.Property(x => x.user_name)
    .IsRequired()
    .HasComment("用户名");

// ❌ 禁止：设置 HasMaxLength
builder.Property(x => x.user_name)
    .HasMaxLength(100)  // 不要这样做！
    .HasComment("用户名");
```

**原因说明**：
- PostgreSQL 的 `text` 类型可以存储任意长度的字符串，性能与 `varchar(n)` 相同
- 不限制长度可以避免未来需求变更时的迁移成本
- EF Core 默认将 `string` 映射为 `text` 类型（在不设置 MaxLength 时）

### 其他规则

- **不创建外键**，通过对应 id 关联
- 迁移文件仅在用户明确要求时创建

## 实体模型模板

```csharp
/// <summary>
/// 用户信息模型
/// </summary>
public class UserInfoModel
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
    /// 邮箱地址
    /// </summary>
    public string email { get; set; }

    /// <summary>
    /// 创建时间
    /// </summary>
    public DateTime create_time { get; set; }
}
```

## Fluent API 配置模板

```csharp
/// <summary>
/// 用户信息表配置
/// </summary>
public class UserInfoConfiguration : IEntityTypeConfiguration<UserInfoModel>
{
    public void Configure(EntityTypeBuilder<UserInfoModel> builder)
    {
        // ToTable 参数：表名, schema, 配置动作
        builder.ToTable("t_user_info", "contract", t => t.HasComment("用户信息表"));

        builder.HasKey(x => x.id);

        builder.Property(x => x.id).HasComment("主键ID");

        builder.Property(x => x.user_name)
            .IsRequired()
            .HasComment("用户名");

        builder.Property(x => x.email)
            .IsRequired()
            .HasComment("邮箱地址");

        builder.Property(x => x.create_time)
            .HasDefaultValueSql("now()")
            .HasComment("创建时间");

        builder.HasIndex(x => x.user_name).HasDatabaseName("idx_user_name");
        builder.HasIndex(x => x.email).IsUnique().HasDatabaseName("idx_email");
    }
}
```

## 复杂类型配置

### JSONB 类型

用于存储 JSON 格式的复杂数据：

```csharp
// 实体模型
public class OrderModel
{
    public long id { get; set; }
    public string order_no { get; set; }
    // JSONB 类型：存储收货地址信息
    public ShippingAddress shipping_address { get; set; }
    // JSONB 类型：存储扩展信息（字典结构）
    public Dictionary<string, object> extra_info { get; set; }
}

// 嵌套对象（不需要单独建表）
public class ShippingAddress
{
    public string province { get; set; }
    public string city { get; set; }
    public string detail { get; set; }
}

// Fluent API 配置
public class OrderConfiguration : IEntityTypeConfiguration<OrderModel>
{
    public void Configure(EntityTypeBuilder<OrderModel> builder)
    {
        builder.ToTable("t_order", "order", t => t.HasComment("订单表"));

        builder.HasKey(x => x.id);

        // JSONB 类型配置 - 拥有类型（Owned Type）
        builder.OwnsOne(x => x.shipping_address, nav =>
        {
            nav.ToJson();
            nav.Property(x => x.province).HasComment("省份");
            nav.Property(x => x.city).HasComment("城市");
            nav.Property(x => x.detail).HasComment("详细地址");
        });

        builder.HasComment("收货地址");

        // JSONB 类型配置 - 字典类型
        builder.Property(x => x.extra_info)
            .HasColumnType("jsonb")
            .HasComment("扩展信息");
    }
}
```

### 数组类型

用于存储 PostgreSQL 数组：

```csharp
// 实体模型
public class ProductModel
{
    public long id { get; set; }
    public string name { get; set; }
    // 字符串数组：商品标签
    public List<string> tags { get; set; }
    // 长整型数组：关联的分类ID
    public long[] category_ids { get; set; }
}

// Fluent API 配置
public class ProductConfiguration : IEntityTypeConfiguration<ProductModel>
{
    public void Configure(EntityTypeBuilder<ProductModel> builder)
    {
        builder.ToTable("t_product", "product", t => t.HasComment("商品表"));

        builder.HasKey(x => x.id);

        // 数组类型配置
        builder.Property(x => x.tags)
            .HasColumnType("text[]")
            .HasComment("商品标签");

        builder.Property(x => x.category_ids)
            .HasColumnType("bigint[]")
            .HasComment("分类ID列表");
    }
}
```

## 项目结构规范

| 文件类型 | 项目位置 |
|---------|---------|
| DbContext | `.Database` 项目 |
| 实体模型 | `.Database` 项目 |
| 实体配置 | `.Database` 项目 |
| 迁移文件 | `.Database` 项目 |

### 迁移文件位置

**迁移文件统一放在 Database 项目中，与 DbContext 保持内聚。**

```
✅ 正确位置：{ProjectName}.{ServiceName}.Database/Migrations/{YourDbContextName}/
│   ├── 20250212_InitialCreate.cs
│   ├── 20250212_InitialCreate.Designer.cs
│   └── {YourDbContextName}ModelSnapshot.cs

❌ 错误位置：{ProjectName}.{ServiceName}.API/Data/Migrations/            ← 不要放在 API 项目！
❌ 错误位置：{ProjectName}.{ServiceName}.Database/Data/Migrations/       ← 目录结构不对
```

**重要说明**：
- 迁移文件按 DbContext 名称分目录存放
- 例如：你创建了 `ContractDbContext`，迁移应放在 `Migrations/ContractDbContext/`
- 所有数据库相关代码（Model、Configuration、DbContext、Migration）统一在 Database 项目中管理

### 生成迁移文件命令

在**服务根目录**（`{ProjectName}.{ServiceName}/`）执行以下命令：

```bash
# 基本命令格式（在服务根目录执行，即 API 和 Database 项目的父目录）
dotnet ef migrations add {MigrationName} \
  --project {ProjectName}.{ServiceName}.Database \
  --startup-project {ProjectName}.{ServiceName}.API \
  --output-dir Migrations/{DbContextName}

# 示例：为 ContractDbContext 创建初始迁移
# 当前目录：backend/MyApp/MyApp.Contract/（包含 API 和 Database 子目录）
dotnet ef migrations add InitialCreate \
  --project MyApp.Contract.Database \
  --startup-project MyApp.Contract.API \
  --output-dir Migrations/ContractDbContext

# 示例：为 LogDbContext 创建迁移
dotnet ef migrations add AddLogTable \
  --project MyApp.Contract.Database \
  --startup-project MyApp.Contract.API \
  --output-dir Migrations/LogDbContext
```

**参数说明**：
| 参数 | 说明 | 示例 |
|-----|------|------|
| `{MigrationName}` | 迁移名称，PascalCase | `InitialCreate`、`AddUserTable` |
| `{DbContextName}` | DbContext 类名（不含 DbContext 后缀时也行） | `ContractDbContext` → `ContractDbContext` |
| `--project` | Database 项目（DbContext 和迁移所在位置） | `MyApp.Contract.Database` |
| `--startup-project` | API 项目（连接字符串配置） | `MyApp.Contract.API` |
| `--output-dir` | 迁移输出目录（相对于 Database 项目） | `Migrations/ContractDbContext` |

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

        /// <summary>
        /// 用户信息表
        /// </summary>
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

在 `Program.cs` 中：

```csharp
// 注册主数据库
builder.Services.AddDbContextPool<ContractDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("ConnectionString")));

// 注册其他数据库（如需要）
builder.Services.AddDbContextPool<LogDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("LogConnectionString")));
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

**禁止命令行手动迁移**，在 `Program.cs` 中自动应用：

```csharp
var app = builder.Build();

// 自动应用迁移
using (var serviceScope = app.Services.GetService<IServiceScopeFactory>().CreateScope())
{
    // 单 DbContext
    serviceScope.ServiceProvider.GetRequiredService<ContractDbContext>().Database.Migrate();

    // 多 DbContext（如需要）
    serviceScope.ServiceProvider.GetRequiredService<AuditDbContext>().Database.Migrate();
}

app.Run();
```

## 视图模型与原生 SQL

### 视图模型

用于查询数据库视图、JOIN 多表、聚合统计等场景。命名：`{Entity}View`。

```csharp
/// <summary>
/// 用户及部门信息视图模型
/// </summary>
public class UserWithDeptView
{
    public long id { get; set; }
    public string user_name { get; set; }
    public string department_name { get; set; }
}
```

### 原生 SQL 查询

**注意**：SQL 查询中的表名需要带上 schema 前缀，如 `contract.t_user_info`。

```csharp
// 单条查询
public async Task<UserView> GetById(long id)
{
    var sql = @"SELECT * FROM contract.t_user_info WHERE id = {0}";
    return await _dbcontext.Database.SqlQueryRaw<UserView>(sql, id)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}

// 列表查询
public async Task<List<UserView>> GetList()
{
    var sql = @"SELECT * FROM contract.t_user_info";
    return await _dbcontext.Database.SqlQueryRaw<UserView>(sql)
        .AsNoTracking()
        .ToListAsync();
}

// 批量查询（PostgreSQL ANY）
public async Task<List<UserView>> GetByIds(List<long> ids)
{
    var sql = @"SELECT * FROM contract.t_user_info WHERE id = ANY(@ids)";
    return await _dbcontext.Database.SqlQueryRaw<UserView>(
        sql, new NpgsqlParameter("ids", ids))
        .AsNoTracking()
        .ToListAsync();
}

// 多表 JOIN（同 schema 内）
public async Task<List<UserWithDeptView>> GetUserWithDepartment()
{
    var sql = @"SELECT u.id, u.user_name, d.name as department_name
                FROM contract.t_user_info u
                LEFT JOIN contract.t_department d ON u.department_id = d.id";
    return await _dbcontext.Database.SqlQueryRaw<UserWithDeptView>(sql)
        .AsNoTracking()
        .ToListAsync();
}

// 字典查询
public async Task<Dictionary<long, UserView>> GetDic()
{
    var list = await _dbcontext.Database.SqlQueryRaw<UserView>(
        @"SELECT * FROM contract.t_user_info")
        .AsNoTracking()
        .ToListAsync();
    return list.ToDictionary(f => f.id, f => f);
}
```

## Model 与 View 的区别

| 特性 | 实体模型（Model） | 视图模型（View） |
|-----|------------------|-----------------|
| 用途 | 数据库表完整映射 | 查询结果轻量级投影 |
| 后缀 | `Model` | `View` |
| 配置 | 需要 Fluent API | 无需配置 |
| 操作 | 支持增删改查 | 仅支持查询 |
