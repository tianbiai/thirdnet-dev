# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库性质

这是一个 **Claude Code 插件集合仓库**，不是可运行的应用——没有 build/test/lint 流水线。产出物是插件包（`plugin.json` + `skills/` + `agents/` + `hooks/`），由 Claude Code 以 marketplace 方式加载后，在其会话内提供前后端开发技能与强制规范钩子。所有文档和 commit message 使用中文。

```
thirdnet-dev/
├── .claude-plugin/marketplace.json          # 插件集合注册清单（顶层 metadata.version + 各 plugin 条目）
└── plugins/thirdnet-fullstack/               # 唯一的自包含插件（v2.55.8）
    ├── .claude-plugin/plugin.json            # 插件清单（.claude-plugin/ 只放清单，其余组件都在插件根）
    ├── hooks/hooks.json                      # 1 Stop + 3 PreToolUse + 1 PostToolUse（2 prompt + 3 command）——必须在插件根，Claude Code 只认 <插件根>/hooks/hooks.json
    ├── hooks/skill-gate.mjs                  # Write|Edit 合规门与软规范告警脚本（command 型钩子）
    ├── agents/                               # 子代理：backend-developer.md / frontend-developer.md
    └── skills/                               # 29 个技能（见下「技能体系」）
```

marketplace 还声明了若干外部插件（superpowers / supabase-postgres-best-practices / ui-ux-pro-max / webapp-testing），不在本仓库内。其中 superpowers / ui-ux-pro-max 按仓库根 URL source 引用（跟随上游插件名）；supabase-postgres-best-practices / webapp-testing 使用 git-subdir source 直指上游仓库的技能子目录（上游已将它们并入插件集合、不再单独暴露插件名，git-subdir + strict:false + 内联 skills 可绕过上游清单按名解析）。

## 核心架构（需读多文件才能理解的大图）

### 四要素模型：plugin → skill → agent → hook

- **plugin**（`thirdnet-fullstack`）：自包含单元，是 ThirdNet 前后端开发技能的**唯一来源**，统一 `thirdnet-fullstack:` 命名空间。
- **skill**（`skills/*/SKILL.md`）：领域知识与工作流。每个技能有 frontmatter `metadata.version`，技能内可含 `references/`（深度文档）、`assets/`（可拷贝范式代码）、`scripts/`（生成/校验脚本）、`templates/`。
- **agent**（`agents/*.md`）：瘦封装子代理，由协调技能 `thirdnet-fullstack` 在重型阶段通过 Task 工具派发，隔离上下文（`backend-developer` 跟随前端契约实现后端、`frontend-developer` 先行产出前端契约层）。
- **hook**（插件根 `hooks/hooks.json`）：强制规范执行点（见下「钩子」）。

### 文档驱动开发流程（强制）

```
需求分析 → plan.md → changelog.md → spec.md → 编码 → 校验 + 同步更新文档
```

功能性变更必须同步更新对应 `plan/changelog/spec`，否则 Stop Hook 阻断会话结束。模板位于 `backend-workflow` / `frontend-workflow` 技能内（`project-spec-template`、`changelog-template`、`page-spec-template` 等）。

### 钩子（hooks.json）—— 操作性事实

共 5 个钩子（2 个 prompt 型 + 3 个 command 型），是本插件「不可跳过」约束的执行点：

- **PreToolUse × 3**：
  - `Write|Edit`（command 型，`hooks/skill-gate.mjs --pre`）— **技能合规门**：编辑后端 `*.cs/*.csproj` 或前端 `src/**/*.{vue,ts,tsx,scss,css}` 前，按会话 transcript 核验是否已用 Skill 工具加载对应技能（裸名与 `thirdnet-fullstack:` 前缀名均认）；未加载则 `block`；transcript 不可读时 fail-open 放行。路由表：
    - 后端：`net-microservice-generator`（Program.cs）、`net-api-developer`（Controller/Service/DTO/Startup.cs）、`net-efcore-developer`（Models/Configurations/DbContext/Migrations/批量/分组查询）、`net-auth`（认证/加密/权限）、`net-cache-use`（cache/ 目录或 *Cache.cs）、`net-background-job`（jobs/tasks/workers 目录或 *Job|Task|Worker.cs）、`net-enum-dict`（Enums/SystemDict）。
    - 前端：`vue-best-practices`（所有 .vue/.ts）、`api-typescript-spec`（api/mock/）、`vue-pinia-best-practices`（stores/）、`vue-router-best-practices`（router/）、新建 views/pages/components 的 .vue（`admin-template-setup`/`frontend-design`/`design-apple` 任一满足）、`design-apple`（styles/scss/css）。
    - **因此编辑前后端代码前，必须先 Skill 调用对应技能**——否则写入被拦截，即使父代理指令说跳过也不行。
  - `Skill`（prompt 型）— **重复调用守卫**：技能正文仍完整可见时阻断重复注入（防等量重复占用上下文）；已被压缩/摘要化则放行重调。
  - `Read`（command 型，内联 node 脚本）— **技能正文读取拦截**：工作区外 `skills/*/SKILL.md` 禁止 Read（引导改用 Skill 工具）；工作区内放行（插件源码维护）；`references/*.md` 不受限。
