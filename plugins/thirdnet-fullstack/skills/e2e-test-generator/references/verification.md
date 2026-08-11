# 验证——证明生成的套件对真实 UI 是准的

过去这套技能最大的坑就是：从源码推断 selector/label，交付后执行者一跑全红，再回来手工调数据。根因是源码推断会漏掉**运行时现实**——动态 class、`v-if`/`v-show` 分支、异步加载、库覆写、权限指令「禁用 vs 移除」。这些只有真实 DOM 才能告诉你。所以现在的验证三层是：**静态（总做）→ 活校准门（可达即强制）→ 真实环境回归（执行者复跑）**。降级到纯离线是可以的，但必须显式标注 `UNVERIFIED`，不能默默跳过。

## 1. 静态检查（总做）——对每个文件 `py_compile`

```bash
cd <project>/testing
python -m py_compile config.py state.py data_factory.py run_all.py calibrate.py lib/*.py tests/*.py
```
退出 0 = 所有文件都是语法合法的 Python。这能抓出拼写错、缩进错、import 语法坏——最常见的生成缺陷——而不需要浏览器、服务器或真实环境。**每个文件都必须过。** 有不过的就修了重跑；别在部分通过时就宣布完成。

（通常你没法完整 import 这些模块——它们 `import playwright`，本地可能没装。`py_compile` 只解析不导入，所以无所谓能不能 import。这就是它作为基线检查的原因。）

**但 `py_compile` 抓不到**：selector 写错、label 文案不对、菜单名点不进、按钮文案找不到、路由前缀错了、权限指令其实是禁用而非移除。这些是 4b 活校准要抓的。

## 2. 活校准门（环境可达时——强制）

> 判定「可达」：阶段 0 用户给的测试地址，**此刻**从生成这台机器能 HTTP 访问、且给的 admin 账密能登录成功。两条都满足才算可达，走本节。任一不满足走 §2.1 降级。

这是把「源码推断的草稿」变成「对真实 DOM 校准过的成品」的步骤。**环境可达时不可跳过**——它正是过去「测试跑不过」的解药。

### 2.0 跑探针

生成的套件里带一个 `lib/calibrate.py`（来自 `assets/lib-skeletons/calibrate.py.tpl`，几乎不用改）。它复用 `harness.Harness` 起浏览器、`sessions.get_web(h,"admin")` 登录，然后逐项驱活 UI 比对：

```bash
cd <project>/testing
python lib/calibrate.py
```

它做的事（按 `selectors.py` 分组遍历）：
- **登录页**：验 `LOGIN_USER_PH`/`LOGIN_PWD_PH`/`LOGIN_BTN_TEXT` 在登录页 DOM 里真实存在。
- **菜单导航**：对 `WEB_MENU` 每个模块，验目录名 + 菜单名在侧边栏能点到、点完落到对的页面（验页面标题或某个已知元素出现）。
- **新增弹窗**：对每个模块，点 `BTN_ADD` → 验 `EL_DIALOG_VISIBLE` 出现 → 逐个验实体表单 label 在 `.el-form-item__label` 里文本命中 → 关闭。
- **列表表头**：读 `EL_TABLE` 的 `EL_TABLE_HEADER_CELL` 文本，验期望的列名都在。
- **移动端**（如配置）：验 `MOBILE_ROUTES`、移动端字段/toast/dialog class、tabbar label。

产出 `reports/calibration.md`：每条 ✅命中 / ❌未命中；**对每条未命中，附 DOM 里实际找到的最近似文本**（如期望 label「工单号」未命中，但表头里有个「工单编号」——探针把它列出来），让你一眼知道该把生成代码改成什么。退出码：全命中 0，有未命中 1。

### 2.1 修生成代码（不是修测试数据）

看到 `calibration.md` 里的 ❌ 项，**改 `selectors.py` / 实体构造器 / 路由登记，让它们对齐真实 DOM**，然后重跑探针。循环直到退出 0。

关键纪律——**修代码，不削弱测试**：
- ✅ 对的做法：把 `BTN_SUBMIT = "确定"` 改成实际的 `"保存"`；把 `WEB_MENU["user"] = ("系统管理","用户管理")` 改成实际的目录/菜单名；把错误的 selector class 换成真实 DOM 的 class。
- ❌ 错的做法：为了让测试「过」而删掉断言、放宽匹配（如把精确 label 文本匹配改成模糊包含）、把整条用例 skip 掉。这是掩盖问题，不是校准。
- 唯一允许「跳过」的场景：探针报告某交互在当前环境**确实无法触发**（如某模块在测试环境没数据、某按钮该角色压根看不到），这种记进 README 的「已知边界」，而不是删断言。

### 2.2 最小通过线

