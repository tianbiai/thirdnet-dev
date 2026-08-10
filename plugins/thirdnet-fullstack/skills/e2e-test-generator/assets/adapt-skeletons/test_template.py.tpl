# -*- coding: utf-8 -*-
"""【测试用例模板】一个业务流程一个文件。每文件含 ID / NAME / run(h)。

本用例所属「阶段」由 run_all.py 的 STAGES 编排（分组唯一事实源在那儿，本文件不声明阶段）。
文件名建议带阶段前缀 test_s<N>_*（如 test_s2_10_module_a_admin.py），便于按阶段归类。
run_all.py 启动时会逐阶段执行：每阶段跑完出 reports/stage_NN.md，再按所选模式问继续/停止。

本模板演示「跨端流转 + 多角色 + 负向」的最小形态（原则 #2/#3/#4），照此改写。
关键：
- 纯 UI：所有操作走真实 UI，只断言 DOM（原则 #1）。
- 写入即回验：每步 create/update/delete 后立即在同一端 DOM 断言（原则 #2）。
- 跨端：数据在一端产生后，在相关端断言可见/状态（原则 #3）。
- 多角色 + 负向：换 scoped 角色跑，断言「只见自己范围数据」与「越权按钮 DOM 不存在」（原则 #4）。
- 被动监听由 harness.attach 在 sessions 里自动挂上；预期失败用 h.findings.expect_response 注册（原则 #5）。
"""
from lib import sessions, state, data_factory
from lib import web_crud as crud
from lib import web_entities as we
from lib import selectors as S
from playwright.sync_api import expect

ID, NAME = "TC-XX", "业务流程名（一句话概括：谁→做什么→谁处理→在哪端可见）"


def run(h):
    # 前置：scaffold 用例已建好的主数据（从 state 读，保证全链路一致）
    entity_a_name = state.get("entity_a_name")
    assert entity_a_name, "前置主数据未就绪（先跑 scaffold 用例）"

    admin = sessions.admin_page(h)

    # ---- 1. 建业务项 + 写入即回验（B 端）----
    title = data_factory.something(1)["title"]
    crud.open_module(h, admin, "entity_a")
    crud.open_create_dialog(admin)
    crud.fill_text(admin, "标题", title)            # {{ADAPT}}
    crud.submit_dialog(admin)
    crud.search(admin, title)
    crud.assert_row_exists(h, admin, title, msg="创建后列表未见该项")

    # ---- 2. 跨端可见性（若有移动端；原则 #3）----
    # cpage = sessions.new_mobile(h, "consumer")
    # mobile_login.wx_login(h, cpage)
    # mobile_ui.goto(cpage, "list")
    # mobile_ui.assert_card(h, cpage, title)

    # ---- 3. 多角色 + 数据范围 + 负向（原则 #4）----
    scoped = sessions.get_web(h, "scope_role_a")     # {{ADAPT}} persona
    crud.open_module(h, scoped, "entity_a")
    crud.search(scoped, title)
    # 正向：在范围内 → 可见
    crud.assert_row_exists(h, scoped, title, msg="scoped 角色应可见其范围内数据")
    # 负向：越权 → 按钮 DOM 不存在（不是 403）
    expect(scoped.get_by_role("button", name=S.BTN_ADD, exact=True)).to_have_count(0)

    # ---- 4. 预期失败注册（若有冲突/校验子场景；原则 #5）----
    # h.findings.expect_response("/api/xxx", status=409)

    state.set("tcxx_title", title)
