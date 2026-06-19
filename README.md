# Thirdnet Plugins

Claude Code 全栈开发插件集合，为 .NET 后端和 Vue 前端提供专业开发辅助，并配套全栈协调与文档转换技能。

## 插件列表

### thirdnet-backend (v0.27.0)

.NET 10 微服务后端开发助手。

**功能：**

- 微服务项目脚手架生成（Common、Cache、API、Database 分层）
- API 接口开发（仅 GET/POST，Controller 按端分类）
- EF Core 实体模型与 Fluent API 配置
- JWT/Bearer 认证 + RBAC 权限体系（module:entity:action）
- Redis 三层缓存（CacheManager、RedisHandler、View）
- 后台定时任务（BackgroundRunner）
- PostgreSQL 批量数据操作（BulkCopy）
- 枚举字典自动同步（`[SystemDict]` 反射入库）
- 文档驱动开发工作流

**使用方式**：通过 `backend-workflow` 技能进入（全栈场景由 `thirdnet-fullstack` 协调；技能可被 PreToolUse 钩子按文件类型自动触发，或用 Skill 工具手动调用）。

### thirdnet-frontend (v0.26.0)

Vue 3 前端开发助手，支持 Web 端和移动端。

**功能：**

- Vue 3 Composition API 开发（`<script setup lang="ts">`）
- Element Plus（Web 端）/ Vant（移动端）组件开发
- uniapp 移动端开发（微信小程序兼容）
- TypeScript API 策略工厂模式（接口契约 + Real/Mock 无缝切换）
- Admin 模板 CRUD 页面开发（useCrudTable + PaginationBar + validators）
- 枚举规范（enum + JSDoc）
- Pinia 状态管理 + Vue Router 路由管理
- 设计规范（Apple 设计规范、前端创意设计）
- 文档驱动开发工作流

**使用方式**：通过 `frontend-workflow` 技能进入（全栈场景由 `thirdnet-fullstack` 协调；技能可被 PreToolUse 钩子按文件类型自动触发，或用 Skill 工具手动调用）。

### thirdnet-fullstack (v1.5.1)

全栈 Admin 功能开发协调技能。定义前端先行开发顺序、Admin 模板 CRUD 页面开发模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步、全栈项目目录布局约定。需同时安装 thirdnet-backend 和 thirdnet-frontend 插件。

### md-to-word (v0.1.0)

将 Markdown 文件转换为 Word (.docx) 文件，支持标题、粗体、斜体、代码、列表、表格等格式。

### thirdnet-template-upgrade (v0.1.0)

ThirdNet 后端模板升级操作指南——用 `thirdnet-migrate` CLI 把已生成的后端项目（admin/service）升级到最新模板版本。覆盖预检、check/diff/apply 主流程、文件 6 态分类、冲突逐个决策、回滚预案与禁止事项。

## 安装

将本仓库克隆到本地，在 Claude Code 中以 marketplace 方式加载：

```bash
git clone https://github.com/tianbiai/thirdnet-dev.git
```

然后在 Claude Code 中执行 `claude` 打开后，通过 `/plugin marketplace add` 指向本仓库的 `.claude-plugin/marketplace.json`（或仓库根目录），再用 `/plugin install thirdnet-backend@thirdnet-plugins`、`/plugin install thirdnet-frontend@thirdnet-plugins` 安装所需插件。

## 目录结构

```
thirdnet-dev/
├── .claude-plugin/
│   └── marketplace.json              # 插件集合注册清单 (v0.37.0)
├── plugins/
│   ├── thirdnet-backend/
│   │   ├── .claude-plugin/
│   │   │   ├── plugin.json
│   │   │   ├── hooks/                # 文档驱动 Stop Hook
│   │   │   └── CHANGELOG.md
│   │   └── skills/                   # 后端开发技能（10 个）
│   └── thirdnet-frontend/
│       ├── .claude-plugin/
│       │   ├── plugin.json
│       │   ├── hooks/                # 文档驱动 Stop Hook
│       │   └── CHANGELOG.md
│       └── skills/                   # 前端开发技能（11 个）
├── skills/
│   ├── thirdnet-fullstack/           # 全栈协调技能
│   ├── thirdnet-template-upgrade/    # 后端模板升级指南
│   └── md-to-word/                   # Markdown 转 Word 工具技能
└── CLAUDE.md
```

## 核心约定

两个插件均强制执行文档驱动开发流程：

```
需求分析 → 生成 plan.md → 生成 changelog.md → 生成 spec.md → 开发代码 → 同步更新文档
```

所有功能变更必须同步更新文档，Stop Hook 会在文档未更新时阻断完成。

## 许可证

MIT License
