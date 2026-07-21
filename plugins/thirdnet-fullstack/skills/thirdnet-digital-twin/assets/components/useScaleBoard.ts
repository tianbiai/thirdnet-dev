/**
 * useScaleBoard.ts —— 1920×1080 固定舞台信箱式缩放（v2.1 范式文件，
 * 拷贝到 src/composables/useScaleBoard.ts）。
 *
 * 契约出处：references/shell.md——舞台永远保持 16:9，按
 * Math.min(innerW/1920, innerH/1080) 等比缩放，portrait 上下留黑、超宽左右留黑，
 * 绝不重排；resize 必须防抖 ~150ms（拖拽窗口时每帧重算会卡）。
 * 最小支持视口 1280×720（低于此仍缩放，由调用方提示「建议 1920×1080 及以上」）。
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useScaleBoard(designWidth = 1920, designHeight = 1080) {
  const scale = ref(1)
  const tooSmall = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const update = () => {
    scale.value = Math.min(window.innerWidth / designWidth, window.innerHeight / designHeight)
    tooSmall.value = window.innerWidth < 1280 || window.innerHeight < 720
  }
  const onResize = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(update, 150) // 防抖 150ms（契约）
  }

  onMounted(() => {
    update()
    window.addEventListener('resize', onResize)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    if (timer) clearTimeout(timer)
  })

  return { scale, tooSmall, designWidth, designHeight }
}
