# Changelog

## 2.4.0 - 2026-07-07

### Added
- **`thirdnet-doc-generator` 支持批量生成（交付套件）**：在原「一次一份」基础上新增「全部 4 类」与「多类子集」批量路径。用户明确点名一类时仍走单类线性 5 步快路径（行为不变）；含糊/泛指（如"生成项目交付文档"）时，Step 1 的 `AskUserQuestion` 把「全部 4 类（交付套件）」作为推荐首选。批量路径核心：Step 2 **共享扫描**一次（采集所选类型采集项的并集，4 类同源、不重复扫 N 遍）→ Step 3 **一次裁剪**（适用全集，保障跨文档一致）→ 新增 Step 3.6 **批量事实确认**（一次合并 `AskUserQuestion` 收集代码无法确定的业务背景/优先级/验收标准/非功能性指标，避免每个填充子代理分别打断用户）→ Step 4 **并行填充**（每类派 1 个 `general-purpose` 子代理并发产出，规避长上下文后半段质量下滑）→ Step 5 多文件输出（逐个转 Word）。

### Changed
- Step 1 由「确定文档类型」改为「确定文档集合」；description 增补触发词「交付套件 / 全套文档 / 四件套 / 一次性生成所有文档」，并把含糊时的推荐默认从「强制单选询问」改为「推荐全部 4 类，其次单类/自定义」。
- Step 3.5 触发条件由「仅当文档类型为用户手册」改为「仅当 用户手册 ∈ 文档集合」（单类用户手册、批量含用户手册均执行逐页截图）。
- `references/doc-scan-guide.md` 通用约定补「批量并集扫描」一条。
- 版本号同步：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `2.3.0` → `2.4.0`；`marketplace.json` 顶层 `metadata.version` 由 `0.47.0` → `0.48.0`；`thirdnet-doc-generator` 技能自身 `metadata.version` 由 `1.2.0` → `1.3.0`。

### Benefits
- 交付/归档/验收场景从「跑 4 次技能、扫 4 遍代码、答 4 轮问题」缩短为「一次共享扫描 + 并行填充」，且 4 份文档的模块清单/角色/实体天然一致，消除跨文档漂移。
- 单类定向场景快路径完全不变，无回归。

## 2.3.0 - 2026-07-07

### Changed
- **技能重命名 `doc-generator` → `thirdnet-doc-generator`**：技能目录、`SKILL.md` 的 `name:` 字段、调用 ID（`thirdnet-fullstack:doc-generator` → `thirdnet-fullstack:thirdnet-doc-generator`）同步更新。目录名与 `name:` 字段保持一致（沿用 `thirdnet-fullstack`、`thirdnet-template-upgrade` 的约定）。
- **引用同步**：协调技能 `thirdnet-fullstack/SKILL.md` 的任务路由表与技能清单、`plugin.json` 与 `marketplace.json` 的 description、仓库根 `CLAUDE.md`、技能内 6 个 reference 模板（`user-manual-template` / `user-manual-screenshot-guide` / `requirement-spec-template` / `doc-scan-guide` / `test-case-template` / `system-design-template`）的 prose 自引用，全部由 `doc-generator` 改为 `thirdnet-doc-generator`。
- **版本号同步**：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `2.2.0` → `2.3.0`；`marketplace.json` 顶层 `metadata.version` 由 `0.46.0` → `0.47.0`；`thirdnet-doc-generator` 技能自身 `metadata.version` 由 `1.1.0` → `1.2.0`。

### 说明
- `thirdnet-` 前缀此前仅用于品牌/伞型技能（`thirdnet-fullstack` 协调技能、`thirdnet-template-upgrade` 工具技能）；本次为有意的局部前缀扩展，其余交付类技能（`fullstack-review`、`md-to-word`）暂不迁移，保持现状。
- 2.2.0 条目中的 `skills/doc-generator/`、`新增 doc-generator` 等表述为历史记录，按仓库惯例保留不重写。
- `hooks.json`、`agents/*.md`、`README.md` 均不引用该技能，无需改动。

### Benefits
- 技能命名与插件命名空间（`thirdnet-fullstack:`）及品牌前缀（`thirdnet-`）更一致，便于在 marketplace 中识别为 ThirdNet 自有技能。

## 2.2.0 - 2026-07-07

