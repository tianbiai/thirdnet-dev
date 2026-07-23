/**
 * useSelection.ts —— 选中态模块级单例（v2.1 范式文件，拷贝到 src/composables/useSelection.ts）。
 *
 * 契约出处：references/scene-recipe.md §8.1——「悬停预览 + 已锁定楼层」的合成选中，
 * 单一数据源；3D 指针回调与楼栋切换器都写这里，watch 单向推回场景。
 *
 * ⛔ 铁律：楼层点击必须一次性写入「楼 + 层」（selectFloor），点击之后绝不能再调用
 *    focusBuilding（它会清空 floorIndex → 鼠标移开后金色高亮消失，§8 反面模式）。
 *    - selectFloor：3D 楼层点击（楼 + 层原子写入）
 *    - focusBuilding：仅「切换器标签页」用（聚焦整楼、重置楼层）
 *    - clearFocus：点空白 / 切回全局（全清）
 *    - setHover：只写 hover*，不动 focused/floor
 *
 * v1.8 POI 单开契约：openPoiId 与 focusedBuildingId 平行——同一时刻至多一个 POI 打开；
 * 点新 POI 覆盖旧的，点空白 / Esc / 再点同 POI 关闭。
 *
 * v2.6 地下车库：belowView（驱动相机 setBelowView）+ selectedGarageId（驱动 GarageCard），
 * 与楼上楼栋/楼层/POI 互斥——进地下即清楼上聚焦；选楼上即退地下。
 */
import { ref, computed } from 'vue'

const focusedBuildingId = ref<string | null>(null) // 聚焦楼（null = 全局概览）
const floorIndex = ref<number | null>(null)        // 已锁定楼层（null = 未锁定）
const unitIndex = ref(0)                           // UnitDetail 多单位切换下标
const hoverBuildingId = ref<string | null>(null)
const hoverFloorIndex = ref<number | null>(null)
const openPoiId = ref<string | null>(null)         // v1.8：当前打开的 POI（单开）
const belowView = ref(false)                        // v2.6：地下视角（GlobalTwin watch → scene.setBelowView）
const selectedGarageId = ref<string | null>(null)   // v2.6：选中车库（CenterStage watch → GarageCard）

// 有效选中 = 悬停 ?? 已选。金色高亮 watch 这两个 computed。
const effBuildingId = computed(() => hoverBuildingId.value ?? focusedBuildingId.value)
const effFloorIndex = computed(() => hoverFloorIndex.value ?? floorIndex.value)

/** v2.6 退地下辅助：选楼上/切全局即清地下视角与车库选中（selectFloor/focusBuilding/clearFocus 共用）。 */
function resetUnderground() {
  belowView.value = false
  selectedGarageId.value = null
}

/** 3D 楼层点击专用：楼 + 层一次性原子写入（切换器勿用，见 focusBuilding）。 */
function selectFloor(bid: string, fin: number) {
  focusedBuildingId.value = bid
  floorIndex.value = fin
  unitIndex.value = 0
  resetUnderground()
}

/** 仅「切换器标签页」用：聚焦某楼、重置楼层。⛔ 绝不在楼层点击里调用。 */
function focusBuilding(bid: string | null) {
  focusedBuildingId.value = bid
  floorIndex.value = null
  unitIndex.value = 0
  resetUnderground()
}

/** 切回全局：全清（点空白/非楼栋物体的取消入口）。 */
function clearFocus() {
  focusedBuildingId.value = null
  floorIndex.value = null
  hoverBuildingId.value = null
  hoverFloorIndex.value = null
  openPoiId.value = null
  unitIndex.value = 0
  resetUnderground()
}

/** 悬停：只写 hover*（eff 立即变，聚焦/锁定不动）。 */
function setHover(bid: string | null, fin: number | null) {
  hoverBuildingId.value = bid
  hoverFloorIndex.value = fin
}

/** POI 单开：打开新 POI（覆盖旧的）；传同 id 或 null 关闭。 */
function openPoi(poiId: string | null) {
  openPoiId.value = poiId === openPoiId.value ? null : poiId
}
function closePoi() {
  openPoiId.value = null
}

function setUnit(i: number) {
  unitIndex.value = i
}

/** v2.6 进入地下视角（切换器「地下车库」标签）：开 belowView + 清楼上聚焦/POI。 */
function enterBelowView() {
  belowView.value = true
  focusedBuildingId.value = null
  floorIndex.value = null
  openPoiId.value = null
}
/** v2.6 选中车库（地下视角下点击坑体）：与楼上/POI 互斥；传 null = 取消（保留地下视角）。 */
function selectGarage(id: string | null) {
  selectedGarageId.value = id
  if (id) {
    focusedBuildingId.value = null
    floorIndex.value = null
    openPoiId.value = null
  }
}

export function useSelection() {
  return {
    focusedBuildingId, floorIndex, unitIndex,
    hoverBuildingId, hoverFloorIndex,
    effBuildingId, effFloorIndex,
    openPoiId,
    belowView, selectedGarageId,
    selectFloor, focusBuilding, clearFocus, setHover,
    openPoi, closePoi, setUnit,
    enterBelowView, selectGarage,
  }
}
