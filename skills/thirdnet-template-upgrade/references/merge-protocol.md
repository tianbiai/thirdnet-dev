# 合并协议（`merge-protocol.md`）

`thirdnet-template-upgrade` 技能里"AI 充当判定者与合并器"的权威规范——工作目录（对比素材）格式、`meta.json` 全字段、角色分类规则、判定/合并/flag 纪律、以及合并后的 **AI 影响分析（推理维度 + 等级映射 + `risk-items[]`）**。

> **本版（v0.8.0）责任模型**：工具只出对比素材（`diff` / `export-merge`）；AI 读这些素材做判定，并用 Edit/Write **直接改项目文件**，**不写 workdir 的 `merged`/`declined`、不跑 `import-merge`**。workdir 退化为只读素材源。旧的工具落盘路径（import-merge / merge-workdir）见文末「遗留」，AI 主导模式下不用。

## 工作目录布局（只读素材）

`export-merge` 产出，**供 AI 读**。前后端格式完全一致：

```
<workdir>/                         # 默认 ./.thirdnet-merge-work
├── manifest.json                  # 顶层元数据
├── reference/                     # 新模板 reference 快照
└── units/
    <unitId>/                      # unitId = sha256(relativePath)[..16]，确定性、导出幂等
        ├── meta.json              # 该文件的合并上下文
        ├── base                   # 旧模板（共同祖先）；2-way 模式缺省
        ├── mine                   # 用户当前版本
        ├── theirs                 # 新模板版本
        ├── merged                 # （AI 主导模式下不写；仅遗留 import-merge 路径用）
        └── declined               # （AI 主导模式下不写；仅遗留 import-merge 路径用）
```

- **内容寻址 unitId**：`sha256(相对路径)[..16]`。子目录 / 同名文件靠它区分，`relativePath` 只存在 `meta.json`。
- **幂等导出**：重跑 `export-merge` 会清理"不再冲突"的旧 unit，保留仍冲突 unit 已有内容。
- **AI 主导模式下只读**：`manifest.json` / `meta.json` / `base` / `mine` / `theirs`；`merged`/`declined` 两个槽位不用——AI 把合并结果直接写到项目文件。`export-merge` 默认只导出 `Conflict` 态；brand 文件需 `--include-override`（非冲突的 UpstreamOnly/Added 不进 workdir，AI 据 `diff` 输出处理）。

### `manifest.json` 字段

| 字段 | 说明 |
|---|---|
| `tool` | `thirdnet-migrate` / `create-thirdnet-admin` |
| `mode` | `3-way` 或 `2-way`（整体倾向，取决于基线是否可得） |
| `templateIdentity` / `targetTemplateVersion` | 模板标识与目标版本 |
| `prefix` / `sourceName` / `symbols` | 命名空间替换上下文 |
| `projectPath` | 项目绝对路径 |
| `unitCount` / `exportedAt` | unit 数量与导出时间 |

### `meta.json` 字段（每个 unit）

| 字段 | 说明 |
|---|---|
| `relativePath` | 文件相对项目根的路径 |
| `role` | 语义角色：`config` / `framework` / `unknown`（后端按路径自动归类）；前端另有 `brand` |
| `mode` | `3-way`（有 base）/ `2-way`（无 base，更保守） |
| `mineHash` / `baseHash` / `theirsHash` | 三份内容哈希；`mineHash` 供 AI「改前重读」时比对参考（替代原 import 陈旧检查） |
| `isBinary` | 二进制 → AI 不合并，判 `flag-human` |
| `upstreamDiff` | base→theirs 的 unified diff（参考用） |
| `recommendation` | `trust-template` / `trust-user` / `merge`（工具按角色自动给出，**仅供参考，AI 可覆盖**） |

---

## 角色分类规则

后端按文件路径归类（前端 `brand` 由 override 清单判定）：

