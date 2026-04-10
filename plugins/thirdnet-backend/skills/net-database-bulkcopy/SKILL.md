---
name: net-database-bulkcopy
version: 0.1.0
description: PostgreSQL 批量数据操作专家，基于 PostgresqlAsyncBulk 实现高性能数据操作。**主动用于**：大数据量导入（>1000条）、批量更新、批量插入、数据同步、ETL 场景、数据迁移、初始化数据。当用户提到"批量"、"导入"、"同步"、"大数据量"、"Excel导入"、"数据迁移"、"Upsert"、"Merge"、"CopyToServer"、"MergeToServer"、"BulkCopy"、"批量写入"、"批量插入"时，必须使用此技能。
---

## 使用场景

- **批量导入数据**：Excel 导入、CSV 解析入库、初始化数据
- **批量更新记录**：批量修改状态、批量调整价格
- **数据同步**：从外部系统同步数据、定时数据同步
- **ETL 处理**：数据抽取、转换、加载
- **数据迁移**：系统上线时的数据迁移

## 核心类

**命名空间**: `ThirdNet.Core.Common`
**核心接口**: `IDbAsyncBulk`
**实现类**: `PostgresqlAsyncBulk`

## 方法速查表

| 方法 | 签名 | 用途 | 是否删除数据 |
|-----|-----|------|-------------|
| `CopyToServer` | `Task CopyToServer(string conn, string table, List<T> list)` | 批量插入 | ❌ |
| `CopyToServerWithoutUniqueKey` | `Task CopyToServerWithoutUniqueKey(string conn, List<string> where_keys, string table, List<T> list)` | 条件插入 | ❌ |
| `MergeToServer` | `Task MergeToServer(string conn, List<string> keys, string table, List<T> list)` | 存在则更新，不存在则插入 | ❌ |
| `UpdateToServer` | `Task UpdateToServer(string conn, List<string> where_name, List<string> update_name, string table, List<T> list)` | 批量更新 | ❌ |
| `MergeAndDeleteToServer` | `Task MergeAndDeleteToServer(string conn, List<string> keys, string table, List<T> list)` | 完整同步 | ✅ |

## 快速开始

### 1. 初始化映射

```csharp
// 通过依赖注入获取实例
public class MyService
{
    private readonly IDbAsyncBulk _bulkCopy;

    public MyService(IDbAsyncBulk bulkCopy)
    {
        _bulkCopy = bulkCopy;
    }
}

// 初始化实体映射
await bulkCopy.InitDefaultMappings<User>();
```

### 2. 批量插入

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 25 },
    new User { Id = 2, Name = "李四", Age = 30 }
};

await bulkCopy.InitDefaultMappings<User>();
await bulkCopy.CopyToServer(connectionString, "users", users);
```

### 3. 合并（Upsert）

```csharp
// 存在则更新，不存在则插入
await bulkCopy.MergeToServer(
    connectionString,
    new List<string> { "id" },  // 匹配键
    "users",
    users
);
```

### 4. 条件插入（跳过已存在记录）

```csharp
// 插入数据，但跳过主键或唯一约束已存在的记录（不会报错）
await bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    "users",
    users
);
```

### 5. 完整同步

```csharp
// 同步数据，删除目标表中不存在于源数据的记录
await bulkCopy.MergeAndDeleteToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);
```

## 选择指南

```
需要删除目标中多余的记录？
├── 是 → MergeAndDeleteToServer
└── 否 → 需要更新已存在的记录？
    ├── 是 → MergeToServer（或 UpdateToServer 仅更新）
    └── 否 → 需要跳过已存在的记录？
        ├── 是 → CopyToServerWithoutUniqueKey
        └── 否 → CopyToServer（纯插入，可能有重复键错误）
```

## 实体特性配置

使用 `DbBulkAttribute` 控制字段映射：

```csharp
using ThirdNet.Core.Common;
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

## 常见场景示例

### Excel 导入用户数据

```csharp
public async Task<int> ImportUsersFromExcel(List<UserImportDto> excelData)
{
    var users = excelData.Select(d => new User
    {
        Name = d.Name,
        Email = d.Email,
        Age = d.Age
    }).ToList();

    await _bulkCopy.InitDefaultMappings<User>();

    // 使用合并，避免重复导入
    await _bulkCopy.MergeToServer(
        _connectionString,
        new List<string> { "email" },  // 按邮箱去重
        "users",
        users
    );

    return users.Count;
}
```

### 定时同步外部数据

```csharp
public async Task SyncDataFromExternalSystem(List<ExternalData> externalData)
{
    var localData = externalData.Select(MapToLocal).ToList();

    await _bulkCopy.InitDefaultMappings<LocalEntity>();

    // 完整同步：外部数据覆盖本地
    await _bulkCopy.MergeAndDeleteToServer(
        _connectionString,
        new List<string> { "external_id" },
        "local_table",
        localData
    );
}
```

## 注意事项

- **主键/唯一约束**：`MergeToServer` 和 `MergeAndDeleteToServer` 的 `keys` 参数必须是主键或唯一约束字段
- **事务管理**：使用连接字符串的方法自动包含事务；使用连接对象的方法需手动管理事务
- **性能建议**：大批量数据（>10万条）建议分批处理
- **字段映射**：确保实体属性与数据库字段正确映射

## 详细 API 文档

完整的 API 参数说明和更多示例，请参阅：`references/bulk-operations.md`
