<!--
  GlobalTwin.vue —— 数字孪生中央 3D 场景宿主（v2.1 范式文件，
  拷贝到 src/components/center/GlobalTwin.vue）。

  契约出处：references/scene-recipe.md §8（选中接线）/ §9（生命周期）/ §12（水合时序）、
  references/shell.md（三态兜底 / dispose / context loss）。

  职责（全部固化，勿临场改接线）：
  ① onMounted 同步 new ParkScene（静态脚手架：环境 + 占地底板 + 取景，不白屏）；
  ② Promise.allSettled 并行拉 getBuildings/getPois 水合（POI 失败不连累楼栋）；
  ③ 指针回调只写 useSelection；相机聚焦 / 金色高亮全由 watch 单向推回场景；
  ④ 楼层点击 watch 拉 getFloorDetail（onCleanup + AbortController 防 race）；
  ⑤ onBeforeUnmount 完整 dispose；webglcontextlost/restored 显式遮罩。
-->
<template>
  <div class="global-twin">
    <canvas
      ref="canvasEl"
      class="twin-canvas"
      role="img"
      :aria-label="`${title} 数字孪生 3D 场景，含 ${twinData.buildingCount.value} 栋楼，可用楼栋切换器浏览`"
    />
    <!-- POI HTML 叠加层（悬停 tooltip + 点击卡片，只投影当前打开的 POI） -->
    <PoiOverlay :project="projectPoi" />
    <!-- v2.2 航拍巡航开关（右上角；读/写 useTour，watch 推回 scene.setTourEnabled） -->
    <TourToggleButton class="global-twin__tour" />
    <!-- v2.12 多风格实时切换器（左上角；读/写 useStyle，watch 推回 scene.setStyle） -->
    <StyleSwitcher v-if="parkScaffold.previewStyles && parkScaffold.previewStyles.length > 1" class="global-twin__style" />
    <!-- v2.28+ 扫描线 CSS 叠加层（cyber/night 弱）；pointer-events:none 不阻交互；z-index 在 mask 之下 -->
    <div class="twin-scanlines" aria-hidden="true" />
    <!-- WebGL context 丢失遮罩（shell.md 契约：显式遮罩 + 停渲染，恢复时重建） -->
    <div v-if="contextLost" class="twin-mask">
      <p>3D 上下文丢失，正在恢复…</p>
    </div>
    <!-- 楼栋水合失败降级（脚手架仍可交互） -->
    <div v-if="twinData.buildingsError.value" class="twin-mask twin-mask--error">
      <p>楼栋数据加载失败：{{ twinData.buildingsError.value }}</p>
      <button type="button" class="twin-btn" @click="loadBuildings">重试</button>
    </div>
    <!-- 楼栋为空（getBuildings 返回 []） -->
    <div v-else-if="!twinData.hydrating.value && twinData.buildingCount.value === 0" class="twin-mask">
      <p>该园区尚未配置楼栋</p>
      <button type="button" class="twin-btn" @click="loadBuildings">刷新</button>
    </div>
    <!-- POI 失败轻提示（不遮罩，楼栋仍可交互） -->
    <div v-if="twinData.poisError.value" class="poi-error" role="status">
      POI 数据加载失败（楼栋仍可交互）
      <button type="button" class="twin-btn twin-btn--sm" @click="loadPois">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ParkScene } from '@/scene/ParkScene'
import { parkScaffold } from '@/data/park'
import { applyCssVars, type StyleKey } from '@/utils/theme'
import { digitalTwinApi } from '@/api/modules/digital-twin'
import { useSelection } from '@/composables/useSelection'
import { useTwinData, errMsg } from '@/composables/useTwinData'
import { useTour } from '@/composables/useTour'
import { initStyle, useStyle } from '@/composables/useStyle'
import PoiOverlay from './PoiOverlay.vue'
import TourToggleButton from './TourToggleButton.vue'
import StyleSwitcher from './StyleSwitcher.vue'

const props = withDefaults(defineProps<{ title?: string }>(), { title: '园区' })

const canvasEl = ref<HTMLCanvasElement | null>(null)
const contextLost = ref(false)
const sel = useSelection()
const twinData = useTwinData()
const tour = useTour()
const style = useStyle()

// v2.12：初始化风格单例（来自 spec.style + spec.previewStyles）。必须在 setup 顶层（早于首帧渲染），
// 让 StyleSwitcher 首帧即拿到正确 current/available（useTour/useSelection 默认值即合法，故无需 init）。
initStyle(parkScaffold.style as StyleKey, parkScaffold.previewStyles)

let scene: ParkScene | null = null
let onContextLost: (() => void) | null = null
let onContextRestored: (() => void) | null = null

