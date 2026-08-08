---
name: thirdnet-mcp-setup
description: >
  为 thirdnet 工程装配 Postgres 的 MCP 服务（让 Claude Code 在会话内直查项目的 PostgreSQL 数据库）。
  在工程根写项目级 .mcp.json，默认从后端 appsettings*.json 读取连接串、由用户确认暴露哪个库
  （Admin 双库：框架库 ThirdNetDbContext / 业务库 AdminDbContext），挂载 @bytebase/dbhub（npx 运行）。
  当用户提到「postgres mcp」「安装 mcp」「配置 .mcp.json」「让 Claude 直查数据库」「给工程接上数据库 mcp」
  「server-postgres」「dbhub」「数据库 MCP」时，必须使用本技能。Admin 项目创建时由 backend-workflow
  默认调用；用户后续也可单独调用安装，或改用无密 ${ENV} 占位版。
license: MIT
metadata:
  version: "0.1.0"
  author: thirdnet
---

# ThirdNet Postgres MCP 装配

本技能给 thirdnet 工程挂上 **Postgres 的 MCP 服务**——让 Claude Code 在该工程会话里直接查询项目的 PostgreSQL 数据库（列表、表结构、抽样数据、排查数据问题），而不必让你手敲 SQL 或来回贴查询结果。

它只做一件事：在工程根写一份**项目级 `.mcp.json`**，并确保后续的批准、连接、撤销都顺畅。

> **范围**：本技能面向 **Admin 工程**（`dotnet new thirdnet-admin` 产物）。Service 微服务工程暂不在默认流程内（见「范围与边界」）。本技能**不在插件仓自身挂 MCP**——它产出的是「下游 thirdnet 工程开箱即带 Postgres MCP 配置」的能力。

## 什么时候用

- 创建 Admin 项目时（由 `backend-workflow` 脚手架步骤 8 默认调用）。
- 用户事后说「帮我把这个工程接上 postgres 的 mcp」「让 claude 能直查我的数据库」「装一下数据库 mcp」等。
- 已装过但想换库（框架库 ↔ 业务库）、换连接串、或换成无密占位版。

## 前置依赖：Node.js / npx

Postgres MCP（`@bytebase/dbhub`）通过 `npx` 运行，**要求本机已装 Node.js**（带 `npx`）。

- 验证：`npx -v`。能打印版本号即可。
- 后端同学机器上未必有 Node——这是最常见的「装了但连不上」原因。若无，先装 Node LTS（`winget install OpenJS.NodeJS.LTS` 或官网下载），再继续。

## 工作流（默认：读后端配置 → 用户确认 → 写 .mcp.json）

按下列顺序执行。核心思路是 **DSN 单一数据源在后端 `appsettings*.json`**——`.mcp.json` 只是它的派生产物，避免在两处维护连接串。

### 第 1 步：定位并读取后端连接串

Admin 的 API 宿主配置在：

```
backend/{ProjectName}.Admin/Admin/{ProjectName}.Admin.APIService/appsettings.json            # 模板/占位值（提交）
backend/{ProjectName}.Admin/Admin/{ProjectName}.Admin.APIService/appsettings.Development.json # 开发真实值（gitignored，优先）
```

读取顺序：**先 `appsettings.Development.json`（真实值优先），回退 `appsettings.json`**。抽出所有看起来是 PostgreSQL 连接串的顶层键——Admin 双库模型下通常是这两个：

| 键 | 指向 | 库内容 |
|----|------|--------|
| `DefaultConnectionString` | 框架库 `ThirdNetDbContext`（public schema） | 用户/角色/菜单/部门/字典/配置/操作日志/访问日志/IP 黑白名单等系统表 |
| `ConnectionString` | 业务库 `AdminDbContext`（admin schema） | 你自己的业务实体表 |

> 识别规则：键名以 `ConnectionString` 或 `Connection` 结尾、且值含 `Host=`/`host=`/`postgresql://` 视为候选。只命中一个就只列一个。

