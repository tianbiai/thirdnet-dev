---
name: vue-enum-dict
description: >
  ThirdNet 前端枚举字典与自定义字典使用规范。区分两类字典：枚举字典
  （dict_source=0，int，useDict）与自定义字典（dict_source=1，string，getDictDataByType）。
  覆盖表单下拉、表单提交（提交数值/字符串，禁止提交 label）、表格列（直接用后端 *_label）、
  筛选下拉四个场景，含前后端速查对照表。当用户涉及"下拉选项"、"枚举字典"、"自定义字典"、
  "useDict"、"getDictDataByType"、"el-select"、"*_label"、"dict_type"、"int 还是 string"、
  "加个下拉"时，必须使用此技能。
license: MIT
metadata:
  version: "1.0.1"
  author: thirdnet
---

# ThirdNet 枚举字典与自定义字典（前端）

> 后端配套规范见 **`net-enum-dict`** 技能。
>
> 兼容性：Vue 3 + TypeScript + Element Plus（Web 端）。

## 概览：两条路径不混用

前端处理「下拉选项 / 表格翻译 / 表单提交」时，必须先判断字段属于哪一类字典，走对应接口和类型：

| 维度 | 枚举字典（`dict_source=0`） | 自定义字典（`dict_source=1`） |
|------|------------------------------|--------------------------------|
| **取选项** | `useDict(dictType)` | `dictApi.getDictDataByType(dictType)` |
| **接口** | `GET /api/manager/dict/options/{dict_type}` | `GET /api/manager/dict/data/type/{dict_type}` |
| **选项类型** | `EnumItem { value:number, label }` | `DictDataItem { dict_value:string, dict_label, tag_type, css_class, dict_sort, status, ... }`（`getDictDataByType` 的返回类型） |
| **表单字段类型** | `number` | `string` |
| **el-option `:value`** | `o.value` | `o.dict_value` |
| **el-option `:label`** | `o.label` | `o.dict_label` |

**核心原则**：

1. **禁止硬编码下拉选项数组**——选项必须从后端取，否则改枚举/字典会漏。
2. **禁止提交 label 字符串或枚举名**——提交数值（枚举）或编码（自定义），类型与后端 DTO 对齐。
3. **表格列直接用后端 `*_label`**——不要前端翻译，不要在表格列用 `useDict.formatLabel`。
4. **两类字典不可混用接口**——枚举字典走 `/options`（int），自定义字典走 `/data/type`（string），混用会导致 int/string 错配、下拉无法回显选中态。

## 决策准则（前端视角）

判断一个字段属于哪类字典：

- 字段类型是 `number`、选项来自 `useDict` → **枚举字典**（int）。
- 字段类型是 `string`、选项来自 `getDictDataByType` → **自定义字典**（string）。
- 不确定 → 看后端实体/DTO 字段类型，判断会不会在不发版的情况下由运营改动：不会→枚举，会→自定义。

## 场景 A：表单下拉（枚举字典）

用 `useDict(dictType)` 从 `/dict/options` 取选项（store 自动幂等缓存，登出时清空）。`options` 是 `EnumItem[]`（`ComputedRef<EnumItem[]>`），`value: number`。

```vue
<script setup lang="ts">
import { useDict } from '@/composables/useDict'
const { options } = useDict('priority')   // GET /api/manager/dict/options/priority
const form = reactive({ priority: 0 as number })   // ← number
</script>

<template>
  <el-select v-model="form.priority">
    <el-option
      v-for="o in options"
      :key="o.value"
      :value="o.value"     <!-- int，与 form.priority(number) 严格相等 -->
      :label="o.label"
    />
  </el-select>
</template>
```

❌ 禁止：

```ts
// 禁止：前端硬编码下拉选项（改枚举会漏，违反唯一事实来源）
const PRIORITY_OPTIONS = [
  { value: 0, label: '低' },
  { value: 1, label: '中' },
]
```

## 场景 A'：表单下拉（自定义字典）

用 `dictApi.getDictDataByType`（**不是 `useDict`**）从 `/dict/data/type` 取选项。表单字段声明为 `string`。

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dictApi } from '@/api/modules/dict'
import type { DictDataItem } from '@/api/types/dict'

