---
name: net-efcore-developer
description: >
  ThirdNet 数据库实体开发规范。覆盖 DbContext 约定（schema、t_ 前缀、long id 主键、
  xmin 乐观并发、ApplyConfigurationsFromAssembly）、实体建模（IAuditableEntity、
  ConfigureAuditFields）、EntityConfiguration 模式、Pooled DbContextFactory、迁移命令、
  双数据库上下文、Fluent API 配置（禁止 Data Annotations）、CTE 批量数据处理、
  原生 SQL 查询模式、复杂类型（JSONB/数组）配置。
  当用户提到"实体"、"数据库"、"DbContext"、"t_sys_"、"IAuditableEntity"、
  "ConfigureAuditFields"、"migration"、"xmin"、"schema"、"创建实体"、"新建表"、
  "EF Core 配置"、"加个字段"、"建张表"、"数据库迁移"、"写个查询"、"CTE"、
  "批量数据处理"时，必须使用此技能。
---

# ThirdNet 数据库实体开发

> 复杂的分组/聚合/动态条件查询，框架提供「分组查询构建器」（见文末），不要手拼 SQL 字符串。完整的可复用类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)。

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
| 实体类 | `Model` 后缀 | `SysUserModel`、`SysRoleModel` |
| 属性/字段 | snake_case | `user_name` |
| 表名 | `t_` 前缀 + snake_case | `t_sys_user`、`t_sys_role` |
| 主键 | `long` 类型 | `public long id` |

### 字符串映射

字符串属性**不设置 HasMaxLength**，让 EF Core 默认映射为 PostgreSQL `text` 类型。`text` 与 `varchar(n)` 性能相同且无长度限制，避免未来迁移成本。

### 索引策略

除 `HasIndex(x => x.field).IsUnique()` 唯一索引与 `HasIndex(x => new { x.a, x.b }).IsUnique()` 复合唯一索引外：

- **jsonb / 数组列必须配 GIN 索引**（否则 `@>`、数组运算符退化为全表扫描）。
- 常量谓词过滤场景用部分索引 `HasFilter(...)`。
- 复合索引遵循左前缀原则（等值列在前、范围列在后）。
- 覆盖索引（INCLUDE）、表达式索引等高级模式 EF Core 不直接支持，在迁移中手写。

完整指引见 [postgres-best-practices.md](references/postgres-best-practices.md)「一、索引策略」。

### 其他

- **不创建外键**，通过对应 id 关联（理由与边界见文末「设计取舍说明」）
- 迁移文件仅在用户明确要求时创建；生产迁移须遵循 expand/contract，见 [postgres-best-practices.md](references/postgres-best-practices.md)「七、迁移安全性」
- **每个 .cs 文件只定义一个类型**（Model、Configuration、View 各自独立成文件）

### Schema 隔离

每个微服务使用独立 schema：Admin 项目 → `admin`，自定义微服务 → 自定义 schema。

## DbContext 核心约定

### AdminDbContext

参考文件：生成项目 `Admin/{ProjectName}.Admin.Database/DbContext/AdminDbContext.cs`；参考仓库 `code/backend/src/Admin/ThirdNetVibe.Admin.Database/DbContext/AdminDbContext.cs`。

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    // 所有表放在 admin schema 下
    modelBuilder.HasDefaultSchema("admin");

    // 自动扫描当前程序集中所有 IEntityTypeConfiguration<T> 实现
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AdminDbContext).Assembly);

    // 乐观并发：PostgreSQL xmin 列（对所有实体自动注册）
    foreach (var entityType in modelBuilder.Model.GetEntityTypes())
    {
        modelBuilder.Entity(entityType.ClrType, b =>
            b.Property<uint>("xmin").IsRowVersion().ValueGeneratedOnAddOrUpdate());
    }
}
```

关键点：
- `HasDefaultSchema("admin")` — 所有表在 admin schema 下，无需在每个配置中重复声明
- `ApplyConfigurationsFromAssembly` — 新增实体只需创建 Configuration 类，无需手动注册
- xmin 并发令牌 — 自动对所有实体注册，新增实体无需手动添加

### 注册方式

使用 Pooled DbContextFactory（非直接注入 DbContext）：

```csharp
// 在 Startup.cs 中注册
services.AddPooledDbContextFactory<AdminDbContext>(options =>
{
    options.UseNpgsql(connectionString,
        b => b.MigrationsAssembly("{ProjectName}.Admin.Database"));
});

