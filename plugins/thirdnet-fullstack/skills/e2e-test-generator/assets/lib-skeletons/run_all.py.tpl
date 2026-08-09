# -*- coding: utf-8 -*-
"""E2E 测试顺序调度器（通用层）。
- 后端就绪轮询（仅探活，可 --skip-ready 跳过）后，按 TC 顺序执行；
- 每个 TC 失败不中断后续（记录后继续），最后汇总 findings.json + TEST_REPORT.md。
用法：python run_all.py   或   python run_all.py --skip-ready（服务已起好时）

【这是模板】TEST_MODULES 列表 {{ADAPT}} 为本项目实际用例模块（顺序即执行顺序）。
"""
import importlib
import os
import sys

from lib.harness import Harness, TestRunner
from lib import sessions

# {{ADAPT}} 用例模块（顺序即执行顺序）。典型顺序：bootstrap → scaffold(主数据) →
# roles(角色+权限) → 各 scoped-role 数据范围 → bind(移动端绑定) → 业务流转 → dashboard/smoke。
TEST_MODULES = [
    "tests.test_00_bootstrap",
    "tests.test_01_scaffold",
    "tests.test_02_roles",
    # ... {{ADAPT}} 按业务流程补全
]


def main():
    skip_ready = "--skip-ready" in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)

    h = Harness()
    h.start()
    try:
        if not skip_ready and cfg_has_health():
            print("等待后端就绪（健康检查）…")
            h.wait_backends_ready()
            print("后端就绪。")

        runner = TestRunner(h)
        for mod_name in TEST_MODULES:
            mod = importlib.import_module(mod_name)
            runner.run(mod.ID, mod.NAME, mod.run)

        sessions.close_all(h)
        runner.write_reports()
        failed = [r for r in runner.results if r["status"] == "fail"]
        return 1 if failed else 0
    finally:
        h.stop()


def cfg_has_health():
    import config as cfg
    return bool(getattr(cfg, "BACKEND_HEALTH", {}))


if __name__ == "__main__":
    sys.exit(main())
