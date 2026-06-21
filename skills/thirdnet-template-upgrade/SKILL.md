---
name: thirdnet-template-upgrade
version: 0.6.0
description: 把用 ThirdNet 模板生成的旧项目（.NET Admin/Service 后端、Vue 前端）升级到模板最新版本——刷新升级工具、对比变更、自动套用非冲突更新、用 AI 语义 3-way 合并解决真正的冲突文件。凡是用户想把模板/脚手架更新拉进已生成项目、同步新版 ThirdNet 的 bugfix 或结构调整、说"升级/更新/同步模板""模板出新版了""迁移模板项目"、或要调和自己的自定义改动与模板变更时，都要用本技能——即使用户没点名工具也要用；新版 ThirdNet 包发布后用户想让老项目跟着升级时同样适用。覆盖后端 `thirdnet-migrate`（dotnet 工具）与前端 `create-thirdnet-admin`（npx）。尽量通过 AI 合并——brand/override 文件（package.json、brand.ts、index.html）也由 AI 合并，默认不再交人工。每次升级收尾产出一份修改清单，明确区分已更新与未更新的文件，让用户一眼看清改了什么。
---

# ThirdNet 模板升级（前后端统一）

把用 ThirdNet 模板生成的旧项目，升级到模板的最新版本——包括装/升级工具本身、对比变更、套用非冲突更新、用 AI 语义合并真正的冲突文件。

## 何时用

- 用户想把已有 ThirdNet 项目（后端 Admin/Service 或前端）跟进到模板新版
- 新版 ThirdNet 包发布后，用户想让老项目跟着升级
- 用户改动与模板变更出现冲突，需要调和
- 用户说"升级/更新/同步模板""模板出新版了""migrate template"等

## 心智模型（先建立这个，流程才说得通）

- **模板是"活的"，项目是"快照"**：模板持续修 bug / 改结构，但用模板生成的项目是一次性的，不会自动跟进——本技能就是把这个"跟进"做成安全、可回退的流程。
- **文件分 6 态**，工具会自动归类（详见 `references/commands.md`）：
  - `UpstreamOnly` 🔄 —— 你没动过、模板改了 → 工具**自动套用**
  - `UserOnly` 🔒 —— 你改过、模板没动 → **原样保留**（你的业务代码安全）
  - `Conflict` ⚠️ —— 两边都改了 → **需要决策**，交给 AI 合并
  - `Added` / `Deleted` / `Unchanged` —— 模板新增 / 模板已删（永不删你的）/ 无变化
- **确定性边界（关键）**：工具负责找冲突、准备 3-way、备份、哈希校验、落盘、推进版本；**AI 负责"冲突文件 + brand/override 文件这一处该听用户的还是听模板的"语义裁决——尽量合并、少交人工**。不要让 AI 去手动备份、手改项目文件、自己推进版本——工具已经把这些做对、做安全了。

## 私有 registry 地址

下面所有命令默认用**内网**地址；内网不通时换**外网**——同一服务，二选一。

| 仓库 | 内网（优先） | 外网（内网不通时） |
|---|---|---|
| NuGet（后端） | `http://192.168.1.156:8088/nuget` | `http://61.164.57.61:8088/nuget` |
| npm（前端） | `http://192.168.1.207:4873/` | `http://61.164.57.61:14873/`（端口 **14873**，非 4873） |

---

## 完整流程

### Phase 0 — 先升级工具本身

用户点名要"卸载老的装最新"。先确保用的是最新版工具，否则流程里查到的是旧模板。

**后端（dotnet 全局工具）**——在任意目录：

```bash
dotnet tool uninstall -g ThirdNet.Migrate
# 内网源（优先）；内网不通则把 --add-source 换成 http://61.164.57.61:8088/nuget
dotnet tool install -g ThirdNet.Migrate --add-source http://192.168.1.156:8088/nuget
# 验证版本：
dotnet tool list -g | grep -i migrate
```

更轻的等价做法：`dotnet tool update -g ThirdNet.Migrate --add-source <内网或外网源>`（内/外网二选一）。

