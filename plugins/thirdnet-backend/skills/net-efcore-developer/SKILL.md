---
name: net-efcore-developer
version: 2.0.0
description: EF Core 数据库开发专家，覆盖实体建模到迁移管理的完整流程。当涉及数据库实体设计、表结构定义、新增字段、FluentAPI 配置、DbContext 创建、生成迁移、SQL 视图查询、数据归档或批量数据清理等场景时使用此技能。即使用户只是提到"加个字段"、"建张表"、"数据库迁移"、"写个查询"等日常数据库操作，也应激活此技能。
---

## 角色

你是一名**资深 .NET 后端开发工程师**，负责按公司规范开发 EF Core 数据库实体和迁移文件。

## 核心规则

### 禁止数据注解

实体类必须是纯净 POCO，所有数据库映射通过 Fluent API 实现。唯一例外：`[DbBulk]` 特性（批量操作框架要求，详见 `net-database-bulkcopy` 技能）。

```csharp
// ❌ 禁止
public class User
{
    [Key] [Required] [MaxLength(100)]
    public string Name { get; set; }
}

// ✅ 正确：纯净 POCO
public class UserModel
{
    public long id { get; set; }
    public string user_name { get; set; }
}
```

### 命名规范

| 类型 | 规范 | 示例 |
|-----|------|------|
| 实体类 | `Model` 后缀 | `UserInfoModel` |
| 属性/字段 | 小写字母 | `user_name` |
| 表名 | `t_` 前缀 + 小写下划线 | `t_user_info` |
| 主键 | `long` 类型 | `public long id` |

### Schema 隔离

每个微服务使用独立 schema，以服务名命名：合同服务 → `contract`，用户服务 → `user`，订单服务 → `order`，认证服务 → `identity`。

### 字符串映射

字符串属性**不设置 HasMaxLength**，让 EF Core 默认映射为 PostgreSQL `text` 类型。`text` 与 `varchar(n)` 性能相同且无长度限制，避免未来迁移成本。

### 其他

- **不创建外键**，通过对应 id 关联
- 迁移文件仅在用户明确要求时创建

### 文件组织

每个 .cs 文件只定义一个类型。实体 Model 和 Fluent API Configuration 各自独立成文件：

- `Models/UserInfoModel.cs` → 仅包含 `UserInfoModel`
- `Configurations/UserInfoConfiguration.cs` → 仅包含 `UserInfoConfiguration`
- `Views/UserInfoView.cs` → 仅包含 `UserInfoView`

禁止将多个 Model、Configuration 或 View 放在同一文件中。

## 实体模型模板

```csharp
public class UserInfoModel
{
    public long id { get; set; }
    public string user_name { get; set; }
    public string email { get; set; }
    public DateTime create_time { get; set; }
}
```

## Fluent API 配置模板

```csharp
public class UserInfoConfiguration : IEntityTypeConfiguration<UserInfoModel>
{
    public void Configure(EntityTypeBuilder<UserInfoModel> builder)
    {
        // ToTable(表名, schema, 配置动作)
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

> **复杂类型**（JSONB 拥有类型、字典、数组）的配置模式，详见 `references/complex-types.md`。

## 项目结构与迁移

所有数据库代码（Model、Configuration、DbContext、Migration）统一在 `.Database` 项目中。

### 迁移文件位置

```
{ServiceName}.Database/Migrations/{ShortName}/
├── 20250212_InitialCreate.cs
├── 20250212_InitialCreate.Designer.cs
└── {DbContextName}ModelSnapshot.cs
```

- 文件夹名 = DbContext 类名去掉 `DbContext` 后缀（如 `ContractDbContext` → `Contract`）

### 生成迁移命令

在**服务根目录**（`backend/{ServiceName}/`）执行：

```bash
dotnet ef migrations add {MigrationName} \
  --project {ServiceName}.Database \
  --startup-project {ServiceName}.API \
  --output-dir Migrations/{ShortName}
