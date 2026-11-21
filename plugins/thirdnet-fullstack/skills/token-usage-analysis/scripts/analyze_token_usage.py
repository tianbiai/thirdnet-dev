#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Token 消耗统计分析脚本（token-usage-analysis 技能专用）。

数据源（按 --source 选择）：
- zcode（默认）：~/.zcode/cli/rollout/model-io-<sessionId>.jsonl
  每行一次完整模型调用：usage（精确数值）+ request.body（system / tools / messages
  全量快照）。末行请求体即当前上下文窗口全量，可做 /context 级分类占比。
- claude：Claude Code transcript（~/.claude/projects/**/*.jsonl；目录不存在时
  回退 WorkBuddy/CodeBuddy 日志目录 ~/.codebuddy/projects/，格式与 Claude 兼容）
  逐条 assistant 消息的 message.usage 基础统计；transcript 不含 system/tools
  明细，分类占比缺项需由 /context 输出补充。

统计口径（两个维度，报告中分开呈现，不得混用）：
- 当前窗口占用：末次调用 inputTokens + outputTokens（/context 等价口径）。
  注：inputTokens 已含缓存读部分（= 非缓存输入 + cacheReadTokens）。
- 累计消耗：全部调用逐行累加（配额/计费口径），缓存读单列。

子代理用量按三级口径级联（逐代理取首个可用者）：
1. 父会话日志派发段回报（Agent 工具结果尾注 + task-notification 通知）——唯一能
   穿透 resume 覆盖的完整口径：同一代理被 SendMessage 恢复多轮时，metadata.json
   的 usage 会被最后一段覆盖而非累加，父日志逐段回报累加才是真值；
2. 子代理 rollout 日志逐行累加（受留存策略清理，常大面积缺失）；
3. agents/<sessionId>/agent_*/metadata.json 的 usage（resume 覆盖后仅剩最后一段）。

