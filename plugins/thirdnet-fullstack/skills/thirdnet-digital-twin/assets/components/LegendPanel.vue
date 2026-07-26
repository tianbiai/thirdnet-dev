<!--
  LegendPanel.vue —— 屏幕图例（v2.1 范式文件，拷贝到 src/components/center/LegendPanel.vue）。

  契约出处：references/scene-recipe.md §6——每个 spec.legend 条目一个色块，
  让「楼栋按类别上色」可读。色块颜色来自静态脚手架 legend（其值与 token category
  一致，由 validate_spec.py 复核）；文字/边框/发光仍走 --twin-* 变量。
-->
<template>
  <div class="legend" role="list" aria-label="图例">
    <span v-for="e in parkScaffold.legend" :key="e.category + (e.type ?? '')" class="legend__item" role="listitem">
      <i class="legend__swatch" :style="swatchStyle(e.color, e.category, e.type)" />
      {{ e.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { parkScaffold } from '@/data/park'

// 色块颜色：优先 legend 自带色（与 token category 一致）；缺色时 v2.30 起条目带 type 先回退
// 楼栋类型 CSS 变量（--twin-building-type-<type>，token buildingType 块展平派生），
// 再回退该类别 CSS 变量，再回退楼幢色（v2.7 自定义类别）
function swatchStyle(color: string, category: string, type?: string) {
  const c = color || (type
    ? `var(--twin-building-type-${type}, var(--twin-category-${category}, var(--twin-category-building)))`
    : `var(--twin-category-${category}, var(--twin-category-building))`)
  return { background: c, boxShadow: `0 0 calc(6px * var(--twin-ui-glow-strength, 0.5)) ${c}` }
}
</script>

<style scoped>
.legend {
  display: flex; gap: 16px;
  padding: 7px 14px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.85) * 100%), transparent);
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
  font-size: 12px;
  color: var(--twin-palette-text-mid);
  font-family: var(--twin-fonts-zh), sans-serif;
}
.legend__item { display: inline-flex; align-items: center; gap: 6px; }
.legend__swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
</style>
