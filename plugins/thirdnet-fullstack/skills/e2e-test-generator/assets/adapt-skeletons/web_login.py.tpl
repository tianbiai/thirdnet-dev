# -*- coding: utf-8 -*-
"""Web 后台登录驱动（纯 UI，原则 #1）。

【这是模板】机制通用；{{ADAPT}} 点：placeholder/按钮文案取自真实登录页；
验证码字段是否出现按真实页面探测（dev 通常关闭）；登录后落地的首页路由按项目改。
"""
import config as cfg
from lib import selectors as S


def login(h, page, user=None, pwd=None):
    """驱动真实登录表单。验证码字段若存在则填占位值（dev 多关闭；若开启且无法识别，
    会在后续断言处暴露——届时把校准点写进 README）。"""
    user = user or cfg.ADMIN_USER
    pwd = pwd or cfg.ADMIN_PWD
    page.goto(f"{cfg.BASE_URL_WEB}/login")          # {{ADAPT}} 登录路由
    page.wait_for_load_state("networkidle")
    page.get_by_placeholder(S.LOGIN_USER_PH).fill(user)
    page.get_by_placeholder(S.LOGIN_PWD_PH).fill(pwd)
    captcha = page.get_by_placeholder(S.LOGIN_CAPTCHA_PH)
    if captcha.count() and captcha.first.is_visible():
        captcha.first.fill("abcd")
    page.get_by_role("button", name=S.LOGIN_BTN_TEXT).click()
    # 登录成功后离开 /login 并加载动态路由
    page.wait_for_url(lambda u: "/login" not in u, timeout=cfg.TIMEOUT)
    page.wait_for_load_state("networkidle")
    page.goto(f"{cfg.BASE_URL_WEB}/welcome")        # {{ADAPT}} 进工作台确保动态路由注册完成
    page.wait_for_load_state("networkidle")


def logout(h, page):
    """清除会话后回到登录页。"""
    try:
        page.evaluate("() => { sessionStorage.clear(); localStorage.clear(); }")
    except Exception:
        pass
    page.goto(f"{cfg.BASE_URL_WEB}/login")
    page.wait_for_load_state("networkidle")


def switch_user(h, page, user, pwd):
    logout(h, page)
    login(h, page, user, pwd)