仅用 Python 标准库。输出 markdown 原始统计与「正常性体检」判定（是否正常、
异常=消耗过大项识别）到 stdout，报告开头即给总评横幅；原因分析与优化建议
由代理续写，聚焦体检 ❌/⚠️ 项（见技能 SKILL.md 与 references/optimization-guide.md）。
"""

import argparse
import glob
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

ROLLOUT_DIR = os.path.join(os.path.expanduser("~"), ".zcode", "cli", "rollout")
AGENTS_DIR = os.path.join(os.path.expanduser("~"), ".zcode", "cli", "agents")
CLAUDE_PROJECTS_DIR = os.path.join(os.path.expanduser("~"), ".claude", "projects")
# WorkBuddy / CodeBuddy Code CLI（Claude Code 系衍生）的会话日志目录，结构同构：
# ~/.codebuddy/projects/<project-hash>/<session-id>/…；作为 claude 数据源的回退目录
CODEBUDDY_PROJECTS_DIR = os.path.join(os.path.expanduser("~"), ".codebuddy", "projects")

# 常见模型上下文窗口（token），仅用于展示「剩余空间」；未知模型不显示，
# 可用 --window N 显式指定。数值随官方口径变化，不保证实时准确。
MODEL_WINDOWS = {
    "glm-4.5": 128000,
    "glm-4.6": 200000,
    "claude-sonnet-4-5": 200000,
    "claude-sonnet-4-5-20250929": 200000,
    "claude-opus-4-1": 200000,
}

# 正常性体检阈值（占比单位 %，倍数单位 ×）。与 references/optimization-guide.md §1
# 「正常性判定阈值表」保持同步——两处改动必须一起改。
# 方向：low_ok = 值越低越好（占比型）；high_ok = 值越高越好（余量/命中型）。
# 分级：✅ 正常 / ⚠️ 偏高 / ❌ 异常（消耗过大）；➖ 不判级（基线/白名单参考项）；ℹ️ 不可得。
THRESHOLDS = {
    "system_prompt":   (10.0, 20.0, "low_ok",  "正常 ≤10%；10–20% 偏高；>20% 异常"),
    "mcp_tools":       (10.0, 20.0, "low_ok",  "正常 ≤10%；10–20% 偏高；>20% 异常"),
    "messages":        (50.0, 70.0, "low_ok",  "正常 ≤50%；50–70% 偏高；>70% 异常"),
    "free_space":      (40.0, 20.0, "high_ok", "正常 ≥40%；20–40% 偏低；<20% 异常（接近 autocompact）"),
    "cache_read":      (80.0, 60.0, "high_ok", "正常 ≥80%；60–80% 偏低；<60% 异常（缓存频繁失效）"),
    "subagent_ratio":  (1.0,  3.0,  "low_ok",  "正常 ≤1×；1–3× 偏高；>3× 异常"),
}

CJK_RE = re.compile(r"[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]")
QUERY_SOURCE_RE = re.compile(r'"querySource"\s*:\s*"([^"]+)"')

# 子代理派发段回报在父会话日志中的两种载体：
# A. Agent 工具结果尾注（前台派发完成）：`agentId: agent_xxx …` +
#    `<usage>subagent_tokens: N tool_uses: X duration_ms: Y</usage>`
# B. <task-notification> 通知（后台派发 / SendMessage 恢复段完成）：
#    `<task-id>agent_xxx</task-id>…<tool-use-id>call_xxx</tool-use-id>…
#     <usage><subagent_tokens>N</subagent_tokens>…</usage>`
DISPATCH_PLAIN_RE = re.compile(
    r"<usage>\s*subagent_tokens:\s*(\d+)\s+tool_uses:\s*(\d+)\s+duration_ms:\s*(\d+)\s*</usage>", re.S)
DISPATCH_AGENTID_RE = re.compile(r"agentId:\s*(agent_[0-9a-fA-F-]+)")
DISPATCH_NOTIF_RE = re.compile(
    r"<task-id>\s*(agent_[0-9a-fA-F-]+)\s*</task-id>.*?<tool-use-id>\s*([^\s<]+)\s*</tool-use-id>.*?"
    r"<usage>\s*<subagent_tokens>(\d+)</subagent_tokens>\s*<tool_uses>(\d+)</tool_uses>\s*"
    r"<duration_ms>(\d+)</duration_ms>\s*</usage>", re.S)


# ---------- 基础工具 ----------

def est_tokens_by_chars(text):
    """字符启发式估算：CJK ÷1.5、其他 ÷4。仅为相对占比服务，最终按精确 usage 校准。"""
    if not text:
        return 0.0
    cjk = len(CJK_RE.findall(text))
    other = len(text) - cjk
    return cjk / 1.5 + other / 4.0


def obj_tokens(obj):
    """任意 JSON 对象的体量估算（序列化后按字符启发式）。"""
    if obj is None:
        return 0.0
    if isinstance(obj, str):
        return est_tokens_by_chars(obj)
    try:
        s = json.dumps(obj, ensure_ascii=False)
    except (TypeError, ValueError):
        s = str(obj)
    return est_tokens_by_chars(s)


def preview(text, limit=70):
    if not isinstance(text, str):
        try:
            text = json.dumps(text, ensure_ascii=False)
        except (TypeError, ValueError):
            text = str(text)
    text = text.replace("\n", " ").replace("\r", " ").replace("\t", " ").strip()
    return (text[:limit] + "…") if len(text) > limit else text


def fmt(n):
    return f"{int(round(n)):,}"


def pct(part, whole):
    return (part / whole * 100.0) if whole else 0.0


def bar(fraction, width=24):
    fraction = max(0.0, min(1.0, fraction))
    filled = int(round(fraction * width))
    return "█" * filled + "░" * (width - filled)


def parse_ts(value):
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def human_duration(seconds):
    if seconds is None:
        return "未知"
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m{seconds % 60}s"
    return f"{seconds // 3600}h{(seconds % 3600) // 60}m"


# ---------- ZCode rollout 解析 ----------

def extract_usage(rec):
    """usage 位于 rec.response.usage（部分版本为顶层 rec.usage），两处兼容。"""
    usage = (rec.get("response") or {}).get("usage") or rec.get("usage") or {}
    return usage if isinstance(usage, dict) else {}


def read_rollout(path):
    """流式读取 rollout jsonl。

    文件内可能混有辅助调用（如 querySource=session_title 的会话标题生成，
    自带独立的小上下文 full 快照）——先按 querySource 众数判定主流对话流，
    消息重组与「末次调用」快照仅采用主流记录，辅助调用的消耗单列累计。
    主流请求中的消息为增量记录（messagesKind=full 全量快照 / delta 仅新增，
    messageOffset 为起始下标），按偏移跨行重组出末次调用时的完整对话历史。
    返回 (totals, calls, last, messages, aux)。
    """
    # 第一遍（轻量正则）：统计 querySource 众数 = 主流对话流
    sources = Counter()
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if not line.strip():
                continue
            m = QUERY_SOURCE_RE.search(line)
            if m:
                sources[m.group(1)] += 1
    main_source = sources.most_common(1)[0][0] if sources else None

    # 第二遍：主流行进重组；非主流行只累计消耗（aux）
    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    aux = {"count": 0, "input": 0, "output": 0, "kinds": Counter()}
    calls = []
    last = None
    messages_map = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            usage = extract_usage(rec)
            if main_source is not None and rec.get("querySource") != main_source:
                aux["count"] += 1
                aux["input"] += usage.get("inputTokens") or 0
                aux["output"] += usage.get("outputTokens") or 0
                aux["kinds"][rec.get("querySource") or "?"] += 1
                continue
            req = rec.get("request") or {}
            kind = req.get("messagesKind")
            off = req.get("messageOffset")
            msgs = req.get("messages") or []
            if not isinstance(off, int) or off < 0:
                off = len(messages_map)
            if kind == "full" or (kind is None and off == 0):
                messages_map.clear()
            for j, m in enumerate(msgs):
                if isinstance(m, dict):
                    messages_map[off + j] = m
            inp = usage.get("inputTokens") or 0
            out = usage.get("outputTokens") or 0
            totals["input"] += inp
            totals["output"] += out
            totals["cache_read"] += usage.get("cacheReadTokens") or 0
            totals["cache_write"] += usage.get("cacheWriteTokens") or 0
            calls.append({
                "startedAt": rec.get("startedAt"),
                "completedAt": rec.get("completedAt"),
                "querySource": rec.get("querySource"),
                "input": inp,
                "output": out,
                "cache_read": usage.get("cacheReadTokens") or 0,
            })
            last = rec
    messages = [messages_map[k] for k in sorted(messages_map)]
    return totals, calls, last, messages, aux


def resolve_zcode_file(args):
    """定位主会话日志文件。--file > --session > 最新修改的非 subagent 文件。"""
    if args.file:
        if not os.path.isfile(args.file):
            raise SystemExit(f"[token-usage-analysis] 文件不存在：{args.file}")
        return args.file, "file"
    if args.session:
        ident = args.session
        for cand in (ident, f"model-io-{ident}", f"model-io-{ident}.jsonl"):
            p = os.path.join(ROLLOUT_DIR, cand if cand.endswith(".jsonl") else cand + ".jsonl")
            if os.path.isfile(p):
                return p, "session"
        raise SystemExit(
            f"[token-usage-analysis] 未找到会话 {ident} 对应的日志（rollout 目录：{ROLLOUT_DIR}）。"
            "注意：留存策略可能已清理旧日志；也可用 --file 直接指定 jsonl 路径。")
    if not os.path.isdir(ROLLOUT_DIR):
        raise SystemExit(
            f"[token-usage-analysis] 未发现 ZCode rollout 目录 {ROLLOUT_DIR}，"
            "当前环境可能不是 ZCode；请改用 --source claude 或让用户提供报告。")
    files = [f for f in glob.glob(os.path.join(ROLLOUT_DIR, "model-io-sess_*.jsonl"))
             if "sess_subagent_" not in os.path.basename(f)]
    if not files:
        raise SystemExit(
            f"[token-usage-analysis] rollout 目录无主会话日志（{ROLLOUT_DIR}），"
            "可能已被留存策略清理。")
    return max(files, key=os.path.getmtime), "auto"


def window_breakdown(last, messages):
    """末行请求 → 分类体量估算列表 [(label, tokens_est, note)]。

    覆盖窗口全量：system 全部分段 + tools 全部定义（内置 / MCP 按服务器）+
    messages 全部历史（按角色 × 内容类型，由 read_rollout 跨行重组）。
    注意：system / tools 位于 request.body，对话消息位于 request.messages。
    """
    body = ((last or {}).get("request") or {}).get("body") or {}
    system = body.get("system") or []
    tools = body.get("tools") or []

    items = []

    sys_total = 0.0
    sys_prev = []
    for seg in system:
        text = seg.get("text") if isinstance(seg, dict) else (seg if isinstance(seg, str) else "")
        tok = est_tokens_by_chars(text or "")
        sys_total += tok
        if tok > 500:
            sys_prev.append(preview(text, 50))
    items.append((f"System prompt（{len(system)} 段）", sys_total,
                  "；".join(sys_prev[:3]) if sys_prev else ""))

    builtin_total = 0.0
    mcp_servers = {}
    mcp_tool_counts = {}
    for t in tools:
        if not isinstance(t, dict):
            continue
        name = t.get("name") or "?"
        tok = obj_tokens(t)
        if name.startswith("mcp__"):
            parts = name.split("__")
            server = parts[1] if len(parts) > 2 else name
            mcp_servers[server] = mcp_servers.get(server, 0.0) + tok
            mcp_tool_counts[server] = mcp_tool_counts.get(server, 0) + 1
        else:
            builtin_total += tok
    builtin_count = len(tools) - sum(mcp_tool_counts.values())
    items.append((f"内置工具定义（{builtin_count} 个）", builtin_total, ""))
    for server in sorted(mcp_servers, key=mcp_servers.get, reverse=True):
        items.append((f"MCP 工具：{server}（{mcp_tool_counts[server]} 个）",
                      mcp_servers[server], ""))

    msg_stats = {}
    msg_items = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        role = m.get("role") or "?"
        content = m.get("content")
        if isinstance(content, list):
            for b in content:
                btype = b.get("type") if isinstance(b, dict) else "?"
                tok = obj_tokens(b)
                key = f"消息：{role} / {btype}"
                msg_stats[key] = msg_stats.get(key, 0.0) + tok
                pv = None
                if isinstance(b, dict):
                    pv = b.get("text") or b.get("content") or b.get("name") or b.get("id") or b
                msg_items.append((tok, key, preview(pv)))
        else:
            tok = obj_tokens(content)
            key = f"消息：{role} / text"
            msg_stats[key] = msg_stats.get(key, 0.0) + tok
            msg_items.append((tok, key, preview(content)))
    for key in sorted(msg_stats, key=msg_stats.get, reverse=True):
        items.append((key, msg_stats[key], ""))

    return items, msg_items


def calibrate(items, exact_total):
    """按精确 inputTokens 等比校准估算值，使合计与精确值一致。"""
    total_est = sum(t for _, t, _ in items)
    scale = (exact_total / total_est) if total_est > 0 else 1.0
    return [(label, tok * scale, note) for label, tok, note in items], total_est, scale


# ---------- 子代理关联 ----------

def find_subagents(session_id):
    """经 agents/<sessionId>/agent_*/metadata.json 关联当前会话派发的全部子代理。

    usage 字段（inputTokens/outputTokens/totalTokens/cacheReadTokens）一并读出：
    子代理 rollout 日志受留存策略清理后，这是磁盘上仅存的用量记录——但注意它
    在代理被 SendMessage 恢复时会被最后一段覆盖而非累加（详见 extract_dispatch_segments）。
    """
    if not session_id:
        return []
    metas = []
    pattern = os.path.join(AGENTS_DIR, session_id, "agent_*", "metadata.json")
    for p in sorted(glob.glob(pattern)):
        try:
            with open(p, "r", encoding="utf-8", errors="replace") as f:
                meta = json.load(f)
        except (OSError, ValueError):
            continue
        usage = meta.get("usage")
        metas.append({
            "agentId": meta.get("agentId") or os.path.basename(os.path.dirname(p)),
            "profile": meta.get("profileId") or "?",
            "child": meta.get("childSessionId"),
            "prompt": meta.get("prompt"),
            "status": meta.get("status") or "?",
            "usage": usage if isinstance(usage, dict) else {},
        })
    return metas


def extract_dispatch_segments(path):
    """从主会话日志提取子代理派发段的 usage 回报，按 agentId 逐段累加。

    这是子代理用量中唯一能穿透 resume 覆盖的完整口径：同一代理被 SendMessage
    恢复多轮时，metadata.json 的 usage 只剩最后一段，子代理 rollout 日志又常被
    留存策略清理；而父会话日志中每段派发（前台 Agent 调用、后台完成通知）都
    带精确的 subagent_tokens 回报。同一段会随请求快照在多条记录中重复出现，
    按 (agentId, toolUseId) 去重后累加。
    返回 {agentId: {"tokens": 段合计, "segments": 段数}}。
    """
    segments = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if "subagent_tokens" not in line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            for m in (rec.get("request") or {}).get("messages") or []:
                if not isinstance(m, dict):
                    continue
                content = m.get("content")
                text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
                for um in DISPATCH_PLAIN_RE.finditer(text):
                    am = DISPATCH_AGENTID_RE.search(text)
                    if am:
                        segments[(am.group(1), m.get("toolCallId") or "?")] = int(um.group(1))
                for nm in DISPATCH_NOTIF_RE.finditer(text):
                    segments.setdefault((nm.group(1), nm.group(2)), int(nm.group(3)))
    by_agent = {}
    for (agent_id, _), tokens in segments.items():
        agg = by_agent.setdefault(agent_id, {"tokens": 0, "segments": 0})
        agg["tokens"] += tokens
        agg["segments"] += 1
    return by_agent


# ---------- Claude transcript 解析 ----------

def resolve_claude_transcript(args):
    if args.transcript or args.file:
        p = args.transcript or args.file
        if not os.path.isfile(p):
            raise SystemExit(f"[token-usage-analysis] 文件不存在：{p}")
        return p, "file"
    if not os.path.isdir(CLAUDE_PROJECTS_DIR):
        # Claude 目录不存在 → 回退 WorkBuddy/CodeBuddy 日志目录（格式兼容）
        if os.path.isdir(CODEBUDDY_PROJECTS_DIR):
            files = glob.glob(os.path.join(CODEBUDDY_PROJECTS_DIR, "**", "*.jsonl"), recursive=True)
            if files:
                return max(files, key=os.path.getmtime), "auto-codebuddy"
        raise SystemExit(
            f"[token-usage-analysis] 未发现 Claude projects 目录 {CLAUDE_PROJECTS_DIR}"
            f"（也未发现 WorkBuddy/CodeBuddy 目录 {CODEBUDDY_PROJECTS_DIR}）；"
            "请用 --transcript 指定 jsonl 路径，或让用户提供 /context 报告。")
    files = glob.glob(os.path.join(CLAUDE_PROJECTS_DIR, "**", "*.jsonl"), recursive=True)
    if not files and os.path.isdir(CODEBUDDY_PROJECTS_DIR):
        files = glob.glob(os.path.join(CODEBUDDY_PROJECTS_DIR, "**", "*.jsonl"), recursive=True)
        if files:
            return max(files, key=os.path.getmtime), "auto-codebuddy"
    if not files:
        raise SystemExit(f"[token-usage-analysis] {CLAUDE_PROJECTS_DIR} 下未找到 transcript。")
    return max(files, key=os.path.getmtime), "auto"


COMPACT_MARK_RE = re.compile(r"continued from a previous conversation", re.I)


def _msg_text(content):
    """提取消息纯文本（仅用于 /compact 会话延续标记识别）。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(b.get("text") for b in content
                        if isinstance(b, dict) and isinstance(b.get("text"), str))
    return ""


