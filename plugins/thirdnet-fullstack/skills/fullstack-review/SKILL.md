---
name: fullstack-review
description: >
  ThirdNet 全栈代码审查与验证技能：功能开发完成后，对已实现的前端（Vue 3）与后端（.NET）模块
  进行全方位合规校验——前后端规范遵守、API 规范、数据库规范、跨端契约一致性、业务功能正确性、
  性能、安全性、文档一致性；严格依据本插件既有规范技能（net-* / vue-* / api-typescript-spec 等）
  与通用工程准则；输出结构化审查报告（问题清单 + 严重级别 + 整体优缺点 + 歧义 + 修改方案）。
  当用户提到“审查 / 验证 / review / 代码评审 / 上线前检查 / 功能做完了检查一下 / 全栈审查”，
  或功能开发收尾时，必须使用此技能。支持 SVN（未提交 / 最近提交）与 git 变更范围自动识别。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---

> **定位**：本技能是开发完成后的**全栈验证入口**，编排既有规范技能（`net-*` / `vue-*` / `api-typescript-spec` / `thirdnet-fullstack`），**不重述**它们的规则正文——规则原文以那些技能为权威源，本技能负责把它们组织成可执行的审查清单、按维度跑、产出结构化报告。完整的可检查规则目录见 [references/review-rules](references/review-rules.md)。

---

# 全栈代码审查与验证

本技能在**一个功能模块开发完成后**（前后端都已落地），对受影响的代码做一次全方位审查，覆盖七大维度：后端规范、前端规范、跨端契约一致性、业务功能正确性、性能、安全性、文档与流程。最终产出一份 `review-report.md`，包含问题清单（带严重级别与修改方案）、整体优缺点、歧义与待确认项、阻断结论。

> 与既有验证面的关系：本技能是**收尾的总闸**，不是又一处碎片。它复用 `net-api-developer` / `net-cache-use` 的 `代码审查清单`、`backend-workflow` / `frontend-workflow` 的 `开发完成校验`、`thirdnet-fullstack` 的 `约定同步检查清单`，并在其上叠加跨端契约比对、业务正确性、性能、安全、文档一致性等总览维度。

## 何时触发 / 与钩子的关系

- **手动**：用户说“审查 / 验证 / review / 代码评审 / 上线前检查 / 功能做完了检查一下”时调用本技能（Skill 工具 `thirdnet-fullstack:fullstack-review`）。
- **自动**：本插件已扩展第 3 个 **Stop Hook**——当会话涉及前后端功能性代码变更（`backend/**/*.cs` 或 `frontend/**/src/**/*.{vue,ts,tsx}`）且尚未通过本技能审查时，会在收尾时阻断并提示调用本技能。审查报告无 Critical/Major 后方可放行。

> 因此审者要明白：本技能不是“可选的 nice-to-have”，而是交付闭环的强制一环；但它的产出是**报告与修改方案**，默认**不自动改码**——是否修复由用户决定。

## 行为准则

审查质量取决于态度，先立规矩：

1. **客观有据**——每一条 finding 都必须能指出「违反了哪条规则、规则来自哪个技能/文件、代码在哪一行」。说不出依据就不要写进报告。猜测性的问题归入「歧义与待确认」，不要混进问题清单。
2. **可执行**——只指出问题不够，必须给「修改方案」（改成什么样、改在哪）。方案要具体到能直接据此动手，而不是“建议优化”这类废话。
3. **不越权**——默认**只报告**。即使用户说“顺手改了”，对于跨模块、影响契约的改动也要先在报告里列出方案、由用户确认后再走 `backend-workflow` / `frontend-workflow` 修复——审查与开发是两个角色，混在一起容易丢客观性。
4. **抓大放小**——Critical / Major 优先，这是阻断交付的东西；Minor / Info 是锦上添花，不要让琐碎噪声淹没关键问题。宁可少而准，不要多而散。

## 审查范围确定

**先确定“审什么”再动手**。目标项目通常基于 **SVN**，也可能用 git；本技能按 VCS 自动识别变更范围。完整命令与推断规则见 [references/scope-and-vcs](references/scope-and-vcs.md)，此处是要点：

三种范围模式（按用户意图选择，默认 SVN 未提交）：

