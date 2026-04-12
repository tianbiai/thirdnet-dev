---
name: api-typescript-spec
description: |
  前端 API 接口及 Mock 接口的 TypeScript 全流程规范。指导创建类型安全的 API 模块文件（类型定义 + 请求函数）、对应的 Mock 数据文件、请求适配器（双平台 Axios/uni.request）、以及认证接口。
  当用户需要创建 API 接口、添加接口模块、编写 Mock 数据、定义请求类型、设置 API 层架构、或任何涉及 api/modules/ 和 mock/data/ 目录的操作时，必须使用此 skill。
  关键触发词：API、接口、Mock、请求、adapter、request、类型定义、DTO、分页、认证、登录、token。
compatibility: Vue 3 + TypeScript + Vite 项目，支持 Web（Element Plus）和移动端（uniapp + Vant，发布为微信小程序 mp-weixin）
---

# 前端 API 接口及 Mock 接口 TypeScript 规范

本规范将 API 层从纯 JavaScript 升级为完整的 TypeScript 全流程，覆盖类型定义、请求适配器、API 模块、Mock 系统。所有 API 模块文件与 Mock 数据文件严格 1:1 对应。

## 核心约定

在开始编写任何代码之前，理解这些约束——它们来自后端架构和网关限制，不可违反：

1. **仅 GET / POST**：网关限制，不使用 PUT/DELETE/PATCH
2. **字段名 snake_case**：与后端 DTO 属性名一致（如 `order_id`、`created_at`）
3. **响应无包装**：成功直接返回实体 JSON 或 `PaginatedResponse<T>`，不用 `{ code, message, data }` 包装
4. **错误走 HTTP 状态码**：通过 401/403/404/500 等区分错误，不使用业务 code
5. **API 与 Mock 1:1**：`api/modules/{endpoint}/{module}.ts` 对应 `mock/data/{endpoint}/{module}.ts`

## 目录结构

```
src/
├── config/index.ts                    # MOCK_ENABLED、API_BASE_URL
├── api/
│   ├── types/common.ts               # 基础类型（PaginationParams、PaginatedResponse、RequestConfig）
│   ├── adapter.ts                     # RequestAdapter 接口定义
│   ├── adapter.web.ts                 # Web 端 Axios 实现
│   ├── adapter.uni.ts                 # 移动端 uni.request 实现
│   ├── request.ts                     # 统一 request<T>() 导出
│   └── modules/
│       ├── app/                       # 用户端接口
│       │   ├── auth.ts
│       │   ├── order.ts
│       │   └── product.ts
│       ├── manager/                   # 管理端接口
│       │   ├── user.ts
│       │   └── role.ts
├── mock/
│   ├── types.ts                       # MockRoute、MockConfig 类型
│   ├── handler.ts                     # 路由注册表 + findMockRoute + executeMock
│   └── data/                          # 与 api/modules/ 1:1 对应
│       ├── app/
│       │   ├── order.ts
│       │   └── product.ts
│       ├── manager/
│           ├── user.ts
│           └── role.ts
├── utils/token.ts                     # Token 存取（双平台适配）
```

端点标识（对应后端 Controller 目录）：
- `app`：用户端 → `Controllers/App/`
- `manager`：管理端 → `Controllers/Manager/`

## 创建步骤

按以下顺序创建文件，每步完成后确认再进入下一步。

### 步骤 1：基础类型（src/api/types/common.ts）

这是所有 API 模块的基础依赖，最先创建：

```typescript
/** 端点类型（对应后端三套 Controller 目录） */
type Endpoint = 'manager' | 'app'

/** 统一分页参数 */
interface PaginationParams {
  index: number
  size: number
}

/** 统一分页响应 */
interface PaginatedResponse<T> {
  list: T[]
  total: number
  index: number
  size: number
}

/** API 请求配置（平台无关） */
interface RequestConfig<TData = unknown> {
  url: string
  method: 'GET' | 'POST'
  data?: TData
  params?: Record<string, unknown>
  endpoint?: Endpoint
}

/** HTTP 错误响应 */
interface ApiError {
  status: number
  message: string
}

/** 排序参数 */
interface SortParams {
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
```

