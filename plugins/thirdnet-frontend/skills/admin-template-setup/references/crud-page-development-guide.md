# Admin 模板 CRUD 页面开发指南

本指南描述在 Admin 管理后台模板中开发新 CRUD 页面的标准模式和代码模板。
所有新的管理页面**必须遵循此指南**，复用模板内置的 Composable 和组件，禁止重复造轮子。

**标准参考实现**：`src/views/api/blacklist/index.vue` — 展示了 useCrudTable + PaginationBar + useDialogFocus + validators + confirmAction 的完整组合。开发新页面时，参考此文件的代码结构。

---

## 页面布局结构

每个 CRUD 页面遵循统一的 HTML 结构，使用 `src/styles/` 中定义的布局类：

```vue
<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">页面标题</h2>
      <HelpBubble :content="helpContent" />
    </div>
    <div class="search-bar">
      <!-- el-form inline 搜索表单 -->
    </div>
    <div class="toolbar">
      <!-- v-permission 操作按钮 -->
    </div>
    <el-table v-loading="loading" :data="tableData" border stripe>
      <!-- 表格列 -->
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <!-- 操作按钮 -->
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无数据" :image-size="80" />
      </template>
    </el-table>
    <PaginationBar
      :pagination="pagination"
      :on-current-change="handleCurrentChange"
      :on-size-change="handleSizeChange"
    />
    <!-- el-dialog 编辑弹窗 -->
  </div>
</template>
```

布局类说明：
- `.page-container` — 白色圆角卡片容器，带边框和阴影
- `.page-header` — flex 行，标题左对齐、帮助气泡右对齐
- `.page-title` — 18px 加粗标题
- `.search-bar` — 搜索区域，底部 8px 间距
- `.toolbar` — 操作按钮区域，底部 8px 间距
- `.pagination-bar` — 分页栏，右对齐，顶部 8px 间距

---

## 核心 Composable

### useCrudTable（`src/composables/useCrudTable.ts`）

CRUD 列表页核心 Composable，组合 `usePagination` + `useActionLoading`，消除手写分页/搜索/删除样板。在 12+ 视图中使用。

**配置项（UseCrudTableOptions\<T, Q\>）**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `fetch` | `(params: PaginationParams & Q) => Promise<{ list: T[]; total: number }>` | 列表查询 API |
| `defaultQuery` | `Q` | 搜索参数默认值（用于 reset） |
| `pageSize?` | `number` | 默认每页大小（默认 20） |
| `transform?` | `(list: T[]) => T[] \| Promise<T[]>` | 拉取后的数据转换钩子 |
| `autoLoad?` | `boolean` | 是否在 onMounted 自动加载（默认 true） |
| `searchDebounceMs?` | `number` | 搜索防抖毫秒（默认 300，子组件搜索栏场景设 0） |

**返回值**：

| 分类 | 属性 | 说明 |
|------|------|------|
| 表格状态 | `loading` | 加载中 |
| | `tableData` | 表格数据 |
| | `queryParams` | 搜索参数（可读写） |
| 分页 | `pagination` | `{ page_index, page_size, total }` |
| | `pageQuery` | 计算后的分页参数 |
| | `handleCurrentChange` | 页码变更回调 |
| | `handleSizeChange` | 每页条数变更回调 |
| | `setTotal` | 设置总数 |
| 操作锁 | `isLoading(key)` | 判断指定操作是否加载中 |
| | `isAnyLoading()` | 判断是否有任意操作在执行 |
| | `withLoading(key, fn)` | 带锁执行异步操作 |
| 业务方法 | `loadTable()` | 加载列表数据 |
| | `search()` | 搜索（防抖 + 重置页码） |
| | `reset()` | 恢复 defaultQuery + 搜索 |
| | `submitQuery(next)` | 子组件提交搜索参数（不防抖） |
| | `remove(row, opts)` | 通用删除（确认 + 操作锁 + 成功提示 + 刷新） |

**remove 选项（CrudRemoveOptions\<T\>）**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | `string \| number \| ((row: T) => string \| number)` | 行 ID 或取值函数 |
| `confirmMessage` | `string \| ((row: T) => string)` | 确认弹窗文案 |
| `api` | `(id: string \| number) => Promise<void>` | 删除 API |
| `loadingKey?` | `string` | 操作锁 key（默认 `delete-${id}`） |
| `successMessage?` | `string` | 成功提示（默认 "删除成功"） |

**使用示例**：

