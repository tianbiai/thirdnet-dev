# PostgreSQL 批量操作详细 API 文档

## 概述

`PostgresqlAsyncBulk` 是一个针对 PostgreSQL 数据库的高性能批量操作类。基于 Npgsql 的 `COPY` 命令实现，支持二进制格式导入，提供高效的数据插入、更新、合并及同步功能。

**命名空间**: `ThirdNet.Core.Common`
**核心接口**: `IDbAsyncBulk`

## 初始化

### 依赖注入

通过依赖注入进行初始化实例。

### 初始化映射关系

使用 `InitDefaultMappings<T>()` 方法自动初始化实体类与数据库表的映射关系。

```csharp
Task InitDefaultMappings<T>()
```

**功能**:
- 使用反射自动扫描实体类型的属性
- 默认数据库字段名为属性名小写
- 自动推断数据库字段类型
- 忽略标记了 `DbBulkAttribute` 且 `Ignore=true` 的属性

**示例**:

```csharp
await bulkCopy.InitDefaultMappings<User>();
```

### 自定义映射

手动设置 `Mappings` 属性进行自定义映射：

```csharp
bulkCopy.Mappings = new List<NpgMappingInfo>
{
    new NpgMappingInfo
    {
        ObjectKey = "UserId",
        DbKey = "user_id",
        Type = NpgsqlDbType.Integer
    },
    new NpgMappingInfo
    {
        ObjectKey = "UserName",
        DbKey = "username",
        Type = NpgsqlDbType.Text
    }
};
```

## 核心属性

### Mappings

```csharp
public List<NpgMappingInfo> Mappings { get; set; }
```

字段映射列表，包含对象属性名、数据库字段名和数据库类型的映射关系。

---

## 方法详解

### 1. CopyToServer - 批量添加

将数据批量插入到数据库表中。

**重载方法**:

```csharp
// 方法1：使用连接字符串
Task CopyToServer<T>(string connection_string, string targetTable, List<T> list)
// 方法2：使用已打开的数据库连接
Task CopyToServer<T>(DbConnection connection, string targetTable, List<T> list)
```

**参数**:
- `connection_string`: 数据库连接字符串（方法1）
- `connection`: 已打开的数据库连接（方法2），若无后续操作不应复用该连接
- `targetTable`: 目标表名
- `list`: 待添加的数据列表

**使用示例**:

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 25 },
    new User { Id = 2, Name = "李四", Age = 30 }
};
await bulkCopy.InitDefaultMappings<User>();
await bulkCopy.CopyToServer(connectionString, "users", users);
```

**注意事项**:
- 使用 PostgreSQL 的 `COPY FROM STDIN (FORMAT BINARY)` 命令
- 数据按照映射配置的字段顺序导入
- 适合大批量数据插入

---

### 2. CopyToServerWithoutUniqueKey - 条件插入

批量插入数据，仅插入不存在的记录（基于指定字段判断），存在的记录不执行操作。适用于无唯一约束的场景。

**重载方法**:

```csharp
// 方法1：使用连接字符串
Task CopyToServerWithoutUniqueKey<T>(string connection_string, List<string> where_keys,
    string targetTable, List<T> list, string tempTable = null,
    List<string> insertmapping = null, string where_extend_sql = null)
// 方法2：使用已打开的数据库连接
Task CopyToServerWithoutUniqueKey<T>(DbConnection connection, List<string> where_keys,
    string targetTable, List<T> list, string tempTable = null,
    List<string> insertmapping = null, string where_extend_sql = null)
```

**参数**:
- `where_keys`: 用于判断是否存在的字段列表（如主键或业务唯一键）
- `targetTable`: 目标表名
- `list`: 待添加的数据列表
- `tempTable`: 临时表名（可选，默认为 `targetTable + "_temp"`）
- `insertmapping`: 指定要插入的字段（可选，默认使用所有映射字段）
- `where_extend_sql`: 扩展 WHERE 条件（可选）

**执行流程**:
1. 创建临时表（结构与目标表相同）
2. 将数据导入临时表
3. 从临时表插入不存在的记录到目标表

**使用示例**:

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 25 },
    new User { Id = 3, Name = "王五", Age = 28 }
};
await bulkCopy.InitDefaultMappings<User>();

// 仅插入 id 不存在的记录
await bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);

// 仅插入 id 和 name 都不存在的记录
await bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    new List<string> { "id", "name" },
    "users",
    users
);

// 指定临时表名和插入字段
await bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    new List<string> { "id" },
    "users",
    users,
    "temp_users",
    new List<string> { "id", "name" }
);

// 使用扩展 WHERE 条件
await bulkCopy.CopyToServerWithoutUniqueKey(
    connectionString,
    new List<string> { "id" },
    "users",
    users,
    where_extend_sql: "age > 20"
);
```

