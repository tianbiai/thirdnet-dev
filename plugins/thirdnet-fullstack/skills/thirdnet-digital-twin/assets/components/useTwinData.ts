/**
 * useTwinData.ts —— 数字孪生动态数据中心（v2.1 范式文件，
 * 拷贝到 src/composables/useTwinData.ts）。
 *
 * 模块级响应式单例（项目无 pinia 时的轻量约定）：GlobalTwin 拉取
 * IDigitalTwinApi 数据后写这里；BuildingSwitcher / UnitDetail / PoiOverlay 只读。
 * 三态兜底（加载/空/错误）按 references/shell.md「空 / 加载 / 错误态」契约：
 * 按方法独立错误 + 重试入口，绝不静默 catch。
 */
import { ref, computed } from 'vue'
import type { BuildingRuntimeItem, FloorDetail, PoiRuntimeItem, PoiDetail } from '@/api/types/digital-twin'

/** ApiError.status → 用户可读文案（shell.md 契约）。 */
export function errMsg(e: unknown): string {
  const status = (e as { status?: number })?.status
  if (status === 401) return '未授权，请重新登录'
  if (status === 404) return '数据不存在'
  if (status && status >= 500) return '服务端异常，请稍后重试'
  return '网络异常，请检查连接'
}

const buildings = ref<BuildingRuntimeItem[]>([])
const pois = ref<PoiRuntimeItem[]>([])
const floorDetail = ref<FloorDetail | null>(null)
const poiDetail = ref<PoiDetail | null>(null)        // v2.15：POI 业务详情（getPoiDetail 拉取）
const hoverPoiId = ref<string | null>(null)   // 悬停 POI（ParkScene onPoiHover 写入）

const hydrating = ref(true)               // 首屏水合中（脚手架先行，不白屏）
const buildingsError = ref<string | null>(null)
const poisError = ref<string | null>(null)
const floorDetailLoading = ref(false)
const floorDetailError = ref<string | null>(null)
const poiDetailLoading = ref(false)             // v2.15
const poiDetailError = ref<string | null>(null) // v2.15

const buildingCount = computed(() => buildings.value.length)

/** 楼幢名查询——直接访问 buildings.value（响应式：在 computed / 模板内调用即跟踪 buildings）。 */
export function buildingName(id: string): string {
  return buildings.value.find((b) => b.building_id === id)?.name ?? id
}
/** POI 按 id 查询——直接访问 pois.value（响应式：在 computed / 模板内调用即跟踪 pois）。 */
export function poiById(id: string | null): PoiRuntimeItem | undefined {
  return id == null ? undefined : pois.value.find((p) => p.poi_id === id)
}

function setBuildings(items: BuildingRuntimeItem[]) { buildings.value = items }
function setPois(items: PoiRuntimeItem[]) { pois.value = items }
function setFloorDetail(d: FloorDetail | null) { floorDetail.value = d }
function setHoverPoi(id: string | null) { hoverPoiId.value = id }
function setPoiDetail(d: PoiDetail | null) { poiDetail.value = d }

export function useTwinData() {
  return {
    buildings, pois, floorDetail, poiDetail, hoverPoiId,
    hydrating, buildingsError, poisError,
    floorDetailLoading, floorDetailError,
    poiDetailLoading, poiDetailError,
    buildingCount,
    setBuildings, setPois, setFloorDetail, setHoverPoi, setPoiDetail,
    // errMsg / buildingName / poiById 作为命名导出消费（不挂返回对象，避免 computed 返回函数的反模式）。
  }
}
