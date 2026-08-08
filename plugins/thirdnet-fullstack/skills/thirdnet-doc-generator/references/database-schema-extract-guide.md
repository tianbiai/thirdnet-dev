# 数据库表结构提取指引（database-schema-extract-guide）

> 本文件定义 thirdnet-doc-generator 技能在生成**数据库表结构文档**时，于 Step 3.7「经 PostgreSQL MCP 提取表结构」执行的详细操作。
> 目的：把已连接的 PostgreSQL 库的真实表结构（表名 / schema / 表用途 / 字段：列名·类型·注释·备注）经 `@bytebase/dbhub` MCP 导出为结构化「表结构清单」，供 Step 4 填充 `database-schema-template.md`。
> 数据源是**实时库**，不经代码扫描——这是本类型与其它 4 类（走 [doc-scan-guide](doc-scan-guide.md) 代码扫描）的根本区别。

## 定位与数据源

数据库表结构文档是**技术参考文档**（与 `spec.md` 同类），表名 / 字段类型本就是它的内容，**不受**交付文档「禁堆代码级细节」原则约束。表 / 字段 / 类型 / 注释的唯一权威来源是**实时 PostgreSQL**；MCP 是硬依赖，**不做**代码扫描替代。

## 前置硬依赖检查（不过则中止）

1. **确认 dbhub MCP 已连接**：服务名 `postgres`（由 `thirdnet-mcp-setup` 装配的 `@bytebase/dbhub`）。判定——会话内是否可用其两个工具 `execute_sql` 与 `search_objects`（可 `/mcp` 查看，状态为 `✔ Connected` 才算就绪；`⏸ Pending approval` 表示尚未批准，也不可用）。
2. **未连接 → 中止**：明确告知用户「数据库表结构文档需要 PostgreSQL MCP（dbhub）已连接」，引导其先运行 `thirdnet-fullstack:thirdnet-mcp-setup`（或用 `claude mcp list` 诊断、`claude mcp get postgres` 看配置），挂好 dbhub 并在交互式会话批准连接后重试。**不要降级为 EF Core 代码扫描**——本类型要的是线上真实结构，代码扫描不替代（用户已明确选「MCP 硬依赖」）。
3. **只读约定**：只用 `search_objects` 与 `execute_sql` 的查询能力，**绝不执行 DML/DDL**（不 INSERT/UPDATE/DELETE/改结构）。dbhub 默认有只读保护，仍以自律为先。

## 选库与范围（AskUserQuestion）

dbhub 已连到某个具体 DSN（`thirdnet-mcp-setup` 时由用户选定——Admin 工程通常是业务库 `ConnectionString`/`AdminDbContext`/admin schema，或框架库 `DefaultConnectionString`/`ThirdNetDbContext`/public schema）。本步不再选 DSN，只确定**文档化范围**：

- **schema 范围**：默认纳入所有**用户 schema**，排除系统 schema（`pg_catalog`、`information_schema`、`pg_toast`）。是否纳入 `public`（thirdnet 框架系统表所在）由用户定——通常业务库文档聚焦业务 schema，框架系统表按需。
- **表范围**：默认全部用户表（`relkind='r'`）；用户可指定子集（如仅某些模块的表、排除已废弃表）。把候选表清单先呈现给用户勾选更稳。
- **是否含视图**：默认只导出**表**；用户要视图则追加 `relkind='v'`，并在文档里与表区分。

> 这一步是质量阀门，避免把框架系统表 / 废弃表写进交付文档。用户确认后的 schema + 表清单是后续 SQL 的 `WHERE` 依据。

## 提取（核心）

两个 dbhub 工具配合：`search_objects` 负责高效枚举与概览，`execute_sql` 负责精确取注释与结构元数据。**先 `search_objects` 摸清全貌，再 `execute_sql` 取齐明细**。

### ① search_objects：枚举 schema / 表 / 列 / 索引

用 `search_objects`（progressive disclosure，token 友好）从库根逐层展开：schema → 表 → 每表的列与索引。目的：拿到完整的表清单与字段名，避免后续 SQL 漏表。记录每个 schema 下的表名，作为范围基线。

### ② execute_sql：取注释 + 结构元数据（即用 SQL）

对**用户确认范围**内的表，依次跑下列 SQL（按 schema/表 过滤；`execute_sql` 每次一条，结果按 `table_schema / table_name / ordinal` 在内存里合并）。所有查询都已排除系统 schema 与系统列（`attnum > 0`）。

**查询 A —— 表用途 + 字段注释 + 类型（主查询）**

表注释用 `obj_description(oid, 'pg_class')`（第二个参数是 catalog 名，文本），列注释必须用 `col_description(table_oid, column_number)`——`obj_description` 取不到列注释。

```sql
SELECT
    n.nspname  AS table_schema,
    c.relname  AS table_name,
    obj_description(c.oid, 'pg_class')          AS table_comment,   -- 表用途（COMMENT ON TABLE，即后端 .HasComment 写入）
    a.attnum   AS ordinal,
    a.attname  AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,   -- 完整类型，如 timestamp with time zone / character varying(64)
    col_description(c.oid, a.attnum)            AS column_comment   -- 字段注释（COMMENT ON COLUMN，即 .HasComment）
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attribute a
       ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY n.nspname, c.relname, a.attnum;
```

