# 命令参考（`commands.md`）

`thirdnet-template-upgrade` 技能的完整命令与 flag 参考。

所有命令默认用**内网** registry；内网不通换**外网**（NuGet `http://61.164.57.61:8088/nuget`、npm `http://61.164.57.61:14873/`，npm 外网端口 **14873**）。

> **v0.8.0 责任模型**：AI 主导模式下，工具**只用 `check` / `diff` / `export-merge` / `init-manifest`**（出对比素材与清单）；**`apply` / `import-merge` / `merge-workdir` 不用**——AI 自己用 Edit/Write 改项目文件。下表对这些命令标注了「主用 / 不用」。仅当你明确走旧的"工具落盘"路径时才用 apply/import-merge（与 AI 主导模式互斥）。

---

## 后端 `thirdnet-migrate`（dotnet 全局工具）

安装：`dotnet tool install -g ThirdNet.Migrate --add-source <源>`。命令在**要升级的项目根目录**（`.slnx` 所在处）运行。

### 命令

| 命令 | 作用 | AI 主导模式 |
|---|---|---|
| `check` | 查询模板是否有更新版本，报告当前清单状态 | ✅ 主用 |
| `diff` | 预览用户项目与最新模板的差异（按 6 态分组 + 每文件建议），不改动文件 | ✅ 主用（AI 判定主输入） |
| `export-merge` | 把 Conflict 文件导出为对比素材（3-way：base/mine/theirs + meta），供 AI 读 | ✅ 主用（取 3-way 素材） |
| `init-manifest` | 为项目生成/重建 `.template-manifest.json`（不动业务文件） | ✅ 主用（升级后重算清单） |
| `apply` | 把模板更新应用到项目；冲突文件逐个给建议 | ⛔ 不用（AI 直接改文件） |
| `import-merge` | 把 workdir 合并产物安全落回项目（备份+陈旧检查+推进版本+重算清单） | ⛔ 不用（AI 直接改文件 + 手动备份） |

> 提示：`diff` 的输出是 Phase 4 **AI 影响分析的主要输入之一**（覆盖 take-template 的 `UpstreamOnly`/`Added`）。建议保留 Phase 1 的 diff 文本供分析复用——AI 改完文件后再跑 `diff` 会把这些显示成已解决，丢失"模板改了什么"的信息。

### 通用选项

| 选项 | 默认 | 作用 |
|---|---|---|
| `-p, --project <path>` | 当前目录 | 用户项目路径 |
| `-s, --source <url>` | `http://192.168.1.156:8088/nuget` | NuGet 源（外网换 `http://61.164.57.61:8088/nuget`） |
| `-v, --version <ver>` | 查询最新 | 目标模板版本号 |
| `--nupkg <path>` | — | 用本地模板 nupkg（离线模式，跳过查询/下载） |
| `--base-nupkg <path>` | — | 用本地旧模板基线 nupkg（离线 3-way 基线；缺则降级 2-way） |
| `-o, --output <dir>` | `./.thirdnet-merge-work` | export-merge 工作目录 |
| `-i, --input <dir>` | `./.thirdnet-merge-work` | import-merge 工作目录 |
| `--dry-run` | — | 仅预览不改文件（仅 `apply`） |
| `--force` | — | 强制套用模板版、覆盖你的改动（仅 `apply`，会先备份） |
| `--non-interactive` | — | 非交互：UpstreamOnly 套用、UserOnly 保留、Conflict 保留并报告（退出码 2）（仅 `apply`） |
| `--purge` | — | import-merge 全部已决且无陈旧/放弃时清理工作目录（默认保留作审计） |

---

## 前端 `create-thirdnet-admin`（npx）

前端无持久安装：`npx create-thirdnet-admin@latest <cmd>` 每次拉最新。升级子命令**必须在前端项目根目录**运行（`.npmrc` 指向私有 registry）。

### 升级子命令