| 模式 | 含义 | 主命令（SVN） |
|------|------|--------------|
| **未提交**（默认） | 当前工作区改动（最贴合“刚写完”） | `svn status` + `svn diff` |
| **最近提交** | 一段时间内的提交（按次数或日期） | `svn log -l N --verbose` 或 `svn diff -r {YYYY-MM-DD}:HEAD` |
| **整个项目** | 全量扫描 | 递归扫 `backend/` + `frontend/src/` |

无 `.svn` 时回退到 git（`git status --porcelain` / `git diff` / `git log`）；二者皆无则全项目扫描。用户也可直接指定模块名（如 `notice`）或路径列表覆盖自动检测。

**模块推断**：从改动文件路径反推 `{module}` / `{Entity}`，据此把「受影响文件」聚合到「受影响模块」，并定位该模块的完整产物——前端 5 类契约（`api/types/`、`api/interfaces/manager/`、`mock/data/manager/`、`mock/api/manager/`、`api/modules/manager/`）+ 页面 `src/views/{module}/index.vue`；后端 8 件套（Model / EntityConfiguration / DTO(Map) / Service / Controller / 权限注解 / DI 注册 / 菜单数据）。审查对象是**模块**，不是孤立文件。

## 审查维度总览

七大维度，每维度的权威来源与检查重点见 [references/review-rules](references/review-rules.md)：

| 维度 | 检查重点（举要） | 权威来源技能 |
|------|------------------|-------------|
| **A 后端规范遵守** | 命名（`Model`/`Map`/`*Controller`/`*Service`/`*Cache`）、API（GET/POST only、`AdminControllerBase`、`Map` DTO、`ProducesResponseType`、`WebApiException`、`ToPageListAsync`）、EF Core（Fluent API、`long id`、无外键、`timestamptz`+`DateTime.UtcNow`、`dept_id` 索引、批量后删缓存）、Auth、Cache、结构、字典、后台任务 | `net-api-developer`、`net-efcore-developer`、`net-auth`、`net-cache-use`、`net-background-job`、`net-enum-dict`、`net-microservice-generator`、`backend-workflow` |
| **B 前端规范遵守** | 5 文件契约结构、策略工厂（`I{Entity}Api`+`Real/Mock`+工厂+单例）、CRUD 页（`useCrudTable`/`PaginationBar`/`useDialogFocus`/`validators`）、`v-permission` 数组、`MOCK_ENABLED` 守卫、按钮防抖、字典 `useDict`/`getDictDataByType` 不混、TS 强制、注释、Pinia/Router 陷阱 | `api-typescript-spec`、`vue-best-practices`、`admin-template-setup`、`vue-pinia-best-practices`、`vue-router-best-practices`、`design-apple`、`vue-enum-dict`、`frontend-workflow` |
| **C 跨端契约一致性** | 类型映射逐字段对照（`{Entity}Item`↔`{Entity}ItemMap`）、`v-permission`↔`[PermissionAuthorize]` 串逐字比对、URL action≠权限 action、snake_case 全链路、`约定同步检查清单` 7 项 | `thirdnet-fullstack`（类型映射/RBAC 桥接/约定同步） |
| **D 业务功能正确性** | 逻辑与 `spec.md`/`specs/{page}.md` 一致、边界/空值/并发、每个变更端点都有权限覆盖、事务完整、软删语义 | spec 文档 + 通用工程准则 |
| **E 性能** | N+1、`AsNoTracking`、缺索引（`dept_id`/jsonb GIN）、缓存误用（拆 key 反例、循环 `RemoveSingle`）、批量 vs 循环 `SaveChanges`、CTE 单语句 | `net-efcore-developer`、`net-cache-use` + 通用准则 |
| **F 安全性** | 禁自实现加密、`appsettings.json` 无真实密钥、`View`/缓存无敏感字段、SQL 必参数化、权限全覆盖、PII 不外泄、refresh_token 单次失效 | `net-auth`、`net-cache-use`、appsettings 管理 + 通用准则 |
| **G 文档与流程** | `plan/changelog/spec` 同步、`specs/{page}.md`、中文注释完整、`dotnet build` 0 警告、文档驱动流程合规 | `backend-workflow` / `frontend-workflow` 的「文档驱动开发」与「开发完成校验」 |

## 审查执行流程

按以下步骤推进，每步都要落到实地：