### 步骤 2：请求适配器（src/api/）

适配器层实现双平台统一，业务代码只调用 `request<T>()`：

**接口定义** — `src/api/adapter.ts`：
```typescript
/** 平台无关的请求适配器接口 */
interface RequestAdapter {
  request<TResponse>(config: RequestConfig): Promise<TResponse>
}
```

**Web 端** — `src/api/adapter.web.ts`（Axios）：
```typescript
import axios, { type AxiosInstance } from 'axios'
import type { RequestAdapter } from './adapter'
import type { RequestConfig } from './types/common'
import { findMockRoute, executeMock } from '@/mock/handler'
import { getToken, refreshToken, clearToken } from '@/utils/token'

class AxiosAdapter implements RequestAdapter {
  private instance: AxiosInstance

  constructor() {
    this.instance = axios.create({ baseURL: '/api' })
    this.setupInterceptors()
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use((config) => {
      const token = getToken()
      if (token) {
        config.headers.Authorization = `bearer ${token}`
      }
      return config
    })

    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          const newToken = await refreshToken()
          if (newToken) {
            error.config.headers.Authorization = `bearer ${newToken}`
            return this.instance.request(error.config)
          }
          clearToken()
          // 跳转登录页
        }
        return Promise.reject(error.response?.data ?? error)
      },
    )
  }

  async request<TResponse>(config: RequestConfig): Promise<TResponse> {
    const mockRoute = findMockRoute(config.url, config.method)
    if (mockRoute) {
      return executeMock(mockRoute, (config.data ?? config.params ?? {}) as Record<string, unknown>) as TResponse
    }

    const response = await this.instance.request({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
    })
    return response.data
  }
}
```

**移动端** — `src/api/adapter.uni.ts`（uni.request）：
```typescript
import type { RequestAdapter } from './adapter'
import type { RequestConfig } from './types/common'
import { findMockRoute, executeMock } from '@/mock/handler'
import { getToken, refreshToken, clearToken } from '@/utils/token'

class UniAdapter implements RequestAdapter {
  async request<TResponse>(config: RequestConfig): Promise<TResponse> {
    const mockRoute = findMockRoute(config.url, config.method)
    if (mockRoute) {
      return executeMock(mockRoute, (config.data ?? config.params ?? {}) as Record<string, unknown>) as TResponse
    }

    const queryString = config.params
      ? '?' + Object.entries(config.params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
      : ''

    const token = getToken()
    const response = await uni.request({
      url: `/api/${config.url}${queryString}`,
      method: config.method,
      data: config.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `bearer ${token}` } : {}),
      },
    })

    if (response.statusCode === 401) {
      const newToken = await refreshToken()
      if (newToken) {
        return this.request({ ...config, _retry: false })
      }
      clearToken()
      uni.redirectTo({ url: '/pages/login/index' })
    }

    if (response.statusCode >= 400) {
      throw { status: response.statusCode, message: response.data } as ApiError
    }

    return response.data as TResponse
  }
}
```

**统一导出** — `src/api/request.ts`（条件编译选择平台适配器）：
```typescript
import type { RequestConfig } from './types/common'
import type { RequestAdapter } from './adapter'

// #ifdef H5
import { AxiosAdapter } from './adapter.web'
const adapter: RequestAdapter = new AxiosAdapter()
// #endif

// #ifdef MP-WEIXIN
import { UniAdapter } from './adapter.uni'
const adapter: RequestAdapter = new UniAdapter()
// #endif

/** 统一请求入口 —— 业务代码唯一调用的函数 */
export function request<TResponse>(config: RequestConfig): Promise<TResponse> {
  return adapter.request<TResponse>(config)
}
```