**前端（npx，无持久安装）**——`npx create-thirdnet-admin@latest <cmd>` 每次从 registry 拉最新。
- registry 默认内网 `http://192.168.1.207:4873/`；外网用 `--registry http://61.164.57.61:14873/`，或改项目 `.npmrc`。
- 若曾 `npm i -g create-thirdnet-admin`，先 `npm uninstall -g create-thirdnet-admin` 清掉全局旧版，避免 npx 命中缓存。
- 前端升级子命令**必须在前端项目目录内**运行（该目录 `.npmrc` 指向私有 registry）。

### Phase 1 — 检测 + 对比（在要升级的项目目录内）

```bash
# 后端（cd 进 .slnx 所在的项目根）
thirdnet-migrate check     # 查最新版 + 当前清单状态
thirdnet-migrate diff      # 预览差异，按 6 态分组 + 每个文件的建议

# 前端（cd 进前端项目根）
npx create-thirdnet-admin@latest check
npx create-thirdnet-admin@latest diff
```

**边缘情况**：后端若报缺 `.template-manifest.json`（项目早于清单机制），先跑一次 `thirdnet-migrate init-manifest` 生成清单（不动业务文件），再继续。

### Phase 2 — 套用非冲突更新

```bash
thirdnet-migrate apply                          # 后端，交互式逐文件确认
thirdnet-migrate apply --non-interactive        # 非交互：UpstreamOnly 套用、UserOnly 保留、Conflict 保留并退出码 2
# 前端同理：npx create-thirdnet-admin@latest apply [--dry-run|--force]
```

`apply` 会自动套用 `UpstreamOnly`、保留 `UserOnly`。**`Conflict` 文件不会被 apply 触碰**——这些就是 Phase 3 要处理的对象。`--dry-run` 先预览，`--force` 强制覆盖你的改动（会先备份，慎用）。

**异常冲突强制门（apply 前必查）**：若 `diff` 报告的 Conflict 文件**数量异常多**，且大多是你没印象改过的框架/配置文件（`Program.cs`、`Startup.cs`、`*DbContext.cs`、`appsettings*`、`_GlobalVibeUsings.cs` 等），**先别 apply**——这通常是占位符/命名空间未正确替换（namespace、`sourceName`、tokens）或基线缺失导致大面积 2-way 降级的信号，会把一堆本不该进冲突集的文件塞进 Phase 3。先排查：

1. `.template-manifest.json`（后端）/ `.template-version.json`（前端）是否存在，`templateIdentity` 是否与目标模板一致（后端缺清单先跑 `thirdnet-migrate init-manifest`）
2. 命名空间/项目名占位符是否在 diff 里大面积未替换
3. 是否因缺 `--base-nupkg` / 旧版 tgz 而整体降级 2-way

排查清楚再 `apply`；否则 Phase 3 会被假冲突淹没。

### Phase 3 — 用 AI 合并冲突（核心）

对真正两边都改过的文件，做语义 3-way 合并：

```bash
# 1) 导出冲突文件的工作目录（base/mine/theirs + meta）
thirdnet-migrate export-merge -o ./.tw          # 后端
npx create-thirdnet-admin@latest export-merge -o ./.tw --include-override   # 前端：默认带 --include-override，把 package.json 等 brand 文件也纳入 AI 合并（见下方 brand-merge 规则）

# 2) Claude 充当合并器：逐个 unit 写 merged（或 declined）—— 见下方协议

# 3) 安全落盘
thirdnet-migrate import-merge -i ./.tw          # 后端：备份→写入→推进版本→重算清单
npx create-thirdnet-admin@latest import-merge -i ./.tw   # 前端
#   全部已决且无陈旧/放弃时，加 --purge 清理工作目录（默认保留作审计）
```

