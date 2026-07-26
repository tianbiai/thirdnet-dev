/**
 * useStyle.ts —— v2.12 多风格实时切换单例。
 *
 * 与 useSelection/useTour 同样的「模块级 ref 单例」模式：避免每个组件都开独立状态。
 * setStyle() 同时调 applyTheme（ParkScene 3D 侧）+ applyCssVars（CSS 变量注入），
 * 让 4 风格切换零成本（无需重新加载页面）。
 *
 * 用法：
 *   const style = useStyle()
 *   style.setStyle('realistic')   // 切到写实
 *   style.current.value             // 读当前风格
 *   style.available.value           // 读可切换列表（来自 spec.previewStyles）
 */
import { ref } from 'vue'
import { applyCssVars, applyTheme, type StyleKey } from '@/utils/theme'

// v2.18：StyleSwitcher.vue 从本模块取 StyleKey——显式再导出保持单一来源（@/utils/theme），避免 TS2459。
export type { StyleKey } from '@/utils/theme'

const DEFAULT_STYLE: StyleKey = 'cyber'

// 模块级单例：所有组件共享同一份状态（避免 4 风格切换器多个实例各说各话）
const current = ref<StyleKey>(DEFAULT_STYLE)
const available = ref<StyleKey[]>([DEFAULT_STYLE])

// 「应用某风格的 token 到 :root CSS 变量」是单一概念，init/setStyle 共用，避免重复链 + cast。
const applyStyleVars = (s: StyleKey) =>
  applyCssVars(applyTheme(s) as unknown as Record<string, unknown>)

/**
 * 注入初始化参数。组件挂载时调一次（一般由 GlobalTwin.vue 调）。
 * initialStyle 来自 spec.style；available 来自 spec.previewStyles（缺省 = 仅 spec.style）。
 */
export function initStyle(initial: StyleKey, list?: string[]) {
  current.value = initial
  available.value = (list && list.length ? list : [initial]) as StyleKey[]
  // 立刻同步应用（双保险——GlobalTwin 已 applyTheme 过）
  applyStyleVars(current.value)
}

export function useStyle() {
  return {
    current,
    available,
    setStyle(next: StyleKey) {
      if (current.value === next) return
      current.value = next
      // 1. ParkScene 3D 侧（材质/灯光/背景）
      applyStyleVars(next)
      // 2. 通知所有监听者（ParkScene 自身会 watch 重新构造材质；StyleSwitcher 反向高亮当前）
      //    注：setStyle 的 3D 侧应用由 GlobalTwin.vue 内 watch(current) 推回 scene.setStyle
    },
  }
}
