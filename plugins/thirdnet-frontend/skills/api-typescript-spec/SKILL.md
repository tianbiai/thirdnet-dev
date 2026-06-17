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
  version: "2.1.0"
  author: thirdnet
---

> **兼容性**：Vue 3 + TypeScript + Vite 项目，支持 Web（Element Plus）和移动端（uniapp + Vant，发布为微信小程序 mp-weixin）。

# 前端 API 接口 TypeScript 规范（策略工厂模式）

API 层采用**接口契约的策略工厂模式**，通过 TypeScript 接口定义 API 契约，Real 和 Mock 作为可互换的策略实现，工厂函数根据 `.env` 配置自动选择具体实例。每个模块的职责拆分到独立文件：类型定义、接口契约、真实实现、Mock 数据、Mock 实现各占一个文件。

## 核心约定

来自后端架构和网关限制，不可违反：

1. **仅 GET / POST**：网关限制，不使用 PUT/DELETE/PATCH。禁止在 request.ts 中导出 PUT/DELETE/PATCH 的便捷方法。adapter 接口中的 HttpMethod 类型应限定为 `'GET' | 'POST'`
2. **字段名强制 snake_case**：所有 API 入参、出参、Mock 数据的字段名必须使用 `snake_case`（如 `order_id`、`created_at`、`user_name`），与后端 DTO 保持一致，**禁止使用 camelCase**
3. **响应无包装**：成功直接返回实体 JSON 或 `PaginatedResponse<T>`，不用 `{ code, message, data }` 包装
4. **错误走 HTTP 状态码**：通过 401/403/404/500 等区分错误
5. **API 与 Mock 文件对应**：`api/modules/{endpoint}/{module}.ts` 对应 `mock/api/{endpoint}/{module}.ts` + `mock/data/{endpoint}/{module}.ts`
6. **全面 TypeScript**：所有前端代码必须使用 `.ts` 扩展名，Vue 组件必须使用 `<script setup lang="ts">`
7. **TS 枚举仅用于纯前端常量**：仅当某选项集是**纯前端常量**（不来自后端字典、不会由运营改动）时，才定义 TS `enum`（每个成员加 JSDoc，禁止 union type / const object 替代）。**后端字典驱动字段不定义 TS enum**：枚举字典（`dict_source=0`，int）下拉走 `useDict(dictType)`、显示走后端 `*_label`、提交 number；自定义字典（`dict_source=1`，string）走 `dictApi.getDictDataByType`、提交 string。这类字段的 TS 类型直接用 `number` 或 `string`。详见 `vue-enum-dict` 技能

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
  url: string
  method: 'GET' | 'POST'
  data?: TData
  params?: Record<string, unknown>
  headers?: Record<string, string>  // 自定义请求头（如 Basic 认证头），与默认头合并
  endpoint?: Endpoint  // 可选，当 url 为相对路径时由适配器拼接为 /api/{endpoint}{url}；当 url 已包含完整前缀时忽略此字段
}

interface ApiError { status: number; message: string }
```

**枚举规范**：仅纯前端常量才用 TS `enum`（见核心约定 #7）。命名格式 `{Entity}{Property}Enum`，每个成员加 JSDoc。通用枚举放 `api/types/enums.ts`，模块专属枚举放 `api/types/{module}.ts`。

> ⚠️ **后端字典驱动字段不要定义 TS enum**：枚举字典（int）/ 自定义字典（string）字段类型直接写 `number`/`string`，选项走 `useDict`/`getDictDataByType`，显示走后端 `*_label`。详见 `vue-enum-dict` 技能。

下面是**纯前端常量枚举**示例（不依赖后端字典）：

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

**`adapter.uni.ts` 参考实现**：
```typescript
import type { RequestAdapter, RequestConfig } from './adapter'
import type { ApiError } from '@/api/types/common'
import { getToken, clearToken } from '@/utils/token'

