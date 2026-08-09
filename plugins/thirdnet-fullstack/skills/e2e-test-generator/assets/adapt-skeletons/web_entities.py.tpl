# -*- coding: utf-8 -*-
"""
Web 端业务实体「纯 UI 创建」封装（原则 #1 纯 UI + #2 写入即回验 + 幂等）。

每个 ensure_xxx：打开模块 → 按名搜索 → 已存在则复用，否则开真实弹窗 → 按 label 填表
→ 确定 → 从表格 DOM 回验 → 返回 (name, id...)，其中 id 用 read_cell 从「ID」列 DOM 文本读。

【这是模板】每个实体函数的「填哪些 label」必须取自 Phase 1 探索（各 views/<entity>/index.vue
的真实 label），**且每个字段的控件类型要对**（text/select/radio/tree-select/...，
见 references/web-element-plus.md「status 通常是 radio 非 select」）。
数据值由 data_factory 确定性产出，保证跨用例可复现、幂等。

下面给一个 ensure_<entity_a> 范例 + 两个状态流转动作（发布/下线 风格）范例，照此扩。
"""
from lib import data_factory
from lib import web_crud as crud


def _re_search(page, name):
    """创建后重新按名搜索，确保新行落入当前过滤视图后再回验。"""
    crud.search(page, name)


# ============ 范例：实体 A ============
def ensure_entity_a(h, page, idx):
    """建实体A；返回 (name, id_str)。id 从表格「ID」列 DOM 读。

    字段（{{ADAPT}} 换成真实 label + 控件类型）：
    - 名称(text) / 编号(text) / 类型(select) / 状态(radio 正常|停用)；表格首列「ID」。
    """
    data = data_factory.entity_a(idx)
    name = data["name"]
    crud.open_module(h, page, "entity_a")          # selectors.WEB_MENU 的 key
    crud.search(page, name)
    if not crud.row_exists(page, name):
        crud.open_create_dialog(page)
        crud.fill_text(page, "名称", name)          # {{ADAPT}} 真实 label
        crud.fill_text(page, "编号", data["code"])  # {{ADAPT}}
        crud.fill_select(page, "类型", "默认")       # {{ADAPT}}
        crud.fill_radio(page, "状态", "正常")        # {{ADAPT}} 注意 radio vs select
        crud.submit_dialog(page)
    _re_search(page, name)
    crud.assert_row_exists(h, page, name, msg="实体A 创建后未在列表出现")
    pid = crud.read_cell(page, name, "ID")          # 从 DOM 读 id，替代直连 API
    print(f"  ✓ 实体A「{name}」id={pid}")
    return name, pid


# ============ 范例：状态流转动作（发布/下线 风格）============
def publish_entity_a(h, page, name):
    """点行内「发布」（仅草稿态可见）→ MessageBox 确认 → 回验状态变更。
    {{ADAPT}} 按钮文案 / 状态文案 / 是否有确认框，按真实页定。"""
    crud.click_action_in_row(page, name, "发布")    # {{ADAPT}}
    crud.confirm_msgbox(page)
    crud.expect_success(page)
    crud.search(page, name)
    crud.assert_row_field(h, page, name, "已发布", msg="发布后状态未变更")


def offline_entity_a(h, page, name):
    """点行内「下架」（仅已发布态可见）→ 确认 → 回验状态≠已发布。"""
    crud.click_action_in_row(page, name, "下架")    # {{ADAPT}}
    crud.confirm_msgbox(page)
    crud.expect_success(page)
    crud.search(page, name)
    status = crud.read_cell(page, name, "状态")     # {{ADAPT}} 列名
    if status and "已发布" in status:
        h.screenshot(page, f"offline_{name}")
        raise AssertionError(f"下架后状态仍为已发布：{status}")
