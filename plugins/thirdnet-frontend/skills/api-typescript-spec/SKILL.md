---
name: api-typescript-spec
description: |
  前端 API 接口 TypeScript 全流程规范，基于接口契约的策略工厂模式（Strategy Factory Pattern with Interface Contract）。
  指导创建：策略接口（IXxxApi）、真实实现（RealXxxApi 适配 HTTP）、Mock 实现（MockXxxApi 适配本地数据）、工厂函数（createXxxApi）、枚举类型（enum + JSDoc 注释）。
  当用户需要创建 API 接口、添加接口模块、编写 Mock 数据、定义请求类型、设置 API 层架构、创建枚举类型、或任何涉及 api/modules/ 和 mock/data/ 目录的操作时，必须使用此 skill。
  关键触发词：API、接口、Mock、请求、adapter、request、类型定义、DTO、分页、认证、登录、token、枚举、enum、策略模式、工厂模式、接口契约、IXxxApi。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
  compatibility: Vue 3 + TypeScript + Vite 项目，支持 Web（Element Plus）和移动端（uniapp + Vant，发布为微信小程序 mp-weixin）
---

# 前端 API 接口 TypeScript 规范（策略工厂模式）

API 层采用**接口契约的策略工厂模式**，通过 TypeScript 接口定义 API 契约，Real 和 Mock 作为可互换的策略实现，工厂函数根据 `.env` 配置自动选择具体实例。所有 API 模块与 Mock 数据文件严格 1:1 对应。

## 核心约定

来自后端架构和网关限制，不可违反：

1. **仅 GET / POST**：网关限制，不使用 PUT/DELETE/PATCH。禁止在 request.ts 中导出 PUT/DELETE/PATCH 的便捷方法。adapter 接口中的 HttpMethod 类型应限定为 `'GET' | 'POST'`
2. **字段名强制 snake_case**：所有 API 入参、出参、Mock 数据的字段名必须使用 `snake_case`（如 `order_id`、`created_at`、`user_name`），与后端 DTO 保持一致，**禁止使用 camelCase**
3. **响应无包装**：成功直接返回实体 JSON 或 `PaginatedResponse<T>`，不用 `{ code, message, data }` 包装
4. **错误走 HTTP 状态码**：通过 401/403/404/500 等区分错误
5. **API 与 Mock 1:1**：`api/modules/{endpoint}/{module}.ts` 对应 `mock/data/{endpoint}/{module}.ts`
6. **全面 TypeScript**：所有前端代码必须使用 `.ts` 扩展名，Vue 组件必须使用 `<script setup lang="ts">`
7. **枚举使用 enum**：所有枚举使用 `enum` 关键字（禁止 union type 或 const object），每个成员必须添加 JSDoc 注释

## 设计模式

API 层组合运用三种设计模式：

| 模式 | 体现 | 解决的问题 |
|------|------|-----------|
| **策略模式** | `IOrderApi` 定义接口，`RealOrderApi` 和 `MockOrderApi` 是可互换实现 | API 调用与具体实现解耦 |
| **简单工厂** | `createOrderApi(): IOrderApi` 根据 `MOCK_ENABLED` 创建实例 | 环境配置自动选择策略 |
| **适配器** | `RealXxxApi` 适配 HTTP，`MockXxxApi` 适配本地数据 | 两种数据源适配同一接口契约 |

架构流程：

```
页面 → orderApi.getOrderList(params) → IOrderApi 接口
                                          ├─ RealOrderApi → request<T>() → HTTP
                                          └─ MockOrderApi → mock/data/ → 内存
```

## 目录结构

```
src/
├── config/index.ts                    # MOCK_ENABLED、API_BASE_URL
├── api/
│   ├── types/common.ts               # 基础类型
│   ├── types/enums.ts                # 跨模块通用枚举
│   ├── adapter.ts                     # RequestAdapter 接口
│   ├── adapter.web.ts                 # Axios 实现
│   ├── adapter.uni.ts                 # uni.request 实现
│   ├── request.ts                     # 统一 request<T>() 导出
│   └── modules/{app|manager}/         # API 模块（策略工厂模式）
│       └── {module}.ts                # 枚举 + 类型 + IXxxApi + Real + Mock + 工厂
├── mock/
│   └── data/{app|manager}/            # 与 api/modules/ 1:1 对应
├── utils/token.ts                     # Token 存取（双平台适配）
```

