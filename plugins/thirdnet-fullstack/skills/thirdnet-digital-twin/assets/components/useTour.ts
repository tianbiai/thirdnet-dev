/**
 * useTour.ts —— 航拍巡航开关模块级单例（v2.2 范式文件，拷贝到 src/composables/useTour.ts）。
 *
 * 契约出处：references/scene-recipe.md §13——航拍巡航（auto-orbit 展示）的单一数据源。
 * 与 useSelection 同模式：TourToggleButton 读/写这里的 enabled；GlobalTwin 用
 * watch(enabled → scene.setTourEnabled) 单向推回场景；ParkScene 检测到用户拖拽时
 * 回调 onTourAutoExit → disable()，保持按钮态与引擎态同步（不在指针回调里直接改 UI）。
 *
 * 巡航参数（speed/elevation/framingK/pauseOnInteract）来自 spec.cameraTour，由
 * generate_data.py 写进 ParkScaffold 静态脚手架，ParkScene 构造期读取；本单例只管「开/关」布尔。
 */
import { ref } from 'vue'

const enabled = ref(false) // 是否处于航拍巡航态（false = 默认取景，用户自由操控）

function enable() {
  enabled.value = true
}
function disable() {
  enabled.value = false
}
function toggle() {
  enabled.value = !enabled.value
}

export function useTour() {
  return { enabled, enable, disable, toggle }
}
