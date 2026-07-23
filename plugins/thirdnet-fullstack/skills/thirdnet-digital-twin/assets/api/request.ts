// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/request.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §10b。
// 独立项目最小封装（admin 模板项目复用其自带 request.ts，不生成此文件）。

import { API_BASE_URL } from '@/config'

export interface RequestConfig<TData = unknown> {
  url: string                 // 完整路径，如 /api/manager/park/buildings
  method: 'GET' | 'POST'
  params?: object                // 接受具名查询接口（*QueryParams）；TS 接口无隐式索引签名，故用 object 而非 Record
  data?: TData
  headers?: Record<string, string>
  signal?: AbortSignal         // v1.8: 请求取消（防 race）；透传给 fetch
  timeoutMs?: number           // v1.8: 超时（默认 15000），超时抛 ApiError(0, '请求超时')
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function request<T>(config: RequestConfig): Promise<T> {
  const { url, method, params, data, headers, signal, timeoutMs = 15000 } = config
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params as Record<string, unknown>)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  // v1.8: 超时——用 AbortController 合并调用方 signal 与超时 signal，任一触发即中止。
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs)
  if (signal) signal.addEventListener('abort', () => ctrl.abort((signal as AbortSignal & { reason?: unknown }).reason))
  try {
    const resp = await fetch(`${API_BASE_URL}${url}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'POST' ? JSON.stringify(data) : undefined,
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try { const e = await resp.json(); msg = e.error_description ?? e.error ?? msg } catch { /* 非 JSON 错误体 */ }
      throw new ApiError(resp.status, msg)
    }
    if (resp.status === 204) return undefined as T
    return resp.json() as Promise<T>
  } catch (e: unknown) {
    // 区分「调用方主动取消」与「超时/网络错误」——前者静默（调用方 onCleanup 已处理），后者抛 ApiError
    if (signal?.aborted) throw e
    const name = (e as { name?: string } | null | undefined)?.name
    const message = (e as { message?: string } | null | undefined)?.message
    if (name === 'AbortError') throw new ApiError(0, '请求超时')
    throw new ApiError(0, message ?? '网络错误')
  } finally {
    clearTimeout(timer)
  }
}
