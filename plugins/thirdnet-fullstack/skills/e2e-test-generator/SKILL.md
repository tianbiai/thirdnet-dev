---
name: e2e-test-generator
description: 为任意既有项目代码库生成一套完整的、可入库的、**纯 UI 驱动**的 Playwright（Python）端到端（E2E）测试套件——覆盖 Web 后台、移动端（H5/小程序）、大屏/驾驶舱，或其任意组合；通过探索代码库来生成。测试会打开真实弹窗、按 label/placeholder 填表、提交、再从表格/列表 DOM 文本断言结果；用多个权限不同的账号登录，验证每条业务流（含数据范围、跨端一致性、越权负向用例），**且绝不从测试代码直连后端**。本技能会按目标项目**自身的前端框架**适配——Element Plus、uni-app 或任何其它框架——因为每个选择器/label/流程都是从目标项目的真实源码里读出来的，而不是假设的，所以它适用于任意 web/移动代码库。当用户想为某个项目创建 / 生成 / 搭建 / 编写 E2E 测试套件、集成测试或 Playwright 测试时，务必使用本技能——例如「请生成项目的完整UI测试」「为这个后台写一套E2E测试，要用不同权限账号验证越权」「generate the complete UI tests for this project」「write an E2E suite for this codebase」「add Playwright tests covering all business flows」。**不要**用于一次性运行时检查或快速浏览器验证（那是另一个独立的 `webapp-testing` 技能），也不要用于单元/组件测试。
license: MIT
metadata:
  version: "0.2.0"
  author: thirdnet
---

# E2E 测试生成器

通过探索**用户指定的**既有项目代码库，为其生成一套**完整的、可入库的、纯 UI 驱动**的 Playwright（Python）E2E 测试套件。这套件会提交进仓库（放在 `testing/` 下），与项目自身的构建钩子隔离。方法是项目无关的：适用于任意 web/移动代码库，因为每个选择器、label、流程都是从目标项目的真实源码里读出来的，而非凭空假设。

## 两个阶段，两台机器（生成 vs 运行）

本技能的工作分两个阶段，发生在两台不同的机器上：

- **生成阶段（这台机器）**——只读你指给我的代码库。从源码里提取真实的 selector/label/流程/权限，生成 `testing/` 套件。**不连接、不启动、不探活**待测系统；真实 URL/账号/密码在这一阶段**未知**，一律留作环境变量占位。这台机器不需要能连通待测环境。
- **运行阶段（一台能连通的机器）**——把 `testing/` 拿到能访问待测环境的人那里。由执行者用环境变量提供真实 URL/账号/密码、启动目标服务；`run_all.py` 先做健康检查轮询，再驱动真实 UI。真正的 pass/fail 在这里发生。

换句话说：**交付的是一套可入库、可在任何可连通环境里跑起来的套件**，不是在生成这台机器上证明它跑得通。

## 「纯 UI 驱动」是什么意思（定义本技能的那一条铁律）

测试**绝不从测试代码直连后端**。每一个业务动作——创建实体、处理工单、审批申请、发布公告——都通过**驱动真实 UI** 完成：打开弹窗 → 按 label/placeholder 填表 → 提交 → 从表格/列表 DOM 文本读回结果。唯一会去读后端、发请求的，是**被测前端自己**。测试代码只驱动 DOM、断言文本。正是这样才能抓到 API 驱动测试抓不到的、真正的 UI 层 bug（弹窗没接上、字段绑定错模型、前端校验缺失/错误、权限指令隐藏错了按钮、状态字段渲染成了错误的控件）。

如果你发现自己在测试代码里写 `requests.get` / `urllib` / `fetch` / 某个直连后端的 `ApiClient`——停。这就违背了那条铁律。测试工具只允许**被动观察**前端自身发出的请求（见原则 5）。

## 何时用 / 何时不用

**用**：当用户想为一个既有项目生成一套*可持久化的测试套件*——一组提交进仓库、可反复重跑的测试文件。

**不用**于：
- 一次性「这个页面能不能用？」的运行时检查 → 那是 `webapp-testing`。
- 单元/组件测试（Vitest/Jest）→ 超出范围；本技能是 E2E。
- 没有现成代码库可探索就生成测试（整套方法的前提就是从代码里读真实的 selector/label/流程）。

## 5 条原则（每个项目都不变）

这些是不可妥协的；你生成的每条测试都必须遵守。读 `references/principles.md` 了解背后的道理。