| 子命令 | 作用 | AI 主导模式 |
|---|---|---|
| `check` | 检查是否有模板更新 | ✅ 主用 |
| `diff` | 预览模板变更（不改文件） | ✅ 主用 |
| `export-merge` | 导出冲突文件为对比素材（3-way），供 AI 读 | ✅ 主用 |
| `apply` | 交互式应用模板更新 | ⛔ 不用 |
| `import-merge` | 把 workdir 合并产物安全落回项目（备份+陈旧检查+推进版本） | ⛔ 不用 |
| `merge-workdir` | 用 Claude API 对工作目录做批量语义合并（headless） | ⛔ 不用（AI 在对话里直接合并） |

### 选项

| 选项 | 默认 | 作用 |
|---|---|---|
| `--registry <url>` | `http://192.168.1.207:4873` | npm registry（外网换 `http://61.164.57.61:14873/`） |
| `--version <ver>` | 最新 | 指定目标版本 |
| `-o, --output <dir>` | `./.thirdnet-merge-work` | export-merge 工作目录 |
| `-i, --input <dir>` | `./.thirdnet-merge-work` | import-merge 工作目录 |
| `--include-override` | — | export-merge 纳入品牌 override 文件（如 package.json 依赖升级）；默认跳过。**推荐默认带上**——配合 brand-merge 规则，brand 文件由 AI 合并而非交人工 |
| `--dry-run` | — | 仅预览（仅 `apply`） |
| `--force` | — | 强制应用所有变更（仅 `apply`） |
| `--purge` | — | import-merge 全部已决且无陈旧/放弃时清理工作目录 |
| `-h, --help` | — | 显示帮助 |

`merge-workdir` 专有选项：`--model <id>`（默认 `claude-sonnet-4-6`）、`--max-tokens <n>`（默认 8192）、`--dry-run`、`-h`。需要环境变量 `ANTHROPIC_API_KEY`。

---

## 6 态分类详解

每个被对比的文件归为下列之一——**6 态是 AI 全量判定的输入，AI 可覆盖其默认动作**（见 SKILL.md Phase 2）：

| 态 | 含义 | 工具默认动作（AI 可覆盖） | 进 export-merge？ |
|---|---|---|---|
| `Unchanged` | 用户文件 == 新模板（无变化） | — | 否 |
| `Added` | 模板新增（用户项目无此文件） | 新增进来 | 否（AI 据 diff 处理） |
| `Deleted` | 旧基线/清单有、新模板已删、用户仍保留 | **永不删除**，仅提示 | 否（AI flag-human，不删） |
| `UpstreamOnly` 🔄 | 用户未改 + 模板改了 | 自动套用模板版（AI 可改判 take-template / merge / flag-human） | 否 |
| `UserOnly` 🔒 | 用户改了 + 模板未改 | 保留用户版 | 否（业务代码安全） |
| `Conflict` ⚠️ | 用户改了 + 模板也改了 | 保留（AI 合并） | **是** —— 只有这类进 workdir |

> 关键：`export-merge` 只导出 `Conflict` 态（+ brand 需 `--include-override`）。非冲突的 `UpstreamOnly`/`Added` 不进 workdir，AI 据 `diff` 输出判定与处理。6 态是 AI 判定的**起点**，不是终判——AI 发现有破坏性可把 `UpstreamOnly` 改判为 `flag-human` 或 `merge`。

前端命名略有不同：冲突条件为"文件已修改 **且** 用户也改过"，语义同 `Conflict`。

## 离线模式

无内/外网访问时，用本地 nupkg 跳过查询与下载：

```bash
thirdnet-migrate diff   --nupkg ./ThirdNet.Admin.Template.0.0.24.nupkg
thirdnet-migrate diff   --nupkg ./New.nupkg --base-nupkg ./Old.nupkg   # 离线 3-way 基线
thirdnet-migrate apply  --nupkg ./New.nupkg --base-nupkg ./Old.nupkg
thirdnet-migrate export-merge --nupkg ./New.nupkg --base-nupkg ./Old.nupkg -o ./.tw
```

`--base-nupkg` 提供"旧模板基线"以启用 3-way；缺它则相关 unit 降级为 2-way（AI 仍尽力合并，结果在报告里至少标 🟡 提示 review）。前端离线：把旧版 tgz 放在约定位置即可作为基线。
