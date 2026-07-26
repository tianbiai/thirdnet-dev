#!/usr/bin/env python3
"""
extract_pen.py — extract a Park Spec DRAFT from a Pencil .pen design source.

The .pen in this project is UTF-8 JSON (see the repo's CLAUDE.md extraction
pattern). This script automates the tedious parts of going from design → spec:
  - design tokens (the `variables` block)               → spec.tokens
  - the grid shader's uniform overrides                 → spec.shaders.grid
  - building headers like "主楼 10F · 12单位"            → spec.buildings[*].{name,floors,units}
  - the dashboard title "XX园区 智慧运行驾驶舱"           → spec.title

(v1.3: it no longer extracts garage occupancy "空位 96 / 320" — the garage is
now just a category:'garage' entrance marker and shows no numbers. POI nodes
matching a `POI_*` / `兴趣点_*` naming convention are emitted as a `pois` draft
with null coordinates for the caller to fill in, mirroring the building strategy.)

It does NOT try to parse the isometric SVG path geometry — footprint sizes and
world positions can't be reliably recovered from iso paths. Those are emitted
as null and must be filled in by looking at the Scene (pencil MCP screenshot,
or the Scene frame's absolutely-positioned children). The emitted `notes`
field says so.

If json.load fails (the .pen is genuinely encrypted/binary in some setups),
the script prints a clear message directing you to the pencil MCP tools
(batch_get on the Scene frame) instead.

Usage:
  python extract_pen.py <path-to-file.pen> [--out spec.json]
  python extract_pen.py <path-to-file.pen> --stdout
  python extract_pen.py --help

Output is always UTF-8. On Windows, prefer --out (writing to a file you then
Read back) over --stdout to avoid console mojibake on Chinese labels.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
from pathlib import Path

# Text patterns used to pull structured data out of free-form text nodes.
# v1.8: multi-pattern — a single fixed regex silently emitted 0 buildings for any
# header/title phrasing variant. These try a set of shapes and pick the first match.
HEADER_PATTERNS = [
    re.compile(r"^\s*(.+?)\s+(\d+)\s*F\s*[·•·]\s*(\d+)\s*(?:单位|户|units?)\s*$", re.IGNORECASE),
    re.compile(r"^\s*(.+?)\s+(\d+)\s*(?:层|F)\s*[·•·/]\s*(\d+)\s*(?:单位|户)\s*$"),
    re.compile(r"^\s*(.+?)\s+(\d+)\s*F\s*[·•·]\s*(\d+)\s*$"),  # name + floors + units, no unit word
    re.compile(r"^\s*(.+?)\s+(\d+)\s*(?:层|F)\s*$", re.IGNORECASE),  # name + floors only (units → null)
]
TITLE_PATTERNS = [
    re.compile(r"(.+?)智慧运行驾驶舱"),
    re.compile(r"(.+?)(?:数字孪生)?驾驶舱"),
    re.compile(r"(.+?)(?:园区|社区)(?:大屏|运营中心|驾驶舱)"),
]
# v1.8: broader category label map — covers common alternatives (写字楼/商办/工业 etc.
# all map to 'building'; only 地下车库/车库/停车场入口 map to 'garage').
CATEGORY_LABELS = {
    "楼幢": "building", "楼栋": "building", "楼宇": "building",
    "写字楼": "building", "办公楼": "building", "商办": "building", "工业": "building",
    "地下车库": "garage", "车库": "garage", "地下停车场": "garage",
}
# v1.3: POI nodes are recognised by name prefix; type guessed from keywords.
POI_PREFIXES = ("POI_", "兴趣点_", "点位_")
POI_TYPE_KEYWORDS = {
    "entrance": ("入口", "进门", "大门"),
    "exit": ("出口", "出门"),
    "camera": ("监控", "摄像", "探头"),
    "gate": ("闸机", "道闸"),
    "service": ("服务", "物业", "客服"),
    "landmark": ("地标", "景观", "雕塑"),
    "parking": ("停车", "车位"),
}


def match_header(content):
    """v1.8: try every header shape; return (name, floors, units|None) or None."""
    for pat in HEADER_PATTERNS:
        m = pat.match(content)
        if m:
            name = m.group(1).strip()
            floors = int(m.group(2))
            units = int(m.group(3)) if m.lastindex >= 3 else None
            return name, floors, units
    return None


def match_title(content):
    """v1.8: try every title shape; return the stripped title or None."""
    for pat in TITLE_PATTERNS:
        m = pat.search(content)
        if m:
            return content.strip()
    return None


def walk(node, path="root"):
    """Yield (path, node) for every node in the tree, depth-first."""
    yield path, node
    children = node.get("children") or []
    for i, child in enumerate(children):
        yield from walk(child, f"{path}[{i}]")


def collect_text(root):
    out = []
    for path, node in walk(root):
        if node.get("type") == "text" and node.get("content"):
            out.append({"path": path, "name": node.get("name", ""), "content": node["content"]})
    return out


def collect_shader_fills(root):
    """Find every shader fill and its uniform overrides, with the owning node's name."""
    out = []
    for path, node in walk(root):
        fills = node.get("fill")
        if not isinstance(fills, list):
            fills = [fills] if fills else []
        for f in fills:
            if isinstance(f, dict) and f.get("type") == "shader":
                out.append(
                    {
                        "path": path,
                        "node": node.get("name", ""),
                        "url": f.get("url"),
                        "uniforms": f.get("uniforms", {}),
                    }
                )
    return out


