# 前端技能文档清单

> 本文档列出 `skills/` 目录下所有可用的前端技能及其适用场景。

---

## 技能速查表

| 技能 | 优先级 | 触发场景 |
|------|--------|----------|
| `vue-best-practices` | ⭐⭐⭐ | 所有 Vue 开发工作 |
| `/frontend-design` | ⭐⭐ | UI/界面设计、视觉效果优化（全局技能） |
| `vue-pinia-best-practices` | ⭐ | 使用 Pinia 状态管理 |
| `vue-router-best-practices` | ⭐ | 使用 Vue Router |
| `create-adaptable-composable` | ⭐ | 创建可复用 Composable |
| `vue-jsx-best-practices` | ⭐ | 使用 JSX 语法 |
| `vue-options-api-best-practices` | ⭐ | 使用 Options API |
| `/ui-ux-pro-max` | 全局 | 页面视觉优化（命令调用） |

---

## 核心技能

### vue-best-practices ⭐⭐⭐

Vue 3 核心最佳实践，涵盖：响应式、组件、Props/Emits、模板、生命周期、插槽、过渡、TypeScript、性能等。

**何时使用**：所有 Vue 开发工作（必读）

### /frontend-design ⭐⭐（全局技能）

全局安装的前端界面设计技能，通过 `/frontend-design` 命令调用。涵盖：设计思维、前端美学指南（字体、色彩、动效、空间布局、视觉细节）。

**核心原则**：
- 选择独特字体，避免 Inter、Roboto、Arial
- 使用一致的配色方案，避免紫色渐变
- 创造意想不到的布局
- 添加背景和视觉细节

**何时使用**：任何 UI/界面设计工作

**调用方式**：`/frontend-design`

---

## 状态管理与路由

### vue-pinia-best-practices

Pinia 状态管理最佳实践。

**何时使用**：使用 Pinia 状态管理时必读

### vue-router-best-practices

Vue Router 使用指南。

**何时使用**：使用 Vue Router 时必读

---

## Composable 开发

### create-adaptable-composable

创建可复用 Composable 的指南，涵盖 MaybeRef/MaybeRefOrGetter 类型、toValue()/toRef() 规范化。

**何时使用**：创建可复用 Composable 时必读

---

## 界面设计与样式

### /ui-ux-pro-max（全局技能）

UI/UX 专业优化技能，涵盖页面视觉优化、用户体验提升、交互设计增强。

**核心功能**：
- 对现有页面进行视觉效果深度优化
- 提升用户体验和交互流畅度
- 优化色彩搭配、间距布局、动效细节

**何时使用**：需要提升页面视觉效果时

**调用方式**：`/ui-ux-pro-max`

---

## 其他技能

| 技能 | 触发场景 |
|------|----------|
| `vue-jsx-best-practices` | 使用 JSX 语法时 |
| `vue-options-api-best-practices` | 项目明确使用 Options API 时 |

---

## 开发流程

```
1. vue-best-practices          → 核心最佳实践（必读）
2. vue-pinia-best-practices    → 状态管理（按需）
3. vue-router-best-practices   → 路由配置（按需）
4. /frontend-design            → 界面设计（设计前必读，全局技能）
5. create-adaptable-composable → 创建可复用 Composable（按需）
6. /ui-ux-pro-max              → 页面视觉优化（按需）
```

---

## 组件拆分与重构

> ⚠️ **任何 `.vue` 文件超过 300 行必须重构，禁止继续添加功能。**

详见 [sfc-large-component-refactoring.md](./sfc-large-component-refactoring.md)，核心规则：

| 指标 | 必须重构 |
|------|----------|
| `.vue` 文件总行数 | > 300 行 |
| `<script setup>` | > 200 行 |
| `<template>` | > 150 行 |
| `<style scoped>` | > 100 行 |

**四步拆分法**：
1. 状态和副作用 → Composable
2. UI 区域 → 子组件
3. 跨组件状态 → Pinia Store
4. CSS 精简 → 全局样式 / 外部文件