1. **确定范围**——VCS 检测 + 模块推断，列出受影响模块清单与其完整产物路径（见 [scope-and-vcs](references/scope-and-vcs.md)）。
2. **加载规范**——通过 Skill 工具调起涉及领域的权威清单：`net-api-developer` 的 `代码审查清单`、`net-cache-use` 的 `代码审查清单`、`thirdnet-fullstack` 的 `约定同步检查清单`、两侧的 `开发完成校验`。**先调后审**，避免凭记忆漏规则。
3. **逐维度检查**——
   - 小范围（单模块）：内联逐维度跑，参照 [review-rules](references/review-rules.md) 的检查方法。
   - 大范围（多模块 / 全项目）：用 Task 工具并行派发审查子代理（后端审查者 / 前端审查者 / 跨端审查者），prompt 与返回 schema 见 [references/report-format](references/report-format.md) 的「子代理派发」。子代理隔离上下文，主上下文只汇总。
4. **（可选）运行校验**——若环境允许，跑 `dotnet build`（应为 0 警告）、前端 `vue-tsc --noEmit` / `vite build`、相关单元测试；编译错误与失败测试一律 Critical。无法运行则跳过并在报告中注明“未做运行时校验”。
5. **汇总去重**——合并子代理/各维度 findings，同位置问题去重，按严重级别排序。
6. **写报告 + 摘要**——按 [references/report-format](references/report-format.md) 模板写 `review-report.md`（默认放被审模块 docs 目录或仓库根），并在对话内给一段摘要（总数、各级别数、Top 问题、阻断结论）。

## 严重级别与阻断规则

严重级别定义与 finding 条目格式见 [references/report-format](references/report-format.md)。要点：

- 🔴 **Critical**：安全漏洞 / 数据丢失 / 跨端契约断裂 / 编译错误 / 时间类型错误（`DateTime.Now` 写 `timestamptz` 必抛 `InvalidCastException`）/ SQL 注入风险。**必须修，阻断交付。**
- 🟠 **Major**：违反明确规范（缺 `[PermissionAuthorize]`/`[OperLog]`、`Map` 后缀错、手写分页、漏索引、缺文档、按钮无防抖、缓存拆 key 等）。**应当修，阻断交付。**
- 🟡 **Minor**：命名瑕疵、注释缺失、轻微不一致。建议修，不阻断。
- 🔵 **Info**：优点肯定 / 更优模式建议。不阻断。

**Stop Hook 阻断阈值**：报告中存在**任一 Critical 或 Major** → 判 `fail`，钩子阻断完成；全清后方可放行。

## 报告输出

- 写入 `review-report.md`：默认放被审模块的 docs 目录（如 `backend/{Project}.Admin/docs/review-report.md` 或 `frontend/web/docs/review-report.md`）；跨模块/全项目审查放仓库根 `review-report.md`。多次审查覆盖上一次（或按日期归档，由用户定）。
- 对话内摘要：审查范围、各级别问题数、最严重的 3-5 条、阻断结论（pass/fail）、下一步建议。
- 报告必须含 7 段：①审查概要 ②严重级别统计 ③问题清单（按维度分组）④整体优缺点 ⑤歧义与待确认 ⑥修改方案汇总（优先级排序 action list）⑦阻断结论。完整模板见 [references/report-format](references/report-format.md)。

## 跨端契约一致性（维度 C，重点）

这是单侧审查最容易漏、出问题代价最大的一维，必须专门做：

- **类型映射逐字段对照**：前端的 `{Entity}Item` / `{Entity}QueryParams` / `{Entity}CreateParams` / `{Entity}UpdateParams` 与后端的 `{Entity}ItemMap` / `{Entity}QueryMap` / `{Entity}CreateMap` / `{Entity}UpdateMap` 字段一一对应（名称、类型、可空、枚举值）。类型对照：`number`↔`long`、`string`↔`string`/`DateTime`(ISO 8601)、`boolean`↔`bool`、`enum`↔`enum`(值同)；分页 `PaginatedResponse<T>`↔`PageListInfo<List<T>>`（字段 `list`/`total`/`index`/`pages` 一致）。
- **权限串逐字比对**：前端 `v-permission="['sys:notice:add']"` 与后端 `[PermissionAuthorize("sys:notice:add")]` 必须逐字一致；遗漏任何一侧会导致按钮不显示或接口 403。
- **URL action ≠ 权限 action**：URL 用 `/detail` `/update` `/delete`；权限 action 用 `query` `edit` `remove`。混用（如把详情权限写成 `sys:notice:detail`）是典型 bug。
- **snake_case 全链路**：前端字段名、mock 数据、后端 DTO 属性、`[JsonPropertyName]`、DB 列名保持一致。
- **`约定同步检查清单` 7 项**：HTTP 方法、字段命名、响应格式、DTO 后缀、认证流程、权限串格式、API 路由格式——任一改动必须两侧同步。