def analyze_claude(path):
    """Claude Code transcript：逐条 usage 基础统计 + 消息体量分布 + 窗口估算素材。

    transcript 不含 system prompt / 工具定义，窗口构成只能估算：
    - 末条 usage（input+cache_read+cache_write+output）≈ 当前窗口占用（精确）；
    - 自末次「会话延续」标记（/compact 产物）之后的消息估算 ≈ 消息历史占用；
    - 差值 = System prompt + 工具 + MCP 合计（残差，无法逐项拆分，需 /context）。
    返回 (totals, sizes, count_usage, first_ts, last_ts, last_info, hist)，
    hist 为 [(role, est_tokens, is_compact_marker)]。
    """
    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    sizes = {}
    hist = []
    count_usage = 0
    first_ts = last_ts = None
    last_info = None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            ts = parse_ts(rec.get("timestamp"))
            if ts:
                first_ts = first_ts or ts
                last_ts = ts
            msg = rec.get("message") or {}
            usage = msg.get("usage") or {}
            if usage:
                count_usage += 1
                totals["input"] += usage.get("input_tokens") or 0
                totals["output"] += usage.get("output_tokens") or 0
                totals["cache_read"] += usage.get("cache_read_input_tokens") or 0
                totals["cache_write"] += usage.get("cache_creation_input_tokens") or 0
                last_info = {
                    "input": usage.get("input_tokens") or 0,
                    "output": usage.get("output_tokens") or 0,
                    "cache_read": usage.get("cache_read_input_tokens") or 0,
                    "cache_write": usage.get("cache_creation_input_tokens") or 0,
                    "model": msg.get("model") or "",
                }
            role = msg.get("role") or rec.get("type") or "?"
            tok = obj_tokens(msg.get("content"))
            sizes[role] = sizes.get(role, 0.0) + tok
            compact = bool(COMPACT_MARK_RE.search(_msg_text(msg.get("content"))))
            hist.append((role, tok, compact))
    return totals, sizes, count_usage, first_ts, last_ts, last_info, hist


