<!--
  BuildingSwitcher.vue —— 楼栋切换器（v2.1 范式文件，
  拷贝到 src/components/center/BuildingSwitcher.vue）。

  契约出处：references/shell.md——标签页 = 全局视角 + 每栋楼一个（含地下车库）；
  标签骨架来自静态脚手架（楼栋 id），显示名由 getBuildings() 水合（水合前显示 id 占位）；
  a11y：role=tablist/tab + aria-selected + 方向键导航。
  写入选中：标签页只调 focusBuilding（聚焦整楼、重置楼层）——⛔ 不是 selectFloor。
-->
<template>
  <div class="switcher" :class="`switcher--${switcherStyle}`" role="tablist" aria-label="楼栋切换">
    <button
      v-for="(tab, i) in tabs"
      :key="tab.id ?? '__global__'"
      ref="tabEls"
      type="button"
      role="tab"
      class="switcher__tab"
      :class="{ 'switcher__tab--active': isActive(tab) }"
      :aria-selected="isActive(tab)"
      :tabindex="isActive(tab) || (i === 0 && sel.focusedBuildingId.value == null && !sel.belowView.value) ? 0 : -1"
      @click="onTab(tab)"
      @keydown="onKeydown($event, i)"
    >
      <span class="switcher__label">{{ tab.label }}</span>
      <span v-if="tab.header" class="switcher__header">{{ tab.header }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { parkScaffold } from '@/data/park'
import { useSelection } from '@/composables/useSelection'
import { useTwinData } from '@/composables/useTwinData'
import { useStyle } from '@/composables/useStyle'
import { applyTheme } from '@/utils/theme'

const sel = useSelection()
const twinData = useTwinData()
const style = useStyle()
const tabEls = ref<HTMLButtonElement[]>([])

// 切换器形态（neon=描边发光 pill / flat=填充块）由 token ui.switcherStyle 固化；
// 读 useStyle 单例当前风格 → 跟随 StyleSwitcher 实时切换 chrome（initStyle 在 setup 已完成，首帧即正确）。
const switcherStyle = computed(
  () => applyTheme(style.current.value).ui?.switcherStyle ?? 'neon',
)

interface Tab { id: string | null; label: string; header?: string; kind: 'building' | 'garage' }

// v2.6：有 garages[] 时地下体验走独立「地下车库」标签（→ enterBelowView 相机俯冲）。
const hasUnderground = computed(() => !!parkScaffold.garages && parkScaffold.garages.length > 0)

// 标签 = 全局视角 + 每栋楼（骨架读静态脚手架 id；名称/层数由 getBuildings 水合）+ 可选「地下车库」
const tabs = computed<Tab[]>(() => {
  const list: Tab[] = [{ id: null, label: '全局视角', kind: 'building' }]
  for (const b of parkScaffold.buildings) {
    // 有地下坑体时跳过 category:'garage' 入口标记楼（地下体验由独立标签承载，避免重复入口）
    if (hasUnderground.value && b.category === 'garage') continue
    const rt = twinData.buildings.value.find((x) => x.building_id === b.id)
    list.push({
      id: b.id,
      label: rt?.name ?? (twinData.hydrating.value ? '加载中…' : b.id),
      header: rt?.header,
      kind: 'building',
    })
  }
  if (hasUnderground.value) list.push({ id: '__garage__', label: '地下车库', kind: 'garage' })
  return list
})

const isActive = (tab: Tab) => tab.kind === 'garage' ? sel.belowView.value : sel.focusedBuildingId.value === tab.id

function onTab(tab: Tab) {
  if (tab.kind === 'garage') { sel.enterBelowView(); return } // v2.6：相机俯冲进入地下
  if (tab.id === null) sel.clearFocus()
  else sel.focusBuilding(tab.id) // 仅切换器用：聚焦整楼、重置楼层（§8.1 铁律）
}

function onKeydown(e: KeyboardEvent, i: number) {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
  const next = (i + dir + tabs.value.length) % tabs.value.length
  tabEls.value[next]?.focus()
  onTab(tabs.value[next])
}
</script>

<style scoped>
/* 全部颜色走 var(--twin-*)，形态差异由 --twin-ui-* 驱动（neon/flat），零 hex 字面量 */
.switcher {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: calc(var(--twin-ui-panel-radius, 6px) + 6px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.85) * 100%), transparent);
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
}
.switcher__tab {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 6px 18px;
  border: var(--twin-ui-border-width, 1px) solid transparent;
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: transparent;
  color: var(--twin-palette-text-lo);
  font-family: var(--twin-fonts-zh), sans-serif;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s, box-shadow 0.2s, background 0.2s, border-color 0.2s;
}
.switcher__header { font-size: 11px; color: var(--twin-palette-text-lo); opacity: 0.8; }
.switcher__tab:hover { color: var(--twin-palette-text-hi); }
.switcher__tab:focus-visible { outline: 2px solid var(--twin-accents-select-yellow); outline-offset: 2px; }

/* neon：描边 + 发光 pill（具体哪些风格走 neon/flat 由 tokens.ui.switcherStyle 决定） */
.switcher--neon .switcher__tab--active {
  border-color: var(--twin-palette-cyan);
  background: var(--twin-accents-active-tab-bg);
  color: var(--twin-palette-cyan-bright);
  box-shadow:
    0 0 calc(14px * var(--twin-ui-glow-strength, 0.5)) var(--twin-ui-glow-color),
    inset 0 0 calc(8px * var(--twin-ui-glow-strength, 0.5)) var(--twin-ui-glow-color);
  text-shadow: 0 0 calc(8px * var(--twin-ui-glow-strength, 0.5)) var(--twin-ui-glow-color);
}
/* flat：填充块 + 中性投影（见上方 neon 注释，风格→形态映射由 token 驱动） */
.switcher--flat .switcher__tab--active {
  background: var(--twin-accents-active-tab-bg);
  color: var(--twin-palette-text-hi);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.18);
}
</style>