### Added
- **`skills/doc-generator/`（新技能，项目交付文档生成）**：功能开发完成后基于代码库功能模块生成项目交付文档，覆盖需求规格说明书、系统设计文档、用户手册、测试用例文档四类，每类配专属模板（`requirement-spec-template.md` / `system-design-template.md` / `user-manual-template.md` / `test-case-template.md`），并附 `user-manual-screenshot-guide.md`、`custom-doc-guide.md`、`doc-scan-guide.md` 三份操作指南。输出 Markdown 可由 `md-to-word` 转 Word。description 含明确触发词 + AskUserQuestion 兜底确认文档类型。

### Changed
- 技能总数 21 → 24（新增 doc-generator；此前迁入的 fullstack-review、thirdnet-template-upgrade、md-to-word 一并纳入计数）。
- `README.md`、`CLAUDE.md` 中 `thirdnet-fullstack` 版本标注统一为 v2.2.0（修正历史漂移：README 曾标 v1.7.0、CLAUDE 曾标 v2.1.0）。
- `md-to-word` / `thirdnet-template-upgrade` 两个技能的 SKILL.md frontmatter 规范化：顶层 `version:` 迁移为 `metadata.version`，补 `license: MIT` 与 `metadata.author`，与全插件其他 thirdnet 技能风格一致。

### Benefits
- 项目交付文档从手工拼装升级为「扫描代码库 → 套模板 → 一键转 Word」的闭环，doc-generator 产 Markdown、md-to-word 转 docx，两技能协同。
- 插件内技能 frontmatter 结构统一，便于版本跟踪与漂移管理。

## 2.1.0 - 2026-07-06

### Changed
- **`md-to-word` 工具技能迁入插件**：从仓库根 `skills/md-to-word/` 移至 `plugins/thirdnet-fullstack/skills/md-to-word/`，纳入 `thirdnet-fullstack:` 命名空间。`scripts/md_to_docx.py`、`evals/evals.json` 及 10 个 eval fixtures 一并随迁；SKILL.md 内脚本调用路径改用 `${CLAUDE_PLUGIN_ROOT}/skills/md-to-word/scripts/md_to_docx.py`。
- 根目录 `skills/md-to-word/` 删除（git 索引标记 deleted），仓库根不再保留独立技能目录，插件成为唯一来源。

### Benefits
- Markdown 转 Word 能力与全栈开发流程同插件内闭环，无需跨目录引用。

## 2.0.0 - 2026-07-06

### Added
- **`skills/thirdnet-template-upgrade/`（模板升级技能迁入）**：前后端模板升级操作指南（`thirdnet-migrate` / `create-thirdnet-admin`）从独立位置迁入本插件，纳入 `thirdnet-fullstack:` 命名空间。工具只做 diff 对比、AI 全量判定并直接升级文件，覆盖 `references/commands.md` 与 `references/merge-protocol.md`。

### Changed
- 主版本号升至 2.x，标志插件成为完全自包含的全栈开发技能全集（不再依赖任何外部/独立技能目录）。
- 配合 1.9.0 引入的 `fullstack-review` 审查技能与 Stop Hook「全栈质量收尾门」，形成「文档驱动（Stop Hook #1/#2）+ 全栈质量审查（Stop Hook #3）」三重收尾门。

### Benefits
- 模板升级流程由 AI 主导语义判定，工具退化为纯 diff oracle，合并权与判定权收归 AI。

## 1.9.0 - 2026-07-06

### Added
- **`skills/fullstack-review/`（新技能，全栈代码审查与验证）**：填补开发完成后缺少统一验证环节的空白。功能开发完成后对已实现的前后端模块做全方位审查，覆盖七大维度——后端规范遵守、前端规范遵守、跨端契约一致性、业务功能正确性、性能、安全性、文档与流程；严格编排既有规范技能（`net-*` / `vue-*` / `api-typescript-spec` / `thirdnet-fullstack` 的 `代码审查清单` / `开发完成校验` / `约定同步检查清单`），不重述其正文。产出 `review-report.md`（问题清单 + 严重级别 Critical/Major/Minor/Info + 整体优缺点 + 歧义与待确认 + 优先级排序的修改方案 + 阻断结论）。含三份 references：`review-rules.md`（可检查规则目录）、`report-format.md`（严重级别与报告模板、子代理派发 prompt）、`scope-and-vcs.md`（SVN 未提交/最近提交/整个项目三种范围 + git 兜底 + 模块推断）。
- **Stop Hook 第 3 条（全栈质量收尾门）**：在 `hooks.json` 的 Stop 数组新增一个 prompt 钩子——检测到前后端功能性代码变更（`backend/**/*.cs` 或 `frontend/**/src/**/*.{vue,ts,tsx}`）且尚未通过 `fullstack-review` 审查（或仍有 Critical/Major）时，阻断会话结束并提示调用本技能。与既有两条文档完整性 Stop 钩子叠加，形成「文档 + 注释 + 全栈质量」三重收尾门。