### 步骤 3：API 模块文件（src/api/modules/）

这是最核心的部分——每个模块遵循 **类型定义在上，API 函数在下** 的结构。

#### URL 命名规范

| 操作 | URL 模式 | HTTP 方法 | 示例 |
|------|---------|-----------|------|
| 列表查询 | `/api/{endpoint}/{module}/list` | GET | `GET /api/app/order/list` |
| 详情查询 | `/api/{endpoint}/{module}/detail` | GET | `GET /api/app/order/detail?id=1` |
| 创建 | `/api/{endpoint}/{module}/create` | POST | `POST /api/app/order/create` |
| 更新 | `/api/{endpoint}/{module}/update` | POST | `POST /api/app/order/update` |
| 删除 | `/api/{endpoint}/{module}/delete` | POST | `POST /api/app/order/delete` |
| 自定义操作 | `/api/{endpoint}/{module}/{action}` | POST | `POST /api/app/order/cancel` |

#### DTO 命名规范

| 类型 | 命名模式 | 示例 |
|------|---------|------|
| 查询参数 | `{Entity}QueryParams` | `OrderQueryParams` |
| 创建参数 | `{Entity}CreateParams` | `OrderCreateParams` |
| 更新参数 | `{Entity}UpdateParams` | `OrderUpdateParams` |
| 删除参数 | `{Entity}DeleteParams` 或内联 | `{ order_id: number }` |
| 响应实体 | `{Entity}Item` | `OrderItem` |

#### 模块文件模板

创建一个新的 API 模块时，按此模板填充。以 `api/modules/app/order.ts` 为例：

```typescript
// api/modules/app/order.ts

import { request } from '@/api/request'
import type { PaginationParams, PaginatedResponse } from '@/api/types/common'

// ---- 类型定义 ----

/** 订单查询参数 */
interface OrderQueryParams extends PaginationParams {
  status?: string
  order_no?: string
  start_date?: string
  end_date?: string
}

/** 订单创建参数 */
interface OrderCreateParams {
  product_id: number
  quantity: number
  remark?: string
}

/** 订单更新参数 */
interface OrderUpdateParams {
  order_id: number
  status?: string
  remark?: string
}

/** 订单实体 */
interface OrderItem {
  order_id: number
  order_no: string
  product_id: number
  quantity: number
  amount: number
  status: string
  created_at: string
  updated_at: string
}

// ---- API 函数 ----

/** 获取订单列表 */
export function getOrderList(params: OrderQueryParams) {
  return request<PaginatedResponse<OrderItem>>({
    url: '/app/order/list',
    method: 'GET',
    params,
  })
}

/** 获取订单详情 */
export function getOrderDetail(params: { id: number }) {
  return request<OrderItem>({
    url: '/app/order/detail',
    method: 'GET',
    params,
  })
}

/** 创建订单 */
export function createOrder(data: OrderCreateParams) {
  return request<OrderItem>({
    url: '/app/order/create',
    method: 'POST',
    data,
  })
}

/** 更新订单 */
export function updateOrder(data: OrderUpdateParams) {
  return request<void>({
    url: '/app/order/update',
    method: 'POST',
    data,
  })
}

/** 删除订单 */
export function deleteOrder(data: { order_id: number }) {
  return request<void>({
    url: '/app/order/delete',
    method: 'POST',
    data,
  })
}
```

**要点**：
- 类型定义集中在文件顶部，不导出（除非 Mock 需要引用）
- API 函数统一导出，函数名 = `动词 + Entity`（如 `getOrderList`、`createOrder`）
- GET 请求用 `params`，POST 请求用 `data`
- 每个函数的 `request<T>()` 都指定具体返回类型

### 步骤 4：Mock 数据文件（src/mock/data/）

Mock 数据文件与 API 模块严格 1:1 对应，复用 API 模块中的类型定义。

