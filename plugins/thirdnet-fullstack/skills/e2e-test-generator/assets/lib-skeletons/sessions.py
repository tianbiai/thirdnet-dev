# -*- coding: utf-8 -*-
"""
会话管理（通用层）：
- web 端：每个 persona 登录一次后缓存复用（admin / 各 scoped role）。登录由 web_login 驱动。
- 移动端：每次 new_mobile = 新 context = 新身份（独立 visitor），满足「一人一绑」与跨端多用户测试。

【通用层】按原样拷贝即可。persona 列表来自 config.WEB_ACCOUNTS（在那里 {{ADAPT}}）。
"""
import config as cfg
from lib import web_login


def get_web(h, persona="admin"):
    """返回已登录的 web 页面（按 persona 缓存）。persona 必须在 cfg.WEB_ACCOUNTS 中。"""
    if not hasattr(h, "_web_sessions"):
        h._web_sessions = {}
        h._web_ctxs = []
    if persona in h._web_sessions:
        return h._web_sessions[persona]
    user, pwd = cfg.WEB_ACCOUNTS[persona]
    ctx = h.new_web_context()
    h._web_ctxs.append(ctx)
    page = ctx.new_page()
    h.attach(page, f"web/{persona}")
    web_login.login(h, page, user, pwd)
    h._web_sessions[persona] = page
    return page


def admin_page(h):
    return get_web(h, "admin")


def new_mobile(h, tag="visitor"):
    """新建一个独立移动端 context（=新身份）。返回 page。无移动端时不会调用。"""
    if not hasattr(h, "_mob_ctxs"):
        h._mob_ctxs = []
    ctx = h.new_mobile_context()
    h._mob_ctxs.append(ctx)
    page = ctx.new_page()
    h.attach(page, f"mob/{tag}")
    return page


def close_all(h):
    for ctx in getattr(h, "_web_ctxs", []) + getattr(h, "_mob_ctxs", []):
        try:
            ctx.close()
        except Exception:
            pass
    h._web_sessions = {}
    h._web_ctxs = []
    h._mob_ctxs = []