**备选（批量/无人值守）**：用 headless 脚本逐文件调 Claude API（工作目录格式两端一致，后端导出的也能用）：

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # 绝不作 CLI 参数
npx create-thirdnet-admin@latest merge-workdir ./.tw   # 退出码 0=全决 / 2=有放弃 / 1=致命错误
```

---

## Claude 合并协议（Phase 3 你亲自合并时按这个来）

这是本技能的核心。当你（Claude）作为合并器，对 `.tw/units/*/` 里的每个 unit 操作：

1. **读上下文**：先读 `.tw/manifest.json`（tool / mode / templateIdentity / targetTemplateVersion），再列出 `.tw/units/` 下所有 unit 目录。

2. **逐 unit 处理**，每个先读它的 `meta.json`。

3. **跳过规则**（写一个空 `declined` 文件，不自己合并）：
   - `meta.isBinary === true` → 二进制，放弃
   - 该 unit 已有 `merged` 或 `declined` → 跳过（幂等，支持断点续做）
   - `meta.role === "brand"` **不再自动 DECLINED**——brand 文件（package.json / brand.ts / index.html 等）现在按下方 brand-merge 规则尝试合并，尽量少交人工

4. **读三份内容**：`base`（仅 `3-way` 模式有，共同祖先）/ `mine`（用户当前）/ `theirs`（新模板）。按**角色信任矩阵**裁决每一处：

   | role | 信任倾向 | 含义 |
   |---|---|---|
   | `framework` / `config` / `infra` | 信 **THEIRS** | 吸收模板的 bugfix 与结构调整 |
   | `business` | 信 **MINE** | 保留用户的业务逻辑、自定义、注释 |
   | `unknown` | 当 `business`（保守） | 优先保留用户改动 |
   | `brand` | **结构/版本信 THEIRS，品牌字段信 MINE** | 见下方 brand-merge 规则 |

   **brand-merge 规则**（`role === "brand"`，如 package.json / brand.ts / index.html / vite.config.ts）——不要整份 DECLINED，逐项调和：
   - **吸收 THEIRS 的结构性/版本性变更**：依赖版本号升级、新增 scripts、新增配置键、构建配置调整、结构性 meta/脚本引用。
   - **原样保留 MINE 的品牌身份值**：项目名（`name`）、公司名/Logo/品牌色、自定义 `<title>`、用户自加的依赖、用户定制的配置值。
   - 仅当两侧改的是**同一处**且无合理解（如用户手改了模板也在升的同一个键）→ 该 unit 才 DECLINED。

5. **产出 `merged`**——把合并后的**完整文件内容**写入 unit 目录的 `merged` 文件：
   - **只写完整文件内容本身**，不要解释、前言、"以下是合并结果"、代码围栏（```）
   - 保留原文件的缩进、换行风格、编码
   - 只调和真正冲突的区域；不要重排或重格式化无关代码

6. **DECLINED 纪律**——原则是**能产出连贯结果就合并**：只要你能给出一个语法合法、能通过编译/类型检查的合并文件，就写 `merged`（不必 100% 确定）。只有下列情况写空 `declined`、交回人工：
   - `mine` 与 `theirs` 在**同一处**做了真正冲突的编辑，且你给不出一个连贯（可编译/类型自洽）的解 → DECLINED
   - `meta.mode === "2-way"`（无 BASE 共同祖先）→ 仍偏保守，但**非重叠的增量改动**（纯新增块）允许合并；仅同处歧义才 DECLINED
   - 二进制，或 brand 文件里无解的同一处冲突 → DECLINED

7. **收尾**：所有 unit 处理完，运行 `import-merge -i ./.tw`。

完整规范（工作目录格式、`meta.json` 全字段、角色分类规则、与 headless 合并脚本提示词对齐的权威版本）见 `references/merge-protocol.md`。

## 工具的安全保证（知道这些，就不必反复猜疑）

- `import-merge` 覆盖前自动备份到 `.thirdnet-backup/<时间戳>/`，可回退
- **陈旧检查**：导出时记录 `mineHash`，导入时重算磁盘哈希；不一致（导出后文件又被改）→ 该 unit 报 `stale`、**不覆盖、不推进版本**
- 版本标记**仅在 `applied > 0` 时推进**
- `UserOnly` 文件**永不进工作目录**——你的纯业务代码零风险
- 工具**永不删文件**（`Deleted` 态只提示，不动手）

所以你（Claude）的唯一职责是产出正确的 `merged`（或 `declined`）。不要手动备份、不要手改项目文件、不要自己改版本号——交给工具。

## 回滚预案（升级出问题时）

工具已自动备份到 `.thirdnet-backup/<时间戳>/`，可整目录还原。项目若纳入版本控制，配合 VCS 回滚（git/svn 成对）：

- **git**：`git restore <文件>` 还原单个；`git checkout -- .` 还原全部已跟踪改动；新增未跟踪文件（`.tw/`、`.thirdnet-backup/`）手动删，并写入 `.gitignore`。
- **svn**：`svn revert -R .` 还原已跟踪改动；删掉本次新增但尚未 `svn add` 的文件；对 `.tw/`、`.thirdnet-backup/` 设置 `svn:ignore`，避免误入库。

本技能**不自动提交**：agent 不执行 `git commit` / `svn commit`；由你确认修改清单后自行落库。

## 验证升级成功

```bash
# 后端
thirdnet-migrate check                 # 应显示已是最新 / 无冲突
dotnet build                           # 编译通过
dotnet test                            # 测试通过

# 前端
npx create-thirdnet-admin@latest check
npm run build                          # vue-tsc + vite 构建通过
npm test                               # Vitest 通过
```

## Phase 4 — 出具修改清单（让用户一眼看清改了什么）

升级收尾**必须**产出一份修改清单：把本次"动了哪些文件、没动哪些文件、为什么"汇总成报告，在对话里展示，并落盘到项目根 `模板升级报告.md`（别写进 `.tw/`——它可能被 `--purge` 清掉）。这是用户确认"本次升级到底改了什么"的依据。

**数据来源**：`diff` 输出（6 态分组与计数）+ `.tw/units/*/meta.json`（每个 unit 的 role/mode、是 `merged` 还是 `declined`）+ `import-merge` stdout（applied 数、stale、是否推进版本）+ 构建验证结果。你（Claude）把这些合成下面的报告——这正是"尽量通过 AI 合并"的收尾环节。

报告模板（前后端通用，`<...>` 填实际值）：

```markdown
# 模板升级报告 · 修改清单

