<!--
  StyleSwitcher.vue —— v2.12 多风格实时切换器。
  顶部/右上角叠加，列出 spec.previewStyles 提供的风格列表；点风格即时切换（无需重新加载）。
  通过 useStyle 单例读写；GlobalTwin watch current 推回 ParkScene.setStyle。
  全部颜色走 var(--twin-*)；零 hex 字面量；与现有 TourToggleButton 风格一致。
-->
<template>
  <div class="style-switcher" role="group" aria-label="视觉风格切换">
    <button
      v-for="s in available"
      :key="s"
      type="button"
      class="style-chip"
      :class="{ 'style-chip--active': s === current }"
      :aria-pressed="s === current"
      @click="onPick(s)"
    >
      {{ STYLE_LABELS[s] ?? s }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useStyle, type StyleKey } from '@/composables/useStyle'
import { STYLE_LABELS } from '@/utils/theme'

const { current, available, setStyle } = useStyle()

function onPick(s: StyleKey) {
  setStyle(s)
}
</script>

<style scoped>
.style-switcher {
  position: absolute;
  top: 20px;
  left: 24px;
  z-index: 21;
  display: flex;
  gap: 6px;
  padding: 6px 10px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent);
  backdrop-filter: blur(var(--twin-ui-panel-blur, 4px));
}
.style-chip {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--twin-palette-text-mid);
  font-size: 12px;
  font-family: var(--twin-fonts-latin, 'Rajdhani', system-ui);
  cursor: pointer;
  transition: all 0.18s;
}
.style-chip:hover {
  color: var(--twin-palette-text-hi);
  box-shadow: 0 0 calc(8px * var(--twin-ui-glow-strength, 1)) var(--twin-ui-glow-color);
}
.style-chip--active {
  color: var(--twin-palette-text-hi);
  border-color: var(--twin-ui-glow-color);
  box-shadow: 0 0 calc(10px * var(--twin-ui-glow-strength, 1)) var(--twin-ui-glow-color);
}
</style>
