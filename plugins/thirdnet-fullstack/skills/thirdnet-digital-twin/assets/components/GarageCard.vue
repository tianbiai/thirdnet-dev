<!--
  GarageCard.vue —— 地下车库信息卡（v2.6 范式文件，拷贝到 src/components/center/GarageCard.vue）。

  契约出处：references/scene-recipe.md §14——地下视角下点击坑体浮出，展示车位总数/已占用/空余/占用率。
  数据来自静态脚手架 parkScaffold.garages（capacity/occupied 静态内联，与 surfaceParking 同做法）。
  选中态读 useSelection.selectedGarageId；Esc / × 调 selectGarage(null)（仅清卡片，保留地下视角）。
  颜色全走 var(--twin-*)（与 GlobalTwin/UnitDetail 同纪律，零 hex 字面量）。
-->
<template>
  <div v-if="garage" class="garage-card">
    <div class="garage-card__head">
      <div class="garage-card__title">
        <span class="garage-card__badge">{{ levelLabel }}</span>
        <span class="garage-card__name">{{ garage.name }}</span>
      </div>
      <button class="garage-card__close" type="button" title="关闭(Esc)" aria-label="关闭" @click="close">×</button>
    </div>

    <template v-if="isParking">
      <div class="garage-card__stats">
        <div class="garage-card__stat">
          <div class="garage-card__sv">{{ garage.capacity }}</div>
          <div class="garage-card__sl">总车位</div>
        </div>
        <div class="garage-card__stat">
          <div class="garage-card__sv garage-card__sv--warn">{{ garage.occupied ?? 0 }}</div>
          <div class="garage-card__sl">已占用</div>
        </div>
        <div class="garage-card__stat">
          <div class="garage-card__sv garage-card__sv--ok">{{ empty }}</div>
          <div class="garage-card__sl">空余</div>
        </div>
      </div>

      <div class="garage-card__rate">
        <div class="garage-card__bar">
          <div class="garage-card__fill" :class="{ 'garage-card__fill--high': rate >= 80 }" :style="{ width: `${rate}%` }" />
        </div>
        <div class="garage-card__rate-text" :class="{ 'garage-card__rate-text--high': rate >= 80 }">占用率 {{ rate }}%</div>
      </div>
    </template>

    <div v-else class="garage-card__stats">
      <div class="garage-card__stat">
        <div class="garage-card__sv garage-card__sv--info">{{ usageLabel }}</div>
        <div class="garage-card__sl">用途</div>
      </div>
      <div class="garage-card__stat">
        <div class="garage-card__sv garage-card__sv--ok">{{ roomCount }}</div>
        <div class="garage-card__sl">功能间</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { parkScaffold } from '@/data/park'
import { useSelection } from '@/composables/useSelection'

const sel = useSelection()

// 静态脚手架里的车库（capacity/occupied 内联；与楼上业务数据不同，不走 getBuildings 水合）
const garage = computed(() => {
  const id = sel.selectedGarageId.value
  if (!id || !parkScaffold.garages) return null
  return parkScaffold.garages.find((g) => g.id === id) ?? null
})
// v2.7：parking 显车位占用；非 parking（商场/地铁/人防/车间…）显用途 + 功能间数
const isParking = computed(() => garage.value?.capacity != null)
const empty = computed(() =>
  garage.value && isParking.value ? Math.max(0, (garage.value.capacity ?? 0) - (garage.value.occupied ?? 0)) : 0,
)
const rate = computed(() =>
  garage.value && (garage.value.capacity ?? 0) > 0 ? Math.round(((garage.value.occupied ?? 0) / (garage.value.capacity ?? 1)) * 100) : 0,
)
const roomCount = computed(() => garage.value?.rooms?.length ?? 0)
const usageLabel = computed(() => {
  const u = garage.value?.usage
  const map: Record<string, string> = {
    parking: '地下车库', mall: '地下商场', subway: '地铁通道', shelter: '人防工程', workshop: '地下车间',
  }
  return (u && map[u]) || (u ? u : '地下区域')
})
const levelLabel = computed(() => {
  const lv = garage.value?.level
  if (lv == null) return ''
  return lv < 0 ? `B${-lv}` : `${lv}F`
})

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') sel.selectGarage(null)
}
function close() {
  sel.selectGarage(null)
}
onMounted(() => window.addEventListener('keydown', onEsc))
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))
</script>

<style scoped>
/* 全部颜色走 var(--twin-*)（tokens.css / applyCssVars 注入），零 hex 字面量 */
.garage-card {
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: var(--twin-ui-border-width, 1px) solid color-mix(in srgb, var(--twin-palette-mint) 55%, transparent);
  border-radius: calc(var(--twin-ui-panel-radius, 6px) + 2px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent);
  backdrop-filter: blur(var(--twin-ui-panel-blur, 0px));
  box-shadow: 0 0 calc(24px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color);
}

.garage-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.garage-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.garage-card__badge {
  font-family: var(--twin-fonts-latin), var(--twin-fonts-zh), sans-serif;
  font-size: 13px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  color: var(--twin-palette-mint);
  background: color-mix(in srgb, var(--twin-palette-mint) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--twin-palette-mint) 35%, transparent);
}
.garage-card__name {
  font-family: var(--twin-fonts-zh), sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--twin-palette-text-hi);
}

.garage-card__close {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--twin-palette-mint) 40%, transparent);
  background: color-mix(in srgb, var(--twin-palette-mint) 12%, transparent);
  color: var(--twin-palette-text-hi);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.garage-card__close:hover {
  background: color-mix(in srgb, var(--twin-palette-mint) 30%, transparent);
}

.garage-card__stats {
  display: flex;
  gap: 8px;
}
.garage-card__stat {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--twin-palette-cyan-bright) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--twin-palette-cyan-bright) 14%, transparent);
}
.garage-card__sv {
  font-family: var(--twin-fonts-latin), sans-serif;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: var(--twin-palette-text-hi);
}
.garage-card__sv--ok { color: var(--twin-accents-online); }
.garage-card__sv--warn { color: var(--twin-accents-amber-bright); }
.garage-card__sv--info { font-size: 15px; font-weight: 600; color: var(--twin-palette-cyan-bright); }
.garage-card__sl {
  font-family: var(--twin-fonts-zh), sans-serif;
  font-size: 11px;
  color: var(--twin-palette-text-lo);
}

.garage-card__rate {
  display: flex;
  align-items: center;
  gap: 8px;
}
.garage-card__bar {
  flex: 1 1 0;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: color-mix(in srgb, var(--twin-palette-cyan-bright) 12%, transparent);
}
.garage-card__fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--twin-accents-online), var(--twin-palette-mint));
  transition: width 0.3s ease;
}
.garage-card__fill--high {
  background: linear-gradient(90deg, var(--twin-accents-amber), var(--twin-accents-live-red));
}
.garage-card__rate-text {
  font-family: var(--twin-fonts-latin), var(--twin-fonts-zh), sans-serif;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--twin-accents-online);
}
.garage-card__rate-text--high {
  color: var(--twin-accents-live-red);
}
</style>