export class UniAdapter implements RequestAdapter {
  async request<TResponse>(config: RequestConfig): Promise<TResponse> {
    const token = getToken()
    const header: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `bearer ${token}` } : {}),
    }

    // 拼接 URL（处理 GET 请求的 query string）
    let url = config.url
    if (config.method === 'GET' && config.params) {
      const qs = Object.entries(config.params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
      if (qs) url += (url.includes('?') ? '&' : '?') + qs
    }

    return new Promise<TResponse>((resolve, reject) => {
      uni.request({
        url,
        method: config.method,
        data: config.data,
        header,
        success: (res) => {
          if (res.statusCode === 401) {
            clearToken()
            uni.reLaunch({ url: '/pages/login/index' })
            reject({ status: 401, message: '登录已过期' } as ApiError)
            return
          }
          if ((res.statusCode ?? 0) >= 400) {
            reject({ status: res.statusCode, message: `请求失败: ${res.statusCode}` } as ApiError)
            return
          }
          resolve(res.data as TResponse)
        },
        fail: (err) => {
          reject({ status: 0, message: err.errMsg || '网络请求失败' } as ApiError)
        },
      })
    })
  }
}
```

**要点**：
- `uni.request` 不像 Axios 自动处理 query string，GET 请求需要手动拼接
- 错误通过 `statusCode` 判断（不是 Axios 的 `response.status`）
- 401 处理使用 `uni.reLaunch` 跳转登录页（不能用 `router.push`，小程序端无 window/router）

**uniapp 项目适配器选择**：对于纯 uniapp 项目（同时编译 H5 和 MP-WEIXIN），两个平台均使用 `UniAdapter`，无需条件编译选择适配器。条件编译仅在 `token.ts` 等需要区分 `localStorage` 和 `uni.getStorageSync` 的场景中使用。

**统一导出** — `request.ts`（根据项目类型选择）：

**场景 A：纯 uniapp 项目**（H5 + 小程序均走 uni.request）：
```typescript
import { UniAdapter } from './adapter.uni'
const adapter: RequestAdapter = new UniAdapter()

