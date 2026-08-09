# 架构——`lib/` 分层

生成的套件有一个固定的、浅的分层。每个文件只干一件事。通用文件（来自 `assets/lib-skeletons/`）几乎不用改；适配文件（来自 `assets/adapt-skeletons/` + 某份变体参考）承载项目的具体内容。

## 分层一览

| 文件 | 职责 | 通用 / 适配 | 来源 |
|---|---|---|---|
| `config.py` | 可被环境变量覆盖的 URL、账号、超时、数据前缀 | 通用 | `lib-skeletons/config.py.tpl` |
| `state.py` | 跨用例共享状态（创建出的实体名/id） | 通用 | `lib-skeletons/state.py` |
| `data_factory.py` | 确定性测试数据生成器（`run_tag + idx`） | 通用（形态需适配） | `lib-skeletons/data_factory.py.tpl` |
| `lib/harness.py` | Playwright 引擎 + `Findings` 被动监听器 + `expect_response` | 通用 | `lib-skeletons/harness.py` |
| `lib/sessions.py` | 身份缓存的 web 登录 + 每访客独立移动端上下文 | 通用 | `lib-skeletons/sessions.py` |
| `run_all.py` | 有序运行器 + 报告（`TEST_REPORT.md` + `findings.json` + 截图） | 通用 | `lib-skeletons/run_all.py.tpl` |
| `lib/selectors.py` | 集中选择器/路由登记表 | **适配** | `adapt-skeletons/selectors.py.tpl` |
| `lib/web_crud.py` | web UI 原子（fill_*、read_cell、find_row、open_module、submit_dialog……） | **适配**（按框架） | `adapt-skeletons/web_crud.py.tpl` + 变体参考 |
| `lib/web_login.py` | web 登录驱动 | **适配** | `adapt-skeletons/web_login.py.tpl` |
| `lib/mobile_ui.py` | 移动端 UI 原子（字段、chip、toast、弹窗、原生 picker、卡片） | **适配**（如有移动端） | `adapt-skeletons/minigram_ui.py.tpl` + 变体参考 |
| `lib/mobile_login.py` | 移动端登录 + 绑定驱动 | **适配**（如有移动端） | `adapt-skeletons/minigram_login.py.tpl` |
| `lib/web_entities.py` | 实体构造器：开→填→提交→断言→返回 | **适配**（按实体） | `adapt-skeletons/web_entities.py.tpl` |
| `lib/role_builder.py` | 角色/用户的 UI 准备（菜单树勾选、用户弹窗） | **适配**（如多角色） | `adapt-skeletons/web_entities.py.tpl` 模式 |
| `lib/verify.py` | 大屏/驾驶舱 DOM 文本校验器 | **适配**（如有大屏） | 探索驱动 |
| `tests/test_XX_*.py` | 每条一个业务流 | **适配** | `adapt-skeletons/test_template.py.tpl` |

## 为什么这样分

- **通用层是纯管道**——Playwright 生命周期、被动监听、身份会话、确定性数据、有序执行 + 报告。它们在项目间完全一致；拷贝骨架省得每次重造，并保持行为一致（例如 `expect_response` 机制到处都一样工作）。
- **适配层是项目落地之处**——它的选择器、它的组件库原子、它的实体、它的流程。阶段 1 探索的成果就喂到这里。
- **`selectors.py` 是唯一事实源**——每个 label/placeholder/按钮文案/路由/class 都集中在这，这样改一处 UI 文案就是改一个文件，而不是满测试去找。

## 命名约定（保持一致——测试就靠它找辅助函数）

- `h` = Harness 实例（作为每个 `run(h)` 的第一个参数传入）。
- `page` = 一个已登录的 Playwright page。
- `crud.open_module(h, page, key)`——按侧边栏菜单导航（key 来自 `selectors.WEB_MENU`）。
- `crud.fill_text/fill_radio/fill_select/fill_tree_select(page, label, value)`——按 label 填一个表单项。
- `crud.read_cell(page, keyword, column_label)`——按行关键字 + 列头读一个表格单元格。
- `crud.find_row/row_exists/assert_row_exists/assert_row_gone(page, keyword)`。
- `crud.submit_dialog(page)` / `crud.confirm_msgbox(page)` / `crud.expect_success(page)`。
- `sessions.get_web(h, persona)`——缓存的 web 登录；`sessions.new_mobile(h, tag)`——全新的访客上下文。
- 实体构造器：`ensure_<entity>(h, page, ..., idx) -> (name, ...ids)`，幂等（搜索 → 不存在才建 → 断言 → 返回）。
- 每条测试：`ID, NAME = "TC-NN", "..."`，`def run(h): ...`。

## 确定性数据（`data_factory`）

每个 name/code/phone 都必须是确定性的，这样重跑才幂等、才好避免冲突。模式：一个 `run_tag()`（每次运行固定，如日期派生的 tag）+ 每个实体一个整数 `idx` → 唯一字符串。账号/邀请码从 phone 派生，这样绑定可复现。这正是让 `ensure_*` 跨运行幂等的关键。

## 幂等性 & 一次性资源

- `ensure_*` 先搜后建——重跑时复用。
- 一对一的绑定（如一个员工 ↔ 一个移动访客）必须用**每个测试独占的一次性 idx**，否则重跑撞车。记录每个测试占用哪些 idx。