**占位值识别**：模板生成的 `appsettings.json` 里这两个键常是中文说明串（如 `"框架配置库连接字符串（Host=localhost;...）"`）。若读到的是说明性文字而非可用连接串，**提示用户**：「这看起来是模板占位值，建议先在 `appsettings.Development.json` 填真实连接串再装 MCP」——并可让用户选择照样写入待后改，或中止先去填配置。

### 第 2 步：用户确认暴露哪个库（AskUserQuestion）

用 `AskUserQuestion` 让用户选要暴露给 Claude 的那个连接（这是关键——Admin 有两个库，用途不同，不能替用户决定）：

- 选项含：**框架库**（`DefaultConnectionString`，排查权限/配置/日志时用）、**业务库**（`ConnectionString`，看业务数据时用，通常最常用）、**无密占位版**（见下降级路径，不想此刻暴露真实串时选）、**手动填一个**（读不到可用值时）。
- 每个选项的 description 注明它指向哪个库 / 是否含真实账密。

### 第 3 步：写 `.mcp.json` + 加 `.gitignore`

在**解决方案根**（与 `.slnx` 同级 = `backend/{ProjectName}.Admin/.mcp.json`，也就是用户用 Claude Code 打开的那一层）写入。范式见 [assets/mcp.json.template](assets/mcp.json.template)，把 `--dsn` 后的占位替换成第 2 步选中的真实连接串。

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "<第2步选中的连接串>"],
      "env": {}
    }
  }
}
```

**连接串格式**：`appsettings` 里是 libpq 关键字形式（`Host=h;Port=5432;Username=u;Password=pw;Database=d`）。dbhub 的 `--dsn` 接受这种关键字串，也接受 URL 形式。**优先原样透传**；若 dbhub 报解析失败，按下式转成 URL 再传：`postgresql://u:pw@h:5432/d`。

**务必 gitignore**：默认写入的 `.mcp.json` 含真实账密，与 `appsettings.Development.json` 同属敏感文件。在工程 `.gitignore` 追加：

```gitignore
# Claude Code MCP 配置（默认含真实数据库账密，不提交）
.mcp.json
```

> 为什么这样：thirdnet 既有约定就是「真实账密只放 gitignored 的 `appsettings.Development.json`、`appsettings.json` 只放说明性占位」。把 `.mcp.json` 纳入同一约定，避免把数据库密码提交进仓库。

### 第 4 步：提示首次批准（关键的「为什么不会自动生效」）

写完 `.mcp.json` 后告诉用户：

> 现在在该工程目录启动 `claude`，**首次会弹「是否批准此项目的 MCP 服务器」**——批准后 `/mcp` 面板里 `postgres` 才会变成 `✔ Connected`。在批准之前它是 `⏸ Pending approval`，不会静默启用。

这个批准门是 Claude Code 的安全设计：项目级 `.mcp.json` 即使提交到仓库，每个克隆者首次交互式会话都要自行批准，且受 workspace trust 约束（全新克隆需先信任文件夹）。所以「自动安装」=「自动写好配置文件」，**批准权始终在用户手里**——正好满足「默认自动装、用户后续可装/可拒」。

## 降级路径：无密 `${ENV}` 占位版

当用户不想此刻暴露真实连接串、或读不到可用值时，改写无密占位版（范式见 [assets/mcp.env-placeholder.template](assets/mcp.env-placeholder.template)）：

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${THIRDNET_PG_DSN}"]
    }
  }
}
```

Claude Code 支持 `${VAR}` / `${VAR:-默认值}` 展开（作用于 `command`/`args`/`env`/`url`/`headers`）。此版本**不含密钥、可安全提交**；用户自行设环境变量后生效：

- Windows（持久）：`setx THIRDNET_PG_DSN "postgresql://devuser:devpass@localhost:5432/myapp_dev"`（设完**重开终端**）。
- 或放一个 gitignored 的 `.env`，启动 Claude Code 前加载。

未设变量时，dbhub 拿到空 DSN 会连接失败——这是预期的「用户后填」状态，不是 bug。

> 选哪种？默认走「读配置 + 真实串 + gitignore」（开箱即用、与 appsettings 单一数据源）；想要**团队共享同一份可提交配置**时才用无密占位版（每个开发者各自设环境变量）。

## CLI 等价命令（不写文件也能管）

```bash
# 直接加（与写 .mcp.json 等价，--scope project 写入工程根 .mcp.json）
claude mcp add postgres --scope project -- npx -y @bytebase/dbhub --dsn "<连接串>"

