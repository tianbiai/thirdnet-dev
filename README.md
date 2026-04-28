# Thirdnet Plugins

Claude Code 全栈开发插件集合，为 .NET 后端和 Vue 前端提供专业开发辅助。

## 插件列表

### thirdnet-backend (v0.10.0)

.NET 10 微服务后端开发助手。

**功能：**

- 微服务项目脚手架生成（Common、Cache、API、Database 分层）
- API 接口开发（仅 GET/POST，Controller 按端分类）
- EF Core 实体模型与 Fluent API 配置
- JWT/Bearer 认证系统
- Redis 三层缓存（CacheManager、RedisHandler、View）
- 后台定时任务（BackgroundRunner）
- PostgreSQL 批量数据操作（BulkCopy）

**触发命令：** `/thirdnet-backend`

### thirdnet-frontend (v0.19.0)

Vue 3 前端开发助手，支持 Web 端和移动端。

**功能：**

- Vue 3 Composition API 开发（`<script setup lang="ts">`）
- Element Plus（Web 端）/ Vant（移动端）组件开发
- uniapp 移动端开发（微信小程序兼容）
- Apple 设计规范与前端创意设计技能
- TypeScript API 策略工厂模式（接口契约 + Mock/Real 无缝切换）
- Pinia 状态管理 + Vue Router 路由管理
- 文档驱动开发工作流

**触发命令：** `/thirdnet-frontend`

## 安装

将本仓库克隆到本地，在 Claude Code 中配置插件路径：

```bash
git clone https://github.com/tianbiai/thirdnet-dev.git
```

然后在 Claude Code 的 `settings.json` 中添加插件路径指向 `thirdnet-dev` 目录。

## 目录结构

```
thirdnet-dev/
├── .claude-plugin/
│   └── marketplace.json      # 插件集合注册清单
├── plugins/
│   ├── thirdnet-backend/
│   │   └── skills/           # 后端开发技能（7 个）
│   └── thirdnet-frontend/
│       └── skills/           # 前端开发技能（10 个）
└── CLAUDE.md
```

## 许可证

MIT License