**查询 B —— 可空 + 默认值**

```sql
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    a.attname AS column_name,
    a.attnotnull                              AS not_null,         -- true=非空
    pg_get_expr(d.adbin, d.adrelid)           AS column_default    -- 默认值表达式
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n   ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a   ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relkind = 'r'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY n.nspname, c.relname, a.attnum;
```

**查询 C —— 主键 + 唯一约束**

```sql
SELECT
    n.nspname AS table_schema,
    c.relname AS table_name,
    con.contype,                                                 -- 'p'=主键, 'u'=唯一
    con.conname AS constraint_name,
    string_agg(a.attname, ', ' ORDER BY u.ord) AS columns
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class c       ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace n   ON n.oid = c.relnamespace
JOIN unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
JOIN pg_catalog.pg_attribute a   ON a.attrelid = c.oid AND a.attnum = u.attnum
WHERE con.contype IN ('p','u')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
GROUP BY n.nspname, c.relname, con.contype, con.conname
ORDER BY n.nspname, c.relname, con.contype;
```

**查询 D —— 枚举字典表发现（thirdnet `[SystemDict]` 通常落库为字典表）**

```sql
-- 先找候选字典表（表名含 dict），再据其列结构取 type→标签/值
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
  AND table_name ILIKE '%dict%';
```

命中字典表后，用 `search_objects` 看其列（通常是 `type/code` + `label/value` + 排序字段），再 `SELECT` 出每个 dict-type 的取值清单。thirdnet 各项目字典表名/列名不完全一致，**按实际结构适配，不硬编码**。

### ③ 拼装「备注」列（结构 + 语义标注）

「备注」由上述结果**合并派生**（Claude 在内存里拼，无需再查库）：

- **结构元数据**：
  - 查询 C 命中主键（`contype='p'`）→ `主键`
  - 查询 B `not_null = false` → `可空`（`true` 通常省略；若需强调可写 `非空`）
  - 查询 B 有 `column_default` → `默认 {值}`
  - 查询 C 命中唯一（`contype='u'`）→ `唯一`
- **语义标注**：
  - **审计字段**：列名 ∈ {`created_by`, `created_time`, `updated_by`, `updated_time`, `remark`}（thirdnet `IAuditableEntity` 约定）→ 追加 `审计字段`
  - **枚举字典**：查询 D 命中字典表且能按命名对应（如列 `user_status` ↔ dict-type `user_status`）→ 追加 `枚举字典：{type}`；命名对应仅靠启发式 → 标 `枚举字典：{type}（推断）`；该列是枚举但库内无字典表（值只在代码 `[SystemDict]`）→ 标 `枚举（值见代码）`
- 多个标记用 `；` 连接，如 `主键；审计字段` 或 `可空；默认 0；枚举字典：order_status（推断）`。

> **乐观锁 xmin 说明**：thirdnet `AdminDbContext` 默认给每个实体注册 `xmin` 乐观并发列。`xmin` 是 PostgreSQL **系统列**（`attnum < 0`，已被上述 SQL 的 `attnum > 0` 排除），每表皆有、非业务字段，**不进字段表**——在文档「文档说明」里用一句话统一说明「所有表默认启用乐观锁（xmin）」即可，不要逐表逐列重复。

## 缺失项处理（不臆造）

- **表无 COMMENT**（`table_comment` 为空）：表用途填 `[未设置注释]`；可由表名**推断**中文用途（如 `t_sys_user` → 「系统用户」）并标 `（推断）`，但必须标注。
- **列无 COMMENT**：注释列留空或填 `[未设置注释]`；可由列名推断并标 `（推断）`。
- **字典推断失败**：按上节规则标 `枚举（值见代码）`，不编取值。
- 所有「推断」项在文末「备注」汇总一个清单，提示用户核对。

## 表结构清单（返回给主上下文）

提取完成后，产出结构化清单供 Step 4 填 `database-schema-template.md`：

```markdown
## 表结构清单（来源：dbhub MCP 实时导出 / 库：{DSN 摘要或库名} / 导出时间：{YYYY-MM-DD HH:mm}）

**Schema 清单**：{schema1}、{schema2}……
**乐观锁**：所有表默认启用 xmin（系统列，不在字段表展开）。

### {schema}.{table_name}　用途：{table_comment 或 [未设置注释]（推断：…）}

| 列名 | 类型 | 注释 | 备注 |
|------|------|------|------|
| id | bigint | 主键ID | 主键 |
| user_name | character varying(64) | 用户名 | 非空 |
| status | integer | 状态 | 默认 0；枚举字典：user_status（推断） |
| created_time | timestamp with time zone | 创建时间 | 审计字段 |
| ... | ... | ... | ... |

（每表一块，按 schema 分组）

### 枚举字典（命中时）
- user_status：0=禁用 / 1=启用（关联列：{schema}.{table}.status，推断）
- ...
```

## 收尾

- 把「表结构清单」（或前置检查未过时的中止说明 / 缺失项说明）交回主上下文，进入 Step 4 填充模板。
- 全程只读，未对库做任何写操作。