- **`config`**：文件名为 `appsettings*`、`*.csproj`、`*.props`、`*.targets`、`web.config`、`launchSettings.json`、`.npmrc`
- **`framework`**：`Program.cs`、`Startup.cs`、`_GlobalVibeUsings.cs`、`*DbContext.cs`；或路径含 `/Authentication/` `/Authorization/` `/Middlewares/` `/Middleware/` `/Filters/` `/Extensions/` `/HealthManager`
- **`unknown`**：以上都不命中（业务代码多落此，但业务代码通常根本不在 Conflict 集）
- **`brand`**（前端）：品牌 override 文件（package.json / brand.ts / index.html 等）；默认 export 跳过，`--include-override` 才纳入

## 信任矩阵（按 `meta.role` 给倾向，非硬规则——仍读全文判断）

| role | 倾向 | 含义 |
|---|---|---|
| `framework` / `infra` / `config` | 信 **THEIRS** | 吸收模板的 bugfix 与结构调整 |
| `business` | 信 **MINE** | 保留用户的业务逻辑、自定义、注释 |
| `brand` | **结构/版本信 THEIRS，品牌字段信 MINE** | 见 brand-merge 规则 |
| `unknown` | 当 `business`（保守） | 优先保留用户改动 |

### brand-merge 规则（`role === "brand"`）

按"结构/版本信 THEIRS，品牌字段信 MINE"逐项调和：

- **吸收 THEIRS 的结构性/版本性变更**：`package.json` 依赖版本号升级、新增 scripts/配置键；`vite.config.ts` 构建配置调整；`index.html` 结构性 meta/脚本引用。
- **原样保留 MINE 的品牌身份值**：项目名（`name`）、公司名/Logo/品牌色（`brand.ts`）、自定义 `<title>`、用户自加的依赖、用户定制的配置值。
- 两侧改的是**同一处**时，按角色信任矩阵取最可能的一方（结构/版本性 → THEIRS；品牌身份值 → MINE）写下去，并在报告里标 🟡 提示 review；若两侧都给的是互相排斥的字面值且无任何线索判断取舍（极少）→ 判 `flag-with-plan`，给冲突两侧 + 逻辑 + 合并建议交用户选，不替用户拍板。

## 判定纪律（Phase 2：AI 怎么判每个文件）

总原则：**按"独立 / 影响流程 / 物理不可为"三段分流**——判据是"两套改动是否在语义上互相波及"，不是"有没有冲突"。

- **独立 / 互不影响**的改动：默认合并或采纳，能产出语法合法、可编译/类型自洽的结果就写下去；不确定的风险、副作用、对调用方的潜在破坏**写进 Phase 4「合并后潜在风险」**，不跳过。
- **影响当前流程**的冲突：不自动合并，走 `flag-with-plan`，罗列冲突两侧 + 双方逻辑 + 合并建议交用户。
- **物理不可为**：`flag-human`。

对应 SKILL.md Phase 2 的五种判定：

- `take-template`：用户没动（UpstreamOnly/Added）→ 采纳模板版。**即使变更看起来有破坏性（方法重命名、签名变更）也照样采纳**——破坏性是报告里的 🔴 风险项，不是跳过的理由（跳了反而让项目停在旧 bug 上）。
- `merge`：两侧都改了，且改动**独立 / 互不影响语义**——只要能给出语法合法、可编译/类型自洽的合并结果就合并，**哪怕需要 AI 在两套改动里做取舍、哪怕结果带有不确定性**。不确定的部分写进报告标 🟡/🔴 提示 review，文件照常落地。
- `keep-user`：纯用户改动、模板没碰（UserOnly）→ 保留。
- `flag-with-plan`：两侧都改了，且改动**影响当前流程**（同一符号/同一控制流/同一配置键的语义、波及同一调用方、改变运行顺序）——**不自动合并**。必须产出：冲突两侧代码片段、各自逻辑、≥1 个合并方案及权衡（推荐项标注），进 Phase 4 报告「待人工决策的冲突」交用户拍板。这是"合并方向需要业务决策"时的正确归宿，不是"拿不准"的逃生口。
- `flag-human`：**仅当下列任一成立才不改、交人工**：
  - `meta.isBinary === true`（二进制无法语义合并）
  - 合并后文件**语法不合法**（缺括号、JSON 不闭合、C# 不全等），且 AI 无法在不引入臆造内容的前提下修好
  - （注："两侧同一行/同一键给互相排斥字面值"现已归 `flag-with-plan`——那种情况 AI 给建议让用户选，而非简单交人工。`flag-human` 只留物理不可为。）

