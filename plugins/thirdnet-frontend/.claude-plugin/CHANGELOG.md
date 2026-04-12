# Changelog

## 0.10.0 - 2026-04-12

### Added
- 新增 `api-typescript-spec` 技能：完整的 TypeScript API + Mock 全流程规范
- 新增适配器模式：Web 端 Axios（`adapter.web.ts`）+ 移动端 uni.request（`adapter.uni.ts`），条件编译自动选择
- 新增基础类型定义：`PaginationParams`、`PaginatedResponse<T>`、`RequestConfig<TData>`、`ApiError`、`SortParams`
- 新增认证接口模块：`api/modules/app/auth.ts`（IdentityServer Connect）+ `utils/token.ts`（双平台 Token 管理）
- 新增 Mock 类型系统：`mock/types.ts`（`MockRoute`、`MockConfig`）+ `mock/handler.ts` 统一路由注册

### Changed
- **TypeScript 全面升级**：API 模块（`api/modules/*.js`）→（`api/modules/{endpoint}/*.ts`），Mock 数据（`mock/data/*.js`）→（`mock/data/{endpoint}/*.ts`）
- **端点嵌套结构**：API 和 Mock 目录按 `app/`（用户端）和 `manager/`（管理端）子目录组织，对应后端 Controller 目录
- **请求模式升级**：直接 `request()` → 适配器模式 `request<T>(config)`，支持类型推断
- 更新 `rules/skills-checklist.md`：API-Mock 章节引用 TypeScript 规范，新增 `api-typescript-spec` 技能
- 更新 `rules/project-spec-template.md`：项目结构树和 API 规范章节全面改为 TypeScript 架构
- 更新 `rules/spec-template.md`：数据来源和 API 接口规范引用 TypeScript 路径和模式
- 更新 `agents/frontend-developer.md`：规则9 代码示例改为 TypeScript，项目结构树更新
- 更新 `commands/thirdnet-frontend.md`：API-Mock 引用改为 TypeScript 路径
- 更新 `hooks.json`：PostToolUse 钩子检查路径改为 `**/*.ts`

## 0.9.0 - 2026-04-11

### Added
- 新增 API-Mock 一一对应架构：API 模块（`api/modules/*.js`）与 Mock 数据（`mock/data/*.js`）文件名一一对应，方法一一对应
- 新增 Mock 路由拦截层：通过 `mock/index.js` 按 URL + Method 精确匹配，`MOCK_ENABLED` 单一开关控制
- 新增演示模式与帮助气泡控制（Agent 规则11）：`MOCK_ENABLED=true` 显示帮助气泡+Mock 数据，`false` 完全移除+真实 API
- 新增 `v-if` 安全渲染要求：帮助气泡必须用 `v-if`（禁止 `v-show`），确保生产环境无信息泄露

### Changed
- 重构 Agent 规则10：从简单 Mock 文件规范升级为完整的 API-Mock 一一对应架构
- 更新项目结构：`mock/` 目录从页面组织改为路由拦截层+数据层架构
- 更新 spec-template.md：帮助气泡规范增加 MOCK_ENABLED 控制，数据来源增加 API-Mock 对应关系
- 更新 project-spec-template.md：API 规范增加架构说明和演示模式控制章节
- 更新 hooks.json：PostToolUse 增加对 mock/api 文件变更的检测提醒

## 0.8.0 - 2026-04-08

### Changed
- 将本地 `skills/frontend-design/` 技能改为使用全局安装的 `/frontend-design` 技能
- 更新所有技能引用（skills-checklist、spec-template、project-spec-template、frontend-developer agent、thirdnet-frontend 命令）

### Removed
- 移除本地 `skills/frontend-design/` 技能文件

## 0.6.0 - 2026-04-05

### Added
- 更新项目规范模板

## 0.5.0 - 2026-04-05

### Added
- 新增前端大文件处理相关规则
- 增加 hook 支持

### Improved
- 优化技能说明

## 0.4.0 - 早期版本

- 前端开发助手 - Vue 3 页面、组件、样式开发
