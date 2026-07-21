<!--
  PoiOverlay.vue —— POI HTML 叠加层（v2.1 范式文件，拷贝到 src/components/center/PoiOverlay.vue）。

  契约出处：references/scene-recipe.md §11——
  - 点击卡片：只投影「当前打开的那一个」POI（openPoiId 单开契约），每帧
    worldToScreen 定位；标题 = tooltip.title ?? label，正文 description，meta 键值表，
    parking 类附 occupancy.empty/capacity。
  - 悬停 tooltip：轻量名称条（onPoiHover 驱动），不进 project 循环。
  - a11y：卡片 aria-live="polite"、焦点移入、Esc 关闭并归还焦点。
-->
<template>
  <div class="poi-overlay">
    <!-- 悬停名称条（轻量，非打开态） -->
    <div
      v-if="hoverPoi && hoverPoi.poi_id !== sel.openPoiId.value"
      class="poi-tip"
      :style="hoverStyle"
    >
      {{ hoverPoi.tooltip?.title ?? hoverPoi.label }}
    </div>

    <!-- 点击卡片（单开，每帧只投影这一个） -->
    <div
      v-if="openPoi"
      ref="cardEl"
      class="poi-card"
      :style="cardStyle"
      role="dialog"
      aria-modal="false"
      :aria-label="`点位详情 ${openPoi.label}`"
      aria-live="polite"
      tabindex="-1"
      @keydown.esc="onClose"
    >
      <div class="poi-card__head">
        <span class="poi-card__badge" :data-type="openPoi.type">{{ typeLabel }}</span>
        <h4 class="poi-card__title">{{ openPoi.tooltip?.title ?? openPoi.label }}</h4>
        <button type="button" class="poi-card__close" aria-label="关闭" @click="onClose">×</button>
      </div>
      <p v-if="openPoi.tooltip?.description" class="poi-card__desc">{{ openPoi.tooltip.description }}</p>
      <dl v-if="openPoi.tooltip?.meta" class="poi-card__meta">
        <template v-for="(v, k) in openPoi.tooltip.meta" :key="k">
          <dt>{{ k }}</dt>
          <dd>{{ v }}</dd>
        </template>
      </dl>
      <p v-if="openPoi.occupancy" class="poi-card__occupancy">
        车位剩余 <strong>{{ openPoi.occupancy.empty }}</strong> / {{ openPoi.occupancy.capacity }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useSelection } from '@/composables/useSelection'
import { useTwinData } from '@/composables/useTwinData'

/** 屏幕投影函数（GlobalTwin 注入 scene.worldToScreen）。 */
const props = defineProps<{
  project: (x: number, y: number, z: number) => { x: number; y: number }
}>()

const sel = useSelection()
const twinData = useTwinData()
const cardEl = ref<HTMLElement | null>(null)

const openPoi = computed(() => twinData.poiById.value(sel.openPoiId.value))
const hoverPoi = computed(() => twinData.poiById.value(twinData.hoverPoiId.value))

const TYPE_LABELS: Record<string, string> = {
  entrance: '出入口', exit: '出口', camera: '监控', gate: '闸机',
  service: '服务点', landmark: '地标', parking: '停车场', custom: '点位',
}
const typeLabel = computed(() => TYPE_LABELS[openPoi.value?.type ?? 'custom'] ?? '点位')

// ---- 每帧投影（只投当前打开/悬停的那一个，性能契约） ----
const cardPos = ref({ x: 0, y: 0 })
const hoverPos = ref({ x: 0, y: 0 })
let rafId = 0

function tick() {
  const p = openPoi.value
  if (p) cardPos.value = props.project(p.x, (p.y ?? 0) + 46, p.z)
  const h = hoverPoi.value
  if (h) hoverPos.value = props.project(h.x, (h.y ?? 0) + 46, h.z)
  rafId = requestAnimationFrame(tick)
}

watch(openPoi, async (p) => {
  if (p) {
    await nextTick()
    cardEl.value?.focus() // a11y：焦点移入卡片
  }
})

const cardStyle = computed(() => ({
  left: `${cardPos.value.x}px`,
  top: `${cardPos.value.y}px`,
}))
const hoverStyle = computed(() => ({
  left: `${hoverPos.value.x}px`,
  top: `${hoverPos.value.y}px`,
}))

function onClose() {
  sel.closePoi()
}

rafId = requestAnimationFrame(tick)
onBeforeUnmount(() => cancelAnimationFrame(rafId))
</script>

<style scoped>
/* 全部颜色走 var(--twin-*)，零 hex 字面量 */
.poi-overlay { position: absolute; inset: 0; z-index: 24; pointer-events: none; }

.poi-tip {
  position: absolute; transform: translate(-50%, -100%);
  padding: 4px 10px;
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: var(--twin-ui-label-bg);
  color: var(--twin-ui-label-text);
  font-size: 12px; white-space: nowrap;
  box-shadow: 0 0 calc(8px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
}

.poi-card {
  position: absolute; transform: translate(-50%, calc(-100% - 10px));
  width: 260px;
  padding: 14px 16px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent),
    color-mix(in srgb, var(--twin-palette-panel-bot) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent)
  );
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
  box-shadow: 0 0 calc(18px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
  color: var(--twin-palette-text-mid);
  font-family: var(--twin-fonts-zh), sans-serif;
  pointer-events: auto;
  outline: none;
}
.poi-card__head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.poi-card__badge {
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--twin-ui-label-bg);
  color: var(--twin-ui-label-text);
  font-size: 11px;
}
.poi-card__title { flex: 1; margin: 0; font-size: 15px; color: var(--twin-accents-title-text); }
.poi-card__close {
  width: 22px; height: 22px;
  border: none; border-radius: 50%;
  background: transparent;
  color: var(--twin-palette-text-lo);
  font-size: 15px; line-height: 1; cursor: pointer;
}
.poi-card__close:hover { color: var(--twin-palette-text-hi); }
.poi-card__desc { margin: 0 0 10px; font-size: 13px; line-height: 1.6; color: var(--twin-palette-text-mid); white-space: pre-line; }
.poi-card__meta { display: grid; grid-template-columns: 64px 1fr; row-gap: 6px; margin: 0; }
.poi-card__meta dt { color: var(--twin-palette-text-lo); font-size: 12px; }
.poi-card__meta dd { margin: 0; color: var(--twin-palette-text-hi); font-size: 13px; }
.poi-card__occupancy { margin: 10px 0 0; font-size: 13px; color: var(--twin-palette-text-lo); }
.poi-card__occupancy strong { color: var(--twin-accents-online-light); font-size: 16px; }
</style>
