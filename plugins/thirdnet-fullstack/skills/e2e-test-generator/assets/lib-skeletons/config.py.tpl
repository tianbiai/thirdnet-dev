# -*- coding: utf-8 -*-
"""
全局配置 —— 所有可变参数集中于此，便于按实际环境覆盖。
可改本文件，也可用环境变量覆盖（环境变量优先）。

【这是模板】带 {{ADAPT}} 的地方需按本项目 Phase 1 探索结论填写。
"""
import os

# ---------- 服务地址 ----------
# {{ADAPT}} 按本项目实际端口/地址填写（下方 localhost 仅为示例默认值，用环境变量覆盖）。
BASE_URL_WEB = os.getenv("E2E_WEB_URL", "http://localhost:3000")
BASE_URL_MOBILE = os.getenv("E2E_MOBILE_URL", "http://localhost:5173")   # 无移动端可删
# 后端 API 仅用于「健康检查」（被动探活），测试代码绝不直连其业务接口（原则 #1）。
BACKEND_BASES = [b for b in os.getenv("E2E_BACKEND_URLS", "").split(",") if b]  # 如 "http://localhost:5000,http://localhost:5001"

# ---------- 账号 ----------
# 种子超管（首次 bootstrap/role-setup 用）
ADMIN_USER = os.getenv("E2E_ADMIN_USER", "admin")
ADMIN_PWD = os.getenv("E2E_ADMIN_PWD", "admin@123")

# {{ADAPT}} 测试角色账号 —— 由 scaffold/role 用例创建；密码须满足项目策略。
ROLE_PWD = os.getenv("E2E_ROLE_PWD", "E2e@123")
# 把「persona key」映射到账密：persona 即你用 sessions.get_web(h, persona) 时的 key。
# 留多少个角色取决于原则 #4（多角色 + 数据范围 + 负向）覆盖需要。
WEB_ACCOUNTS = {
    "admin": (ADMIN_USER, ADMIN_PWD),
    # {{ADAPT}} 示例（实际 persona/key/账号按项目命名）：
    # "scope_role_a": ("e2e_role_a", ROLE_PWD),
    # "scope_role_b": ("e2e_role_b", ROLE_PWD),
}

# ---------- 通用 ----------
DATA_PREFIX = os.getenv("E2E_DATA_PREFIX", "E2E_")        # 所有测试数据前缀，便于识别/清理
HEADLESS = os.getenv("E2E_HEADLESS", "true").lower() == "true"
TIMEOUT = int(os.getenv("E2E_TIMEOUT", "20000"))          # 单次操作默认超时(ms)
SLOW_MO = int(os.getenv("E2E_SLOWMO", "0"))

# 视口
WEB_VIEWPORT = {"width": 1600, "height": 900}
MOBILE_VIEWPORT = {"width": 390, "height": 844}

# ---------- 产物目录 ----------
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")

# ---------- 后端健康检查（仅探活，不测业务）----------
# {{ADAPT}} 按项目健康检查端点填写；BACKEND_HEALTH[(base,path)]，path 可空字符串跳过。
BACKEND_HEALTH = {}
HEALTH_TIMEOUT = int(os.getenv("E2E_HEALTH_TIMEOUT", "180"))


def ensure_artifacts():
    os.makedirs(os.path.join(ARTIFACTS_DIR, "screenshots"), exist_ok=True)