const sourceOptions = ref<DictDataItem[]>([])
const form = ref({ user_source: '' as string })   // ← string，初始空串

onMounted(async () => {
  sourceOptions.value = await dictApi.getDictDataByType('user_source')
  // 返回 [{ dict_label: '网页', dict_value: 'web', tag_type: '...' }, ...]
})
</script>

<template>
  <el-select v-model="form.user_source" placeholder="请选择来源">
    <el-option
      v-for="o in sourceOptions"
      :key="o.dict_value"
      :value="o.dict_value"      <!-- string，与 form.user_source 严格相等 -->
      :label="o.dict_label"
    />
  </el-select>
</template>
```

> ⚠️ **字段名易错**：枚举字典选项 `EnumItem` 是 `value/label`；自定义字典选项 `DictDataItem` 是 `dict_value/dict_label`。混用会导致 `:value` 绑空。

## 场景 B：表单提交

提交**数值（枚举）或编码（自定义）**，不提交 label 字符串、不提交枚举名。

```ts
// ✅ 枚举字典：form.priority 是 number，直接提交
await api.create({ name: '任务A', priority: form.priority })   // priority: 2

// ✅ 自定义字典：form.user_source 是 string，直接提交
await userApi.create({ user_name: form.value.user_name, user_source: form.value.user_source })   // user_source: "web"

// ❌ 禁止
{ priority: '高' }      // label 字符串
{ priority: 'High' }    // 枚举名
{ user_source: '网页' } // label 字符串
```

## 场景 C：表格列显示

**规则**：直接用后端返回的 `*_label` 字段，**不要**前端翻译。枚举字典、自定义字典都一样（后端响应 DTO 都已附 `*_label`，详见 `net-enum-dict` §4 / §7.1）。

```vue
<!-- ✅ 枚举字典：直接绑 label 字段 -->
<el-table-column prop="business_type_label" label="操作类型" />

<!-- ✅ 自定义字典：同样直接绑 label 字段 -->
<el-table-column prop="user_source_label" label="用户来源" />
```

> ❌ 表格列禁止用 `useDict.formatLabel`——多余请求，store 未加载时会空；直接用后端 `*_label` 性能最优、口径最一致。`useDict.formatLabel` 仅用于**非表格**的零星场景（如详情弹窗中后端未给 label 的字段）。

## 场景 D：筛选下拉（查询条件）

取选项同场景 A / A'，v-model 绑查询参数。

**枚举字典**（`number | undefined`，后端查询 DTO 是 `int?`，传 number 或不传都对）：

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useDict } from '@/composables/useDict'
const { options } = useDict('business_type')
const queryParams = reactive({ business_type: undefined as number | undefined })
</script>

<template>
  <el-select v-model="queryParams.business_type" clearable>
    <el-option v-for="o in options" :key="o.value" :value="o.value" :label="o.label" />
  </el-select>
</template>
```

**自定义字典**（`string | undefined`）：

```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { dictApi } from '@/api/modules/dict'
import type { DictDataItem } from '@/api/types/dict'

const sourceOptions = ref<DictDataItem[]>([])
const queryParams = reactive({ user_source: undefined as string | undefined })
onMounted(async () => {
  sourceOptions.value = await dictApi.getDictDataByType('user_source')
})
</script>

<template>
  <el-select v-model="queryParams.user_source" clearable>
    <el-option v-for="o in sourceOptions" :key="o.dict_value" :value="o.dict_value" :label="o.dict_label" />
  </el-select>
</template>
```

## 前后端速查对照表

| 操作 | 枚举字典（int） | 自定义字典（string） |
|------|------------------|----------------------|
| 取选项 | `useDict('status')` | `dictApi.getDictDataByType('user_source')` |
| 选项类型 | `EnumItem { value, label }` | `DictDataItem { dict_value, dict_label, ... }` |
| 表单字段类型 | `number` | `string` |
| el-option `:value` | `o.value` | `o.dict_value` |
| el-option `:label` | `o.label` | `o.dict_label` |
| 提交 | number | string |
| 后端 label 来源 | `EnumHelper.GetLabel(enumType, int)` | `DictCache.GetDictData(type)` + LINQ 查找 |
| 前端缓存 | `useDict` 自带（dict store） | 需自行 `ref` 缓存（或仿 `useDict` 封装一个 string 版） |

