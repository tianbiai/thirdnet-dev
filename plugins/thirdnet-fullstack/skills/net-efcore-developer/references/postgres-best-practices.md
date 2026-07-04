# PostgreSQL 最佳实践补充

本插件的核心约定（`long id` 主键、snake_case + `t_` 前缀、`text` 而非 `varchar(n)`、xmin 乐观并发、二进制 COPY、CTE 单语句、`ON CONFLICT` upsert、强制 `IDbContextFactory` 池化、参数化 SQL）已与 Supabase 维护的《Postgres Best Practices》一致。本文档补充其余**尚未覆盖**的最佳实践，按 8 大类组织，每节给出「插件现状 / 缺口 / EF Core 或原生 SQL 应采用的模式」。

> 参考规则来源：`supabase-postgres-best-practices` 技能（`query-` / `conn-` / `security-` / `schema-` / `lock-` / `data-` / `monitor-` / `advanced-` 八类前缀）。

---

## 一、索引策略（query- / schema-foreign-key-indexes）

### 插件现状

仅 `HasIndex(x => x.field).IsUnique()` 唯一索引、`HasIndex(x => new { x.a, x.b }).IsUnique()` 复合唯一索引、`HasFilter(...)` 部分索引（`permission <> ''` 一例）。**未覆盖**：GIN/GiST/BRIN 等非 B-tree 索引、覆盖索引（INCLUDE）、部分索引的一般化规则、复合索引列序原则。

### 1.1 JSONB / 数组列必须配 GIN 索引

`complex-types.md` 中明确使用 `jsonb`、`text[]`、`bigint[]` 列，但未给出索引指引。这些列上的 `@>`（包含）、数组操作符无法走 B-tree，会退化为全表扫描。

```csharp
// jsonb 列 — 默认 jsonb_ops（支持所有运算符）
builder.Property(x => x.extra_info).HasColumnType("jsonb");
builder.HasIndex(x => x.extra_info).HasMethod("gin");

// 若仅用 @> 查询，用 jsonb_path_ops（索引体积小 2-3 倍）
builder.HasIndex(x => x.extra_info)
    .HasMethod("gin")
    .HasOperators("jsonb_path_ops");

// 数组列（如 tags text[]）— 含义查询 WHERE '标签A' = ANY(tags)
builder.HasIndex(x => x.tags).HasMethod("gin");

// 单键查找 WHERE extra_info->>'brand' = 'Nike' — 用表达式索引
builder.HasIndex("brand_expr")
    .HasMethod("btree")
    // EF Core 不直接支持表达式索引，迁移中手写：
    ;
// 对应原生 SQL（放在迁移文件里）：
// CREATE INDEX idx_product_brand ON order.t_product ((extra_info->>'brand'));
```

### 1.2 覆盖索引（INCLUDE）

当查询只读少量非过滤列时，`INCLUDE` 让 Postgres 走 index-only scan，跳过堆表回取。EF Core 不直接支持 `INCLUDE`，需在迁移中手写：

```sql
-- 仅查 email 但 SELECT 里还要 name/created_time → 加 INCLUDE 避免 heap fetch
CREATE INDEX idx_sys_user_email ON admin.t_sys_user (email) INCLUDE (nick_name, created_time);
```

### 1.3 部分索引通用规则

把现有 `permission <> ''` 示例抽象为一般原则：**当查询恒定带某谓词时，把谓词下推到索引**，缩小索引体积、加速写入与读取。

```csharp
// 软删除场景：仅查未删除行（本插件用 StatusEnum，而非 deleted_at，原理相同）
builder.HasIndex(x => x.user_name)
    .HasFilter("status = 0")   // 0=正常，仅索引正常行
    .IsUnique();
```

### 1.4 复合索引列序

复合索引遵循**左前缀原则**：等值列在前、范围列在后。`HasIndex(x => new { x.a, x.b })` 的顺序即索引列序，写错会导致无法命中。

```csharp
// 查询：WHERE status = 0 AND created_time > @since
// ✅ 等值列 status 在前
builder.HasIndex(x => new { x.status, x.created_time });
// ❌ 反过来则 created_time 的范围扫描无法利用 status 过滤
```

---

## 二、N+1 查询消除（data-n-plus-one）

### 插件现状

`project-spec-template.md` 仅列「避免 N+1 查询」勾选项，无 EF Core 专属指引。