# ---------- 正常性体检（是否正常 / 异常=消耗过大 识别） ----------

def category_tokens(items, prefix):
    """按标签前缀汇总分类体量（如全部 MCP 服务器、全部消息分类）。"""
    return sum(tok for label, tok, _ in items if label.startswith(prefix))


def grade(value, spec):
    """按阈值分级：spec = (ok 边界, warn 边界, 方向, 说明)，返回 ✅/⚠️/❌。"""
    ok, warn, direction = spec[0], spec[1], spec[2]
    if direction == "high_ok":
        return "✅" if value >= ok else ("⚠️" if value >= warn else "❌")
    return "✅" if value <= ok else ("⚠️" if value <= warn else "❌")


def health_checks(items, window, window_used, totals, sub_tokens, sub_count):
    """对窗口构成 / 累计消耗 / 子代理三口径做正常性体检。

    返回 {"rows": [(检查项, 数值, 判定, 说明)], "overall": 总评,
    "abnormal": 异常项名列表（❌ 在前 ⚠️ 在后）, "n_bad": n, "n_warn": n}。
    窗口未知时窗口类检查项标 ℹ️ 不可得（阈值以完整窗口为分母，不降级换算）。
    """
    rows = []

    sys_tok = category_tokens(items, "System prompt")
    builtin_tok = category_tokens(items, "内置工具定义")
    mcp_tok, mcp_top = 0.0, None
    for label, tok, _ in items:
        if label.startswith("MCP 工具："):
            mcp_tok += tok
            if mcp_top is None or tok > mcp_top[1]:
                mcp_top = (label, tok)
    msg_tok = category_tokens(items, "消息：")

    if window:
        d = pct(sys_tok, window)
        rows.append(("System prompt 占窗口", f"{d:.1f}%（~{fmt(sys_tok)}）",
                     grade(d, THRESHOLDS["system_prompt"]), THRESHOLDS["system_prompt"][3]))
        d = pct(builtin_tok, window)
        rows.append(("内置工具定义占窗口", f"{d:.1f}%（~{fmt(builtin_tok)}）", "➖",
                     "客户端注入的固定基线，不可优化——仅展示，不判级"))
        d = pct(mcp_tok, window)
        mcp_val = f"{d:.1f}%（~{fmt(mcp_tok)}）"
        if mcp_top:
            mcp_val += f"，最大 {mcp_top[0][len('MCP 工具：'):]}"
        rows.append(("MCP 工具定义占窗口", mcp_val,
                     grade(d, THRESHOLDS["mcp_tools"]), THRESHOLDS["mcp_tools"][3]))
        d = pct(msg_tok, window)
        rows.append(("消息历史占窗口", f"{d:.1f}%（~{fmt(msg_tok)}）",
                     grade(d, THRESHOLDS["messages"]), THRESHOLDS["messages"][3]))
        free = max(0, window - window_used)
        d = pct(free, window)
        rows.append(("剩余空间", f"{d:.1f}%（{fmt(free)}）",
                     grade(d, THRESHOLDS["free_space"]), THRESHOLDS["free_space"][3]))
        if window_used > 0:
            rows.append(("累计输入 / 窗口占用", f"{totals['input'] / window_used:.1f}×", "➖",
                         "参考项不判级：数十倍属正常机制（每轮全量重发 + 缓存读降费），见白名单"))
    else:
        rows.append(("窗口构成（System prompt / 工具 / 消息 / 剩余空间）", "不可得", "ℹ️",
                     "窗口大小未知，占比无法计算——可用 --window N 指定后复跑"))

    if totals["input"] > 0:
        d = pct(totals["cache_read"], totals["input"])
        rows.append(("缓存读 / 累计输入",
                     f"{d:.1f}%（{fmt(totals['cache_read'])} / {fmt(totals['input'])}）",
                     grade(d, THRESHOLDS["cache_read"]), THRESHOLDS["cache_read"][3]))
    else:
        rows.append(("缓存读 / 累计输入", "不可得", "ℹ️", "累计输入为 0 或缺失"))

    if sub_count == 0:
        rows.append(("子代理累计消耗 / 主会话累计输入", "无子代理", "✅", "本会话未派发子代理"))
    elif totals["input"] > 0:
        r = sub_tokens / totals["input"]
        rows.append(("子代理累计消耗 / 主会话累计输入",
                     f"{r:.1f}×（{fmt(sub_tokens)} / {fmt(totals['input'])}）",
                     grade(r, THRESHOLDS["subagent_ratio"]),
                     THRESHOLDS["subagent_ratio"][3] + "；子代理为 tokens 合计口径（输入+输出，输出通常 <2%），"
                     "父日志派发段逐段累加、穿透 resume 覆盖"))
    else:
        rows.append(("子代理累计消耗 / 主会话累计输入", "不可得", "ℹ️",
                     "主会话累计输入缺失，无法计算倍数"))

    graded = [r for r in rows if r[2] in ("✅", "⚠️", "❌")]
    bad = [r[0] for r in graded if r[2] == "❌"]
    warn = [r[0] for r in graded if r[2] == "⚠️"]
    if not graded:
        overall = "ℹ️ 数据不足"
    elif bad:
        overall = "🔴 异常"
    elif warn:
        overall = "🟡 轻度偏离"
    else:
        overall = "🟢 正常"
    return {"rows": rows, "overall": overall, "abnormal": bad + warn,
            "n_bad": len(bad), "n_warn": len(warn)}