```typescript
import { useCrudTable } from '@/composables/useCrudTable'
import type { BlacklistItem } from '@/api/interfaces/blacklist'
import { blacklistApi } from '@/api/modules/manager/blacklist'

const {
  loading, tableData, queryParams, pagination,
  handleCurrentChange, handleSizeChange,
  isLoading, isAnyLoading, withLoading,
  loadTable, search, reset, remove,
} = useCrudTable<BlacklistItem, { ip_address: string; is_active: number | undefined }>({
  fetch: (p) => blacklistApi.getList(p),
  defaultQuery: { ip_address: '', is_active: undefined },
  searchDebounceMs: 0,
})

async function handleDelete(row: BlacklistItem) {
  await remove(row, {
    id: row.id,
    confirmMessage: `确认删除 IP「${row.ip_address}」？`,
    api: blacklistApi.remove,
  })
}
```

---

### useDialogFocus（`src/composables/useDialogFocus.ts`）

对话框焦点管理，打开时自动聚焦第一个输入，关闭时焦点返回触发按钮。所有 `el-dialog` 表单编辑弹窗都应使用。

```typescript
import { useDialogFocus } from '@/composables/useDialogFocus'

const { onDialogOpened, onDialogClosed, saveTriggerEl } = useDialogFocus()

// 模板中：
// <el-dialog @opened="onDialogOpened" @close="onDialogClosed">
//   <el-form ref="formRef">...</el-form>
// </el-dialog>
// <el-button @click="handleEdit(row); saveTriggerEl($event)">编辑</el-button>
```

---

### useActionLoading（`src/composables/useActionLoading.ts`）

独立操作锁 Composable，用于不用 `useCrudTable` 的页面。**单锁模式**：同一时刻只能有一个异步操作。

```typescript
import { useActionLoading } from '@/composables/useActionLoading'

const { isLoading, isAnyLoading, withLoading } = useActionLoading()

// 模板中：
// <el-button :loading="isLoading('submit')" :disabled="isAnyLoading()" @click="handleSubmit">提交</el-button>

// 脚本中：
async function handleSubmit() {
  await withLoading('submit', async () => {
    await api.submit(formData)
  })
}
```

---

### usePermission（`src/composables/usePermission.ts`）

编程式权限检查。模板中**优先使用 `v-permission` 指令**，脚本逻辑中需要权限判断时使用此 composable。

```typescript
import { usePermission } from '@/composables/usePermission'

const { hasPermi, hasPermiOr } = usePermission()

// 单权限检查
const canEdit = computed(() => hasPermi('sys:notice:edit'))

// 任一权限检查（OR）
const canModify = computed(() => hasPermiOr(['sys:notice:edit', 'sys:notice:remove']))
```

**注意**：返回值是 `hasPermi` 和 `hasPermiOr`，不是 `hasPermission`。

---

## 公共组件

### PaginationBar（`src/components/PaginationBar.vue`）

统一分页栏，接收 `useCrudTable` 或 `usePagination` 的返回值。

```vue
<PaginationBar
  :pagination="pagination"
  :on-current-change="handleCurrentChange"
  :on-size-change="handleSizeChange"
/>
```

Props：
- `pagination: { page_index, page_size, total }` — 分页状态对象
- `onCurrentChange: (page: number) => void` — 页码变更
- `onSizeChange: (size: number) => void` — 每页条数变更
- `size?: 'large' | 'default' | 'small'` — 尺寸变体

### HelpBubble（`src/components/HelpBubble.vue`）

帮助气泡，仅在 Mock 模式渲染。`content` 必须用 `MOCK_ENABLED` 守卫实现 tree-shaking。

```vue
<HelpBubble :content="MOCK_ENABLED ? '功能说明文字' : ''" />
```

### TableEmpty（`src/components/TableEmpty.vue`）

增强空状态，支持 CTA 按钮。Props：`description?`、`ctaText?`、`permissions?`。CTA 按钮支持 `v-permission`。

### TableSkeleton（`src/components/TableSkeleton.vue`）

表格骨架屏加载状态。Props：`columns: { width?, minWidth? }[]`、`rows?`。

---

## 工具函数

### validators（`src/utils/validators.ts`）

表单验证规则工厂，用于 Element Plus `FormRules`。

| 函数 | 说明 | 示例 |
|------|------|------|
| `requiredRule(label, trigger?)` | 必填（"请输入{label}"），trigger 默认 `'blur'` | `requiredRule('角色名称')` |
| `requiredSelectRule(label)` | 必选（"请选择{label}"），trigger `'change'` | `requiredSelectRule('状态')` |
| `maxLengthRule(max, label?)` | 最大长度 | `maxLengthRule(50, '描述')` |
| `minLengthRule(min, label?)` | 最小长度 | `minLengthRule(6, '密码')` |
| `lengthRangeRule(min, max, label?)` | 长度区间 | `lengthRangeRule(2, 20, '名称')` |
| `phoneRule` | 手机号（中国大陆 11 位） | 直接引用 |
| `emailRule` | 邮箱格式 | 直接引用 |
| `ipOrCidrRule` | IP/CIDR 格式（必填 + 格式校验） | 直接引用 |

