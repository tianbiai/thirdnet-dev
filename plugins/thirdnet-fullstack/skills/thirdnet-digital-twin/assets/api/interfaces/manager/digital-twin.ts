// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/interfaces/manager/digital-twin.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §5。

import type {
  BuildingRuntimeItem, BuildingQueryParams,
  FloorDetail, FloorDetailQueryParams,
  PoiRuntimeItem, PoiQueryParams,
  PoiDetail, PoiDetailQueryParams,
} from '@/api/types/digital-twin'

/** v1.8: 调用选项——透传 AbortSignal 以取消请求（防快速切换楼层 race）。 */
export interface DigitalTwinRequestOptions {
  signal?: AbortSignal
}

export interface IDigitalTwinApi {
  /** 楼幢业务数据（名/楼层数/floor_ids）。水合楼栋高度、楼顶标签、切换器。 */
  getBuildings(params?: BuildingQueryParams, opts?: DigitalTwinRequestOptions): Promise<BuildingRuntimeItem[]>
  /** 楼层详情（租户/单位）。点击楼层后按需拉取，驱动 UnitDetail 面板。 */
  getFloorDetail(params: FloorDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<FloorDetail>
  /** POI 点位（设备/监控/停车场 + 实时状态 + 占用）。水合 POI 标记层。 */
  getPois(params?: PoiQueryParams, opts?: DigitalTwinRequestOptions): Promise<PoiRuntimeItem[]>
  /** v2.15: POI 业务详情（静态档案 fields + 实时指标 live）。点击 POI 后按需拉取，驱动 PoiOverlay 详情卡。
   * 失败时 PoiOverlay 降级读列表项 inline tooltip/room_spec/occupancy（向后兼容）。 */
  getPoiDetail(params: PoiDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<PoiDetail>
}