以 `mock/data/app/order.ts` 对应 `api/modules/app/order.ts`：

```typescript
// mock/data/app/order.ts
import type { OrderItem } from '@/api/modules/app/order'

export const mockOrderList: OrderItem[] = [
  {
    order_id: 1,
    order_no: 'ORD202401001',
    product_id: 101,
    quantity: 2,
    amount: 598.00,
    status: 'paid',
    created_at: '2024-01-15T10:30:00',
    updated_at: '2024-01-15T10:35:00',
  },
  {
    order_id: 2,
    order_no: 'ORD202401002',
    product_id: 205,
    quantity: 1,
    amount: 299.00,
    status: 'pending',
    created_at: '2024-01-16T14:20:00',
    updated_at: '2024-01-16T14:20:00',
  },
]

export const mockOrderDetail: OrderItem = {
  order_id: 1,
  order_no: 'ORD202401001',
  product_id: 101,
  quantity: 2,
  amount: 598.00,
  status: 'paid',
  created_at: '2024-01-15T10:30:00',
  updated_at: '2024-01-15T10:35:00',
}
```

**Mock 数据要求**：
- 从对应 API 模块 `import type` 引入类型（如 `OrderItem`），保证类型一致
- 导出 `mock{Entity}List`（列表数据）和 `mock{Entity}Detail`（单条数据）
- 数据内容真实可信，字段值符合业务语义
- 必须满足对应 interface 的所有必填字段

### 步骤 5：Mock 路由注册（src/mock/handler.ts）

每新增一个 Mock 数据文件，需在 `handler.ts` 中注册对应路由。

**Mock 类型** — `src/mock/types.ts`：
```typescript
/** Mock 路由匹配规则 */
interface MockRoute {
  url: string
  method: 'GET' | 'POST'
  handler: (data: Record<string, unknown>) => unknown
}

/** Mock 配置 */
interface MockConfig {
  enabled: boolean
  delay: number
}
```

**路由注册** — `src/mock/handler.ts`（追加新模块路由）：
```typescript
import { MOCK_ENABLED } from '@/config'
import type { MockRoute, MockConfig } from './types'
import type { PaginatedResponse } from '@/api/types/common'
import { mockOrderList, mockOrderDetail } from './data/app/order'
// 按需导入其他 mock 数据...

const config: MockConfig = {
  enabled: MOCK_ENABLED,
  delay: 300,
}

/** 分页工具函数 */
function paginate<T>(list: T[], data: Record<string, unknown>): PaginatedResponse<T> {
  const index = (data.index as number) ?? 1
  const size = (data.size as number) ?? 10
  const start = (index - 1) * size
  return {
    list: list.slice(start, start + size),
    total: list.length,
    index,
    size,
  }
}

/** 所有 Mock 路由注册表 */
const routes: MockRoute[] = [
  // ---- 用户端 - 订单 ----
  {
    url: '/app/order/list',
    method: 'GET',
    handler: (data) => paginate(mockOrderList, data),
  },
  {
    url: '/app/order/detail',
    method: 'GET',
    handler: (data) => {
      const id = data.id as number
      return mockOrderList.find(item => item.order_id === id) ?? mockOrderDetail
    },
  },
  {
    url: '/app/order/create',
    method: 'POST',
    handler: (data) => ({ order_id: Date.now(), ...data }),
  },
  {
    url: '/app/order/update',
    method: 'POST',
    handler: (data) => ({ ...data, updated_at: new Date().toISOString() }),
  },
  {
    url: '/app/order/delete',
    method: 'POST',
    handler: () => null,
  },
  // ---- 新模块在此追加 ----
]

/** 查找匹配的 Mock 路由 */
export function findMockRoute(url: string, method: string): MockRoute | undefined {
  if (!config.enabled) return undefined
  return routes.find(r => r.url === url && r.method === method)
}

/** 执行 Mock 处理 */
export async function executeMock(route: MockRoute, data: Record<string, unknown>): Promise<unknown> {
  await new Promise(resolve => setTimeout(resolve, config.delay))
  return route.handler(data)
}
```