## 类型定义

两类选项类型不同，注意导入路径与字段名：

```ts
// 枚举字典选项（来自 /dict/options，useDict 内部使用）
interface EnumItem {
  value: number      // 枚举数值，int
  label: string      // 显示文字
  name?: string      // 枚举成员名
}

// 自定义字典数据项（getDictDataByType 的返回类型，来自 /dict/data/type）
// 从 @/api/types/dict 导入 DictDataItem
interface DictDataItem {
  id: number
  dict_type: string
  dict_label: string      // 显示文字
  dict_value: string      // 实际存储值，string
  dict_sort: number
  css_class: string       // CSS 样式类名
  tag_type: string        // el-tag 的 type
  status: number          // 0=正常 1=停用
  status_label?: string
  remark: string
  // ... 以及 created_by/created_time/updated_by/updated_time 等审计字段
}

// 注：@/api/types/dict 另有更窄的 DictOption（仅 dict_label/dict_value/css_class?/tag_type?），
// 但 getDictDataByType 实际返回的是完整的 DictDataItem——下拉/翻译统一用 DictDataItem。
```

## 端到端示例：新增「用户来源 user_source」（自定义字典）

| # | 角色 | 动作 |
|---|------|------|
| 1 | 运营 | 字典管理页建类型 `user_source`（dict_source=1），添加：网页=`web`、APP=`app`、小程序=`mini_program` |
| 2 | 后端实体 | `SysUserModel` 加 `public string user_source` |
| 3 | 后端 EF 配置 | text 列 + 注释 |
| 4 | 后端响应 DTO | `UserItemMap` 加 `user_source` + `user_source_label`，Service 用 `DictCache.GetDictData("user_source")` 建查找表回填 |
| 5 | 后端创建/更新 DTO | 加 `string user_source` |
| 6 | 后端查询 DTO + Service | 加 `string? user_source`，Service 按 string 匹配 |
| 7 | 前端表单 | `getDictDataByType('user_source')` 取选项，`form.user_source: string`，`:value="o.dict_value"` |
| 8 | 前端表格 | `prop="user_source_label"` |
| 9 | 前端提交 | 直接发 string |

> 后端各步骤细节见 `net-enum-dict` §7。

## 常见坑

1. **别用 `useDict` 取自定义字典**——`useDict` 打 `/options`（枚举反射），自定义字典不在 `SystemEnumRegistry` 里，返回空数组。必须用 `getDictDataByType`。
2. **字段名别搞混**：`EnumItem` 是 `value/label`，`DictDataItem` 是 `dict_value/dict_label`。混用会导致 `:value` 绑空。
3. **前端别用 `EnumHelper` / `DictDataView.GetLabel` 概念**——那是后端工具（`EnumHelper` 只认 C# 枚举，`DictDataView` 是后端 POCO 无查询方法）。前端拿到的 `*_label` 后端已经填好，直接用即可。
4. **表单字段类型必须匹配**：枚举字典→`number`，自定义字典→`string`。混用会导致 el-select 的 `v-model` 与 `:value` 类型不等、下拉无法回显选中态。
5. **别硬编码 `XXX_OPTIONS` 选项数组**——唯一事实来源是后端枚举/字典，前端硬编码改了会漏。
6. **表格列别用 `useDict.formatLabel` 翻译**——直接用后端 `*_label` 字段；`formatLabel` 仅用于后端未给 label 的零星非表格场景。
7. **TS `enum` 常量是可选的**——后端字典驱动的字段（枚举字典 int / 自定义字典 string）**不需要**定义 TS enum，类型直接用 `number`/`string`，选项走 `useDict`/`getDictDataByType`。TS enum 仅保留给纯前端常量（与 `api-typescript-spec` 核心约定 #7 一致）。

## 相关技能

- **net-enum-dict**：后端枚举字典与自定义字典规范——前后端配套技能
- **api-typescript-spec**：TS 枚举规范（仅纯前端常量用 TS enum；后端字典字段不用）
- **vue-best-practices**：Vue 3 通用最佳实践
- **admin-template-setup**：CRUD 页面模板（含字典列的表格）
