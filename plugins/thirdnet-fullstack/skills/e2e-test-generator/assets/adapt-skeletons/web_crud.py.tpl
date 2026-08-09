# -*- coding: utf-8 -*-
"""
Web 后台通用 CRUD 与「写入即回验」原子（Element Plus 变体）。

这是经过验证的 Element Plus 原子集：导航（侧边栏优先 + 路由兜底）、表格回验
（find_row / assert_row_exists / assert_row_gone / read_cell 按列头）、弹窗开闭提交、
表单填充（按 label 定位 text/textarea/select/tree-select/radio/switch/multi/time/富文本/上传）、
搜索、删除、菜单树勾选。

【这是模板】机制通用；真正要 {{ADAPT}} 的只有：1) 若你的后台不是 Element Plus，
按 references/web-element-plus.md（或 discovery）替换 class；2) submit_dialog 的提交按钮文案
取自 selectors.BTN_SUBMIT（多数「确定」，个别弹窗用业务动词如「发送」，到时在调用处覆盖）。

回验原则 #2：所有业务操作开真实弹窗、按 label 填表、提交，再从表格 DOM 文本读回断言。
**不直连后端**；读后端、发请求一律由被测前端自身完成（原则 #1）。
"""
import time

import config as cfg
from lib import selectors as S


# ============ 导航 ============
def open_module(h, page, key, use_route_first=False):
    """打开模块页：默认侧边栏菜单文本点击（mock/real 一致）；失败回退直接路由。"""
    if use_route_first and key in S.WEB_ROUTE:
        _goto_route(page, S.WEB_ROUTE[key])
        return
    try:
        _sidebar_navigate(page, *S.WEB_MENU[key])
    except Exception:
        if key in S.WEB_ROUTE:
            _goto_route(page, S.WEB_ROUTE[key])
            return
        raise
    _wait_content(page)


def _sidebar_navigate(page, dir_name, menu_name):
    submenu = page.locator(".el-sub-menu__title", has_text=dir_name)
    if submenu.count():
        parent = submenu.locator("xpath=ancestor::li[contains(@class,'el-sub-menu')]")
        opened = parent.evaluate("el => el.classList.contains('is-opened')") if parent.count() else False
        if not opened:
            submenu.first.click()
            page.wait_for_timeout(300)
    page.locator(".el-menu-item", has_text=menu_name).first.click()
    page.wait_for_load_state("networkidle")


def _goto_route(page, path):
    page.goto(f"{cfg.BASE_URL_WEB}{path}")
    page.wait_for_load_state("networkidle")
    _wait_content(page)


def _wait_content(page):
    page.wait_for_selector(".el-table, .el-empty, .app-container", timeout=cfg.TIMEOUT)
    page.wait_for_timeout(400)


# ============ 表格回验 ============
def wait_table(page):
    page.wait_for_selector(S.EL_TABLE, timeout=cfg.TIMEOUT)
    page.wait_for_timeout(300)


def _rows(page):
    return page.locator(f"{S.EL_TABLE} {S.EL_TABLE_ROW}")


def row_count(page):
    wait_table(page)
    return _rows(page).count()


def find_row(page, keyword):
    wait_table(page)
    return _rows(page).filter(has_text=keyword).first


def row_exists(page, keyword):
    wait_table(page)
    try:
        return _rows(page).filter(has_text=keyword).first.is_visible(timeout=3000)
    except Exception:
        return False


def wait_for_row(page, keyword, timeout_ms=None):
    timeout_ms = timeout_ms or cfg.TIMEOUT
    wait_table(page)
    end = time.time() + timeout_ms / 1000
    while time.time() < end:
        if row_exists(page, keyword):
            return find_row(page, keyword)
        time.sleep(0.4)
    return None


def assert_row_exists(h, page, keyword, msg=None):
    """新增后回验：断言列表中出现含 keyword 的行。"""
    r = wait_for_row(page, keyword)
    if r is None or r.count() == 0:
        h.screenshot(page, f"assert_exist_{int(time.time())}")
        raise AssertionError(f"回验失败：列表中未找到「{keyword}」。{msg or ''}")
    return r


def assert_row_gone(h, page, keyword, msg=None):
    """删除后回验：断言列表中不再出现含 keyword 的行。"""
    end = time.time() + cfg.TIMEOUT / 1000
    while time.time() < end:
        if not row_exists(page, keyword):
            return True
        time.sleep(0.4)
    h.screenshot(page, f"assert_gone_{int(time.time())}")
    raise AssertionError(f"回验失败：列表中仍存在「{keyword}」未删除。{msg or ''}")


def assert_row_field(h, page, keyword, expected_text, msg=None):
    """编辑后回验：断言含 keyword 的行文本中包含 expected_text。"""
    r = assert_row_exists(h, page, keyword, msg)
    txt = r.inner_text()
    if expected_text not in txt:
        h.screenshot(page, f"assert_field_{int(time.time())}")
        raise AssertionError(f"回验失败：行「{keyword}」未含「{expected_text}」。实际：{txt[:200]}")


