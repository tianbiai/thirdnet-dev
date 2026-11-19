# thirdnet-fullstack

ThirdNet 全栈 Admin 开发插件（自包含）—— Claude Code 插件，为后端 .NET 10 微服务 + 前端 Vue 3 全栈开发提供技能（领域知识）、子代理（重型阶段隔离）与钩子（合规与文档门）。

是 ThirdNet 前后端开发技能的**唯一来源**：后端 .NET 微服务与前端 Vue 3 的全部技能均收录于此，统一 `thirdnet-fullstack:` 命名空间，开箱即用。

- **版本**：2.54.0（目录清单 `thirdnet-plugins` v0.77.0）
- **许可**：MIT

## 技术栈

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架（自定义模板）；Redis 缓存 + JWT（国密 SM2）认证；仅允许 GET/POST 方法（网关限制）
- **前端**：Vue 3 + Element Plus + Vite（Web 端）；uniapp + Vant 4（H5）/ @vant/weapp（微信小程序，发布为 mp-weixin）
- **全栈协调**：前端先行、Admin CRUD 页面模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步；含 `backend-developer` / `frontend-developer` 两个子代理隔离重型阶段

## 技能清单（29 个）

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

### E2E 测试（1 个）
| 技能 | 用途 |
|------|------|
| `e2e-test-generator` | 纯 UI 驱动 Playwright（Python）E2E 测试套件生成——探索任意项目代码库，按真实选择器/业务流程生成测试（多角色 + 数据范围 + 越权负向），不直连后端 |

### 文档交付（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-doc-generator` | 基于代码库生成项目交付文档（需求规格 / 系统设计 / 用户手册 / 测试用例，输出 Markdown 可转 Word） |

### 数字孪生（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-digital-twin` | 园区 3D 数字孪生模块生成（Vue 3 + Three.js，1920×1080 舞台 + 楼栋切换器 + POI 打点 + 地下车库剖面，多视觉风格 token） |

### 模板升级（1 个）
| 技能 | 用途 |
|------|------|
| `thirdnet-template-upgrade` | 前后端模板升级（`thirdnet-migrate` / `create-thirdnet-admin`），工具出 diff、AI 全量判定并直接升级 |

### 原型同步（1 个）
| 技能 | 用途 |
|------|------|
| `proto-workflow` | 原型分支同步编排（固定命名 `.Proto` 分支 + `svn merge` 双向同步；支持 `.Proto.{Feature}` 并行功能分支与选择性合并，六确认门 A–F） |

### 工具（3 个）
| 技能 | 用途 |
|------|------|
| `md-to-word` | Markdown 转 Word（.docx）转换工具 |
| `thirdnet-mcp-setup` | Postgres MCP 装配（Admin 创建时默认挂 `@bytebase/dbhub`，连接串从 appsettings 读取） |
| `token-usage-analysis` | 当前会话 Token 消耗统计分析（解析 ZCode 会话日志 / /context 输出，分类占比 + 子代理汇总 + 节省优化建议） |

## 子代理（2 个 · `agents/`）

| 子代理 | 职责 |
|--------|------|
| `backend-developer` | 由协调技能在「后端阶段」派发，按前端契约实现后端模块（强制先调后端技能） |
| `frontend-developer` | 由协调技能在「前端阶段」派发，前端先行产出契约 + CRUD 页面 |

## 钩子（`.claude-plugin/hooks/hooks.json`，4 个 prompt 钩子 + 2 个 command 钩子）

- **PreToolUse**：①`Write|Edit` 技能合规门（command 型 `hooks/skill-gate.mjs --pre`，零模型 token：按会话 transcript 核验必需技能的 Skill 调用记录，裸名/`thirdnet-fullstack:` 前缀名均认，缺失则阻断；transcript 不可读时 fail-open）；②`Skill` 重复调用守卫（prompt 型：技能正文仍完整可见时阻断重复注入，防上下文等量重复占用；已被压缩/摘要化则放行重调）；③`Read` 拦截（command 型，零模型 token：工作区外 `skills/*/SKILL.md` 禁止 Read，改走 Skill 工具；工作区内放行以支持插件源码维护）。
- **PostToolUse**（command 型 `--post`，零模型 token）：编辑功能性代码后输出软规范告警（仅 GET/POST、类型化 DTO、Fluent API、单文件单类型、API 工厂四件套配套检查、文档同步提醒），不阻断。
- **Stop**（3 个 prompt 型）：①后端文档门、②前端文档门（功能性变更须同步文档）、③全栈质量收尾门（功能性变更须通过 `fullstack-review` 且无 Critical/Major）。
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
- **token-usage-analysis**：Python 3（仅标准库，无需安装依赖）

## 使用方式

- **全栈场景**：由 `thirdnet-fullstack` 协调技能进入（可派发 `backend-developer` / `frontend-developer` 子代理隔离重型阶段）。
- **纯后端 / 纯前端单侧任务**：直接用 `backend-workflow` / `frontend-workflow` 技能。
- **技能可被 PreToolUse 钩子按编辑的文件类型自动触发**，或用 Skill 工具手动调用。

## 开发约定

- 所有文档与 commit message 使用中文。
- 修改插件内容后，**同步更新版本号于三处**并保持一致：`plugin.json`、协调技能 `SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version`（CHANGELOG 与 marketplace 顶层 `metadata.version` 锁步）。
- 变更历史见 [`.claude-plugin/CHANGELOG.md`](.claude-plugin/CHANGELOG.md)。
