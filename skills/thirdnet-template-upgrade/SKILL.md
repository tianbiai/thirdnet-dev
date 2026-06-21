---
name: thirdnet-template-upgrade
version: 0.8.0
description: 把用 ThirdNet 模板生成的旧项目（.NET Admin/Service 后端、Vue 前端）升级到模板最新版本——**工具只做 diff 对比，由 AI 全量判定并直接升级文件**。凡是用户想把模板/脚手架更新拉进已生成项目、同步新版 ThirdNet 的 bugfix 或结构调整、说"升级/更新/同步模板""模板出新版了""迁移模板项目"、或要调和自己的自定义改动与模板变更时，都要用本技能——即使用户没点名工具也要用；新版 ThirdNet 包发布后用户想让老项目跟着升级时同样适用。覆盖后端 `thirdnet-migrate`（dotnet 工具）与前端 `create-thirdnet-admin`（npx）。AI 对每个变更文件做语义判定（可覆盖工具 6 态默认动作），用 Edit/Write 直接改项目文件——**不再走 apply/import-merge**，由 AI 手动备份 + VCS 兜底保证安全。升级收尾产出修改清单 + 合并后潜在风险清单（🟢🟡🔴 分级 + 验证建议）。
---

# ThirdNet 模板升级（前后端统一·AI 主导）

把用 ThirdNet 模板生成的旧项目升级到模板最新版本。**工具只负责 diff 对比；对比之后，由 AI 逐文件判定、直接升级**——判定权与合并权都在 AI，工具退化为纯对比 oracle。

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

## 私有 registry 地址

下面所有命令默认用**内网**地址；内网不通时换**外网**——同一服务，二选一。

| 仓库 | 内网（优先） | 外网（内网不通时） |
|---|---|---|
| NuGet（后端） | `http://192.168.1.156:8088/nuget` | `http://61.164.57.61:8088/nuget` |
| npm（前端） | `http://192.168.1.207:4873/` | `http://61.164.57.61:14873/`（端口 **14873**，非 4873） |

---

## 完整流程

### Phase 0 — 先升级工具本身

确保 diff 用的是最新版工具，否则查到的是旧模板。

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
- 前端命令**必须在前端项目目录内**运行（该目录 `.npmrc` 指向私有 registry）。

### Phase 1 — 对比（工具的唯一职责）

工具只出对比素材，**不跑 apply、不跑 import-merge**：

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

AI 读 Phase 1 的 `diff` 输出（必要时读 `.tw/units/*/` 的 base/mine/theirs），对**每个有变更的文件**做语义判定，产出 per-file 升级计划。**6 态只是输入，AI 可覆盖其默认动作**：

| AI 判定结果 | 含义 | 何时这样判 |
|---|---|---|
| `take-template` | 采纳模板版 | 工具判 UpstreamOnly/Added 且变更安全（无破坏性签名、无依赖 major 跳） |
| `merge` | 语义合并 base/mine/theirs | 工具判 Conflict/brand，或 UpstreamOnly 但 AI 发现有破坏性需调和 |
| `keep-user` | 保留用户版 | UserOnly，或模板变更与本项目无关 |
| `flag-human` | 标记交人工，不改 | 真冲突无连贯解、二进制、2-way 同处歧义、拿不准的破坏性变更 |

**AI 覆盖工具默认动作的典型场景**：
- 工具判 `UpstreamOnly`（默认自动套用），但 AI 发现模板把某 public 方法重命名/删了 → 改判 `flag-human` 或 `merge`（盲套会破坏调用方）
- 工具判 `Conflict`，但两侧改的是不同区域、平凡可合 → AI 直接 `merge`，不交人工
- 工具判 `UserOnly`，但内容其实是占位符残留 → 视情况处理

判定依据（角色信任矩阵、brand-merge 规则）见 `references/merge-protocol.md`。判定结果汇总成一张表，先在对话里给用户过目（高风险项可让用户确认），再进 Phase 3 执行。

### Phase 3 — AI 直接升级（核心·合并权在 AI）

按 Phase 2 的计划，AI 用 Edit/Write 直接改项目文件。**严格按下面顺序，先备份后改**：

1. **改前必备份**：把即将改动的文件复制到 `.thirdnet-backup/<时间戳>/`（复刻原 import-merge 的备份行为）。项目在 git/svn 下时，先确认工作区干净或做一个 commit-checkpoint，VCS 是兜底安全网。
2. **改前必重读**：编辑每个文件前**重新 Read 一遍**（防 diff 之后用户又改了），再 Edit/Write——这替代了原工具的陈旧哈希检查。
3. **逐文件执行**：
   - `take-template`：把模板版写入项目对应文件（来源：`.tw/units/<id>/theirs`，或 diff 给出的新版内容；拿不准确切模板内容时改判 `flag-human`，不猜）
   - `merge`：读 base/mine/theirs，按角色信任矩阵产出合并结果，写入项目文件（合并纪律见 `merge-protocol.md`）
   - `keep-user`：跳过，不改
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

本阶段分四步：