---

### 3. MergeToServer - 合并（存在则更新，不存在则插入）

根据指定的键字段，对数据进行合并操作。如果数据存在则更新，不存在则插入。

**重载方法**:

```csharp
// 方法1：使用连接字符串
Task MergeToServer<T>(string connection_string, List<string> keys, string targetTable,
    List<T> list, string tempTable = null, List<string> insertmapping = null,
    List<string> updatemapping = null, string update_extend_sql = null)
// 方法2：使用已打开的数据库连接
Task MergeToServer<T>(DbConnection connection, List<string> keys, string targetTable,
    List<T> list, string tempTable = null, List<string> insertmapping = null,
    List<string> updatemapping = null, string update_extend_sql = null)
```

**参数**:
- `keys`: 用于匹配的字段列表（需要是主键或唯一约束字段）
- `targetTable`: 目标表名
- `list`: 待导入的数据列表
- `tempTable`: 临时表名（可选，默认为 `targetTable + "_temp"`）
- `insertmapping`: 指定插入的字段（可选，用于避免插入自增列）
- `updatemapping`: 指定更新的字段（可选，默认使用所有映射字段）
- `update_extend_sql`: 自定义更新语句（可选，如 `"count=count+EXCLUDED.count"`）

**执行流程**:
1. 创建临时表
2. 将数据导入临时表
3. 使用 `ON CONFLICT` 语句合并到目标表

**使用示例**:

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 26 },
    new User { Id = 3, Name = "王五", Age = 28 }
};
await bulkCopy.InitDefaultMappings<User>();

// 使用 id 作为匹配键，存在则更新所有字段，不存在则插入
await bulkCopy.MergeToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);

// 指定只插入和更新特定字段
await bulkCopy.MergeToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users,
    insertmapping: new List<string> { "id", "name", "age" },
    updatemapping: new List<string> { "name", "age" }
);

// 使用自定义更新语句（累加操作）
await bulkCopy.MergeToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users,
    update_extend_sql: "visit_count = visit_count + EXCLUDED.visit_count"
);
```

**注意事项**:
- `keys` 参数指定的字段必须具有主键或唯一约束，否则可能导致错误

---

### 4. UpdateToServer - 批量更新

批量更新数据库中已存在的记录。

**重载方法**:

```csharp
// 方法1：使用连接字符串
Task UpdateToServer<T>(string connection_string, List<string> where_name,
    List<string> update_name, string targetTable, List<T> list,
    string tempTable = null, string update_extend_sql = null, string where_extend_sql = null)
// 方法2：使用已打开的数据库连接
Task UpdateToServer<T>(DbConnection connection, List<string> where_name,
    List<string> update_name, string targetTable, List<T> list,
    string tempTable = null, bool createtemp = true,
    string update_extend_sql = null, string where_extend_sql = null)
```

**参数**:
- `where_name`: 用于匹配的字段列表（WHERE 条件）
- `update_name`: 需要更新的字段列表
- `targetTable`: 目标表名
- `list`: 待导入的数据列表
- `tempTable`: 临时表名（可选，默认为 `targetTable + "_temp"`）
- `createtemp`: 是否创建临时表（仅方法2，默认为 true）
- `update_extend_sql`: 扩展 SET 语句（可选）
- `where_extend_sql`: 扩展 WHERE 语句（可选）

**执行流程**:
1. 创建临时表
2. 将数据导入临时表
3. 根据匹配条件更新目标表

**使用示例**:

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三三", Age = 26 },
    new User { Id = 2, Name = "李四四", Age = 31 }
};
await bulkCopy.InitDefaultMappings<User>();

// 根据 id 匹配，更新 name 和 age 字段
await bulkCopy.UpdateToServer(
    connectionString,
    new List<string> { "id" },
    new List<string> { "name", "age" },
    "users",
    users
);

// 使用扩展 SET 语句
await bulkCopy.UpdateToServer(
    connectionString,
    new List<string> { "id" },
    new List<string> { "name" },
    "users",
    users,
    update_extend_sql: "update_time = NOW()"
);

// 使用扩展 WHERE 语句
await bulkCopy.UpdateToServer(
    connectionString,
    new List<string> { "id" },
    new List<string> { "age" },
    "users",
    users,
    where_extend_sql: "status = 'active'"
);

// 复用临时表进行多次更新
await bulkCopy.CopyToServer(connection, "users_temp", users);
await bulkCopy.UpdateToServer(connection, new List<string> { "id" },
    new List<string> { "name" }, "users", users, "users_temp", createtemp: false);
await bulkCopy.UpdateToServer(connection, new List<string> { "id" },
    new List<string> { "age" }, "users", users, "users_temp", createtemp: false);
```

