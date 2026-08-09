# -*- coding: utf-8 -*-
"""移动端 H5 登录 / 绑定 / 切换身份（纯 UI，原则 #1）。

【这是模板】机制通用；{{ADAPT}} 点：微信一键登录按钮 class、账号登录 tab 文案、
绑定页字段 placeholder、设密弹窗「跳过」按钮、token 存储键名。
关键事实：H5 下用 storage 里持久的「dev 登录码」区分身份 → 每个新 context = 新身份，
满足「一人一绑」与跨端多用户可见性测试。

**不直连后端**；登录/绑定请求由被测前端自身发起，本模块只驱动 UI、读 token、回验 DOM。
"""
import time

import config as cfg
from lib import selectors as S


def _token(page):
    try:
        return page.evaluate(f"() => localStorage.getItem({S.MOBILE_ACCESS_TOKEN_KEY!r})")
    except Exception:
        return None


def wait_token(page, timeout_ms=None):
    timeout_ms = timeout_ms or cfg.TIMEOUT
    end = time.time() + timeout_ms / 1000
    while time.time() < end:
        t = _token(page)
        if t:
            return t
        time.sleep(0.3)
    return None


def clear(page):
    try:
        page.evaluate("() => localStorage.clear()")
    except Exception:
        pass


def wx_login(h, page):
    """驱动微信一键登录；成功返回 token。{{ADAPT}} 按钮文案/class 按真实登录页。"""
    from lib import minigram_ui
    minigram_ui.goto(page, "login")
    btn = page.locator(".btn-wechat").first  # {{ADAPT}}
    btn.wait_for(state="visible", timeout=cfg.TIMEOUT)
    btn.click()
    token = wait_token(page)
    if not token:
        h.screenshot(page, f"mob_wxlogin_{int(time.time())}")
        raise AssertionError("移动端登录未获取到 token（检查后端 Mock 模式 / 应用授权）")
    return token


def account_login(h, page, account, password):
    """账号密码登录（须已绑定并设密）。{{ADAPT}} tab/placeholder/按钮按真实页。"""
    from lib import minigram_ui
    minigram_ui.goto(page, "login")
    page.locator(".tab", has_text="账号登录").first.click()  # {{ADAPT}}
    page.wait_for_timeout(300)
    page.get_by_placeholder("请输入账号").fill(account)          # {{ADAPT}}
    page.get_by_placeholder("请输入密码").fill(password)          # {{ADAPT}}
    page.locator(".btn.btn-primary").first.click()                # {{ADAPT}}
    token = wait_token(page)
    if not token:
        h.screenshot(page, f"mob_pwdlogin_{int(time.time())}")
        raise AssertionError("移动端账号登录未获取到 token")
    return token


def bind(h, page, account, invite_code, name):
    """驱动绑定：填账号/邀请码/姓名 → 绑定 → 跳过设密弹窗。成功返回新 token。
    {{ADAPT}} placeholder / 提交按钮 / 跳过按钮文案按真实绑定页。"""
    from lib import minigram_ui
    minigram_ui.goto(page, "bind")  # {{ADAPT}} 绑定路由 key
    page.get_by_placeholder("账号", exact=False).first.fill(account)
    page.get_by_placeholder("邀请码", exact=False).first.fill(invite_code)
    page.get_by_placeholder("姓名", exact=False).first.fill(name)  # {{ADAPT}}
    page.locator(".submit").first.click()
    try:
        page.get_by_text("跳过", exact=True).first.click(timeout=5000)  # {{ADAPT}}
    except Exception:
        pass
    token = wait_token(page)
    if not token:
        h.screenshot(page, f"mob_bind_{int(time.time())}")
        raise AssertionError("绑定后未获取到新 token")
    return token


def expect_bind_error(h, page, account, invite_code, name, error_substring):
    """负向：绑定应失败并提示 error_substring。返回是否出现该提示。"""
    from lib import minigram_ui
    minigram_ui.goto(page, "bind")
    page.get_by_placeholder("账号", exact=False).first.fill(account)
    page.get_by_placeholder("邀请码", exact=False).first.fill(invite_code)
    page.get_by_placeholder("姓名", exact=False).first.fill(name)
    page.locator(".submit").first.click()
    try:
        tip = page.locator(".tip").first
        tip.wait_for(state="visible", timeout=cfg.TIMEOUT)
        return error_substring in tip.inner_text()
    except Exception:
        h.screenshot(page, f"mob_bind_neg_{int(time.time())}")
        return False
