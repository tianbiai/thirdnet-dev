---
name: vue-router-best-practices
description: "Vue Router 4 patterns, navigation guards, route params, and route-component lifecycle interactions. Only for web SPA projects (frontend/web etc. with src/router/); uniapp mini-program projects (frontend/minigram) must NOT use vue-router — routing is declared in pages.json with uni.navigateTo/uni.reLaunch APIs."
version: 1.0.1
license: MIT
author: github.com/vuejs-ai
---

> **适用范围（thirdnet 插件约定）**：本技能仅适用于 **Web 工程**（`frontend/web/` 等 Element Plus / Vue Router 项目）。**uniapp 小程序工程（`frontend/minigram/`）禁止使用 vue-router**——路由由根目录 `pages.json` 声明，跳转用 `uni.navigateTo` / `uni.redirectTo` / `uni.reLaunch`。若当前工程没有 `src/router/` 目录，本技能不适用，直接跳过。

Vue Router best practices, common gotchas, and navigation patterns.

### Navigation Guards
- Navigating between same route with different params → See [router-beforeenter-no-param-trigger](references/router-beforeenter-no-param-trigger.md)
- Accessing component instance in beforeRouteEnter guard → See [router-beforerouteenter-no-this](references/router-beforerouteenter-no-this.md)
- Navigation guard making API calls without awaiting → See [router-guard-async-await-pattern](references/router-guard-async-await-pattern.md)
- Users trapped in infinite redirect loops → See [router-navigation-guard-infinite-loop](references/router-navigation-guard-infinite-loop.md)
- Navigation guard using deprecated next() function → See [router-navigation-guard-next-deprecated](references/router-navigation-guard-next-deprecated.md)

### Route Lifecycle
- Stale data when navigating between same route → See [router-param-change-no-lifecycle](references/router-param-change-no-lifecycle.md)
- Event listeners persisting after component unmounts → See [router-simple-routing-cleanup](references/router-simple-routing-cleanup.md)

### Setup
- Building production single-page application → See [router-use-vue-router-for-production](references/router-use-vue-router-for-production.md)
