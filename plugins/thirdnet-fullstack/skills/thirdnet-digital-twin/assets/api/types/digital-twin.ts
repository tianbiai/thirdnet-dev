// 本文件为 thirdnet-digital-twin 技能提供的可拷贝模板（assets/api/types/digital-twin.ts），
// 生成时照搬、仅按需对齐 import 路径；勿手写改动字段。源：references/dynamic-data-api.md §4。

// ---- 楼幢业务数据（getBuildings 返回项）----

/** 楼幢运行期数据。building_id 与静态脚手架 buildings[].id 对应（join key）。 */
export interface BuildingRuntimeItem {
  building_id: string          // 与 src/data/<park>.ts 静态占地 id 一致
  name: string                 // 楼幢名 → 楼顶常驻标签 + 切换器标签 + 详情标题
  floors: number               // 楼层数 → 决定挤出高度 floors*floorHeight + 楼层拾取板数量
  floor_ids: string[]          // 各楼层 id → 点击后用于 getFloorDetail
  header?: string              // 详情/切换器后缀，如 "10F · 12单位"
}

export interface BuildingQueryParams {
  park_id?: string             // 单园区驾驶舱可省略
}

// ---- 楼层详情（getFloorDetail 返回）----

export interface FloorDetailQueryParams {
  building_id: string
  floor_id: string             // 取自 BuildingRuntimeItem.floor_ids
}

/**
 * 单位详情。办公园区默认字段全集如下（generate_data.py 产出的 Mock 与 UnitDetail.vue 面板行序对齐）。
 * v2.7：非办公园区可由 spec.unitTemplate.fields 驱动——此时 Mock 产出 fields:[{label,value}]，
 * UnitDetail.vue 优先渲染 fields（覆盖下列办公字段），用于工业/物流/住宅等场景。
 */
export interface UnitDetail {
  unit_id: string
  name: string                // 单位名（公司名）
  tenant?: string             // 租户简称
  contact_person?: string     // 负责人
  contact_phone?: string      // 联系电话
  staff_count?: number        // 在编人员
  area?: number               // 办公面积 ㎡
  nature?: string             // 单位性质（民营/国有/合资/外资/事业）
  service_hours?: string      // 服务时间
  business_scope?: string     // 业务范围
  responsibilities?: string   // 职责
  /** v2.7：自定义字段（spec.unitTemplate.fields 驱动）。存在时 UnitDetail.vue 优先渲染它，覆盖上方办公字段。 */
  fields?: { label: string; value: string }[]
  /** v2.15：叙事档案块（参照 Park 驾驶舱 ParkUnit）。存在时 UnitDetail.vue 追加渲染「业务范围/单位介绍/主要职责/结尾语」段落。 */
  subtitle?: string           // 副标题，如 "A楼 5F · 互联网科技 · 在驻"
  scope?: string              // 业务范围一句话（与 business_scope 互补：后者偏结构化、本字段偏文案）
  intro_title?: string        // 单位介绍标题
  intro_body?: string         // 单位介绍正文
  duties?: string[]           // 主要职责列表
  closing?: string            // 结尾语
}

export interface FloorDetail {
  building_id: string
  floor_id: string
  label: string                // "1F".."10F"
  tenant?: string              // 该层主租户
  units: UnitDetail[]          // ≥1；>1 时启用左右单位切换
}

// ---- POI 点位（getPois 返回项）----

/** POI 运行期状态——驱动标记颜色/动画。 */
export enum PoiStatusEnum {
  Online = 'online',           // 在线/正常
  Offline = 'offline',         // 离线
  Alarm = 'alarm',             // 告警
  Idle = 'idle',               // 空闲/待机
}

/** POI 类型——对齐 spec 的 PoiType（references/park-spec.md）。 */
export enum PoiTypeEnum {
  Entrance = 'entrance',       // 出入口
  Exit = 'exit',               // 出口
  Camera = 'camera',           // 监控摄像头
  Gate = 'gate',               // 闸机/道闸
  Service = 'service',         // 服务点
  Landmark = 'landmark',       // 地标/景观
  Parking = 'parking',         // 停车场（地面/地下入口）
  Custom = 'custom',           // 其它
}

/** POI 运行期数据。坐标(x/z/y)来自后端，室内点位用 building_id + floor_index 绑定。 */
export interface PoiRuntimeItem {
  poi_id: string
  type: PoiTypeEnum | string   // v2.7：已知 8 类用 PoiTypeEnum；自定义类型以原样字符串透传（通用圆点标记）
  label: string
  x: number                    // 世界坐标 X
  z: number                    // 世界坐标 Z
  y?: number                   // 高度；默认地面（0）
  building_id?: string         // 室内点位绑定到 buildings[].id
  garage_id?: string           // 地下点位绑定到 garages[].id（v2.7）
  floor_index?: number         // 室内点位楼层：0=地面层、正=地上、负=地下（-1=B1）；v2.7 起允许负值
  status: PoiStatusEnum        // 实时状态 → 标记颜色/动画
  tooltip?: {
    title?: string             // 缺省取 label
    description?: string
    meta?: Record<string, string>   // 键值对，如 负责人/电话/状态/容量
  }
  /** 停车场类 POI 的占用数据（v1.3 起「外包」给后台的车库占用并入此处）。 */
  occupancy?: {
    capacity: number
    occupied: number
    empty: number
  }
  /** v2.12 功能房间结构化字段（政务/功能房间等非标准 POI）。PoiOverlay 优先渲染它。 */
  room_spec?: {
    area?: string | number        // 面积（带单位如 '49.8㎡' 或纯数字 ㎡）
    capacity?: string | number    // 容纳人数（'5人' 或 5）
    dept?: string                 // 隶属部门
    duty?: string                 // 职责/业务范围
  }
}

export interface PoiQueryParams {
  park_id?: string
  building_id?: string         // 只取某栋楼（含室内）的 POI
  type?: PoiTypeEnum | string  // 只取某类（v2.7：可为自定义类型字符串）
}

// ---- POI 业务详情（getPoiDetail 返回，v2.15）----

/**
 * 详情卡片键值对行（POI/单位档案通用）——参照 Park 驾驶舱 ParkDetailField。
 * 后端按 (type, ref_id) 分派查业务表，前端只发 poi_id；业务表零改动。
 */
export interface PoiDetailField {
  label: string                // 标签，如 "IP 地址"
  value: string                // 值，如 "10.20.1.11"
}

export interface PoiDetailQueryParams {
  park_id?: string             // 单园区可省略
  poi_id: string
}

/**
 * POI 业务详情（v2.15）。通用键值包——静态档案 fields + 实时指标 live，
 * 而非强类型 camera/gate 联合（便于后端按类型分派、前端零改造成本扩展类型）。
 * 失败/缺失时 PoiOverlay 降级读列表项的 inline tooltip/room_spec/occupancy（向后兼容）。
 */
export interface PoiDetail {
  poi_id: string
  ref_id?: string              // 关联业务实体 id（透传，便于追溯）
  type: PoiTypeEnum | string
  title: string                // 设备/点位名
  subtitle?: string            // 型号 / 安装位置
  status: PoiStatusEnum        // 实时状态（详情时刻最新值）
  fields: PoiDetailField[]     // 静态档案（IP/厂家/设备编码…）
  live?: PoiDetailField[]      // 实时指标（今日通行/最近抓拍…），可选
}
