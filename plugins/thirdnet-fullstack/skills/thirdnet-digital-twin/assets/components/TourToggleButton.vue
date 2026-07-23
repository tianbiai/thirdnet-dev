<!--
  TourToggleButton.vue —— 航拍巡航开关（v2.2 范式文件，拷贝到 src/components/center/TourToggleButton.vue）。

  契约出处：references/scene-recipe.md §13 + references/shell.md（a11y）。
  读/写 useTour.enabled（模块级单例）；GlobalTwin watch(enabled → scene.setTourEnabled) 推回场景。
  CSS 全走 var(--twin-ui-*)（与 LegendPanel/BuildingSwitcher 同款观感旋钮），零 hex 字面量。
  prefers-reduced-motion 下整按钮禁用（autoRotate 是运动，须与 §8 tween/呼吸动画同纪律禁用）。
-->
<template>
  <button
    type="button"
    class="tour-btn"
    :class="{ 'tour-btn--on': tour.enabled.value }"
    role="switch"
    :aria-checked="tour.enabled.value"
    :aria-disabled="reducedMotion"
    :disabled="reducedMotion"
    :title="reducedMotion ? '系统已开启减少动态效果，航拍巡航不可用' : '航拍巡航：相机自动环绕园区'"
    @click="tour.toggle()"
  >
    <span class="tour-btn__icon" aria-hidden="true">✈</span>
    <span class="tour-btn__label">{{ tour.enabled.value ? '巡航中' : '航拍巡航' }}</span>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useTour } from '@/composables/useTour'

const tour = useTour()
// reduced-motion：autoRotate 是连续运动，整按钮禁用（与 §8 tween/呼吸动画同纪律）。
// 在 onMounted 里读取并监听变化（顶层直接读 window 在 SSR 下会炸；本技能虽纯 CSR，仍按生命周期规范走）。
const reducedMotion = ref(false)
let mql: MediaQueryList | null = null
const onMqlChange = () => { reducedMotion.value = mql?.matches ?? false }
onMounted(() => {
  mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = mql.matches
  mql.addEventListener('change', onMqlChange)
})
onBeforeUnmount(() => mql?.removeEventListener('change', onMqlChange))
</script>

<style scoped>
.tour-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.85) * 100%), transparent);
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
  color: var(--twin-palette-text-mid);
  font-size: 12px;
  font-family: var(--twin-fonts-zh), sans-serif;
  cursor: pointer;
  user-select: none;
  transition: box-shadow 0.2s, color 0.2s, border-color 0.2s;
}
.tour-btn:hover {
  box-shadow: 0 0 calc(12px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
  color: var(--twin-palette-text-hi);
}
/* 巡航中：发光描边 + 亮字，提示当前处于自动环绕态 */
.tour-btn--on {
  border-color: var(--twin-ui-glow-color);
  color: var(--twin-palette-text-hi);
  box-shadow: 0 0 calc(14px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
}
.tour-btn__icon { font-size: 14px; line-height: 1; }
.tour-btn:disabled,
.tour-btn[aria-disabled='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}
.tour-btn:disabled:hover { box-shadow: none; }
</style>