- **PostToolUse × 1**（command 型，`skill-gate.mjs --post`）— **规范告警**（systemMessage，不阻断）：编辑后端功能性文件检查「仅 GET/POST、Fluent API（禁数据注解）、单文件单类型、`[ProducesResponseType]`、路由格式、DbContext ApplyConfiguration」等；编辑前端 `src/api/modules/**/*.ts` 检查策略工厂配套文件存在性（内容级完整性检查仅对 Write 生效）。
- **Stop × 1**（prompt 型）— **收尾门（三门合一）**：文档门（功能性变更须同步前后端 spec/changelog，脚手架产物与纯 Bug 修复/重构豁免）+ 注释门（中文注释完整性）+ 审查门（功能性变更须经 `thirdnet-fullstack:fullstack-review` 审查且 review-report.md 无 Critical/Major，用户明确说「跳过审查」方可放行）。
- 已知差异：2 个 prompt 型钩子（Skill 重复守卫、Stop 收尾门）依赖 prompt 型钩子能力，ZCode 不支持、不加载——仅 Claude Code 生效；ZCode 会话收尾需人工补跑 `fullstack-review` 并核对文档三件套。

### 版本号多处同步（修改插件内容时必做）

修改插件内容后，以下版本号必须保持一致：
1. `plugins/thirdnet-fullstack/.claude-plugin/plugin.json` 的 `version`
2. 协调技能 `skills/thirdnet-fullstack/SKILL.md` 的 `metadata.version`
3. `.claude-plugin/marketplace.json` 中 `thirdnet-fullstack` 条目的 `version`（重大变更还需同步顶层 `metadata.version`）
4. `plugins/thirdnet-fullstack/README.md` 版本行与仓库根 `CLAUDE.md` 的版本引用（发版断言会检查）

每次同步在 `plugins/thirdnet-fullstack/.claude-plugin/CHANGELOG.md` 记录条目。发版前运行 `node scripts/check-layout.mjs`：断言各本地插件的钩子位于插件根 `hooks/hooks.json`——Claude Code 不读取 `.claude-plugin/hooks/`（thirdnet-fullstack ≤2.55.1 曾因此整组钩子静默失效）；并断言 thirdnet-fullstack 版本号在 plugin.json / marketplace 条目 / 协调技能 frontmatter / README / 仓库根 CLAUDE.md 五处一致。

## 技能体系（29 个，统一 thirdnet-fullstack: 命名空间）