def read_cell(page, keyword, column_label):
    """读回：在含 keyword 的行中，按表头列名读单元格文本。"""
    r = find_row(page, keyword)
    if r.count() == 0:
        return ""
    idx = _column_index(page, column_label)
    if idx is None:
        return ""
    cell = r.locator("td").nth(idx)
    if cell.count() == 0:
        return ""
    return cell.inner_text().strip()


def _column_index(page, column_label):
    headers = page.locator(S.EL_TABLE_HEADER_CELL)
    for i in range(headers.count()):
        if headers.nth(i).inner_text().strip() == column_label:
            return i
    for i in range(headers.count()):
        if column_label in headers.nth(i).inner_text():
            return i
    return None


# ============ 弹窗与表单 ============
def open_create_dialog(page):
    page.get_by_role("button", name=S.BTN_ADD, exact=True).click()
    _wait_dialog(page)


def open_edit_dialog(page, keyword):
    click_action_in_row(page, keyword, S.BTN_EDIT)
    _wait_dialog(page)


def open_detail_dialog(page, keyword):
    click_action_in_row(page, keyword, S.BTN_DETAIL)
    _wait_dialog(page)


def _wait_dialog(page):
    page.wait_for_selector(S.EL_DIALOG_VISIBLE, state="visible", timeout=cfg.TIMEOUT)
    page.wait_for_timeout(300)


def dialog_root(page):
    return page.locator(S.EL_DIALOG_VISIBLE).last


def submit_dialog(page, submit_text=None):
    """点提交（默认 BTN_SUBMIT，如「确定」）并等弹窗关闭 + 成功提示。
    个别弹窗提交按钮是业务动词（如「发送」），传 submit_text 覆盖。"""
    btn_text = submit_text or S.BTN_SUBMIT
    dialog_root(page).get_by_role("button", name=btn_text, exact=True).click()
    expect_success(page)
    try:
        page.wait_for_selector(S.EL_DIALOG_VISIBLE, state="hidden", timeout=cfg.TIMEOUT)
    except Exception:
        pass
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)


def cancel_dialog(page):
    dialog_root(page).get_by_role("button", name=S.BTN_CANCEL, exact=True).click()
    try:
        page.wait_for_selector(S.EL_DIALOG_VISIBLE, state="hidden", timeout=cfg.TIMEOUT)
    except Exception:
        pass


def _form_item(page, label):
    """定位 label 文本匹配的表单项（重复时取最后一个）。"""
    return page.locator(S.EL_FORM_ITEM).filter(
        has=page.locator(S.EL_FORM_ITEM_LABEL, has_text=label)
    ).last


def fill_text(page, label, value):
    fi = _form_item(page, label)
    inp = fi.locator("input:visible").first
    inp.click()
    inp.fill("")
    inp.fill(str(value))


def fill_textarea(page, label, value):
    fi = _form_item(page, label)
    ta = fi.locator("textarea:visible").first
    ta.click()
    ta.fill(str(value))


def fill_select(page, label, value):
    fi = _form_item(page, label)
    fi.click()
    page.wait_for_timeout(300)
    page.locator(f"{S.EL_SELECT_DROPDOWN_ITEM}:visible", has_text=str(value)).first.click()
    page.wait_for_timeout(200)


def fill_tree_select(page, label, *values):
    fi = _form_item(page, label)
    fi.click()
    page.wait_for_timeout(300)
    for v in values:
        page.locator(f"{S.EL_TREE_NODE}:visible", has_text=str(v)).first.click()
        page.wait_for_timeout(200)
    page.locator("body").click(position={"x": 0, "y": 0})
    page.wait_for_timeout(200)


def fill_radio(page, label, option_text):
    """el-radio-group：在 label 表单项内按单选项文本点击。
    注意：很多「状态」字段是 radio 而非 select，别用错（见 references/web-element-plus.md）。"""
    fi = _form_item(page, label)
    radio = fi.locator(S.EL_RADIO).filter(
        has=fi.locator(S.EL_RADIO_LABEL, has_text=option_text)
    ).first
    if radio.count() == 0:
        radio = fi.get_by_text(option_text, exact=True).first
    radio.click()
    page.wait_for_timeout(150)


def fill_switch(page, label, on=True):
    fi = _form_item(page, label)
    sw = fi.locator(S.EL_SWITCH).first
    is_checked = sw.evaluate("el => el.classList.contains('is-checked')")
    if on and not is_checked:
        sw.click()
    elif (not on) and is_checked:
        sw.click()
    page.wait_for_timeout(150)


