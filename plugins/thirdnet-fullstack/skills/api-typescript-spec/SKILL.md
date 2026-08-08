---
name: api-typescript-spec
description: >
  前端 API 接口 TypeScript 全流程规范，基于接口契约的策略工厂模式（Interface Contract + Strategy Factory）。
  指导创建类型定义、接口契约、真实实现（RealXxxApi 适配 HTTP）、Mock 实现、工厂函数（createXxxApi），
  Real/Mock 可互换。当用户需要创建 API 接口、添加接口模块、编写 Mock 数据、定义请求类型、设置 API 层架构，
  或任何涉及 api/ 与 mock/ 目录的操作时，必须使用此技能。
  触发词：API、接口、Mock、请求、adapter、类型定义、DTO、策略模式、工厂模式、接口契约、IXxxApi。
license: MIT
metadata:
  version: "2.2.3"
  author: thirdnet
---

> **兼容性**：Vue 3 + TypeScript + Vite 项目，支持 Web（Element Plus）和移动端（uniapp + Vant，发布为微信小程序 mp-weixin）。

# 前端 API 接口 TypeScript 规范（策略工厂模式）

API 层采用**接口契约的策略工厂模式**——组合策略（`IXxxApi` + Real/Mock 可互换）、简单工厂（`createXxxApi` 按 `MOCK_ENABLED` 选实例）、适配器（Real/Mock 适配 HTTP 与本地数据）三种设计模式：通过 TypeScript 接口定义 API 契约，工厂函数根据 `.env` 配置自动选择 Real 或 Mock 实例。每个模块的职责拆分到独立文件：类型定义、接口契约、真实实现、Mock 数据、Mock 实现各占一个文件；完整约定与示例见下方「文件职责分离」与「创建步骤」。

## 核心约定

来自后端架构和网关限制，不可违反：

1. **仅 GET / POST**：网关限制，不使用 PUT/DELETE/PATCH。禁止在 request.ts 中导出 PUT/DELETE/PATCH 的便捷方法。adapter 接口中的 HttpMethod 类型应限定为 `'GET' | 'POST'`
2. **字段名强制 snake_case**：所有 API 入参、出参、Mock 数据的字段名必须使用 `snake_case`（如 `order_id`、`created_at`、`user_name`），与后端 DTO 保持一致，**禁止使用 camelCase**
3. **响应无包装**：成功直接返回实体 JSON 或 `PaginatedResponse<T>`，不用 `{ code, message, data }` 包装
4. **错误走 HTTP 状态码**：通过 401/403/404/500 等区分错误
5. **API 与 Mock 文件对应**：`api/modules/{endpoint}/{module}.ts` 对应 `mock/api/{endpoint}/{module}.ts` + `mock/data/{endpoint}/{module}.ts`
6. **全面 TypeScript**：所有前端代码必须使用 `.ts` 扩展名，Vue 组件必须使用 `<script setup lang="ts">`
7. **TS 枚举仅用于纯前端常量**：仅当某选项集是**纯前端常量**（不来自后端字典、不会由运营改动）时，才定义 TS `enum`（每个成员加 JSDoc，禁止 union type / const object 替代）。**后端字典驱动字段不定义 TS enum**：枚举字典（`dict_source=0`，int）下拉走 `useDict(dictType)`、显示走后端 `*_label`、提交 number；自定义字典（`dict_source=1`，string）走 `dictApi.getDictDataByType`、提交 string。这类字段的 TS 类型直接用 `number` 或 `string`。详见 `vue-enum-dict` 技能

## 文件职责分离

每个 API 模块由 5 个文件组成，各司其职：

| 文件 | 职责 | 内容 |
|------|------|------|
| `api/types/{module}.ts` | 类型定义 | 枚举 + 出入参 interface |
| `api/interfaces/{endpoint}/{module}.ts` | 接口契约 | `IXxxApi` 接口定义 |
| `api/modules/{endpoint}/{module}.ts` | 真实实现 | `RealXxxApi` + 工厂函数 + 单例 |
| `mock/api/{endpoint}/{module}.ts` | Mock 实现 | `MockXxxApi` 类（从 mock/data/ 取数据） |
| `mock/data/{endpoint}/{module}.ts` | Mock 数据 | 纯数据导出 |

## 目录结构