- **后端（8）**：`backend-workflow`（后端总工作流，含框架/模板目录）、`net-microservice-generator`、`net-api-developer`、`net-efcore-developer`（含批量操作）、`net-auth`、`net-cache-use`、`net-background-job`、`net-enum-dict`
- **前端（11）**：`frontend-workflow`、`vue-best-practices`、`api-typescript-spec`（策略工厂 Real/Mock 切换）、`frontend-design`、`design-apple`、`admin-template-setup`、`create-adaptable-composable`、`vue-pinia-best-practices`、`vue-router-best-practices`、`vue-jsx-best-practices`、`vue-enum-dict`
- **数字孪生（1）**：`thirdnet-digital-twin`——园区 3D 模块生成（Vue 3 + Three.js，1920×1080 舞台 + 楼栋切换器 + POI 打点 + 地下车库多层剖面，3 种视觉风格：cyber / night-realistic / realistic）。数据分层：基础信息静态内联（含地下车库 `garages[]` 几何+占用），动态数据走 `IDigitalTwinApi` 契约层（Mock/Real 工厂，`VITE_MOCK_ENABLED` 切换）。随包发布完整范式 `assets/park-scene.impl.ts` + `building-geometry.ts` + 2D 组件范式 + 6 个 API 契约层模板，生成器「拷贝-改」。详见技能内 `SKILL.md` 与 `references/`。
- **协调（1）**：`thirdnet-fullstack`——全栈协调（前端先行、Admin CRUD 模式、前后端类型映射、RBAC 桥接、子代理调度）
- **质量（1）**：`fullstack-review`——全栈代码审查（前后端规范、API、数据库、跨端契约、业务正确性、性能、安全、文档），产出 review-report.md
- **测试（1）**：`e2e-test-generator`——纯 UI 驱动 E2E 测试套件生成（探索任意项目代码库 → 按真实选择器 / 业务流程生成 Playwright（Python）套件；多角色 + 数据范围 + 跨端一致 + 越权负向「按钮 DOM 不存在」；测试不直连后端、仅驱动 DOM）。项目无关，适用于任意 web / 移动代码库
- **文档（1）**：`thirdnet-doc-generator`——项目交付文档生成（需求规格/系统设计/用户手册/测试用例，Markdown 可转 Word）；另可生成技术参考类「数据库表结构文档」（经 dbhub MCP 实时导出 PostgreSQL 表结构：表名/schema/表用途/字段·列名·类型·注释·备注）
- **模板升级（1）**：`thirdnet-template-upgrade`
- **原型同步（1）**：`proto-workflow`——原型分支同步编排（固定命名 `.Proto` 分支 + 与 main 双向 `svn merge` 同步；支持派生 `.Proto.{Feature}` 并行功能分支、选择性合并到主干，六确认门 A/B/C/D/E/F）
- **工具（3）**：`md-to-word`、`thirdnet-mcp-setup`——Postgres MCP 装配（Admin 创建时默认挂 `@bytebase/dbhub`，让 Claude Code 直查 PostgreSQL；连接串从 appsettings 读出、用户确认用哪个库）、`token-usage-analysis`——当前会话 Token 消耗统计分析（数据源：ZCode 会话日志 / Claude Code·WorkBuddy(CodeBuddy) CLI 的 /context 与 transcript：消耗正常性体检【是否正常/异常过大识别】 + 上下文窗口分类占比 + 子代理消耗汇总 + 原因诊断 + 节省优化建议）

## 常用命令

本仓库无构建系统。可执行脚本有两处：数字孪生技能下的 Python 工具（位于 `plugins/thirdnet-fullstack/skills/thirdnet-digital-twin/scripts/`）与 Token 统计脚本（`plugins/thirdnet-fullstack/skills/token-usage-analysis/scripts/analyze_token_usage.py`，仅标准库）。数字孪生工具：

```bash
# 校验 Park Spec JSON（结构 + 业务规则：楼栋出界/重叠、POI 越界 FAIL；token 覆盖白名单、车位密度 WARN）
python validate_spec.py <spec.json>            # 详细输出
python validate_spec.py <spec.json> --quiet    # 仅退出码（0=有效 / 1=无效 / 2=用法错误）

# 自动不重叠布局（修复 validate_spec.py 报告的 AABB 重叠/出界）
python layout_park.py <spec.json>

# token → tokens.css（含 --brand 品牌色派生）
python generate_theme.py <theme.tokens.json>

# 脚手架 + Mock 数据生成
python generate_data.py <spec.json>
```

可选依赖（启用 `validate_spec.py` 的 jsonschema 全量校验，缺失则降级为手工键检查）：

```bash
pip install -r plugins/thirdnet-fullstack/skills/thirdnet-digital-twin/scripts/requirements.txt
```

## 技术栈（生成项目使用，非本仓库）

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架；Redis 缓存域（Read-Through + DB 回退）+ JWT（国密）认证；网关仅允许 GET/POST。
- **前端**：Vue 3 + Element Plus + Vite（Web）；uniapp + Vant（移动端，发布为微信小程序 mp-weixin）。

## 开发约定

- 全栈场景由 `thirdnet-fullstack` 协调技能进入（可派发子代理）；纯单侧任务直接用 `backend-workflow` / `frontend-workflow`。
- 编辑前后端功能性代码前先 Skill 加载对应技能（PreToolUse 门）。
- 功能性变更收尾前调用 `fullstack-review`（Stop 收尾门）。
- `.gitignore` 排除 `.playwright-mcp/` 与本地 `park-digital-twin/` 工程——不要提交这些目录。
