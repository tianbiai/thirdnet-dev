<!--
  UnitDetail.vue —— 楼层详情面板（v2.1 范式文件，拷贝到 src/components/center/UnitDetail.vue）。

  契约出处：references/shell.md + dynamic-data-api.md §4/§9——数据源 =
  getFloorDetail() 返回的 FloorDetail（units[]，多单位时上一/下一切换）；
  骨架屏 / 空态「该层暂无单位信息」/ 内联错误重试三态；打开时焦点移入、Esc 关闭
  并把焦点还给场景（a11y 契约）。
-->
<template>
  <aside
    ref="panelEl"
    class="unit-detail"
    role="dialog"
    aria-modal="false"
    :aria-label="`楼层详情 ${detailTitle}`"
    tabindex="-1"
    @keydown.esc="onClose"
  >
    <header class="unit-detail__head">
      <div>
        <h3 class="unit-detail__title">{{ detailTitle }}</h3>
        <p v-if="detail?.tenant" class="unit-detail__sub">{{ detail.tenant }}</p>
      </div>
      <button type="button" class="unit-detail__close" aria-label="关闭详情" @click="onClose">×</button>
    </header>

    <!-- 加载态：骨架屏 -->
    <div v-if="twinData.floorDetailLoading.value" class="unit-detail__body" aria-busy="true">
      <div v-for="i in 6" :key="i" class="skeleton" :style="{ width: `${88 - i * 6}%` }" />
    </div>

    <!-- 错误态：内联重试 -->
    <div v-else-if="twinData.floorDetailError.value" class="unit-detail__body unit-detail__error">
      <p>加载失败：{{ twinData.floorDetailError.value }}</p>
      <button type="button" class="unit-detail__btn" @click="retry">重试</button>
    </div>

    <!-- 空态 -->
    <div v-else-if="!unit" class="unit-detail__body unit-detail__empty">
      <p>该层暂无单位信息</p>
    </div>

    <!-- 正常态 -->
    <div v-else class="unit-detail__body">
      <div v-if="(detail?.units.length ?? 0) > 1" class="unit-detail__pager">
        <button type="button" class="unit-detail__btn" :disabled="sel.unitIndex.value <= 0" @click="sel.setUnit(sel.unitIndex.value - 1)">上一单位</button>
        <span>{{ sel.unitIndex.value + 1 }} / {{ detail!.units.length }}</span>
        <button type="button" class="unit-detail__btn" :disabled="sel.unitIndex.value >= detail!.units.length - 1" @click="sel.setUnit(sel.unitIndex.value + 1)">下一单位</button>
      </div>
      <h4 class="unit-detail__unit">{{ unit.name }}</h4>
      <dl class="unit-detail__grid">
        <template v-for="row in rows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSelection } from '@/composables/useSelection'
import { useTwinData } from '@/composables/useTwinData'

const sel = useSelection()
const twinData = useTwinData()
const panelEl = ref<HTMLElement | null>(null)

const detail = computed(() => twinData.floorDetail.value)
const unit = computed(() => detail.value?.units[sel.unitIndex.value] ?? detail.value?.units[0])

const detailTitle = computed(() => {
  const bid = sel.focusedBuildingId.value
  const name = bid ? twinData.buildingName.value(bid) : ''
  return `${name} ${detail.value?.label ?? ''}`.trim()
})

// 字段行（负责人/电话/在编/面积/性质/服务时间/业务范围/职责——契约固定顺序）
const rows = computed(() => {
  const u = unit.value
  if (!u) return []
  return [
    { label: '负责人', value: u.contact_person ?? '—' },
    { label: '联系电话', value: u.contact_phone ?? '—' },
    { label: '在编人员', value: u.staff_count != null ? `${u.staff_count} 人` : '—' },
    { label: '办公面积', value: u.area != null ? `${u.area} ㎡` : '—' },
    { label: '单位性质', value: u.nature ?? '—' },
    { label: '服务时间', value: u.service_hours ?? '—' },
    { label: '业务范围', value: u.business_scope ?? '—' },
    { label: '职责', value: u.responsibilities ?? '—' },
  ]
})

function onClose() {
  sel.clearFocus() // Esc/× 关闭 = 取消选中回全局（金边消失、相机回全景）
}

// 内联重试：重跑一次楼层选中（触发 GlobalTwin 的详情 watch）
function retry() {
  const bid = sel.focusedBuildingId.value
  const fin = sel.floorIndex.value
  if (bid != null && fin != null) sel.selectFloor(bid, fin)
}

onMounted(() => {
  panelEl.value?.focus() // a11y：打开时焦点移入面板
})
</script>

<style scoped>
/* 全部颜色走 var(--twin-*)，零 hex 字面量 */
.unit-detail {
  width: 400px; height: 100%;
  display: flex; flex-direction: column;
  padding: 22px 24px;
  border-left: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent),
    color-mix(in srgb, var(--twin-palette-panel-bot) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent)
  );
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
  box-shadow: 0 0 calc(24px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
  color: var(--twin-palette-text-mid);
  font-family: var(--twin-fonts-zh), sans-serif;
  outline: none;
  overflow-y: auto;
}
.unit-detail__head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
.unit-detail__title {
  margin: 0;
  font-size: 20px; font-weight: 700;
  color: var(--twin-accents-title-text);
  text-shadow: 0 0 calc(10px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
}
.unit-detail__sub { margin: 4px 0 0; font-size: 13px; color: var(--twin-palette-text-lo); }
.unit-detail__close {
  width: 30px; height: 30px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: 50%;
  background: transparent;
  color: var(--twin-palette-text-lo);
  font-size: 18px; line-height: 1;
  cursor: pointer;
}
.unit-detail__close:hover { color: var(--twin-palette-text-hi); box-shadow: 0 0 calc(10px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color); }

.unit-detail__body { flex: 1; }
.unit-detail__error p, .unit-detail__empty p { color: var(--twin-palette-text-lo); font-size: 14px; }
.unit-detail__error { color: var(--twin-accents-live-red); }

.unit-detail__pager {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
  font-size: 13px; color: var(--twin-palette-text-lo);
}
.unit-detail__btn {
  padding: 5px 14px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: var(--twin-accents-tile-bg);
  color: var(--twin-palette-text-mid);
  font-size: 12px;
  cursor: pointer;
}
.unit-detail__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.unit-detail__btn:not(:disabled):hover { box-shadow: 0 0 calc(10px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color); }

.unit-detail__unit { margin: 0 0 14px; font-size: 16px; color: var(--twin-palette-cyan-bright); }
.unit-detail__grid { display: grid; grid-template-columns: 84px 1fr; row-gap: 12px; margin: 0; }
.unit-detail__grid dt { color: var(--twin-palette-text-lo); font-size: 13px; }
.unit-detail__grid dd { margin: 0; color: var(--twin-palette-text-hi); font-size: 14px; line-height: 1.5; }

.skeleton {
  height: 14px; margin-bottom: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--twin-accents-tile-bg) 25%, var(--twin-accents-row-bg) 50%, var(--twin-accents-tile-bg) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