def fill_multi_select(page, label, *option_texts):
    fi = _form_item(page, label)
    fi.click()
    page.wait_for_timeout(300)
    for v in option_texts:
        page.locator(f"{S.EL_SELECT_DROPDOWN_ITEM}:visible", has_text=str(v)).first.click()
        page.wait_for_timeout(150)
    page.locator("body").click(position={"x": 0, "y": 0})
    page.wait_for_timeout(200)


def fill_time_select(page, label, value, index=0):
    """el-time-select（如开放时段起/止）。value 形如 "09:00"；index 用于同 label 多个 time-select。"""
    fi = _form_item(page, label)
    trigger = fi.locator(".el-select").nth(index)
    trigger.click()
    page.wait_for_timeout(300)
    page.locator(f"{S.EL_SELECT_DROPDOWN_ITEM}:visible", has_text=str(value)).first.click()
    page.wait_for_timeout(150)


def fill_rich_text(page, label, html):
    """富文本（Quill .ql-editor / contenteditable）：evaluate 设 innerHTML。"""
    fi = _form_item(page, label)
    editor = fi.locator(".ql-editor").first
    if editor.count() == 0:
        editor = fi.locator("[contenteditable='true']").first
    if editor.count() == 0:
        editor = page.locator(".ql-editor, [contenteditable='true']").last
    editor.click()
    page.wait_for_timeout(150)
    editor.evaluate("(el, val) => { el.innerHTML = val; el.dispatchEvent(new Event('input', {bubbles:true})); }", html)
    page.wait_for_timeout(150)


def fill_file_upload(page, label, file_path):
    """FileUpload：filechooser 监听 + set_files。"""
    fi = _form_item(page, label)
    trigger = fi.locator(".el-upload").first
    if trigger.count() == 0:
        trigger = fi.get_by_role("button").first
    with page.expect_file_chooser(timeout=cfg.TIMEOUT) as fc_info:
        trigger.click()
    fc_info.value.set_files(str(file_path))
    page.wait_for_timeout(500)


def click_action_in_row(page, keyword, btn_text):
    """在含 keyword 的行内点击指定操作按钮（编辑/删除/详情/审批...）。"""
    r = wait_for_row(page, keyword)
    if r is None or r.count() == 0:
        raise AssertionError(f"未找到含「{keyword}」的行，无法点击「{btn_text}」")
    btn = r.get_by_role("button", name=btn_text, exact=True)
    if btn.count() == 0:
        btn = r.get_by_text(btn_text, exact=True)
    btn.first.click()
    page.wait_for_timeout(400)


# ============ 搜索 / 删除 / 提示 ============
def search(page, keyword=None):
    if keyword is not None:
        si = page.locator(".el-form .el-input__inner:visible").first
        si.fill("")
        si.fill(str(keyword))
    page.get_by_role("button", name=S.BTN_SEARCH, exact=True).first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)


def delete_row(h, page, keyword, confirm=True):
    click_action_in_row(page, keyword, S.BTN_DELETE)
    if confirm:
        confirm_msgbox(page)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)


def confirm_msgbox(page):
    mb = page.locator(S.EL_MESSAGEBOX)
    mb.wait_for(state="visible", timeout=cfg.TIMEOUT)
    mb.get_by_role("button", name=S.BTN_SUBMIT, exact=True).click()
    page.wait_for_timeout(300)


def expect_success(page):
    try:
        page.wait_for_selector(".el-message--success, .el-message.is-success", timeout=cfg.TIMEOUT)
    except Exception:
        try:
            page.wait_for_selector(".el-message", timeout=3000)
        except Exception:
            pass


# ============ 角色权限菜单树（el-tree show-checkbox）============
# 原则 #4 用：按「可见菜单名」勾选节点（UI 不暴露权限串）。详见 references/negative-testing.md。
def check_menu_tree_node(page, *labels, root=None):
    root = root or dialog_root(page)
    for label in labels:
        node = _find_tree_node(root, label)
        if node is None:
            raise AssertionError(f"菜单树未找到节点「{label}」")
        cb = node.locator(S.EL_CHECKBOX).first
        is_checked = cb.locator(".el-checkbox__input").first.evaluate(
            "el => el.classList.contains('is-checked') || el.classList.contains('is-indeterminate')"
        )
        if not is_checked:
            cb.click()
            page.wait_for_timeout(150)


def _find_tree_node(root, label):
    labels_loc = root.locator(S.EL_TREE_NODE_LABEL)
    for i in range(labels_loc.count()):  # 精确优先
        try:
            if labels_loc.nth(i).inner_text(timeout=500).strip() == label:
                return labels_loc.nth(i).locator("xpath=ancestor::div[contains(@class,'el-tree-node')][1]").first
        except Exception:
            continue
    for i in range(labels_loc.count()):  # 包含兜底
        try:
            if label in labels_loc.nth(i).inner_text(timeout=500):
                return labels_loc.nth(i).locator("xpath=ancestor::div[contains(@class,'el-tree-node')][1]").first
        except Exception:
            continue
    return None