### Changed
- 版本号同步：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `1.8.0` → `1.9.0`；`marketplace.json` 目录 `metadata.version` 由 `0.43.0` → `0.44.0`。
- `thirdnet-fullstack` 协调技能：任务路由表新增「功能开发完成 / 上线前检查 → 委派 `fullstack-review`」一行；约定同步检查清单补一条「审查发现跨端不一致 → 调 fullstack-review 复核」。
- `backend-workflow` / `frontend-workflow`：「开发完成校验」末尾新增「最终建议调用 `thirdnet-fullstack:fullstack-review` 做全栈审查（由 Stop Hook 强制）」；路由表加入审查入口。
- 仓库根 `CLAUDE.md`：技能总数 20 → 21，新增「质量保障（1 个）：`fullstack-review`」分类；文档驱动开发段补注 Stop Hook 现含全栈质量门。
- `plugin.json` / `marketplace.json` 的 `thirdnet-fullstack` description 更新，体现审查技能与质量收尾门。

### Benefits
- 开发完成后的验证从「碎片化」（6 钩子 + 2 域清单 + 2 交付清单 + 1 同步清单）升级为「一站式全栈审查 + 强制收尾门」，跨端契约不一致、缺权限注解、时间类型错误、缓存误用等高频问题在交付前被统一拦截。
- 审查范围适配目标项目的 SVN 工作流（未提交 / 最近提交 / 整个项目），git 兜底，模块推断自动定位前后端完整产物。
- 报告带严重级别与可执行修改方案，审查与开发职责分离（默认只报告不改码），避免审查客观性被修复动作稀释。

## 1.7.0 - 2026-06-20

### Changed（技能精简与合并，后端 10 → 8，总数 22 → 20）
- **合并 `net-authentication` + `net-rbac` → 新技能 `net-auth`**：认证（AuthN）与授权（AuthZ）本是一个安全域，两技能触发词互锁（auth 列 "Policy"、rbac 列 "授权"/"permission"）、几乎总同时加载。合并为单一 `net-auth` 技能，`crypto-catalog.md` 与 `rbac-flow.md` 作为 references。
- **折叠 `net-database-bulkcopy` → `net-efcore-developer`**：批量操作（BulkCopy / COPY 协议）本就是 EF Core 的窄分支（内存数据走 BulkCopy，已在库数据走 CTE），共享 `[DbBulk]` 故事。`bulk-operations.md` 迁入 efcore references，efcore SKILL 新增「批量数据操作」小节并保留 BulkCopy-vs-CTE 决策指针。
- **后端技能补 `metadata.version`（基线 1.0.0）**：原 10 个后端技能全部缺版本号（前端技能全有），统一补 `license: MIT` + `metadata: {version, author}`，纳入版本跟踪。
- **`reference/` → `references/` 命名统一**：`vue-pinia-best-practices`、`vue-router-best-practices` 目录与内部链接改复数，与多数技能一致；`vue-jsx-best-practices` 按既定决策保留单数不动（已知例外）。
- 同步更新所有引用点：`hooks.json` PreToolUse 钩子（net-auth 替代 net-authentication+net-rbac、net-efcore-developer 吸收 net-database-bulkcopy）、`backend-workflow` 路由表/检查清单/速查表/功能流程、`thirdnet-fullstack` 协调技能、`backend-developer` 子代理、`framework-and-template-catalog.md` 反向索引、`project-spec-template.md`、各跨技能 cross-ref。

### Added
- `skills/net-auth/`（合并自 net-authentication + net-rbac，含 crypto-catalog.md + rbac-flow.md）。

### Removed
- `skills/net-authentication/`、`skills/net-rbac/`、`skills/net-database-bulkcopy/` 三个目录。

### Benefits
- 后端技能 10 → 8（总数 22 → 20），触发词冲突降低、维护面收窄。
- 后端技能纳入版本跟踪，便于跨技术栈（.NET 10 / EF Core 10.x / Npgsql 10.x）漂移管理。

> DI/Startup 去重评估：`di-pipeline-and-startup.md`（项目级 10 步 DI）、`framework-pipeline.md`（框架级管道注册）、`appsettings-management.md`（配置层）经核对分属三个抽象层、无实质重复，未强行合并；仅在 di-pipeline 加交叉引用指针连接两者。

## 1.6.1 - 2026-06-20

