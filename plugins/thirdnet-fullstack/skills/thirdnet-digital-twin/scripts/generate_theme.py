#!/usr/bin/env python3
"""
generate_theme.py — 从 assets/themes/<style>.tokens.json 确定性派生 src/styles/tokens.css。

为什么要有这个脚本（v2.1 新增）：
v1.x/v2.0 里「token JSON → SCSS 变量 / :root CSS 变量 / theme.ts」这一步由生成器手工完成，
实测会漂移——漏派生新块、键名打错、单位（px vs 无单位）不一致。本脚本把派生规则固化：
token JSON 是唯一事实来源，CSS 变量是它的机械投影，生成器跑脚本即可，不再手工翻译。

派生规则（固化，不要临场改）：
- 展平整个 token 树（跳过 `_` 前缀的注释键、null、布尔），生成 `:root { --twin-<块>-<键>: 值; }`。
- 键名转 kebab-case：嵌套路径用 `-` 连接（如 `accents.panel-stroke` → `--twin-accents-panel-stroke`）。
- 单位规则：ui.panelBlur / ui.panelRadius / ui.borderWidth → px；其余数值无单位；字符串原样。
- 颜色/字体字符串原样输出。

Usage:
  python generate_theme.py cyber                          # 读 assets/themes/cyber.tokens.json
  python generate_theme.py holographic --out src/styles/tokens.css
  python generate_theme.py --tokens path/to/tokens.json --out tokens.css
  python generate_theme.py cyber --check src/styles/tokens.css   # 校验现有文件是否最新（CI 用）

Exit codes: 0 = 成功/最新, 1 = --check 不一致或用法错误, 2 = 文件错误。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_THEME_DIR = Path(__file__).resolve().parent.parent / "assets" / "themes"

# 需要补 px 单位的数值键（固化——其它数值一律无单位）
_PX_KEYS = {("ui", "panelBlur"), ("ui", "panelRadius"), ("ui", "borderWidth")}

_HEADER = """/* ==========================================================================
   tokens.css — 由 scripts/generate_theme.py 从 assets/themes/{style}.tokens.json 生成。
   ⚠️ 不要手工编辑本文件——改色请改 token JSON 后重跑脚本（单一事实来源）。
   所有 2D 组件（assets/components/）只消费这里的 var(--twin-*)，不写 hex 字面量。
   ========================================================================== */
"""


def _kebab(key: str) -> str:
    """camelCase / 已有连字符 → kebab-case。"""
    return re.sub(r"(?<!^)(?=[A-Z])", "-", key).lower()


def _flatten(node, path, out):
    """递归展平 token 树到 [(css_var_name, value)]。跳过注释键 / null / 布尔。"""
    if not isinstance(node, dict):
        return
    for k, v in node.items():
        if k.startswith("_") or v is None or isinstance(v, bool):
            continue
        p = path + (k,)
        if isinstance(v, dict):
            _flatten(v, p, out)
        elif isinstance(v, (int, float)):
            name = "--twin-" + "-".join(_kebab(x) for x in p)
            top2 = (p[0], p[-1])
            if top2 in _PX_KEYS or (p[0] == "ui" and p[-1] in {"panelBlur", "panelRadius", "borderWidth"}):
                out.append((name, f"{v}px"))
            else:
                out.append((name, f"{v:g}"))
        elif isinstance(v, str):
            name = "--twin-" + "-".join(_kebab(x) for x in p)
            out.append((name, v))


def render(tokens: dict, style: str) -> str:
    flat: list[tuple[str, str]] = []
    _flatten(tokens, (), flat)
    lines = [_HEADER.replace("{style}", style), ":root {"]
    for name, value in flat:
        lines.append(f"  {name}: {value};")
    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="从主题 token JSON 确定性生成 tokens.css（--twin-* CSS 变量）。")
    p.add_argument("style", nargs="?", help="风格名（cyber/holographic/isometric/nebula）")
    p.add_argument("--tokens", help="直接指定 token JSON 路径（优先于 style）")
    p.add_argument("--out", default="src/styles/tokens.css", help="输出路径（默认 src/styles/tokens.css；Windows 上务必写文件不要 --stdout）")
    p.add_argument("--check", metavar="EXISTING", help="校验已有 tokens.css 是否与当前 token 一致（不一致退出码 1）")
    args = p.parse_args(argv)

    if args.tokens:
        token_path = Path(args.tokens)
        style = token_path.name.replace(".tokens.json", "")
    elif args.style:
        style = args.style
        token_path = _THEME_DIR / f"{style}.tokens.json"
    else:
        print("error: 需要 style 参数或 --tokens 路径（--help 查看用法）", file=sys.stderr)
        return 1

    if not token_path.is_file():
        print(f"error: token 文件不存在: {token_path}", file=sys.stderr)
        return 2

    import json
    try:
        tokens = json.loads(token_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"error: token JSON 解析失败: {e}", file=sys.stderr)
        return 2

    css = render(tokens, style)

    if args.check:
        existing = Path(args.check)
        if not existing.is_file():
            print(f"FAIL: {existing} 不存在——需要先运行 generate_theme.py 生成")
            return 1
        if existing.read_text(encoding="utf-8") != css:
            print(f"FAIL: {existing} 与 {token_path.name} 不一致——重跑: python scripts/generate_theme.py {style} --out {existing}")
            return 1
        print(f"OK: {existing} 与 {token_path.name} 一致")
        return 0

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(css, encoding="utf-8")
    n_vars = css.count("--twin-")
    print(f"OK: 已从 {token_path.name} 生成 {out_path}（{n_vars} 个 --twin-* 变量）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
