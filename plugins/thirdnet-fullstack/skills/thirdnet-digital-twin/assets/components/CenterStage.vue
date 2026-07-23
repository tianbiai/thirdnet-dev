<!--
  CenterStage.vue —— 中央舞台（v2.1 范式文件，拷贝到 src/components/center/CenterStage.vue）。

  契约出处：references/shell.md——常驻 GlobalTwin <canvas> + 锁定楼层时右侧叠加
  UnitDetail；屏幕 Legend 常驻左上。外围（左右两侧 + 底部）不在本组件——调用方自行填充。
-->
<template>
  <div class="center-stage">
    <GlobalTwin :title="title" />
    <LegendPanel class="center-stage__legend" />
    <Transition name="slide">
      <UnitDetail v-if="showDetail" class="center-stage__detail" />
    </Transition>
    <Transition name="rise">
      <GarageCard v-if="showGarage" class="center-stage__garage" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GlobalTwin from './GlobalTwin.vue'
import LegendPanel from './LegendPanel.vue'
import UnitDetail from './UnitDetail.vue'
import GarageCard from './GarageCard.vue'
import { useSelection } from '@/composables/useSelection'

withDefaults(defineProps<{ title?: string }>(), { title: '园区' })

const sel = useSelection()
// 锁定楼层（floorIndex != null）才显示详情；仅聚焦整楼（切换器）不显示
const showDetail = computed(() => sel.focusedBuildingId.value != null && sel.floorIndex.value != null)
// v2.6：地下视角下选中车库 → 显示车库信息卡（与 UnitDetail 互斥：地下/楼上不会同时选中）
const showGarage = computed(() => sel.selectedGarageId.value != null)
</script>

<style scoped>
.center-stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
.center-stage__legend { position: absolute; top: 20px; left: 24px; z-index: 20; }
.center-stage__detail { position: absolute; top: 0; right: 0; bottom: 0; z-index: 20; }
.center-stage__garage { position: absolute; right: 24px; bottom: 24px; z-index: 21; }

.slide-enter-active, .slide-leave-active,
.rise-enter-active, .rise-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-enter-from, .slide-leave-to { transform: translateX(24px); opacity: 0; }
.rise-enter-from, .rise-leave-to { transform: translateY(16px); opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .slide-enter-active, .slide-leave-active,
  .rise-enter-active, .rise-leave-active { transition: none; }
}
</style>
