// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/modules/digital-twin.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §8。

import { request } from '@/api/request'        // 自适应宿主：admin 模板复用其自带 request；独立项目用 §10 最小封装
import { MOCK_ENABLED } from '@/config'
import type { IDigitalTwinApi, DigitalTwinRequestOptions } from '@/api/interfaces/digital-twin'
import type {
  BuildingQueryParams, BuildingRuntimeItem,
  FloorDetail, FloorDetailQueryParams,
  PoiQueryParams, PoiRuntimeItem,
  PoiDetail, PoiDetailQueryParams,
} from '@/api/types/digital-twin'
import { MockDigitalTwinApi } from '@/mock/api/digital-twin'

class RealDigitalTwinApi implements IDigitalTwinApi {
  async getBuildings(params?: BuildingQueryParams, opts?: DigitalTwinRequestOptions): Promise<BuildingRuntimeItem[]> {
    return request<BuildingRuntimeItem[]>({ url: '/api/manager/park/buildings', method: 'GET', params, signal: opts?.signal })
  }
  async getFloorDetail(params: FloorDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<FloorDetail> {
    return request<FloorDetail>({ url: '/api/manager/park/floor-detail', method: 'GET', params, signal: opts?.signal })
  }
  async getPois(params?: PoiQueryParams, opts?: DigitalTwinRequestOptions): Promise<PoiRuntimeItem[]> {
    return request<PoiRuntimeItem[]>({ url: '/api/manager/park/pois', method: 'GET', params, signal: opts?.signal })
  }
  async getPoiDetail(params: PoiDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<PoiDetail> {
    return request<PoiDetail>({ url: '/api/manager/park/poi-detail', method: 'GET', params, signal: opts?.signal })
  }
}

// ---- 工厂函数（Simple Factory）----

export function createDigitalTwinApi(): IDigitalTwinApi {
  return MOCK_ENABLED ? new MockDigitalTwinApi() : new RealDigitalTwinApi()
}

// ---- 模块实例（模块级单例，模块加载时执行一次）----

export const digitalTwinApi = createDigitalTwinApi()