def health_banner(health):
    """报告开头的总评横幅：先给「是否正常」结论，数据与明细在后续节展开。"""
    if health["overall"] == "ℹ️ 数据不足":
        return ("> **体检总评：ℹ️ 数据不足** —— 可判检查项不足，无法下正常性结论"
                "（缺窗口数据时可用 `--window N` 指定后复跑）")
    head = f"> **体检总评：{health['overall']}**（{health['n_bad']} ❌ / {health['n_warn']} ⚠️）"
    if health["abnormal"]:
        return head + " —— 异常（消耗过大）项：" + "、".join(health["abnormal"])
    return head + " —— 全部检查项在阈值内"


def render_health_section(health):
    """「消耗正常性体检」节：判定表 + 异常项点名。"""
    lines = [
        "## 二、消耗正常性体检（阈值与 references/optimization-guide.md §1 保持一致）",
        "",
        "| 检查项 | 数值 | 判定 | 阈值与说明 |",
        "|--------|------|:----:|------------|",
    ]
    for name, value, verdict, note in health["rows"]:
        lines.append(f"| {name} | {value} | {verdict} | {note} |")
    lines.append("")
    if health["abnormal"]:
        lines.append("**异常项（消耗过大）**：" + "；".join(health["abnormal"])
                     + " —— 原因分析与优化建议优先针对这些项。")
        lines.append("")
    lines.append("> 判定基于统一阈值；分类数值为估算口径（已校准，占比可信）。代理可结合会话上下文补充注记"
                 "（如长会话消息占比偏高属预期），但不得无数据依据翻转 ❌/⚠️ 判定。")
    lines.append("")
    return lines


# ---------- 报告渲染 ----------

