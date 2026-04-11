# Changelog

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