1. **纯 UI 驱动**——驱动真实弹窗/表单，断言 DOM 文本，绝不从测试工具直连后端。
2. **写入即回验**——每次 create/update/delete 之后，立即在同一端的 DOM 里确认结果（行出现 / 字段变了 / 行消失）。
3. **跨端一致性**——在一端产生的数据，要在相关的另一端（们）断言可见且正确（B↔C↔驾驶舱）。
4. **多角色 + 数据范围 + 负向**——用多个权限不同的账号测试；断言每个角色只看到自己范围内的数据；对无权限的动作，断言按钮/菜单**在 DOM 中不存在**（权限指令把它隐藏了），而不是断言会触发 403。
5. **被动监听**——挂 `console` / `pageerror` / 4xx-5xx `response` 监听器，*观察*前端自身的行为（这并不是「直连后端」）；把预期内的失败（如已知的 409）通过一个 `expect_response` 登记表标出来，免得被误报成 bug。

## 工作流——按以下 4 个阶段顺序执行

### 阶段 0——范围确认（问清楚，别猜）
生成前用 `AskUserQuestion` 确认 2–3 件事：
- **用户指定的代码库在哪**：确认待测项目的根目录路径（生成只读这里的源码，见上方「两个阶段」）。
- **存在哪些端**：B 端 web 后台？C 端移动（H5/小程序）？整屏大屏/驾驶舱？（决定你要建哪些登录层与 UI 原子层。）
- **要测哪些角色**：存在哪些权限有别的账号，或需要自动开通哪些？（如超管 + 范围受限的角色 A/B。）
- 确认输出位置（默认 `<project>/testing/`）。

**生成阶段默认不连接待测系统**——所以这里*不问*「后端可不可达」。真实 URL/账号/密码都留到运行阶段，由执行者用环境变量填。若用户碰巧在这台机器上跑着开发栈、并主动要求做一次本地冒烟，按阶段 4 的「可选冒烟」处理；否则默认就是离线生成 + 交付。

### 阶段 1——探索代码库（这是引擎）
按 `references/discovery.md` 派发**并行 Explore 子代理**（每个盯一个维度——组件/UI 原子、字段 label/placeholder/按钮文案/表头、业务流与状态机、认证与权限/数据范围、移动端）。目标：从真实代码里提取*真实的* selector/label/placeholder/按钮文案/表头/列表卡片 class/状态机/权限指令/数据范围机制——绝不猜。产出两份东西：
- 一份**探索笔记**小结（每条业务流是什么、它的状态机、它表单的字段），
- 一份**选择器登记表草稿**（即项目的 `selectors.py`）。

这个阶段开始前先读 `references/discovery.md`——它是操作手册。

### 阶段 2——设计计划
写 `testing/TEST_PLAN.md`：把业务流映射成测试用例，应用原则 2–4（回验 / 跨端 / 多角色+负向）。敲定 `lib/` 分层和选择器登记表。读 `references/architecture.md` 了解分层。

### 阶段 3——生成套件
- 从 `assets/lib-skeletons/` 拷贝**通用 lib 骨架**（config/state/data_factory/harness/sessions/run_all）——这些几乎不用改；URL/账号留作环境变量占位（见 config.py.tpl 的 `E2E_*` 契约），生成阶段不填真实值。
- 通过阅读对应的**变体参考**来生成**适配层**：
  - **Element Plus** 的 web 后台 → `references/web-element-plus.md`（首选快速通道），
  - **uni-app（H5）** 的移动端 → `references/mobile-uniapp.md`（首选快速通道），
  - 任何其它框架 → 按 `references/discovery.md` 用你探索到的结果从零搭原子。
- 构建实体构造器（开→填→提交→断言→返回）、角色/用户准备、可选的驾驶舱校验器。
- **每条业务流写一个测试文件**，每个都纯 UI、只断言 DOM。用 `assets/adapt-skeletons/test_template.py.tpl` 当模板。

### 阶段 4——验证
- 对**每个**生成的 `.py` 跑 `python -m py_compile`——必须全过。（读 `references/verification.md`。）
- **可选冒烟**（仅在用户主动要求、且这台机器上正好跑着可访问的开发栈时）：启动前端 → 跑 2–3 条导航 + 选择器断言，验证原子层对真实 DOM 是准的。这是离线生成之外的**额外**检查，不是主流程的一环——默认不做。
- 写 `testing/README.md`，包含：怎么跑、**校准点**（像原生 picker/文件上传这种首次真跑要在真实 DOM 上微调的脆弱交互）、已知边界。
- 交付：套件产出完成；真正的 pass/fail 运行在可连通测试环境里发生（见「两个阶段」）。

