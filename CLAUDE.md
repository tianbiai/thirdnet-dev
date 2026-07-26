# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 仓库性质

这是一个 **Claude Code 插件集合仓库**，不是可运行的应用——没有 build/test/lint 流水线。产出物是插件包（`plugin.json` + `skills/` + `agents/` + `hooks/`），由 Claude Code 以 marketplace 方式加载后，在其会话内提供前后端开发技能与强制规范钩子。所有文档和 commit message 使用中文。

```
thirdnet-dev/
├── .claude-plugin/marketplace.json          # 插件集合注册清单（顶层 metadata.version + 各 plugin 条目）
└── plugins/thirdnet-fullstack/               # 唯一的自包含插件（v2.26.0）
    ├── .claude-plugin/plugin.json            # 插件元数据（version 权威来源之一）
    ├── .claude-plugin/hooks/hooks.json       # 3 个 Stop + 2 个 PreToolUse + 2 个 PostToolUse 钩子
    ├── agents/                               # 子代理：backend-developer.md / frontend-developer.md
    └── skills/                               # 25 个技能（见下「技能体系」）
```

marketplace 还声明了若干外部插件（superpowers / supabase-postgres-best-practices / ui-ux-pro-max / webapp-testing），通过 URL source 引用，不在本仓库内。

## 核心架构（需读多文件才能理解的大图）

### 四要素模型：plugin → skill → agent → hook

- **plugin**（`thirdnet-fullstack`）：自包含单元，是 ThirdNet 前后端开发技能的**唯一来源**，统一 `thirdnet-fullstack:` 命名空间。
- **skill**（`skills/*/SKILL.md`）：领域知识与工作流。每个技能有 frontmatter `metadata.version`，技能内可含 `references/`（深度文档）、`assets/`（可拷贝范式代码）、`scripts/`（生成/校验脚本）、`templates/`。
- **agent**（`agents/*.md`）：瘦封装子代理，由协调技能 `thirdnet-fullstack` 在重型阶段通过 Task 工具派发，隔离上下文（`backend-developer` 跟随前端契约实现后端、`frontend-developer` 先行产出前端契约层）。
- **hook**（`.claude-plugin/hooks/hooks.json`）：强制规范执行点（见下「钩子」）。

### 文档驱动开发流程（强制）

```
需求分析 → plan.md → changelog.md → spec.md → 编码 → 校验 + 同步更新文档
```

功能性变更必须同步更新对应 `plan/changelog/spec`，否则 Stop Hook 阻断会话结束。模板位于 `backend-workflow` / `frontend-workflow` 技能内（`project-spec-template`、`changelog-template`、`page-spec-template` 等）。

### 钩子（hooks.json）—— 操作性事实

共 7 个钩子，是本插件「不可跳过」约束的执行点：

- **PreToolUse × 2**（matcher `Write|Edit`）— **技能合规门**：编辑后端 `*.cs/*.csproj` 或前端 `src/**/*.{vue,ts,tsx,scss,css}` 前，检查本次会话是否已用 Skill 工具加载对应技能；未加载则 `block`。路由表：
  - 后端：`net-microservice-generator`（新项目/Program.cs）、`net-api-developer`（Controller/API）、`net-efcore-developer`（Models/Configurations/DbContext/Migrations/批量/分组查询）、`net-auth`（认证/加密/权限）、`net-cache-use`（缓存）、`net-background-job`（Job/Task/Worker）、`net-enum-dict`（Enums/SystemDict）。
  - 前端：`vue-best-practices`（所有 .vue/.ts）、`api-typescript-spec`（api/mock/）、`vue-pinia-best-practices`（stores/）、`vue-router-best-practices`（router/）、`frontend-design`（新建 views/pages/components 文件）。
  - **因此编辑前后端代码前，必须先 Skill 调用对应技能**——否则写入被拦截，即使父代理指令说跳过也不行。
