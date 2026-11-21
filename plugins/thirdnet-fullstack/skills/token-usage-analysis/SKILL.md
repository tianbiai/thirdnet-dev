---
name: token-usage-analysis
description: >
  当前会话 Token 消耗统计分析：自动解析本地会话日志（ZCode rollout / Claude Code 与 WorkBuddy·CodeBuddy CLI transcript）或基于 /context 等命令输出的占用报告，先给出「消耗是否正常」体检总评与异常（消耗过大）项识别，再给整个上下文窗口分类占比、子代理消耗汇总、消耗原因诊断与节省 Token 的优化建议。当用户提到 token 统计、token 占用、token 消耗、token 用量、token 消耗是否正常、消耗过大、异常消耗、上下文分析、上下文占用、上下文空间不足、省 token、优化 token 使用、分析 context 报告时，使用此技能。
license: MIT
metadata:
  version: "1.4.0"
  author: thirdnet
---

# Token 消耗统计分析技能

查询当前会话的 Token 占用情况，**先判定消耗是否正常、识别异常（消耗过大）项**，再分析各类构成的占比与原因，并给出节省 Token 的优化建议。覆盖**整个上下文窗口全部上下文**（系统提示 / 工具定义 / MCP 工具 / 全部对话历史）与**子代理全部消耗**。

统计脚本 `${CLAUDE_PLUGIN_ROOT}/skills/token-usage-analysis/scripts/analyze_token_usage.py` 是唯一的数据采集工具（仅 Python 标准库，无需安装依赖）——直接调用它，不要手写日志解析逻辑；脚本同时按统一阈值输出「正常性体检」判定（报告开头总评横幅 + 逐项 ✅/⚠️/❌），原因诊断与优化建议则由代理基于脚本输出续写（阈值表与知识库见 `references/optimization-guide.md`）。

## 两个统计口径（报告中分开呈现，不得混用）

| 口径 | 含义 | 回答的问题 |
|------|------|-----------|
| **当前窗口占用** | 末次模型调用的输入 + 输出（/context 等价口径） | 上下文还剩多少空间？谁占着？ |
| **累计消耗** | 全部调用逐行累加（配额/计费口径），缓存读单列 | 这个会话总共花了多少？ |

子代理消耗是独立上下文，**单列汇总表**，不计入主窗口占用。

## 执行步骤

### 1. 获取 Token 占用报告（降级级联，任一成功即进入第 2 步）

| 顺序 | 条件 | 动作 |
|------|------|------|
| a | 用户消息已附带报告 | 直接使用 |
| b | 环境支持 `/context`（Claude Code、WorkBuddy/CodeBuddy Code CLI 等） | 代理无法自行执行 REPL 命令——请用户在输入框执行 `/context`（WorkBuddy CLI 用 `/context all` 展开折叠明细）并粘贴完整输出（WorkBuddy CLI 另有 `/cost`、`/stats`，可一并粘贴补累计口径） |
| c | ZCode 环境（存在 `~/.zcode/cli/rollout/`） | 运行下方脚本，自动定位当前会话并生成完整报告 |
| d | 有 Claude Code 或 WorkBuddy/CodeBuddy CLI 本地日志（`~/.claude/projects/` / `~/.codebuddy/projects/`） | 脚本 `--source claude` 出统计与**窗口估算**（自动发现两个目录，也可 `--transcript` 指定；WorkBuddy 日志按 Claude 兼容格式解析，字段不匹配会明确报错——此时退回 b 档） |
| e | 以上皆不可得 | 询问用户提供报告，并列出最小数据要素：上下文窗口总量 + 各分类 token 数或百分比 |

**推荐操作引导（支持 `/context` 的环境，告知用户一次到位）**：

> 先在输入框执行 `/context`（**WorkBuddy CLI 用 `/context all`**——展开默认折叠的 Memory / Skills / Agents 明细）→ 全选复制 → **随调用语一起粘贴**（如「分析 token 消耗：\<粘贴\>」）。一条消息即命中级联 a 档、直接产出完整体检；不执行 `/context` 也能分析（脚本会按估算口径给窗口项判定），但精确逐项拆分（System prompt / 内置工具 / MCP 各自占比）只有 `/context` 有。

**两源合并（a/b 档命中时仍要做）**：用户已附 `/context` 报告时，若本机存在 Claude/WorkBuddy 日志目录，仍应运行脚本 `--source claude` 合并**累计口径**（会话总消耗、缓存读占比、窗口占用推算）——`/context` 只含当前窗口快照，不含累计数据；两源合并且 `/context` 精确值优先。

脚本调用方式（场景 c，ZCode 自动路径）：

```bash
# 自动选取最新主会话
python ${CLAUDE_PLUGIN_ROOT}/skills/token-usage-analysis/scripts/analyze_token_usage.py

# 常用参数
python ${CLAUDE_PLUGIN_ROOT}/skills/token-usage-analysis/scripts/analyze_token_usage.py \
  --session sess_xxx      # 指定会话（缺省自动取最新主会话）
  --window 200000         # 指定上下文窗口大小（模型未知时计算剩余空间）
  --top 6                 # Top-N 最大消息条数（默认 8）
```