注册新模块路由时，在 `routes` 数组中追加一组路由，URL 和 Method 必须与 API 函数中的 `url` + `method` 完全匹配。

### 步骤 6：配置文件

`src/config/index.ts`：
```typescript
export const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
```

`.env`（开发环境 Mock 开启）：
```
VITE_MOCK=true
VITE_API_BASE_URL=/api
```

`.env.production`（生产环境关闭 Mock）：
```
VITE_MOCK=false
VITE_API_BASE_URL=/api
```

## 认证接口（src/api/modules/app/auth.ts）

认证接口是特殊模块，URL 不遵循 `{endpoint}/{module}/{action}` 模式，使用后端 IdentityServer 的 Connect 端点：

```typescript
import { request } from '@/api/request'

/** 登录请求参数 */
interface LoginParams {
  username: string
  password: string
  scope?: string
}

/** Token 响应 */
interface TokenResponse {
  access_token: string
  refresh_token: string
}

/** 刷新 Token 参数 */
interface RefreshTokenParams {
  refresh_token: string
}

/** 当前用户信息 */
interface CurrentUserResponse {
  user_id: number
  user_name: string
  email?: string
  avatar?: string
  idp: 'password' | 'wechat' | 'tourist' | 'wechatapp'
}

/** 登录 */
export function login(data: LoginParams) {
  return request<TokenResponse>({
    url: '/connect/token',
    method: 'POST',
    data,
  })
}

/** 刷新 Token（Refresh Token 单次使用） */
export function refreshToken(data: RefreshTokenParams) {
  return request<TokenResponse>({
    url: '/connect/token/refresh',
    method: 'POST',
    data,
  })
}

/** 获取当前用户信息 */
export function getCurrentUser() {
  return request<CurrentUserResponse>({
    url: '/app/user/info',
    method: 'GET',
  })
}
```

Token 管理工具 — `src/utils/token.ts`（双平台条件编译）：
```typescript
const TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

// #ifdef H5
function getStorage(key: string): string | null {
  return localStorage.getItem(key)
}
function setStorage(key: string, value: string): void {
  localStorage.setItem(key, value)
}
function removeStorage(key: string): void {
  localStorage.removeItem(key)
}
// #endif

// #ifdef MP-WEIXIN
function getStorage(key: string): string | null {
  return uni.getStorageSync(key) || null
}
function setStorage(key: string, value: string): void {
  uni.setStorageSync(key, value)
}
function removeStorage(key: string): void {
  uni.removeStorageSync(key)
}
// #endif

export function getToken(): string | null {
  return getStorage(TOKEN_KEY)
}

export function setToken(token: string): void {
  setStorage(TOKEN_KEY, token)
}

export function getRefreshToken(): string | null {
  return getStorage(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  setStorage(REFRESH_TOKEN_KEY, token)
}

export function clearToken(): void {
  removeStorage(TOKEN_KEY)
  removeStorage(REFRESH_TOKEN_KEY)
}
```

## 1:1 对应关系检查

修改任何一侧文件时，必须同步修改另一侧：

```
api/modules/app/order.ts      <--->  mock/data/app/order.ts
api/modules/app/auth.ts       <--->  （认证模块通常不需要 Mock）
api/modules/app/product.ts    <--->  mock/data/app/product.ts
api/modules/manager/user.ts   <--->  mock/data/manager/user.ts
api/modules/manager/role.ts   <--->  mock/data/manager/role.ts
```

同步检查清单：
- 新增 API 函数 → 对应 Mock 路由是否存在
- 修改 interface 字段 → Mock 数据是否同步更新
- 新增 API 模块文件 → 对应 Mock 数据文件是否存在
- Mock 数据必须 `import type` 自对应 API 模块，保证类型安全
