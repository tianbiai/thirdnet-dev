#!/usr/bin/env python3
"""
generate_data.py — 从已确认的 Park Spec 确定性生成数字孪生的两个数据文件（v2.1 新增）。

为什么要有这个脚本：
v1.5–v2.0 里「spec → 静态脚手架 / Mock 数据」由生成器手工编写，租户名、单位、电话全靠
AI 现编——同一份 spec 两次生成内容不同、字段形状漂移。本脚本把派生规则固化：

  spec.json ──┬─→ src/data/<park>.ts                      （静态脚手架：占地几何 + 环境驱动）
              └─→ src/mock/data/manager/digital-twin.ts   （Mock 数据：楼幢业务/楼层详情/POI）

确定性保证：全部随机选择（行业/公司名/负责人/电话/POI 状态）由种子 = FNV-1a(spec.title)
的 mulberry32 驱动——与 assets/park-scene.impl.ts 视觉装饰同款伪随机，同一 spec 重跑
输出逐字节一致。随机池（8 行业 × 公司名/业务范围/职责）内置在本脚本，AI 不可改写。

Usage:
  python generate_data.py spec.json                          # 输出到 ./src/...
  python generate_data.py spec.json --out-dir <项目根>        # 输出到 <项目根>/src/...
  python generate_data.py spec.json --park-name mypark       # 脚手架文件名 src/data/mypark.ts
  python generate_data.py spec.json --scaffold-only          # 只生成静态脚手架
  python generate_data.py spec.json --mock-only              # 只生成 Mock 数据

Exit codes: 0 = 成功, 1 = spec 校验失败, 2 = 文件错误。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# 确定性伪随机（与 assets/park-scene.impl.ts 的 hashStr/mulberry32 逐位对齐）
# ---------------------------------------------------------------------------

def _i32(v: int) -> int:
    v &= 0xFFFFFFFF
    return v - 0x100000000 if v >= 0x80000000 else v


def _imul(a: int, b: int) -> int:
    return _i32(_i32(a) * _i32(b))


def hash_str(s: str) -> int:
    """FNV-1a 32-bit（按 UTF-16 code unit 迭代，与 JS charCodeAt 对齐）。"""
    h = 2166136261
    data = s.encode("utf-16-be")
    for i in range(0, len(data), 2):
        h ^= int.from_bytes(data[i:i + 2], "big")
        h = _imul(h, 16777619)
    return h & 0xFFFFFFFF


def mulberry32(seed: int):
    a = _i32(seed)

    def rnd() -> float:
        nonlocal a
        a = _i32(a + 0x6D2B79F5)
        ua = a & 0xFFFFFFFF
        t = _imul(a ^ (ua >> 15), 1 | a)
        ut = t & 0xFFFFFFFF
        t = _i32(_i32(t + _imul(t ^ (ut >> 7), 61 | t)) ^ t)
        ut2 = t & 0xFFFFFFFF
        return ((t ^ (ut2 >> 14)) & 0xFFFFFFFF) / 4294967296

    return rnd


def _pick(rnd, seq):
    return seq[int(rnd() * len(seq)) % len(seq)]


# ---------------------------------------------------------------------------
# 租户内容池（8 行业模板，对齐范例 parkModel.ts 的 CAT 映射）—— 固化，勿临场增删
# ---------------------------------------------------------------------------

INDUSTRIES = [
    {
        "key": "software", "label": "软件信息",
        "companies": ["云杉科技", "蓝湾软件", "灵犀智能", "星图数据", "格致网络"],
        "scope": "软件开发、信息系统集成、数据服务",
        "duty": "负责园区信息化平台建设与运维",
    },
    {
        "key": "finance", "label": "金融服务",
        "companies": ["华信信托", "启元资本", "恒信支付", "金桥租赁", "明德基金"],
        "scope": "投融资、支付结算、融资租赁",
        "duty": "负责园区企业金融服务对接",
    },
    {
        "key": "design", "label": "创意设计",
        "companies": ["墨白设计", "观合建筑", "九章创意", "山禾视觉", "璞真空间"],
        "scope": "建筑设计、视觉传达、空间设计",
        "duty": "负责园区视觉形象与空间导视设计",
    },
    {
        "key": "education", "label": "教育培训",
        "companies": ["启思教育", "知新学堂", "博约培训", "乐知教育", "育才在线"],
        "scope": "职业培训、在线教育、企业内训",
        "duty": "负责园区人才培训与技能提升服务",
    },
    {
        "key": "medical", "label": "医疗健康",
        "companies": ["仁心医疗", "康泰生物", "安澜健康", "本草医药", "颐年康复"],
        "scope": "医疗服务、健康管理、生物医药",
        "duty": "负责园区健康服务点运营",
    },
    {
        "key": "legal", "label": "法律服务",
        "companies": ["正衡律师", "铭基法务", "公理咨询", "维律知识产权", "天平公证"],
        "scope": "法律咨询、知识产权、公证服务",
        "duty": "负责园区企业法律事务支持",
    },
    {
        "key": "ecommerce", "label": "电商贸易",
        "companies": ["蜂鸟电商", "云集优选", "闪购科技", "好货供应链", "鹿鸣直播"],
        "scope": "电子商务、供应链管理、直播带货",
        "duty": "负责园区电商企业孵化与对接",
    },
    {
        "key": "consulting", "label": "管理咨询",
        "companies": ["远瞩咨询", "盘古智库", "睿略管理", "知行研究院", "北辰战略"],
        "scope": "战略咨询、管理顾问、行业研究",
        "duty": "负责园区产业发展研究与咨询",
    },
]

SURNAMES = ["王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙", "马", "朱", "胡"]
GIVEN = ["伟", "芳", "娜", "敏", "静", "磊", "军", "洋", "勇", "杰", "涛", "明", "超", "平", "刚", "建国", "晓东", "雨桐", "子涵", "思远"]
NATURES = ["民营企业", "国有企业", "合资企业", "外资企业", "事业单位"]
PHONE_PREFIX = ["135", "136", "137", "138", "139", "150", "151", "152", "158", "159", "176", "177", "186", "187", "188", "189"]


def _phone(rnd) -> str:
    mid = "".join(str(int(rnd() * 10)) for _ in range(4))
    tail = "".join(str(int(rnd() * 10)) for _ in range(4))
    return f"{_pick(rnd, PHONE_PREFIX)}-{mid}-{tail}"


def _person(rnd) -> str:
    return _pick(rnd, SURNAMES) + _pick(rnd, GIVEN)


# ---------------------------------------------------------------------------
# 生成静态脚手架 src/data/<park>.ts
# ---------------------------------------------------------------------------

def render_scaffold(spec: dict) -> str:
    bnd = spec.get("boundary") or {"x": 360, "z": 220}
    fh = spec.get("floorHeight", 24)
    env = spec.get("environment") or {}
    buildings = spec.get("buildings") or []

    lines = [
        "// ==========================================================================",
        "// <park>.ts — 静态脚手架（基础信息）：楼栋占地几何 + 园区环境驱动数据。",
        "// 由 scripts/generate_data.py 从 spec.json 生成，勿手改——改内容请改 spec 后重跑。",
        "// 动态数据（楼幢名/楼层数/楼层详情/POI）不在这里——走 IDigitalTwinApi 契约层水合。",
        "// ==========================================================================",
        "",
        "export interface ScaffoldBuilding {",
        "  id: string",
        "  category: 'building' | 'garage'",
        "  w: number              // 占地宽（世界单位）",
        "  d: number              // 占地深",
        "  x: number              // 中心坐标 X",
        "  z: number              // 中心坐标 Z",
        "  facing?: 'N' | 'S' | 'E' | 'W'",
        "}",
        "",
        "export interface ParkEnvironment {",
        "  internalRoads?: 'loop' | 'cross' | 'grid' | 'none'",
        "  surfaceParking?: { stalls: number; occupied?: number } | null",
        "  greenery?: { treeDensity?: 'sparse' | 'normal' | 'lush'; centralPlaza?: boolean; waterFeature?: boolean }",
        "  surrounding?: Record<string, boolean>",
        "  ambiance?: Record<string, boolean>",
        "}",
        "",
        "export interface CorridorSpec {",
        "  from: { x: number; z: number }",
        "  to: { x: number; z: number }",
        "  floor: number          // 所在楼层（悬空高度 = floor*floorHeight）",
        "  width: number",
        "  thickness: number",
        "  label: string",
        "}",
        "",
        "export interface CameraTourSpec {",
        "  enabled?: boolean       // 首屏自动开启（默认 false——用户点 TourToggleButton 触发）",
        "  speed?: number          // OrbitControls autoRotateSpeed（默认 0.6 缓慢）",
        "  elevation?: number      // 巡航俯角 rad（above-horizon；默认 1.0 鸟瞰；钳到 polar[0.5,1.3]）",
        "  framingK?: number       // 巡航取景内容占比（默认 0.55 俯瞰全城）",
        "  pauseOnInteract?: boolean // 用户拖拽自动退出（默认 true）",
        "}",
        "",
        "export interface ParkScaffold {",
        "  style: string            // spec.style → GlobalTwin 调 scene.setStyle()",
        "  boundary: { x: number; z: number }",
        "  floorHeight: number",
        "  buildings: ScaffoldBuilding[]",
        "  environment: ParkEnvironment",
        "  legend: { label: string; category: string; color: string }[]",
        "  corridor?: CorridorSpec",
        "  cameraTour?: CameraTourSpec",
        "}",
        "",
        "export const parkScaffold: ParkScaffold = {",
        f"  style: '{spec.get('style', 'cyber')}',",
        f"  boundary: {{ x: {bnd.get('x', 360)}, z: {bnd.get('z', 220)} }},",
        f"  floorHeight: {fh},",
        "  buildings: [",
    ]
    for b in buildings:
        facing = f", facing: '{b['facing']}'" if b.get("facing") else ""
        lines.append(
            f"    {{ id: '{b['id']}', category: '{b['category']}', w: {b['w']}, d: {b['d']}, "
            f"x: {b['x']}, z: {b['z']}{facing} }},"
        )
    lines.append("  ],")

    # environment —— 只输出 spec 给了的键（缺省 = ParkScene 智能默认）
    env_parts = []
    if "internalRoads" in env:
        env_parts.append(f"    internalRoads: '{env['internalRoads']}',")
    sp = env.get("surfaceParking")
    if sp is not None:
        occ = f", occupied: {sp['occupied']}" if sp.get("occupied") is not None else ""
        env_parts.append(f"    surfaceParking: {{ stalls: {sp.get('stalls', 0)}{occ} }},")
    gr = env.get("greenery")
    if gr:
        gkeys = []
        if gr.get("treeDensity"):
            gkeys.append(f"treeDensity: '{gr['treeDensity']}'")
        for bk in ("centralPlaza", "waterFeature"):
            if gr.get(bk) is not None:
                gkeys.append(f"{bk}: {str(gr[bk]).lower()}")
        env_parts.append(f"    greenery: {{ {', '.join(gkeys)} }},")
    for blk in ("surrounding", "ambiance"):
        sub = env.get(blk)
        if sub:
            items = ", ".join(f"{k}: {str(v).lower()}" for k, v in sub.items())
            env_parts.append(f"    {blk}: {{ {items} }},")
    if env_parts:
        lines.append("  environment: {")
        lines.extend(env_parts)
        lines.append("  },")
    else:
        lines.append("  environment: {},")

    # legend —— spec.legend 缺省时按类别给默认（颜色与 token category 一致由 validate_spec 复核）
    legend = spec.get("legend") or [
        {"label": "楼幢", "category": "building", "color": ""},
        {"label": "地下车库", "category": "garage", "color": ""},
    ]
    legend_items = ", ".join(
        f"{{ label: '{e.get('label', e.get('category'))}', category: '{e.get('category', 'building')}', color: '{e.get('color', '')}' }}"
        for e in legend
    )
    lines.append(f"  legend: [{legend_items}],")

    corridor = spec.get("corridor")
    if corridor:
        lines.append(
            f"  corridor: {{ from: {{ x: {corridor['from']['x']}, z: {corridor['from']['z']} }}, "
            f"to: {{ x: {corridor['to']['x']}, z: {corridor['to']['z']} }}, "
            f"floor: {corridor.get('floor', 1)}, width: {corridor.get('width', 12)}, "
            f"thickness: {corridor.get('thickness', 6)}, label: '{corridor.get('label', '连廊')}' }},"
        )

    # cameraTour —— 仅输出 spec 给了的键（缺省 = ParkScene 内置智能默认）
    ct = spec.get("cameraTour")
    if ct:
        ct_parts = []
        if ct.get("enabled") is not None:
            ct_parts.append(f"enabled: {str(ct['enabled']).lower()}")
        if ct.get("speed") is not None:
            ct_parts.append(f"speed: {ct['speed']}")
        if ct.get("elevation") is not None:
            ct_parts.append(f"elevation: {ct['elevation']}")
        if ct.get("framingK") is not None:
            ct_parts.append(f"framingK: {ct['framingK']}")
        if ct.get("pauseOnInteract") is not None:
            ct_parts.append(f"pauseOnInteract: {str(ct['pauseOnInteract']).lower()}")
        if ct_parts:
            lines.append(f"  cameraTour: {{ {', '.join(ct_parts)} }},")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 生成 Mock 数据 src/mock/data/manager/digital-twin.ts
# ---------------------------------------------------------------------------

def render_mock(spec: dict, rnd) -> str:
    buildings = spec.get("buildings") or []
    pois = spec.get("pois") or []
    env = spec.get("environment") or {}
    stalls = ((env.get("surfaceParking") or {}) or {}).get("stalls")

    used_companies: set[str] = set()

    def fresh_company(ind: dict) -> str:
        # 确定性选公司；撞名时顺移到下一个未用的，保证全园区不重名
        start = int(rnd() * len(ind["companies"]))
        for k in range(len(ind["companies"])):
            name = ind["companies"][(start + k) % len(ind["companies"])]
            if name not in used_companies:
                used_companies.add(name)
                return name
        return ind["companies"][start % len(ind["companies"])]

    lines = [
        "// ==========================================================================",
        "// digital-twin.ts — 纯 Mock 数据（「开发期/演示期的后端」）。",
        "// 由 scripts/generate_data.py 从 spec.json 确定性生成（种子=spec.title），勿手改。",
        "// 要换内容：改 spec.json 后重跑 generate_data.py --mock-only。",
        "// ==========================================================================",
        "",
        "import type { BuildingRuntimeItem, FloorDetail, PoiRuntimeItem, UnitDetail } from '@/api/types/digital-twin'",
        "import { PoiStatusEnum, PoiTypeEnum } from '@/api/types/digital-twin'",
        "",
        "// ---- 楼幢业务数据（getBuildings）—— 从 spec.buildings[] 派生 ----",
        "export const mockBuildings: BuildingRuntimeItem[] = [",
    ]
    for b in buildings:
        if b.get("category") == "garage":
            floors = 0
            floor_ids = "[]"
            header = b.get("header", "地下")
        else:
            floors = int(b.get("floors", 1))
            ids = ", ".join(f"'{b['id']}-f{i}'" for i in range(1, floors + 1))
            floor_ids = f"[{ids}]"
            header = b.get("header", f"{floors}F")
        lines.append(
            f"  {{ building_id: '{b['id']}', name: '{b.get('name', b['id'])}', floors: {floors}, "
            f"floor_ids: {floor_ids}, header: '{header}' }},"
        )
    lines.append("]")
    lines.append("")

    # ---- 楼层详情 ----
    lines.append("// ---- 楼层详情（getFloorDetail）—— 每层 1–3 个单位，行业/公司/负责人确定性派生 ----")
    lines.append("export const mockFloorDetails: FloorDetail[] = [")
    for b in buildings:
        if b.get("category") == "garage":
            continue
        floors = int(b.get("floors", 1))
        for i in range(1, floors + 1):
            n_units = 1 + int(rnd() * 3) % 3  # 1–3
            units = []
            main_tenant = None
            for j in range(1, n_units + 1):
                ind = _pick(rnd, INDUSTRIES)
                company = fresh_company(ind)
                if main_tenant is None:
                    main_tenant = company
                area = 80 + int(rnd() * 520)
                staff = 5 + int(rnd() * 75)
                units.append(
                    "      { "
                    f"unit_id: '{b['id']}-f{i}-u{j}', name: '{company}', tenant: '{company}', "
                    f"contact_person: '{_person(rnd)}', contact_phone: '{_phone(rnd)}', "
                    f"staff_count: {staff}, area: {area}, nature: '{_pick(rnd, NATURES)}', "
                    f"service_hours: '09:00-18:00', business_scope: '{ind['scope']}', "
                    f"responsibilities: '{ind['duty']}' "
                    "},"
                )
            lines.append(f"  {{")
            lines.append(f"    building_id: '{b['id']}', floor_id: '{b['id']}-f{i}', label: '{i}F',")
            lines.append(f"    tenant: '{main_tenant}',")
            lines.append(f"    units: [")
            lines.extend(units)
            lines.append(f"    ],")
            lines.append(f"  }},")
    lines.append("]")
    lines.append("")

    # ---- POI ----
    lines.append("// ---- POI 点位（getPois）—— 坐标/类型/tooltip 直接搬 spec，status 给合理初值 ----")
    lines.append("export const mockPois: PoiRuntimeItem[] = [")
    for p in pois:
        status = "PoiStatusEnum.Idle" if rnd() < 0.15 else "PoiStatusEnum.Online"
        ptype = p.get("type", "custom")
        type_enum = "PoiTypeEnum." + {
            "entrance": "Entrance", "exit": "Exit", "camera": "Camera", "gate": "Gate",
            "service": "Service", "landmark": "Landmark", "parking": "Parking", "custom": "Custom",
        }.get(ptype, "Custom")
        parts = [
            f"poi_id: '{p['id']}'",
            f"type: {type_enum}",
            f"label: '{p.get('label', p['id'])}'",
            f"x: {p['x']}, z: {p['z']}",
        ]
        if p.get("y") is not None:
            parts.append(f"y: {p['y']}")
        if p.get("buildingId"):
            parts.append(f"building_id: '{p['buildingId']}'")
        if p.get("floorIndex") is not None:
            parts.append(f"floor_index: {p['floorIndex']}")
        parts.append(f"status: {status}")
        tt = p.get("tooltip")
        if tt:
            tt_parts = []
            if tt.get("title"):
                tt_parts.append(f"title: '{tt['title']}'")
            if tt.get("description"):
                tt_parts.append(f"description: '{tt['description']}'")
            meta = tt.get("meta")
            if meta:
                items = ", ".join(f"'{k}': '{v}'" for k, v in meta.items())
                tt_parts.append(f"meta: {{ {items} }}")
            parts.append(f"tooltip: {{ {', '.join(tt_parts)} }}")
        if ptype == "parking" and stalls:
            occupied = int(stalls * (0.2 + rnd() * 0.3))
            parts.append(f"occupancy: {{ capacity: {stalls}, occupied: {occupied}, empty: {stalls - occupied} }}")
        lines.append(f"  {{ {', '.join(parts)} }},")
    lines.append("]")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------

def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="从 Park Spec 确定性生成静态脚手架 + Mock 数据两个 TS 文件。")
    p.add_argument("spec", help="已确认并通过 validate_spec.py 的 spec.json")
    p.add_argument("--out-dir", default=".", help="项目根目录（输出 <out-dir>/src/...；默认当前目录）")
    p.add_argument("--park-name", default="park", help="脚手架文件名（默认 park → src/data/park.ts）")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--scaffold-only", action="store_true", help="只生成静态脚手架")
    g.add_argument("--mock-only", action="store_true", help="只生成 Mock 数据")
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
    if not spec.get("buildings"):
        print("error: spec.buildings 为空——先补全 spec 并跑 validate_spec.py", file=sys.stderr)
        return 1

    seed = hash_str(str(spec.get("title") or "park"))
    rnd = mulberry32(seed)
    out_root = Path(args.out_dir)

    wrote = []
    if not args.mock_only:
        scaffold_ts = render_scaffold(spec)
        scaffold_path = out_root / "src" / "data" / f"{args.park_name}.ts"
        scaffold_path.parent.mkdir(parents=True, exist_ok=True)
        scaffold_path.write_text(scaffold_ts, encoding="utf-8")
        wrote.append(scaffold_path)

    if not args.scaffold_only:
        mock_ts = render_mock(spec, rnd)
        mock_path = out_root / "src" / "mock" / "data" / "manager" / "digital-twin.ts"
        mock_path.parent.mkdir(parents=True, exist_ok=True)
        mock_path.write_text(mock_ts, encoding="utf-8")
        wrote.append(mock_path)

    n_b = len(spec.get("buildings") or [])
    n_f = sum(int(b.get("floors", 0)) for b in (spec.get("buildings") or []) if b.get("category") != "garage")
    n_p = len(spec.get("pois") or [])
    for w in wrote:
        print(f"OK: 生成 {w}")
    print(f"OK: seed={seed}（确定性）；{n_b} 栋楼 / {n_f} 层详情 / {n_p} 个 POI")
    return 0


if __name__ == "__main__":
    sys.exit(main())