/** POI 卡片屏幕投影（PoiOverlay 每帧只投当前打开的那一个）。 */
function projectPoi(x: number, y: number, z: number) {
  return scene?.worldToScreen(x, y, z) ?? { x: 0, y: 0 }
}

async function loadBuildings() {
  twinData.buildingsError.value = null
  try {
    const items = await digitalTwinApi.getBuildings()
    twinData.setBuildings(items)
    scene?.hydrateBuildings(items)
  } catch (e) {
    twinData.buildingsError.value = errMsg(e)
  }
}

async function loadPois() {
  twinData.poisError.value = null
  try {
    const items = await digitalTwinApi.getPois()
    twinData.setPois(items)
    scene?.hydratePois(items)
  } catch (e) {
    twinData.poisError.value = errMsg(e)
  }
}

onMounted(async () => {
  const canvas = canvasEl.value!
  onContextLost = () => { contextLost.value = true }
  onContextRestored = () => { contextLost.value = false }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  // ① 同步静态脚手架（环境 + 占地底板 + 取景只用静态几何，不等动态数据）
  scene = new ParkScene(canvas, parkScaffold, {
    onHover: (bid, fin) => sel.setHover(bid, fin),   // 悬停写 hover*（eff 立即变）
    onSelect: (bid, fin) => sel.selectFloor(bid, fin), // 楼层点击：楼+层原子写入（铁律：勿再调 focusBuilding）
    onDeselect: () => sel.clearFocus(),              // 点空白/非楼栋 → 取消选中回全局
    onPoiOpen: (poiId) => (poiId ? sel.openPoi(poiId) : sel.closePoi()),
    onPoiHover: (poiId) => twinData.setHoverPoi(poiId), // POI 悬停名称条（§11 仅悬停契约）
    onTourAutoExit: () => tour.disable(), // v2.2 §13：巡航中用户拖拽 → 关按钮态（watch 会推 setTourEnabled(false)）
    onGarageSelect: (id) => sel.selectGarage(id), // v2.6 §14：地下点击 → 选中/取消车库（null=仅清卡片，留地下视角）
    // ⛔ 不要 onFocus 回调——相机聚焦由下面 watch(focusedBuildingId) 驱动（§8 反面模式）
  })
  scene.setStyle(parkScaffold.style as StyleKey)
  // per-park token 覆盖注入 --twin-* CSS 变量（theme.ts 契约；静态基础主题由 generate_theme.py 产出的 tokens.css 提供）
  if (parkScaffold.tokens) applyCssVars(parkScaffold.tokens)

  // v2.12：StyleSwitcher 切换 → 推回 scene.setStyle（单向，与 focusedBuildingId → focusBuilding 同模式）
  watch(style.current, (s) => scene?.setStyle(s))

  // v2.2 航拍巡航：按钮态 → 场景（单向，与 focusedBuildingId → focusBuilding 同模式）
  watch(tour.enabled, (on) => scene?.setTourEnabled(on))
  // 首屏自动巡航（spec.cameraTour.enabled=true 时）：水合前即可开（取景只用静态几何）
  if (parkScaffold.cameraTour?.enabled) tour.enable()

  // v2.6 地下视角：切换器「地下车库」标签写 belowView → scene.setBelowView（单向，与巡航/聚焦同模式）
  watch(sel.belowView, (on) => scene?.setBelowView(on))

  // 相机聚焦：跟随 focusedBuildingId（切换器标签页 / 3D 楼层点击都会改它）
  watch(sel.focusedBuildingId, (id) => scene?.focusBuilding(id))
  // 金色高亮：跟随「有效楼层」eff = 悬停 ?? 已选（鼠标移开高亮保留在已选层）
  watch(
    () => [sel.effBuildingId.value, sel.effFloorIndex.value] as const,
    ([bid, fin]) => scene?.setSelection(bid, fin),
  )
  // 楼层详情：选中楼层变化 → getFloorDetail（onCleanup + AbortController 防快速切层 race）
  watch(
    () => [sel.focusedBuildingId.value, sel.floorIndex.value] as const,
    async ([bid, fin], _prev, onCleanup) => {
      if (!bid || fin == null) { twinData.setFloorDetail(null); return }
      const floorId = scene?.getFloorId(bid, fin)
      if (!floorId) return
      const ctrl = new AbortController()
      onCleanup(() => ctrl.abort())
      twinData.floorDetailLoading.value = true
      twinData.floorDetailError.value = null
      try {
        twinData.setFloorDetail(
          await digitalTwinApi.getFloorDetail({ building_id: bid, floor_id: floorId }, { signal: ctrl.signal }),
        )
      } catch (e) {
        if (!ctrl.signal.aborted) twinData.floorDetailError.value = errMsg(e)
      } finally {
        if (!ctrl.signal.aborted) twinData.floorDetailLoading.value = false
      }
    },
  )

  // v2.15 POI 业务详情：POI 打开变化 → getPoiDetail（onCleanup + AbortController 防快速切点 race）。
  // 失败不阻断——PoiOverlay 降级读列表项 inline tooltip/room_spec/occupancy（向后兼容）。
  watch(
    () => sel.openPoiId.value,
    async (poiId, _prev, onCleanup) => {
      if (!poiId) { twinData.setPoiDetail(null); twinData.poiDetailError.value = null; return }
      const ctrl = new AbortController()
      onCleanup(() => ctrl.abort())
      twinData.poiDetailLoading.value = true
      twinData.poiDetailError.value = null
      try {
        twinData.setPoiDetail(
          await digitalTwinApi.getPoiDetail({ poi_id: poiId }, { signal: ctrl.signal }),
        )
      } catch (e) {
        if (!ctrl.signal.aborted) twinData.poiDetailError.value = errMsg(e)
      } finally {
        if (!ctrl.signal.aborted) twinData.poiDetailLoading.value = false
      }
    },
  )

  // ② 并行水合（allSettled：POI 失败不连累楼栋）
  twinData.hydrating.value = true
  await Promise.allSettled([loadBuildings(), loadPois()])
  twinData.hydrating.value = false

  // ③ v2.28+ 首屏电影入场（仅触发一次；水合完成后才推——楼栋 label 都已就位）。
  // 推 1.8s（默认）从拉远位拉到默认取景位，期间 OrbitControls.enabled=false，
  // 用户在入场期点击/拖拽 → skipIntro 立刻恢复。
  scene?.playIntro?.()
})

