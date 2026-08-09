# -*- coding: utf-8 -*-
"""
移动端 H5（uni-app）UI 操作原子（纯 UI，原则 #1）。

【这是模板】覆盖自研组件 field/toast/dialog/tab/chip + 原生 <picker>（H5 <uni-picker>）
+ 列表卡片回验。**所有 class 取自真实组件源**（references/mobile-uniapp.md），不是 Vant/Element 默认值。
{{ADAPT}}：selectors.MOBILE_* 已集中 class；这里机制基本通用，按真实 DOM 微调。

原生 <picker> 是 #1 校准点：本机/无后端无法验证滚轮选中，README 标注首次真跑需校准。
**不直连后端**；读后端、发请求一律由被测前端自身完成，这里只驱动 DOM 与断言文本。
"""
import time

import config as cfg
from lib import selectors as S


# ============ 导航 ============
def goto(page, route_key):
    """跳到 hash 路由（route_key 取自 selectors.MOBILE_ROUTES）。"""
    page.goto(f"{cfg.BASE_URL_MOBILE}#{S.MOBILE_ROUTES[route_key]}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def goto_path(page, path):
    """直接跳已知 path（形如 /pages/xxx/yyy）。"""
    page.goto(f"{cfg.BASE_URL_MOBILE}#{path}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def navigate_tabbar(page, which):
    """点底部 TabBar。which ∈ selectors.MOBILE_TABBAR_LABELS 的 key。"""
    text = S.MOBILE_TABBAR_LABELS.get(which, which)
    page.locator(S.MOBILE_TABBAR_TAB, has_text=text).first.click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)


# ============ 字段输入（按 label 或 placeholder）============
def _field_root(page, label_or_placeholder):
    root = page.locator(S.MOBILE_FIELD).filter(
        has=page.locator(S.MOBILE_FIELD_LABEL, has_text=label_or_placeholder)
    )
    if root.count() == 0:
        root = page.locator(S.MOBILE_FIELD).filter(
            has=page.locator(f"[placeholder='{label_or_placeholder}'], [placeholder*='{label_or_placeholder}']")
        )
    return root.first


def input_(page, label_or_placeholder, value):
    root = _field_root(page, label_or_placeholder)
    inp = root.locator(S.MOBILE_FIELD_INPUT).first
    inp.wait_for(state="visible", timeout=cfg.TIMEOUT)
    inp.click()
    inp.fill("")
    inp.fill(str(value))
    page.wait_for_timeout(120)


def textarea(page, label_or_placeholder, value):
    root = _field_root(page, label_or_placeholder)
    ta = root.locator(S.MOBILE_FIELD_TEXTAREA).first
    ta.wait_for(state="visible", timeout=cfg.TIMEOUT)
    ta.click()
    ta.fill("")
    ta.fill(str(value))
    page.wait_for_timeout(120)


# ============ chip / tab / 提交 ============
def chip(page, text):
    """点 chip（类型/天数/通用）按文案。{{ADAPT}} chip class 按真实补。"""
    chip_loc = page.locator(".type-chip, .day-chip, .chip", has_text=text).first
    chip_loc.wait_for(state="visible", timeout=cfg.TIMEOUT)
    chip_loc.click()
    page.wait_for_timeout(150)


def tab(page, text):
    tab_loc = page.locator(".tab, .tab-capsule", has_text=text).first
    tab_loc.wait_for(state="visible", timeout=cfg.TIMEOUT)
    tab_loc.click()
    page.wait_for_timeout(300)


def submit(page, text):
    btn = page.locator(S.MOBILE_SUBMIT, has_text=text).first
    btn.wait_for(state="visible", timeout=cfg.TIMEOUT)
    btn.click()
    page.wait_for_timeout(300)


# ============ Toast / Dialog ============
def expect_toast(page, text, timeout_ms=None):
    """等顶部 toast 文本包含 text（消失快，要快）。返回是否出现。"""
    timeout_ms = timeout_ms or cfg.TIMEOUT
    end = time.time() + timeout_ms / 1000
    while time.time() < end:
        node = page.locator(S.MOBILE_TOAST_TEXT)
        try:
            if node.first.is_visible(timeout=1000) and text in node.first.inner_text(timeout=1000):
                return True
        except Exception:
            pass
        time.sleep(0.15)
    return False


def confirm(page, timeout_ms=None):
    btn = page.locator(S.MOBILE_DIALOG_CONFIRM).first
    btn.wait_for(state="visible", timeout=timeout_ms or cfg.TIMEOUT)
    btn.click()
    page.wait_for_timeout(300)


def cancel(page, timeout_ms=None):
    btn = page.locator(S.MOBILE_DIALOG_CANCEL).first
    btn.wait_for(state="visible", timeout=timeout_ms or cfg.TIMEOUT)
    btn.click()
    page.wait_for_timeout(300)


# ============ 原生 <picker>（H5 <uni-picker>）—— #1 校准点 ============
def _open_picker(page, trigger_text):
    trig = page.locator(S.MOBILE_PICKER_TRIGGER, has_text=trigger_text).first
    trig.wait_for(state="visible", timeout=cfg.TIMEOUT)
    trig.click()
    page.wait_for_selector(S.MOBILE_UNI_PICKER_PANEL, state="visible", timeout=cfg.TIMEOUT)
    page.wait_for_timeout(450)  # 等滚轮渲染稳定


def _confirm_picker(page):
    confirm_btn = page.locator(S.MOBILE_UNI_PICKER_CONFIRM).first
    if confirm_btn.count() == 0:
        confirm_btn = page.locator(f"{S.MOBILE_UNI_PICKER_PANEL} button").get_by_text("确定").first
    confirm_btn.click()
    page.wait_for_timeout(300)


def _select_in_column(page, value, column=0):
    cols = page.locator(f"{S.MOBILE_UNI_PICKER_PANEL} .uni-picker-column")
    if cols.count() == 0:
        cols = page.locator(S.MOBILE_UNI_PICKER_PANEL)
    col = cols.nth(column)
    items = col.locator(S.MOBILE_UNI_PICKER_ITEM)
    for i in range(items.count()):
        try:
            if value in items.nth(i).inner_text(timeout=500):
                items.nth(i).click()
                page.wait_for_timeout(150)
                return True
        except Exception:
            continue
    # 兜底：滚到可见再点（首次真跑校准用）
    try:
        col.evaluate(
            """(el, args) => {
                const items = el.querySelectorAll('.uni-picker-item');
                const idx = Array.from(items).findIndex(it => (it.textContent||'').includes(args.value));
                if (idx >= 0 && items[idx]) { items[idx].scrollIntoView({block:'center'}); items[idx].click(); }
            }""",
            {"value": value},
        )
        return True
    except Exception:
        return False


def native_picker(page, trigger_text, value, column=0):
    """单列 range picker（如选择某项）。"""
    _open_picker(page, trigger_text)
    _select_in_column(page, value, column)
    _confirm_picker(page)


def native_date(page, trigger_text, date_str):
    """日期 picker（mode=date），date_str 形如 YYYY-MM-DD，三列滚轮。"""
    _open_picker(page, trigger_text)
    y, m, d = date_str.split("-")
    _select_in_column(page, y, 0)
    _select_in_column(page, str(int(m)), 1)
    _select_in_column(page, str(int(d)), 2)
    _confirm_picker(page)


def native_time(page, trigger_text, time_str):
    """时间 picker（mode=time），time_str 形如 HH:mm，两列滚轮。"""
    _open_picker(page, trigger_text)
    h, mm = time_str.split(":")
    _select_in_column(page, str(int(h)), 0)
    _select_in_column(page, str(int(mm)), 1)
    _confirm_picker(page)


def upload_file(page, trigger_text_or_locator, file_path):
    """文件上传（如照片/文件）。trigger 可为文案或已定位元素。"""
    with page.expect_file_chooser(timeout=cfg.TIMEOUT) as fc_info:
        if isinstance(trigger_text_or_locator, str):
            page.get_by_text(trigger_text_or_locator).first.click()
        else:
            trigger_text_or_locator.click()
        # 若弹 ActionSheet（从相册/拍照），点一项以触发 chooser
        try:
            page.locator(".action-sheet-item, .uni-actionsheet__button").first.click(timeout=2000)
        except Exception:
            pass
    fc_info.value.set_files(str(file_path))
    page.wait_for_timeout(500)


# ============ 列表卡片回验（原则 #2）============
def _cards(page):
    return page.locator(S.MOBILE_CARD)


def wait_card(page, title, timeout_ms=None):
    timeout_ms = timeout_ms or cfg.TIMEOUT
    end = time.time() + timeout_ms / 1000
    while time.time() < end:
        card = _cards(page).filter(has_text=title).first
        try:
            if card.is_visible(timeout=1000):
                return card
        except Exception:
            pass
        time.sleep(0.3)
    return None


def assert_card(h, page, title, msg=None):
    card = wait_card(page, title)
    if card is None:
        h.screenshot(page, f"mob_card_{int(time.time())}")
        raise AssertionError(f"回验失败：移动端列表未找到卡片「{title}」。{msg or ''}")
    return card


def assert_card_gone(h, page, title, msg=None):
    end = time.time() + cfg.TIMEOUT / 1000
    while time.time() < end:
        card = _cards(page).filter(has_text=title).first
        try:
            visible = card.is_visible(timeout=1000)
        except Exception:
            visible = False
        if not visible:
            return True
        time.sleep(0.3)
    h.screenshot(page, f"mob_cardgone_{int(time.time())}")
    raise AssertionError(f"回验失败：移动端列表仍存在卡片「{title}」。{msg or ''}")


def card_status(page, title):
    """读卡片状态文本（.status-badge / .status）。"""
    card = wait_card(page, title)
    if card is None:
        return ""
    for sel in (S.MOBILE_STATUS_BADGE, ".status"):
        node = card.locator(sel).first
        if node.count():
            try:
                return node.inner_text(timeout=1500).strip()
            except Exception:
                continue
    return ""