// 在 Service 中使用
await using var db = await _dbFactory.CreateDbContextAsync();
```

为什么不直接注入 DbContext？因为 Pooled Factory 性能更好，且避免长生命周期的 DbContext 导致的问题。

### ServiceDbContext

自定义微服务使用 `ServiceDbContext`，与 AdminDbContext 模式相同但使用自定义 schema。详见 `net-microservice-generator` 技能。

## 实体建模规范

### 完整实体模板

```csharp
using {ProjectName}.Admin.Common.Enums;
using {ProjectName}.Admin.Common.Interfaces;

namespace {ProjectName}.Admin.Database.Models
{
    /// <summary>
    /// 实体描述。
    /// <para>对应数据库表：t_xxx_xxx。</para>
    /// </summary>
    public class XxxModel : IAuditableEntity
    {
        /// <summary>主键（bigint 自增）</summary>
        public long id { get; set; }

        // 业务字段...

        /// <summary>创建人</summary>
        public string created_by { get; set; }
        /// <summary>创建时间</summary>
        public DateTime created_time { get; set; }
        /// <summary>更新人</summary>
        public string? updated_by { get; set; }
        /// <summary>更新时间</summary>
        public DateTime? updated_time { get; set; }
        /// <summary>备注</summary>
        public string remark { get; set; }
    }
}
```

### IAuditableEntity 审计字段

大部分实体实现 `IAuditableEntity` 接口，提供 5 个标准审计字段：`created_by`、`created_time`、`updated_by`、`updated_time`、`remark`。

**不适用 IAuditableEntity 的实体**：日志表（本身就是审计记录）、中间关联表。

## EntityConfiguration 规范

### 配置模板

```csharp
public class XxxConfiguration : IEntityTypeConfiguration<XxxModel>
{
    public void Configure(EntityTypeBuilder<XxxModel> builder)
    {
        // 表名（t_ 前缀 + snake_case）
        builder.ToTable("t_xxx_xxx");

        // 主键
        builder.HasKey(x => x.id);

        // 唯一索引
        builder.HasIndex(x => x.field).IsUnique();

        // 字段配置
        builder.Property(x => x.id).HasComment("主键");
        builder.Property(x => x.field).IsRequired().HasComment("字段描述");

        // 审计字段（一行搞定 5 个字段）
        builder.ConfigureAuditFields();
    }
}
```

### 关键约定

| 约定 | 说明 |
|------|------|
| 表名前缀 | `t_` 开头（如 `t_sys_user`） |
| 主键 | `long id`（bigint 自增） |
| 审计字段 | `ConfigureAuditFields()` 一行配置 |
| 默认时间 | `HasDefaultValueSql("now()")` 在 ConfigureAuditFields 中已包含 |
| 索引命名 | `HasDatabaseName("idx_xxx_field")` |
| 唯一索引 | `HasIndex(x => x.field).IsUnique()` |
| 复合唯一索引 | `HasIndex(x => new { x.a, x.b }).IsUnique()` |

## 中间关联表

多对多关系使用独立的关联实体（不使用 EF Core 导航属性）：

```csharp
public class SysUserRoleModel
{
    public long id { get; set; }      // 自增主键
    public long user_id { get; set; } // 用户 ID
    public long role_id { get; set; } // 角色 ID
}