onBeforeUnmount(() => {
  const canvas = canvasEl.value
  if (canvas && onContextLost && onContextRestored) {
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
  }
  tour.disable() // v2.2：卸载时复位巡航单例，避免复用残留
  scene?.dispose() // 完整清单见 scene-recipe.md §9（不止取消 RAF）
  scene = null
})
</script>

<style scoped>
/* 全部颜色走 var(--twin-*)（tokens.css / applyCssVars 注入），零 hex 字面量 */
.global-twin { position: relative; width: 100%; height: 100%; }
.twin-canvas { display: block; width: 100%; height: 100%; outline: none; }
.global-twin__tour { position: absolute; top: 20px; right: 24px; z-index: 20; }
.global-twin__style { position: absolute; top: 64px; left: 24px; z-index: 22; }

.twin-mask {
  position: absolute; inset: 0; z-index: 30;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  background: color-mix(in srgb, var(--twin-palette-void-bg) 72%, transparent);
  color: var(--twin-palette-text-mid);
  font-size: 16px;
  backdrop-filter: blur(var(--twin-ui-panel-blur, 4px));
}
.twin-mask--error { color: var(--twin-accents-live-red); }

.twin-btn {
  padding: 8px 22px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: var(--twin-accents-tile-bg);
  color: var(--twin-palette-text-hi);
  font-size: 14px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.twin-btn:hover { box-shadow: 0 0 calc(12px * var(--twin-ui-glow-strength, 0)) var(--twin-ui-glow-color); }
.twin-btn--sm { padding: 3px 12px; font-size: 12px; }

.poi-error {
  position: absolute; left: 16px; bottom: 16px; z-index: 25;
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px;
  border: var(--twin-ui-border-width, 1px) solid var(--twin-accents-panel-stroke);
  border-radius: var(--twin-ui-panel-radius, 6px);
  background: color-mix(in srgb, var(--twin-palette-panel-top) calc(var(--twin-ui-panel-opacity, 0.9) * 100%), transparent);
  color: var(--twin-palette-text-lo);
  font-size: 12px;
}

/* v2.28+ 扫描线 CSS 叠加层（cyber/night 弱）：
 * — 始终覆盖全画布，pointer-events:none 不阻交互
 * — opacity/color 走 token（cyber baseline = 青 0.06；night 切换后是 蓝 0.03）
 * — 背景条纹 2px 实 + 1px 透明，screen 混合让暗部「赛博」透出
 * — 入场入场期（global-twin 根节点挂 .is-intro）外环更明显
 */
.twin-scanlines {
  position: absolute; inset: 0; pointer-events: none; z-index: 18;
  background: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 2px,
    var(--twin-effects-scanlines-color, #1de9ff) 3px
  );
  opacity: var(--twin-effects-scanlines-opacity, 0.06);
  mix-blend-mode: screen;
  animation: twin-scanlines-move var(--twin-effects-scanlines-period-ms, 4000ms) linear infinite;
}
@keyframes twin-scanlines-move {
  from { background-position-y: 0; }
  to { background-position-y: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .twin-scanlines { animation: none; }
}
</style>
