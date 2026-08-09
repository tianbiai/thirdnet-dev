# {{项目名}} E2E UI 测试套件

纯 UI 驱动的 Playwright（Python）端到端测试。**测试代码不直连后端**——所有业务操作通过驱动真实 UI（开弹窗 → 按 label 填表 → 提交 → 从 DOM 文本回验），请求一律由被测前端自身发出。

> **这套件在哪跑**：生成这台机器不假设能连通待测系统。真实 URL/账号/密码由**执行者**在运行时用环境变量提供，在**可连通测试环境的机器**上跑（`run_all.py` 先健康检查轮询，再驱动真实 UI）。生成阶段只跑 `py_compile`，真正的 pass/fail 在运行阶段发生。

## 环境与安装

```bash
pip install playwright
playwright install chromium
```

配置（改 `config.py` 或用环境变量覆盖）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `E2E_WEB_URL` | http://localhost:3000 | 后台地址 |
| `E2E_MOBILE_URL` | http://localhost:5173 | 移动端 H5 地址（无则忽略） |
| `E2E_ADMIN_USER` / `E2E_ADMIN_PWD` | admin / ... | 种子超管 |
| `E2E_HEADLESS` | true | 无头模式 |
| `E2E_TIMEOUT` | 20000 | 单步超时(ms) |

## 运行

```bash
# 后端已起好（健康检查跳过）
python run_all.py --skip-ready

# 让脚本轮询后端就绪后再跑
python run_all.py
```

用例按 `run_all.py` 的 `TEST_MODULES` 顺序执行；单个失败不中断后续。

## 产物

- `TEST_REPORT.md` —— 用例概览 + 自动捕获的潜在问题（意外 4xx/5xx、console/pageerror）+ 失败详情
- `artifacts/findings.json` —— 原始结果 + findings + state
- `artifacts/screenshots/*.png` —— 回验/失败截图

## 5 条原则（每条用例都遵守）

1. **纯 UI 驱动**——开真实弹窗、按 label 填表、提交、从 DOM 回验；测试代码不直连后端。
2. **写入即回验**——每次 create/update/delete 后立即在同端 DOM 确认。
3. **跨端一致性**——数据在一端产生后，在相关端断言可见/状态。
4. **多角色 + 数据范围 + 负向**——越权断言按钮/菜单 DOM **不存在**（非 403）。
5. **被动监听**——console/pageerror/4xx-5xx 只观察；预期失败（如冲突 409）在代码里标记为预期。

## 校准点（首次真跑需重点核对）

这些交互在「无后端/无真机」生成阶段无法完全验证，首次接入真实环境时请优先核对：

- **原生 `<picker>`（日期/时间/单选滚轮）**：H5 渲染为 `<uni-picker>` 滚轮，列数/项文本/确认按钮 class 随版本变化。首次可能落点偏一格 → 微调 `lib/minigram_ui.py` 的 `_select_in_column` 或改用键盘输入兜底。
- **文件上传（如照片/文件）**：`expect_file_chooser` 机制稳健，但触发器（按钮 / ActionSheet / 头像点击）与成功提示文案随页而异 → 核对触发方式与 toast 文案。
- **一次性绑定关系**：一人一绑（如账号↔移动访客）须用「每用例独占的 idx」，否则重跑撞车。各用例占用的 idx 见 `TEST_PLAN.md`。
- **系统生成/只读数据**：事件日志、审计记录、设备遥测等页只在真实管线有数据；测试环境可能为空 → 断言「页面正常渲染（表格或空态）无报错」，而非「有数据行」。
- **状态依赖异步**：需后端管线推进的状态（如某记录停在「待同步/处理中」直到外部系统拉取）在测试环境可能停在中间态 → 后续动作做成**条件式**（元素可见才点，否则记 info finding）。

## 已知边界

- 本套件为「纯 UI 验证」，不覆盖单元/组件测试。
- 越权负向基于前端权限指令「隐藏控件」；若项目改为「禁用」而非「移除」，需把 `to_have_count(0)` 换成禁用态断言。
- {{ADAPT}} 补充本项目其它已知边界（如某模块依赖外部门禁硬件、某流程需短信网关等）。
