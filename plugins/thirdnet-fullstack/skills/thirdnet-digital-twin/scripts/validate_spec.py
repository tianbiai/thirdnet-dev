#!/usr/bin/env python3
"""
validate_spec.py — validate a Park Spec JSON against the canonical schema.

The schema mirrors references/park-spec.md (and assets/spec.schema.json). This is a
structural + business-rule check (required fields present, types correct, category
values valid, coordinates in bounds, floors required for buildings, legend/switcher/
token cross-field consistency). Run it before handing a spec to the generator step
to fail fast on missing/invalid data.

v1.8: floors is now required for category='building' (was silently optional); NaN/Inf
rejected; legend category/color consistency, switcher id alignment, token override
key typos, and boundary shape are now checked. For IDE autocompletion / CI without
Python, point your editor at assets/spec.schema.json ($schema).

v1.9: theme-completeness check — warns if the resolved assets/themes/<style>.tokens.json
is missing the anti-black-screen blocks (scene background, lights.ambientFloor,
ground.texture), guarding incomplete themes from regressing to the "all black / no
ground texture" failure mode. These blocks live in the theme files (source of truth).

v2.1: layout geometry checks — building AABB out-of-bounds → FAIL; pairwise AABB
overlap / gap < 20 → FAIL; POI clearly outside the park boundary (> +20 tolerance)
→ FAIL (edge-hugging gates only WARN). Run scripts/layout_park.py to auto-relax a
failing layout into a non-overlapping one.

Usage:
  python validate_spec.py <spec.json>
  python validate_spec.py <spec.json> --quiet     # exit code only, no detail
  python validate_spec.py --help

Exit codes: 0 = valid, 1 = invalid (errors printed), 2 = usage / file error.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from functools import lru_cache
from pathlib import Path

try:
    import jsonschema  # type: ignore
    _HAVE_JSONSCHEMA = True
except ImportError:
    _HAVE_JSONSCHEMA = False

KNOWN_CATEGORIES = {"building", "garage"}
# v2.30：楼栋类型（building.type）——驱动类型化外观（窗光模式/立面基色/体块形态）。
VALID_BUILDING_TYPES = {"office", "residential", "commercial"}
# v2.5：恢复 realistic / night-realistic 两写实风格（激活 envMap/GTAO/反射/软阴影/雾）。
VALID_STYLES = {"cyber", "realistic", "night-realistic"}
VALID_ROAD_SHAPES = {"loop", "cross", "grid", "none"}
VALID_TREE_DENSITY = {"sparse", "normal", "lush"}
VALID_FACING = {"N", "S", "E", "W"}

# v2.5 (B3): spec.tokens 覆盖收口——只允许改这几个语义路径（品牌色/类别色/发光/天空底色）。
# 其余散落 hex 覆盖会漂移（AI 每次取色不同）。换肤优先改 spec.style 或给 generate_theme.py
# --brand 一个品牌色（脚本按 HSL 派生整套协调配色），而非在 spec.tokens 里散落 hex。
ALLOWED_TOKEN_OVERRIDE_PATHS = {
    "palette.cyan", "palette.cyan-bright", "palette.cyan-dim",
    "palette.magenta", "palette.magenta-bright", "palette.mint",
    "ui.glowColor", "ui.glowStrength", "ui.panelOpacity",
    "scene.bgTop", "scene.bgBottom",
}
# v2.7：开放类别枚举后，任意 category.<cat> 覆盖都允许（自定义类别 factory/warehouse… 靠此定色）。
# v2.30：开放 buildingType.（楼栋类型基色）与 windows.（类型化窗参 types.<type> 覆盖）——
# 集成方按类型调外观最自然的通道；运行时四级合并对未知键容忍，写错形状不 FAIL。
ALLOWED_TOKEN_PREFIXES = ("category.", "buildingType.", "windows.")
VALID_POI_TYPES = {
    "entrance", "exit", "camera", "gate", "service", "landmark", "parking", "custom"
}
DEFAULT_BOUND = 400  # |x|,|z| within ±400 world units (park boundary)

# v1.3: garage buildings render as a half-pyramid entrance marker, not a
# floors-building, so `floors` is optional for them.
REQUIRED_BUILDING = ["id", "name", "category", "w", "d", "x", "z"]

_THEME_DIR = Path(__file__).resolve().parent.parent / "assets" / "themes"
_TOKENS_SCHEMA = Path(__file__).resolve().parent.parent / "assets" / "tokens.schema.json"


@lru_cache(maxsize=None)
def _validate_tokens_schema(style):
    """v2.0: validate the chosen theme token file against assets/tokens.schema.json.

    Returns (errors, warnings). If jsonschema is installed, full structural validation
    (required blocks/keys, types, ranges). If not, a manual required-keys check on the
    v2.0 realism block + v1.9 anti-black-screen blocks. Best-effort — never fatal.
    """
    errs: list[str] = []
    warns: list[str] = []
    path = _THEME_DIR / f"{style}.tokens.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return errs, warns  # _load_style_token_keys already covers missing-file WARN elsewhere

    if _HAVE_JSONSCHEMA:
        try:
            schema = json.loads(_TOKENS_SCHEMA.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            schema = None
        if schema is not None:
            try:
                jsonschema.validate(data, schema)
            except jsonschema.ValidationError as e:
                loc = ".".join(str(p) for p in e.absolute_path) or "<root>"
                errs.append(
                    f"theme {style}: tokens.schema.json 违反 @ {loc}: {e.message} "
                    f"(assets/themes/{style}.tokens.json)"
                )
            return errs, warns

    # 降级：无 jsonschema 时手动检查关键块（v1.9 防黑屏 + v2.0 realism + v2.1 sky/environment/ui）。
    for blk in ("scene", "palette", "category", "building", "lights", "environment", "realism", "ui"):
        if blk not in data:
            errs.append(f"theme {style}: assets/themes/{style}.tokens.json 缺必需块 '{blk}'")
    sc = data.get("scene")
    if isinstance(sc, dict) and not isinstance(sc.get("sky"), dict):
        errs.append(f"theme {style}: scene.sky 缺失（v2.1 程序化天空开关 clouds/stars/moon）")
    r = data.get("realism")
    if isinstance(r, dict):
        for key in ("material", "bloom", "ao", "reflection", "fog", "sun"):
            if key not in r:
                errs.append(f"theme {style}: realism.{key} 缺失（写实增强旋钮不完整）")
    env = data.get("environment")
    if isinstance(env, dict):
        for key in ("roadMarking", "water", "rooftop"):
            if key not in env:
                errs.append(f"theme {style}: environment.{key} 缺失（v2.1 标线/水景/楼顶设备色）")
    ui = data.get("ui")
    if isinstance(ui, dict):
        for key in ("panelOpacity", "panelBlur", "panelRadius", "glowStrength",
                    "glowColor", "borderWidth", "labelBg", "labelText", "switcherStyle"):
            if key not in ui:
                errs.append(f"theme {style}: ui.{key} 缺失（v2.1 2D 组件观感旋钮不完整）")
    return errs, warns


@lru_cache(maxsize=None)
def _load_style_token_keys(style):
    """v1.8: load assets/themes/<style>.tokens.json (flattened one level) for
    cross-field checks (token override typos, legend color consistency). Returns
    None if the file can't be loaded (checks are best-effort, never fatal)."""
    path = _THEME_DIR / f"{style}.tokens.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    # Flatten one level: top-level keys + each block's keys, plus nested poi.status.
    flat = {}
    for k, v in data.items():
        flat[k] = v
        if isinstance(v, dict):
            for kk, vv in v.items():
                flat[kk] = vv
                if isinstance(vv, dict):  # e.g. poi.status
                    for kkk, vvv in vv.items():
                        flat[kkk] = vvv
    return flat


