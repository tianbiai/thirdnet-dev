# 前端技能文档清单

> 本文档列出 `skills/` 目录下所有可用的前端技能及其适用场景。

## 技能速查表

| 技能 | 优先级 | 触发场景 |
|------|--------|----------|
| `vue-best-practices` | ⭐⭐⭐ | 所有 Vue 开发工作（必读） |
| `/frontend-design` | ⭐⭐ | UI/界面设计、视觉效果优化（全局技能） |
| `/ui-ux-pro-max` | 全局 | 页面视觉优化（命令调用） |
| `vue-pinia-best-practices` | ⭐ | 使用 Pinia 状态管理 |
| `vue-router-best-practices` | ⭐ | 使用 Vue Router |
| `create-adaptable-composable` | ⭐ | 创建可复用 Composable |
| `vue-jsx-best-practices` | ⭐ | 使用 JSX 语法 |
| `vue-options-api-best-practices` | ⭐ | 使用 Options API |

---

## 核心技能

### vue-best-practices ⭐⭐⭐

Vue 3 核心最佳实践，**所有 Vue 开发工作必读**。推荐 Composition API + `<script setup lang="ts">` 作为标准方案。涵盖：响应式系统、组件设计（Props/Emits/Slots）、模板语法、生命周期、过渡动画、TypeScript 集成、性能优化等。包含 90+ 篇参考文档，按需加载。

**核心原则**：状态可预测（单一数据源）、数据流显式（Props down/Events up）、组件小型化、避免不必要重渲染。

### /frontend-design ⭐⭐（全局技能）

前端界面设计技能，通过 `/frontend-design` 命令调用。提供设计思维和前端美学指南，涵盖字体选择（避免 Inter/Roboto/Arial）、配色方案（CSS 变量，避免紫色渐变）、布局创新（非对称、重叠、网格打破）、视觉细节（渐变、纹理、阴影）和动效设计（CSS 优先）。

**何时使用**：任何涉及 UI 视觉设计的场景，包括新页面设计、样式优化、主题定制。

### /ui-ux-pro-max（全局技能）

UI/UX 专业优化技能，通过 `/ui-ux-pro-max` 命令调用。提供页面视觉深度优化、用户体验提升、交互设计增强，涵盖色彩搭配、间距布局、动效细节、交互流畅度和专业感提升。

**何时使用**：需要对现有页面进行视觉效果和用户体验的深度优化时。

---

## 状态管理与路由

### vue-pinia-best-practices

Pinia 状态管理最佳实践。涵盖 Store 定义（Setup Store / Option Store）、状态管理模式、跨组件状态共享、Store 间的组合与交互、响应式原理与性能考量。

**何时使用**：涉及全局状态管理、跨组件数据共享、复杂状态逻辑时参考。

### vue-router-best-practices

Vue Router 4 使用指南。涵盖路由配置、导航守卫（beforeEach/afterEach）、路由参数传递、动态路由、路由组件生命周期交互（onBeforeRouteLeave/onBeforeRouteUpdate）、懒加载策略。

**何时使用**：涉及路由配置、页面导航控制、权限拦截时参考。

---

## Composable 开发

### create-adaptable-composable

创建可复用 Composable 的指南。核心是让 Composable 接受 MaybeRef/MaybeRefOrGetter 类型的输入，使调用者可以传入普通值、ref 或 getter。内部通过 `toValue()`/`toRef()` 规范化输入，确保在响应式副作用（watch/watchEffect）中行为可预测。

**何时使用**：需要创建可复用的、接受灵活输入类型的 Composable 时参考。

---

## 其他技能

### vue-jsx-best-practices

Vue 中使用 JSX 语法的指南。涵盖 JSX 与模板的差异（class vs className）、JSX 插件配置（@vitejs/plugin-vue-jsx）、类型声明和最佳实践。

**何时使用**：项目明确使用 JSX 语法时参考。

### vue-options-api-best-practices

Vue 3 Options API 风格指南。涵盖 data()、methods、computed、watch、this 上下文等 Options API 特有的用法。所有参考文档仅展示 Options API 方案。

**何时使用**：项目明确使用 Options API（非 Composition API）时参考。

---

## 组件拆分与重构

> **任何 `.vue` 文件超过 300 行必须重构。**

详见 [sfc-large-component-refactoring.md](./sfc-large-component-refactoring.md)

---

## API-Mock 一一对应架构

> **所有 API 模块与 Mock 数据文件必须一一对应。**

详见 Agent 规则10（API-Mock 一一对应架构）和规则11（演示模式与帮助气泡控制）

| 架构要点 | 说明 |
|----------|------|
| 文件对应 | `api/modules/*.js` ←→ `mock/data/*.js`，文件名完全一致 |
| 方法对应 | API 方法通过 `request()` 发请求，Mock 路由按 URL+Method 匹配 |
| 切换控制 | `MOCK_ENABLED` 单一开关，业务代码零修改 |
| 帮助气泡 | `v-if="isMockEnabled"` 控制，生产模式 DOM 完全移除 |
