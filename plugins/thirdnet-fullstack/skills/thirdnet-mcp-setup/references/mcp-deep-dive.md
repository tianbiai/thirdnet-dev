# Postgres MCP 深入参考

本文件是 `thirdnet-mcp-setup` 技能的深度参考，覆盖 Claude Code MCP 配置的全部细节。SKILL.md 只讲「怎么做」，这里讲「为什么、边界在哪、出问题怎么排」。

> 事实来源：Claude Code 官方文档 https://code.claude.com/docs/en/mcp 与 npm 包元信息。

## 目录

1. [三种 scope 对照](#1-三种-scope-对照)
2. [信任 / 批准门与 workspace trust](#2-信任--批准门与-workspace-trust)
3. [`claude mcp` 命令全量](#3-claude-mcp-命令全量)
4. [dbhub vs 废弃 server-postgres 详细对照](#4-dbhub-vs-废弃-server-postgres-详细对照)
5. [连接串格式：关键字 vs URL 与转换](#5-连接串格式关键字-vs-url-与转换)
6. [双库抉择与占位值识别](#6-双库抉择与占位值识别)
7. [`${ENV}` 无密占位 vs gitignore 真实串 的取舍](#7-env-无密占位-vs-gitignore-真实串-的取舍)
8. [Windows 环境变量设置](#8-windows-环境变量设置)
9. [只读数据库角色建议](#9-只读数据库角色建议)
10. [`claude -p` / Agent SDK 无提示加载与排除法](#10-claude--p--agent-sdk-无提示加载与排除法)
11. [.mcp.json schema 速查](#11-mcpjson-schema-速查)

---

## 1. 三种 scope 对照

Claude Code 的 MCP 配置有三个作用域，决定「存哪、谁能看见」：

| scope | 存储位置 | 可见性 | 适合场景 |
|-------|---------|--------|---------|
| **local**（默认） | `~/.claude.json` 中该工程路径条目下 | 仅当前工程、仅你自己；不共享 | 个人临时试验 |
| **project** | 工程根 `.mcp.json`（可提交） | 跨克隆者共享；但**每个克隆者仍需自行批准** | 团队共享 —— 本技能用这个 |
| **user** | `~/.claude.json` 顶层 | 你在这台机器上的所有工程 | 你个人到处都想用的 server |

**优先级**（同名 server 谁赢，第 1 条优先）：`local > project > user > plugin-provided > claude.ai connectors`。Claude Code 取**最高优先级来源的整条 server 条目**，不会把不同 scope 的字段合并——所以你在 local 覆盖一条，project 的那条整条作废，不是字段级合并。

> 本技能默认写 **project scope**（`.mcp.json`）：团队共享一份配置，又因为含真实账密而 gitignore——每个开发者本地各自生成、各自批准。

## 2. 信任 / 批准门与 workspace trust

这是理解「为什么 `.mcp.json` 不会自动生效」的关键，分两层。

**第 1 层——交互式会话会弹批准。** 出于安全，Claude Code 在交互式会话中使用 `.mcp.json` 里的项目级 server 前，**会提示用户批准**。每个未批准的 server 显示为 `⏸ Pending approval`（`claude mcp list` / `claude mcp get <name>` 可见）。要批准，在工程里交互式跑 `claude` 并接受提示。

**第 2 层——workspace trust 门槛。** 较新版本引入：一个全新克隆**无法自行批准** server——即便 `.claude/settings.json` 里提交了 `enableAllProjectMcpServers` / `enabledMcpjsonServers`，在用户通过「信任此文件夹」对话框信任该文件夹**之前都会被忽略**。未信任时 server 一直 `⏸ Pending approval`。

**用户拒绝时**：该 server 被记入该工程的 `~/.claude.json`（`disabledMcpjsonServers` 下），显示 `✘ Rejected`；该条目在**所有**设置来源里都会被拒。

**重置已做的选择**：`claude mcp reset-project-choices` 清空批准/拒绝记录，下次重新弹提示。

> 对本技能的意义：「自动安装」只到「写好 `.mcp.json`」为止；**批准权始终在用户手里**。这天然满足「默认自动装、用户后续可装/可拒」——首次 `claude` 启动批准即用，拒绝则不启用，毫无副作用。

## 3. `claude mcp` 命令全量

```bash
# 加 server（--scope project 写入工程根 .mcp.json；-- 把后面当 server 命令/参数）
claude mcp add postgres --scope project -- npx -y @bytebase/dbhub --dsn "<连接串>"

# 用 JSON 串加（连接串含特殊字符时更稳）
claude mcp add-json postgres '{"command":"npx","args":["-y","@bytebase/dbhub","--dsn","<连接串>"]}' --scope project

claude mcp list                       # 所有 server + 健康状态：✔/!/✘/⏸
claude mcp get postgres               # 单个详情（含问题/状态）
claude mcp remove postgres            # 从配置 scope 移除
claude mcp reset-project-choices      # 清空本工程的 .mcp.json 批准/拒绝记录
```

状态含义：`✔ Connected` / `! Needs authentication` / `✘ Failed to connect` / `⏸ Pending approval (run claude to approve)` / `✘ Rejected (see disabledMcpjsonServers in settings)`。

会话内还有 `/mcp` 交互面板（开关、重认证、看工具数）。

> 直接写 `.mcp.json` 与 `claude mcp add --scope project` 等价——本技能选前者（便于从 appsettings 派生 + 模板化）。

## 4. dbhub vs 废弃 server-postgres 详细对照

| 维度 | `@bytebase/dbhub`（默认） | `@modelcontextprotocol/server-postgres`（废弃） |
|------|---------------------------|------------------------------------------------|
| 状态 | 活跃维护 | **npm 已标记废弃**；末版 0.6.2 / 2024-12 |
| 文档地位 | Claude Code 当前默认推荐的 Postgres MCP | 历史 |
| 连接串参数 | `--dsn "<连接串>"` | 位置参数 `<URL 形式连接串>` |
| 连接串格式 | 关键字串或 URL 均可 | **仅 `postgresql://` URL** |
| 只读 | 支持只读模式 | 默认把每条查询包在 `READ ONLY` 事务里 + `query` 工具 |
| args 写法 | `["-y","@bytebase/dbhub","--dsn","..."]` | `["-y","@modelcontextprotocol/server-postgres","postgresql://..."]` |

用户若明确坚持用废弃的 server-postgres，把 args 换成上表最后一行即可，其余流程不变。

## 5. 连接串格式：关键字 vs URL 与转换

thirdnet 的 `appsettings` 用 **libpq 关键字形式**：

```
Host=localhost;Port=5432;Username=devuser;Password=devpass;Database=myapp_dev
```

dbhub 的 `--dsn` 接受关键字串，也接受 URL。**优先原样透传**关键字串；若 dbhub 报解析失败，转成 URL：

```
postgresql://<Username>:<Password>@<Host>:<Port>/<Database>
# 例 → postgresql://devuser:devpass@localhost:5432/myapp_dev
```

转换规则：把关键字串里的 `Host/Port/Username/Password/Database`（注意大小写，appsettings 是首字母大写）分别填入 URL 的 `host:port`、`user:pass`、`db`。带特殊字符的密码需 URL 编码。

> 废弃的 server-postgres **只认 URL**，必须转换。

## 6. 双库抉择与占位值识别

**Admin 双库模型**（见 `backend-workflow`「双数据库架构」）：

| appsettings 键 | DbContext | schema | 典型内容 | 何时暴露给 Claude |
|----------------|-----------|--------|---------|------------------|
| `DefaultConnectionString` | `ThirdNetDbContext` | public | 用户/角色/菜单/部门/字典/配置/操作日志/访问日志/IP 黑白名单 | 排查权限、配置、登录、日志问题时 |
| `ConnectionString` | `AdminDbContext` | admin | 你的业务实体表 | 看业务数据时（**通常最常用**） |

技能用 `AskUserQuestion` 让用户选——**不要替用户决定**，两个库用途不同。

**占位值识别**：模板生成的 `appsettings.json` 里这两个键常是中文说明串，如 `"框架配置库连接字符串（Host=localhost;Port=5432;Username=xxx;Password=xxx;Database=xxx）"`。识别信号：值含中文、或含 `xxx`、或以「…连接字符串」结尾。读到占位值时：

1. 优先提示用户「先在 `appsettings.Development.json` 填真实值再装」；
2. 用户可选择照样写入（待后改）、走无密占位版、或手动填一个可用串。

## 7. `${ENV}` 无密占位 vs gitignore 真实串 的取舍

| 方案 | `.mcp.json` 内容 | 是否提交 | 团队共享 | 开箱即用 | 适合 |
|------|-----------------|---------|---------|---------|------|
| **读配置 + 真实串**（默认） | 真实 DSN | ❌ gitignore | 否（各自生成） | ✅ | 单人/小团队，与 appsettings 单一数据源 |
| **无密 `${ENV}` 占位** | `${THIRDNET_PG_DSN}` | ✅ 可提交 | ✅ | 需先设环境变量 | 想共享同一份可提交配置的团队 |

两者都安全（都不把明文密码提交进仓库）。默认走前者，因为 thirdnet 既有约定就是「真实账密只放 gitignored 的 `appsettings.Development.json`」——`.mcp.json` 跟它同一约定、同源派生，最少认知负担。

## 8. Windows 环境变量设置

用无密占位版（`${THIRDNET_PG_DSN}`）时，需让启动 Claude Code 的那个 shell 能读到变量：

```powershell
# 当前会话临时设（关终端失效）
$env:THIRDNET_PG_DSN = "postgresql://devuser:devpass@localhost:5432/myapp_dev"
claude

# 持久化（写进用户环境变量，需重开终端生效）
setx THIRDNET_PG_DSN "postgresql://devuser:devpass@localhost:5432/myapp_dev"
```

Git Bash 等效：`export THIRDNET_PG_DSN="..."`。

或放一个 gitignored 的 `.env`，启动前 `source` / 加载。注意：Claude Code 的 `${VAR}` 展开读的是**进程环境变量**——必须在**启动 `claude` 之前**就设好，会话中途改无效。

## 9. 只读数据库角色建议

MCP 让 Claude 直接查库，最稳的是配一个**只读账号**，避免误写：

```sql
CREATE ROLE mcp_reader LOGIN PASSWORD 'xxxx';
GRANT CONNECT ON DATABASE myapp_dev TO mcp_reader;
GRANT USAGE ON SCHEMA public TO mcp_reader;       -- 或 admin schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT TO mcp_reader;  -- 未来表也授
```

把 `.mcp.json` 的 DSN 指向这个只读账号即可。生产库尤其建议这样做。

## 10. `claude -p` / Agent SDK 无提示加载与排除法

一个重要差异：**非交互模式不弹批准**。

> `claude -p` 运行、Agent SDK 会话、云会话无法显示批准提示——Claude Code **不加询问地加载**项目级 `.mcp.json` server。

含义：如果你的工程会在 CI / `claude -p` / Agent SDK 里跑，那些路径会**直接启用** `.mcp.json` 的 server，绕过批准门。要排除某个 server，加 `disabledMcpjsonServers`（**所有模式都拦截**），或用 `--setting-sources` / SDK 的 `settingSources` 完全排除项目设置。

```jsonc
// 例：在 .claude/settings.json 里禁用 postgres server（所有模式生效）
{
  "disabledMcpjsonServers": ["postgres"]
}
```

## 11. `.mcp.json` schema 速查

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "npx",
      "args": ["-y", "<package>", "<args...>"],
      "env": { "KEY": "value" }
    }
  }
}
```

- 顶层键固定 `mcpServers`；每个条目名即 server 名（`claude mcp get/remove` 用它）。
- stdio server 用 `command` + `args` + `env`；远程 server 改用 `url` + `type: "http"|"sse"|"ws"`（仅 `url` 无 `type` 是配置错误，会被跳过并告警）。
- 其它可选字段：`headers` / `headersHelper` / `timeout` / `alwaysLoad` / `oauth`。
- `${VAR}` / `${VAR:-默认值}` 环境变量展开作用于 `command` / `args` / `env` / `url` / `headers`。