### 决策倾向：先想"两套改动是否互相波及"

判定每个 Conflict/2-way 文件时，按此顺序思考：

1. **两侧改动独立 / 互不影响？**（不同区域、不同符号、不同配置键、互不调用的逻辑）→ 直接 `merge`，无风险或仅 🟢。
2. **同区域但互不影响语义？**（如 framework 与 business 各自注册互不调用的 DI）→ 按角色信任矩阵（framework/config 信 THEIRS、business 信 MINE、brand 逐项调和）取一方为主、另一方补差 → `merge`，被覆盖一侧若有丢失语义进报告标 🟡。
3. **两侧改动影响当前流程？**（同一符号 / 同一控制流 / 同一配置键语义、波及同一调用方、改变运行顺序，或两套语义都重要需融合且融合方式不唯一）→ **`flag-with-plan`**：不替用户拍板，给冲突两侧 + 逻辑 + 合并方案。仅当**融合方式唯一且无歧义**时才降为 `merge` + 报告标 🟡/🔴。
4. **物理上合不出来？**（二进制、语法无法修复）→ `flag-human`，并在报告里写清"为什么合不出来"，让人工知道卡点。

> **两个都要避免的反模式**：① 看到 Conflict/2-way 就条件反射判 flag，把"不确定"当跳过理由——会把升级停在半路、把用户留下面对一堆未合并冲突；② 无差别强行合并影响流程的冲突——会替用户改坏业务流程。不确定 → 报告（独立改动）或 → flag-with-plan（影响流程冲突），不是 → 全跳过，也不是 → 全强行合并。

## 合并纪律（Phase 3：AI 直接写项目文件）