```
src/
├── config/index.ts                    # MOCK_ENABLED、API_BASE_URL
├── api/
│   ├── types/
│   │   ├── common.ts                 # 基础类型（PaginationParams、PaginatedResponse<T> 等）
│   │   ├── enums.ts                  # 跨模块通用枚举
│   │   └── {module}.ts               # 模块专属：枚举 + 出入参类型
│   ├── interfaces/
│   │   └── {app|manager}/
│   │       └── {module}.ts           # IXxxApi 接口契约
│   ├── adapter.ts                     # RequestAdapter 接口
│   ├── adapter.web.ts                 # Axios 实现
│   ├── adapter.uni.ts                 # uni.request 实现
│   ├── request.ts                     # 统一 request<T>() 导出
│   └── modules/{app|manager}/
│       └── {module}.ts               # RealXxxApi + 工厂函数 + 模块单例
├── mock/
│   ├── api/{app|manager}/
│   │   └── {module}.ts               # MockXxxApi 实现（引用 mock/data/ 数据）
│   └── data/{app|manager}/
│       └── {module}.ts               # 纯 Mock 数据导出
├── utils/token.ts                     # Token 存取（双平台适配）
```

端点标识：`app`（用户端）、`manager`（管理端），对应后端 Controller 目录。

## 创建步骤

### 步骤 1：基础类型 + 枚举

**基础类型**（`src/api/types/common.ts`）：

```typescript
type Endpoint = 'manager' | 'app'

interface PaginationParams { page_index: number; page_size: number }

interface PaginatedResponse<T> { total: number; list: T[]; index?: number; pages?: number }

interface RequestConfig<TData = unknown> {
  /** 请求 URL 路径（相对于 baseURL）。Admin 模板约定写完整前缀，如 /api/manager/user/list */
  url: string
  method: 'GET' | 'POST'
  data?: TData
  params?: Record<string, unknown>
  /** 自定义请求头（如 Basic 认证头），与默认头合并 */
  headers?: Record<string, string>
  /**
   * 跳过 401 时的 token 自动刷新流程。
   * 登录 / 刷新接口（凭据错误也是 401）必须设 true，否则会陷入「刷新 → 再 401 → 再刷新」死循环。
   */
  skipAuthRefresh?: boolean
}

interface ApiError { status: number; message: string }
```

**枚举规范**：命名格式 `{Entity}{Property}Enum`，每个成员加 JSDoc。何时用 enum 见核心约定 #7（仅纯前端常量；后端字典驱动字段直接 `number`/`string`，详见 `vue-enum-dict`）。通用枚举放 `api/types/enums.ts`，模块专属放 `api/types/{module}.ts`。完整枚举示例见下方 3.1。

### 步骤 2：请求适配器

适配器层实现双平台统一，业务代码只调用 `request<T>()`。Mock 拦截不在适配器层，由策略模式在 API 模块层面处理。`adapter.ts` 定义 `RequestAdapter { request<TResponse>(config): Promise<TResponse> }`，`adapter.web.ts` 用 Axios、`adapter.uni.ts` 用 uni.request 实现；401 触发 refreshToken 失败后 clearToken 跳登录；uniapp 需手动拼 GET query string。

完整 `UniAdapter` 实现、双平台 `request.ts` 导出方式见 [adapter-implementation.md](references/adapter-implementation.md)，当实现/修改适配器或排查 uniapp 双平台请求问题时再读。

### 步骤 3：创建模块文件（5 个文件）

以 `order` 模块为例，按顺序创建 5 个文件。

#### URL 命名规范

| 操作 | URL 模式 | 方法 |
|------|---------|------|
| 列表 | `/api/{endpoint}/{module}/list` | GET |
| 详情 | `/api/{endpoint}/{module}/detail` | GET |
| 创建 | `/api/{endpoint}/{module}/create` | POST |
| 更新 | `/api/{endpoint}/{module}/update` | POST |
| 删除 | `/api/{endpoint}/{module}/delete` | POST |
| 自定义 | `/api/{endpoint}/{module}/{action}` | POST |

#### DTO 命名：`{Entity}QueryParams`、`{Entity}CreateParams`、`{Entity}UpdateParams`、`{Entity}Item`

#### 3.1 类型定义 — `api/types/order.ts`

```typescript
import type { PaginationParams } from './common'

// ---- 枚举 ----
// 纯前端常量枚举（不依赖后端字典）；字典字段见 #7 用 number + useDict。

/** 订单状态枚举 */
export enum OrderStatusEnum {
  /** 待支付 */
  Pending = 'pending',
  /** 已支付 */
  Paid = 'paid',
  /** 已取消 */
  Cancelled = 'cancelled',
  /** 已完成 */
  Completed = 'completed',
}

// ---- 出入参类型 ----

export interface OrderQueryParams extends PaginationParams {
  status?: OrderStatusEnum
  order_no?: string
}

export interface OrderCreateParams {
  product_id: number
  quantity: number
  remark?: string
}

export interface OrderItem {
  order_id: number
  order_no: string
  product_id: number
  quantity: number
  amount: number
  status: OrderStatusEnum
  created_at: string
}
```

