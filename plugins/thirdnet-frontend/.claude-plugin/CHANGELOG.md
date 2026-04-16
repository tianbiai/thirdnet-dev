# Changelog

## 0.11.0 - 2026-04-16

### Added
- 新增**策略工厂模式（Strategy Factory Pattern）**：API 模块从纯函数升级为接口契约（`IXxxApi`）+ Real 策略（`RealXxxApi` 适配 HTTP）+ Mock 策略（`MockXxxApi` 适配本地数据）+ 工厂函数（`createXxxApi()`）
- 新增**设计模式文档**：策略模式 + 简单工厂 + 适配器模式的组合运用说明，以及 SOLID 原则对应关系
- 新增**枚举类型规范**：所有枚举使用 TypeScript `enum` 关键字 + JSDoc 注释，禁止 union type 或 const object 替代
- 新增**TypeScript 强制要求**：所有前端代码必须使用 `.ts` 扩展名，Vue 组件必须 `<script setup lang="ts">`，禁止原生 JS
- 新增 `api/types/enums.ts` 跨模块枚举文件到项目结构

### Changed
- **架构升级**：适配器模式 + Mock 路由拦截层 → 接口契约的策略工厂模式，Mock 逻辑从适配器层移入 `MockXxxApi` 类
- **无缝切换**：通过 `.env` 中 `VITE_MOCK=true/false` 控制，工厂函数自动选择策略，业务代码零修改
- 重写 `skills/api-typescript-spec/SKILL.md`：完整策略工厂模式规范，包含设计模式说明、枚举规范、认证模块示例
- 更新 `agents/frontend-developer.md`：规则2 新增 TypeScript 强制和枚举规范，规则9 从"API-Mock 一一对应"改为"API 策略工厂架构"
- 更新 `rules/skills-checklist.md`：API-Mock 章节改为"API 策略工厂架构"，新增接口契约、策略实现、工厂函数、枚举规范等要点
- 更新 `rules/spec-template.md`：API 接口规范章节改为策略工厂模式描述
- 更新 `rules/project-spec-template.md`：API 规范章节改为策略工厂模式，目录结构移除 `mock/types.ts` 和 `mock/handler.ts`

### Removed
- 移除 `mock/types.ts` 和 `mock/handler.ts`（Mock 路由拦截层不再需要，Mock 逻辑内聚到各 `MockXxxApi` 类）

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
