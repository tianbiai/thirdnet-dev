# Thirdnet Plugins - Claude Code 插件集合

本项目是为 Claude Code 开发的全栈开发插件集合，提供后端（.NET 微服务）和前端（Vue 3）的专业开发辅助。

## 项目结构

```
thirdnet-dev/
├── plugins/
│   └── thirdnet-fullstack/        # 全栈开发插件（自包含）(v2.5.0)：后端 .NET 微服务 + 前端 Vue 3 + 全栈协调 + 全栈审查 + 项目文档生成 + 模板升级 + Markdown 转 Word（全部技能内聚于此）
└── .claude-plugin/
    └── marketplace.json      # 插件集合注册清单 (v0.49.0)
```

## 核心约定

### 文档驱动开发

本插件强制执行文档驱动开发流程：

```
需求分析 → 生成 plan.md → 生成 changelog.md → 生成 spec.md → 编码 → 校验 + 同步更新文档
```

所有功能变更必须同步更新文档——**文档完整性 Stop Hook（后端文档门 + 前端文档门，共两个）** 会在文档未更新时阻断完成。另有**全栈质量收尾门 Stop Hook**：检测到功能性代码变更（后端 `*.cs` 或前端 `*.vue`/`*.ts`）未通过 `fullstack-review` 审查、或仍有 Critical/Major 问题时，阻断会话结束。合计**三个 Stop Hook**。

### 技能体系

`thirdnet-fullstack` 插件通过 `skills/` 目录组织全部领域知识（共 24 个技能）：

- **后端（8 个）**：微服务生成、API 开发、EF Core（含批量操作）、认证授权、缓存、后台任务、枚举字典、后端工作流
- **前端（11 个）**：Vue 3 最佳实践、设计规范、API TypeScript 规范、Admin 模板安装、前端工作流、Pinia、Router、JSX、Composable 设计、Apple 设计规范、枚举字典规范（vue-enum-dict）
- **全栈协调（1 个）**：`thirdnet-fullstack` 协调技能——前端先行开发顺序、Admin CRUD 页面模式、前后端类型映射、RBAC 桥接、子代理调度
- **质量保障（1 个）**：`fullstack-review`——功能开发完成后的全栈代码审查与验证（前后端规范、API、数据库、跨端契约、业务正确性、性能、安全、文档），产出审查报告与修改方案
- **文档交付（1 个）**：`thirdnet-doc-generator`——功能开发完成后基于代码库功能模块生成项目交付文档（需求规格说明书、系统设计文档、用户手册、测试用例文档等，每类有专属模板，输出 Markdown 可转 Word）
- **模板升级（1 个）**：`thirdnet-template-upgrade`——前后端模板升级操作指南（thirdnet-migrate / create-thirdnet-admin），工具出 diff 素材、AI 全量判定并直接升级文件
- **工具（1 个）**：`md-to-word`——Markdown 转 Word（.docx）转换工具技能

## 插件说明

### thirdnet-fullstack

ThirdNet 全栈 Admin 开发插件（自包含），是前后端开发技能的唯一来源。技术栈：

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架（自定义模板）；Redis 缓存 + JWT（国密）认证；仅允许 GET/POST 方法（网关限制）
- **前端**：Vue 3 + Element Plus + Vite（Web 端）；uniapp + Vant（移动端，发布为微信小程序 mp-weixin）
- **全栈协调**：前端先行、Admin CRUD 页面模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步；含 `backend-developer` / `frontend-developer` 两个子代理隔离重型阶段

**使用方式**：全栈场景由 `thirdnet-fullstack` 协调技能进入（可派发子代理）；纯后端/纯前端单侧任务直接用 `backend-workflow` / `frontend-workflow` 技能。技能可被 PreToolUse 钩子按编辑的文件类型自动触发，或用 Skill 工具手动调用。

## 开发注意事项

- 所有文档和 commit message 使用中文
- 插件内的技能（skills/）和钩子（hooks/）定义了具体的开发规范
- 修改插件内容后，注意同步更新版本号：插件 `plugin.json`、协调技能 `SKILL.md` 的 `metadata.version`、`marketplace.json` 中对应条目三处须保持一致
