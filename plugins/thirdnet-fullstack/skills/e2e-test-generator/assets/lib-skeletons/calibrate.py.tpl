# -*- coding: utf-8 -*-
"""
活校准探针（通用层）—— 阶段 4b 用。

目的：把 selectors.py 里从源码推断出来的 selector/label/菜单名/列头，对**真实 DOM**
逐条验证命中，产出 reports/calibration.md，让生成阶段在交付前就修掉「对不上」的问题，
而不是把首次失败甩给执行者。

机制（守铁律·纯 UI）：
- 复用 harness.Harness 起浏览器、sessions.get_web 登录、web_crud 的导航/弹窗/表格原子；
- 只读 DOM 文本，绝不直连后端（与测试代码同样的约束）；
- 逐条收集 ✅命中 / ❌未命中，对未命中项附「DOM 里实际找到的最近似文本」，便于一眼定位该改什么；
- 退出码：全命中 0，有未命中 1。

【通用层】按原样拷贝即可。唯一可选的 {{ADAPT}} 点：CALIBRATION_PLAN（见下方）——
若你在 selectors.py 里维护了 CALIBRATION_PLAN（每模块期望的表单 label 列表 + 列头列表），
探针会做精确比对；没有也能跑——退化为「打开每个模块、如实报告 DOM 里真实的 label/列头」，
作为发现辅助，让你照着修 selectors.py。
"""
import os
import sys
import time
import difflib

import config as cfg
from lib import selectors as S
from lib.harness import Harness
from lib import sessions, web_login, web_crud


# ============ 报告收集 ============
class Report:
    def __init__(self):
        self.sections = []   # [(title, [lines])]
        self.miss = 0
        self.hit = 0

    def section(self, title):
        self.sections.append((title, []))
        return self.sections[-1][1]

    def add(self, lines, title):
        self.section(title).extend(lines)

    def mark(self, ok):
        if ok:
            self.hit += 1
        else:
            self.miss += 1

    def render(self):
        out = [f"# 活校准报告", "",
               f"生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}", "",
               f"目标：{cfg.BASE_URL_WEB}", "",
               "## 总览", "",
               f"- ✅ 命中：{self.hit}",
               f"- ❌ 未命中：{self.miss}",
               f"- 结果：{'**全部命中——可交付**' if self.miss == 0 else '**有未命中——据下表修 selectors.py 后重跑**'}",
               ""]
        for title, lines in self.sections:
            out += ["", f"## {title}", "", *lines]
        return "\n".join(out)


def _nearest(expected, candidates):
    """在候选文本里找与 expected 最近似的（用于提示该把生成代码改成什么）。"""
    candidates = [c for c in candidates if c]
    if not candidates:
        return ""
    # 子串双向包含优先
    for c in candidates:
        if expected in c or c in expected:
            return c
    # 相似度
    best = difflib.get_close_matches(expected, candidates, n=1, cutoff=0.4)
    return best[0] if best else ""


# ============ 各组校验 ============
def check_login_page(h, rep):
    """单独用一个干净上下文验登录页 placeholder / 按钮文案。"""
    lines = []
    try:
        ctx = h.new_web_context()
        page = ctx.new_page()
        page.goto(f"{cfg.BASE_URL_WEB}/login")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)

        def _check_ph(kind, ph):
            ok = False
            actual = ""
            try:
                loc = page.get_by_placeholder(ph)
                ok = loc.count() > 0 and loc.first.is_visible()
            except Exception:
                pass
            rep.mark(ok)
            lines.append(f"- {'✅' if ok else '❌'} {kind} placeholder `{ph}`：{'命中' if ok else '未命中'}")

        _check_ph("用户名", S.LOGIN_USER_PH)
        _check_ph("密码", S.LOGIN_PWD_PH)

        # 登录按钮
        ok = False
        try:
            ok = page.get_by_role("button", name=S.LOGIN_BTN_TEXT).count() > 0
        except Exception:
            pass
        rep.mark(ok)
        lines.append(f"- {'✅' if ok else '❌'} 登录按钮文案 `{S.LOGIN_BTN_TEXT}`：{'命中' if ok else '未命中'}")
        if not ok:
            actual = ""
            try:
                btns = page.locator("button")
                texts = [btns.nth(i).inner_text().strip() for i in range(min(btns.count(), 10))]
                actual = _nearest(S.LOGIN_BTN_TEXT, texts)
                if actual:
                    lines.append(f"  - DOM 中最近似的按钮文案：`{actual}`")
            except Exception:
                pass
        ctx.close()
    except Exception as e:
        lines.append(f"- ⚠️ 登录页校验异常：{e}")
    rep.add(lines, "登录页")


def _actual_labels(page):
    """读当前弹窗里所有表单 label 文本。"""
    try:
        loc = page.locator(f"{S.EL_DIALOG_VISIBLE} {S.EL_FORM_ITEM_LABEL}")
        return [loc.nth(i).inner_text().strip() for i in range(loc.count())]
    except Exception:
        return []