## 已知歧义与例外（避免误报）

审查按**项目内一致性**判定，而非把技能里的某处写法当作全局铁律。以下已知分歧，**只 flag 项目内不一致**，不要判 Critical：

1. **`/add` vs `/create` 创建端点 URL**——`api-typescript-spec` 的 URL 表写 `/create`，而 `thirdnet-fullstack` 协调技能派发示例与 `frontend-developer` 子代理用 `/add`。被审模块只要**自身前后端一致**即可（前端调 `/add`、后端路由也是 `/add`）；不一致才是 Major。
2. **`IAuthApi` 字段**——以 `api/interfaces/auth.ts` 实际契约为准，不按 reference 文档的形状判错。
3. **`online-user` 无独立后端 Controller**——前端 `online-user` 模块只管心跳，list/kick 走 `user.ts`。不要报“缺失 `OnlineUserManagerController`”。
4. **Controller 的 `Sys` 前缀**——多数 Controller 是 `{Entity}ManagerController`（无 `Sys`），仅 `SysConfigManagerController` 等少数带前缀。读实际类名判定，不要假设必须带或不带 `Sys`。
5. **`vue-jsx-best-practices` 用单数 `reference/` 目录**——历史决策（CHANGELOG 1.7.0），非笔误。

> 原则：当技能与技能之间、或技能与项目代码之间出现矛盾，**以项目实际既定约定为准**，把矛盾作为「歧义与待确认」上报，而不是强行按某一条判错。

## 子代理派发（大范围可选）

范围较大（≥3 个模块或全项目）时，参照协调技能 `thirdnet-fullstack` 的 Task 派发模式，并行三路：

- **后端审查者**：跑维度 A + 后端侧的 D/E/F/G，返回结构化 findings。
- **前端审查者**：跑维度 B + 前端侧的 D/E/F/G。
- **跨端审查者**：跑维度 C（类型映射 / 权限串 / URL / 约定同步），需要同时读前后端产物。

派发 prompt（含返回 schema）见 [references/report-format](references/report-format.md) 的「子代理派发」小节。主上下文负责汇总去重与最终报告——**跨端对照与汇总不派发**，留在主上下文。

## 修改方案与跟进

- 报告的「修改方案汇总」按优先级排序（Critical → Major → Minor），每条指明位置与改法。
- 用户确认要修后：单侧修复回到 `thirdnet-fullstack:backend-workflow` / `frontend-workflow`；跨端契约修复回到 `thirdnet-fullstack` 协调技能。**修复完成后必须重跑本技能**闭环，直到报告无 Critical/Major——这正是 Stop Hook 强制的循环。
- 若用户明确“先不修，只看报告”，尊重之；在对话中告知阻断结论即可，不强行改码。

## 相关技能

| 用途 | 技能 |
|------|------|
| 后端规范权威源（API/EF Core/Auth/Cache/后台/字典/微服务/工作流） | `thirdnet-fullstack:net-api-developer`、`net-efcore-developer`、`net-auth`、`net-cache-use`、`net-background-job`、`net-enum-dict`、`net-microservice-generator`、`backend-workflow` |
| 前端规范权威源（契约/Vue/Admin 模板/Pinia/Router/设计/字典/工作流） | `thirdnet-fullstack:api-typescript-spec`、`vue-best-practices`、`admin-template-setup`、`vue-pinia-best-practices`、`vue-router-best-practices`、`design-apple`、`vue-enum-dict`、`frontend-workflow` |
| 跨端类型映射 / RBAC 桥接 / 约定同步 | `thirdnet-fullstack:thirdnet-fullstack` |
| 修复时回到的开发工作流 | `thirdnet-fullstack:backend-workflow`、`frontend-workflow` |
