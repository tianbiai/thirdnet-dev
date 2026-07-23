#!/usr/bin/env python3
"""
layout_park.py — 园区楼栋自动布局（v2.1 新增）。

文字访谈模式下楼栋只有 w/d/floors、没有坐标；AI 摆坐标最常见的翻车是穿模/出界
（validate_spec.py v2.1 起会直接 FAIL）。本脚本用确定性的「行式流布局」把楼栋排进
boundary：按占地面积降序（车库入口标记最后）从左上开始逐行排布，行间/栋间间距 ≥ gap，
四周留 margin（避开 boundary 内圈的环路与人行道）。

规则（固化）：
- 排序：非车库按 w*d 降序，车库入口标记永远最后（通常贴下边缘）。
- 起点 (-bx+margin, -bz+margin)，一行放不下就换行；摆不下整个 boundary → 报错退出 1。
- 结果写回 spec（默认新文件 <spec>.layout.json，--in-place 原地覆盖）。
- 排完自检一遍间距/出界（与 validate_spec.py v2.1 同规则），不过则报错。
- v2.6：仅布局 buildings[]。顶层 garages[]（地下车库负层坑体）**不参与**自动重排——地下坑体
  一般整园范围或手摆，且与楼上楼栋不同 Y，XZ 重叠合法（整园大坑正常），故不进 XZ 不重叠约束。

Usage:
  python layout_park.py spec.json                    # → spec.layout.json
  python layout_park.py spec.json --in-place         # 原地覆盖
  python layout_park.py spec.json --gap 40 --margin 60

Exit codes: 0 = 成功, 1 = 摆不下/自检失败, 2 = 文件错误。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

MIN_GAP = 20  # 与 validate_spec.py v2.1 的 MIN_BUILDING_GAP 对齐


def layout(buildings: list[dict], bx: float, bz: float, gap: float, margin: float):
    # 拆分：有数值 w/d 的进入布局；缺的记录下来交调用方告警（勿静默丢——extract_pen.py 草稿的 w/d 为 null）
    placeable = []
    skipped: list = []
    for b in buildings:
        if all(isinstance(b.get(k), (int, float)) and not isinstance(b.get(k), bool) for k in ("w", "d")):
            placeable.append(b)
        else:
            skipped.append(b.get("id") or b.get("name") or "<未命名>")
    items = sorted(
        placeable,
        key=lambda b: (b.get("category") == "garage", -(b["w"] * b["d"])),
    )
    cursor_x = -bx + margin
    cursor_z = -bz + margin
    row_h = 0.0
    for b in items:
        w, d = b["w"], b["d"]
        if cursor_x + w > bx - margin:  # 本行放不下 → 换行
            cursor_x = -bx + margin
            cursor_z += row_h + gap
            row_h = 0.0
        if cursor_z + d > bz - margin:
            return None, skipped  # 整个园区摆不下
        b["x"] = round(cursor_x + w / 2)
        b["z"] = round(cursor_z + d / 2)
        cursor_x += w + gap
        row_h = max(row_h, d)
    return items, skipped


def self_check(buildings: list[dict], bx: float, bz: float) -> list[str]:
    """与 validate_spec.py v2.1 相同的出界/间距检查，用于布局后自检。"""
    errs = []
    boxes = []
    for b in buildings:
        if not all(isinstance(b.get(k), (int, float)) for k in ("w", "d", "x", "z")):
            continue
        hw, hd = b["w"] / 2, b["d"] / 2
        if abs(b["x"]) + hw > bx or abs(b["z"]) + hd > bz:
            errs.append(f"{b.get('id')}: 出界")
        boxes.append((b.get("id"), b["x"], b["z"], hw, hd))
    for a in range(len(boxes)):
        for c in range(a + 1, len(boxes)):
            la, xa, za, hwa, hda = boxes[a]
            lb, xb, zb, hwb, hdb = boxes[c]
            if abs(xa - xb) - (hwa + hwb) < MIN_GAP and abs(za - zb) - (hda + hdb) < MIN_GAP:
                errs.append(f"{la} 与 {lb}: 间距不足 {MIN_GAP}")
    return errs


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="园区楼栋自动行式布局（确定性、不重疅、不出界）。")
    p.add_argument("spec", help="spec.json（楼栋至少有 w/d；x/z 将被重算）")
    p.add_argument("--in-place", action="store_true", help="原地覆盖 spec.json（默认写 <spec>.layout.json）")
    p.add_argument("--gap", type=float, default=40, help="楼栋间最小间距（默认 40）")
    p.add_argument("--margin", type=float, default=60, help="距 boundary 边缘的最小留白（默认 60，避开环路）")
    args = p.parse_args(argv)

    spec_path = Path(args.spec)
    if not spec_path.is_file():
        print(f"error: file not found: {spec_path}", file=sys.stderr)
        return 2
    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"error: invalid JSON: {e}", file=sys.stderr)
        return 2

    buildings = spec.get("buildings")
    if not isinstance(buildings, list) or not buildings:
        print("error: spec.buildings 为空", file=sys.stderr)
        return 1

    bnd = spec.get("boundary") or {}
    bx = bnd.get("x") if isinstance(bnd.get("x"), (int, float)) else 360
    bz = bnd.get("z") if isinstance(bnd.get("z"), (int, float)) else 220

    placed, skipped = layout(buildings, bx, bz, args.gap, args.margin)
    if skipped:
        print(
            f"warning: {len(skipped)} 栋楼缺数值 w/d，已跳过布局（先填 w/d 再跑本脚本；extract_pen.py 草稿的 w/d 为 null，属预期）: "
            + ", ".join(str(s) for s in skipped),
            file=sys.stderr,
        )
    if placed is None:
        print(
            f"error: 在 boundary {{{bx}, {bz}}} 内按 gap={args.gap}/margin={args.margin} 摆不下这些楼栋——"
            f"减小 gap/margin、缩小楼栋尺寸或扩大 boundary",
            file=sys.stderr,
        )
        return 1

    errs = self_check(placed, bx, bz)
    if errs:
        for e in errs:
            print(f"error: 布局自检失败: {e}", file=sys.stderr)
        return 1

    out_path = spec_path if args.in_place else spec_path.with_suffix(".layout.json")
    out_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = ", ".join(f"{b.get('id')}@({b['x']},{b['z']})" for b in placed)
    print(f"OK: 已布局 {len(placed)} 栋楼 → {out_path}")
    print(f"OK: {summary}")
    print("OK: 下一步运行 python scripts/validate_spec.py 复核")
    return 0


if __name__ == "__main__":
    sys.exit(main())