export function request<TResponse>(config: RequestConfig): Promise<TResponse> {
  return adapter.request<TResponse>(config)
}
```

**场景 B：双平台项目**（Web 端用 Axios，小程序端用 uni.request）：
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
// 以下为「纯前端常量」枚举示例（不依赖后端字典）。若 status 实际来自后端枚举字典，
// 则此处不要建 TS enum，改用 number + useDict（见 vue-enum-dict 技能）。

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
- TS enum 仅用于纯前端常量；若字段来自后端枚举字典，类型直接用 `number` + `useDict` 取下拉（见 `vue-enum-dict`）

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

生产构建（`vite build`）时，通过自定义 Vite 插件 `mockDataStripPlugin()`（`vite.config.ts`）剥离 Mock 数据，配合 `MOCK_ENABLED` 静态为 `false` 让 Mock 分支成为死代码被 tree-shaking 移除。

**真实机制**（与 `vite.config.ts` 一致，不是 alias 重定向）：

```typescript
// 仅在 command === 'build' 时启用
function mockDataStripPlugin(): Plugin {
  return {
    name: 'mock-data-strip',
    enforce: 'pre',
    resolveId(source, importer) {
      // 只拦截路径含 /mock/data/ 的导入
      if (!source.includes('/mock/data/')) return null
      // 解析到虚拟桩模块 ID
      return '\0mock-stub:' + resolvedPath
    },
    load(id) {
      if (!id.startsWith('\0mock-stub:')) return null
      // 读取原 mock 数据文件，提取所有 export 的名称
      const names = [...content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g)].map(m => m[1])
      // 为每个具名导出生成空数组桩（死代码分支不会实际使用）
      return names.map(n => `export const ${n} = []`).join('\n') // 无具名导出则返回 'export {}'
    },
  }
}
```

**原理**：生产构建时，所有 `/mock/data/**` 的导入被 `mockDataStripPlugin` 拦截，替换为"每个具名导出 = 空数组"的虚拟桩模块（不是空对象、也不重定向整个 `@/mock`）。由于 `MOCK_ENABLED` 静态为 `false`，工厂函数中 `new MockXxxApi()` 所在分支不可达，Rollup tree-shaking 移除该分支；Mock 数据本身已被桩替换为空数组，最终产物中不含真实 Mock 数据。**注意**：拦截范围是 `/mock/data/`（Mock 数据文件），不含 `/mock/api/`；Mock API 类的剥离依赖 `MOCK_ENABLED=false` + tree-shaking。开发模式下插件不启用，Mock 模块正常加载。

**切换流程**：通过环境变量 `VITE_MOCK_ENABLED`（开发期 `.env`）控制，无需手动改配置。工厂函数在模块初始化时执行一次，运行期间不再切换。

## 认证模块（`auth.ts`）

认证模块同样采用策略工厂模式和文件拆分，特殊点：
- 使用后端 IdentityServer Connect 端点（`/connect/token`）
- Token 工具（`src/utils/token.ts`）：H5 用 `localStorage`，MP-WEIXIN 用 `uni.getStorageSync`
- 导出 `getToken`、`setToken`、`getRefreshToken`、`setRefreshToken`、`clearToken`

**`api/types/auth.ts`**：
```typescript
export interface LoginParams { username: string; password: string; scope?: string }
export interface TokenResponse { access_token: string; refresh_token: string }
export interface CurrentUserResponse { user_id: number; username: string; role: string }
```

**`api/interfaces/app/auth.ts`**：
```typescript
import type { LoginParams, TokenResponse, CurrentUserResponse } from '@/api/types/auth'

export interface IAuthApi {
  login(data: LoginParams): Promise<TokenResponse>
  refreshToken(data: { refresh_token: string }): Promise<TokenResponse>
  getCurrentUser(): Promise<CurrentUserResponse>
}
```

**`api/modules/app/auth.ts`** — Real 实现调用 `/connect/token`，工厂函数 + 模块实例与普通模块相同：
```typescript
import { request } from '@/api/request'
import { MOCK_ENABLED } from '@/config'
import type { IAuthApi } from '@/api/interfaces/app/auth'
import type { LoginParams, TokenResponse, CurrentUserResponse } from '@/api/types/auth'
import { MockAuthApi } from '@/mock/api/app/auth'

// ---- Real 实现（调用 IdentityServer Connect 端点）----

class RealAuthApi implements IAuthApi {
  async login(data: LoginParams): Promise<TokenResponse> {
    // IdentityServer /connect/token 端点要求 form-urlencoded
    const body = new URLSearchParams()
    body.append('username', data.username)
    body.append('password', data.password)
    body.append('grant_type', 'password')
    if (data.scope) body.append('scope', data.scope)
    return request<TokenResponse>({
      url: '/connect/token', method: 'POST', data: Object.fromEntries(body),
    })
  }
  async refreshToken(data: { refresh_token: string }): Promise<TokenResponse> {
    const body = new URLSearchParams()
    body.append('refresh_token', data.refresh_token)
    body.append('grant_type', 'refresh_token')
    return request<TokenResponse>({
      url: '/connect/token', method: 'POST', data: Object.fromEntries(body),
    })
  }
  async getCurrentUser(): Promise<CurrentUserResponse> {
    return request<CurrentUserResponse>({ url: '/app/auth/current-user', method: 'GET' })
  }
}

// ---- 工厂函数（Simple Factory）----

export function createAuthApi(): IAuthApi {
  return MOCK_ENABLED ? new MockAuthApi() : new RealAuthApi()
}

// ---- 模块实例（模块级单例）----

export const authApi = createAuthApi()
```

**要点**：
- IdentityServer `/connect/token` 端点要求 `application/x-www-form-urlencoded` 格式，Real 实现使用 `URLSearchParams` 构建
- `login` 和 `refreshToken` 都走同一个 `/connect/token` 端点，通过 `grant_type` 区分
- 工厂函数和模块单例结构与普通模块完全一致

**`mock/api/app/auth.ts`** — Mock 实现返回固定 token：
```typescript
import type { IAuthApi } from '@/api/interfaces/app/auth'
import type { TokenResponse, CurrentUserResponse } from '@/api/types/auth'
import { mockCurrentUser } from '@/mock/data/app/auth'

export class MockAuthApi implements IAuthApi {
  async login(): Promise<TokenResponse> {
    // Mock 模式直接返回固定 token，无需校验用户名密码
    return { access_token: 'mock_access_token_12345', refresh_token: 'mock_refresh_token_12345' }
  }
  async refreshToken(): Promise<TokenResponse> {
    return { access_token: 'mock_access_token_refreshed', refresh_token: 'mock_refresh_token_refreshed' }
  }
  async getCurrentUser(): Promise<CurrentUserResponse> {
    return mockCurrentUser
  }
}
```

**要点**：
- Mock 登录不校验凭据，直接返回固定 token，开发阶段无需真实账号
- 实现 `IAuthApi` 接口，方法签名与接口契约一致

**`mock/data/app/auth.ts`** — Mock 数据：
```typescript
import type { CurrentUserResponse } from '@/api/types/auth'

export const mockCurrentUser: CurrentUserResponse = {
  user_id: 1,
  username: 'admin',
  role: 'Administrator',
}
```

**要点**：
- 只导出 Mock 数据，不包含任何逻辑
- `import type` 引入类型保持一致性

## 文件对应关系

每个 API 模块由 5 个文件组成，修改任一文件需检查关联文件是否需要同步：

```
api/types/order.ts            ← 类型定义（枚举 + 出入参）
api/interfaces/app/order.ts   ← 接口契约（IXxxApi）
api/modules/app/order.ts      ← Real 实现 + 工厂 + 单例
mock/api/app/order.ts         ← Mock 实现
mock/data/app/order.ts        ← Mock 数据
```

同步检查项：
- 新增接口方法 → `api/interfaces/` 增方法签名 → `api/modules/` Real 实现同步 → `mock/api/` Mock 实现同步
- 修改方法签名（参数或返回值）→ `api/types/` 类型同步 → 所有引用该类型的文件同步
- 修改枚举值 → `api/types/` 同步 → `mock/data/` 数据引用同步
- 新增模块 → 5 个文件全部创建

## 页面调用

### Admin 模板项目：使用 useCrudTable（推荐）

Admin 模板项目提供了 `useCrudTable` composable，封装了分页、搜索、加载、删除等全部 CRUD 列表页样板逻辑，禁止手写 `usePagination + useActionLoading + debounced search` 模式。

```typescript
import { orderApi } from '@/api/modules/app/order'
import type { OrderItem, OrderQueryParams } from '@/api/types/order'
import { useCrudTable } from '@/composables/useCrudTable'

const {
  loading, tableData, queryParams, pagination,
  handleCurrentChange, handleSizeChange,
  isLoading, isAnyLoading, withLoading,
  loadTable, search, reset, remove,
} = useCrudTable<OrderItem, OrderQueryParams>({
  fetch: (p) => orderApi.getOrderList(p),
  defaultQuery: { status: undefined, order_no: '' },
})

// 删除（内置 confirmAction 确认 + 操作锁 + 成功提示 + 刷新）
async function handleDelete(row: OrderItem) {
  await remove(row, {
    id: row.id,
    confirmMessage: `确认删除订单「${row.order_no}」？`,
    api: orderApi.remove,
  })
}
```

> **完整 CRUD 页面开发指南**参见 `admin-template-setup` 技能的 [crud-page-development-guide](../admin-template-setup/references/crud-page-development-guide.md)。

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