### 模式

```csharp
// ❌ N+1：循环内逐条查询
foreach (var orderId in orderIds)
{
    var items = await db.OrderItems.Where(x => x.order_id == orderId).ToListAsync();
}

// ✅ 单次查询：WHERE id = ANY(@ids)
var allItems = await db.OrderItems
    .Where(x => orderIds.Contains(x.order_id))
    .ToListAsync();

// ✅ 优先用 Select 投影（同时消除 N+1 与过度读取）
var dto = await db.Orders
    .AsNoTracking()
    .Where(x => ids.Contains(x.id))
    .Select(o => new OrderItemMap
    {
        order_no = o.order_no,
        item_names = o.Items.Select(i => i.name).ToList() // 转为子查询，非 N+1
    })
    .ToListAsync();

// 需整图时用 Include；多集合 Include 用 AsSplitQuery 避免笛卡尔爆炸
var order = await db.Orders
    .Include(o => o.Items)
    .Include(o => o.Payments)
    .AsSplitQuery()           // 拆成多条 SQL，避免 JOIN 行数爆炸
    .FirstOrDefaultAsync(x => x.id == id);
```

**原则**：Controller 不返回实体（已由 `net-api-developer` 强制），故优先 `Select` 投影到 Map；只有需要完整聚合根时才 `Include`，且多集合 `Include` 必加 `AsSplitQuery()`。

---

## 三、分页：常规 OFFSET 与 Keyset（data-pagination）

### 插件现状

框架 `IQueryable<T>.ToPageListAsync(page_index, page_size)` 为 OFFSET 分页，`page_size ≤ 1000`。OFFSET 在大偏移下会扫描并丢弃所有跳过的行，深翻页性能塌陷。

### 模式

- **常规后台列表分页**：继续用 `ToPageListAsync`（页数有限、可跳页）。
- **深翻页 / 无限滚动 / 实时数据流**：改用 keyset（游标）分页，O(1) 不随页深退化。

```csharp
// keyset：以 (created_time, id) 为游标，id 作为 created_time 相同时的 tie-breaker
var rows = await db.Records
    .AsNoTracking()
    .Where(x => x.created_time < lastTime
        || (x.created_time == lastTime && x.id < lastId))
    .OrderByDescending(x => x.created_time)
    .ThenByDescending(x => x.id)
    .Take(pageSize)
    .ToListAsync();
// 配合复合索引：(created_time DESC, id DESC)
```

---

## 四、连接管理（conn-）

### 插件现状

`AddPooledDbContextFactory` 强制池化，到 DbContext 层即可。生产部署的连接层配置（PgBouncer、超时、内存参数、prepared statement 与池化冲突）未覆盖。

### 4.1 部署建议

- **PgBouncer transaction mode**：每条 Postgres 连接占 1–3 MB，池化器以 `pool_size ≈ CPU 核数 × 2 + 磁盘数` 即可支撑远高于此的并发用户。
- **超时回收**：`idle_in_transaction_session_timeout = '30s'`（卡在事务里的连接必须回收，否则持有锁）、`idle_session_timeout = '10min'`。
- **内存配比**：`max_connections` 按 `RAM_MB / 5MB - reserved` 估算；`work_mem × max_connections ≤ 25% RAM`，否则高并发下 OOM。

### 4.2 池化下 prepared statement 冲突

Npgsql 默认开启 prepared statement，**在 transaction-mode 池化（如 PgBouncer 6543 端口）下会因 prepared statement 绑定到特定后端连接而报「prepared statement 不存在」**。两种解法择一：

- 连接字符串禁用：`Pooling=true;Max Auto Prepare=0`（牺牲 prepared 优化）。
- 或使用 session-mode / 直连（5432 端口，保留 prepared，但失去多路复用）。

EF 的 `EnableRetryOnFailure()` 与 prepared statement 也有交互，启用重试时需测试上述组合。

---

## 五、并发与锁（lock-）

### 插件现状

xmin 乐观并发（自动注册）+ 安全写操作用 `Serializable` 隔离 + 原子递增 + TOCTOU 唯一约束兜底。**未覆盖**：队列认领、advisory lock、短事务原则、死锁检测。

### 5.1 队列原子认领（FOR UPDATE SKIP LOCKED）

多 worker 抢任务时，`SKIP LOCKED` 让每个 worker 取到不同行而不互相阻塞，吞吐 10×。

