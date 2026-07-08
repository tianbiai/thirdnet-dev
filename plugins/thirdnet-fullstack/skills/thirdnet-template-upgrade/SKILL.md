---
name: thirdnet-template-upgrade
description: 把用 ThirdNet 模板生成的旧项目（.NET Admin/Service 后端、Vue 前端）升级到模板最新版本——工具只做 diff 对比，由 AI 全量判定并直接升级文件（Edit/Write，不走 apply/import-merge）。当用户说"升级/更新/同步模板""模板出新版了""迁移模板项目""thirdnet-migrate"，或要调和自己的改动与模板变更、新版 ThirdNet 包发布后想让老项目跟随时，使用本技能。覆盖后端 `thirdnet-migrate`（dotnet 工具）与前端 `create-thirdnet-admin`（npx）。默认前后端齐升 + 内网优先（连接失败自动转外网）+ AI 直接改文件，禁止就范围/网络询问用户。
license: MIT
metadata:
  version: "0.11.0"
  author: thirdnet
---

# ThirdNet 模板升级（前后端统一·AI 主导）

把用 ThirdNet 模板生成的旧项目升级到模板最新版本。**工具只负责 diff 对比；对比之后，由 AI 逐文件判定、直接升级**——判定权与合并权都在 AI，工具退化为纯对比 oracle。

## ⚠️ 执行铁律：范围与网络源（固定默认值·禁止询问）

升级时的"**升级范围**"和"**网络源**"有固定默认值——**禁止用 `AskUserQuestion`，也禁止用文字提问去问用户这两件事**，直接按默认执行（用户反复要求过，问一次就是多余打扰）。

- **范围（默认 = 前后端一起升）**：在用户工作区检测后端根（`.slnx` / `.template-manifest.json`）和前端根（`.template-version.json` / 含 admin 模板的 `package.json`）。两端都检测到 → 两端都升（各自跑一遍 Phase 0→4）；只检测到一端 → 只升那一端。**只有用户本轮主动说**"只升后端 / 只升前端 / 只升某一侧"才收窄——AI 不主动开口。
- **网络源（默认 = 内网优先，不通自动转外网）**：所有 `--add-source` / `--registry` 先填内网地址；命令因**连接类错误**（超时 / 拒接 / DNS 失败 / 拉不到包）失败时，**自动换外网地址重试一次，不问用户**；重试切外网时在报告里记一句"内网不通，已切外网"。**唯一允许就网络开口的情形**：内网 + 外网都连不上——此时也优先写进升级报告（列两条地址 + 失败原因 + 走离线模式的建议），**不要用 `AskUserQuestion` 阻塞式提问**。

**源地址**（NuGet / npm 内外网映射，含 npm 外网端口 **14873** 非 4873 的坑）以 [`backend-workflow` → internal-registry](../backend-workflow/references/internal-registry.md) 为唯一源，本技能不重复罗列。

> 可选的轻量探测（非强制，省一次失败往返）：跑命令前用 `curl -sS -m 3 -o /dev/null -w "%{http_code}" <内网地址>`，非 2xx/3xx 直接走外网。Windows git bash 自带 curl。

> **为什么硬性禁止**：这两个值是项目固定默认值（范围靠自动检测、网络靠失败重试），都能自动定，没有"需要用户拍板"的不确定性。AI 的判断力应留给 Phase 2 真正的冲突合并。本铁律优先级高于"遇到分支先确认"的一般倾向。

## 何时用

- 用户想把已有 ThirdNet 项目（后端 Admin/Service 或前端）跟进到模板新版
- 新版 ThirdNet 包发布后，用户想让老项目跟着升级
- 用户改动与模板变更出现冲突，需要调和
- 用户说"升级/更新/同步模板""模板出新版了""migrate template"等

## 心智模型（先建立这个，流程才说得通）

