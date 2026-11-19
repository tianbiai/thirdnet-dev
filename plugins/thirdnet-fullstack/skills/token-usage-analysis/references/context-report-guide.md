# Token 占用报告格式与解析归一化指南

本指南定义统一分类框架、各数据来源的格式，以及把任意来源归一化到统一框架的方法。解析时**绝不臆造数字**：缺项按文末降级矩阵处理。

## 1. 统一分类框架

| 分类 | 含义 | 典型来源字段 |
|------|------|-------------|
| System prompt | 系统提示（含技能 name+description 元数据、钩子注入、环境块） | `/context` 的 System prompt；脚本「System prompt（N 段）」 |
| System tools | 内置工具定义（Read/Edit/Bash/Agent 等） | `/context` 的 System tools；脚本「内置工具定义（N 个）」 |
| MCP tools | MCP 服务器提供的工具定义（按服务器分组） | `/context` 的 MCP tools；脚本「MCP 工具：<server>（N 个）」 |
| Memory files | 常驻指令文件（CLAUDE.md / AGENTS.md / 记忆文件） | `/context` 的 Memory files；ZCode 中并入 System prompt 或 system 消息 |
| Messages | 对话历史（用户消息、助手回复、推理块、工具结果、系统提醒） | `/context` 的 Messages；脚本「消息：<role> / <type>」 |
| Free space | 窗口剩余空间 | `/context` 的 Context Left；脚本按窗口大小计算 |
| 子代理（单列） | 派发子代理的独立上下文消耗，不进主窗口占比 | 脚本「子代理消耗」表；会话中可见的子代理 usage 报告 |

## 2. 各来源格式

### 2.1 `/context` 输出（粘贴文本，Claude Code / WorkBuddy·CodeBuddy Code CLI 通用）

典型结构（版本间措辞略有差异，字段语义一致）：

```text
Context Left: 62.30% (75,171 of 120,676 tokens until auto-compact)

Token Usage                    Tokens      Percent
System prompt                  2,654       2.2%
  - prompt                     2,214
  - tool definitions           440
System tools                   8,231       6.8%
MCP tools                     31,467      26.1%
  - mcp__playwright           18,062
  - mcp__documents             3,788
Memory files                   1,256       1.0%
Messages                      33,319      27.6%
Free space                    44,749      37.1%
```

解析要点：
- 优先取**绝对 token 数**；只有百分数时按总量（Context Left 括号内或 `of N`）折算；
- 二级条目（缩进行）是父分类的构成明细，归一化时**取父级、不重复计**；
- 「until auto-compact」说明剩余空间按自动压缩阈值计，非完整窗口，如实转述；
- WorkBuddy/CodeBuddy Code CLI 的 `/context` 输出同源同构，按同一映射归一化，**建议用 `/context all`**（展开默认折叠的 Memory / Skills / Agents 明细）：Memory 明细行归 Memory files 分类；Skills / Agents 各条目是常驻系统内容（技能 name+description、子代理定义）的构成明细，**取父级合计、不重复计**，父级缺失时按原始口径单列转述；`/cost`（成本与 Token 使用）、`/stats`（Token 用量/调用次数/时长）可作为**累计口径**补充来源，按 §2.4 其他格式处理。

### 2.2 ZCode 脚本输出（`analyze_token_usage.py` 默认模式）

已归一化的 markdown 报告，开头一行**体检总评横幅**（🟢/🟡/🔴/ℹ️ + 异常项点名），五节结构：一、会话概况（含当前窗口占用）；二、**消耗正常性体检**（逐项 ✅/⚠️/❌ 判定表，阈值见 optimization-guide §1）；三、分类占比（估算已按精确 usage 校准）；四、累计消耗（缓存读单列）；五、子代理消耗表。续写分析时直接用其数值、判定与 Top-N 消耗项。

注意脚本输出的 ZCode 特有分类：
- **消息：assistant / reasoning** —— 助手推理（thinking）块，会随对话累积；
- **消息：system / text** —— 运行时注入的系统提醒（环境块、todo 快照、工具结果包装等）；
- **消息：tool / text** —— 工具结果（文件读取、命令输出等，通常是 Messages 中的大头）。

### 2.3 Claude transcript 统计与窗口估算（`--source claude`）

累计消耗 + **窗口估算**（1.3.0 起）：当前窗口占用由末次 usage 精确推算（input + 缓存读 + 缓存写 + output）；消息历史为 transcript 估算（按 /compact「会话延续」标记截断）；System prompt / 内置工具 / MCP **无请求体可查**，以残差合计呈现、不逐项判级。精确逐项拆分需用户在 Claude Code 执行 `/context` 粘贴补充（用户粘贴后，精确值优先替换估算判定）。数据目录自动发现：`~/.claude/projects/`（Claude Code）优先，缺失时回退 `~/.codebuddy/projects/`（WorkBuddy/CodeBuddy Code CLI，Claude 兼容格式；字段不匹配时脚本明确报错，退回 /context 粘贴路径）。

### 2.4 其他格式（状态栏 / 桌面端显示 / 手动数字）

只要含「窗口总量 + 至少一个分类的数值或百分比」即可归一化；无法映射到框架的数字按原始口径单列转述，不强行归类。

## 3. 归一化步骤

1. 提取总量（窗口大小或已用总量）；
2. 各分类数值 → 绝对值（缺则由百分比 × 总量折算）；
3. 校验合计：分类之和 ≈ 已用总量（±5% 内正常，超出则如实标注「来源数据不自洽」）；
4. 计算各分类占窗口百分比；
5. 缺项按降级矩阵处理并在报告标注。

## 4. 两个统计口径

| 口径 | 定义 | 用途 |
|------|------|------|
| 当前窗口占用 | 末次调用输入 + 输出 | 看空间余量与构成（/context 等价） |
| 累计消耗 | 全部调用逐行累加；缓存读/写单列 | 看配额消耗（缓存读价格远低于非缓存输入） |

口径差异警告：ZCode `inputTokens` **已含**缓存读；Claude `input_tokens` **不含**（缓存读写单列）。脚本已分别处理，分析时不要交叉换算。

## 5. 最小数据要素与降级矩阵

最小可用：**窗口总量 + 任一分类数值**（即可出该分类占比）。

| 缺失项 | 降级行为 |
|--------|---------|
| 窗口总量 | 只出已用数值与分类间相对占比，不出剩余空间 |
| 全部分类明细 | 只出总量与剩余空间分析，注明「无分类明细，无法定位构成」 |
| 累计消耗 | 省略累计节，只做窗口构成分析 |
| 子代理数据 | 标注「不可得」，不估算 |
| 只有百分比无绝对值 | 按已知总量折算；总量也未知则只呈现相对占比 |
| 窗口/分类数据不足以支撑判定 | 体检表对应项标「不可得」（ℹ️），不判级、不臆造阈值结论；可判项照常判 |