**要点**：
- 枚举和出入参类型集中在此文件，全部 `export`
- `import type` 引入基础类型，`import` 引入其他模块的 enum（enum 是值）

#### 3.2 接口契约 — `api/interfaces/app/order.ts`

```typescript
import type { OrderQueryParams, OrderCreateParams, OrderItem } from '@/api/types/order'
import type { PaginatedResponse } from '@/api/types/common'

export interface IOrderApi {
  getOrderList(params: OrderQueryParams): Promise<PaginatedResponse<OrderItem>>
  getOrderDetail(params: { id: number }): Promise<OrderItem>
  createOrder(data: OrderCreateParams): Promise<OrderItem>
}
```

**要点**：
- 只放接口定义，不放任何实现
- 所有方法签名中的参数和返回值类型都引用 `api/types/` 中的类型
- 导出接口供 Real 实现、Mock 实现、页面组件引用

#### 3.3 Real 实现 + 工厂 — `api/modules/app/order.ts`

```typescript
import { request } from '@/api/request'
import { MOCK_ENABLED } from '@/config'
import type { IOrderApi } from '@/api/interfaces/app/order'
import type { OrderQueryParams, OrderCreateParams, OrderItem } from '@/api/types/order'
import type { PaginatedResponse } from '@/api/types/common'
import { MockOrderApi } from '@/mock/api/app/order'

// ---- Real 实现（适配 HTTP）----

class RealOrderApi implements IOrderApi {
  async getOrderList(params: OrderQueryParams) {
    return request<PaginatedResponse<OrderItem>>({
      url: '/app/order/list', method: 'GET', params,
    })
  }
  async getOrderDetail(params: { id: number }) {
    return request<OrderItem>({ url: '/app/order/detail', method: 'GET', params })
  }
  async createOrder(data: OrderCreateParams) {
    return request<OrderItem>({ url: '/app/order/create', method: 'POST', data })
  }
}

// ---- 工厂函数（Simple Factory）----

export function createOrderApi(): IOrderApi {
  return MOCK_ENABLED ? new MockOrderApi() : new RealOrderApi()
}

// ---- 模块实例（模块级单例）----

export const orderApi = createOrderApi()
```

**要点**：
- 文件只包含 Real 实现类、工厂函数、模块单例
- 工厂函数返回接口类型：调用方只看到 `IXxxApi`，不知道具体实现
- 模块实例是单例：`export const orderApi = createOrderApi()` 模块加载时执行一次
- Mock 实现通过 `import { MockOrderApi } from '@/mock/api/...'` 引入

#### 3.4 Mock 数据 — `mock/data/app/order.ts`

```typescript
import type { OrderItem } from '@/api/types/order'
import { OrderStatusEnum } from '@/api/types/order'

export const mockOrderList: OrderItem[] = [
  {
    order_id: 1, order_no: 'ORD202401001', product_id: 101,
    quantity: 2, amount: 598.00, status: OrderStatusEnum.Paid,
    created_at: '2024-01-15T10:30:00',
  },
  {
    order_id: 2, order_no: 'ORD202401002', product_id: 205,
    quantity: 1, amount: 299.00, status: OrderStatusEnum.Pending,
    created_at: '2024-01-16T14:20:00',
  },
]
```

**要点**：
- 只放纯数据导出，不放任何业务逻辑
- `import type` 引入类型，`import` 引入枚举（enum 是值，不用 `import type`）
- 枚举字段必须使用 enum 值（如 `OrderStatusEnum.Paid`），禁止硬编码字符串
- 从 `@/api/types/` 导入类型和枚举（不依赖 api/modules 或 api/interfaces）

#### 3.5 Mock 实现 — `mock/api/app/order.ts`

```typescript
import type { IOrderApi } from '@/api/interfaces/app/order'
import type { OrderQueryParams, OrderCreateParams, OrderItem } from '@/api/types/order'
import type { PaginatedResponse } from '@/api/types/common'
import { OrderStatusEnum } from '@/api/types/order'
import { mockOrderList } from '@/mock/data/app/order'

export class MockOrderApi implements IOrderApi {
  async getOrderList(params: OrderQueryParams): Promise<PaginatedResponse<OrderItem>> {
    const { page_index = 1, page_size = 10 } = params
    const start = (page_index - 1) * page_size
    return { list: mockOrderList.slice(start, start + page_size), total: mockOrderList.length, index: page_index, pages: Math.ceil(mockOrderList.length / page_size) }
  }
  async getOrderDetail(params: { id: number }): Promise<OrderItem> {
    const item = mockOrderList.find(i => i.order_id === params.id)
    if (!item) throw new Error(`Order ${params.id} not found`)
    return item
  }
  async createOrder(data: OrderCreateParams): Promise<OrderItem> {
    return {
      order_id: Date.now(), order_no: `ORD${Date.now()}`, ...data,
      amount: 0, status: OrderStatusEnum.Pending, created_at: new Date().toISOString(),
    }
  }
}
```

