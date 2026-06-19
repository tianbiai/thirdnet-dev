---
title: Single-File Component Structure, Styling, and Template Patterns
impact: MEDIUM
impactDescription: Consistent SFC structure and styling choices improve maintainability, tooling support, and render performance
type: best-practice
tags: [vue3, sfc, scoped-css, styles, build-tools, performance, template, v-html, v-for, computed, v-if, v-show]
---

# Single-File Component Structure, Styling, and Template Patterns

**Impact: MEDIUM** - Using SFCs with consistent structure and performant styling keeps components easier to maintain and avoids unnecessary render overhead.

## Task List

- Use `.vue` SFCs instead of separate `.js`/`.ts` and `.css` files for components
- Colocate template, script, and styles in the same SFC by default
- Use PascalCase for component names in templates and filenames
- Prefer component-scoped styles
- Prefer class selectors (not element selectors) in scoped CSS for performance
- Access DOM / component refs with `useTemplateRef()` in Vue 3.5+
- Use camelCase keys in `:style` bindings for consistency and IDE support
- Use `v-for` and `v-if` correctly
- Never use `v-html` with untrusted/user-provided content
- Choose `v-if` vs `v-show` based on toggle frequency and initial render cost

## Colocate template, script, and styles

**BAD:**
```
components/
├── UserCard.vue
├── UserCard.js
└── UserCard.css
```

**GOOD:**
```vue
<!-- components/UserCard.vue -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  user: { type: Object, required: true }
})

const displayName = computed(() =>
  `${props.user.firstName} ${props.user.lastName}`
)
</script>

<template>
  <div class="user-card">
    <h3 class="name">{{ displayName }}</h3>
  </div>
</template>

<style scoped>
.user-card {
  padding: 1rem;
}

.name {
  margin: 0;
}
</style>
```

## Use PascalCase for component names

**BAD:**
```vue
<script setup>
import userProfile from './user-profile.vue'
</script>

<template>
  <user-profile :user="currentUser" />
</template>
```

**GOOD:**
```vue
<script setup>
import UserProfile from './UserProfile.vue'
</script>

<template>
  <UserProfile :user="currentUser" />
</template>
```

## Best practices for `<style>` block in SFCs

### Prefer component-scoped styles

- Use `<style scoped>` for styles that belong to a component.
- Keep **global CSS** in a dedicated file (e.g. `src/assets/main.css`) for resets, typography, tokens, etc.
- Use `:deep()` sparingly (edge cases only).

**BAD:**

```vue
<style>
/* ❌ leaks everywhere */
button { border-radius: 999px; }
</style>
```

**GOOD:**

```vue
<style scoped>
.button { border-radius: 999px; }
</style>
```

**GOOD:**

```css
/* src/assets/main.css */
/* ✅ resets, tokens, typography, app-wide rules */
:root { --radius: 999px; }
```

### Use class selectors in scoped CSS

**BAD:**
```vue
<template>
  <article>
    <h1>{{ title }}</h1>
    <p>{{ subtitle }}</p>
  </article>
</template>

<style scoped>
article { max-width: 800px; }
h1 { font-size: 2rem; }
p { line-height: 1.6; }
</style>
```

**GOOD:**
```vue
<template>
  <article class="article">
    <h1 class="article-title">{{ title }}</h1>
    <p class="article-subtitle">{{ subtitle }}</p>
  </article>
</template>

<style scoped>
.article { max-width: 800px; }
.article-title { font-size: 2rem; }
.article-subtitle { line-height: 1.6; }
</style>
```

## Access DOM / component refs with `useTemplateRef()`

For Vue 3.5+: use `useTemplateRef()` to access template refs.

```vue
<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

const inputRef = useTemplateRef<HTMLInputElement>('input')

onMounted(() => {
  inputRef.value?.focus()
})
</script>

<template>
  <input ref="input" />
</template>
```

## Use camelCase in `:style` bindings

**BAD:**
```vue
<template>
  <div :style="{ 'font-size': fontSize + 'px', 'background-color': bg }">
    Content
  </div>
</template>
```

**GOOD:**
```vue
<template>
  <div :style="{ fontSize: fontSize + 'px', backgroundColor: bg }">
    Content
  </div>
</template>
```

## Use `v-for` and `v-if` correctly

### Always provide a stable `:key`

- Prefer primitive keys (`string | number`).
- Avoid using objects as keys.

**GOOD:**

```vue
<li v-for="item in items" :key="item.id">
  <input v-model="item.text" />
</li>
```

### Avoid `v-if` and `v-for` on the same element

