// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/config/index.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §10b。

export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === 'true'   // 字符串 "true"/"false"
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''        // 默认同源，靠 vite proxy 转发 /api
