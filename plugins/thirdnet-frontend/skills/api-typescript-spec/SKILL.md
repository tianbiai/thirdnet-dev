---
name: api-typescript-spec
description: |
  前端 API 接口及 Mock 接口的 TypeScript 全流程规范。指导创建类型安全的 API 模块文件（类型定义 + 请求函数）、对应的 Mock 数据文件、请求适配器（双平台 Axios/uni.request）、以及认证接口。
  当用户需要创建 API 接口、添加接口模块、编写 Mock 数据、定义请求类型、设置 API 层架构、或任何涉及 api/modules/ 和 mock/data/ 目录的操作时，必须使用此 skill。
  关键触发词：API、接口、Mock、请求、adapter、request、类型定义、DTO、分页、认证、登录、token。
compatibility: Vue 3 + TypeScript + Vite 项目，支持 Web（Element Plus）和移动端（uniapp + Vant，发布为微信小程序 mp-weixin）
---

# 前端 API 接口及 Mock 接口 TypeScript 规范

API 层完整 TypeScript 规范，覆盖类型定义、请求适配器、API 模块、Mock 系统。所有 API 模块文件与 Mock 数据文件严格 1:1 对应。

## 核心约定

来自后端架构和网关限制，不可违反：

1. **仅 GET / POST**：网关限制，不使用 PUT/DELETE/PATCH
2. **字段名 snake_case**：与后端 DTO 一致（如 `order_id`、`created_at`）
3. **响应无包装**：成功直接返回实体 JSON 或 `PaginatedResponse<T>`，不用 `{ code, message, data }` 包装
4. **错误走 HTTP 状态码**：通过 401/403/404/500 等区分错误
5. **API 与 Mock 1:1**：`api/modules/{endpoint}/{module}.ts` 对应 `mock/data/{endpoint}/{module}.ts`

## 目录结构

```
src/
├── config/index.ts                    # MOCK_ENABLED、API_BASE_URL
├── api/
│   ├── types/common.ts               # 基础类型
│   ├── adapter.ts                     # RequestAdapter 接口
│   ├── adapter.web.ts                 # Axios 实现
│   ├── adapter.uni.ts                 # uni.request 实现
│   ├── request.ts                     # 统一 request<T>() 导出
│   └── modules/{app|manager}/         # API 模块（按端点分目录）
├── mock/
│   ├── types.ts                       # MockRoute、MockConfig
│   ├── handler.ts                     # 路由注册表 + findMockRoute + executeMock
│   └── data/{app|manager}/            # 与 api/modules/ 1:1 对应
├── utils/token.ts                     # Token 存取（双平台适配）
```

端点标识：`app`（用户端）、`manager`（管理端），对应后端 Controller 目录。

## 创建步骤

### 步骤 1：基础类型（src/api/types/common.ts）

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
interface SortParams { sort_by?: string; sort_order?: 'asc' | 'desc' }
```

### 步骤 2：请求适配器（src/api/）

适配器层实现双平台统一，业务代码只调用 `request<T>()`。

**接口定义** — `adapter.ts`：
```typescript
interface RequestAdapter {
  request<TResponse>(config: RequestConfig): Promise<TResponse>
}
```

**适配器实现要点**（`adapter.web.ts` 用 Axios，`adapter.uni.ts` 用 uni.request）：
- 请求拦截：从 storage 读取 token，添加 `Authorization: bearer {token}` 头
- 401 处理：尝试 refreshToken，失败则 clearToken 并跳转登录页
- Mock 优先：调用 `findMockRoute(url, method)` 检查是否有 Mock 路由，有则走 Mock
- uni.request 需手动拼接 query string，错误判断用 `statusCode >= 400`

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

### 步骤 3：API 模块文件（src/api/modules/）

核心结构：**类型定义在上，API 函数在下**。

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

#### 模块文件模板（以 app/order.ts 为例）

```typescript
import { request } from '@/api/request'
import type { PaginationParams, PaginatedResponse } from '@/api/types/common'

// ---- 类型定义 ----
interface OrderQueryParams extends PaginationParams {
  status?: string; order_no?: string; start_date?: string; end_date?: string
}
interface OrderCreateParams { product_id: number; quantity: number; remark?: string }
interface OrderUpdateParams { order_id: number; status?: string; remark?: string }
interface OrderItem {
  order_id: number; order_no: string; product_id: number; quantity: number
  amount: number; status: string; created_at: string; updated_at: string
}

