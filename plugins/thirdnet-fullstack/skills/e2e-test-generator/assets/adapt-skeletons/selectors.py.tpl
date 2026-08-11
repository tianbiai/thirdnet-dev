# -*- coding: utf-8 -*-
"""
选择器 / 路由 / 文案集中维护（**单一事实源**）。
- 所有 label / placeholder / 按钮文案 / 表头 / class / 路由都收在这里；
- 一处改文字，全测试跟着改，不必到各用例里找。
- 文案必须取自真实模板源（Phase 1 探索），勿凭框架默认值猜（见 references/discovery.md）。

【这是模板】凡 {{ADAPT}} 处按本项目探索结论填写。
Element Plus 原子 class 多数稳定（.el-form-item 等），可基本照搬；
「会变」的是菜单名、路由、按钮文案、移动端自研组件 class、token 键名。
"""

# ============ Web 登录页 ============
# {{ADAPT}} 取自 login 页真实 placeholder / 按钮文案
LOGIN_USER_PH = "请输入用户名"
LOGIN_PWD_PH = "请输入密码"
LOGIN_CAPTCHA_PH = "验证码"
LOGIN_BTN_TEXT = "登录"            # {{ADAPT}} 按真实文案（注意可能有空格）

# {{ADAPT}} 前端 token 存储键（sessionStorage/localStorage 都查一遍更稳）
WEB_ACCESS_TOKEN_KEY = "admin_access_token"

# ============ Web 通用 Element Plus 选择器（基本通用，按需调整）============
EL_DIALOG = ".el-dialog"
EL_DIALOG_VISIBLE = ".el-overlay-dialog .el-dialog:not([style*='display: none'])"
EL_TABLE = ".el-table"
EL_TABLE_ROW = ".el-table__row"
EL_FORM_ITEM = ".el-form-item"
EL_FORM_ITEM_LABEL = ".el-form-item__label"
EL_SELECT = ".el-select"
EL_SELECT_DROPDOWN_ITEM = ".el-select-dropdown__item"
EL_TREE_SELECT = ".el-tree-select"
EL_TREE_NODE = ".el-tree-node__content"
EL_MESSAGEBOX = ".el-message-box"
EL_RADIO = ".el-radio"
EL_RADIO_LABEL = ".el-radio__label"
EL_SWITCH = ".el-switch"
EL_CHECKBOX = ".el-checkbox"
EL_TREE_NODE_LABEL = ".el-tree-node__label"   # 角色权限树节点标签（若自定义则改）
EL_TABLE_HEADER_CELL = ".el-table__header-wrapper th"
PAGINATION = ".el-pagination"

# ============ 按钮文案（{{ADAPT}} 按真实文案）============
BTN_ADD = "新增"
BTN_EDIT = "编辑"
BTN_DELETE = "删除"
BTN_DETAIL = "详情"
BTN_SUBMIT = "确定"
BTN_CANCEL = "取消"
BTN_SEARCH = "搜索"
BTN_RESET = "重置"
# {{ADAPT}} 业务动作按钮（审批/受理/完成/发布/下架 等），按项目补：
BTN_EXPAND_ALL = "展开全部"
BTN_ADD_LOCATION = "+ 添加落点"

# 成功提示文案（{{ADAPT}}）
TOAST_SUCCESS_TEXTS = ["操作成功", "成功", "添加成功", "更新成功", "删除成功"]

# ============ Web 模块导航 ============
# (目录名, 菜单名) —— 经侧边栏点击导航（mock/real 一致，规避路由派生坑）。
# {{ADAPT}} 按项目真实侧边栏目录/菜单名填写（取自后端菜单接口或 mock 菜单数据）。
WEB_MENU = {
    # 示例（删掉换成真实项）：
    # "user": ("系统管理", "用户管理"),
    # "role": ("系统管理", "角色管理"),
    # "entity_a": ("业务目录", "实体A"),
}

# ============ 活校准计划（阶段 4b 用，lib/calibrate.py 读它）============
# 每个模块期望的表单 label 列表 + 列表列头列表。{{ADAPT}} 按 Phase 1 探索笔记填。
# 留空也能跑 calibrate.py——退化为「如实报告 DOM 里真实的 label/列头」作发现辅助。
# 这里的 label/列头必须和真实 DOM 文本一致（不是后端字段名）；填好它，活校准才能给你精确的 ✅/❌。
CALIBRATION_PLAN = {
    # "user": {"labels": ["用户名", "姓名", "部门", "角色"], "columns": ["用户名", "姓名", "部门", "状态"]},
}

# 已知稳定的直接路由（page.goto 用，导航更快/更稳）；与 WEB_MENU 互为备选。
# {{ADAPT}} 按前端 router 真实 path 填（仅放确实稳定的）。
WEB_ROUTE = {
    # "user": "/system/user",
    # "entity_a": "/biz/entity-a",
}

# ============ 移动端（H5，hash 路由；无移动端则整段删）============
# {{ADAPT}} 路由取自 pages.json；class 取自项目移动端组件源（自研库 / uView / Vant / uni-ui 等，差异大，务必逐个核对真实 DOM）。
MOBILE_ROUTES = {
    # "login": "/pages/login/index",
    # "home": "/pages/index/index",
}

# 移动端组件 class（{{ADAPT}}，最高风险——务必逐个核对真实 DOM；下方为中性占位，按项目自研/UI 库真实 class 替换）
MOBILE_FIELD = ".field"
MOBILE_FIELD_INPUT = ".field-input"
MOBILE_FIELD_TEXTAREA = ".field-textarea"
MOBILE_FIELD_LABEL = ".field-label"
MOBILE_SUBMIT = ".submit"
MOBILE_TOAST = ".toast"
MOBILE_TOAST_TEXT = ".toast-text"
MOBILE_DIALOG = ".dialog"
MOBILE_DIALOG_CONFIRM = ".dialog-btn.is-confirm"
MOBILE_DIALOG_CANCEL = ".dialog-btn.is-cancel"
MOBILE_CARD = ".card"
MOBILE_STATUS_BADGE = ".status-badge"
MOBILE_TABBAR_TAB = ".tabbar .tab"
MOBILE_TABBAR_LABELS = {"home": "首页", "message": "消息", "mine": "我的"}  # {{ADAPT}}
# 原生 <picker>（H5 <uni-picker>）—— #1 校准点，见 references/mobile-uniapp.md
MOBILE_UNI_PICKER = "uni-picker"
MOBILE_PICKER_TRIGGER = ".picker"
MOBILE_UNI_PICKER_PANEL = ".uni-picker"
MOBILE_UNI_PICKER_ITEM = ".uni-picker-item"
MOBILE_UNI_PICKER_CONFIRM = ".uni-picker-confirm"

# 移动端 token 键（{{ADAPT}} 取自前端 auth store）
MOBILE_ACCESS_TOKEN_KEY = "app_access_token"
