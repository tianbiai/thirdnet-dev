# 变体：uni-app H5 移动端（首选快速通道）

当移动端是编译到 H5 的 uni-app——微信小程序 + H5 双端的一种常见选择——时使用。**组件库因项目而异**（自研库、uView、uni-ui、Vant 等）——所以你必须从源码探索它的原子；下面的 class 名都是要替换的占位符。本参考给出的是一套真实套件里跑通的形态。

## 字段原子——按 label 定位

一个字段是左边一个 label 单元格、右边一个控件的行。把行过滤到 label 匹配的那一行来定位。

```python
def _field(page, label):
    return page.locator(".field, .form-row").filter(has_text=label).last

def fill_text(page, label, value):     _field(page,label).locator("input").first.fill(value)
def fill_textarea(page, label, value): _field(page,label).locator("textarea").first.fill(value)
def tap_chip(page, label, option):     _field(page,label).locator(".chip,.tag", has_text=option).click()
def choose_action(page, *path):        # 一个“选择”单元格 -> ActionSheet -> 按文本点项
```

> 从项目的组件源码探索真实的容器/label/input class（例如它可能是 `.field-row`、`.item-label`、`.uni-input`，或某个自研库的 class）。用你找到的替换这里的 class。**绝不假设某个特定库的 class**（如 Vant 的 `.van-field`）——从真实源码确认，因为 uni-app 项目用很多不同的 UI 库。

## Toast、弹窗、ActionSheet

```python
def expect_toast(page, text):          page.locator(".toast,.uni-toast").filter(has_text=text).wait_for()
def confirm_dialog(page):              page.get_by_role("button", name="确定|确认").click()
def cancel_dialog(page):               page.get_by_role("button", name="取消").click()
def tap_action_item(page, text):       page.locator(".action-sheet-item,.uni-actionsheet__button", has_text=text).click()
```

H5 的 toast 可能转瞬即逝（1–2s）。优先用 `expect_toast`（会等）而非稍后再查。如果某个 toast 抖动不稳，一个*后续的*回验（列表里出现新项）是可靠的替代。

## 回验——列表卡片

移动端列表通常是卡片，不是表格。按卡片文本读：

```python
def card_exists(page, keyword):    page.locator(".card,.item,.uni-list-cell", has_text=keyword).first
def card_status(page, keyword):    # 匹配卡片内的状态徽章/标签
    card_exists(page,keyword).locator(".status,.badge,.tag").inner_text()
def assert_card_status(page, keyword, status): expect_status_badge(...)
```

## 原生 `<picker>`——#1 校准风险

uni-app 的日期/时间/地区 `<picker>` 在 H5 里渲染为 `<uni-picker>` → 一个带列 + 确认按钮的滚轮（`.uni-picker`）。它**不是**原生 `<select>`，也**不是**日历弹层。从真实 DOM 建辅助函数是必须的；把它作为**校准点**标在 README 里，并告诉用户首次真实环境运行时微调。

典型形态（对着真实 DOM 确认）：
```python
def fill_picker(page, label, value):
    _field(page, label).click()                      # 打开滚轮
    # 滚轮列：.uni-picker-column .uni-picker-item；确认按钮文案 “确定”/“完成”
    # value 形如 "08:00" 或 "2026-08-08"：在每列里选匹配项
    page.locator(".uni-picker__action .uni-picker__confirm, button", has_text="确定").click()
```
**为什么脆弱：** 列数、项文本格式、确认按钮 class 在 uni-app/Vant 各版本间不同。首次运行时值可能落偏一格（滚轮索引对不上）——这是预期的，记下来，让用户微调 selector 或改用键盘输入兜底。

### 文件上传（如一张照片）

```python
def upload_file(page, trigger_text, file_path):
    with page.expect_file_chooser() as fc_info:
        page.get_by_text(trigger_text).click()       # 或点 头像/上传 按钮
        # 若弹 ActionSheet（“从相册选择”/“拍照”），点一项以打开 chooser
    fc_info.value.set_files(file_path)
```
用 `page.expect_file_chooser()` 包住点击是稳健的模式；uni-app 的 `<uni-file-picker>` / `<input type=file>` 最终都会触发原生 chooser。

## 导航——底部 tab + 页面跳转

```python
def goto_tab(page, tab_text):    page.locator(".uni-tabbar .uni-tabbar__item, .tabbar-item", has_text=tab_text).click()
def go_back(page):               page.locator(".nav-bar .back, .uni-icons-back").click()
```
页面注册在 `pages.json`（探索时读它）；靠点击进入流程来导航，别写死 `/pages/...` 路径（uni-app H5 路由很怪）。

## 绑定 / 一键 流程

移动端认证模式各异：密码登录、短信验证码登录、或（微信生态里）微信一键登录 → 绑定账号流程（手机号 + 邀请码）。探索确切字段和按钮文案。一个访客可能需要*全新*的浏览器上下文（绑定是一对一的）——见 `sessions.new_mobile`。

## 这个变体该往 `selectors.py` 里放什么

```python
MOBILE_FIELD=".field"; MOBILE_CARD=".card"
MOBILE_TOAST=".toast"; MOBILE_ACTION_ITEM=".action-sheet-item"
MOBILE_TAB=".uni-tabbar .uni-tabbar__item"
MOBILE_TABS = {"home":"首页","search":"搜索","orders":"订单","mine":"我的"}    # 来自探索
MOBILE_SUBMIT_TEXTS = ["提交","确认","发送","保存"]
```

完整的、要适配的辅助函数集见 `assets/adapt-skeletons/minigram_ui.py.tpl`。
