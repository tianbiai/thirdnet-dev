---
name: net-database-bulkcopy
description: >
  ThirdNet PostgreSQL 批量数据操作规范。基于 PostgresqlAsyncBulk（IDbAsyncBulk）
  实现高性能数据操作：CopyToServer（批量插入）、MergeToServer（Upsert）、
  UpdateToServer（批量更新）、MergeAndDeleteToServer（完整同步）。
  包含决策流程图（内存数据 → BulkCopy vs 数据库数据 → CTE）。
  当用户提到"批量"、"导入"、"同步"、"大数据量"、"Excel导入"、
  "数据迁移"、"Upsert"、"Merge"、"CopyToServer"、"BulkCopy"、
  "批量写入"、"批量插入"、"DbBulk"时，必须使用此技能。
---

# ThirdNet 批量数据操作

## 决策指南

```
数据来源是什么？
├── 数据在应用内存中（List<T>，来自 Excel/API/外部系统）
│   └── → 使用本技能（BulkCopy，COPY 二进制协议）
│       数据量 > 1000？
│       ├── 是 → 使用 BulkCopy
│       └── 否 → 考虑 EF Core SaveChanges
└── 数据已在数据库中（归档/清理/迁移/状态变更）
    └── → 使用 net-efcore-developer 的 CTE 批量处理模式
```

## 核心类

**命名空间**: `ThirdNet.Vibe.Common`（框架库，`code/backend/Library/ThirdNet.Vibe.Common/database/`）

| 类/接口 | 用途 |
|---------|------|
| `IDbAsyncBulk` | 批量操作核心接口，注入它即可 |
| `PostgresqlAsyncBulk` | 实现（基于 `NpgsqlBinaryImport` COPY 二进制协议），框架自动注册为 Transient |
| `[DbBulk]` | 字段映射特性（见下，实体唯一允许的 Data Annotation） |
| `NpgMappingInfo` / `DbBulkExtension` | 列映射 POCO 与 `ToNpgsqlType(this Type)` 扩展 |
| `ExpressionExtensions` | `And<T>`/`Or<T>`/`Compose<T>`——动态拼 `Expression<Func<T,bool>>` where 条件，配合按条件筛选批量源数据 |
| `PostgresqlToCsvExporter` | 反向导出：`TableToCsv`/`SelectToCsv`（`COPY ... TO STDOUT`） |
| `BulkCopyException` | 批量操作异常 |

> 完整类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「数据库批量与工具」。

## 方法速查表

| 方法 | 用途 | 是否删除数据 |
|-----|------|-------------|
| `CopyToServer` | 批量插入 | ❌ |
| `CopyToServerWithoutUniqueKey` | 条件插入（跳过已存在记录） | ❌ |
| `MergeToServer` | 存在则更新，不存在则插入（Upsert） | ❌ |
| `UpdateToServer` | 批量更新 | ❌ |
| `MergeAndDeleteToServer` | 完整同步（删除目标中多余的记录） | ✅ |
| `InitDefaultMappings<T>` | 自动扫描实体属性建立字段映射 | - |
| `CreateTempTable` | 创建临时表（高级场景） | - |

### 方法选择决策树

```
需要删除目标中多余的记录？
├── 是 → MergeAndDeleteToServer
└── 否 → 需要更新已存在的记录？
    ├── 是 → MergeToServer（或 UpdateToServer 仅更新）
    └── 否 → 需要跳过已存在的记录？
        ├── 是 → CopyToServerWithoutUniqueKey
        └── 否 → CopyToServer（纯插入）
```

## 使用方式

### 注入

```csharp
public class MyService
{
    private readonly IDbAsyncBulk _bulkCopy;
    private readonly string _connectionString;

    public MyService(IDbAsyncBulk bulkCopy, IConfiguration configuration)
    {
        _bulkCopy = bulkCopy;
        // 连接字符串来自配置：业务库取 ConnectionString，框架库取 DefaultConnectionString
        _connectionString = configuration.GetConnectionString("ConnectionString")!;
    }
}
```