# 用 JSON 串加（连接串含特殊字符时更稳）
claude mcp add-json postgres '{"command":"npx","args":["-y","@bytebase/dbhub","--dsn","<连接串>"]}' --scope project

claude mcp list                       # 查所有 server + 健康状态（✔/!/✘/⏸）
claude mcp get postgres               # 查单个详情
claude mcp remove postgres            # 移除
claude mcp reset-project-choices      # 清空本工程的批准/拒绝记录，重新弹批准
```

会话内也可用 `/mcp` 面板交互式开关/重认证。

## 包选择：dbhub（默认）vs server-postgres（已废弃）

- **默认用 `@bytebase/dbhub`**：Claude Code 文档当前推荐的 Postgres MCP，活跃维护，`--dsn` 取连接串，支持只读模式。
- `@modelcontextprotocol/server-postgres`（用户偶尔点名的「server-postgres」）**已被 npm 标记废弃**（末版 0.6.2 / 2024-12）。仅作兼容提及——若用户明确坚持要用，把 args 换成 `["-y","@modelcontextprotocol/server-postgres","<URL 形式连接串>"]`（注意：该包只接受 `postgresql://` URL，且默认把每条查询包在只读事务里）。

> 安全建议：无论哪个包，给 MCP 用的数据库账号最好是**只读角色**（`GRANT SELECT`），避免 Claude 误写。

## 失败排查

| 现象 | 多半原因 | 处理 |
|------|---------|------|
| `⏸ Pending approval` | 首次未批准 | 在工程目录起交互式 `claude`，批准提示；或 `claude mcp reset-project-choices` 重弹 |
| `✘ Failed to connect` | DSN 错/未填 | 核对 `appsettings.Development.json` 值；无密版检查 `THIRDNET_PG_DSN` 是否已设并重开终端 |
| `✘ Failed to connect` | 本机无 Node/npx | `npx -v` 验证；装 Node LTS |
| 首次很慢 | dbhub 首次下载 | 正常，等一会儿；后续走 npx 缓存 |
| DSN 解析失败 | 关键字串不被接受 | 转成 `postgresql://u:pw@host:port/db` URL 形式再传 |
| 克隆后服务器不启用 | workspace 未信任 | 先在 Claude Code 里信任该文件夹，再批准 |

## 范围与边界

- **只管 Admin 工程**。Service 微服务工程（`dotnet new thirdnet-service`）如需装配，读 `ServiceDbContext` 对应连接串即可，但当前不在默认脚手架流程内——用户显式要求时再按本流程手动跑。
- **不在插件仓自身挂 MCP**。本技能产出的是「让下游 thirdnet 工程开箱即带 Postgres MCP 配置」的能力，不修改 thirdnet-dev 插件仓的 MCP。
- 不替代 `fullstack-review`——挂 MCP 是工具装配，不是功能性代码变更，不触发 Stop 收尾审查门。

## 深入参考

三种 scope 对照、信任/批准门与 workspace trust 细则、`claude mcp` 全量命令、dbhub vs 废弃 server-postgres 详细对照、Windows 环境变量设置、只读角色建议、双库抉择与占位值识别、`claude -p`/Agent SDK 无提示加载与 `disabledMcpjsonServers` 排除法——见 [mcp-deep-dive](references/mcp-deep-dive.md)。
