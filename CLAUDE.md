# Thirdnet Plugins - Claude Code 插件集合

本项目是为 Claude Code 开发的全栈开发插件集合，提供后端（.NET 微服务）和前端（Vue 3）的专业开发辅助。

## 项目结构

```
thirdnet-dev/
├── plugins/
│   ├── thirdnet-backend/     # .NET 10 微服务后端开发插件 (v0.3.0)
│   └── thirdnet-frontend/    # Vue 3 前端开发插件 (v0.8.0)
└── .claude-plugin/
    └── marketplace.json      # 插件集合注册清单
```

## 核心约定

### 文档驱动开发

两个插件均强制执行文档驱动开发流程：

```
需求分析 → 生成 plan.md → 生成 changelog.md → 生成 spec.md → 开发代码 → 同步更新文档
```

所有功能变更必须同步更新文档，Stop Hook 会在文档未更新时阻断完成。

### 技能体系

每个插件通过 `skills/` 目录组织领域知识：

- **Backend**：7 个技能覆盖微服务生成、API 开发、EF Core、认证、缓存、后台任务、批量操作
- **Frontend**：6 个技能覆盖 Vue 3 最佳实践、Pinia、Router、JSX、Options API、Composable 设计

## 插件说明

### thirdnet-backend

.NET 10 微服务后端开发专家，技术栈：

- .NET 10 + PostgreSQL + EF Core
- ThirdNet.Core 框架（自定义模板）
- Redis 缓存 + JWT 认证
- 仅允许 GET/POST 方法（网关限制）

**使用方式**：`/thirdnet-backend`

### thirdnet-frontend

Vue 3 前端开发专家，支持双平台：

- **Web 端**：Vue 3 + Element Plus + Vite
- **移动端**：uniapp + Vant（发布为微信小程序 mp-weixin）

**使用方式**：`/thirdnet-frontend`

## 开发注意事项

- 所有文档和 commit message 使用中文
- 插件内的规则（rules/）和技能（skills/）定义了具体的开发规范
- 修改插件内容后，注意同步更新 `marketplace.json` 中的版本号