### Changed
- **移除独立的 `thirdnet-backend` 与 `thirdnet-frontend` 插件**：自 1.6.0 起本插件已自包含全部前后端技能，两个独立插件成为冗余副本。删除后本插件成为 ThirdNet 前后端开发技能的**唯一来源**。
- 清理描述性引用：`plugin.json`、`hooks/hooks.json`、协调 `SKILL.md` 的「自包含说明」段落、`marketplace.json`、`README.md`、`CLAUDE.md` 中关于"已集成 thirdnet-backend / thirdnet-frontend"与"⚠️ 勿同装"的措辞，改为"唯一来源 / 开箱即用"（被警告的对象已不存在）。
- 协调 `SKILL.md`「自包含说明」段去掉 ⚠️ 同装警告，重述为单插件技能全集。
- `skills/thirdnet-template-upgrade/references/frontend-flow.md` 中 `thirdnet-frontend:frontend-workflow` 改为 `thirdnet-fullstack:frontend-workflow`。

### Removed
- `plugins/thirdnet-backend/`、`plugins/thirdnet-frontend/` 两个目录（git 历史保留）。
- `marketplace.json` 中 `thirdnet-backend`、`thirdnet-frontend` 两个 plugin 条目。

### Benefits
- 消除 1.6.0 记载的「跨插件三处同步」负担——今后技能只需在本插件维护一处。
- 消除「同装导致 PreToolUse 钩子命名空间互斥阻断」的风险（不再有可同装的对象）。

> 注：1.6.0 条目（含"backend/frontend 逐字节不变仍提供"）作为历史记录保留，其结论已被本条目推翻。

## 1.6.0 - 2026-06-20

### Changed
- 由包装型插件重构为**自包含集成型插件**：把 `thirdnet-backend`（10 个后端技能）与 `thirdnet-frontend`（11 个前端技能）的全部技能**复制集成**进本插件 `skills/`，技能命名空间统一为 `thirdnet-fullstack:`，本插件**可独立运行**，无需另装前后端插件
- 协调技能 `thirdnet-fullstack/SKILL.md`：跨插件相对链接本地化（`../backend-workflow/...`、`../frontend-workflow/...`）；原「前置条件检查（依赖前后端插件）」改为「自包含说明」并加 ⚠️ 勿与前后端插件同装的提示
- 两个子代理 `agents/backend-developer.md`、`agents/frontend-developer.md`：由「包装 thirdnet-backend/thirdnet-frontend 插件」改为「专精本插件集成的后端/前端本地技能」，强制技能调用表指向 `thirdnet-fullstack:` 技能
- `plugin.json` 与 `marketplace.json` 中 `thirdnet-fullstack` 条目描述改为反映自包含集成

### Added
- `.claude-plugin/hooks/hooks.json`：合并自前后端插件的 **6 条钩子**（Stop / PreToolUse / PostToolUse 各 2），技能合规检查的 14 个技能字符串统一为 `thirdnet-fullstack:` 前缀；本插件单独安装即具备与前后端插件等价的文档驱动与技能强制调用能力
- 集成进来的 21 个技能（含各自 `references/` 或单数 `reference/` 参考文档）：
  - 后端：`backend-workflow`、`net-api-developer`、`net-efcore-developer`、`net-rbac`、`net-authentication`、`net-cache-use`、`net-background-job`、`net-database-bulkcopy`、`net-enum-dict`、`net-microservice-generator`
  - 前端：`frontend-workflow`、`api-typescript-spec`、`vue-best-practices`、`admin-template-setup`、`vue-pinia-best-practices`、`vue-router-best-practices`、`vue-jsx-best-practices`、`vue-enum-dict`、`create-adaptable-composable`、`design-apple`、`frontend-design`

### Removed
- 上一版（未发布）的包装型设计：子代理不再引用 `thirdnet-backend:` / `thirdnet-frontend:` 外部插件技能

### 说明
- `thirdnet-backend` 与 `thirdnet-frontend` 插件本身**逐字节不变**，仍作为单端插件在 marketplace 提供。
- ⚠️ **勿同时安装** `thirdnet-fullstack` 与 `thirdnet-backend` / `thirdnet-frontend`：本插件自带的 PreToolUse 钩子（检查 `thirdnet-fullstack:` 技能）与前后端插件钩子（检查 `thirdnet-backend:` / `thirdnet-frontend:`）命名空间不同，同装会导致编辑同一文件时两个钩子互斥阻断。请二选一。
- 集成为复制（非移动），因此技能内容在 fullstack 与前后端插件中各有一份，后续改动需同步——这是「保留前后端插件 + 自包含 fullstack」的既定代价。