- 项目：<路径>
- 模板类型：后端 ThirdNet.Admin/Service.Template ｜ 前端 ThirdNet.Admin.Frontend
- 升级前版本 <X> → 升级后版本 <Y>
- 模式：3-way / 2-way（基线降级）｜ 清单 / 离线
- 构建验证：dotnet build / npm run build → ✅ 通过 ｜ ❌ 失败（原因）

## 落地核对（先核对，再信任下面的数字）
- diff 预期变更数 <M> ｜ 实际落地数 <N> ｜ 一致性 ✅ / ❌
- 若 ❌（版本号前进了，但落地远少于预期或为 0）→ 这是「空升级」，本报告数字不可信，回 Phase 2 排查清单/基线/命名空间/占位符

## 变更汇总（计数）
**已更新（本次已落地）**
- 🔄 UpstreamOnly 自动套用：<N>
- 📄 Added 新增：<N>
- 🔀 Conflict · AI 合并：<N>
- 🏷️ Brand/override · AI 合并：<N>

**未更新（本次未落地）**
- 🔒 UserOnly 保留（用户改动，按设计保留，无需处理）：<N>
- ⚠️ Conflict DECLINED（交人工合并）：<N>
- 🏷️ Brand DECLINED（交人工合并）：<N>
- 🕓 Stale（导出后文件又被改，未覆盖，需重新导出）：<N>
- 🗑️ Deleted 模板已删（仅提示，未删用户文件，确认是否手动清理）：<N>

## 已更新文件明细
| 文件 | 来源态 | 决策 | 说明（吸收了什么 / 保留了什么） |
|------|--------|------|--------------------------------|
| Admin/.../Startup.cs | Conflict | blended | 保留业务注册，吸收模板新增的 DI 扩展 |

## 未更新文件明细
| 文件 | 原因 | 后续建议 |
|------|------|----------|
| src/views/xxx/index.vue | DECLINED | 业务页面同处冲突，需人工合并 |

## 待人工跟进 / 落库建议
- DECLINED 的 <N> 个文件需人工合并后再次 `export-merge` → `import-merge`
- 本报告仅为审阅用，**不自动提交**；由你确认后自行 `git commit` / `svn commit`
```

> 决策列取值：`trust-template`（信模板）/ `trust-user`（信用户）/ `blended`（两侧调和，如 brand-merge）。每条已更新文件给一句话说明吸收/保留了什么，让用户不看 diff 也能判断本次升级是否合预期。

## 深入参考

- 完整命令、flag、6 态详解、离线模式 → `references/commands.md`
- 合并协议权威规范、工作目录格式、角色矩阵、DECLINED 全规则 → `references/merge-protocol.md`