场景 d（Claude transcript 基础统计）：

```bash
python ${CLAUDE_PLUGIN_ROOT}/skills/token-usage-analysis/scripts/analyze_token_usage.py --source claude \
  --transcript ~/.claude/projects/<项目目录>/<会话>.jsonl   # 缺省自动取最新；~/.claude 缺失时回退 ~/.codebuddy/projects（WorkBuddy）
```

### 2. 解析报告

- 脚本输出 / `/context` 粘贴文本 / 用户提供的其他格式，统一按 `references/context-report-guide.md` 的映射归一化到统一分类框架；
- 绝不臆造数字：缺项按降级矩阵处理，并在报告中标注「不可得」。

### 3. 子代理消耗汇总

- ZCode 路径：脚本输出已含，用量按三级口径级联（逐代理取首个可用者）：
  1. **父日志派发段**——主会话日志中每次派发的 usage 回报（Agent 工具结果尾注 + 后台/恢复完成通知）逐段累加，是唯一能穿透 resume 覆盖的完整口径；
  2. **子代理 rollout 日志**逐行累加（受留存策略清理，常大面积缺失）；
  3. **metadata.json 的 usage**（`~/.zcode/cli/agents/<sessionId>/agent_*/`；代理被 SendMessage 恢复多轮时被最后一段覆盖而非累加）；
- 多段代理（同一 agentId 多次派发）在表中标注「父日志×N 段」并附覆盖警告说明；
- 其他来源：从会话中可见的子代理 usage 信息汇总；不可得时明确标注，不估算。

### 4. 正常性体检与异常识别

- **ZCode 脚本路径**：脚本输出的体检总评横幅与判定表**照抄进报告**（总评 🟢/🟡/🔴/ℹ️ + 异常项点名），不重新计算；
- **非脚本来源**（/context 粘贴、Claude transcript、手报数字）：按 `references/optimization-guide.md` §1 阈值表逐项人工判定后填表；数据缺失的项标「不可得」（ℹ️），不判级；
- 可结合会话上下文给判定补充注记（如长会话消息占比偏高属预期），但**不得无数据依据翻转 ❌/⚠️ 判定**。

### 5. 占比与原因分析

- 聚焦体检判定的 ❌/⚠️ 异常项（全部 ✅ 时才退回占比最大的 1–3 个分类），按 `references/optimization-guide.md` 的「现象 → 典型原因」清单逐一对号诊断；
- 只给有数据支撑的结论；引用 Top-N 最大消息预览作为佐证（如某次大文件整读、某子代理任务书过宽）。

### 6. 输出分析报告与优化建议

按下方模板输出；优化建议必须**逐条对应体检异常项**、按预期节省幅度排序、给出可执行操作步骤，不堆砌通用清单。

## 报告输出模板

```markdown
## Token 占用分析报告
> **体检总评：🔴 异常**（1 ❌ / 2 ⚠️）—— 异常项：MCP 工具定义占窗口、剩余空间、子代理消耗

### 1. 会话概况
| 指标 | 数值 |
|------|------|
| 会话 / 模型 / 调用次数 / 时长 | ... |
| 当前窗口占用 | 99,989（窗口 200K 的 50.0%，剩余 100,011） |
| 累计消耗（配额口径） | 输入 1,301,587（含缓存读 1,216,832）+ 输出 42,117 |

### 2. 消耗正常性体检
| 检查项 | 数值 | 判定 | 阈值与说明 |
|--------|------|:----:|------------|
| System prompt 占窗口 | 2.7%（~5,400） | ✅ | 正常 ≤10%；>20% 异常 |
| 内置工具定义占窗口 | 18.5%（~20,220） | ➖ | 客户端注入基线，不可优化——仅展示 |
| MCP 工具定义占窗口 | 26.1%（~12,700），最大 playwright | ❌ | 正常 ≤10%；>20% 异常 |
| 消息历史占窗口 | 31.2%（~34,069） | ✅ | 正常 ≤50%；>70% 异常 |
| 剩余空间 | 37.1% | ⚠️ | 正常 ≥40%；<20% 异常（接近 autocompact） |
| 缓存读 / 累计输入 | 93.5% | ✅ | 正常 ≥80%；<60% 异常 |
| 子代理累计消耗 / 主会话累计输入 | 1.8× | ⚠️ | 正常 ≤1×；>3× 异常 |
| 累计输入 / 窗口占用 | 13.0× | ➖ | 参考项不判级：数十倍属正常机制（白名单） |

**异常项（消耗过大）**：MCP 工具定义占窗口 ❌；剩余空间、子代理消耗 ⚠️

### 3. 上下文窗口分类占比
System prompt（3 段）          ~2,700 ( 2.7%) ░░
内置工具定义（36 个）         ~20,220 (18.5%) ██████
MCP：playwright（25 个）       ~6,361 ( 5.8%) ██
消息：assistant / reasoning   ~34,069 (31.2%) ███████████
消息：tool / text（工具结果） ~24,641 (22.6%) ████████
...

### 4. Top 消耗项（最大消息 / 最大 MCP 服务器）
- ~3,806 · 工具结果 · 读取 CHANGELOG.md（2.51.0 节全文入上下文）
- ...

### 5. 子代理消耗（独立上下文）
| 子代理 | 累计 tokens | 来源 |
|--------|------------:|------|
| Explore（agent_xxx…） | 549,110 | 父日志×2 段 |

### 6. 原因分析（聚焦体检异常项）
（❌/⚠️ 项逐一对号：现象 → 原因，引用数据佐证）

### 7. 优化建议（按预期节省排序，逐条对应异常项）
1. [预计节省 ~X%] 建议...（操作步骤）
```