// 配置
builder.ToTable("t_sys_user_role");
builder.HasKey(x => x.id);
builder.HasIndex(x => new { x.user_id, x.role_id }).IsUnique(); // 复合唯一
```

## 树形结构实体

菜单和部门使用 `parent_id` 实现树形结构：

```csharp
public long? parent_id { get; set; }  // 可空，顶级节点 parent_id = null
```

树形数据在缓存层通过 `TreeBuilder.BuildForest()` 构建树形结构。

## Model 与 View 的区别

| 特性 | 实体模型（Model） | 视图模型（View） |
|-----|------------------|-----------------|
| 用途 | 表完整映射 | 查询结果轻量投影 |
| 后缀 | `Model` | `View` |
| 配置 | 需要 Fluent API | 无需配置 |
| 操作 | 增删改查 | 仅查询 |

## 迁移命令

在 `backend/` 目录下执行（路径相对 `backend/`，生成项目无 `src/`）：

```bash
# 添加迁移
dotnet ef migrations add AddXxxEntity \
  --project Admin/{ProjectName}.Admin.Database \
  --startup-project Admin/{ProjectName}.Admin.APIService

# 应用迁移
dotnet ef database update \
  --project Admin/{ProjectName}.Admin.Database \
  --startup-project Admin/{ProjectName}.Admin.APIService

# 回滚到指定迁移
dotnet ef database update <MigrationName> \
  --project Admin/{ProjectName}.Admin.Database \
  --startup-project Admin/{ProjectName}.Admin.APIService
```

## 双数据库上下文区别

| 特性 | ThirdNetDbContext | AdminDbContext |
|------|-------------------|----------------|
| 来源 | Vibe.WebAPI 框架 | 业务项目 |
| Schema | public | admin |
| 用途 | Token、权限目录、API 配置 | 用户、角色、菜单、部门等 |
| 连接字符串 | DefaultConnectionString | ConnectionString |
| 迁移程序集 | APIService | Database |
| 注册方式 | 框架内部注册 | 手动 AddPooledDbContextFactory |

## CTE 批量数据处理

数据已在数据库中的多步组合操作（归档、同步、清理、迁移），优先用 CTE（`WITH` 子句）在单条 SQL 内完成，实现单次往返 + 天然原子性。

### 决策指南

```
数据来源是什么？
├── 数据在应用内存中（Excel/API/外部系统）
│   └── → net-database-bulkcopy（COPY 二进制协议）
└── 数据已在数据库中（归档/清理/迁移/状态变更）
    ├── 多步骤组合（查询 → 写入 → 删除）
    │   └── → CTE 批量模式（本章节）
    └── 单步骤简单 CRUD
        └── → EF Core SaveChanges
```

### 核心模式

```sql
WITH
  matched AS (
    SELECT id, column_a FROM admin.t_target WHERE status = @Status
  ),
  archived AS (
    INSERT INTO admin.t_history (id, column_a, archived_at)
    SELECT id, column_a, NOW() FROM matched
    RETURNING id
  ),
  removed AS (
    DELETE FROM admin.t_target WHERE id IN (SELECT id FROM archived)
    RETURNING id
  )
SELECT COUNT(*) AS removed_count FROM removed;
```

### EF Core 执行方式

```csharp
// 需要返回结果 → SqlQueryRaw + View 模型
var result = await db.Database.SqlQueryRaw<BatchResultView>(sql, param)
    .AsNoTracking().FirstOrDefaultAsync();