```sql
-- 单语句原子认领并置位
UPDATE order.t_job
SET status = 'processing', worker_id = @worker, claimed_at = NOW()
WHERE id = (
    SELECT id FROM order.t_job
    WHERE status = 'pending'
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING *;
```

### 5.2 Advisory lock（DB 内协调）

当协调对象不是某行数据（如「全局只允许一个报表生成实例」），用 advisory lock 而非造一行假数据上锁。与现有 `RedisLock`（跨进程分布式）互补——advisory lock 适合**单库内、与事务强相关**的协调。

```sql
SELECT pg_advisory_xact_lock(hashtext('report_generator'));  -- 事务级，commit 自动释放
-- 或非阻塞版：SELECT pg_try_advisory_lock(...)
```

### 5.3 短事务原则

**事务内禁止 HTTP / 外部 API 调用**。外部调用应放在事务之前；事务只做「BEGIN → 写库 → COMMIT」几毫秒。配合 `statement_timeout` 兜底：

```sql
SET LOCAL statement_timeout = '5s';  -- 当前事务内生效
```

### 5.4 死锁检测

部署侧开启 `log_lock_waits = on`、`deadlock_timeout = '1s'`，便于事后定位；`pg_stat_database.deadlocks` 看死锁计数。多行更新按固定列序（如 `ORDER BY id`）上锁可预防死锁。

---

## 六、监控与诊断（monitor-）—— 插件此前完全缺失

### 6.1 EXPLAIN (ANALYZE, BUFFERS)

慢查询必须经 `EXPLAIN` 验证根因，不要靠猜。解读清单：

| 输出信号 | 含义 | 对策 |
|---------|------|------|
| `Seq Scan` on 大表 | 缺索引 | 加索引（见第一节） |
| `Rows Removed by Filter` 很大 | 过滤选择性差 | 调整索引列序或部分索引 |
| `Buffers: read >> hit` | 命中率低、走磁盘 | 增内存 / 调 `shared_buffers` |
| external merge `Sort` | `work_mem` 不足 | 调大 `work_mem` |
| 高 loops 的 `Nested Loop` | 连接策略不当 | 考虑调整 JOIN 或补索引 |

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM admin.t_sys_user WHERE dept_id = 123;
```

### 6.2 pg_stat_statements 找慢查询

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 总耗时 TOP 10
SELECT calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- 优化后重置统计
SELECT pg_stat_statements_reset();
```

### 6.3 ANALYZE 与 autovacuum

大批量写入后 planner 统计可能滞后，导致选错执行计划（把大表当小表全表扫描）。大变更后手动 `ANALYZE`；高 churn 表调紧 autovacuum 阈值：

```sql
ANALYZE admin.t_sys_user;                       -- 全表
ANALYZE admin.t_sys_user (status, created_time); -- 指定列
-- 高写入表
ALTER TABLE admin.t_sys_oper_log SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
```

---

## 七、迁移安全性（schema-constraints / 在线变更）

### 插件现状

给出 `dotnet ef migrations add/update/rollback` 命令，未给生产迁移的安全模式。

### 7.1 Expand / Contract（零停机）

变更分多步、每次可回滚：

1. **Expand**：加新列（可空或有默认值）/ 加新表。
2. **Migrate**：分批回填（见 7.3），双写新旧字段。
3. **Switch**：读路径切到新列。
4. **Contract**：确认稳定后删旧列。

### 7.2 大表 ALTER 的锁风险

`ALTER TABLE ADD COLUMN ... DEFAULT ... NOT NULL` 在旧 PG 版本会重写全表并长锁；新列默认用「可空 + 应用层补值 + 回填 + 加 NOT NULL 约束」分步。索引创建用 `CREATE INDEX CONCURRENTLY`（不阻塞写，但不能再事务里）：

```sql
CREATE INDEX CONCURRENTLY idx_xxx_field ON admin.t_xxx (field);
```

EF 生成的 `CREATE INDEX` 不带 `CONCURRENTLY`，生产环境大表索引应手写迁移补上。

### 7.3 大表回填分批

```sql
-- 分批 UPDATE，每批 1 万，避免长事务与锁堆积
UPDATE admin.t_xxx SET new_col = ... WHERE id BETWEEN 1 AND 10000 AND new_col IS NULL;
```

