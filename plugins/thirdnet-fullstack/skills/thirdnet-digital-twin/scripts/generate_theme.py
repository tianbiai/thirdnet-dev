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
  python generate_theme.py realistic --out src/styles/tokens.css
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


# v2.5 (B3)：单品牌色 → 协调强调色族（HSL 派生）。收口 spec.tokens 散落 hex 漂移——
# 换肤只需给一个品牌色，脚本派生整套，2D/3D 都吃这套色。
def _hex_to_rgb(h: str):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def _rgb_to_hsl(r, g, b):
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return (0.0, 0.0, l)
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        h = ((g - b) / d) % 6
    elif mx == g:
        h = (b - r) / d + 2
    else:
        h = (r - g) / d + 4
    return (h * 60, s, l)


def _hsl_to_hex(h, s, l):
    c = (1 - abs(2 * l - 1)) * s
    hp = (h % 360) / 60
    x = c * (1 - abs(hp % 2 - 1))
    if hp < 1:
        r1, g1, b1 = c, x, 0
    elif hp < 2:
        r1, g1, b1 = x, c, 0
    elif hp < 3:
        r1, g1, b1 = 0, c, x
    elif hp < 4:
        r1, g1, b1 = 0, x, c
    elif hp < 5:
        r1, g1, b1 = x, 0, c
    else:
        r1, g1, b1 = c, 0, x
    m = l - c / 2
    return '#' + ''.join(f'{round(max(0, min(1, v)) * 255):02x}' for v in (r1 + m, g1 + m, b1 + m))


def _apply_brand(tokens: dict, brand_hex: str) -> dict:
    """从单一品牌色按 HSL 派生强调色族（cyan 族 + blue/bright-cyan/panel-stroke + ui.glowColor）。
    中性色（文字/底色）不动以保证可读性。非法色则原样返回。"""
    try:
        r, g, b = _hex_to_rgb(brand_hex)
        h, s, l = _rgb_to_hsl(r, g, b)
    except Exception:
        print(f"warn: --brand '{brand_hex}' 非合法 #rrggbb，跳过品牌派生", file=sys.stderr)
        return tokens
    pal = tokens.setdefault('palette', {})
    pal['cyan'] = brand_hex
    pal['cyan-bright'] = _hsl_to_hex(h, s, min(0.85, l + 0.12))
    pal['cyan-dim'] = _hsl_to_hex(h, s * 0.6, max(0.2, l - 0.15))
    acc = tokens.setdefault('accents', {})
    acc['blue'] = brand_hex
    acc['bright-cyan'] = pal['cyan-bright']
    acc['panel-stroke'] = brand_hex
    ui = tokens.setdefault('ui', {})
    ui['glowColor'] = brand_hex
    return tokens


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
            if top2 in _PX_KEYS:
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
    p.add_argument("style", nargs="?", help="风格名（cyber/realistic/night-realistic）")
    p.add_argument("--tokens", help="直接指定 token JSON 路径（优先于 style）")
    p.add_argument("--out", default="src/styles/tokens.css", help="输出路径（默认 src/styles/tokens.css；Windows 上务必写文件不要 --stdout）")
    p.add_argument("--check", metavar="EXISTING", help="校验已有 tokens.css 是否与当前 token 一致（不一致退出码 1）")
    p.add_argument("--brand", metavar="HEX", help="v2.5 品牌色 #rrggbb——按 HSL 派生协调强调色族（收口散落 hex 漂移）；配合 --save-json 写回派生 token 驱动 3D")
    p.add_argument("--save-json", metavar="PATH", help="v2.5 把（含 --brand 派生的）token JSON 写到此路径，供 theme.ts 导入驱动 3D 侧")
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

    # v2.5：单品牌色派生（收口散落 hex）。--save-json 把派生 token 写回，供 theme.ts 驱动 3D。
    if args.brand:
        tokens = _apply_brand(tokens, args.brand)
        if args.save_json:
            save_path = Path(args.save_json)
            save_path.parent.mkdir(parents=True, exist_ok=True)
            save_path.write_text(json.dumps(tokens, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"OK: 品牌派生 token 已写入 {save_path}（驱动 3D 侧）", file=sys.stderr)

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