端点标识：`app`（用户端）、`manager`（管理端），对应后端 Controller 目录。

## 创建步骤

### 步骤 1：基础类型 + 枚举

**基础类型**（`src/api/types/common.ts`）：

```typescript
type Endpoint = 'manager' | 'app'

interface PaginationParams { index: number; size: number }

interface PaginatedResponse<T> { list: T[]; total: number; index: number; size: number }

interface RequestConfig<TData = unknown> {
  url: string
  method: 'GET' | 'POST'
  data?: TData
  params?: Record<string, unknown>
  endpoint?: Endpoint
}

interface ApiError { status: number; message: string }
```

**枚举规范**：命名格式 `{Entity}{Property}Enum`，每个成员加 JSDoc。通用枚举放 `api/types/enums.ts`，模块专属枚举放 API 模块文件顶部。

```typescript
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
```

### 步骤 2：请求适配器

适配器层实现双平台统一，业务代码只调用 `request<T>()`。Mock 拦截不在适配器层，由策略模式在 API 模块层面处理。

**接口定义** — `adapter.ts`：
```typescript
interface RequestAdapter {
  request<TResponse>(config: RequestConfig): Promise<TResponse>
}
```

**实现要点**（`adapter.web.ts` 用 Axios，`adapter.uni.ts` 用 uni.request）：
- 请求拦截：从 storage 读取 token，添加 `Authorization: bearer {token}` 头
- 401 处理：尝试 refreshToken，失败则 clearToken 并跳转登录页
- uni.request 需手动拼接 query string，错误判断用 `statusCode >= 400`

**uniapp 项目适配器选择**：对于 uniapp 项目，H5 和 MP-WEIXIN 均使用 `UniAdapter`，无需条件编译选择适配器。条件编译仅在 `token.ts` 等需要区分 `localStorage` 和 `uni.getStorageSync` 的场景中使用。

**统一导出** — `request.ts`（条件编译选择平台适配器）：
```typescript
// #ifdef H5
import { AxiosAdapter } from './adapter.web'
const adapter: RequestAdapter = new AxiosAdapter()
// #endif

// #ifdef MP-WEIXIN
import { UniAdapter } from './adapter.uni'
const adapter: RequestAdapter = new UniAdapter()
// #endif

export function request<TResponse>(config: RequestConfig): Promise<TResponse> {
  return adapter.request<TResponse>(config)
}
```

### 步骤 3：API 模块文件

每个模块文件包含五个区域，按顺序：**枚举 → 类型定义 → 接口契约 → Real 实现 → Mock 实现 → 工厂函数 + 模块实例**。

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

#### 模块文件模板（以 `api/modules/app/order.ts` 为例）

```typescript
import { request } from '@/api/request'
import { MOCK_ENABLED } from '@/config'
import type { PaginationParams, PaginatedResponse } from '@/api/types/common'
import { mockOrderList } from '@/mock/data/app/order'

// ---- 枚举类型 ----

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

// ---- 类型定义 ----

interface OrderQueryParams extends PaginationParams {
  status?: OrderStatusEnum
  order_no?: string
}

interface OrderCreateParams {
  product_id: number
  quantity: number
  remark?: string
}

interface OrderItem {
  order_id: number
  order_no: string
  product_id: number
  quantity: number
  amount: number
  status: OrderStatusEnum
  created_at: string
}

// ---- 接口契约（Strategy Interface）----

export interface IOrderApi {
  getOrderList(params: OrderQueryParams): Promise<PaginatedResponse<OrderItem>>
  getOrderDetail(params: { id: number }): Promise<OrderItem>
  createOrder(data: OrderCreateParams): Promise<OrderItem>
}

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

// ---- Mock 实现（适配本地数据）----

class MockOrderApi implements IOrderApi {
  async getOrderList(params: OrderQueryParams): Promise<PaginatedResponse<OrderItem>> {
    const { index = 1, size = 10 } = params
    const start = (index - 1) * size
    return { list: mockOrderList.slice(start, start + size), total: mockOrderList.length, index, size }
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

// ---- 工厂函数（Simple Factory）----

export function createOrderApi(): IOrderApi {
  return MOCK_ENABLED ? new MockOrderApi() : new RealOrderApi()
}

// ---- 模块实例（模块级单例）----

export const orderApi = createOrderApi()
```