- **PostToolUse × 2**（matcher `Write|Edit`）— **规范告警**：编辑后端功能性文件检查「仅 GET/POST、Fluent API（禁数据注解）、单文件单类型、`[ProducesResponseType]`」等；编辑前端 `src/api/modules/**/*.ts` 检查「策略工厂三件套（I{Entity}Api 接口 + Real/Mock 实现 + createXxxApi 工厂）」。
- **Stop × 3** — **收尾门**：① 后端文档门（backend/ 下功能性变更须更新 spec/changelog/plan + 中文注释完整性）；② 前端文档门（frontend/ 下同，含 Web `public/changelog.md` 或小程序 `static/changelog.md` + viewer.html + marked.min.js）；③ **全栈质量收尾门**——功能性 `*.cs` / `*.vue` / `*.ts` 变更未经 `thirdnet-fullstack:fullstack-review` 审查、或 review-report.md 仍存 Critical/Major 问题时阻断结束（用户明确说「跳过审查」方可放行）。

### 版本号三处同步（修改插件内容时必做）

修改插件内容后，以下三处版本号必须保持一致：
1. `plugins/thirdnet-fullstack/.claude-plugin/plugin.json` 的 `version`
2. 协调技能 `skills/thirdnet-fullstack/SKILL.md` 的 `metadata.version`
3. `.claude-plugin/marketplace.json` 中 `thirdnet-fullstack` 条目的 `version`（重大变更还需同步顶层 `metadata.version`）

每次同步在 `plugins/thirdnet-fullstack/.claude-plugin/CHANGELOG.md` 记录条目。

## 技能体系（25 个，统一 thirdnet-fullstack: 命名空间）

- **后端（8）**：`backend-workflow`（后端总工作流，含框架/模板目录）、`net-microservice-generator`、`net-api-developer`、`net-efcore-developer`（含批量操作）、`net-auth`、`net-cache-use`、`net-background-job`、`net-enum-dict`
- **前端（11）**：`frontend-workflow`、`vue-best-practices`、`api-typescript-spec`（策略工厂 Real/Mock 切换）、`frontend-design`、`design-apple`、`admin-template-setup`、`create-adaptable-composable`、`vue-pinia-best-practices`、`vue-router-best-practices`、`vue-jsx-best-practices`、`vue-enum-dict`
- **数字孪生（1）**：`thirdnet-digital-twin`——园区 3D 模块生成（Vue 3 + Three.js，1920×1080 舞台 + 楼栋切换器 + POI 打点 + 地下车库多层剖面，6 种视觉风格：cyber/holographic/isometric/nebula/realistic/night-realistic）。数据分层：基础信息静态内联（含地下车库 `garages[]` 几何+占用），动态数据走 `IDigitalTwinApi` 契约层（Mock/Real 工厂，`VITE_MOCK_ENABLED` 切换）。随包发布完整范式 `assets/park-scene.impl.ts` + `building-geometry.ts` + 2D 组件范式 + 6 个 API 契约层模板，生成器「拷贝-改」。详见技能内 `SKILL.md` 与 `references/`。
- **协调（1）**：`thirdnet-fullstack`——全栈协调（前端先行、Admin CRUD 模式、前后端类型映射、RBAC 桥接、子代理调度）
- **质量（1）**：`fullstack-review`——全栈代码审查（前后端规范、API、数据库、跨端契约、业务正确性、性能、安全、文档），产出 review-report.md
- **文档（1）**：`thirdnet-doc-generator`——项目交付文档生成（需求规格/系统设计/用户手册/测试用例，Markdown 可转 Word）
- **模板升级（1）**：`thirdnet-template-upgrade`
- **工具（1）**：`md-to-word`

## 常用命令

本仓库无构建系统。唯一可执行脚本是数字孪生技能下的 Python 工具（位于 `plugins/thirdnet-fullstack/skills/thirdnet-digital-twin/scripts/`）：

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

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架；Redis 三层缓存 + JWT（国密）认证；网关仅允许 GET/POST。
- **前端**：Vue 3 + Element Plus + Vite（Web）；uniapp + Vant（移动端，发布为微信小程序 mp-weixin）。

## 开发约定

- 全栈场景由 `thirdnet-fullstack` 协调技能进入（可派发子代理）；纯单侧任务直接用 `backend-workflow` / `frontend-workflow`。
- 编辑前后端功能性代码前先 Skill 加载对应技能（PreToolUse 门）。
- 功能性变更收尾前调用 `fullstack-review`（Stop 收尾门）。
- `.gitignore` 排除 `.playwright-mcp/` 与本地 `park-digital-twin/` 工程——不要提交这些目录。
