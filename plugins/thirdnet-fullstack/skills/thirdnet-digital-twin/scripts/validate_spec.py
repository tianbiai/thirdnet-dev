#!/usr/bin/env python3
"""
validate_spec.py — validate a Park Spec JSON against the canonical schema.

The schema mirrors references/park-spec.md. This is a structural check (required
fields present, types correct, category values valid, coordinates in bounds),
not a deep semantic check. Run it before handing a spec to the generator step
to fail fast on missing/invalid data.

Usage:
  python validate_spec.py <spec.json>
  python validate_spec.py <spec.json> --quiet     # exit code only, no detail
  python validate_spec.py --help

Exit codes: 0 = valid, 1 = invalid (errors printed), 2 = usage / file error.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

VALID_CATEGORIES = {"building", "garage"}
VALID_STYLES = {
    "cyber", "realistic", "night-realistic",
    "blueprint", "holographic", "white-model", "isometric",
}
VALID_ROAD_SHAPES = {"loop", "cross", "grid", "none"}
VALID_TREE_DENSITY = {"sparse", "normal", "lush"}
VALID_FACING = {"N", "S", "E", "W"}
VALID_POI_TYPES = {
    "entrance", "exit", "camera", "gate", "service", "landmark", "parking", "custom"
}
DEFAULT_BOUND = 400  # |x|,|z| within ±400 world units (park boundary)

# v1.3: garage buildings render as a half-pyramid entrance marker, not a
# floors-building, so `floors` is optional for them.
REQUIRED_BUILDING = ["id", "name", "category", "w", "d", "x", "z"]


def is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


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
        if cat is not None and cat not in VALID_CATEGORIES:
            errors.append(f"{ctx}.category: '{cat}' not in {sorted(VALID_CATEGORIES)}")
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

    # At most one garage building; if garage present in legend, exactly one expected.
    garages = [b for b in buildings if isinstance(b, dict) and b.get("category") == "garage"]
    if len(garages) > 1:
        errors.append(f"buildings: {len(garages)} garage-category buildings; expected at most 1")

    # v1.3: top-level `garage` (capacity/empty/occupied) is deprecated — the garage
    # is now just a category:'garage' building rendered as an entrance marker.
    # Warn (don't fail) so old specs still pass; the generator ignores these numbers.
    if "garage" in spec:
        warnings.append(
            "garage: top-level field deprecated in v1.3 (地下车库 no longer shows "
            "occupancy). Use a category:'garage' building for the entrance marker; "
            "remove the `garage` block."
        )

    # v1.3: POIs (interest points). Optional; absent = generate none.
    building_ids = {
        b.get("id") for b in buildings
        if isinstance(b, dict) and b.get("id") is not None
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
                errors.append(
                    f"{pctx}.type: '{ptype}' not in {sorted(VALID_POI_TYPES)}"
                )
            if "label" in p and p["label"] is not None and not str(p["label"]).strip():
                errors.append(f"{pctx}.label: must be a non-empty string")
            for key in ("x", "z", "y"):
                if key in p and p[key] is not None and not is_number(p[key]):
                    errors.append(f"{pctx}.{key}: must be a number, got {type(p[key]).__name__}")
            for key in ("x", "z"):
                if is_number(p.get(key)) and abs(p[key]) > DEFAULT_BOUND:
                    warnings.append(f"{pctx}.{key}: {p[key]} outside ±{DEFAULT_BOUND} (check park boundary)")
            bid = p.get("buildingId")
            if bid is not None and bid not in building_ids:
                errors.append(
                    f"{pctx}.buildingId: '{bid}' does not match any buildings[].id"
                )
            fi = p.get("floorIndex")
            if fi is not None and (not isinstance(fi, int) or isinstance(fi, bool) or fi < 0):
                errors.append(f"{pctx}.floorIndex: must be a non-negative integer")
            tt = p.get("tooltip")
            if tt is not None and not isinstance(tt, dict):
                errors.append(f"{pctx}.tooltip: must be an object")
            elif isinstance(tt, dict) and tt.get("meta") is not None:
                if not isinstance(tt["meta"], dict):
                    errors.append(f"{pctx}.tooltip.meta: must be an object (key→string)")

    tokens = spec.get("tokens")
    if not isinstance(tokens, dict) or not tokens:
        style = spec.get("style", "cyber")
        warnings.append(
            f"tokens: missing — the generator will fall back to assets/themes/{style}.tokens.json"
        )

    # v1.2 environment block — optional; smart defaults apply when absent.
    env = spec.get("environment")
    if env is None:
        warnings.append(
            "environment: missing — the generator will use smart defaults "
            "(internal loop road + surface parking by building scale + normal greenery + "
            "surrounding roads/wall/gate + street lamps). Ask the user about parking/greenery/"
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