**要点**：
- **接口契约是核心**：`IXxxApi` 定义所有方法签名，Real 和 Mock 必须完整实现
- **类型定义集中在接口之前**：不导出（除非 Mock 或其他模块需要引用）
- **工厂函数返回接口类型**：调用方只看到 `IXxxApi`，不知道具体实现
- **模块实例是单例**：`export const orderApi = createOrderApi()` 模块加载时执行一次

### 步骤 4：Mock 数据文件

与 API 模块 1:1 对应，复用类型和枚举：

```typescript
// mock/data/app/order.ts
import type { OrderItem } from '@/api/modules/app/order'
import { OrderStatusEnum } from '@/api/modules/app/order'

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

**要求**：
- `import type` 引入类型，`import` 引入枚举（enum 是值，不用 `import type`）
- 导出 `mock{Entity}List` + `mock{Entity}Detail`
- 枚举字段必须使用 enum 值（如 `OrderStatusEnum.Paid`），禁止硬编码字符串

### 步骤 5：配置

```typescript
// src/config/index.ts
export const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
```

**环境文件**：
```
# .env（开发 — Mock 模式）     # .env.production（生产 — 真实 API）
VITE_MOCK=true                  VITE_MOCK=false
VITE_API_BASE_URL=/api          VITE_API_BASE_URL=https://api.example.com
```

**切换流程**：修改 `.env` 中 `VITE_MOCK` 值 → 重启开发服务器，无需修改任何业务代码。工厂函数在模块初始化时执行一次，运行期间不再切换。

## 认证模块（`auth.ts`）

认证模块同样采用策略工厂模式，特殊点：
- 使用后端 IdentityServer Connect 端点（`/connect/token`）
- Token 工具（`src/utils/token.ts`）：H5 用 `localStorage`，MP-WEIXIN 用 `uni.getStorageSync`
- 导出 `getToken`、`setToken`、`getRefreshToken`、`setRefreshToken`、`clearToken`

```typescript
// 认证模块接口契约示例
interface LoginParams { username: string; password: string; scope?: string }
interface TokenResponse { access_token: string; refresh_token: string }

export interface IAuthApi {
  login(data: LoginParams): Promise<TokenResponse>
  refreshToken(data: { refresh_token: string }): Promise<TokenResponse>
  getCurrentUser(): Promise<CurrentUserResponse>
}

// Real 实现调用 /connect/token，Mock 实现返回固定 token
// 工厂函数 + 模块实例与普通模块相同
```

## 1:1 对应同步检查

修改任一侧必须同步另一侧：

```
api/modules/app/order.ts      <--->  mock/data/app/order.ts
api/modules/manager/user.ts   <--->  mock/data/manager/user.ts
```

- 新增接口方法 → Mock 实现是否同步
- 修改方法签名 → Real 和 Mock 是否同步更新
- 修改枚举值 → Mock 数据引用是否同步
- 新增模块文件 → Mock 数据文件是否存在

## 页面调用

```typescript
import { orderApi, OrderStatusEnum } from '@/api/modules/app/order'

const loading = ref(false)
const orderList = ref<OrderItem[]>([])

async function loadOrders() {
  loading.value = true
  try {
    const result = await orderApi.getOrderList({ index: 1, size: 10 })
    orderList.value = result.list
  } finally {
    loading.value = false
  }
}
```
