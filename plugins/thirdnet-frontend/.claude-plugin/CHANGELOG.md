# Changelog

## 0.19.0 - 2026-04-28

### Changed
- 删除 `agents/frontend-developer.md` 和 `commands/thirdnet-frontend.md`，统一为单工作流技能模型
- 将 Agent 行为规则、强制技能调用、需求澄清流程、技能路由表合并到 `frontend-workflow` 技能
- 新增 `frontend-design` 技能（前端创意设计规范），从全局技能迁移为插件本地技能
- 更新 hooks.json，在 PreToolUse 中增加 `frontend-design` 技能合规检查

## 0.18.0 - 2026-04-28

### Changed
- 双端插件新增「新建项目初始化流程」，强制第一步创建 `frontend/` 目录
- 双端插件合并执行模式，统一为单工作流，强制需求澄清

## 0.17.0 - 2026-04-27

### Changed
- 重构双端插件技能体系，新增 workflow 技能并精简冗余内容
- 将「项目级spec」统一改为「子项目级spec」，每个子项目对应一个 spec
- 强化双端 Agent 需求澄清规则，强制使用 AskUserQuestion 工具

## 0.16.0 - 2026-04-27

### Changed
- 移除 Agent 中 brainstorming 残留引用（"跳过头脑风暴" → "跳过需求澄清"）
- 修正命令"必调技能清单"中 doc-templates 描述与阶段二不一致的问题
- PreToolUse Hook 匹配器从 `Write` 扩展为 `Write|Edit`，堵住 Edit 绕过技能合规检查的漏洞
- Command allowed-tools 补齐 TodoWrite 和 WebSearch，与 Agent 工具声明一致

## 0.12.0 - 2026-04-26

### Changed
- 将插件描述和 Agent/Command 中所有技能路径引用（如 `skills/vue-best-practices/`）改为技能名称（如 `vue-best-practices`），子代理无法访问技能目录路径
- 将 `rules/guidelines.md` 的开发准则内容直接合并到 Agent 系统提示中，子代理和插件不会加载 rules 文件夹
- 修改前端项目目录结构：从 `frontend/{项目名}/` 改为 `frontend/{子系统名}/`（如 `frontend/web`、`frontend/minigram`），根目录即为项目总文件夹
- 更新 hooks.json 中的目录引用和模板路径，移除 rules 文件夹路径引用

### Removed
- 删除 `rules/` 文件夹（插件和子代理不会加载 rules 内容，已合并到 Agent 系统提示中）

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
