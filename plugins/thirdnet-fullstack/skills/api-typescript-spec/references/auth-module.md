# 认证模块（auth.ts）完整实现

> 何时需要读：当你要新增/修改 Admin 模板认证模块、排查 HMAC-SM3 Basic 签名、refreshToken 死循环、或迁移 IdentityServer 写法时再读。普通业务 API 模块无需读。

认证模块同样采用策略工厂模式和文件拆分，Admin 模板的特殊点：
- **应用加密认证（HMAC-SM3 Basic 签名）**：登录 `POST /api/manager/auth/login`、刷新 `POST /api/manager/auth/refresh` 两个端点，请求前必须调用 `signBasicAuth(urlPath)` 生成 `Authorization: Basic ...` 头（见下方实现）；当前用户信息走 `GET /api/manager/auth/info`（普通 Bearer，无需 Basic 签名）。**这是 ThirdNet 后端的应用加密认证，不是 IdentityServer `/connect/token`**——因此**不要**用 `URLSearchParams` / `grant_type` / form-urlencoded，登录体是普通 JSON。
- Token 工具（`src/utils/token.ts`）：Admin Web 端用 `sessionStorage`；若为移动端/小程序则用 `uni.getStorageSync`（双平台适配）。
- 导出 `getToken`、`setToken`、`getRefreshToken`、`setRefreshToken`、`clearToken`

**`api/types/auth.ts`**（精简示意；真实 `CurrentUserResponse` 字段更多——含菜单树 `menus`、角色 `roles`、权限 `permissions` 等，以 `api/interfaces/auth.ts` 为准）：
```typescript
export interface LoginParams { username: string; password: string }
export interface TokenResponse { access_token: string; refresh_token: string }
export interface CurrentUserResponse {
  /* 真实含 user_id、username、nick_name、roles、permissions、menus 等大量字段 */
}
```

**`api/interfaces/auth.ts`**（Admin 模板的 `api/interfaces/` 为扁平结构，无 `manager/` 子目录）：
```typescript
import type { LoginParams, TokenResponse, CurrentUserResponse } from '@/api/types/auth'

export interface IAuthApi {
  login(data: LoginParams): Promise<TokenResponse>
  refreshToken(data: { refresh_token: string }): Promise<TokenResponse>
  getCurrentUser(): Promise<CurrentUserResponse>
}
```

**`api/modules/manager/auth.ts`** — Real 实现调用 `/api/manager/auth/login` + `signBasicAuth` Basic 签名，工厂函数 + 模块实例与普通模块相同：
```typescript
import { request } from '@/api/request'
import { MOCK_ENABLED } from '@/config'
import { signBasicAuth } from '@/utils/basicAuth'
import type { IAuthApi } from '@/api/interfaces/auth'
import type { LoginParams, TokenResponse, CurrentUserResponse } from '@/api/types/auth'
import { MockAuthApi } from '@/mock/api/manager/auth'

// ---- Real 实现（应用加密认证：HMAC-SM3 Basic 签名）----

class RealAuthApi implements IAuthApi {
  /** 登录：POST /api/manager/auth/login，需 Basic 认证签名 */
  async login(data: LoginParams): Promise<TokenResponse> {
    const { url, authHeader } = await signBasicAuth('/api/manager/auth/login')
    return request<TokenResponse>({
      url,                                   // 已含 timestamp 查询参数
      method: 'POST',
      data,                                  // JSON body: { username, password }
      headers: { Authorization: authHeader }, // Basic base64(app:signature)
      skipAuthRefresh: true,                 // 登录失败(401)=凭据错误，不触发刷新循环
    })
  }
  /** 刷新：POST /api/manager/auth/refresh，同样需 Basic 签名 */
  async refreshToken(data: { refresh_token: string }): Promise<TokenResponse> {
    const { url, authHeader } = await signBasicAuth('/api/manager/auth/refresh')
    return request<TokenResponse>({
      url,
      method: 'POST',
      data,                                  // JSON body: { refresh_token }
      headers: { Authorization: authHeader },
      skipAuthRefresh: true,                 // refresh 自身 401 表示 refresh_token 也过期
    })
  }
  /** 当前用户：GET /api/manager/auth/info（普通 Bearer，无需 Basic 签名） */
  async getCurrentUser(): Promise<CurrentUserResponse> {
    return request<CurrentUserResponse>({ url: '/api/manager/auth/info', method: 'GET' })
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
- 登录 / 刷新走 `/api/manager/auth/login`、`/api/manager/auth/refresh`，请求前用 `signBasicAuth(urlPath)` 生成 `Basic ...` 头（HMAC-SM3 签名，国密）；`signBasicAuth` 会返回带 `timestamp` 查询参数的 url 与对应 `Authorization` 头
- 请求体是普通 JSON（`{ username, password }` / `{ refresh_token }`），**不是** form-urlencoded，也**没有** `grant_type`
- `login`/`refreshToken` 必须设 `skipAuthRefresh: true`——否则 401 会触发"刷新 → 再 401 → 再刷新"死循环
- `getCurrentUser` 走 `/api/manager/auth/info`，普通 Bearer 即可
- 工厂函数和模块单例结构与普通模块完全一致

**`mock/api/manager/auth.ts`** — Mock 实现返回固定 token：
```typescript
import type { IAuthApi } from '@/api/interfaces/auth'
import type { TokenResponse, CurrentUserResponse } from '@/api/types/auth'
import { mockCurrentUser } from '@/mock/data/manager/auth'

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

**`mock/data/manager/auth.ts`** — Mock 数据：
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