def variables_to_tokens(variables):
    """Flatten the .pen variables block into a {name: value} color map."""
    tokens = {}
    for name, defn in (variables or {}).items():
        if not isinstance(defn, dict):
            continue
        if defn.get("type") == "color":
            val = defn.get("value")
            # themed values come as a list of {value, theme}; take the first
            if isinstance(val, list) and val:
                val = val[0].get("value")
            if isinstance(val, str):
                tokens[name] = val
    return tokens


def build_draft(pen):
    variables = pen.get("variables", {})
    texts = collect_text(pen)
    shaders = collect_shader_fills(pen)

    # Title
    title = None
    for t in texts:
        if t["name"] == "Title" or "驾驶舱" in t["content"] or "大屏" in t["content"]:
            mt = match_title(t["content"])
            if mt:
                title = mt
                break
        if t["name"] == "Title":
            title = t["content"].strip()
            break

    # Buildings from header text — v1.8 multi-pattern (handles N层/N单位/N户/N units/楼层 variants)
    buildings = []
    seen = set()
    for t in texts:
        mh = match_header(t["content"])
        if mh:
            name, floors, units = mh
            if name in seen:
                continue
            seen.add(name)
            entry = {
                "id": None,  # caller assigns a slug
                "name": name,
                "category": "building",  # caller marks garage as needed
                "floors": floors,
                "w": None,
                "d": None,
                "x": None,
                "z": None,
                "header": t["content"].strip(),
            }
            if units is not None:
                entry["units"] = units  # only present when the header carried a unit count
            buildings.append(entry)

    # v1.3: POI nodes by naming convention (POI_* / 兴趣点_* / 点位_*).
    # Coordinates stay null — caller fills them by inspecting the Scene, same
    # strategy as buildings. Type is guessed from label keywords, falling back
    # to 'custom'.
    pois = []
    seen_poi = set()
    for t in texts:
        name = (t.get("name") or "")
        content = (t.get("content") or "").strip()
        key = name + "|" + content
        if not any(name.startswith(p) or content.startswith(p) for p in POI_PREFIXES):
            continue
        if key in seen_poi:
            continue
        seen_poi.add(key)
        label = content or name
        ptype = "custom"
        for ptype_key, kws in POI_TYPE_KEYWORDS.items():
            if any(kw in label for kw in kws):
                ptype = ptype_key
                break
        pois.append(
            {
                "id": None,                # caller assigns a slug
                "type": ptype,
                "label": label,
                "x": None,
                "z": None,
            }
        )

    # Grid shader uniforms: pick the .pen 内嵌的地面 shader fill（其 url 以 grid.glsl
    # 结尾——这是设计稿内嵌的 shader 文件名，非随技能发布的 assets/gridGround.glsl）。
    grid_uniforms = {}
    for s in shaders:
        if s["url"] and s["url"].endswith("grid.glsl"):
            grid_uniforms = s["uniforms"]
            break

    # Legend categories present? v1.8: emit {label, category} objects (spec schema),
    # not bare strings, so the legend is generator-ready.
    contents = {t["content"].strip() for t in texts}
    legend = [
        {"label": label, "category": cat}
        for label, cat in CATEGORY_LABELS.items()
        if label in contents
    ]

    draft = {
        "title": title,
        "style": "cyber",
        "tokens": variables_to_tokens(variables),
        "shaders": {
            "grid": grid_uniforms if grid_uniforms else None,
        },
        "legend": legend,
        "buildings": buildings,
        "pois": pois,
        "notes": [
            "Auto-extracted DRAFT. Fill in per-building id/category/w/d/x/z by inspecting the Scene "
            "(pencil MCP get_screenshot on the Scene frame, or its absolutely-positioned children). "
            "When w/d/x/z are null, in skill step 3 use AskUserQuestion to have the user fill them "
            "visually from the screenshot — do NOT pass null geometry into validate_spec.py expecting it to pass.",
            "Ensure exactly one garage building (category 'garage') if 地下车库 is in the legend; "
            "v1.3 renders it as a half-pyramid entrance + P sign (no occupancy numbers). "
            "category default is 'building' for every header — flip the garage entry by hand.",
            "Fill in per-POI id/x/z (and optionally buildingId/floorIndex/tooltip) for each entry in "
            "`pois`; remove the array or leave [] if the park has no POIs.",
            "If a building's floors/units header was missing (no recognized pattern), add floors manually "
            "— validate_spec.py now FAILS on a category:'building' entry without floors (v1.8).",
            "style defaults to 'cyber'. If the .pen clearly implies a different look, change style "
            "to one of: cyber | isometric | realistic | night-realistic (see "
            "references/styles.md) and confirm with the user.",
            "v2.0 写实旋钮（material/bloom/ao/reflection/fog/sun）随风格在 assets/themes/<style>.tokens.json "
            "的 realism 块给出默认值，一般无需改。如需微调写实观感（玻璃镜面感、夜景辉光强度、雾、太阳角度），"
            "改对应风格的 realism 块即可——不要把数值硬编码进 ParkScene.ts（见 references/park-scene-impl.md）。",
        ],
    }
    return draft


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Extract a Park Spec draft from a Pencil .pen file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("pen", help="Path to the .pen design source")
    p.add_argument("--out", help="Write the draft spec JSON to this file (UTF-8)")
    p.add_argument("--stdout", action="store_true", help="Print the draft spec JSON to stdout")
    args = p.parse_args(argv)

    pen_path = Path(args.pen)
    if not pen_path.is_file():
        print(f"error: file not found: {pen_path}", file=sys.stderr)
        return 2

    raw = pen_path.read_bytes()
    try:
        pen = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        print(
            "error: this .pen could not be parsed as UTF-8 JSON "
            f"({type(e).__name__}: {e}).\n"
            "It may be an encrypted/binary .pen. Use the pencil MCP tools instead:\n"
            '  - get_editor_state(include_schema: true)\n'
            '  - batch_get(nodeIds: ["<Scene frame id>"], readDepth: 4)\n'
            "Then assemble the spec by hand from the returned node tree.",
            file=sys.stderr,
        )
        return 3

    draft = build_draft(pen)
    pretty = json.dumps(draft, ensure_ascii=False, indent=2)

    if args.out:
        Path(args.out).write_text(pretty, encoding="utf-8")
        # Also echo a short summary to stderr so the caller gets feedback without
        # having to Read the whole file (avoids Windows console mojibake).
        summary = io.StringIO()
        summary.write(f"wrote {args.out}\n")
        summary.write(f"  title: {draft['title']}\n")
        summary.write(f"  buildings: {len(draft['buildings'])}\n")
        summary.write(f"  pois: {len(draft['pois'])}\n")
        summary.write(f"  legend: {draft['legend']}\n")
        summary.write(f"  grid uniforms: {draft['shaders']['grid']}\n")
        sys.stderr.write(summary.getvalue())
    else:
        # Default: write to stdout (caller may redirect). Force UTF-8 on Windows.
        sys.stdout.buffer.write(pretty.encode("utf-8"))
        sys.stdout.buffer.write(b"\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