def _actual_headers(page):
    try:
        loc = page.locator(S.EL_TABLE_HEADER_CELL)
        return [loc.nth(i).inner_text().strip() for i in range(loc.count())]
    except Exception:
        return []


def check_modules(h, page, rep):
    """每个模块：菜单导航 → 开新增弹窗 → 验期望 label → 读列头 → 关闭。"""
    plan = getattr(S, "CALIBRATION_PLAN", {}) or {}
    keys = list(plan.keys()) if plan else list(S.WEB_MENU.keys())
    if not keys:
        rep.add(["- `CALIBRATION_PLAN` 与 `WEB_MENU` 均为空，无可校验模块。"
                 " 在 selectors.py 里填 WEB_MENU（侧边栏菜单名）后重跑。"], "模块")
        return

    for key in keys:
        lines = []
        title = f"模块「{key}」"
        # 1) 菜单导航
        nav_ok = True
        try:
            web_crud.open_module(h, page, key)
        except Exception as e:
            nav_ok = False
            lines.append(f"- ❌ 菜单导航失败：{e}")
            dir_menu = S.WEB_MENU.get(key)
            if dir_menu:
                lines.append(f"  - 期望目录/菜单：`{dir_menu}`——核对侧边栏真实文案")
        rep.mark(nav_ok)
        if not nav_ok:
            rep.add(lines, title)
            continue
        lines.append(f"- ✅ 菜单导航：进入模块成功")

        # 2) 列表表头
        headers = _actual_headers(page)
        expected_cols = (plan.get(key) or {}).get("columns", [])
        if headers:
            lines.append(f"- ℹ️ 实际列头：{headers}")
        if expected_cols:
            for col in expected_cols:
                ok = any(col == h or col in h for h in headers)
                rep.mark(ok)
                if ok:
                    lines.append(f"- ✅ 列头 `{col}`：命中")
                else:
                    near = _nearest(col, headers)
                    lines.append(f"- ❌ 列头 `{col}`：未命中" + (f"；最近似：`{near}`" if near else ""))
        elif not headers:
            lines.append("- ℹ️ 未读到列表表头（该页可能不是表格页，或 EL_TABLE_HEADER_CELL 选择器需调整）")

        # 3) 开新增弹窗
        expected_labels = (plan.get(key) or {}).get("labels", [])
        try:
            web_crud.open_create_dialog(page)
        except Exception as e:
            lines.append(f"- ❌ 打开新增弹窗失败（点 `{S.BTN_ADD}` 未出现弹窗）：{e}")
            rep.mark(False)
            rep.add(lines, title)
            continue
        lines.append(f"- ✅ 新增弹窗（点 `{S.BTN_ADD}`）打开成功")
        rep.mark(True)

        actual_labels = _actual_labels(page)
        if actual_labels:
            lines.append(f"- ℹ️ 弹窗内实际表单 label：{actual_labels}")
        if expected_labels:
            for lab in expected_labels:
                ok = any(lab == a or lab in a for a in actual_labels)
                rep.mark(ok)
                if ok:
                    lines.append(f"- ✅ 表单 label `{lab}`：命中")
                else:
                    near = _nearest(lab, actual_labels)
                    lines.append(f"- ❌ 表单 label `{lab}`：未命中" + (f"；最近似：`{near}`" if near else ""))
        elif not actual_labels:
            lines.append("- ⚠️ 弹窗内未读到任何表单 label（EL_FORM_ITEM_LABEL 选择器可能需调整）")

        # 关闭弹窗，避免污染下一模块
        try:
            web_crud.cancel_dialog(page)
        except Exception:
            try:
                page.keyboard.press("Escape")
            except Exception:
                pass
        rep.add(lines, title)


# ============ 主流程 ============
def main():
    cfg.ensure_artifacts()
    rep = Report()
    h = Harness()
    h.start()
    try:
        # 健康检查（仅探活，不测业务）
        if cfg.BACKEND_HEALTH:
            try:
                h.wait_backends_ready()
            except Exception as e:
                rep.add([f"- ⚠️ 后端健康检查未通过：{e}"], "前置")

        # 登录页校验（独立干净上下文）
        check_login_page(h, rep)

        # 模块校验（已登录 admin 上下文）
        try:
            page = sessions.get_web(h, "admin")
        except Exception as e:
            rep.add([f"- ❌ admin 登录失败：{e}",
                     "  - 核对 config.WEB_ACCOUNTS['admin'] 的账密（阶段 0 应由用户提供真实值）",
                     f"  - 核对登录页 placeholder/按钮文案（见 selectors.LOGIN_*）"], "登录")
        else:
            check_modules(h, page, rep)
    finally:
        sessions.close_all(h)
        h.stop()

    # 写报告
    md = os.path.join(cfg.REPORTS_DIR, "calibration.md")
    with open(md, "w", encoding="utf-8") as f:
        f.write(rep.render())
    print(rep.render())
    print(f"\n报告已写入：{md}")
    print(f"命中 {rep.hit} / 未命中 {rep.miss}")
    sys.exit(0 if rep.miss == 0 else 1)


if __name__ == "__main__":
    main()
