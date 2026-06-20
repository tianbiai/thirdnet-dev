# CTE 批量数据处理 — 详细模式参考

本文档提供 4 种典型 CTE 批量处理场景的完整代码示例和参数绑定模式。

> **关于 schema 前缀**：以下示例使用 `contract.`、`product.`、`order_.`、`application.` 等 schema，均来自不同的**微服务项目**（Service 项目各自拥有独立 schema）。Admin 项目的表使用 `admin.` 前缀。实际开发中请替换为你所开发项目的 schema 名称。

## 目录

1. [数据归档](#1-数据归档)
2. [批量同步](#2-批量同步)
3. [级联清理](#3-级联清理)
4. [状态迁移](#4-状态迁移)
5. [参数绑定模式](#参数绑定模式)
6. [RETURNING 子句用法](#returning-子句用法)
7. [性能对比](#性能对比)

---

## 1. 数据归档

**场景**：将过期数据从主表转移到归档表，保持主表精简。

**数据流**：查询过期记录 → 插入归档表 → 删除原表记录 → 返回处理数量

```csharp
/// <summary>
/// 归档操作结果视图
/// </summary>
public class ArchiveResultView
{
    /// <summary>
    /// 归档记录数
    /// </summary>
    public int archived_count { get; set; }
}

/// <summary>
/// 归档过期合同数据
/// </summary>
/// <param name="cutoffTime">截止时间，早于此时间的过期合同将被归档</param>
/// <returns>归档的记录数</returns>
public async Task<int> ArchiveExpiredContracts(DateTime cutoffTime)
{
    var sql = @"
        WITH
        -- 步骤 1：筛选过期合同
        expired AS (
            SELECT id, contract_no, customer_name, status, amount, created_at
            FROM contract.t_contract
            WHERE status = 'expired' AND created_at < {0}
        ),
        -- 步骤 2：插入归档表
        archived AS (
            INSERT INTO contract.t_contract_archive
                (id, contract_no, customer_name, status, amount, created_at, archived_at)
            SELECT id, contract_no, customer_name, status, amount, created_at, NOW()
            FROM expired
            RETURNING id
        ),
        -- 步骤 3：删除已归档记录
        removed AS (
            DELETE FROM contract.t_contract
            WHERE id IN (SELECT id FROM archived)
            RETURNING id
        )
        SELECT COUNT(*)::int AS archived_count FROM removed";

    var result = await _dbcontext.Database.SqlQueryRaw<ArchiveResultView>(sql, cutoffTime)
        .AsNoTracking()
        .FirstOrDefaultAsync();
    return result?.archived_count ?? 0;
}
```

**使用 ExecuteSqlInterpolated 的参数化版本**：

```csharp
public async Task<int> ArchiveExpiredContracts(DateTime cutoffTime, string targetStatus)
{
    var sql = $@"
        WITH
        expired AS (
            SELECT id, contract_no, customer_name, status, amount, created_at
            FROM contract.t_contract
            WHERE status = {targetStatus} AND created_at < {cutoffTime}
        ),
        archived AS (
            INSERT INTO contract.t_contract_archive
                (id, contract_no, customer_name, status, amount, created_at, archived_at)
            SELECT id, contract_no, customer_name, status, amount, created_at, NOW()
            FROM expired
            RETURNING id
        ),
        removed AS (
            DELETE FROM contract.t_contract
            WHERE id IN (SELECT id FROM archived)
            RETURNING id
        )
        SELECT COUNT(*)::int AS archived_count FROM removed";

    var result = await _dbcontext.Database.SqlQueryRaw<ArchiveResultView>(sql)
        .AsNoTracking()
        .FirstOrDefaultAsync();
    return result?.archived_count ?? 0;
}
```

---

## 2. 批量同步

**场景**：从临时/暂存表同步数据到正式表，同步后清理暂存数据。

**数据流**：查询源数据 → UPSERT 目标表 → 清理源数据

```csharp
/// <summary>
/// 同步操作结果视图
/// </summary>
public class SyncResultView
{
    /// <summary>
    /// 插入的记录数
    /// </summary>
    public int inserted_count { get; set; }

    /// <summary>
    /// 更新的记录数
    /// </summary>
    public int updated_count { get; set; }

    /// <summary>
    /// 清理的暂存记录数
    /// </summary>
    public int cleaned_count { get; set; }
}

/// <summary>
/// 从暂存表同步产品数据到正式表
/// </summary>
/// <param name="batchId">批次标识</param>
/// <returns>同步结果统计</returns>
public async Task<SyncResultView> SyncProductStagingData(string batchId)
{
    var sql = @"
        WITH
        -- 步骤 1：查询暂存数据
        staging AS (
            SELECT product_code, product_name, price, stock, category_id
            FROM product.t_product_staging
            WHERE batch_id = {0} AND sync_status = 'pending'
        ),
        -- 步骤 2：UPSERT 到正式表
        upserted AS (
            INSERT INTO product.t_product (product_code, product_name, price, stock, category_id, updated_at)
            SELECT product_code, product_name, price, stock, category_id, NOW()
            FROM staging
            ON CONFLICT (product_code) DO UPDATE SET
                product_name = EXCLUDED.product_name,
                price = EXCLUDED.price,
                stock = EXCLUDED.stock,
                category_id = EXCLUDED.category_id,
                updated_at = NOW()
            RETURNING id, (xmax = 0) AS is_insert
        ),
        -- 步骤 3：清理已同步的暂存数据
        cleaned AS (
            DELETE FROM product.t_product_staging
            WHERE batch_id = {0} AND sync_status = 'pending'
            RETURNING id
        )
        SELECT
            COUNT(*) FILTER (WHERE is_insert)::int AS inserted_count,
            COUNT(*) FILTER (WHERE NOT is_insert)::int AS updated_count,
            (SELECT COUNT(*)::int FROM cleaned) AS cleaned_count
        FROM upserted";

    return await _dbcontext.Database.SqlQueryRaw<SyncResultView>(sql, batchId)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}
```

**注意**：PostgreSQL 中 `(xmax = 0)` 在 `RETURNING` 中可判断是新插入（true）还是更新（false）的行。

---

## 3. 级联清理

**场景**：删除主记录的同时级联删除所有关联子表记录。

**数据流**：查询主记录 ID → 删除子表记录 → 删除主记录 → 返回清理统计

```csharp
/// <summary>
/// 级联清理结果视图
/// </summary>
public class CascadeCleanupResultView
{
    /// <summary>
    /// 删除的子记录数
    /// </summary>
    public int child_removed_count { get; set; }

    /// <summary>
    /// 删除的主记录数
    /// </summary>
    public int parent_removed_count { get; set; }
}

/// <summary>
/// 级联删除已取消的订单及其明细
/// </summary>
/// <param name="cutoffTime">截止时间</param>
/// <returns>清理统计</returns>
public async Task<CascadeCleanupResultView> CascadeCleanupCancelledOrders(DateTime cutoffTime)
{
    var sql = @"
        WITH
        -- 步骤 1：查询已取消的订单
        cancelled_orders AS (
            SELECT id
            FROM order_.t_order
            WHERE status = 'cancelled' AND updated_at < {0}
        ),
        -- 步骤 2：删除订单明细
        removed_items AS (
            DELETE FROM order_.t_order_item
            WHERE order_id IN (SELECT id FROM cancelled_orders)
            RETURNING id
        ),
        -- 步骤 3：删除订单日志
        removed_logs AS (
            DELETE FROM order_.t_order_log
            WHERE order_id IN (SELECT id FROM cancelled_orders)
            RETURNING id
        ),
        -- 步骤 4：最后删除主订单
        removed_orders AS (
            DELETE FROM order_.t_order
            WHERE id IN (SELECT id FROM cancelled_orders)
            RETURNING id
        )
        SELECT
            (SELECT COUNT(*)::int FROM removed_items) +
            (SELECT COUNT(*)::int FROM removed_logs) AS child_removed_count,
            (SELECT COUNT(*)::int FROM removed_orders) AS parent_removed_count";

    return await _dbcontext.Database.SqlQueryRaw<CascadeCleanupResultView>(sql, cutoffTime)
        .AsNoTracking()
        .FirstOrDefaultAsync();
}
```

**重要**：级联清理时，子表删除必须在主表删除之前完成，因为主表记录是子表的查询依据。

---

## 4. 状态迁移

**场景**：将待处理的记录迁移到目标状态表，并更新或删除原记录。

**数据流**：查询待处理记录 → 插入目标状态表 → 更新/删除原记录 → 返回迁移统计

```csharp
/// <summary>
/// 状态迁移结果视图
/// </summary>
public class MigrationResultView
{
    /// <summary>
    /// 迁移的记录数
    /// </summary>
    public int migrated_count { get; set; }
}

/// <summary>
/// 将已审批的申请迁移到生效表
/// </summary>
/// <param name="approver">审批人</param>
/// <returns>迁移的记录数</returns>
public async Task<int> MigrateApprovedApplications(string approver)
{
    var sql = @"
        WITH
        -- 步骤 1：查询已审批通过的申请
        approved AS (
            SELECT id, applicant, title, content, approved_at
            FROM application.t_application
            WHERE status = 'approved' AND approver = {0}
        ),
        -- 步骤 2：插入生效表
        activated AS (
            INSERT INTO application.t_application_active
                (source_id, applicant, title, content, effective_at)
            SELECT id, applicant, title, content, NOW()
            FROM approved
            RETURNING source_id
        ),
        -- 步骤 3：更新原申请状态为已生效
        updated AS (
            UPDATE application.t_application
            SET status = 'activated', activated_at = NOW()
            WHERE id IN (SELECT source_id FROM activated)
            RETURNING id
        )
        SELECT COUNT(*)::int AS migrated_count FROM updated";

    var result = await _dbcontext.Database.SqlQueryRaw<MigrationResultView>(sql, approver)
        .AsNoTracking()
        .FirstOrDefaultAsync();
    return result?.migrated_count ?? 0;
}
```

---

## 参数绑定模式

### 方式一：位置参数（FromSqlRaw / ExecuteSqlRaw）

```csharp
// 使用 {0}, {1} 占位符，参数按顺序传入
var sql = @"... WHERE status = {0} AND created_at < {1}";
await _dbcontext.Database.ExecuteSqlRawAsync(sql, status, cutoffTime);

// 查询场景使用 SqlQueryRaw
var result = await _dbcontext.Database.SqlQueryRaw<ResultView>(sql, status, cutoffTime)
    .AsNoTracking()
    .ToListAsync();
```

### 方式二：内插语法（ExecuteSqlInterpolated）

```csharp
// 使用 $"" 内插，EF Core 自动参数化
await _dbcontext.Database.ExecuteSqlInterpolatedAsync($@"
    WITH matched AS (...)
    DELETE FROM contract.t_contract
    WHERE id IN (SELECT id FROM matched)");
```

### 方式三：NpgsqlParameter 显式参数化

```csharp
// 显式指定参数类型，适用于数组、JSONB 等特殊类型
var parameters = new[]
{
    new NpgsqlParameter("ids", NpgsqlDbType.Array | NpgsqlDbType.Bigint) { Value = idList },
    new NpgsqlParameter("status", NpgsqlDbType.Text) { Value = "expired" }
};
var sql = @"... WHERE id = ANY(@ids) AND status = @status";
await _dbcontext.Database.ExecuteSqlRawAsync(sql, parameters);
```

### ⚠️ 禁止做法

```csharp
// ❌ 禁止：字符串拼接 SQL（SQL 注入风险）
var sql = $"DELETE FROM contract.t_contract WHERE status = '{status}'";

// ✅ 正确：使用参数化
await _dbcontext.Database.ExecuteSqlInterpolatedAsync(
    $"DELETE FROM contract.t_contract WHERE status = {status}");
```

---

## RETURNING 子句用法

`RETURNING` 子句在 CTE 中有两个作用：

### 1. 在 CTE 链内传递数据

后续 CTE 节点通过 `SELECT id FROM previous_cte_name` 引用前序节点的 `RETURNING` 结果：

```sql
WITH
  step1 AS (
    INSERT INTO target (...) SELECT ... FROM source RETURNING id
  ),
  step2 AS (
    DELETE FROM source WHERE id IN (SELECT id FROM step1) RETURNING id
  )
SELECT COUNT(*) FROM step2;
```

### 2. 返回统计信息给调用方

最终 `SELECT` 汇总各 CTE 节点的操作结果，通过 View 模型返回给 C# 代码：

```csharp
// View 模型接收 RETURNING 的统计
public class OperationResultView
{
    public int total_count { get; set; }
}
```

---

## 性能对比

| 指标 | 多步 SaveChanges | CTE 单次往返 |
|------|-----------------|-------------|
| 网络往返 | N 次（每个 SaveChanges 一次） | 1 次 |
| 执行计划 | 每条语句独立优化 | 统一执行计划 |
| 锁持有时间 | 长（多次往返累积） | 短（单批次完成） |
| 事务一致性 | 需显式 TransactionScope | 单条 SQL 天然原子性 |
| 适用数据量 | 小批量（<100） | 中大批量（数百至数十万） |

### 性能优势说明

- **减少网络开销**：一次数据库调用替代 N 次独立查询/命令
- **优化执行计划**：PostgreSQL 优化器可对整条 CTE 链生成统一执行计划，避免逐条语句独立优化导致的整体次优
- **降低锁持有时间**：单批次完成操作，缩短行级锁和表级锁的持有周期，提升并发吞吐