## 示例

### 场景一：ZCode 环境自动分析

**用户输入**：
```
分析一下当前会话的 token 占用，看看哪里消耗最多
```

**执行**：运行脚本（自动路径）→ 照抄体检总评与判定表（定位 ❌/⚠️ 异常项，如 MCP 工具 ❌、消息 reasoning ⚠️）→ 对异常项按 `references/optimization-guide.md` 诊断原因 → 输出报告与建议。

### 场景二：粘贴 /context 输出分析（Claude Code）

**用户输入**：
```
这是 /context 的输出：
Context Left: 62.30% (75,171 of 120,676 tokens)
System prompt: 2,654 tokens (2.2%)
System tools: 8,231 tokens (6.8%)
MCP tools: 31,467 tokens (26.1%)
Messages: 33,319 tokens (27.6%)
帮我分析哪里占得多，怎么省
```

**执行**：按 `references/context-report-guide.md` 归一化（百分数 × 总量折算）→ 按 `references/optimization-guide.md` §1 阈值逐项判定（MCP tools 26.1% ❌、剩余空间 37.1% ⚠️、其余 ✅）→ 给出禁用低频 MCP 服务器、compact 等建议。

## 注意事项

- **估算口径**：脚本分类数值为字符启发式估算（CJK ÷1.5、其他 ÷4），已按精确 usage 等比校准——绝对数值近似、占比结构可信，报告中如实标注；
- **体检判定以统一阈值为准**：ZCode 路径照抄脚本判定，非脚本来源按 `references/optimization-guide.md` §1 判定（阈值与脚本 `THRESHOLDS` 同步）；可补上下文注记，但不得无数据依据翻转 ❌/⚠️；
- **体检数据不足时**（无窗口总量 / 无分类明细）：对应项标「不可得」（ℹ️）不判级，建议用户补 `/context` 或 `--window N`，不臆造阈值结论；
- **WorkBuddy/CodeBuddy 版本差异**：CLI（CodeBuddy Code）支持 `/context`、`/cost`、`/stats`，本地日志在 `~/.codebuddy/projects/`（Claude 兼容）；IDE 版**无** `/context`（上下文压缩用 `/summarize`，用量看账号「用量」页）——只能走 e 档手动提供数字。Trae 等 IDE 类工具同理走 e 档；
- **Claude/WorkBuddy transcript 估算口径**（`--source claude`）：当前窗口占用由末次 usage **精确**推算（含缓存读写，勿与 ZCode 的 inputTokens 口径混算）；消息占比为 transcript 历史**估算**（脚本按 /compact「会话延续」标记截断，未检出标记但实际压缩过会偏高，报告已如实标注）；System prompt / 内置工具 / MCP 无请求体可查，以**残差合计**呈现、不逐项判级——用户粘贴 `/context` 后以精确值替换估算判定；
- **ZCode 与 Claude 的缓存口径不同**：ZCode `inputTokens` 已含缓存读；Claude `input_tokens` 不含（缓存读/写单列）。脚本已分别处理，续写分析时不要交叉换算；
- **统计边界**：ZCode rollout 日志有留存策略（旧文件可能被清理），报告注明「仅统计磁盘上留存的日志」；
- **子代理用量口径**（ZCode 路径）：同一子代理被 SendMessage 恢复多轮时，`metadata.json` 的 usage 被**最后一段覆盖**而非累加，子代理 rollout 日志又常被留存策略清理——脚本按 父日志派发段（逐段累加，完整口径）> 子代理日志 > metadata 级联取值并在表中标注来源；多段代理附覆盖警告。续写分析时沿用脚本口径，不要回退到单一来源；
- 子代理消耗是独立上下文，只进「累计消耗」汇总，不进主窗口占比；
- 报告含会话内容预览，仅本地分析使用，不外发；
- 分析当前会话时，脚本自身的调用也会产生新的 token 计录，属正常现象。