**要点**：
- 只放 Mock 实现类，不硬编码数据（数据从 `@/mock/data/` 导入）
- 实现 `IXxxApi` 接口，方法签名与接口契约一致
- 使用 `export class` 导出，供 `api/modules/` 中的工厂函数引用

### 步骤 4：配置

```typescript
// src/config/index.ts
export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === 'true'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
```

#### 环境文件

| 文件 | 值 | 用途 |
|------|-----|------|
| `.env.development` | `VITE_MOCK_ENABLED=false` | 日常开发（连真实 API，需后端就绪） |
| `.env.prototype` | `VITE_MOCK_ENABLED=true` | 原型演示构建（走 Mock，无需后端） |
| `.env.production` | `VITE_MOCK_ENABLED=false` | 生产构建（连真实 API） |

> **Admin 模板项目例外**：使用 `create-thirdnet-admin` 创建的 Admin 模板项目采用**单一 `.env` 文件**（手动改 `VITE_MOCK_ENABLED` 切换），不使用上述三文件 `.env.{mode}` 模式。详见 `admin-template-setup`。

#### 构建模式

| 命令 | mode | Mock 行为 | 构建优化 |
|------|------|-----------|---------|
| `dev` / `dev:h5` | development | 连真实 API（`VITE_MOCK_ENABLED=false`） | 无 |
| `build:proto` / `build:h5:proto` | prototype | 正常加载，使用 MockApi | 有 |
| `build` / `build:h5` | production | 排除 mock 代码，使用 RealApi | 有 |

#### 生产构建排除机制

生产构建（`vite build`）**且 Mock 关闭**时，自定义 Vite 插件 `mockDataStripPlugin()` 拦截 `/mock/data/` 导入替换为空数组桩，配合 `MOCK_ENABLED` 静态为 `false` 让 `new MockXxxApi()` 分支成为死代码被 Rollup tree-shaking 移除；开发模式与 Mock 开启的生产构建（原型/演示）插件不启用。

完整 `mockDataStripPlugin()` 源码、tree-shaking 原理与开发辅助文案剥离示例见 [mock-stripping.md](references/mock-stripping.md)，当修改 `vite.config.ts` 或排查 tree-shaking 问题时再读。

## 认证模块（`auth.ts`）

认证模块同样采用策略工厂模式和文件拆分，Admin 模板的特殊点：登录/刷新端点必须用 `signBasicAuth(urlPath)`（HMAC-SM3，国密）生成 `Authorization: Basic ...` 头、请求体是普通 JSON（非 form-urlencoded、无 `grant_type`）、`login`/`refreshToken` 必须设 `skipAuthRefresh: true` 否则 401 死循环；`getCurrentUser` 走 `/api/manager/auth/info` 普通 Bearer。这是 ThirdNet 应用加密认证，不是 IdentityServer `/connect/token`。

完整 `RealAuthApi` / `MockAuthApi` / `mockCurrentUser` / `signBasicAuth` 实现与 `token.ts` 双平台适配见 [auth-module.md](references/auth-module.md)，当新增/修改 Admin 认证、排查 Basic 签名或 refresh 死循环时再读。

## 页面调用

> → Admin 模板 CRUD 页面统一用 `useCrudTable`，见 `admin-template-setup`（含 `useCrudTable`/`useActionLoading`/`withLoading` 强制规则与 [crud-page-development-guide](../admin-template-setup/references/crud-page-development-guide.md)）。

### 非 Admin 模板项目：手动调用

```typescript
import { orderApi } from '@/api/modules/app/order'
import { OrderStatusEnum } from '@/api/types/order'
import type { OrderItem } from '@/api/types/order'

const loading = ref(false)
const orderList = ref<OrderItem[]>([])

async function loadOrders() {
  loading.value = true
  try {
    const result = await orderApi.getOrderList({ page_index: 1, page_size: 10 })
    orderList.value = result.list
  } finally {
    loading.value = false
  }
}
```

**要点**：
- `orderApi` 从 `@/api/modules/` 导入（模块单例）
- 类型和枚举从 `@/api/types/` 导入
- 接口类型（`IOrderApi`）一般不在页面中使用，仅在实现层引用
