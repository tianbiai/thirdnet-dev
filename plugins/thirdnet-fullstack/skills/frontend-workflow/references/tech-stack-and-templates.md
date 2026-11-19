# 技术栈与模板索引（tech-stack-and-templates）

> 本文件是 `frontend-workflow` 技能的技术栈版本矩阵与文档模板索引参考：选型/查版本/找模板时用 Read 打开。强制规则（uniapp 锁定、TypeScript 强制）以 SKILL.md 为准。

## 技术栈

**版本原则**：使用稳定生产版本（非 RC/beta/alpha），优先 LTS。

| 端                         | 技术栈                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| **移动端 / 微信小程序（强制 uniapp）** | Vue 3.4.x、Vite 5.x、Pinia 2.x、Vant 4.x（**仅 H5**）+ @vant/weapp（**仅 mp-weixin**，easycom）；请求双端统一走 `adapter.uni.ts` 的 `uni.request` |
| **Web 端**           | Vue 3.5.x、Vite 8.x、Element Plus 2.x、Vue Router 4.x、Pinia 3.x、Axios 1.x |

- **Pinia 版本选择**：Vue 3.5+ / Vite 8+ 项目使用 Pinia 3.x（以 npm 最新稳定版为准）；Vue 3.4 / uniapp 项目使用 Pinia 2.x
- **TypeScript 强制**：所有代码 `.ts` 扩展名，Vue 组件 `<script setup lang="ts">`，禁止 `.js`
- **枚举规范**：→ 枚举/字典规范见 `api-typescript-spec`（约定 #7：纯前端常量才用 TS enum）与 `vue-enum-dict`（int/string 字典字段用法）
- **移动端**：**微信小程序一律 uniapp，禁止原生小程序 / Taro / mpvue**；开发用 H5 模式，最终发布微信小程序（`mp-weixin`），代码须兼容 H5 + 小程序
- **组件双端策略（uniapp 工程）**：跨端 UI 优先用 uni 内置组件（`uni.xxx` / `view`/`text` 等）；H5 专属增强用 Vant 4 并以 `#ifdef H5` 条件编译；微信小程序专属增强用 `@vant/weapp`（easycom 引入）并以 `#ifdef MP-WEIXIN` 条件编译——**Vant 4 依赖 DOM、无法编译进小程序**，禁止双端共用同一套 Vant 组件
- **API 模块**：接口契约策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`，`VITE_MOCK_ENABLED` 切换；完整规范见 `api-typescript-spec`）

## 模板文件索引

根据当前任务选择对应模板：

| 场景                 | 模板文件                                                                      | 说明                           |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------ |
| 创建子项目规格       | [project-spec-template](project-spec-template.md)                     | 子项目级功能说明书             |
| 创建页面规格         | [page-spec-template](page-spec-template.md)                           | 页面级规格（与 .vue 一一对应） |
| 创建变更日志         | [changelog-template](changelog-template.md)                           | 版本历史 + 页面变更记录        |
| 创建 Markdown 查看器 | [markdown-viewer](markdown-viewer.md)                                 | 通用 HTML 页面                 |
| 配置 marked.js       | [marked-js-setup](marked-js-setup.md)                                 | marked.min.js 获取方式         |
| SFC 组件重构         | [sfc-large-component-refactoring](sfc-large-component-refactoring.md) | .vue 行数限制与四步拆分法      |