def render_zcode_report(path, how, top_n, window_override):
    totals, calls, last, messages, aux = read_rollout(path)
    if not calls:
        raise SystemExit(f"[token-usage-analysis] 文件无有效记录：{path}")

    session_id = (last or {}).get("sessionId") or os.path.basename(path)[len("model-io-"):-len(".jsonl")]
    model = ((last or {}).get("model") or {}).get("modelId") or "未知模型"
    last_usage = extract_usage(last or {})
    last_input = last_usage.get("inputTokens") or 0
    last_output = last_usage.get("outputTokens") or 0
    window_used = last_input + last_output

    window = window_override or MODEL_WINDOWS.get(model.lower())

    # 分类占比与子代理汇总先行算好——第二节「正常性体检」要引用它们的数值
    items, msg_items = window_breakdown(last, messages)
    items, total_est, scale = calibrate(items, last_input)
    items = [it for it in items if it[1] >= 1]
    subs = find_subagents(session_id)
    dispatch = extract_dispatch_segments(path)
    # 父日志有派发回报但 metadata 目录已被清理的代理（如最早一批）也要计入
    known = {s["agentId"] for s in subs}
    for agent_id in sorted(dispatch):
        if agent_id not in known:
            subs.append({"agentId": agent_id, "profile": "?", "child": None,
                         "prompt": "", "status": "?", "usage": {}})
    sub_rows = []
    sum_tokens = sum_in = sum_out = sum_cr = 0
    resumed_ids = []
    for s in subs:
        roll = None
        if s["child"]:
            child_file = os.path.join(ROLLOUT_DIR, f"model-io-{s['child']}.jsonl")
            if os.path.isfile(child_file):
                roll, _, _, _, _ = read_rollout(child_file)
        seg = dispatch.get(s["agentId"])
        # 三级口径级联：父日志派发段（穿透 resume 覆盖）> 子代理 rollout > metadata
        detail = None
        if seg:
            tokens = seg["tokens"]
            source = f"父日志×{seg['segments']} 段" if seg["segments"] > 1 else "父日志"
            if seg["segments"] > 1:
                resumed_ids.append(s["agentId"])
            detail = roll  # 细分列仅在子日志幸存时可得
        elif roll and (roll["input"] or roll["output"]):
            tokens = roll["input"] + roll["output"]
            source = "子代理日志"
            detail = roll
        elif s["usage"]:
            u = s["usage"]
            tokens = u.get("totalTokens") or ((u.get("inputTokens") or 0) + (u.get("outputTokens") or 0))
            source = "metadata"
            detail = {"input": u.get("inputTokens") or 0, "output": u.get("outputTokens") or 0,
                      "cache_read": u.get("cacheReadTokens") or 0}
        else:
            tokens = 0
            source = "缺失"
        sum_tokens += tokens
        if detail:
            sum_in += detail["input"]
            sum_out += detail["output"]
            sum_cr += detail["cache_read"]
        sub_rows.append((s, tokens, source, detail))
    health = health_checks(items, window, window_used, totals, sum_tokens, len(subs))

    out = []
    out.append("# Token 消耗统计（原始数据）")
    out.append("")
    out.append(f"- 数据来源：ZCode rollout 日志 `{path}`"
               + ("（自动选取最新主会话）" if how == "auto" else ""))
    out.append(f"- 统计边界：仅统计磁盘上留存的日志（留存策略可能已清理更早记录）；"
               "子代理用量按 父日志派发段 > 子代理日志 > metadata 级联（见第五节）")
    out.append("")
    out.append(health_banner(health))
    out.append("")
    out.append("## 一、会话概况")
    out.append("")
    out.append("| 指标 | 数值 |")
    out.append("|------|------|")
    out.append(f"| 会话 ID | `{session_id}` |")
    out.append(f"| 模型 | {model} |")
    out.append(f"| 模型调用次数 | {len(calls)}" +
               (f"（另有辅助调用 {aux['count']} 次：{'、'.join(f'{k}×{v}' for k, v in aux['kinds'].most_common())}）"
                if aux["count"] else "") + " |")
    first_ts = parse_ts(calls[0]["startedAt"])
    last_ts = parse_ts(calls[-1]["completedAt"] or calls[-1]["startedAt"])
    span = (last_ts - first_ts).total_seconds() if (first_ts and last_ts) else None
    out.append(f"| 首次调用 / 末次调用 | {calls[0]['startedAt'] or '?'} / {calls[-1]['completedAt'] or '?'}（跨度 {human_duration(span)}） |")
    if window:
        out.append(f"| 上下文窗口 | {fmt(window)} |")
        out.append(f"| **当前窗口占用** | **{fmt(window_used)}（{pct(window_used, window):.1f}%），剩余 {fmt(window - window_used)}** |")
    else:
        out.append(f"| **当前窗口占用** | **{fmt(window_used)}**（窗口大小未知，可用 `--window N` 指定） |")
    out.append(f"| 末次调用明细 | 输入 {fmt(last_input)}（含缓存读 {fmt(last_usage.get('cacheReadTokens') or 0)}）+ 输出 {fmt(last_output)} |")
    out.append("")

    out.extend(render_health_section(health))

    out.append("## 三、当前上下文窗口分类占比（估算，已按精确 usage 校准，合计 = 末次输入）")
    out.append("")
    out.append(f"> 字符启发式估算（CJK ÷1.5、其他 ÷4）后按末次精确输入 {fmt(last_input)} 等比校准"
               f"（原始估算 {fmt(total_est)}，缩放系数 ×{scale:.2f}）。绝对数值为近似，占比结构可信。")
    out.append("")
    out.append("| 分类 | 估算 token | 占窗口 |")
    out.append("|------|-----------:|-------:|")
    for label, tok, note in sorted(items, key=lambda x: -x[1]):
        note_s = f"（{note}）" if note else ""
        out.append(f"| {label}{note_s} | ~{fmt(tok)} | {pct(tok, window_used if not window else window):.1f}% |")
    out.append("")

    top_items = sorted(msg_items, key=lambda x: -x[0])[:top_n]
    if top_items:
        out.append(f"### Top {len(top_items)} 最大消息 / 内容块")
        out.append("")
        for tok, key, pv in top_items:
            out.append(f"- ~{fmt(tok)} · {key} · `{pv}`")
        out.append("")

    out.append("## 四、累计消耗（配额口径，全部调用逐行累加）")
    out.append("")
    out.append("| 指标 | 数值 |")
    out.append("|------|------|")
    out.append(f"| 累计输入（含缓存读） | {fmt(totals['input'])} |")
    out.append(f"| — 其中缓存读（价格更低） | {fmt(totals['cache_read'])} |")
    out.append(f"| — 其中非缓存输入 | {fmt(totals['input'] - totals['cache_read'])} |")
    out.append(f"| 累计输出 | {fmt(totals['output'])} |")
    out.append(f"| 缓存写 | {fmt(totals['cache_write'])} |")
    if aux["count"]:
        out.append(f"| 辅助调用（{'、'.join(aux['kinds'].keys())}） | {aux['count']} 次，输入 {fmt(aux['input'])} + 输出 {fmt(aux['output'])}（独立小上下文，已单列不计入上方分类） |")
    out.append("")

    out.append("## 五、子代理消耗（独立上下文，不计入上方窗口占用）")
    out.append("")
    if not subs:
        out.append(f"未发现本会话派发的子代理记录（查找目录：`{os.path.join(AGENTS_DIR, session_id)}`）。")
    else:
        out.append("> 用量来源级联（逐代理取首个可用者）：**父日志派发段**（Agent 结果尾注 + 完成通知逐段累加，"
                   "唯一能穿透 resume 覆盖）→ **子代理日志**（rollout，受留存策略清理）→ **metadata**"
                   "（agents 目录 usage 字段，resume 后仅剩最后一段）。细分列仅在其来源可得时填值。")
        out.append("")
        out.append("| 子代理 | 状态 | 累计 tokens | 输入(含缓存读) | 缓存读 | 输出 | 来源 | 任务书预览 |")
        out.append("|--------|------|------------:|---------------:|-------:|-----:|------|------------|")
        for s, tokens, source, detail in sub_rows:
            d_in, d_cr, d_out = "—", "—", "—"
            if detail:
                d_in, d_cr, d_out = fmt(detail["input"]), fmt(detail["cache_read"]), fmt(detail["output"])
            out.append(f"| {s['profile']}（{s['agentId'][:20]}…） | {s['status']} | "
                       f"**{fmt(tokens)}** | {d_in} | {d_cr} | {d_out} | {source} | "
                       f"`{preview(s['prompt'], 40)}` |")
        out.append(f"| **合计（{len(subs)} 个）** | — | **{fmt(sum_tokens)}** | {fmt(sum_in)} | {fmt(sum_cr)} | {fmt(sum_out)} | | |")
        n_detail = sum(1 for _, _, _, d in sub_rows if d)
        if n_detail < len(subs):
            out.append("")
            out.append(f"注：「累计 tokens」列为全量口径合计；细分三列仅覆盖 {n_detail}/{len(subs)} 个"
                       "有细分来源（子代理日志幸存 / metadata）的代理，父日志派发段只有合计值。")
        out.append("")
        if resumed_ids:
            out.append(f"⚠️ {len(resumed_ids)} 个子代理含多段派发（SendMessage 恢复）：其 `metadata.json` 的 usage "
                       "会被最后一段**覆盖**而非累加、子代理日志也常被清理——本表对其采用父日志逐段回报累加"
                       "（来源列为「父日志×N 段」），为完整口径。")
            out.append("")

    out.append("---")
    out.append("以下由代理基于以上数据续写：**原因分析**（聚焦体检 ❌/⚠️ 异常项，见 references/optimization-guide.md 的「现象→原因」清单）"
               "与**优化建议**（逐条对应异常项，按预期节省排序）。")
    return "\n".join(out)


