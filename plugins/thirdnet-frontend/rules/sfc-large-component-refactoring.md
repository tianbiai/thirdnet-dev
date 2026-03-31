# Vue 大文件重构规则

> 本规则定义 Vue 单文件组件（SFC）的行数上限、诊断方法和拆分策略。所有前端开发必须遵守。

---

## 一、强制行数上限

| 指标 | 警告值 | 必须重构 |
|------|--------|----------|
| 单个 `.vue` 文件总行数 | > 200 行 | > **300 行** |
| `<script setup>` 行数 | > 100 行 | > **200 行** |
| `<template>` 行数 | > 80 行 | > **150 行** |
| `<style scoped>` 行数 | > 60 行 | > **100 行** |

**规则**：当任何指标达到"必须重构"列时，禁止继续在该文件中添加新功能，必须先完成拆分。

---

## 二、诊断 — 为什么文件这么大？

在动手拆分之前，先判断根因：

| 根因 | 特征 |
|------|------|
| **上帝组件** | 同时处理数据获取、状态管理、业务逻辑、UI 展示 |
| **重复模板块** | 类似的 HTML 结构反复出现，应该用子组件或 `v-for` |
| **内联样式膨胀** | `<style>` 块巨大，本应是公共样式或设计令牌 |
| **混合关注点** | 一个组件同时做筛选、排序、分页、表单处理、弹窗控制等 |

---

## 三、四步拆分法

### 第一步：状态和副作用 → Composable

把每个独立的关注点提取为 `useXxx()` composable。

**拆分前（单个巨型 script）：**
```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// 关注点1：数据获取
const items = ref([])
const loading = ref(false)
async function fetchItems() { /* ... */ }
onMounted(fetchItems)

// 关注点2：搜索筛选
const searchQuery = ref('')
const statusFilter = ref('all')
const filteredItems = computed(() => /* ... */)

// 关注点3：分页
const currentPage = ref(1)
const pageSize = ref(10)
const paginatedItems = computed(() => /* ... */)
const totalPages = computed(() => /* ... */)

// 关注点4：选择与操作
const selectedIds = ref<Set<number>>(new Set())
function toggleSelect(id: number) { /* ... */ }
function bulkDelete() { /* ... */ }

// 关注点5：详情弹窗
const showDetail = ref(false)
const detailItem = ref(null)
function openDetail(item) { /* ... */ }
</script>
```

**拆分后（薄组合层）：**
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

### 第二步：UI 区域 → 子组件

将模板拆分为专注的子组件，每个子组件通过 props 接收数据、通过 events 通信。

**拆分前（单个巨型模板）：**
```vue
<template>
  <div class="page">
    <!-- 搜索栏：30行 -->
    <div class="search-bar">...</div>
    <!-- 筛选面板：40行 -->
    <div class="filter-panel">...</div>
    <!-- 数据表格：80行 -->
    <table>...</table>
    <!-- 分页：20行 -->
    <div class="pagination">...</div>
    <!-- 详情弹窗：60行 -->
    <div class="modal" v-if="showDetail">...</div>
  </div>
</template>
```

**拆分后（专注子组件）：**
```vue
<template>
  <div class="page">
    <SearchBar v-model:query="searchQuery" />
    <FilterPanel v-model:status="statusFilter" />
    <DataTable
      :items="paginatedItems"
      :loading="loading"
      :selected-ids="selectedIds"
      @toggle-select="toggleSelect"
      @row-click="openDetail"
    />
    <PaginationBar
      :current-page="currentPage"
      :total-pages="totalPages"
      @go-to-page="goToPage"
    />
    <DetailModal
      v-model:visible="showDetail"
      :item="detailItem"
      @close="closeDetail"
    />
  </div>
</template>
```

### 第三步：跨组件状态 → Pinia Store

当状态需要被多个非父子关系的组件共享时，移到 Pinia store。

```typescript
// stores/useItemStore.ts
import { defineStore } from 'pinia'

export const useItemStore = defineStore('items', () => {
  const items = ref([])
  const loading = ref(false)

  async function fetchItems() { /* ... */ }
  async function deleteItems(ids: number[]) { /* ... */ }

  return { items, loading, fetchItems, deleteItems }
})
```

### 第四步：CSS 精简

当 `<style scoped>` 超过 100 行时：

1. **公共样式 → 全局 CSS**（设计令牌、布局工具类、排版）
   ```css
   /* src/styles/variables.css */
   :root { --primary: #409eff; --radius: 4px; }
   ```
2. **组件复杂样式 → 独立 CSS 文件**（仅在超过 100 行时）
   ```vue
   <!-- 用 src 属性引用外部 CSS -->
   <style scoped src="./ItemListTable.css"></style>
   ```
3. **拆分子组件时 CSS 自然分散** — 优先通过拆分子组件来分布样式，而非提取 CSS 文件

---

## 四、推荐目录结构

任何需要 2+ 组件的功能，使用 feature folder 布局：

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
│   ├── variables.css
│   └── utilities.css
└── utils/                          # 纯工具函数（无响应式状态）
```

---

## 五、常见反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| 只搬模板不搬逻辑 | 父组件仍然是巨型 script | 搬模板的同时把对应逻辑也移入 composable 或子组件 |
| 把纯函数包装成 composable | 无响应式状态、无生命周期钩子 | 纯函数放在 `utils/` 目录，不要伪装成 composable |
| 过度拆分小组件 | 20 行的组件没必要再拆 | 只在达到阈值时拆分 |
| 拆分后 props 层层传递 | props 穿透 3+ 层 | 改用 provide/inject 或 Pinia store |

---

## 六、检查清单

完成重构后逐项确认：

- [ ] 没有任何 `.vue` 文件超过 300 行
- [ ] 没有 `<script setup>` 超过 200 行
- [ ] 没有 `<style scoped>` 超过 100 行
- [ ] 每个组件职责可以用一句话描述
- [ ] 父组件是薄组合层（仅导入和接线，无业务逻辑）
- [ ] composable 有明确单一职责（数据获取 / 筛选 / 分页 / ...）
- [ ] 跨组件共享状态已移入 Pinia store