```

| 参数 | 说明 | 示例 |
|-----|------|------|
| `{MigrationName}` | PascalCase 迁移名 | `InitialCreate`、`AddUserTable` |
| `{ShortName}` | DbContext 名去掉 `DbContext` | `ContractDbContext` → `Contract` |

> **DbContext 模板、注册、连接字符串、自动迁移配置**，详见 `references/dbcontext-and-queries.md`。

## Model 与 View 的区别

| 特性 | 实体模型（Model） | 视图模型（View） |
|-----|------------------|-----------------|
| 用途 | 表完整映射 | 查询结果轻量投影 |
| 后缀 | `Model` | `View` |
| 配置 | 需要 Fluent API | 无需配置 |
| 操作 | 增删改查 | 仅查询 |

> **原生 SQL 查询模式**（单条、列表、批量 ANY、JOIN、字典），详见 `references/dbcontext-and-queries.md`。

## CTE 批量数据处理

数据已在数据库中的多步组合操作（归档、同步、清理、迁移），优先用 CTE（`WITH` 子句）在单条 SQL 内完成，实现单次往返 + 天然原子性。

### 决策指南

```
数据来源是什么？
├── 数据在应用内存中（Excel/API/外部系统）
│   └── → net-database-bulkcopy（COPY 二进制协议）
│       数据量 > 1000？是 → BulkCopy，否 → EF Core SaveChanges
└── 数据已在数据库中（归档/清理/迁移/状态变更）
    ├── 多步骤组合（查询 → 写入 → 删除）
    │   └── → CTE 批量模式（本章节）
    └── 单步骤简单 CRUD
        └── → EF Core SaveChanges
```

### 核心模式

将 SELECT → INSERT INTO...SELECT → DELETE 封装在一条 `WITH` 语句中：

```sql
WITH
  matched AS (
    SELECT id, column_a FROM contract.t_target WHERE status = @Status
  ),
  archived AS (
    INSERT INTO contract.t_history (id, column_a, archived_at)
    SELECT id, column_a, NOW() FROM matched
    RETURNING id
  ),
  removed AS (
    DELETE FROM contract.t_target WHERE id IN (SELECT id FROM archived)
    RETURNING id
  )
SELECT COUNT(*) AS removed_count FROM removed;
```

### EF Core 执行方式

```csharp
// 需要返回结果 → SqlQueryRaw + View 模型
var result = await _dbcontext.Database.SqlQueryRaw<BatchResultView>(sql, param)
    .AsNoTracking().FirstOrDefaultAsync();

// 仅执行操作 → ExecuteSqlInterpolated
await _dbcontext.Database.ExecuteSqlInterpolatedAsync($@"WITH ... DELETE ...");
```

### 约束

- 禁止将 CTE 逻辑拆解为多次 `SaveChanges()` 调用
- 参数使用 `$""` 内插语法或 `NpgsqlParameter`，严禁字符串拼接 SQL
- 超过 5 个 CTE 节点时应评估拆分或改用存储过程
- SQL 中表名必须带 schema 前缀

> **4 种典型场景的完整代码示例**（归档、同步、级联清理、状态迁移），详见 `references/cte-batch-patterns.md`。

## 参考文件索引

| 文件 | 内容 | 何时读取 |
|-----|------|---------|
| `references/complex-types.md` | JSONB、数组类型的配置模式 | 遇到嵌套对象或数组字段时 |
| `references/dbcontext-and-queries.md` | DbContext 模板、注册、连接字符串、自动迁移、原生 SQL 查询 | 需要创建/配置 DbContext 或编写 SQL 查询时 |
| `references/cte-batch-patterns.md` | CTE 批量处理的 4 种完整场景示例 | 实现数据归档、同步、清理、迁移时 |

## 相关技能

- **backend-workflow**: 文档驱动开发流程
- **net-microservice-generator**: 项目结构生成和 Startup.cs 配置
- **net-api-developer**: API 接口开发
- **net-cache-use**: 缓存集成
- **net-database-bulkcopy**: 应用内存数据批量导入数据库（COPY 协议）