def render_claude_report(path, top_n, how="", window_override=None):
    totals, sizes, count_usage, first_ts, last_ts, last_info, hist = analyze_claude(path)
    if count_usage == 0 or not last_info:
        raise SystemExit(f"[token-usage-analysis] transcript 中未找到 usage 记录：{path}"
                         "（WorkBuddy/CodeBuddy 日志若与 Claude 格式不兼容会在此报错，"
                         "此时请改用 /context 粘贴路径）")
    span = (last_ts - first_ts).total_seconds() if (first_ts and last_ts) else None

    # 窗口估算：末次 usage（精确）+ 消息历史（估算）+ 残差
    model = last_info.get("model") or "未知模型"
    window_used = last_info["input"] + last_info["cache_read"] + last_info["cache_write"] + last_info["output"]
    window = window_override or MODEL_WINDOWS.get(model.lower())
    cut = -1
    for i, (_, _, compact) in enumerate(hist):
        if compact:
            cut = i
    tail = hist[cut + 1:]
    msgs_est = sum(tok for _, tok, _ in tail)
    residual = max(0.0, window_used - msgs_est)
    over_est = msgs_est > window_used

    out = []
    out.append("# Token 消耗统计（原始数据 · Claude transcript 统计与窗口估算）")
    out.append("")
    src_note = ("（自动选取最新，来自 `~/.codebuddy/projects/`——WorkBuddy/CodeBuddy 日志，"
                "按 Claude 兼容格式解析）" if how == "auto-codebuddy" else "")
    out.append(f"- 数据来源：`{path}`{src_note}")
    out.append("- **局限**：transcript 不含 system prompt / 工具定义——窗口构成按**估算口径**给出"
               "（窗口占用来自末次 usage 精确推算、消息为 transcript 估算、System+工具+MCP 为残差合计），"
               "精确逐项拆分需在 Claude Code 执行 `/context` 后粘贴。")
    out.append("")
    out.append("| 指标 | 数值 |")
    out.append("|------|------|")
    out.append(f"| 含 usage 的响应条数 | {count_usage} |")
    out.append(f"| 模型 | {model} |")
    if window:
        out.append(f"| 上下文窗口 | {fmt(window)} |")
        out.append(f"| **当前窗口占用（末次 usage 推算）** | **{fmt(window_used)}（{pct(window_used, window):.1f}%），剩余 {fmt(window - window_used)}** |")
    else:
        out.append(f"| **当前窗口占用（末次 usage 推算）** | **{fmt(window_used)}**（窗口大小未知，可用 `--window N` 指定） |")
    out.append(f"| 时间跨度 | {human_duration(span)} |")
    out.append(f"| 累计非缓存输入 | {fmt(totals['input'])} |")
    out.append(f"| 累计缓存读（价格更低） | {fmt(totals['cache_read'])} |")
    out.append(f"| 累计缓存写 | {fmt(totals['cache_write'])} |")
    out.append(f"| 合计输入（非缓存 + 缓存读 + 缓存写） | {fmt(totals['input'] + totals['cache_read'] + totals['cache_write'])} |")
    out.append(f"| 累计输出 | {fmt(totals['output'])} |")
    out.append("")
    out.append("> 注：Claude transcript 的 `input_tokens` 不含缓存部分（与 ZCode 的 inputTokens 口径不同），各项分开列示、不重复计算。")
    out.append("")

    # 体检（估算增强）：窗口占用精确、消息/剩余空间估算判定、残差仅参考
    rows = []
    if window:
        d = pct(msgs_est, window)
        rows.append(("消息历史占窗口（估算）", f"{d:.1f}%（~{fmt(msgs_est)}）",
                     grade(d, THRESHOLDS["messages"]),
                     THRESHOLDS["messages"][3] + "；估算口径（transcript 历史），精确值以 /context 为准"))
        free = max(0, window - window_used)
        d = pct(free, window)
        rows.append(("剩余空间", f"{d:.1f}%（{fmt(free)}）",
                     grade(d, THRESHOLDS["free_space"]), THRESHOLDS["free_space"][3]))
    else:
        rows.append(("消息历史占窗口 / 剩余空间", "不可得", "ℹ️",
                     "窗口大小未知——可用 --window N 指定后按估算口径判定"))
    d = pct(residual, window if window else window_used)
    rows.append(("System prompt + 工具 + MCP 合计（残差）", f"{d:.1f}%（~{fmt(residual)}）", "➖",
                 "transcript 无请求体，无法逐项拆分（拆分需 /context）——仅作参考不判级"))
    input_side = totals["input"] + totals["cache_read"]
    if input_side > 0:
        d = pct(totals["cache_read"], input_side)
        rows.append(("缓存读 / 输入侧合计（非缓存 + 缓存读）",
                     f"{d:.1f}%（{fmt(totals['cache_read'])} / {fmt(input_side)}）",
                     grade(d, THRESHOLDS["cache_read"]), THRESHOLDS["cache_read"][3]))
    else:
        rows.append(("缓存读 / 输入侧合计（非缓存 + 缓存读）", "不可得", "ℹ️", "输入侧合计为 0"))
    if window_used > 0:
        cum_input = totals["input"] + totals["cache_read"] + totals["cache_write"]
        rows.append(("累计输入 / 窗口占用", f"{cum_input / window_used:.1f}×", "➖",
                     "参考项不判级：数十倍属正常机制（每轮全量重发 + 缓存读降费），见白名单"))

    graded = [r for r in rows if r[2] in ("✅", "⚠️", "❌")]
    bad = [r[0] for r in graded if r[2] == "❌"]
    warn = [r[0] for r in graded if r[2] == "⚠️"]
    if not graded:
        overall = "ℹ️ 数据不足"
    elif bad:
        overall = "🔴 异常"
    elif warn:
        overall = "🟡 轻度偏离"
    else:
        overall = "🟢 正常"
    if graded:
        banner = f"> **体检总评：{overall}**（{len(bad)} ❌ / {len(warn)} ⚠️）"
        if bad + warn:
            banner += " —— 异常（消耗过大）项：" + "、".join(bad + warn)
        else:
            banner += " —— 全部检查项在阈值内"
        banner += "。注：以上为估算口径，粘贴 /context 输出可升级为精确逐项判定"
    else:
        banner = "> **体检总评：ℹ️ 数据不足** —— 可判检查项不足（缺窗口数据时可用 `--window N` 指定后复跑）"
    out.append(banner)
    out.append("")
    out.append("## 消耗正常性体检（估算口径：窗口占用精确、消息占比估算、残差不判级）")
    out.append("")
    out.append("| 检查项 | 数值 | 判定 | 阈值与说明 |")
    out.append("|--------|------|:----:|------------|")
    for name, value, verdict, note in rows:
        out.append(f"| {name} | {value} | {verdict} | {note} |")
    out.append("")
    if bad + warn:
        out.append("**异常项（消耗过大）**：" + "；".join(bad + warn) + " —— 原因分析与优化建议优先针对这些项。")
        out.append("")

    out.append("## 窗口构成估算（精确逐项拆分需 /context）")
    out.append("")
    denom = window if window else window_used
    out.append("| 分类 | 估算 token | 占窗口 |")
    out.append("|------|-----------:|-------:|")
    out.append(f"| 消息历史（transcript 估算，{len(tail)} 条） | ~{fmt(msgs_est)} | {pct(msgs_est, denom):.1f}% |")
    out.append(f"| System prompt + 工具 + MCP（残差） | ~{fmt(residual)} | {pct(residual, denom):.1f}% |")
    if window:
        out.append(f"| 剩余空间 | {fmt(max(0, window - window_used))} | {pct(max(0, window - window_used), denom):.1f}% |")
    out.append("")
    compact_note = (f"已按末次 /compact 会话延续标记截断（仅统计压缩后 {len(tail)} 条历史）；"
                    if cut >= 0 else
                    f"未检测到 /compact 标记，估算覆盖全量 {len(tail)} 条历史（若发生过压缩会偏高）；")
    if over_est:
        compact_note += f"⚠️ 消息估算（~{fmt(msgs_est)}）高于窗口占用（{fmt(window_used)}）——估算偏高或上下文经过裁剪，残差按 0 计，请以 /context 为准。"
    out.append(f"> {compact_note}")
    out.append("")

    out.append("消息体量分布（全量 transcript 估算，仅结构参考）：")
    out.append("")
    out.append("| 角色 | 体量估算 |")
    out.append("|------|---------:|")
    for role in sorted(sizes, key=sizes.get, reverse=True)[:top_n]:
        out.append(f"| {role} | ~{fmt(sizes[role])} |")
    out.append("")
    out.append("---")
    out.append("以下由代理基于以上数据续写：**原因分析**（聚焦体检 ❌/⚠️ 项）与**优化建议**（逐条对应异常项；"
               "用户若粘贴 /context 输出，可替换估算值给出精确逐项判定）。")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Token 消耗统计分析（token-usage-analysis 技能脚本）")
    ap.add_argument("--source", choices=["zcode", "claude"], default="zcode",
                    help="数据源：zcode rollout 日志（默认）/ claude transcript")
    ap.add_argument("--session", help="ZCode 会话 ID（如 sess_xxx；缺省自动取最新主会话）")
    ap.add_argument("--file", help="直接指定 ZCode rollout jsonl 路径")
    ap.add_argument("--transcript", help="直接指定 Claude transcript jsonl 路径")
    ap.add_argument("--window", type=int, help="上下文窗口大小（token），缺省按模型映射或省略")
    ap.add_argument("--top", type=int, default=8, help="Top-N 最大消息条数（默认 8）")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    if args.source == "claude":
        path, how = resolve_claude_transcript(args)
        print(render_claude_report(path, args.top, how, args.window))
    else:
        path, how = resolve_zcode_file(args)
        print(render_zcode_report(path, how, args.top, args.window))


if __name__ == "__main__":
    main()