def is_number(v):
    # v1.8: reject NaN/Inf — they pass isinstance(float) but are never valid dimensions.
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def validate(spec):
    errors = []
    warnings = []

    if not isinstance(spec, dict):
        return ["spec root must be a JSON object"], []

    if not spec.get("title"):
        errors.append("title: missing or empty (e.g. 'XX园区 智慧运行驾驶舱')")

    style = spec.get("style", "cyber")
    if style not in VALID_STYLES:
        errors.append(
            f"style: '{style}' not in {sorted(VALID_STYLES)} (defaults to 'cyber' if omitted)"
        )

    # v2.0: token 结构校验（assets/tokens.schema.json）—— FAIL 级结构错误（缺块/类型错）。
    # v1.9: theme-completeness WARN（防黑屏块缺失）。两者都 best-effort，不致命。
    schema_errs, _ = _validate_tokens_schema(style)
    errors.extend(schema_errs)

    style_tokens = _load_style_token_keys(style)
    if style_tokens is not None:
        missing = []
        if "scene" not in style_tokens:
            missing.append("scene (bgTop/bgBottom → scene.background, §2)")
        if "ambientFloor" not in style_tokens:
            missing.append("lights.ambientFloor (环境光下限, §2)")
        if "ground" not in style_tokens:
            missing.append("ground.texture (程序化地面纹理, §3.1)")
        if missing:
            warnings.append(
                f"theme {style}: assets/themes/{style}.tokens.json missing v1.9 block(s): "
                f"{'; '.join(missing)} — 场景可能整屏发黑/地面无纹理"
            )

    buildings = spec.get("buildings")
    if not isinstance(buildings, list) or not buildings:
        errors.append("buildings: must be a non-empty array")
        buildings = []

    ids = set()
    for i, b in enumerate(buildings):
        ctx = f"buildings[{i}]"
        if not isinstance(b, dict):
            errors.append(f"{ctx}: not an object")
            continue
        for key in REQUIRED_BUILDING:
            if key not in b or b[key] is None:
                # floors is optional for garage-category buildings (v1.3 entrance marker)
                if key == "floors" and b.get("category") == "garage":
                    continue
                errors.append(f"{ctx}.{key}: missing")
        bid = b.get("id")
        if bid in ids:
            errors.append(f"{ctx}.id: duplicate id '{bid}'")
        if bid is not None:
            ids.add(bid)
        cat = b.get("category")
        if cat is not None and cat not in KNOWN_CATEGORIES:
            warnings.append(
                f"{ctx}.category: '{cat}' 为自定义类别——按挤出楼栋渲染，配色取 tokens.category.{cat}"
                f"（缺省回退 category.building，可用 spec.tokens 的 category.{cat} 或 legend.color 定色）"
            )
        # v2.30：building.type 枚举校验（缺省=通用楼；jsonschema 缺失时的手工兜底）
        btype = b.get("type")
        if btype is not None and btype not in VALID_BUILDING_TYPES:
            errors.append(f"{ctx}.type: '{btype}' not in {sorted(VALID_BUILDING_TYPES)}")
        # v1.8 (B1): `floors` is REQUIRED for non-garage buildings (positive number).
        # The legacy comment claimed this was enforced, but REQUIRED_BUILDING omitted it,
        # so a building-category entry without `floors` validated clean. Garage is exempt
        # (v1.3 renders it as a half-pyramid entrance marker, no floors).
        if cat != "garage":
            if "floors" not in b or b["floors"] is None:
                errors.append(f"{ctx}.floors: missing (required unless category='garage')")
            elif not is_number(b["floors"]) or b["floors"] <= 0:
                errors.append(f"{ctx}.floors: must be a positive number (unless category='garage')")
        facing = b.get("facing")
        if facing is not None and facing not in VALID_FACING:
            errors.append(f"{ctx}.facing: '{facing}' not in {sorted(VALID_FACING)}")
        for key in ("floors", "w", "d", "x", "z"):
            if key in b and b[key] is not None and not is_number(b[key]):
                errors.append(f"{ctx}.{key}: must be a number, got {type(b[key]).__name__}")
            if key in ("w", "d", "floors") and b.get(key) is not None and is_number(b[key]) and b[key] <= 0:
                errors.append(f"{ctx}.{key}: must be > 0")
        if is_number(b.get("x")) and abs(b["x"]) > DEFAULT_BOUND:
            warnings.append(f"{ctx}.x: {b['x']} outside ±{DEFAULT_BOUND} (check park boundary)")
        if is_number(b.get("z")) and abs(b["z"]) > DEFAULT_BOUND:
            warnings.append(f"{ctx}.z: {b['z']} outside ±{DEFAULT_BOUND} (check park boundary)")

    # v2.7：允许多个 category='garage' 地面入口标记（多入口物流园等场景）——renderer 通用遍历 buildings。

    # v2.1: 布局几何校验 —— 出界 FAIL + AABB 重叠/间距不足 FAIL。
    # AI 摆坐标最常见的翻车就是楼栋穿出园区边界或两栋穿模；这里在生成前直接 fail fast。
    # 规则：每栋楼（含车库入口标记）的 AABB 必须完整落在 boundary 内（默认 {x:360, z:220}）；
    # 任意两栋 AABB 之间净间距 ≥ MIN_BUILDING_GAP（道路/人行道最小宽度）。
    MIN_BUILDING_GAP = 20
    _bnd = spec.get("boundary")
    bnd_x = _bnd.get("x") if isinstance(_bnd, dict) and is_number(_bnd.get("x")) and _bnd["x"] > 0 else 360
    bnd_z = _bnd.get("z") if isinstance(_bnd, dict) and is_number(_bnd.get("z")) and _bnd["z"] > 0 else 220
    boxes = []  # (index, id, x, z, hw, hd) — hw/hd 为半宽/半深
    for i, b in enumerate(buildings):
        if not isinstance(b, dict):
            continue
        w, d, x, z = b.get("w"), b.get("d"), b.get("x"), b.get("z")
        if not all(is_number(v) for v in (w, d, x, z)):
            continue  # 缺数/非数值已在上面逐字段报过
        hw, hd = w / 2, d / 2
        label = b.get("id") or f"#{i}"
        if abs(x) + hw > bnd_x or abs(z) + hd > bnd_z:
            errors.append(
                f"buildings[{i}] ({label}): AABB 出界 — |x|+w/2={abs(x)+hw:.0f} vs boundary.x={bnd_x:.0f}, "
                f"|z|+d/2={abs(z)+hd:.0f} vs boundary.z={bnd_z:.0f}（楼栋须完整落在园区边界内）"
            )
        boxes.append((i, label, x, z, hw, hd))
    # v2.9: connects 白名单——声明物理连通的楼栋对（裙楼/连体楼）豁免 AABB 间距/重叠 FAIL，
    # 允许贴合或微重叠（引擎不消费 connects，仅校验语义）。
    connects_of = {}
    for b in buildings:
        if isinstance(b, dict):
            bid, cl = b.get("id"), b.get("connects")
            if bid and isinstance(cl, list):
                connects_of[bid] = {str(t) for t in cl if isinstance(t, str)}
    for a in range(len(boxes)):
        for c in range(a + 1, len(boxes)):
            i, la, xa, za, hwa, hda = boxes[a]
            j, lb, xb, zb, hwb, hdb = boxes[c]
            if lb in connects_of.get(la, set()) or la in connects_of.get(lb, set()):
                continue  # 声明连通（任一方向）→ 豁免间距 FAIL
            gap_x = abs(xa - xb) - (hwa + hwb)
            gap_z = abs(za - zb) - (hda + hdb)
            if gap_x < MIN_BUILDING_GAP and gap_z < MIN_BUILDING_GAP:
                errors.append(
                    f"buildings[{i}] ({la}) 与 buildings[{j}] ({lb}): AABB 间距不足/重叠 — "
                    f"净间距 x={gap_x:.0f}, z={gap_z:.0f}（要求两方向至少其一 ≥ {MIN_BUILDING_GAP}；"
                    f"若为裙楼/连体楼物理连通，用 buildings[].connects 声明豁免；或运行 scripts/layout_park.py 自动重排）"
                )

    # v1.3: top-level `garage` (capacity/empty/occupied) is deprecated — the garage
    # is now just a category:'garage' building rendered as an entrance marker.
    # Warn (don't fail) so old specs still pass; the generator ignores these numbers.
    if "garage" in spec:
        warnings.append(
            "garage: top-level field deprecated in v1.3 (地下车库 no longer shows "
            "occupancy). Use a category:'garage' building for the entrance marker; "
            "remove the `garage` block."
        )

    # v2.6 地下剖面坑体（garages[]，与 buildings[] 解耦）；v2.7 起 usage 区分用途。
    # 校验：id 唯一、level ≤-1 整数、w/d/deck_y >0（v2.11 起 deck_y<140 另出偏浅 WARN——坑顶贴近 Y=0 易被地面遮挡）；usage='parking'(缺省) 另校验 cols/rows>0、0≤occupied≤capacity；rooms 字段数值。
    # 坑体 AABB 不参与楼栋出界/重叠 FAIL（地下与楼上不同 Y，XZ 重叠合法；整园大坑正常），
    # 仅 |x|+w/2 或 |z|+d/2 超 boundary 时 WARN（提示核对）。
    garages = spec.get("garages", [])
    if garages is not None:
        if not isinstance(garages, list):
            errors.append("garages: must be an array")
            garages = []
        garage_ids = set()
        for i, g in enumerate(garages):
            if not isinstance(g, dict):
                errors.append(f"garages[{i}]: must be an object")
                continue
            gctx = f"garages[{i}]" + (f" ({g.get('id')})" if g.get("id") else "")
            gid = g.get("id")
            if not isinstance(gid, str) or not gid:
                errors.append(f"{gctx}.id: missing or not a non-empty string")
            elif gid in garage_ids:
                errors.append(f"{gctx}.id: duplicate id '{gid}'")
            else:
                garage_ids.add(gid)
            if not isinstance(g.get("name"), str) or not g.get("name"):
                errors.append(f"{gctx}.name: missing or not a non-empty string")
            lvl = g.get("level")
            if not isinstance(lvl, int) or isinstance(lvl, bool) or lvl > -1:
                errors.append(f"{gctx}.level: must be an integer ≤ -1 (got {lvl!r}; -1=B1, -2=B2)")
            for key in ("x", "z"):
                if key in g and g[key] is not None and not is_number(g[key]):
                    errors.append(f"{gctx}.{key}: must be a number")
            for key in ("w", "d", "deck_y"):
                if not is_number(g.get(key)):
                    errors.append(f"{gctx}.{key}: must be a number")
                elif g[key] <= 0:
                    errors.append(f"{gctx}.{key}: must be > 0")
            # v2.10：偏浅 WARN（非 FAIL）；v2.11 阈值 <160→<140（随推荐默认 200→140 下调）——deck_y<140 时坑顶贴近 Y=0 地面，地上/斜视视角易被不透明地面遮挡
            if is_number(g.get("deck_y")) and g["deck_y"] < 140:
                warnings.append(
                    f"{gctx}.deck_y: {g['deck_y']} 偏浅（< 140），地上/斜视视角易被 Y=0 地面遮挡，"
                    f"建议加深至 ≥ 140（B1 典型 140；B2 取更深绝对值如 280 以保证多层单调）。"
                )
            usage = g.get("usage", "parking")
            if usage == "parking":
                # 车位网格 + 占用仅 parking 必填；非 parking（商场/地铁/人防/车间…）可省
                for key in ("cols", "rows"):
                    v = g.get(key)
                    if not isinstance(v, int) or isinstance(v, bool) or v <= 0:
                        errors.append(f"{gctx}.{key}: must be a positive integer")
                cap = g.get("capacity")
                occ = g.get("occupied")
                if not is_number(cap) or cap < 0:
                    errors.append(f"{gctx}.capacity: must be a number ≥ 0")
                if not is_number(occ) or occ < 0:
                    errors.append(f"{gctx}.occupied: must be a number ≥ 0")
                elif is_number(cap) and occ > cap:
                    errors.append(f"{gctx}.occupied: {occ} > capacity {cap}")
            rooms = g.get("rooms")
            if rooms is not None:
                if not isinstance(rooms, list):
                    errors.append(f"{gctx}.rooms: must be an array")
                else:
                    for ri, rm in enumerate(rooms):
                        if not isinstance(rm, dict):
                            errors.append(f"{gctx}.rooms[{ri}]: must be an object")
                            continue
                        if not isinstance(rm.get("name"), str) or not rm.get("name"):
                            errors.append(f"{gctx}.rooms[{ri}].name: missing or not a non-empty string")
                        for rk in ("x", "z", "w", "d"):
                            rv = rm.get(rk)
                            if not is_number(rv):
                                errors.append(f"{gctx}.rooms[{ri}].{rk}: must be a number")
                            elif rk in ("w", "d") and rv <= 0:
                                errors.append(f"{gctx}.rooms[{ri}].{rk}: must be > 0")
            # 坑体出界 WARN（非 FAIL——整园大坑可能贴边；地下与楼上不同 Y，不参与重叠 FAIL）
            if all(is_number(g.get(k)) for k in ("x", "w", "z", "d")):
                if abs(g["x"]) + g["w"] / 2 > bnd_x or abs(g["z"]) + g["d"] / 2 > bnd_z:
                    warnings.append(
                        f"{gctx}: 坑体 AABB 超出 boundary — |x|+w/2={abs(g['x'])+g['w']/2:.0f} vs {bnd_x:.0f}, "
                        f"|z|+d/2={abs(g['z'])+g['d']/2:.0f} vs {bnd_z:.0f}（地下坑体可与楼上重叠，整园大坑正常；请核对是否预期）"
                    )

    # v1.3: POIs (interest points). Optional; absent = generate none.
    building_ids = {
        b.get("id") for b in buildings
        if isinstance(b, dict) and b.get("id") is not None
    }
    garage_ids = {
        g.get("id") for g in (spec.get("garages") or [])
        if isinstance(g, dict) and g.get("id") is not None
    }
    pois = spec.get("pois", [])
    if pois is not None:
        if not isinstance(pois, list):
            errors.append("pois: must be an array")
            pois = []
        poi_ids = set()
        for i, p in enumerate(pois):
            pctx = f"pois[{i}]"
            if not isinstance(p, dict):
                errors.append(f"{pctx}: not an object")
                continue
            for key in ("id", "type", "label", "x", "z"):
                if key not in p or p[key] is None:
                    errors.append(f"{pctx}.{key}: missing")
            pid = p.get("id")
            if pid is not None:
                if pid in poi_ids:
                    errors.append(f"{pctx}.id: duplicate id '{pid}'")
                poi_ids.add(pid)
            ptype = p.get("type")
            if ptype is not None and ptype not in VALID_POI_TYPES:
                warnings.append(
                    f"{pctx}.type: '{ptype}' 为自定义类型——以通用圆点标记渲染，名称走 label/tooltip"
                )
            if "label" in p and p["label"] is not None and not str(p["label"]).strip():
                errors.append(f"{pctx}.label: must be a non-empty string")
            for key in ("x", "z", "y"):
                if key in p and p[key] is not None and not is_number(p[key]):
                    errors.append(f"{pctx}.{key}: must be a number, got {type(p[key]).__name__}")
            for key in ("x", "z"):
                if is_number(p.get(key)) and abs(p[key]) > DEFAULT_BOUND:
                    warnings.append(f"{pctx}.{key}: {p[key]} outside ±{DEFAULT_BOUND} (check park boundary)")
            # v2.1: POI 相对园区边界的定位校验 —— 明显越界（> boundary+20 容差）FAIL；
            # 贴边（越界 ≤20）仅 WARN（大门/闸机类 POI 贴在边界边缘属正常）。
            for key, bv in (("x", bnd_x), ("z", bnd_z)):
                if is_number(p.get(key)) and abs(p[key]) > bv + 20:
                    errors.append(
                        f"{pctx}.{key}: {p[key]} 超出园区边界 {bv:.0f}+20 容差（POI 须落在园区内或贴边）"
                    )
                elif is_number(p.get(key)) and abs(p[key]) > bv:
                    warnings.append(
                        f"{pctx}.{key}: {p[key]} 略出园区边界 {bv:.0f}（门口/闸机贴边属正常，确认后忽略）"
                    )
            bid = p.get("buildingId")
            if bid is not None and bid not in building_ids:
                errors.append(
                    f"{pctx}.buildingId: '{bid}' does not match any buildings[].id"
                )
            gid = p.get("garageId")
            if gid is not None and gid not in garage_ids:
                errors.append(
                    f"{pctx}.garageId: '{gid}' does not match any garages[].id"
                )
            fi = p.get("floorIndex")
            if fi is not None and (not isinstance(fi, int) or isinstance(fi, bool)):
                errors.append(f"{pctx}.floorIndex: must be an integer (negative = basement: -1=B1, -2=B2)")
            tt = p.get("tooltip")
            if tt is not None and not isinstance(tt, dict):
                errors.append(f"{pctx}.tooltip: must be an object")
            elif isinstance(tt, dict) and tt.get("meta") is not None:
                if not isinstance(tt["meta"], dict):
                    errors.append(f"{pctx}.tooltip.meta: must be an object (key→string)")

    tokens = spec.get("tokens")
    style = spec.get("style", "cyber")
    if not isinstance(tokens, dict) or not tokens:
        warnings.append(
            f"tokens: missing — the generator will fall back to assets/themes/{style}.tokens.json"
        )
    else:
        # v1.8 (B2): warn on override keys that don't match the chosen style's token file —
        # catches typos like "cyan-brigt" that would otherwise be silently ignored.
        style_tokens = _load_style_token_keys(style)
        if style_tokens is not None:
            unknown = [k for k in tokens.keys() if k not in style_tokens]
            if unknown:
                warnings.append(
                    f"tokens: override keys not found in assets/themes/{style}.tokens.json "
                    f"(likely typos, will be ignored): {sorted(unknown)}"
                )
        # v2.5 (B3): 覆盖收口——深展开 spec.tokens，只允许 ALLOWED_TOKEN_OVERRIDE_PATHS 内的
        # 叶子路径。超出即 WARN（散落 hex 易漂移；换肤请改 spec.style 或 generate_theme.py --brand）。
        leaves = []

        def _deep_leaves(node, prefix):
            if not isinstance(node, dict):
                if prefix:
                    leaves.append(prefix)
                return
            for k, v in node.items():
                if k.startswith("_"):
                    continue
                _deep_leaves(v, f"{prefix}.{k}" if prefix else k)

        _deep_leaves(tokens, "")
        off_allowlist = [
            p for p in leaves
            if p not in ALLOWED_TOKEN_OVERRIDE_PATHS
            and not any(p.startswith(prefix) for prefix in ALLOWED_TOKEN_PREFIXES)
        ]
        if off_allowlist:
            warnings.append(
                f"tokens: 覆盖路径超出收口白名单（换肤优先改 spec.style 或 generate_theme.py "
                f"--brand）：{sorted(off_allowlist)}"
            )

    # v1.8 (B2): legend cross-field checks — category ∈ known set; color matches token category.
    legend = spec.get("legend")
    if legend is not None:
        if not isinstance(legend, list):
            errors.append("legend: must be an array")
        else:
            style_tokens = _load_style_token_keys(style)
            cat_colors = (style_tokens or {}).get("category", {}) if isinstance(style_tokens, dict) else {}
            for i, e in enumerate(legend):
                if not isinstance(e, dict):
                    errors.append(f"legend[{i}]: must be an object {{label, category, color}}")
                    continue
                lcat = e.get("category")
                # v2.7：legend.category 开放（与 buildings.category 同步）——任意自定义类别允许。
                if lcat and isinstance(cat_colors, dict) and lcat in cat_colors:
                    if e.get("color") and e["color"].lower() != str(cat_colors[lcat]).lower():
                        warnings.append(
                            f"legend[{i}].color: '{e['color']}' != tokens.category.{lcat} "
                            f"('{cat_colors[lcat]}'); legend swatch will disagree with 3D color"
                        )

    # v1.8 (B2): switcher id alignment — when using object form {id,label?}, warn if an id
    # doesn't match any buildings[].id (string-form switcher is name-based and stays loose).
    switcher = spec.get("switcher")
    if isinstance(switcher, list):
        building_ids = {
            b.get("id") for b in buildings
            if isinstance(b, dict) and b.get("id") is not None
        }
        for i, s in enumerate(switcher):
            if isinstance(s, dict) and "id" in s and s["id"] not in building_ids:
                warnings.append(f"switcher[{i}].id: '{s['id']}' does not match any buildings[].id")

    # v1.8 (B2): boundary shape (positive numbers) if present.
    boundary = spec.get("boundary")
    if boundary is not None:
        if not isinstance(boundary, dict):
            errors.append("boundary: must be an object {x, z}")
        else:
            for key in ("x", "z"):
                bv = boundary.get(key)
                if bv is None or not is_number(bv) or bv <= 0:
                    errors.append(f"boundary.{key}: must be a positive number")

    # v1.2 environment block — optional; smart defaults apply when absent.
    env = spec.get("environment")
    if env is None:
        warnings.append(
            "environment: missing — the generator will use smart defaults "
            "(internal loop road + surface parking by building scale + normal greenery + "
            "surrounding roads/gate + street lamps). Ask the user about parking/greenery/"
            "surrounding roads to capture real conditions; see references/intake.md."
        )
    elif isinstance(env, dict):
        # all sub-fields are optional; validate only those present
        ir = env.get("internalRoads")
        if ir is not None and ir not in VALID_ROAD_SHAPES:
            errors.append(
                f"environment.internalRoads: '{ir}' not in {sorted(VALID_ROAD_SHAPES)}"
            )

        sp = env.get("surfaceParking")
        if sp is not None:
            if not isinstance(sp, dict):
                errors.append("environment.surfaceParking: must be an object {stalls, occupied?} or null")
            else:
                if not is_number(sp.get("stalls")):
                    errors.append("environment.surfaceParking.stalls: must be a number")
                # occupied is optional in v1.3 (generator no longer renders it)
                if "occupied" in sp and sp["occupied"] is not None and not is_number(sp["occupied"]):
                    errors.append("environment.surfaceParking.occupied: must be a number")
                if is_number(sp.get("stalls")) and is_number(sp.get("occupied")):
                    if sp["stalls"] <= 0:
                        errors.append("environment.surfaceParking.stalls: must be > 0")
                    if sp["occupied"] > sp["stalls"]:
                        errors.append(
                            "environment.surfaceParking.occupied cannot exceed stalls"
                        )
                elif is_number(sp.get("stalls")) and sp["stalls"] <= 0:
                    errors.append("environment.surfaceParking.stalls: must be > 0")

                # v2.12：车位密度提示。density = stalls × 6×12 / (boundary.x × boundary.z × 4)
                # 边界 ±x ±z，总面积 4 倍单象限。每车位约 6×12=72 世界单位。
                # > 20% 触发 WARN（建议扩大 boundary 或拆 multi-lot）。
                if is_number(sp.get("stalls")) and _bnd is not None:
                    bx = _bnd.get("x", 360); bz = _bnd.get("z", 220)
                    if bx > 0 and bz > 0:
                        density = (sp["stalls"] * 72) / (bx * bz * 4)
                        if density > 0.20:
                            warnings.append(
                                f"environment.surfaceParking: 车位密度 {density*100:.1f}% "
                                f"> 20% (boundary {bx}×{bz} 较紧)；考虑扩 boundary 或拆 multi-lot"
                            )

                # v2.17：车位越界提示。引擎 buildSurfaceParking 用二维网格（stallW14×stallD26、
                # rowStep22、margin70）由边界反推容量；超出部分会被自动截断。这里按同公式估 maxStalls，
                # stalls 超出时 WARN，建议调小或扩 boundary。
                if is_number(sp.get("stalls")) and _bnd is not None:
                    bx = _bnd.get("x", 360); bz = _bnd.get("z", 220)
                    if bx > 140 and bz > 140:
                        stall_w, stall_d, row_step, margin = 14, 26, 22, 70
                        max_cols = max(1, (2 * (bz - margin)) // stall_d)
                        max_rows = max(1, (2 * (bx - margin)) // row_step)
                        max_stalls = max_cols * max_rows
                        if sp["stalls"] > max_stalls:
                            warnings.append(
                                f"environment.surfaceParking.stalls={sp['stalls']} 超出 boundary "
                                f"{bx}×{bz} 可容纳车位网格 ≈{max_stalls}（{max_rows}排×{max_cols}列）；"
                                f"引擎将自动截断到 {max_stalls}，建议调小 stalls 或扩 boundary"
                            )

        gr = env.get("greenery")
        if gr is not None:
            if not isinstance(gr, dict):
                errors.append("environment.greenery: must be an object")
            else:
                td = gr.get("treeDensity")
                if td is not None and td not in VALID_TREE_DENSITY:
                    errors.append(
                        f"environment.greenery.treeDensity: '{td}' not in {sorted(VALID_TREE_DENSITY)}"
                    )
                for key in ("centralPlaza", "waterFeature"):
                    if key in gr and gr[key] is not None and not isinstance(gr[key], bool):
                        errors.append(f"environment.greenery.{key}: must be a boolean")

        for block in ("surrounding", "ambiance"):
            sub = env.get(block)
            if sub is not None:
                if not isinstance(sub, dict):
                    errors.append(f"environment.{block}: must be an object")
                else:
                    for key, val in sub.items():
                        if val is not None and not isinstance(val, bool):
                            errors.append(f"environment.{block}.{key}: must be a boolean")
    else:
        errors.append("environment: must be an object or omitted")

    # v2.2: cameraTour（航拍巡航 auto-orbit）—— 可选，缺省即智能默认（不 WARN）。
    # 存在时校验类型与范围：speed>0、framingK∈(0,1)、elevation∈[0,π/2]、布尔字段为布尔。
    ct = spec.get("cameraTour")
    if ct is not None:
        if not isinstance(ct, dict):
            errors.append("cameraTour: must be an object or omitted")
        else:
            known_ct = {"enabled", "speed", "elevation", "framingK", "pauseOnInteract"}
            unknown_ct = [k for k in ct.keys() if k not in known_ct]
            if unknown_ct:
                errors.append(
                    f"cameraTour: unknown key(s) {sorted(unknown_ct)} "
                    f"(allowed: {sorted(known_ct)})"
                )
            if "enabled" in ct and ct["enabled"] is not None and not isinstance(ct["enabled"], bool):
                errors.append("cameraTour.enabled: must be a boolean")
            if "pauseOnInteract" in ct and ct["pauseOnInteract"] is not None and not isinstance(ct["pauseOnInteract"], bool):
                errors.append("cameraTour.pauseOnInteract: must be a boolean")
            if "speed" in ct and ct["speed"] is not None:
                if not is_number(ct["speed"]) or ct["speed"] <= 0:
                    errors.append("cameraTour.speed: must be a positive number (OrbitControls autoRotateSpeed)")
            if "framingK" in ct and ct["framingK"] is not None:
                if not is_number(ct["framingK"]) or not (0 < ct["framingK"] < 1):
                    errors.append("cameraTour.framingK: must be a number in (0, 1) (内容占画面比例)")
            if "elevation" in ct and ct["elevation"] is not None:
                if not is_number(ct["elevation"]) or not (0 <= ct["elevation"] <= math.pi / 2):
                    errors.append(
                        f"cameraTour.elevation: must be a number in [0, {math.pi / 2:.4f}] (rad, above-horizon)"
                    )

    # v2.8+: corridor 跨层连廊（可选）—— floorEnd 语义校验（须为 ≥ floor 的整数）。
    co = spec.get("corridor")
    if co is not None:
        if not isinstance(co, dict):
            errors.append("corridor: must be an object or omitted")
        else:
            fl = co.get("floor", 1)
            fe = co.get("floorEnd")
            if fe is not None:
                if isinstance(fe, bool) or not is_number(fe) or int(fe) != fe:
                    errors.append("corridor.floorEnd: must be an integer >= 1")
                elif is_number(fl) and not isinstance(fl, bool) and fe < fl:
                    errors.append(f"corridor.floorEnd: must be >= floor ({fl})")

    return errors, warnings


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Validate a Park Spec JSON against the canonical schema.",
    )
    p.add_argument("spec", help="Path to the park spec JSON file")
    p.add_argument("--quiet", action="store_true", help="Suppress output; signal via exit code only")
    args = p.parse_args(argv)

    spec_path = Path(args.spec)
    if not spec_path.is_file():
        print(f"error: file not found: {spec_path}", file=sys.stderr)
        return 2

    try:
        spec = json.loads(spec_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"error: invalid JSON: {e}", file=sys.stderr)
        return 1

    errors, warnings = validate(spec)

    if not args.quiet:
        for w in warnings:
            print(f"WARN: {w}")
        for e in errors:
            print(f"FAIL: {e}")
        if not errors:
            print(f"OK: {spec_path} is valid ({len(spec.get('buildings', []))} buildings).")

    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