### 7.4 幂等约束

`ADD CONSTRAINT IF NOT EXISTS` 在 Postgres 是**非法语法**（会报 42601）。幂等迁移用 `DO $$ ... $$` 块先查 `pg_constraint`：

```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uk_xxx_field' AND conrelid = 'admin.t_xxx'::regclass
    ) THEN
        ALTER TABLE admin.t_xxx ADD CONSTRAINT uk_xxx_field UNIQUE (field);
    END IF;
END $$;
```

---

## 八、时区类型（schema-data-types）—— 硬性约定

> 本节是主技能「核心规则 · 时间字段类型（timestamptz）」的展开说明。

### 为什么必须 timestamptz

实体审计字段为 `DateTime created_time`，`HasDefaultValueSql("now()")`。但 Npgsql **默认把 `DateTime` 映射为 `timestamp without time zone`**（不带时区），而项目约定要求 `timestamptz`（带时区、库内存 UTC）。混用时区时（服务器时区不一致、跨时区查询、跨节点部署）数据会错位——因此 `timestamptz` 是**硬性约定**而非建议。

### 落地方式

全局把时间列映射为 `timestamptz`。两种做法：

```csharp
// 方法一：DbContext 中全局约定
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    foreach (var prop in modelBuilder.Model.GetEntityTypes()
        .SelectMany(e => e.GetProperties())
        .Where(p => p.ClrType == typeof(DateTime) || p.ClrType == typeof(DateTime?)))
    {
        prop.SetColumnType("timestamptz");
    }
    // ... 其余 OnModelCreating 逻辑
}

// 方法二：逐列显式（更可控）
builder.Property(x => x.last_active_time).HasColumnType("timestamptz");
```

### 配套：应用层写入必须用 DateTime.UtcNow

`timestamptz` 列要求写入的 `DateTime` 为 `Kind == Utc`。应用层对**业务时间字段**赋值（如 `login_date`、`lockout_end`、`last_active_time`、各类计划/截止时间，以及批量入库时提供的时间值）时，**必须用 `DateTime.UtcNow`，禁止 `DateTime.Now`**——后者 `Kind == Local`，Npgsql 会抛 `InvalidCastException`。

```csharp
user.last_active_time = DateTime.UtcNow;  // ✅
user.last_active_time = DateTime.Now;     // ❌ Local Kind，写入 timestamptz 抛异常
```

> 审计字段 `created_time` / `updated_time` 仍走 `now()` 数据库默认值（`now()` 返回的本身就是 `timestamptz`），Service 层无需赋值，不涉及此处约束。

> 注：既有库切换列类型属破坏性变更，需经 expand/contract（先加 timestamptz 新列 → 回填 → 切换 → 删旧列）。新项目 / 新实体直接建为 `timestamptz` 即可。

---

## 九、高级特性（advanced-）

### 9.1 全文检索

`LIKE '%...%'` 无法用任何索引。用 `tsvector` 生成列 + GIN 索引：

```sql
ALTER TABLE admin.t_notice
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || content)) STORED;
CREATE INDEX idx_notice_search ON admin.t_notice USING gin (search_vector);

SELECT *, ts_rank(search_vector, q) AS rank
FROM admin.t_notice, to_tsquery('simple', '公告 & 通知') q
WHERE search_vector @@ q
ORDER BY rank DESC;
```

### 9.2 JSONB 表达式索引

（见 1.1）单键频繁查找用表达式索引，多键 `@>` 用 GIN。

---

## 参考规则前缀速查

| 类别 | 前缀 | 本插件覆盖度 |
|------|------|------------|
| Query Performance | `query-` | 本文补齐 GIN/覆盖/部分/列序 |
| Connection Management | `conn-` | 本文补齐 PgBouncer/超时/prepared |
| Security & RLS | `security-` | 设计取舍（见主技能「设计取舍说明」） |
| Schema Design | `schema-` | 主约定已对齐；本文补 timestamptz 硬性约定 + UtcNow 配套、迁移幂等 |
| Concurrency & Locking | `lock-` | 本文补 SKIP LOCKED/advisory/短事务 |
| Data Access Patterns | `data-` | 本文补 N+1、keyset 分页 |
| Monitoring & Diagnostics | `monitor-` | 本文全部新增 |
| Advanced Features | `advanced-` | 本文补全文检索、jsonb 索引 |