不必等探针对**所有**模块全绿才交付（有些模块可能依赖运行时数据）。但**这几条必须真过**，否则不算校准完成：
1. admin 能登录成功（登录页 placeholder/按钮文案命中）。
2. 每个被测模块的侧边栏菜单名能点进、落地页加载无报错。
3. 至少一个模块的新增弹窗能打开 + 至少一个表单 label 命中。
4. 至少一个模块的列表表头读得到。

这几条过了，说明 selector/label/导航的主干对真实 UI 是准的；剩余边角交互进 README「复验校准点」。这几条过不了，**不能宣布完成**——继续修。

## 2.3 降级分支（环境不可达时——显式标注 UNVERIFIED）

地址此刻连不上（CI 环境、待测系统在另一台机器、还没部署等）→ 不做活校准，但**必须**：

1. 在 `testing/README.md` **顶部**贴醒目标注：
   ```
   ⚠️ UNVERIFIED — 本套件未对真实 DOM 校准。
   在可连通环境里跑 `python lib/calibrate.py`，据 reports/calibration.md 修正 selectors.py 后方可认为可靠。
   ```
2. 在 `TEST_PLAN.md` 顶部同样标注一行。
3. README 附「复验步骤」一节：怎么连环境、怎么跑探针、怎么据报告修。
4. 跟用户**明说**：「环境此刻不可达，我做了离线生成并标注了 UNVERIFIED；环境就绪后跑 `python lib/calibrate.py` 复验。」——不要装作验过，也不要默默跳过。

## 3. 复验校准点（README 里记录这些）

即使活校准过了，这几类交互天生脆弱，运行机换环境复跑时仍需优先关注：

- **原生 `<picker>`（日期/时间/地区）**——uni-app H5 滚轮；列数/项文本/确认按钮 class 在 uni-app/Vant 各版本间不同。首次很可能落偏一格。这是探针难自动判对的，靠运行机人工确认。
- **文件上传（照片/文档）**——`expect_file_chooser` 是稳健的，但触发器（按钮 vs ActionSheet vs 点头像）和「已提交」的成功 toast 文案每页不同。
- **一次性绑定**——一对一的邀请/绑定流程（一个账号 ↔ 一个移动访客）必须用每个测试独占的一次性 idx；没有它重跑就撞车。记录每个测试占用哪些 idx。
- **只读/系统生成的数据**——某些页（事件日志、审计记录、设备遥测）只在真实管线有数据；测试环境里它们合理地为空。断言「页面渲染了（表格或空态），无报错」，而非「有数据行」。
- **状态依赖的异步**——需要后端管线推进的状态（例如某记录卡在「待同步」/「处理中」直到外部系统拉取）在测试环境里可能停滞。把后续动作做成**条件式**（仅当元素可见时才点），跳过时记一条 info/warning 发现。

对每个校准点：它是什么、为什么脆弱、要复验什么、测试已用的兜底是什么。

## 4. 真实环境交付

写 `testing/README.md`，包含同事在真实栈上跑起来所需的一切：
- **校准状态**（最显眼位置）：活校准跑过 → 写明覆盖了哪些模块/交互、`calibration.md` 在哪；降级 → 贴 §2.3 的 UNVERIFIED 标注。
- **前置依赖**：Python、`pip install playwright` + `playwright install chromium`、环境变量（URL/账号）、怎么设 `MOCK`/`REAL` 模式。
- **运行**：`python run_all.py`（分阶段——启动时选运行模式 + 起始阶段，逐阶段出报告并在阶段间决策继续/停止）或 `pytest tests/`（若 pytest 兼容，作为整体跑的备选）——给出确切命令。
- **复验**：`python lib/calibrate.py`——换环境后第一件事就跑它，据 `reports/calibration.md` 修 `selectors.py`。
- **产物**：报告去哪——`reports/stage_NN.md`（各阶段报告）、`reports/TEST_REPORT.md`（滚动总报告）、`reports/calibration.md`（活校准报告）、`reports/findings.json`（原始数据）、`artifacts/screenshots/`（失败截图）。
- **复验校准点**（来自 §3）。
- **已知边界**：套件覆盖/不覆盖什么；什么是条件式/跳过的以及原因。

## 5. 原则合规自检

宣布完成前，扫描每个生成的 test/lib 文件找原则违规：
- 到处没有针对后端的 `requests` / `urllib` / `fetch` / `ApiClient`（P1）。`grep -rn "requests\.\|urllib\|ApiClient\|fetch(" testing/` 应当干净。
- 每个 create/update/delete 都紧跟一个回验断言（P2）。
- 跨端数据在两端都有断言（P3）。
- 每个权限受限动作都有一条通过 DOM 不存在实现的「缺权限角色」负向断言（P4）。
- 每个 page 都挂了 `console`/`pageerror`/`response` 监听器；预期失败已登记（P5）。

任何一个缺失，套件就没完成——补上。