1. **构建验证**：按上方"验证升级成功"跑 `check` / `build` / `test`，确认编译与测试状态（结果写进报告头）。
2. **AI 影响分析**：遍历**全部已落地文件**（take-template + Added + merge + Brand·merge），按 `references/merge-protocol.md` 的「AI 影响分析」维度逐条推理——这个变更会不会破坏调用方签名、改 DI 注册顺序、引入依赖升级冲突、改配置语义……对疑似破坏性变更（方法重命名 / 删除签名 / 依赖 major 升级），用 **Grep 在项目里检索旧符号名 / 旧版本引用**，命中就坐实 🔴、并在建议里记下检索路径。产出 `risk-items[]`（文件、来源、等级 🟢🟡🔴、问题、建议）。
3. **合成报告**：把 diff 统计 + AI 的 Phase 2 判定表 + 构建结果 + `risk-items[]` 合成下面的报告模板。
4. **展示 + 写盘**：在对话里展示，并写入项目根 `模板升级报告.md`。

**数据来源**：`diff` 输出（6 态分组与计数）+ AI 的 Phase 2 判定表（每个文件的 take-template/merge/keep-user/flag-human）+ 构建验证结果 + Step 2 的 `risk-items[]`。

报告模板（前后端通用，`<...>` 填实际值）：

```markdown
# 模板升级报告 · 修改清单

- 项目：<路径>
- 模板类型：后端 ThirdNet.Admin/Service.Template ｜ 前端 ThirdNet.Admin.Frontend
- 升级前版本 <X> → 升级后版本 <Y>
- 模式：AI 主导（工具仅 diff）｜ 3-way / 2-way（基线降级）｜ 清单 / 离线
- 备份位置：.thirdnet-backup/<时间戳>/
- 构建验证：dotnet build / npm run build → ✅ 通过 ｜ ❌ 失败（原因）

## 落地核对（先核对，再信任下面的数字）
- diff 预期变更数 <M> ｜ 实际落地数 <N> ｜ 一致性 ✅ / ❌
- 若 ❌（版本号前进了，但落地远少于预期或为 0）→ 这是「空升级」，本报告数字不可信，回 Phase 1/2 排查清单/基线/命名空间/占位符与 AI 判定

## 变更汇总（计数）
**已更新（本次已落地·AI 直接写入）**
- 🔄 take-template（AI 采纳模板版）：<N>
- 📄 Added 新增（AI 写入）：<N>
- 🔀 merge（AI 语义合并）：<N>
- 🏷️ Brand·merge（AI brand-merge）：<N>

**未更新（本次未落地）**
- 🔒 keep-user（保留用户版）：<N>
- ⚠️ flag-human（AI 标记需人工，未改）：<N>
- 🗑️ Deleted 模板已删（仅提示，未删用户文件，确认是否手动清理）：<N>

## 已更新文件明细
| 文件 | 工具 6 态 | AI 决策 | 说明（吸收了什么 / 保留了什么） |
|------|----------|---------|--------------------------------|
| Admin/.../Startup.cs | Conflict | merge | 保留业务注册，吸收模板新增的 DI 扩展 |

## 未更新文件明细
| 文件 | 原因 | 后续建议 |
|------|------|----------|
| src/views/xxx/index.vue | flag-human | 业务页面同处冲突，需人工合并 |

## 合并后潜在风险（AI 影响分析结论，按风险等级排序）
> 以下为 AI 对**全部已落地文件**逐条推理的影响分析。等级仅供参考，最终以本地构建 + 回归测试为准。

| 文件 | 变更来源 | 风险 | 潜在问题与验证建议 |
|------|----------|------|---------------------|
| Admin/.../Program.cs | 🔀 merge | 🔴 高 | 模板新增 Serilog 中间件、注册早于自定义中间件，可能改变异常处理顺序 → 本地启动并触发一次异常验证 |
| src/package.json | 🏷️ Brand·merge | 🟡 中 | vue 3.4→3.5，存在未声明子依赖 → npm i 后跑 vue-tsc + 回归关键页面 |
| Admin/appsettings.json | 🔄 take-template | 🟢 低 | 仅新增健康检查配置项，无破坏性 |

**风险等级判定**：🔴 公开签名/方法重命名（破坏调用方）、DI 注册或中间件顺序变更、依赖 major 升级、删除对外 API、2-way 不确定块 ｜ 🟡 依赖 minor/patch 升级、配置键或默认值语义变化、brand 结构吸收影响构建产物 ｜ 🟢 纯新增（配置项/文件）、注释/格式、非破坏性补全

**本节统计**：🔴 高 <N> ｜ 🟡 中 <N> ｜ 🟢 低 <N> ｜ 无明显风险 <N>

## 待人工跟进 / 落库建议
- flag-human 的 <N> 个文件需人工合并后由 AI 再次评估写入，或人工直接改
- 本报告仅为审阅用，**不自动提交**；由你确认后自行 `git commit` / `svn commit`
```

> 决策列取值：`take-template`（采纳模板）/ `merge`（语义合并）/ `keep-user`（保留用户）/ `flag-human`（交人工）。每条已更新文件给一句话说明吸收/保留了什么，让用户不看 diff 也能判断本次升级是否合预期。

## 深入参考

- 完整命令、flag、6 态详解、离线模式 → `references/commands.md`
- 合并语义权威规范、角色矩阵、brand-merge 规则、**AI 影响分析（推理维度 + 等级映射 + `risk-items[]` 格式）** → `references/merge-protocol.md`
