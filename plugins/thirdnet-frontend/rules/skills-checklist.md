# 前端技能文档清单

本文档列出了 `skills/` 目录下所有可用的前端技能。

---

## 🎨 前端技能

### Vue 核心（必须阅读）

- `vue-best-practices` ⭐⭐⭐
  - Vue 3 核心最佳实践
  - 涵盖：响应式、组件、Props/Emits、模板、生命周期、插槽、过渡、TypeScript、性能等
  - **适用场景**: 所有 Vue 开发工作

### 状态管理与路由（按需阅读）

- `vue-pinia-best-practices`
  - Pinia 状态管理最佳实践
  - **适用场景**: 使用 Pinia 状态管理时必读

- `vue-router-best-practices`
  - Vue Router 使用指南
  - **适用场景**: 使用 Vue Router 时必读

### Composable 开发（按需阅读）

- `create-adaptable-composable`
  - 创建可复用 Composable 的指南
  - 涵盖：MaybeRef / MaybeRefOrGetter 类型、toValue()/toRef() 规范化
  - **适用场景**: 创建可复用 Composable 时必读

### 界面设计与样式（按需阅读）

- `frontend-design` ⭐⭐
  - 前端界面设计规范
  - 涵盖：设计思维、前端美学指南（字体、色彩、动效、空间布局、视觉细节）
  - **核心原则**：
    - 选择独特、美观、有趣的字体组合，避免 Inter、Roboto、Arial 等通用字体
    - 承诺使用一致的配色方案（使用 CSS 变量），避免陈词滥调的紫色渐变
    - 创造意想不到的布局（非对称、重叠、对角线流动、网格破坏）
    - 添加背景和视觉细节（渐变网格、噪点纹理、几何图案、阴影、边框等）
    - 使用动画效果和微交互（CSS 优先）
  - **适用场景**: 任何 UI/界面设计工作，创建独特、高质量的视觉界面

- `ui-ux-pro-max` ⭐⭐（全局技能）
  - UI/UX 专业优化技能
  - 涵盖：页面视觉优化、用户体验提升、交互设计增强
  - **核心功能**：
    - 对现有页面进行视觉效果的深度优化
    - 提升用户体验和交互流畅度
    - 优化色彩搭配、间距布局、动效细节
    - 增强页面的专业感和精致度
  - **适用场景**: 设计或开发过程中，需要提升页面视觉效果和用户体验时
  - **使用方式**: 通过 `/ui-ux-pro-max` 命令调用

### 其他（按需阅读）

- `vue-jsx-best-practices`
  - JSX 语法最佳实践
  - **适用场景**: 使用 JSX 语法时必读

- `vue-options-api-best-practices`
  - Options API 最佳实践
  - **适用场景**: 项目明确使用 Options API 时必读

---

## 📋 技能使用流程

### Vue 前端开发

```
1. vue-best-practices          → 核心最佳实践（必读）
2. vue-pinia-best-practices    → 状态管理（按需）
3. vue-router-best-practices   → 路由配置（按需）
4. frontend-design             → 界面设计（设计前必读）
5. create-adaptable-composable → 创建可复用 Composable（按需）
6. vue-jsx-best-practices      → JSX 语法（按需）
7. /ui-ux-pro-max              → 页面视觉优化（全局技能，设计或开发过程中按需使用）
```