It leads to unclear intent and unnecessary work.
([Reference](https://vuejs.org/guide/essentials/list.html#v-for-with-v-if))

**To filter items**
**BAD:**

```vue
<li v-for="user in users" v-if="user.active" :key="user.id">
  {{ user.name }}
</li>
```

**GOOD:**

```vue
<script setup lang="ts">
import { computed } from 'vue'

const activeUsers = computed(() => users.value.filter(u => u.active))
</script>

<template>
  <li v-for="user in activeUsers" :key="user.id">
    {{ user.name }}
  </li>
</template>
```

**To conditionally show/hide the entire list**
**GOOD:**

```vue
<ul v-if="shouldShowUsers">
  <li v-for="user in users" :key="user.id">
    {{ user.name }}
  </li>
</ul>
```

## Never render untrusted HTML with `v-html`

**BAD:**
```vue
<template>
  <!-- DANGEROUS: untrusted input can inject scripts -->
  <article v-html="userProvidedContent"></article>
</template>
```

**GOOD:**
```vue
<script setup>
import { computed } from 'vue'
import DOMPurify from 'dompurify'

const props = defineProps<{
  trustedHtml?: string
  plainText: string
}>()

const safeHtml = computed(() => DOMPurify.sanitize(props.trustedHtml ?? ''))
</script>

<template>
  <!-- Preferred: escaped interpolation -->
  <p>{{ props.plainText }}</p>

  <!-- Only for trusted/sanitized HTML -->
  <article v-html="safeHtml"></article>
</template>
```

## Choose `v-if` vs `v-show` by toggle behavior

**BAD:**
```vue
<template>
  <!-- Frequent toggles with v-if cause repeated mount/unmount -->
  <ComplexPanel v-if="isPanelOpen" />

  <!-- Rarely shown content with v-show pays initial render cost -->
  <AdminPanel v-show="isAdmin" />
</template>
```

**GOOD:**
```vue
<template>
  <!-- Frequent toggles: keep in DOM, toggle display -->
  <ComplexPanel v-show="isPanelOpen" />

  <!-- Rare condition: lazy render only when true -->
  <AdminPanel v-if="isAdmin" />
</template>
```

## SFC 行数上限与大型组件拆分

> 本节定义 `.vue` 文件的强制行数上限、诊断方法和四步拆分法。任何 SFC 触发拆分时都必须遵守。

### 强制行数上限

| 指标 | 警告值 | 必须重构 |
|------|--------|----------|
| 单个 `.vue` 文件总行数 | > 200 行 | > **300 行** |
| `<script setup>` 行数 | > 100 行 | > **200 行** |
| `<template>` 行数 | > 80 行 | > **150 行** |
| `<style scoped>` 行数 | > 60 行 | > **100 行** |

当任何指标达到"必须重构"列时，禁止继续在该文件中添加新功能，必须先完成拆分。

### 诊断 — 为什么文件这么大？

动手拆分前先判断根因：上帝组件（数据+状态+逻辑+UI 混在一起）、重复模板块（应用子组件或 `v-for`）、内联样式膨胀（应提取设计令牌/全局样式）、混合关注点（筛选+排序+分页+表单+弹窗同处一组件）。

### 四步拆分法

1. **状态和副作用 → Composable**：每个独立关注点提取为 `useXxx()`，父组件变成"薄组合层"，只做导入与接线。

   ```vue
   <script setup lang="ts">
   import { useItemList } from './composables/useItemList'
   import { useSearchFilter } from './composables/useSearchFilter'
   import { usePagination } from './composables/usePagination'
   import { useSelection } from './composables/useSelection'
   import { useDetailModal } from './composables/useDetailModal'

   const { items, loading } = useItemList()
   const { searchQuery, statusFilter, filteredItems } = useSearchFilter(items)
   const { currentPage, paginatedItems, totalPages, goToPage } = usePagination(filteredItems)
   const { selectedIds, toggleSelect, bulkDelete } = useSelection()
   const { showDetail, detailItem, openDetail, closeDetail } = useDetailModal()
   </script>
   ```

2. **UI 区域 → 子组件**：模板拆为专注子组件，props in / events out（SearchBar、FilterPanel、DataTable、PaginationBar、DetailModal 等）。

3. **跨组件状态 → Pinia Store**：状态被多个非父子组件共享时，移入 Pinia store。

4. **CSS 精简**：`<style scoped>` 超 100 行时，公共样式→全局 CSS、复杂样式→独立 `.css`（`<style scoped src="./X.css">`）、优先通过拆分子组件自然分散样式。

### feature folder 目录结构

任何需要 2+ 组件的功能使用 feature folder 布局：

```
src/
├── components/
│   └── item-list/                  # 功能目录
│       ├── ItemListPage.vue        # 薄组合层（≤150行）
│       ├── ItemListSearch.vue      # 搜索 UI
│       ├── ItemListTable.vue       # 数据表格 UI
│       ├── ItemListPagination.vue  # 分页 UI
│       ├── ItemListDetail.vue      # 详情弹窗
│       └── composables/
│           ├── useItemList.ts      # 数据获取
│           ├── useSearchFilter.ts  # 搜索筛选
│           ├── usePagination.ts    # 分页逻辑
│           └── useSelection.ts     # 选择逻辑
├── composables/                    # 跨功能共享 composables
├── stores/                         # Pinia stores
├── styles/                         # 全局样式、设计令牌
└── utils/                          # 纯工具函数（无响应式状态）
```

### 常见反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| 只搬模板不搬逻辑 | 父组件仍然是巨型 script | 搬模板的同时把对应逻辑也移入 composable 或子组件 |
| 把纯函数包装成 composable | 无响应式状态、无生命周期钩子 | 纯函数放在 `utils/` 目录，不要伪装成 composable |
| 过度拆分小组件 | 20 行的组件没必要再拆 | 只在达到阈值时拆分 |
| 拆分后 props 层层传递 | props 穿透 3+ 层 | 改用 provide/inject 或 Pinia store |

### 拆分检查清单

- [ ] 没有任何 `.vue` 文件超过 300 行
- [ ] 没有 `<script setup>` 超过 200 行
- [ ] 没有 `<style scoped>` 超过 100 行
- [ ] 每个组件职责可以用一句话描述
- [ ] 父组件是薄组合层（仅导入和接线，无业务逻辑）
- [ ] composable 有明确单一职责（数据获取 / 筛选 / 分页 / ...）
- [ ] 跨组件共享状态已移入 Pinia store