---

### 5. MergeAndDeleteToServer - 合并并删除

执行完整的同步操作：存在则更新，不存在则插入，源数据不存在但目标表存在的记录则删除。

**重载方法**:

```csharp
// 方法1：使用连接字符串（自动包含事务）
Task MergeAndDeleteToServer<T>(string connection_string, List<string> keys,
    string targetTable, List<T> list, string tempTable = null,
    List<string> insertmapping = null, List<string> updatemapping = null,
    string update_extend_sql = null)
// 方法2：使用已打开的数据库连接（不包含事务，需手动管理）
Task MergeAndDeleteToServer<T>(DbConnection connection, List<string> keys,
    string targetTable, List<T> list, string tempTable = null,
    List<string> insertmapping = null, List<string> updatemapping = null,
    string update_extend_sql = null)
```

**参数**:
- `keys`: 用于匹配的字段列表（需要是主键或唯一约束字段）
- `targetTable`: 目标表名
- `list`: 待导入的数据列表
- `tempTable`: 临时表名（可选，默认为 `targetTable + "_temp"`）
- `insertmapping`: 指定插入的字段（可选）
- `updatemapping`: 指定更新的字段（可选）
- `update_extend_sql`: 自定义更新语句（可选）

**执行流程**:
1. 创建临时表
2. 将数据导入临时表
3. 删除目标表中存在但临时表不存在的记录
4. 合并临时表数据到目标表

**使用示例**:

```csharp
var users = new List<User>
{
    new User { Id = 1, Name = "张三", Age = 26 },
    new User { Id = 3, Name = "王五", Age = 28 }
};
await bulkCopy.InitDefaultMappings<User>();

// 完整同步：更新 id=1 和 id=3，删除其他不在列表中的记录
await bulkCopy.MergeAndDeleteToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users
);

// 指定字段和自定义更新
await bulkCopy.MergeAndDeleteToServer(
    connectionString,
    new List<string> { "id" },
    "users",
    users,
    insertmapping: new List<string> { "id", "name" },
    updatemapping: new List<string> { "name" },
    update_extend_sql: "sync_time = NOW()"
);

// 手动管理事务
using (var connection = new NpgsqlConnection(connectionString))
{
    await connection.OpenAsync();
    using (var transaction = await connection.BeginTransactionAsync())
    {
        try
        {
            await bulkCopy.MergeAndDeleteToServer(
                connection,
                new List<string> { "id" },
                "users",
                users
            );
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}
```

**注意事项**:
- 方法1 使用连接字符串时会自动包含事务
- 方法2 使用数据库连接时不包含事务，需手动管理
- `keys` 参数指定的字段必须具有主键或唯一约束

---

### 6. CreateTempTable - 创建临时表

创建与目标表结构相同的临时表。

```csharp
Task CreateTempTable(string tempTable, string targetTable, DbConnection connection)
```

**参数**:
- `tempTable`: 临时表名
- `targetTable`: 目标表名（复制其结构）
- `connection`: 数据库连接（需已打开）

**使用示例**:

```csharp
using (var connection = new NpgsqlConnection(connectionString))
{
    await connection.OpenAsync();
    await bulkCopy.CreateTempTable("temp_users", "users", connection);
}
```

---

## DbBulkAttribute 特性

用于标记实体类的属性，控制批量操作行为。

### 属性

| 属性 | 类型 | 说明 |
|-----|------|------|
| `Ignore` | `bool` | 是否忽略该字段。true 则不参与批量操作 |
| `ColumnName` | `string` | 数据库列名。不设置则默认为属性名小写 |
| `Type` | `NpgsqlDbType` | 数据库字段类型。默认为 `NpgsqlDbType.Text` |
| `UnknownType` | `string` | 未知类型名称，设置则使用该类型对应的值 |

### 使用示例

```csharp
using ThirdNet.Core.Common;
using NpgsqlTypes;

public class User
{
    [DbBulk(Ignore = true)]
    public int InternalId { get; set; }

    [DbBulk(ColumnName = "user_id", Type = NpgsqlDbType.Integer)]
    public int Id { get; set; }

    [DbBulk(Type = NpgsqlDbType.Varchar)]
    public string Name { get; set; }

    [DbBulk(UnknownType = "jsonb")]
    public string Metadata { get; set; }

    [DbBulk]
    public int Age { get; set; }
}

// 初始化时会自动读取这些特性
await bulkCopy.InitDefaultMappings<User>();
```