- **模板是"活的"，项目是"快照"**：模板持续修 bug / 改结构，但用模板生成的项目是一次性的，不会自动跟进——本技能就是把这个"跟进"做成 AI 主导、可回退的流程。
- **文件分 6 态**，工具 `diff` 会自动归类（详见 `references/commands.md`）——但**6 态只是 AI 判定的输入，不是最终决策**：
  - `UpstreamOnly` 🔄 —— 你没动过、模板改了（工具默认"自动套用"，AI 可改判）
  - `UserOnly` 🔒 —— 你改过、模板没动（保留）
  - `Conflict` ⚠️ —— 两边都改了（需要 AI 合并）
  - `Added` / `Deleted` / `Unchanged` —— 模板新增 / 模板已删 / 无变化
- **确定性边界（关键·本版已重定义）**：
  - **工具只做确定性对比**：`diff` / `export-merge` 出对比素材（6 态 + base/mine/theirs），**不写任何项目文件**。
  - **AI 做全部判定与升级**：逐文件语义决策（可覆盖 6 态默认动作）、用 Edit/Write 直接改项目文件、手动备份、推进版本标记。
  - **安全网从"工具内置"改为"AI 显式 + VCS 兜底"**：放弃了 apply/import-merge 的自动备份/陈旧检查，代价是 AI 必须自觉执行「改前备份、改前重读、不删、不盲推版本」（见下方「AI 升级的安全清单」）。这是用户明确选择"工具只对比、AI 升级"的必然后果——权力与责任一起交给了 AI。
- **独立变更尽力合并，影响流程的冲突停下来给建议**（核心行为准则）：本技能的目标是把项目推进到模板新版，而不是"安全地什么都没做"——但也不是"莽撞地替用户改坏流程"。判定冲突时分两段：
  - **独立 / 互不影响**（不同区域、不同符号、不同配置键、互不调用的逻辑）→ AI **直接合并/采纳并写下去**，不确定性写进 Phase 4「合并后潜在风险」报告（🟢🟡🔴 分级 + 验证建议）。
  - **影响当前流程**（同一符号、同一控制流、同一配置键的语义冲突，或模板变更会波及当前业务调用方 / 改变运行顺序）→ AI **不自动合并**，改走 `flag-with-plan`：罗列①冲突内容（两侧代码片段）②双方各自逻辑 ③合并建议（可多个方案 + 权衡），写进报告「待人工决策的冲突」，等用户拍板后再执行。
  - **物理上无法产出有效文件**（二进制、语法无法修复）→ `flag-human`。
  - 一句话：独立改动 AI 替你合掉，真正撞逻辑的冲突 AI 替你分析清楚再交给你拍板。"拿不准就全跳过"会把冲突原样留给用户手工，"全强行合并"会替用户改坏流程——两个极端都是本技能要消除的痛点。

## 默认行为（固定默认值·禁止询问）

> 范围（前后端一起升）与网络源（内网优先、不通自动转外网）的固定默认值、源地址表、curl 探测 tip 已统一在上方「执行铁律」说明——下文 Phase 0 起直接按默认执行，不重复。

---

## 完整流程

### Phase 0 — 先升级工具本身

确保 diff 用的是最新版工具，否则查到的是旧模板。**前后端工具都更新**（默认行为见上方「执行铁律」：两端都跑、不问用户；源地址内网优先、失败自动转外网）。

**后端（dotnet 全局工具）**——在任意目录（`<NuGet源>` 取自 [internal-registry](../backend-workflow/references/internal-registry.md)，内网先、失败换外网）：

```bash
dotnet tool uninstall -g ThirdNet.Migrate
dotnet tool install -g ThirdNet.Migrate --add-source <NuGet源>
# 验证版本：
dotnet tool list -g | grep -i migrate
```

更轻的等价做法：`dotnet tool update -g ThirdNet.Migrate --add-source <NuGet源>`。

**前端（npx，无持久安装）**——`npx create-thirdnet-admin@latest <cmd>` 每次从 registry 拉最新（`<npm源>` 取自 [internal-registry](../backend-workflow/references/internal-registry.md)，也可改项目 `.npmrc`）。
- 若曾 `npm i -g create-thirdnet-admin`，先 `npm uninstall -g create-thirdnet-admin` 清掉全局旧版，避免 npx 命中缓存。
- 前端命令**必须在前端项目目录内**运行（该目录 `.npmrc` 指向私有 registry）。

