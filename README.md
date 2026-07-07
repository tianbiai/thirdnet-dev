# Thirdnet Plugins

Claude Code 全栈开发插件集合，为 .NET 后端和 Vue 前端提供专业开发辅助，并配套全栈协调与文档转换技能。

## 插件列表

### thirdnet-fullstack (v2.2.0)

ThirdNet 全栈 Admin 开发插件（自包含），是前后端开发技能的**唯一来源**——后端 .NET 10 微服务（8 个技能）+ 前端 Vue 3（11 个技能）+ 全栈协调技能一体，统一 `thirdnet-fullstack:` 命名空间，开箱即用。

**后端（.NET 10 微服务）：**

- 微服务项目脚手架生成（Common、Cache、API、Database 分层）
- API 接口开发（仅 GET/POST，Controller 按端分类）
- EF Core 实体模型与 Fluent API 配置
- JWT/Bearer 认证 + RBAC 权限体系（module:entity:action）
- Redis 三层缓存（CacheManager、RedisHandler、View）
- 后台定时任务（BackgroundRunner）
- PostgreSQL 批量数据操作（BulkCopy）
- 枚举字典自动同步（`[SystemDict]` 反射入库）

**前端（Vue 3，Web + 移动端）：**

- Vue 3 Composition API 开发（`<script setup lang="ts">`）
- Element Plus（Web 端）/ Vant（移动端）组件开发
- uniapp 移动端开发（微信小程序兼容）
- TypeScript API 策略工厂模式（接口契约 + Real/Mock 无缝切换）
- Admin 模板 CRUD 页面开发（useCrudTable + PaginationBar + validators）
- 枚举规范（enum + JSDoc）
- Pinia 状态管理 + Vue Router 路由管理
- 设计规范（Apple 设计规范、前端创意设计）

**全栈协调：** 前端先行开发顺序、Admin 模板 CRUD 页面模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步、全栈项目目录布局、子代理调度（`backend-developer` / `frontend-developer`，隔离重型阶段）。

**文档驱动：** 所有功能变更强制同步 `plan.md → changelog.md → spec.md`，Stop Hook 在文档未更新时阻断完成；PreToolUse 钩子按编辑文件类型强制调用对应技能。

**使用方式**：全栈场景由 `thirdnet-fullstack` 协调技能进入（可派发 `backend-developer` / `frontend-developer` 子代理）；纯后端/纯前端单侧任务直接用对应 `backend-workflow` / `frontend-workflow` 技能。技能可被 PreToolUse 钩子按文件类型自动触发，或用 Skill 工具手动调用。

### md-to-word (v0.1.0)

将 Markdown 文件转换为 Word (.docx) 文件，支持标题、粗体、斜体、代码、列表、表格等格式。已并入 `thirdnet-fullstack` 插件（技能 `thirdnet-fullstack:md-to-word`）。

### thirdnet-template-upgrade (v0.11.0)

ThirdNet 模板升级操作指南（前后端通用·AI 主导）。已并入 `thirdnet-fullstack` 插件（技能 `thirdnet-fullstack:thirdnet-template-upgrade`）。

## 安装

将本仓库克隆到本地，在 Claude Code 中以 marketplace 方式加载：

```bash
git clone https://github.com/tianbiai/thirdnet-dev.git
```

然后在 Claude Code 中执行 `claude` 打开后，通过 `/plugin marketplace add` 指向本仓库的 `.claude-plugin/marketplace.json`（或仓库根目录），再用 `/plugin install thirdnet-fullstack@thirdnet-plugins` 安装全栈开发插件。

## 目录结构

```
thirdnet-dev/
├── .claude-plugin/
│   └── marketplace.json              # 插件集合注册清单 (v0.46.0)
├── plugins/
│   └── thirdnet-fullstack/           # 全栈开发插件（自包含，v2.2.0）
│       ├── .claude-plugin/
│       │   ├── plugin.json
│       │   ├── hooks/                # 文档驱动 Stop Hook + 技能合规 PreToolUse/PostToolUse（6 条）
│       │   └── CHANGELOG.md
│       ├── agents/                   # 子代理：backend-developer / frontend-developer
│       └── skills/                   # 全部技能（24 个：1 全栈协调 + 8 后端 + 11 前端 + 1 审查 + 1 文档 + 1 模板升级 + 1 工具）
└── CLAUDE.md
```

## 核心约定

本插件强制执行文档驱动开发流程：

```
需求分析 → 生成 plan.md → 生成 changelog.md → 生成 spec.md → 开发代码 → 同步更新文档
```

所有功能变更必须同步更新文档，Stop Hook 会在文档未更新时阻断完成。

## 许可证

MIT License