## 变体选择（速查）

| 目标前端 | 读这份参考 | 用这些骨架 |
|---|---|---|
| Vue3 + Element Plus 后台 | `references/web-element-plus.md` | `web_crud.py.tpl`、`web_login.py.tpl`、`selectors.py.tpl` |
| uni-app H5 移动端 | `references/mobile-uniapp.md` | `minigram_ui.py.tpl`、`minigram_login.py.tpl` |
| 大屏 / 驾驶舱 | （探索驱动） | `web_crud.py.tpl` + 自定义校验器 |
| 其它任何框架 | `references/discovery.md`（从零搭原子） | 仅 `test_template.py.tpl` |

一个项目有多个端时，组合变体（例如一个 Element Plus 后台**外加**一个 uni-app 移动端）——这是常见的 B 端 + C 端多端形态。

## 参考索引（按需读，别一次性全读）

心里记着 SKILL.md；只在某个阶段到了才打开对应参考。

- `references/principles.md`——5 条原则的深入讲解 + 为什么负向用例是「按钮不存在」而非「403」。（早点读一次。）
- `references/discovery.md`——阶段 1 的 Explore 操作手册：到底读什么、记什么。**「按项目自动生成」的引擎。**
- `references/architecture.md`——`lib/` 分层、每个文件的职责、命名约定、通用 vs 适配。
- `references/web-element-plus.md`——Element Plus 原子 + 易踩的坑（状态是 radio 不是 select；角色-菜单树按可见 label 勾选而非权限串；mock 下按路由前缀投票；等等）。
- `references/mobile-uniapp.md`——uni-app H5 的 UI 原子 + 原生 `<picker>`（#1 校准风险）+ toast/弹窗/卡片回验。
- `references/negative-testing.md`——权限按钮/菜单不存在；冲突 toast + `expect_response` 兜底。
- `references/verification.md`——py_compile、可选冒烟、异地运行交付、记录校准点。
- `examples/worked-example.md`——一套完整建好的参考套件（13 个用例 + 12 个 lib）作为工作示例；不确定某层长啥样时翻它。

## 输出形态（你必须产出什么）

```
<project>/testing/
├── config.py            # 可被环境变量覆盖的 URL/账号/超时（来自 lib-skeletons）
├── state.py             # 跨用例共享状态（来自 lib-skeletons）
├── data_factory.py      # 确定性测试数据生成器（来自 lib-skeletons）
├── run_all.py           # 有序运行器 + 报告（来自 lib-skeletons）
├── lib/
│   ├── harness.py       # Playwright 引擎 + Findings 被动监听器 + expect_response（来自 lib-skeletons）
│   ├── sessions.py      # 身份缓存登录 + 每访客独立移动端上下文（来自 lib-skeletons）
│   ├── selectors.py     # 项目的选择器/路由登记表（适配）
│   ├── web_crud.py      # web UI 原子（按框架适配）
│   ├── web_login.py     # web 登录驱动（适配）
│   ├── [mobile_ui.py]   # 移动端 UI 原子（适配，如有移动端）
│   ├── [mobile_login.py]
│   ├── web_entities.py  # 实体构造器：开→填→提交→断言→返回（适配）
│   ├── [role_builder.py]# 角色/用户的 UI 准备（适配，如多角色）
│   └── [verify.py]      # 大屏/驾驶舱 DOM 校验器（适配，如有大屏）
├── tests/               # 每条业务流一个文件（TC-00..TC-NN）
├── fixtures/            # 二进制测试素材（如上传测试用的 sample.jpg）
├── TEST_PLAN.md         # 业务流 → 用例（阶段 2 产出）
└── README.md            # 运行说明 + 校准点 + 已知边界
```

## 非目标

- 不是单元/组件测试。
- 不是运行时一次性验证（那是 `webapp-testing`）。
- 生成的代码放在 `testing/` 下，必须**与项目的构建/钩子隔离**（例如仓库若有 PreToolUse 钩子卡源码编辑，把 `testing/` 下的 `.py` 放在该钩子作用域之外——它们正该在那儿）。