> `IDbAsyncBulk` 的方法接受**连接字符串**或 `DbConnection`。业务库连接串来自 appsettings 的 `ConnectionString`，框架库（ThirdNetDbContext 表）用 `DefaultConnectionString`。

### 批量插入

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 25 },
    new User { Id = 2, Name = "李四", Age = 30 }
};

await _bulkCopy.InitDefaultMappings<User>();
await _bulkCopy.CopyToServer(connectionString, "users", users);
```

### 合并（Upsert）

```csharp
await _bulkCopy.MergeToServer(
    connectionString,
    new List<string> { "id" },  // 匹配键
    "users",
    users
);
```

### 条件插入

```csharp
// 跳过主键或唯一约束已存在的记录（不会报错）
await _bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);
```

### 完整同步

```csharp
// 同步数据，删除目标表中不存在于源数据的记录
await _bulkCopy.MergeAndDeleteToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);
```

## DbBulkAttribute 配置

使用 `[DbBulk]` 特性控制字段映射。这是实体中**唯一允许的 Data Annotation**：

```csharp
using ThirdNet.Vibe.Common;
using NpgsqlTypes;

public class User
{
    [DbBulk(Ignore = true)]
    public int InternalId { get; set; }  // 不参与批量操作

    [DbBulk(ColumnName = "user_id", Type = NpgsqlDbType.Integer)]
    public int Id { get; set; }  // 自定义列名和类型

    [DbBulk(Type = NpgsqlDbType.Varchar)]
    public string Name { get; set; }

    [DbBulk(UnknownType = "jsonb")]
    public string Metadata { get; set; }  // 特殊类型
}
```

| 属性 | 说明 |
|------|------|
| `Ignore` | 忽略该字段，不参与批量操作 |
| `ColumnName` | 自定义数据库列名 |
| `Type` | 指定 NpgsqlDbType |
| `UnknownType` | 特殊类型（如 jsonb） |

## 常见场景

### Excel 导入用户

```csharp
public async Task<int> ImportUsers(List<UserImportMap> excelData)
{
    var users = excelData.Select(d => new User
    {
        Name = d.Name,
        Email = d.Email
    }).ToList();

    await _bulkCopy.InitDefaultMappings<User>();

    // 使用合并，按邮箱去重
    await _bulkCopy.MergeToServer(
        _connectionString,
        new List<string> { "email" },
        "users",
        users
    );

    return users.Count;
}
```

### 外部系统数据同步

```csharp
public async Task SyncFromExternal(List<ExternalData> externalData)
{
    var localData = externalData.Select(MapToLocal).ToList();

    await _bulkCopy.InitDefaultMappings<LocalEntity>();

    // 完整同步：外部数据覆盖本地，删除本地多余的
    await _bulkCopy.MergeAndDeleteToServer(
        _connectionString,
        new List<string> { "external_id" },
        "local_table",
        localData
    );
}
```

## 批量操作后的缓存处理

批量操作直接修改数据库，绕过了 Service 层的缓存失效逻辑，因此操作完成后**必须手动删除相关缓存**：

```csharp
await _bulkCopy.MergeToServer(...);

// 手动删除相关缓存
await _xxxCache.RemoveXxxDic();
await _xxxCache.RemoveXxx(id);
```

## 注意事项

- **主键/唯一约束**：`MergeToServer` 和 `MergeAndDeleteToServer` 的 `keys` 参数必须是主键或唯一约束字段
- **事务管理**：使用连接字符串的方法自动包含事务
- **性能建议**：大批量数据（>10万条）建议分批处理
- **字段映射**：确保实体属性与数据库字段正确映射
- **缓存失效**：批量操作后必须手动删除相关缓存

## 详细 API 文档

完整的 API 参数说明和更多示例：[bulk-operations.md](references/bulk-operations.md)

## 相关技能

- **backend-workflow**: 完整工作流
- **net-efcore-developer**: 数据库实体 + CTE 批量 SQL（数据已在数据库中的场景）
- **net-cache-use**: 缓存功能（批量操作后需删除相关缓存）
- **net-api-developer**: API 接口开发（批量操作常通过 API 触发）