- **用 Edit/Write 直接写项目对应文件**（不是 workdir 的 `merged`）。写前先备份、改前重读（见 SKILL.md「AI 升级的安全清单」）。
- 写的是**完整文件内容**（或精准 Edit 目标区域），不要解释、前言、代码围栏（```）、"以下是合并结果"之类。
- 只调和真正冲突的区域；保留原文件缩进、换行风格、编码；不重排或重格式化无关代码。
- **`flag-with-plan` 的文件不写盘**——本阶段不替用户拍板合并方向。AI 要做的是把该文件的冲突两侧代码片段、双方逻辑、合并方案（≥1 个 + 权衡 + 推荐项）整理好，留给 Phase 4 报告「待人工决策的冲突」呈现；用户确认方案后，再回到本阶段按用户选择执行写入。

## 2-way 何时降级

3-way 需要旧模板基线。基线不可得时该 unit 标 `2-way`：
- 后端：未提供 `--base-nupkg`（或基线 nupkg 内无该文件）
- 前端：约定位置找不到旧版 tgz

2-way 无共同祖先，**但 AI 仍尽力合并、不自动降级为 flag-human**。对每处歧义，AI 给出"最可能正确"的解读并写下去（通常信 THEIRS 吸收模板更新，或按角色信任矩阵取一方），**把不确定性写进报告标 🟡/🔴 提示人工 review**。若该歧义同时**影响当前流程**（同符号/同控制流/波及调用方），则走 `flag-with-plan` 而非强行合——2-way 不等于可以莽撞合并影响流程的冲突。只有真正无法判断取哪个值、且无任何旁证时才 flag-human（极少）。

> 2-way 的"最可能解"置信度低于 3-way，因此**该文件进报告时风险等级至少 🟡**（即使内容看起来平凡）——让用户知道这块缺基线、值得扫一眼。这是把"保守"从"跳过文件"转移到"标注风险"，既推进了升级，又不掩盖不确定性。

## AI 影响分析（impact-analysis）

合并写完后、生成报告前，Claude 做**只读的影响分析**——回答"这些已合并/已采纳的变更，落地后可能在项目里引发什么问题"。这是 SKILL.md Phase 4 Step 2 的权威规范。**只读推理，不改任何项目文件**。

### 输入

| 来源 | 覆盖 | 内容 |
|---|---|---|
| Phase 1 的 `diff` 输出 | take-template + Added + Deleted | 6 态分组、计数、每文件变更摘要 |
| `.tw/units/*/`（`meta.json` + base/mine/theirs） | merge + Brand·merge | 三方内容、role/mode、upstreamDiff |
| AI 的 Phase 2 判定表 | 全部已决策文件 | take-template/merge/keep-user/flag-human |

> 时机：Phase 3 AI 写完文件后、Phase 4 合成报告前。建议保留 Phase 1 的 diff 文本到此刻。

### 覆盖范围

**全部已落地文件**：`take-template` + `Added` + `merge` + `Brand·merge`。不在本节（归报告「未更新明细」/「待人工决策的冲突」/「待跟进」）：`flag-with-plan`、`flag-human`、`keep-user`。

> **与 Phase 2 判定的关系**：若维度 1（公开签名变更）/ 维度 2（DI/中间件顺序）在某个**被 merge 的文件**上命中 🔴，说明该冲突"波及调用方/改变运行顺序"——按 Phase 2 纪律它本应走 `flag-with-plan` 而非 `merge`。出现这种倒挂时，回到 Phase 2 把该文件改判 `flag-with-plan`，不要让"影响流程的冲突"以 merge + 🔴 的形式落地。本影响分析只对**真正独立合并**后的残留不确定性标 🔴（如 take-template 采纳了模板的重命名，调用方未改）。

### 逐文件推理维度

对每个已落地文件，逐条问下面 8 个问题，命中即生成一条 risk-item：

1. **公开签名变更**：方法/类型被重命名或删除、参数或返回类型变化、命名空间调整 → 破坏调用方
2. **DI / 中间件 / 拦截器**：注册顺序变了、新增了更早执行的中间件、生命周期（scoped↔singleton）变更 → 改变运行时行为
3. **依赖版本升级**：major（🔴 破坏性）/ minor（🟡 兼容风险）/ patch（🟢）
4. **配置 / 默认值 / 环境变量**：键被改名或删除、默认值语义变化、依赖的环境变量调整
5. **框架逻辑 / 算法变更**：模板的 framework 文件改了业务依赖的行为（如分页、缓存、鉴权流程）
6. **2-way 不确定块**：该文件是 `meta.mode === "2-way"`（无基线），合并偏保守、潜藏歧义 → 标 🟡 + 提示 review
7. **Brand 结构吸收**：`package.json` / `vite.config.ts` / `index.html` 的结构性/构建配置被吸收（新增 script、改 build 配置）→ 可能影响构建产物
8. **Deleted 残留引用**：模板已删的符号/文件，项目里可能还在引用

### 坐实手段（把"疑似"变成"确认"）

对维度 1/3/8 这类**破坏性可能**，不要只靠猜——用 **Grep 在项目里检索旧符号名 / 旧版本号**：

- 维度 1：搜旧方法名/旧类型名 → 命中调用点 → 坐实 🔴，建议里列出检索到的文件路径
- 维度 3：搜被移除/大变的依赖包名 + 旧版本号 → 命中 → 🔴/🟡
- 维度 8：搜被删符号名 → 命中 → 🟡/🔴

Grep 没命中 → 风险下调或归入"无明显风险"。

### 等级映射（与 SKILL.md 报告模板判定一字不差）

| 等级 | 触发条件 |
|---|---|
| 🔴 高 | 公开签名/方法重命名（破坏调用方）、DI 注册或中间件顺序变更、依赖 major 升级、删除对外 API、2-way 不确定块 |
| 🟡 中 | 依赖 minor/patch 升级、配置键或默认值语义变化、brand 结构吸收影响构建产物 |
| 🟢 低 | 纯新增（配置项/文件）、注释/格式、非破坏性补全 |

### 输出格式 `risk-items[]`

每条直接填进报告「合并后潜在风险」section：

```
{ relativePath, source, severity, problem, suggestion }
```

- `source`：`🔀 merge` / `🏷️ Brand·merge` / `🔄 take-template` / `📄 Added`
- `severity`：`🔴 高` / `🟡 中` / `🟢 低`
- `problem`：一句话说清"哪里、可能引发什么"
- `suggestion`：一句可执行的验证建议（含 Grep 命中路径 / 具体命令）

### 纪律

- **只读**：不改项目文件，不补依赖，不动配置——分析结论只进报告。
- **保守标注**：拿不准就标 🟡 + 提示 review，不要装作无风险；纯新增/格式类才标 🟢 或归"无明显风险"。
- **不重复造数**：落地数、flag-with-plan/flag-human 数等统计来自 AI 的 Phase 2 判定表，本节只产出"风险维度"的结论。

---

## 遗留：import-merge / merge-workdir（AI 主导模式下不用）

v0.8.0 之前，工具负责安全落盘（`import-merge`）与批量合并（`merge-workdir` headless 脚本调 Claude API）。**AI 主导模式下这两条路径都不用**——AI 直接 Edit/Write 项目文件 + 手动备份。仅当你明确想走旧的"工具落盘"路径时才参考：

- `import-merge -i ./.tw`：读 workdir 的 `merged`/`declined`，自动备份→写盘→推进版本→重算清单；带陈旧哈希检查；`--purge` 清理 workdir。
- `merge-workdir ./.tw`：headless 批量合并，逐 unit 调 Claude API（需 `ANTHROPIC_API_KEY`，默认 `claude-sonnet-4-6`）；退出码 `0` 全决 / `2` 有放弃 / `1` 致命；⚠️ 脚本对 `role=brand` 内置直接放弃、不调 API。

> 若走这条遗留路径，责任模型回到 v0.7.0：工具判定 6 态、apply 套非冲突、AI 只合并冲突。与 v0.8.0"AI 主导"互斥，不要混用。

## 失败模式速查

- **AI flag-with-plan**（影响流程的冲突的正常归宿）：两侧改了同一符号/同一控制流/同一配置键语义，或波及同一调用方/改变运行顺序 → 不强行合并，给冲突两侧 + 逻辑 + 合并方案交用户。这不是失败，是分流——等用户拍板后回 Phase 3 写入。
- **AI flag-human**（应极少出现）：仅限二进制、或合并后语法不合法且无法修复。注意"两侧同一行/同一键给互相排斥字面值"现已归 flag-with-plan（给建议让用户选），不归 flag-human。
- **部分落地**：只处理了部分文件 → 版本仍推进（有文件落地），其余 flag-with-plan / flag-human；flag-with-plan 的等用户拍板，flag-human 的可再次 diff 让 AI 处理。
- **2-way 降级**：基线不可得 → 该 unit 标 `2-way`，AI 仍尽力合并，结果进报告至少标 🟡 提示 review。
- **拿不准模板内容**：take-template 时若 diff 给不出确切新版内容（而非"内容有破坏性"）→ 改判 flag-human，不猜着写。注意"破坏性"不是这个范畴——破坏性的模板内容照常 take-template，破坏性进报告标 🔴。
