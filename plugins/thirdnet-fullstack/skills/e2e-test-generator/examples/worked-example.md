# 工作示例：一套完成态 `testing/` 套件的形态

这是一份**结构性参考**——本技能生成的一套完整、`py_compile` 干净的套件，跨它约 12 个 lib 文件和约 13 个测试用例，长什么样。它以项目无关的措辞描述*形态与那些棘手机制*，让你看到 `assets/` 里每个骨架如何展开成一个真实层。它刻意不绑定任何具体代码库：下面的实体名、label、selector 都是占位符。用阶段 1 探索的成果填*你*项目的真实值（见 `references/discovery.md`）。

## 为什么要翻它

当 `assets/` 里某个骨架感觉太抽象——「当一个实体有一个 tree-select、一个 radio 状态、一个派生编码字段时，一个真实的 `ensure_<entity>()` 长什么样？」——本参考展示具体形态。`assets/` 里的骨架是从一套真实的、验证过的套件泛化来的，所以对应关系是直接的。

## 映射：骨架 → 套件层

| 骨架 | 套件层 | 它具体展示什么 |
|---|---|---|
| `lib-skeletons/config.py.tpl` | `config.py` | 可被环境变量覆盖的 URL/账号；身份→凭据映射；健康检查路径 |
| `lib-skeletons/state.py` | `lib/state.py` | 跨用例 JSON 状态（原样使用） |
| `lib-skeletons/data_factory.py.tpl` | `lib/data_factory.py` | `run_tag+idx` 确定性；派生编码（如 phone→账号/邀请码） |
| `lib-skeletons/harness.py` | `lib/harness.py` | `Findings` 被监听器 + `expect_response`；`TestRunner` + 报告 |
| `lib-skeletons/sessions.py` | `lib/sessions.py` | 身份缓存 web 登录；每访客移动端上下文 |
| `lib-skeletons/run_all.py.tpl` | `run_all.py` | 带健康检查跳过的有序运行器 |
| `adapt-skeletons/selectors.py.tpl` | `lib/selectors.py` | 完整的菜单/路由/label/按钮登记表（web + 移动端）——唯一事实源 |
| `adapt-skeletons/web_crud.py.tpl` | `lib/web_crud.py` | 完整的框架原子集，含菜单树角色分配 |
| `adapt-skeletons/web_login.py.tpl` | `lib/web_login.py` | 带验证码自动探测的登录 |
| `adapt-skeletons/minigram_ui.py.tpl` | `lib/minigram_ui.py` | 移动端 UI 原子 + 原生 `<uni-picker>` 滚轮处理 |
| `adapt-skeletons/minigram_login.py.tpl` | `lib/minigram_login.py` | 移动端认证（一键 / 账号 / 绑定流程） |
| `adapt-skeletons/web_entities.py.tpl` | `lib/web_entities.py` | 每个实体幂等的 `ensure_<entity>()` 构造器 |
| `adapt-skeletons/test_template.py.tpl` | `tests/test_<NN>_<flow>.py` | 典范跨端流程（C 提交 → B 处理 → 驾驶舱） |

## 值得学习的代表性用例形态

这些是值得内化的模式——每个映射到完成套件里的一个测试文件。把*形态*套到你项目自己的流程上，而非照搬字面字符串。

- **典范跨端 + 状态机测试。** C 端填真实表单（chip + 字段）→ 提交 → 读 toast；B 端按表头列（「状态」）读到该行，通过直接动作按钮把它推过状态机（如 待处理 → 处理中 → 完成），可能还有一个嵌套的回复子弹窗（它的提交动词不同于「确定」）；该流程的一个大屏/驾驶舱面板渲染出来。练习原则 1–3。
- **通过 UI 准备角色/用户。** 通过一棵按**可见菜单名**（而非权限串）勾选的菜单树分配角色；用户弹窗里有 tree-select 部门 + multi-select 角色 + switch + radio。喂给多角色 + 数据范围 + 负向用例（原则 4）。
- **跨端发布/广播。** B 端发布一项 → 范围内 C 端用户能看到，范围外的看不到。留意那个「状态」字段在一个实体里是 `select`、另一个里是 `radio` 的坑，以及发布/下架是 `v-if` 控制的行内按钮（同一时刻只有一个可见）的坑。
- **对缺失数据稳健的模式。** 针对系统生成数据的只读页面加载检查（断言「页面渲染了，表格或空态，无报错」而非「有数据行」）；条件式动作（仅当某后续控件存在才点），记成 info/warning 而非失败。让套件在缺真实设备/外部管线的测试环境里保持绿灯。

## 怎么用

**不要**把任何项目的字面字符串拷进另一个项目——那正是本技能要杜绝的反模式。用本参考理解**形态与那些棘手机制**（嵌套弹窗、picker 滚轮、一次性 idx、只读空态、状态控件类型不一致），再用阶段 1 探索的成果填*你*项目的真实 label/selector/流程。