// ---- API 函数 ----
export function getOrderList(params: OrderQueryParams) {
  return request<PaginatedResponse<OrderItem>>({ url: '/app/order/list', method: 'GET', params })
}
export function getOrderDetail(params: { id: number }) {
  return request<OrderItem>({ url: '/app/order/detail', method: 'GET', params })
}
export function createOrder(data: OrderCreateParams) {
  return request<OrderItem>({ url: '/app/order/create', method: 'POST', data })
}
export function updateOrder(data: OrderUpdateParams) {
  return request<void>({ url: '/app/order/update', method: 'POST', data })
}
export function deleteOrder(data: { order_id: number }) {
  return request<void>({ url: '/app/order/delete', method: 'POST', data })
}
```

**要点**：
- 类型定义集中在文件顶部，不导出（除非 Mock 需要引用）
- 函数名 = `动词 + Entity`（如 `getOrderList`、`createOrder`）
- GET 用 `params`，POST 用 `data`；每个函数都指定具体返回类型

### 步骤 4：Mock 数据文件（src/mock/data/）

与 API 模块 1:1 对应，复用类型定义：

```typescript
// mock/data/app/order.ts
import type { OrderItem } from '@/api/modules/app/order'

export const mockOrderList: OrderItem[] = [
  { order_id: 1, order_no: 'ORD202401001', product_id: 101, quantity: 2,
    amount: 598.00, status: 'paid', created_at: '2024-01-15T10:30:00', updated_at: '2024-01-15T10:35:00' },
  { order_id: 2, order_no: 'ORD202401002', product_id: 205, quantity: 1,
    amount: 299.00, status: 'pending', created_at: '2024-01-16T14:20:00', updated_at: '2024-01-16T14:20:00' },
]

export const mockOrderDetail: OrderItem = mockOrderList[0]
```

**要求**：`import type` 引入类型保证一致；导出 `mock{Entity}List` + `mock{Entity}Detail`；数据真实可信，满足所有必填字段。

### 步骤 5：Mock 路由注册（src/mock/handler.ts）

**类型** — `mock/types.ts`：
```typescript
interface MockRoute { url: string; method: 'GET' | 'POST'; handler: (data: Record<string, unknown>) => unknown }
interface MockConfig { enabled: boolean; delay: number }
```

**路由注册** — 在 `handler.ts` 的 `routes` 数组中追加（URL + Method 必须与 API 函数完全匹配）：
```typescript
import { mockOrderList } from './data/app/order'

// 分页工具
function paginate<T>(list: T[], data: Record<string, unknown>): PaginatedResponse<T> {
  const index = (data.index as number) ?? 1, size = (data.size as number) ?? 10
  const start = (index - 1) * size
  return { list: list.slice(start, start + size), total: list.length, index, size }
}

const routes: MockRoute[] = [
  { url: '/app/order/list',   method: 'GET',  handler: (d) => paginate(mockOrderList, d) },
  { url: '/app/order/detail', method: 'GET',  handler: (d) => mockOrderList.find(i => i.order_id === d.id) },
  { url: '/app/order/create', method: 'POST', handler: (d) => ({ order_id: Date.now(), ...d }) },
  { url: '/app/order/update', method: 'POST', handler: (d) => ({ ...d, updated_at: new Date().toISOString() }) },
  { url: '/app/order/delete', method: 'POST', handler: () => null },
]
```

`findMockRoute(url, method)` 在 `config.enabled` 时查找匹配路由；`executeMock` 延迟 `config.delay` 毫秒后执行 handler。

### 步骤 6：配置

```typescript
// src/config/index.ts
export const MOCK_ENABLED = import.meta.env.VITE_MOCK === 'true'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'
```

`.env`：`VITE_MOCK=true` | `.env.production`：`VITE_MOCK=false`

## 认证接口（src/api/modules/app/auth.ts）

特殊模块，使用后端 IdentityServer Connect 端点：

```typescript
import { request } from '@/api/request'

interface LoginParams { username: string; password: string; scope?: string }
interface TokenResponse { access_token: string; refresh_token: string }
interface CurrentUserResponse {
  user_id: number; user_name: string; email?: string; avatar?: string
  idp: 'password' | 'wechat' | 'tourist' | 'wechatapp'
}

export function login(data: LoginParams) {
  return request<TokenResponse>({ url: '/connect/token', method: 'POST', data })
}
export function refreshToken(data: { refresh_token: string }) {
  return request<TokenResponse>({ url: '/connect/token/refresh', method: 'POST', data })
}
export function getCurrentUser() {
  return request<CurrentUserResponse>({ url: '/app/user/info', method: 'GET' })
}
```

**Token 工具**（`src/utils/token.ts`）：双平台条件编译，H5 用 `localStorage`，MP-WEIXIN 用 `uni.getStorageSync`。导出 `getToken`、`setToken`、`getRefreshToken`、`setRefreshToken`、`clearToken`。

## 1:1 对应关系

修改任一侧必须同步另一侧：

```
api/modules/app/order.ts      <--->  mock/data/app/order.ts
api/modules/manager/user.ts   <--->  mock/data/manager/user.ts
```

**同步检查**：新增 API 函数 → Mock 路由是否存在 | 修改 interface → Mock 数据同步 | 新增模块文件 → Mock 文件是否存在 | Mock 数据必须 `import type` 自 API 模块
