# thirdnet-fullstack

ThirdNet 全栈 Admin 开发插件（自包含）—— Claude Code 插件，为后端 .NET 10 微服务 + 前端 Vue 3 全栈开发提供技能（领域知识）、子代理（重型阶段隔离）与钩子（合规与文档门）。

是 ThirdNet 前后端开发技能的**唯一来源**：后端 .NET 微服务与前端 Vue 3 的全部技能均收录于此，统一 `thirdnet-fullstack:` 命名空间，开箱即用。

- **版本**：2.5.0（目录清单 `thirdnet-plugins` v0.49.0）
- **许可**：MIT

## 技术栈

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架（自定义模板）；Redis 缓存 + JWT（国密 SM2）认证；仅允许 GET/POST 方法（网关限制）
- **前端**：Vue 3 + Element Plus + Vite（Web 端）；uniapp + Vant（移动端，发布为微信小程序 mp-weixin）
- **全栈协调**：前端先行、Admin CRUD 页面模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步；含 `backend-developer` / `frontend-developer` 两个子代理隔离重型阶段

## 技能清单（24 个）

### 后端（8 个 · `.NET`）
| 技能 | 用途 |
|------|------|
| `backend-workflow` | 后端开发入口与路由器、文档驱动开发流程 |
| `net-microservice-generator` | `dotnet new thirdnet-service` 创建微服务 |
| `net-api-developer` | Controller / Service / DTO / API 端点 |
| `net-efcore-developer` | 实体 / DbContext / 迁移 / 批量操作（含 PostgreSQL 最佳实践） |
| `net-auth` | 认证（JWT/Basic/ApiKey）与授权（RBAC / `[PermissionAuthorize]`） |
| `net-cache-use` | Redis 缓存域 / 分布式锁 |
| `net-background-job` | 后台任务（BackgroundRunner） |
| `net-enum-dict` | 枚举字典 / 自定义字典（`[SystemDict]`） |

### 前端（11 个 · `Vue`）
| 技能 | 用途 |
|------|------|
| `frontend-workflow` | 前端开发完整工作流与规范 |
| `api-typescript-spec` | API 接口 TypeScript 全流程规范（策略工厂模式 `IXxxApi`） |
| `admin-template-setup` | Admin 管理后台前端模板安装与 CRUD 页面开发 |
| `vue-enum-dict` | 前端枚举字典 / 自定义字典使用 |
| `design-apple` | Apple 风格设计系统与 CSS/SCSS 规范 |
| `vue-best-practices` ⭐ | Vue 3 最佳实践（上游 `vuejs-ai`，英文） |
| `vue-pinia-best-practices` ⭐ | Pinia 最佳实践（上游 `vuejs-ai`，英文） |
| `vue-router-best-practices` ⭐ | Vue Router 最佳实践（上游 `vuejs-ai`，英文） |
| `vue-jsx-best-practices` ⭐ | Vue JSX 语法（上游 `vuejs-ai`，英文） |
| `create-adaptable-composable` ⭐ | 可适配 Composable 设计（上游 `vuejs-ai`，英文） |
| `frontend-design` ⭐ | 设计方向与创意风格决策（通用，英文） |

> ⭐ 为上游/第三方技能（作者 `github.com/vuejs-ai` 或通用来源），随插件分发但内容为英文、保持上游原样。

### 全栈协调（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-fullstack` | 全栈功能开发协调——前端先行顺序、类型映射、RBAC 桥接、共享 API 约定同步、子代理调度 |

### 质量保障（1 个）
| 技能 | 用途 |
|------|------|
| `fullstack-review` | 功能开发完成后的全栈代码审查与验证（7 维度），产出 `review-report.md` |

### 文档交付（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-doc-generator` | 基于代码库生成项目交付文档（需求规格 / 系统设计 / 用户手册 / 测试用例，输出 Markdown 可转 Word） |

### 模板升级（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-template-upgrade` | 前后端模板升级（`thirdnet-migrate` / `create-thirdnet-admin`），工具出 diff、AI 全量判定并直接升级 |

### 工具（1 个）
| 技能 | 用途 |
|------|------|
| `md-to-word` | Markdown 转 Word（.docx）转换工具 |

## 子代理（2 个 · `agents/`）

| 子代理 | 职责 |
|--------|------|
| `backend-developer` | 由协调技能在「后端阶段」派发，按前端契约实现后端模块（强制先调后端技能） |
| `frontend-developer` | 由协调技能在「前端阶段」派发，前端先行产出契约 + CRUD 页面 |

## 钩子（`.claude-plugin/hooks/hooks.json`，7 个 prompt 钩子，全可移植）

- **PreToolUse**（2 个）：编辑后端 `*.cs` / 前端 `src/*.{vue,ts}` 前，强制对应技能已加载（技能合规门）。
- **PostToolUse**（2 个）：编辑功能性代码后，提醒更新 spec.md / changelog 并做软规范告警。
- **Stop**（3 个）：①后端文档门、②前端文档门（功能性变更须同步文档）、③全栈质量收尾门（功能性变更须通过 `fullstack-review` 且无 Critical/Major）——三者皆在会话结束时阻断。

## 安装

本插件经仓库根 `.claude-plugin/marketplace.json` 注册（`source: ./plugins/thirdnet-fullstack`）。在 Claude Code 中添加本仓库为 marketplace 后启用 `thirdnet-fullstack` 即可；或本地测试：

```bash
claude --plugin-dir /path/to/thirdnet-dev/plugins/thirdnet-fullstack
```

## 前置条件

- **后端**：.NET 10 SDK（`net10.0`）、EF Core CLI（`dotnet ef`）；可访问内部 NuGet 源（地址见 `backend-workflow/references/internal-registry.md`）
- **前端**：Node.js（Vite 8 / Vue 3.5）；可访问内部 npm 源（同上）
- **md-to-word**：Python 3 + `python-docx` / `markdown` / `Pillow`（`pip install python-docx markdown Pillow`）

## 使用方式

- **全栈场景**：由 `thirdnet-fullstack` 协调技能进入（可派发 `backend-developer` / `frontend-developer` 子代理隔离重型阶段）。
- **纯后端 / 纯前端单侧任务**：直接用 `backend-workflow` / `frontend-workflow` 技能。
- **技能可被 PreToolUse 钩子按编辑的文件类型自动触发**，或用 Skill 工具手动调用。

## 开发约定

- 所有文档与 commit message 使用中文。
- 修改插件内容后，**同步更新版本号于三处**并保持一致：`plugin.json`、协调技能 `SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version`（CHANGELOG 与 marketplace 顶层 `metadata.version` 锁步）。
- 变更历史见 [`.claude-plugin/CHANGELOG.md`](.claude-plugin/CHANGELOG.md)。