使用示例：
```typescript
import { requiredRule, requiredSelectRule, maxLengthRule } from '@/utils/validators'

const formRules: FormRules = {
  role_name: [requiredRule('角色名称'), maxLengthRule(50, '角色名称')],
  status: [requiredSelectRule('状态')],
}
```

### confirmAction（`src/utils/confirm.ts`）

二次确认对话框，封装 `ElMessageBox.confirm`。返回 `Promise<boolean>`，点击确认返回 `true`，取消返回 `false`（不抛异常）。

```typescript
import { confirmAction } from '@/utils/confirm'

if (!(await confirmAction('确认删除？'))) return
await api.remove(id)
```

> **CRUD 页面中的删除操作**：`useCrudTable.remove()` 已内置 `confirmAction` 调用，无需手动调用。

### formatDateTime（`src/utils/format.ts`）

日期时间格式化，空值返回 `"—"`。

```typescript
import { formatDateTime, formatDateTimeSeconds } from '@/utils/format'

formatDateTime('2026-06-06T14:30:00')        // "2026-06-06 14:30"
formatDateTimeSeconds(new Date())             // "2026-06-13 10:30:45"
formatDateTime(null)                          // "—"
```

---

## 权限系统（三层）

| 层级 | 方式 | 文件 | 使用场景 |
|------|------|------|---------|
| **指令** | `v-permission="['sys:module:action']"` | `src/directives/permission.ts` | 模板中声明式隐藏按钮 |
| **Composable** | `const { hasPermi, hasPermiOr } = usePermission()` | `src/composables/usePermission.ts` | 脚本中编程式权限判断 |
| **工具函数** | `matchPermission(required, userPerms, mode?)` | `src/utils/permission.ts` | 纯函数，通配符支持 |

权限字符串格式：`{module}:{entity}:{action}`（如 `sys:notice:add`、`api:blacklist:edit`）

**指令格式**：`v-permission` 接收**数组**（不是字符串），支持 OR 逻辑：
```vue
<!-- 单权限 -->
<el-button v-permission="['sys:user:add']">新增</el-button>
<!-- 多权限（满足任一即显示，如「操作」列在可编辑或可删除时出现） -->
<el-button v-permission="['sys:user:edit', 'sys:user:remove']">操作</el-button>
```

---

## CSS 变量

对话框尺寸（`src/styles/variables.css`）：
- `var(--dialog-sm)` = 440px — 简单表单
- `var(--dialog-md)` = 560px — 标准表单
- `var(--dialog-lg)` = 680px — 复杂表单
- `var(--dialog-xl)` = 900px — 详情查看

使用方式：
```vue
<el-dialog v-model="dialogVisible" :width="'var(--dialog-md)'">
```

表单标签宽度：
- `var(--form-label-sm)` = 80px
- `var(--form-label-md)` = 90px
- `var(--form-label-lg)` = 110px

---

## 弹窗表单完整模式

CRUD 页面中编辑弹窗的标准写法：

```typescript
const dialogVisible = ref(false)
const dialogTitle = ref('')
const formData = ref<RoleCreateParams & { id?: number }>({
  role_name: '',
  role_key: '',
  status: StatusEnum.Normal,
  remark: '',
  menu_ids: [],
})
const formRules: FormRules = {
  role_name: [requiredRule('角色名称'), maxLengthRule(50, '角色名称')],
  role_key: [requiredRule('角色标识')],
  status: [requiredSelectRule('状态')],
}
const formRef = ref<FormInstance>()
const { onDialogOpened, onDialogClosed, saveTriggerEl } = useDialogFocus()

function handleAdd() {
  dialogTitle.value = '新增角色'
  formData.value = { role_name: '', role_key: '', status: StatusEnum.Normal, remark: '', menu_ids: [] }
  dialogVisible.value = true
}

function handleEdit(row: RoleItem) {
  dialogTitle.value = '编辑角色'
  formData.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  await withLoading('submit', async () => {
    if (formData.value.id) {
      await roleApi.update(formData.value as RoleUpdateParams)
    } else {
      await roleApi.create(formData.value)
    }
    dialogVisible.value = false
    await loadTable()
  })
}
```

```vue
<el-dialog
  v-model="dialogVisible"
  :title="dialogTitle"
  :width="'var(--dialog-md)'"
  @opened="onDialogOpened"
  @close="onDialogClosed"
>
  <el-form ref="formRef" :model="formData" :rules="formRules" :label-width="'var(--form-label-md)'">
    <el-form-item label="角色名称" prop="role_name">
      <el-input v-model="formData.role_name" />
    </el-form-item>
    <!-- 更多字段 -->
  </el-form>
  <template #footer>
    <el-button @click="dialogVisible = false">取消</el-button>
    <el-button type="primary" :loading="isLoading('submit')" :disabled="isAnyLoading()" @click="handleSubmit">确定</el-button>
  </template>
</el-dialog>
```
