# -*- coding: utf-8 -*-
"""E2E 测试分阶段调度器（通用层）。
- 启动时弹交互菜单：选运行模式（逐阶段确认 / 仅失败时暂停 / 一气跑完）+ 从第几阶段开始；
- 按 STAGES 顺序逐阶段执行，每个 TC 失败不中断后续（记录后继续）；
- 每个阶段结束生成 reports/stage_NN.md 阶段报告 + 滚动 reports/TEST_REPORT.md 总报告；
- 决策门：按所选模式在阶段之间问「继续/停止」，让用户决定继续还是先排查本次的问题。
用法：python run_all.py   或   python run_all.py --skip-ready（服务已起好时跳过健康检查）

【这是模板】STAGES 列表 {{ADAPT}} 为本项目实际用例模块按阶段分组；
阶段怎么划分由阶段 2（TEST_PLAN.md）与用户商定，这里填入选定方案。
"""
import importlib
import os
import sys

from lib.harness import Harness, TestRunner
from lib import sessions
import config as cfg

# {{ADAPT}} 阶段划分——顺序即执行顺序；每个元素 {"name": 阶段名, "modules": [用例模块路径...]}。
# 划分方案（按业务模块 / 按依赖层 / 按角色 / 按端 / 按测试类型）由阶段 2 与用户商定后填入此处。
# 典型「按依赖层 + 业务模块」形如：
STAGES = [
    {"name": "基础（登录/账号/角色/权限）", "modules": [
        "tests.test_00_bootstrap",
        "tests.test_01_scaffold",
        "tests.test_02_roles",
    ]},
    # ... {{ADAPT}} 按用户选定方案补全各阶段，例如：
    # {"name": "模块A（多角色验证）", "modules": [
    #     "tests.test_s2_10_module_a_admin",
    #     "tests.test_s2_11_module_a_scope_a",
    # ]},
    # {"name": "跨端/驾驶舱汇总", "modules": ["tests.test_sN_dashboard"]},
]

_MODE_NAMES = {"1": "逐阶段确认", "2": "仅失败时暂停", "3": "一气跑完"}


def _input(prompt, default=""):
    """读一行输入：回车=默认；无 TTY（EOFError）时取默认值，不阻塞。"""
    try:
        s = input(prompt).strip()
    except EOFError:
        return default
    return s if s else default


def _print_stages():
    print("\n========== 阶段清单 ==========")
    for i, st in enumerate(STAGES, 1):
        print(f"  阶段 {i}/{len(STAGES)}：{st['name']}  ({len(st['modules'])} 个用例)")
    print("==============================\n")


def _ask_mode():
    print("请选择本次运行模式：")
    print("  1) 逐阶段确认 —— 每阶段后暂停问继续/停止（默认，掌控最强）")
    print("  2) 仅失败时暂停 —— 阶段全过则自动继续，有失败才停下排查（更快）")
    print("  3) 一气跑完 —— 不暂停，最后出总报告（= 老行为）")
    m = _input("选择 [1/2/3，默认1]: ", "1")
    return m if m in ("1", "2", "3") else "1"


def _ask_start():
    n = len(STAGES)
    s = _input(f"从哪个阶段开始？[1-{n}，默认1，回车从头]: ", "1")
    try:
        v = int(s)
    except ValueError:
        v = 1
    return max(1, min(n, v))


def _gate(mode, idx, stage_failed, name, total):
    """阶段后决策门：返回 True 表示停下、不再跑后续阶段。"""
    if idx >= total or mode == "3":
        return False
    if mode == "2" and not stage_failed:
        return False
    hint = "（本阶段有失败，建议先排查再继续）" if stage_failed else "（本阶段全部通过）"
    ans = _input(f"\n>>> 阶段 {idx}「{name}」完成{hint}。继续下一阶段？[Y/n]: ", "y").lower()
    return ans not in ("y", "")


def main():
    skip_ready = "--skip-ready" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)

    cfg.ensure_artifacts()
    _print_stages()
    mode = _ask_mode()
    start = _ask_start()
    print(f"\n运行模式：{_MODE_NAMES[mode]}；从阶段 {start}/{len(STAGES)} 开始。\n")

    h = Harness()
    h.start()
    try:
        if not skip_ready and cfg_has_health():
            print("等待后端就绪（健康检查）…")
            h.wait_backends_ready()
            print("后端就绪。")

        runner = TestRunner(h)
        stopped = False
        for idx, stage in enumerate(STAGES, 1):
            name = stage["name"]
            if idx < start:
                print(f"[阶段 {idx}/{len(STAGES)}] {name} —— 跳过（本次从阶段 {start} 开始）")
                continue
            print(f"\n########## 阶段 {idx}/{len(STAGES)}：{name} ##########")
            runner.set_stage(idx, name)
            for mod_name in stage["modules"]:
                mod = importlib.import_module(mod_name)
                runner.run(mod.ID, mod.NAME, mod.run)
            stage_failed = runner.write_stage_report(idx, name)
            runner.write_reports()  # 滚动总报告（截至当前全部已跑阶段的全量快照）
            if _gate(mode, idx, stage_failed, name, len(STAGES)):
                stopped = True
                print("\n已按你的选择停止。阶段报告与总报告已生成于 reports/。"
                      "排查后重跑，启动时选「从第 N 阶段开始」即可续跑（前置阶段主数据已在 run_state.json 里）。")
                break

        sessions.close_all(h)
        failed = [r for r in runner.results if r["status"] == "fail"]
        if not stopped:
            print(f"\n全部阶段跑完。总用例 {len(runner.results)}，失败 {len(failed)}。")
        return 1 if failed else 0
    finally:
        h.stop()


def cfg_has_health():
    return bool(getattr(cfg, "BACKEND_HEALTH", {}))


if __name__ == "__main__":
    sys.exit(main())