### Phase 1 — 对比（工具的唯一职责）

工具只出对比素材，**不跑 apply、不跑 import-merge**。按「执行铁律」第①条：检测到前后端两端时，分别 `cd` 进各自项目根跑下面命令，**两端都对比，不要只跑当前目录那一端，也不要停下来问用户范围**；只检测到一端则只跑那一端。

```bash
# 后端（cd 进 .slnx 所在的项目根）
thirdnet-migrate check     # 查最新版 + 当前清单状态
thirdnet-migrate diff      # 预览差异，按 6 态分组 + 每文件建议（AI 判定的主输入）

# 前端（cd 进前端项目根）
npx create-thirdnet-admin@latest check
npx create-thirdnet-admin@latest diff
```

**需要 3-way 素材时**（对 Conflict / brand 文件做语义合并，AI 要读 base/mine/theirs）：

```bash
thirdnet-migrate export-merge -o ./.tw          # 后端
npx create-thirdnet-admin@latest export-merge -o ./.tw --include-override   # 前端：带 --include-override 把 package.json 等 brand 文件也导出
```

`export-merge` 也属于"出对比素材"——它把 base/mine/theirs 落成可读文件供 AI 读，但 **AI 不写它的 `merged`/`declined`，也不跑 `import-merge`**（AI 直接改项目文件，见 Phase 3）。

**边缘情况**：后端若报缺 `.template-manifest.json`（项目早于清单机制），先跑一次 `thirdnet-migrate init-manifest` 生成清单（不动业务文件），再继续。

**异常冲突强制门（diff 后必查）**：若 `diff` 报告的 Conflict 文件**数量异常多**，且大多是你没印象改过的框架/配置文件（`Program.cs`、`Startup.cs`、`*DbContext.cs`、`appsettings*`、`_GlobalVibeUsings.cs` 等），先别往下走——这通常是占位符/命名空间未正确替换或基线缺失导致大面积 2-way 降级的信号。排查：
1. `.template-manifest.json`（后端）/ `.template-version.json`（前端）是否存在，`templateIdentity` 是否与目标模板一致（后端缺清单先跑 `init-manifest`）
2. 命名空间/项目名占位符是否在 diff 里大面积未替换
3. 是否因缺 `--base-nupkg` / 旧版 tgz 而整体降级 2-way

排查清楚再进 Phase 2；否则假冲突会淹没 AI 判定。

### Phase 2 — AI 全量判定（核心·判定权在 AI）

AI 读 Phase 1 的 `diff` 输出（必要时读 `.tw/units/*/` 的 base/mine/theirs），对**每个有变更的文件**做语义判定，产出 per-file 升级计划。**6 态只是输入，AI 可覆盖其默认动作**。

**判定总原则（最重要）**：按"独立 / 影响流程 / 物理不可为"三段分流——
- **独立 / 互不影响**的改动（含 UpstreamOnly、Added、不同区域的 Conflict）：默认 `take-template` / `merge`，能产出语法合法、可编译/类型自洽的结果就写下去，不确定性写进 Phase 4「合并后潜在风险」。
- **影响当前流程**的冲突（同符号/同控制流/同配置键语义、波及调用方、改变运行顺序）：不自动合并，走 `flag-with-plan`，罗列冲突+逻辑+建议交用户。
- **物理不可为**（二进制、语法无法修复）：`flag-human`。

看到 Conflict/2-way 就条件反射 flag 是反模式——但另一极端"无差别强行合并"同样是反模式：影响业务流程的冲突不该 AI 替用户拍板。判据是"两套改动是否在语义上互相波及"，不是"有没有冲突"。

