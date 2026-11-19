---
name: token-usage-analysis
description: >
  当前会话 Token 消耗统计分析：自动解析本地会话日志（ZCode rollout / Claude transcript）或基于 /context 等命令输出的占用报告，给出整个上下文窗口分类占比、子代理消耗汇总、消耗原因诊断与节省 Token 的优化建议。当用户提到 token 统计、token 占用、token 消耗、token 用量、上下文分析、上下文占用、上下文空间不足、省 token、优化 token 使用、分析 context 报告时，使用此技能。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---

# Token 消耗统计分析技能

查询当前会话的 Token 占用情况，分析各类构成的占比与原因，并给出节省 Token 的优化建议。覆盖**整个上下文窗口全部上下文**（系统提示 / 工具定义 / MCP 工具 / 全部对话历史）与**子代理全部消耗**。

统计脚本 `${CLAUDE_PLUGIN_ROOT}/skills/token-usage-analysis/scripts/analyze_token_usage.py` 是唯一的数据采集工具（仅 Python 标准库，无需安装依赖）——直接调用它，不要手写日志解析逻辑；原因诊断与优化建议则由代理基于脚本输出续写（知识库见 `references/optimization-guide.md`）。

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
| b | 环境支持 `/context`（Claude Code 等） | 代理无法自行执行 REPL 命令——请用户在输入框执行 `/context` 并粘贴完整输出 |
| c | ZCode 环境（存在 `~/.zcode/cli/rollout/`） | 运行下方脚本，自动定位当前会话并生成完整报告 |
| d | 有 Claude Code 本地日志（`~/.claude/projects/`） | 脚本 `--source claude` 出基础统计（无分类明细，如实告知局限并建议 `/context` 补充） |
| e | 以上皆不可得 | 询问用户提供报告，并列出最小数据要素：上下文窗口总量 + 各分类 token 数或百分比 |

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
  --transcript ~/.claude/projects/<项目目录>/<会话>.jsonl   # 缺省自动取最新
```

### 2. 解析报告

- 脚本输出 / `/context` 粘贴文本 / 用户提供的其他格式，统一按 `references/context-report-guide.md` 的映射归一化到统一分类框架；
- 绝不臆造数字：缺项按降级矩阵处理，并在报告中标注「不可得」。

### 3. 子代理消耗汇总

- ZCode 路径：脚本输出已含（经 `~/.zcode/cli/agents/<sessionId>/agent_*/metadata.json` 关联全部子代理）；
- 其他来源：从会话中可见的子代理 usage 信息汇总；不可得时明确标注，不估算。

### 4. 占比与原因分析

- 定位占比最大的 1–3 个分类，按 `references/optimization-guide.md` 的「现象 → 典型原因」清单逐一对号诊断；
- 只给有数据支撑的结论；引用 Top-N 最大消息预览作为佐证（如某次大文件整读、某子代理任务书过宽）。

### 5. 输出分析报告与优化建议

按下方模板输出；优化建议必须绑定报告中的具体偏大分类、按预期节省幅度排序、给出可执行操作步骤，不堆砌通用清单。

## 报告输出模板

```markdown
## Token 占用分析报告

### 1. 会话概况
| 指标 | 数值 |
|------|------|
| 会话 / 模型 / 调用次数 / 时长 | ... |
| 当前窗口占用 | 99,989（窗口 200K 的 50.0%，剩余 100,011） |
| 累计消耗（配额口径） | 输入 1,301,587（含缓存读 1,216,832）+ 输出 42,117 |

### 2. 上下文窗口分类占比
System prompt（3 段）          ~2,700 ( 2.7%) ░░
内置工具定义（36 个）         ~20,220 (18.5%) ██████
MCP：playwright（25 个）       ~6,361 ( 5.8%) ██
消息：assistant / reasoning   ~34,069 (31.2%) ███████████
消息：tool / text（工具结果） ~24,641 (22.6%) ████████
...

### 3. Top 消耗项（最大消息 / 最大 MCP 服务器）
- ~3,806 · 工具结果 · 读取 CHANGELOG.md（2.51.0 节全文入上下文）
- ...

### 4. 子代理消耗（独立上下文）
| 子代理 | 累计输入(含缓存读) | 累计输出 |
|--------|-------------------:|---------:|
| Explore ×2 合计 | 549,110 | 14,086 |

### 5. 原因分析
（最大分类逐一对号：现象 → 原因，引用数据佐证）

### 6. 优化建议（按预期节省排序）
1. [预计节省 ~X%] 建议...（操作步骤）
```

## 示例

### 场景一：ZCode 环境自动分析

**用户输入**：
```
分析一下当前会话的 token 占用，看看哪里消耗最多
```

**执行**：运行脚本（自动路径）→ 基于输出定位最大分类（如 reasoning 块 31%、工具结果 23%）→ 按 `references/optimization-guide.md` 诊断原因 → 输出报告与建议。

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

**执行**：按 `references/context-report-guide.md` 归一化（百分数 × 总量折算）→ 诊断 MCP tools 与 Messages 偏大 → 给出禁用低频 MCP 服务器、compact 等建议。

## 注意事项

- **估算口径**：脚本分类数值为字符启发式估算（CJK ÷1.5、其他 ÷4），已按精确 usage 等比校准——绝对数值近似、占比结构可信，报告中如实标注；
- **ZCode 与 Claude 的缓存口径不同**：ZCode `inputTokens` 已含缓存读；Claude `input_tokens` 不含（缓存读/写单列）。脚本已分别处理，续写分析时不要交叉换算；
- **统计边界**：ZCode rollout 日志有留存策略（旧文件可能被清理），报告注明「仅统计磁盘上留存的日志」；
- 子代理消耗是独立上下文，只进「累计消耗」汇总，不进主窗口占比；
- 报告含会话内容预览，仅本地分析使用，不外发；
- 分析当前会话时，脚本自身的调用也会产生新的 token 计录，属正常现象。
