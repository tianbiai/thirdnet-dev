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
- 两侧改的是**同一处**时，按角色信任矩阵取最可能的一方（结构/版本性 → THEIRS；品牌身份值 → MINE）写下去，并在报告里标 🟡 提示 review；仅当两侧都给的是互相排斥的字面值且无任何线索判断取舍（极少）→ 才判 `flag-human`。

## 判定纪律（Phase 2：AI 怎么判每个文件）

总原则：**默认尽力合并、尽力推进升级——能产出语法合法、可编译/类型自洽的结果就写下去**。不确定的风险、可能的副作用、对调用方的潜在破坏，**一律写进 Phase 4 报告的「合并后潜在风险」**，而不是跳过文件交人工。flag-human 是**最后的兜底**，只用于 AI 物理上无法产出有效文件的情况，不是"拿不准时"的默认逃生口。对应 SKILL.md Phase 2 的四种判定：

- `take-template`：用户没动（UpstreamOnly/Added）→ 采纳模板版。**即使变更看起来有破坏性（方法重命名、签名变更）也照样采纳**——破坏性是报告里的 🔴 风险项，不是跳过的理由（跳了反而让项目停在旧 bug 上）。
- `merge`：两侧都改了——只要能给出语法合法、可编译/类型自洽的合并结果就合并，**哪怕需要 AI 在两套改动里做取舍、哪怕结果带有不确定性**。不确定的部分写进报告标 🟡/🔴 提示 review，文件照常落地。
- `keep-user`：纯用户改动、模板没碰（UserOnly）→ 保留。
- `flag-human`：**仅当下列任一成立才不改、交人工**（门槛很高，宁合并 + 报告风险，不轻易 flag）：
  - `meta.isBinary === true`（二进制无法语义合并）
  - `mine` 与 `theirs` 在**同一行/同一 JSON 键**给了两个互相排斥的字面值，**且全文件没有任何语义线索**能判断该取哪个（这种情况极少；多数"同处冲突"其实能靠角色信任矩阵或上下文给出最可能解）
  - 合并后文件**语法不合法**（缺括号、JSON 不闭合、C# 不全等），且 AI 无法在不引入臆造内容的前提下修好

### 决策倾向：先想"怎么合"，再想"要不要 flag"

判定每个 Conflict/2-way 文件时，按此顺序思考，能落到前两条就绝不 flag-human：

1. **能不能直接合并？** 两侧改的是不同区域 → 直接 merge，无风险。
2. **同区域但有主次？** 按角色信任矩阵（framework/config 信 THEIRS、business 信 MINE、brand 逐项调和）取一方为主、另一方补差 → merge，被覆盖的那一侧若有丢失语义，进报告标 🟡。
3. **同区域、两套语义都重要、需要真正融合？** AI 产出融合后的新代码（保证可编译/类型自洽）→ merge，融合方式的不确定性进报告标 🟡/🔴 + 提示 review。
4. **以上都走不通（极少）？** 才 flag-human——并在报告里写清"为什么合不出来"，让人工知道卡点。

> **反模式（必须避免）**：看到 Conflict 或 2-way 就条件反射判 flag-human、把"不确定"当成跳过理由。这会让升级停在半路、把用户留下面对一堆未合并的冲突——恰恰是本技能要消除的痛点。不确定 → 报告，不是 → 跳过。

## 合并纪律（Phase 3：AI 直接写项目文件）

- **用 Edit/Write 直接写项目对应文件**（不是 workdir 的 `merged`）。写前先备份、改前重读（见 SKILL.md「AI 升级的安全清单」）。
- 写的是**完整文件内容**（或精准 Edit 目标区域），不要解释、前言、代码围栏（```）、"以下是合并结果"之类。
- 只调和真正冲突的区域；保留原文件缩进、换行风格、编码；不重排或重格式化无关代码。

## 2-way 何时降级

3-way 需要旧模板基线。基线不可得时该 unit 标 `2-way`：
- 后端：未提供 `--base-nupkg`（或基线 nupkg 内无该文件）
- 前端：约定位置找不到旧版 tgz

2-way 无共同祖先，**但 AI 仍尽力合并、不自动降级为 flag-human**。对每处歧义，AI 给出"最可能正确"的解读并写下去（通常信 THEIRS 吸收模板更新，或按角色信任矩阵取一方），**把不确定性写进报告标 🟡/🔴 提示人工 review**。只有真正无法判断取哪个值、且无任何旁证时才 flag-human（极少）。

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

**全部已落地文件**：`take-template` + `Added` + `merge` + `Brand·merge`。不在本节（归报告「未更新明细」/「待跟进」）：`flag-human`、`keep-user`。

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
- **不重复造数**：落地数、flag-human 数等统计来自 AI 的 Phase 2 判定表，本节只产出"风险维度"的结论。

---

## 遗留：import-merge / merge-workdir（AI 主导模式下不用）

v0.8.0 之前，工具负责安全落盘（`import-merge`）与批量合并（`merge-workdir` headless 脚本调 Claude API）。**AI 主导模式下这两条路径都不用**——AI 直接 Edit/Write 项目文件 + 手动备份。仅当你明确想走旧的"工具落盘"路径时才参考：

- `import-merge -i ./.tw`：读 workdir 的 `merged`/`declined`，自动备份→写盘→推进版本→重算清单；带陈旧哈希检查；`--purge` 清理 workdir。
- `merge-workdir ./.tw`：headless 批量合并，逐 unit 调 Claude API（需 `ANTHROPIC_API_KEY`，默认 `claude-sonnet-4-6`）；退出码 `0` 全决 / `2` 有放弃 / `1` 致命；⚠️ 脚本对 `role=brand` 内置直接放弃、不调 API。

> 若走这条遗留路径，责任模型回到 v0.7.0：工具判定 6 态、apply 套非冲突、AI 只合并冲突。与 v0.8.0"AI 主导"互斥，不要混用。

## 失败模式速查

- **AI flag-human**（应极少出现）：仅限二进制、或两侧同一行/同一键给了互相排斥的字面值且无任何旁证、或合并后语法不合法且无法修复。其余情况一律合并 + 把风险写进报告，不 flag。
- **部分落地**：只处理了部分文件 → 版本仍推进（有文件落地），其余 flag-human；可再次 diff 让 AI 处理剩余。
- **2-way 降级**：基线不可得 → 该 unit 标 `2-way`，AI 仍尽力合并，结果进报告至少标 🟡 提示 review。
- **拿不准模板内容**：take-template 时若 diff 给不出确切新版内容（而非"内容有破坏性"）→ 改判 flag-human，不猜着写。注意"破坏性"不是这个范畴——破坏性的模板内容照常 take-template，破坏性进报告标 🔴。
