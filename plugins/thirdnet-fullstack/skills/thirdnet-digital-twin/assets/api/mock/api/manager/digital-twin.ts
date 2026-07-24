// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/mock/api/manager/digital-twin.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §7。

import type { IDigitalTwinApi, DigitalTwinRequestOptions } from '@/api/interfaces/manager/digital-twin'
import type {
  BuildingQueryParams, BuildingRuntimeItem,
  FloorDetail, FloorDetailQueryParams,
  PoiQueryParams, PoiRuntimeItem,
  PoiDetail, PoiDetailQueryParams,
} from '@/api/types/digital-twin'
import { ApiError } from '@/api/request'   // v1.8: Mock 也抛 ApiError，与 Real 错误类型一致
import { mockBuildings, mockFloorDetails, mockPois, mockPoiDetails } from '@/mock/data/manager/digital-twin'

export class MockDigitalTwinApi implements IDigitalTwinApi {
  async getBuildings(_params?: BuildingQueryParams, _opts?: DigitalTwinRequestOptions): Promise<BuildingRuntimeItem[]> {
    return mockBuildings
  }

  async getFloorDetail(params: FloorDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<FloorDetail> {
    // v2.1: mockFloorDetails 为数组形态（generate_data.py 产物），按 building_id + floor_id 查找
    const detail = mockFloorDetails.find(
      (d) => d.building_id === params.building_id && d.floor_id === params.floor_id,
    )
    // v1.8: 抛 ApiError(404) 而非裸 Error——与 Real 一致，组件 instanceof ApiError 可判 status
    if (!detail) throw new ApiError(404, `Floor ${params.building_id}:${params.floor_id} not found`)
    // v1.8: 响应调用方取消（Mock 也尊重 signal，便于测试 race）
    if (opts?.signal?.aborted) throw new ApiError(0, 'aborted')
    return detail
  }

  async getPois(params?: PoiQueryParams, _opts?: DigitalTwinRequestOptions): Promise<PoiRuntimeItem[]> {
    let list = mockPois
    if (params?.building_id) list = list.filter(p => p.building_id === params.building_id)
    if (params?.type) list = list.filter(p => p.type === params.type)
    return list
  }

  async getPoiDetail(params: PoiDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<PoiDetail> {
    // v2.15: mockPoiDetails 按 poi_id 索引（generate_data.py 产物），缺失抛 404——与 getFloorDetail 同款
    const detail = mockPoiDetails[params.poi_id]
    if (!detail) throw new ApiError(404, `POI ${params.poi_id} 的业务详情不存在`)
    if (opts?.signal?.aborted) throw new ApiError(0, 'aborted')
    return detail
  }
}
