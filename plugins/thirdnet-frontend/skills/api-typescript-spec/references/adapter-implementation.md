# 请求适配器参考实现

> 何时需要读：当你要实现或修改 `adapter.uni.ts` / `adapter.web.ts`，或排查 uniapp 双平台请求/401 跳转问题时再读。日常新建 API 模块无需读。

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