| AI 判定结果 | 含义 | 何时这样判 |
|---|---|---|
| `take-template` | 采纳模板版 | 工具判 UpstreamOnly/Added。**即使变更看起来有破坏性（方法重命名、签名变更、依赖 major）也照样采纳**——破坏性是报告里的 🔴 风险项，不是跳过理由（跳了反而让项目停在旧 bug 上） |
| `merge` | 语义合并 base/mine/theirs | 工具判 Conflict/brand，且两侧改动**独立 / 互不影响语义**。**只要能产出可编译/类型自洽的结果就合并，哪怕需要做取舍、哪怕带不确定性**——不确定的部分写进报告标 🟡/🔴 |
| `keep-user` | 保留用户版 | UserOnly，或模板变更与本项目无关 |
| `flag-with-plan` | **不自动合并**，罗列冲突+逻辑+建议交人工 | 工具判 Conflict，且两侧改的是**同一符号 / 同一控制流 / 同一配置键的语义**，或模板变更会**波及当前业务调用方 / 改变运行顺序**——合并方向需要业务决策，AI 不替用户拍板。**必须附**：冲突两侧代码片段、各自逻辑、≥1 个合并方案及权衡（推荐项标注） |
| `flag-human` | 标记交人工，不改 | **仅当**：二进制文件；或合并后语法不合法且无法修复。门槛高，但不再承担"影响流程冲突"的职责（那种走 `flag-with-plan`） |

**AI 覆盖工具默认动作的典型场景**：
- 工具判 `UpstreamOnly`（默认自动套用），AI 发现模板把某 public 方法重命名/删了 → **仍 `take-template`**（不降级为 flag），但把"调用方可能受影响"写进报告标 🔴 + 用 Grep 检索旧符号名给出命中路径
- 工具判 `Conflict`，两侧改的是不同区域 / 不同符号 / 互不调用 → 直接 `merge`，无风险
- 工具判 `Conflict`，两侧改的是同区域但**互不影响语义**（如 framework 与 business 各自注册互不调用的 DI）→ 按角色信任矩阵取一方为主、另一方补差 → `merge`，被覆盖一侧若有丢失语义进报告标 🟡
- 工具判 `Conflict`，两侧改的是**同一符号 / 同一控制流 / 同一配置键语义**，或都会改变运行顺序 / 波及同一调用方 → **`flag-with-plan`**：不强行合并，罗列两侧代码+逻辑+合并方案交用户
- 工具判 `Conflict`，两套语义都重要、需真正融合 → **默认 `flag-with-plan`**（给出融合方案让用户选）；**仅当融合方式唯一且无歧义**时才 `merge`，融合方式的不确定性进报告标 🟡/🔴
- 工具判 `UserOnly`，但内容其实是占位符残留 → 视情况处理

判定依据（角色信任矩阵、brand-merge 规则、"独立 / 影响流程 / 物理不可为"三段决策）见 `references/merge-protocol.md`。判定结果汇总成一张表，先在对话里给用户过目，再进 Phase 3 执行。

### Phase 3 — AI 直接升级（核心·合并权在 AI）

按 Phase 2 的计划，AI 用 Edit/Write 直接改项目文件。**严格按下面顺序，先备份后改**：

1. **改前必备份**：把即将改动的文件复制到 `.thirdnet-backup/<时间戳>/`（复刻原 import-merge 的备份行为）。项目在 git/svn 下时，先确认工作区干净或做一个 commit-checkpoint，VCS 是兜底安全网。
2. **改前必重读**：编辑每个文件前**重新 Read 一遍**（防 diff 之后用户又改了），再 Edit/Write——这替代了原工具的陈旧哈希检查。
3. **逐文件执行**：
   - `take-template`：把模板版写入项目对应文件（来源：`.tw/units/<id>/theirs`，或 diff 给出的新版内容；拿不准确切模板内容时改判 `flag-human`，不猜）
   - `merge`：读 base/mine/theirs，按角色信任矩阵产出合并结果，写入项目文件（合并纪律见 `merge-protocol.md`）
   - `keep-user`：跳过，不改
   - `flag-with-plan`：**不写该文件**，但把它的冲突两侧代码 + 双方逻辑 + 合并建议整理好，留到 Phase 4 报告「待人工决策的冲突」呈现
   - `flag-human`：不动，记入 Phase 4 报告
4. **更新版本标记**：有文件落地后，AI 更新版本标记——前端改 `.template-version.json`；后端改 `.template-manifest.json` 的 `targetTemplateVersion`，并跑 `thirdnet-migrate init-manifest` 重算清单避免漂移。
5. **不删文件**：`Deleted` 态只 `flag-human` 提示，AI 不删用户文件。
6. **不自动提交**：agent 不执行 `git commit` / `svn commit`；用户审阅报告后自行落库。