// 仅执行操作 → ExecuteSqlInterpolated
await db.Database.ExecuteSqlInterpolatedAsync($@"WITH ... DELETE ...");
```

### 约束

- 禁止将 CTE 逻辑拆解为多次 `SaveChanges()` 调用
- 参数使用 `$""` 内插语法或 `NpgsqlParameter`，严禁字符串拼接 SQL
- SQL 中表名必须带 schema 前缀

## 分组查询构建器（query 框架）

需要**分组/聚合/动态多条件**查询（如按时间/地区/类目多维分组统计、运行时拼装筛选条件）时，框架提供分组查询构建器，避免手拼 SQL 字符串或写大量条件分支。命名空间 `ThirdNet.Vibe.Common`（`code/backend/Library/ThirdNet.Vibe.Common/query/`）。

| 类/接口 | 用途 |
|---------|------|
| `ISqlGroupHandler` / `DefaultSqlGroupHandler` | 从分组类型 + 查询数据构建 WHERE/JOIN/GROUP BY/ORDER BY |
| `NpgsqlGroupHandler` | PostgreSQL 方言特化（分组键保留为独立列） |
| `WhereQueryType` | 条件类型枚举：`Equals/Between/In/NotIn/Greater/GreaterEquals/Less/LessEquals/Like/NotLike/StartsWith/EndsWith/Contains/NotContains` |
| `GroupQueryData` / `SqlGroup` | 输入（GroupType/QueryType/Values）/ 输出（GroupKey/Where/Join/OrderBy/参数列表） |
| `DefaultQueryHandlerFactory` + 各 `IQueryHandler` | 按 `WhereQueryType` 生成条件片段（Between/In/Like/SingleSymbol） |

**何时用**：维度分组统计、报表聚合、查询条件需运行时动态组合（前端传任意筛选组合）。**何时不用**：简单单表 CRUD、固定的 1-2 个条件查询（直接 LINQ `Where` 更清晰）。配合 CTE 批量模式可处理"分组统计 → 写回"场景。完整方法签名见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「分组查询构建器」。

## 参考文件索引

| 文件 | 内容 | 何时读取 |
|-----|------|---------|
| [entity-examples.md](references/entity-examples.md) | SysUserModel、SysRoleModel、SysMenuModel 完整示例 | 创建新实体时参考 |
| [cte-batch-patterns.md](references/cte-batch-patterns.md) | CTE 批量处理的 4 种完整场景示例 | 实现数据归档、同步、清理时 |
| [complex-types.md](references/complex-types.md) | JSONB、数组类型的配置模式 | 遇到嵌套对象或数组字段时 |
| [dbcontext-and-queries.md](references/dbcontext-and-queries.md) | DbContext 模板、注册、原生 SQL 查询 | 配置 DbContext 或编写 SQL 查询时 |
| [postgres-best-practices.md](references/postgres-best-practices.md) | 索引/N+1/分页/连接/监控/并发/迁移最佳实践补齐 | 涉及性能优化、生产部署、慢查询、迁移上线时 |

## 设计取舍说明

下列选择属**有意为之**，与通用 Postgres 最佳实践不同，需明确理由与边界，避免被误判为缺陷：

### 不建外键

- **理由**：微服务跨库（业务库与框架库分离）无法跨库建 FK；表结构演进灵活；避免级联锁影响并发。
- **边界**：关联完整性由应用层 Service 保证；**同库内强一致关系**（如字典主从表）**可选加 FK**，但需评估级联锁风险。
- **替代约束**：用复合唯一索引（如 `t_sys_user_role(user_id, role_id)`）保证业务唯一性。

### 不做 RLS（行级安全）

- **理由**：数据权限模型基于部门树（`DeptFilterHelper.GetVisibleDeptIds` 注入查询 `Where`），业务复杂度（含 `include_sub_depts`、通配符、自定义数据范围）高于 RLS 策略表达力。
- **边界**：若未来出现严格多租户隔离需求（租户间数据绝对不可串），再评估 RLS。

### 数据权限走应用层

- `DeptFilterHelper` 把可见 `dept_id` 集合注入查询 `Where(x => visibleDeptIds.Contains(x.dept_id))`。
- **关键约束**：`dept_id` 等被数据权限过滤的列**必须建索引**（如 `entity-examples.md` 中 `HasIndex(x => x.dept_id)`），否则每次权限过滤触发 Seq Scan，应用层权限反而拖垮查询。
- 高频过滤列、JOIN 关联列同理必须建索引——这正是 Postgres「外键列须建索引」最佳实践在本插件无 FK 架构下的对应体现。

## 相关技能

- **backend-workflow**: 完整工作流和文档驱动开发
- **net-microservice-generator**: 微服务项目结构
- **net-api-developer**: API 接口开发
- **net-cache-use**: 缓存集成（View 模型与缓存配合）
- **net-database-bulkcopy**: 应用内存数据批量导入（COPY 协议）
- **net-enum-dict**: 枚举字典管理（实体中的状态/类型枚举字段）