## AI 升级的安全清单（放弃工具安全网后，AI 必须自觉执行）

原 apply/import-merge 提供的保证，现在由 AI 显式补齐——这 5 条是 AI 直接改文件不丢数据的底线：

1. **改前必备份** → `.thirdnet-backup/<时间戳>/`
2. **VCS 兜底** → 推荐项目在 git/svn 下，改前确认工作区状态
3. **改前重读** → Edit 前重新 Read 目标文件（替代陈旧检查）
4. **不删 / 不盲推版本** → Deleted 只 flag；版本仅在确有落地时推进
5. **不自动提交** → 用户审阅后自行 commit

## 回滚预案（升级出问题时）

AI 已把改动前的文件备份到 `.thirdnet-backup/<时间戳>/`，可整目录还原。项目若纳入版本控制，配合 VCS 回滚（git/svn 成对）：

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

## Phase 4 — 出具修改清单 + 合并后风险（让用户看清改了什么、哪里可能出问题）

升级收尾**必须**产出一份报告：既罗列"动了哪些文件、没动哪些、为什么"（修改清单），也指出"合并后哪些地方可能有隐患"（合并后潜在风险）。在对话里展示，并落盘到项目根 `模板升级报告.md`。这是用户确认"本次升级到底改了什么、要不要担心"的依据。

> **本报告是"独立合并 + 影响流程交人工"模式的承接点**：Phase 2/3 里所有 AI "拿不准但已合并"的独立改动的不确定性、所有疑似破坏性但已采纳的变更，都通过「合并后潜在风险」传达给用户；所有"影响当前流程、AI 没替你拍板"的冲突，都通过「待人工决策的冲突（flag-with-plan）」传达。报告写得越具体（命中路径、验证命令、风险等级、冲突两侧 + 方案），用户越敢信任本次升级——所以不要怕报告长，怕的是报告含糊。

本阶段分四步：

1. **构建验证**：按上方"验证升级成功"跑 `check` / `build` / `test`，确认编译与测试状态（结果写进报告头）。
2. **AI 影响分析**：遍历**全部已落地文件**（take-template + Added + merge + Brand·merge），按 `references/merge-protocol.md` 的「AI 影响分析」维度逐条推理——这个变更会不会破坏调用方签名、改 DI 注册顺序、引入依赖升级冲突、改配置语义……对疑似破坏性变更（方法重命名 / 删除签名 / 依赖 major 升级），用 **Grep 在项目里检索旧符号名 / 旧版本引用**，命中就坐实 🔴、并在建议里记下检索路径。产出 `risk-items[]`（文件、来源、等级 🟢🟡🔴、问题、建议）。
3. **合成报告**：把 diff 统计 + AI 的 Phase 2 判定表 + 构建结果 + `risk-items[]` 合成下面的报告模板。
4. **展示 + 写盘**：在对话里展示，并写入项目根 `模板升级报告.md`。

**数据来源**：`diff` 输出（6 态分组与计数）+ AI 的 Phase 2 判定表（每个文件的 take-template/merge/keep-user/flag-human）+ 构建验证结果 + Step 2 的 `risk-items[]`。

报告模板（前后端通用，含修改清单 / 待人工决策冲突 / 合并后风险三段，`<...>` 填实际值）见 [report-template](references/report-template.md)；在对话展示并落盘到项目根 `模板升级报告.md`。决策列取值：`take-template`（采纳模板）/ `merge`（语义合并）/ `keep-user`（保留用户）/ `flag-with-plan`（影响流程的冲突，附建议交人工）/ `flag-human`（物理无法产出，交人工）——每条已更新文件给一句话说明吸收/保留了什么，让用户不看 diff 也能判断本次升级是否合预期。

## 深入参考

- 完整命令、flag、6 态详解、离线模式 → `references/commands.md`
- 合并语义权威规范、角色矩阵、brand-merge 规则、**AI 影响分析（推理维度 + 等级映射 + `risk-items[]` 格式）** → `references/merge-protocol.md`
