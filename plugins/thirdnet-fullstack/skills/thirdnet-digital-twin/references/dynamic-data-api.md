# 动态数据 API 契约层（Dynamic Data API）

数字孪生页面的数据分两层（v1.5 起）：

- **基础信息**（场景脚手架）—— 生成时从 Park Spec **静态内联**进页面（楼栋占地几何、园区环境、风格 token、舞台尺寸）。详见 `park-spec.md` 与 `scene-recipe.md`。
- **动态数据**（运营/业务数据）—— 运行期**通过后端 API 获取**，开发期由 Mock 返回、正式环境走真实 API。

本文件是「动态数据」层的唯一事实来源：定义接口契约、类型、Mock/Real 实现、工厂切换、组件水合时序，以及后端须实现的端点契约（**前端先行**）。规范细节（5 文件契约层、`IXxxApi`+Real/Mock+工厂、`VITE_MOCK_ENABLED`、GET/POST-only、snake_case、响应无信封）**严格遵循 `api-typescript-spec` 技能**——本文件只补数字孪生特有的内容，不重复抄其正文。编写或修改动态数据层前，若对契约层模式有疑问，先读 `api-typescript-spec`。

## 目录

1. [数据分层总表](#1-数据分层总表)
2. [脚手架先行，再水合（页面加载时序）](#2-脚手架先行再水合页面加载时序)
3. [5 文件契约层结构](#3-5-文件契约层结构)
4. [类型定义 `api/types/digital-twin.ts`](#4-类型定义)
5. [接口契约 `IDigitalTwinApi`](#5-接口契约)
6. [Mock 数据（由 spec 派生）`mock/data/manager/digital-twin.ts`](#6-mock-数据由-spec-派生)
7. [Mock 实现 `mock/api/manager/digital-twin.ts`](#7-mock-实现)
8. [Real 实现 + 工厂 `api/modules/manager/digital-twin.ts`](#8-real-实现--工厂)
9. [组件水合 `.vue`](#9-组件水合)
10. [自适应宿主（请求基础设施）](#10-自适应宿主请求基础设施)
11. [后端接口契约（前端先行）](#11-后端接口契约前端先行)
12. [POI 状态色 token 扩展](#12-poi-状态色-token-扩展)

---

## 1. 数据分层总表

`spec.json` 仍是**创作唯一事实来源**（生成时读取）。生成器把它的内容**分区输出**：

| 数据 | 归属 | 生成去向 | 运行期来源 |
|---|---|---|---|
| 视觉风格 / theme tokens / shaders / 字体 | 基础信息 | 编译进页面（`_tokens.scss` / `theme.ts` / `:root`） | 静态 |
| 舞台尺寸 / boundary / floorHeight | 基础信息 | 编译进场景 | 静态 |
| **楼栋位置与占地**（id / w / d / x / z / category / facing） | 基础信息 | 编译进 `src/data/<park>.ts`（脚手架） | 静态 |
| 园区环境（道路 / 绿化 / 周边市政 / 围墙 / 路灯） | 基础信息 | 编译进场景（`spec.environment`） | 静态 |
| Legend 类别 / switcher 骨架 | 基础信息 | 编译进页面 | 静态 |
| **楼幢业务数据**（name / floors 楼层数 / floor_ids / header） | **动态** | 派生为 mock 数据 + API 契约 | `getBuildings()` |
| **楼层详情**（租户/单位，点击楼层后取） | **动态** | 派生为 mock 数据 + API 契约 | `getFloorDetail()` |
| **POI 点位**（设备 / 停车场位置 / 监控等，含坐标与实时状态 + 占用） | **动态** | 派生为 mock 数据 + API 契约 | `getPois()` |

**为什么这样切**：楼栋的**物理位置/占地**是场景配置（改建才变，生成时内联）；楼栋的**业务身份**（叫什么名、有几层、每层有什么）和**运营点位**（设备/监控/停车场及其实时状态）是后端管理的业务数据——这些是数字孪生「活」的部分，必须走 API。spec 在生成时仍是这些动态数据的**种子**（派生为 Mock），保证开发期开箱即用、不依赖后端。

## 2. 脚手架先行，再水合（页面加载时序）

动态数据是异步的，所以页面按「**先画骨架，再填血肉**」水合，避免白屏与布局抖动：

```
┌─ 1. 静态脚手架（同步，来自 spec）──────────────────────────┐
│   环境（道路/绿化/周边/围墙/路灯）+ 楼栋占地底板（id+w/d/x/z）  │
│   + Legend + 相机取景（K=0.66，按 spec 几何推导，不依赖动态数据） │
└──────────────────────────────────────────────────────────┘
        │  onMounted：Promise.all([getBuildings(), getPois()])
        ▼
┌─ 2. 水合楼栋（getBuildings 返回后）─────────────────────────┐
│   按返回的 floors 把占地底板挤出为完整盒体（floors × floorHeight）│
│   + 楼顶名称标签（name）+ 注册楼层拾取板（floor_ids）           │
│   + BuildingSwitcher 标签水合 name                             │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌─ 3. 水合 POI（getPois 返回后）──────────────────────────────┐
│   渲染设备/监控/停车场标记杆+图标，按 status 上色/动画          │
│   停车场 POI 的 occupancy 可在 tooltip 里显示                  │
└──────────────────────────────────────────────────────────┘
        │  点击某楼层
        ▼
┌─ 4. 楼层详情（getFloorDetail 按需）─────────────────────────┐
│   弹 UnitDetail 面板：tenant / units（租户/单位）              │
└──────────────────────────────────────────────────────────┘
```

**关键约束**：
- 相机取景 `frameCamera()` 只用**静态几何**（boundary、最高楼估算），**不能**等 `getBuildings()` 才取景——否则水合前白屏。水合后楼栋高度可能与估算略有出入，可接受（取景留了 K=0.66 余量）；若要精确，在水合完成后再 `frameCamera()` 一次。
- 水合前楼栋以**占地底板**（一个低 `BoxGeometry` 或 `PlaneGeometry`，高 ~2 单位）占位，水合后替换/挤出为完整盒体。
- loading / 空 / 错误三态都要兜底（对齐技能既有的 `@error` 兜底哲学）：请求中显示骨架/底板；请求失败显示降级提示并保留脚手架可交互；`getPois()` 返回空数组则不渲染 POI（不报错）。

## 3. 5 文件契约层结构

对齐 `api-typescript-spec`，endpoint 用 `manager`（管理端驾驶舱）：

```
src/
├── config/index.ts                          # MOCK_ENABLED、API_BASE_URL（自适应宿主，见 §10）
├── api/
│   ├── request.ts                           # 统一 request<T>()（自适应宿主，见 §10）
│   ├── types/
│   │   └── digital-twin.ts                  # ① 类型 + 枚举
│   ├── interfaces/manager/
│   │   └── digital-twin.ts                  # ② IDigitalTwinApi 接口契约
│   └── modules/manager/
│       └── digital-twin.ts                  # ③ RealDigitalTwinApi + createDigitalTwinApi() + 单例
└── mock/
    ├── api/manager/
    │   └── digital-twin.ts                  # ④ MockDigitalTwinApi
    └── data/manager/
        └── digital-twin.ts                  # ⑤ 纯 Mock 数据（由生成器从 spec 派生）
```

> Admin 模板宿主（`create-thirdnet-admin`）的 `api/interfaces/` 是**扁平**结构（无 `manager/` 子目录）——此时把 ② 放 `src/api/interfaces/digital-twin.ts`，③④⑤ 仍按 `manager/` 嵌套。详见 §10。

## 4. 类型定义

`src/api/types/digital-twin.ts` —— 字段全 snake_case，与后端 `*Map` DTO 一致（对齐 `api-typescript-spec`「字段名强制 snake_case」）。

> **命名约定边界（v1.8）**：这些 snake_case 字段是 **HTTP DTO 形态**（后端响应）。两种做法皆可：① 直接在组件里用 snake_case（最省事，类型即契约，零漂移）；② Real 工厂层（§8）在 `request<T>()` 返回后映射为 camelCase（`buildingId`/`floorIndex`/`poiId`），让组件层只接触 camelCase（与 `park-spec.md` 的 `PoiSpec.buildingId/floorIndex` 一致）。**选定一种并在整个数字孪生模块内统一**。下文示例保持 snake_case（做法①）。spec 层 `PoiSpec` 的 camelCase 字段在派生 Mock 时按本节 snake_case 形态转写。

```ts
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
 * 单位详情。镜像范例 src/data/unit.ts 的 UnitDetail 形状
 * （见 references/exemplar.md 与 shell.md）——生成时按宿主既有 UnitDetail 字段对齐。
 */
export interface UnitDetail {
  unit_id: string
  name: string
  tenant?: string
  area?: number
  nature?: string
  // ...其余字段以宿主 src/data/unit.ts 为准，保持 snake_case
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
  type: PoiTypeEnum
  label: string
  x: number                    // 世界坐标 X
  z: number                    // 世界坐标 Z
  y?: number                   // 高度；默认地面（0）
  building_id?: string         // 室内点位绑定到 buildings[].id
  floor_index?: number         // 室内点位楼层（从 0 开始）
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
}

export interface PoiQueryParams {
  park_id?: string
  building_id?: string         // 只取某栋楼（含室内）的 POI
  type?: PoiTypeEnum           // 只取某类
}
```

## 5. 接口契约

`src/api/interfaces/manager/digital-twin.ts`（Admin 模板扁平宿主：`src/api/interfaces/digital-twin.ts`）。

数字孪生动态数据全是**只读聚合查询**，所以一个接口承载三方法即可（后端仍可按模块拆 Controller，前端契约层合一无妨）。GET-only、响应**无 `{code,message,data}` 信封**——列表直接返回数组、详情直接返回对象（对齐 `api-typescript-spec` 与后端 `net-api-developer`）。

```ts
import type {
  BuildingRuntimeItem, BuildingQueryParams,
  FloorDetail, FloorDetailQueryParams,
  PoiRuntimeItem, PoiQueryParams,
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
}
```

## 6. Mock 数据（由 spec 派生）

`src/mock/data/manager/digital-twin.ts` —— **纯数据导出**，由生成器从已确认的 Park Spec 派生（不硬编码，对齐技能铁律）。这份文件就是「开发期/演示期的后端」。

```ts
import type { BuildingRuntimeItem, FloorDetail, PoiRuntimeItem } from '@/api/types/digital-twin'
import { PoiStatusEnum, PoiTypeEnum } from '@/api/types/digital-twin'

// ↓↓↓ 生成器从 spec.buildings[] 派生（取 name/floors；floor_ids 按 floors 程序化生成；
//     floors_detail 有则用于 FloorDetail mock） ↓↓↓
export const mockBuildings: BuildingRuntimeItem[] = [
  { building_id: 'main', name: '主楼', floors: 10, floor_ids: ['main-0','main-1',/*...*/'main-9'], header: '10F · 12单位' },
  // ...每栋一项；building_id 必须与 src/data/<park>.ts 静态占地 id 一致
]

// ↓↓↓ 生成器从 spec.buildings[].floors_detail[] 派生；没有 floors_detail 的楼层返回占位 ↓↓↓
export const mockFloorDetails: Record<string, FloorDetail> = {
  // key = `${building_id}:${floor_id}`
  'main:main-5': {
    building_id: 'main', floor_id: 'main-5', label: '6F',
    tenant: '某某科技', units: [/* UnitDetail[]，来自 floors_detail[].units */],
  },
}

// ↓↓↓ 生成器从 spec.pois[] 派生（坐标/类型/tooltip 直接搬）；status 由生成器给合理初值 ↓↓↓
export const mockPois: PoiRuntimeItem[] = [
  {
    poi_id: 'cam-main', type: PoiTypeEnum.Camera, label: '主楼监控',
    x: 40, z: -20, building_id: 'main', floor_index: 0,
    status: PoiStatusEnum.Online,
    tooltip: { description: '主楼大堂摄像头', meta: { 负责人: '张三', 状态: '在线' } },
  },
  {
    poi_id: 'garage-entry', type: PoiTypeEnum.Parking, label: '地下车库入口',
    x: -30, z: 30, status: PoiStatusEnum.Online,
    occupancy: { capacity: 320, occupied: 224, empty: 96 },  // ← v1.3 外包的车库占用在这里
    tooltip: { meta: { 总车位: '320', 空位: '96' } },
  },
  // ...
]
```

## 7. Mock 实现

`src/mock/api/manager/digital-twin.ts` —— `async` 方法直接返回派生数据（用 `async` 仅为符合 `Promise<T>` 签名；如需模拟网络延迟可包 `await new Promise(r => setTimeout(r, 200))`，但非约定）。

```ts
import type { IDigitalTwinApi, DigitalTwinRequestOptions } from '@/api/interfaces/manager/digital-twin'
import type {
  BuildingQueryParams, BuildingRuntimeItem,
  FloorDetail, FloorDetailQueryParams,
  PoiQueryParams, PoiRuntimeItem,
} from '@/api/types/digital-twin'
import { ApiError } from '@/api/request'   // v1.8: Mock 也抛 ApiError，与 Real 错误类型一致
import { mockBuildings, mockFloorDetails, mockPois } from '@/mock/data/manager/digital-twin'

export class MockDigitalTwinApi implements IDigitalTwinApi {
  async getBuildings(_params?: BuildingQueryParams, _opts?: DigitalTwinRequestOptions): Promise<BuildingRuntimeItem[]> {
    return mockBuildings
  }

  async getFloorDetail(params: FloorDetailQueryParams, opts?: DigitalTwinRequestOptions): Promise<FloorDetail> {
    const key = `${params.building_id}:${params.floor_id}`
    const detail = mockFloorDetails[key]
    // v1.8: 抛 ApiError(404) 而非裸 Error——与 Real 一致，组件 instanceof ApiError 可判 status
    if (!detail) throw new ApiError(404, `Floor ${key} not found`)
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
}
```

## 8. Real 实现 + 工厂

`src/api/modules/manager/digital-twin.ts` —— Real 适配 HTTP，工厂按 `MOCK_ENABLED` 选实例，模块级单例（对齐 `api-typescript-spec` 三模式：策略 + 简单工厂 + 适配器）。

```ts
import { request } from '@/api/request'        // 自适应宿主：admin 模板复用其自带 request；独立项目用 §10 最小封装
import { MOCK_ENABLED } from '@/config'
import type { IDigitalTwinApi } from '@/api/interfaces/manager/digital-twin'
import type {
  BuildingQueryParams, BuildingRuntimeItem,
  FloorDetail, FloorDetailQueryParams,
  PoiQueryParams, PoiRuntimeItem,
} from '@/api/types/digital-twin'
import { MockDigitalTwinApi } from '@/mock/api/manager/digital-twin'

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
}

// ---- 工厂函数（Simple Factory）----

export function createDigitalTwinApi(): IDigitalTwinApi {
  return MOCK_ENABLED ? new MockDigitalTwinApi() : new RealDigitalTwinApi()
}

// ---- 模块实例（模块级单例，模块加载时执行一次）----

export const digitalTwinApi = createDigitalTwinApi()
```

调用方（`.vue` 组件）只看到 `IDigitalTwinApi` 类型，Real/Mock 对其透明。

## 9. 组件水合

`src/components/center/GlobalTwin.vue`（挂载 `<canvas>` + 实例化 `ParkScene`）在 `onMounted` 拉取动态数据并驱动 `ParkScene` 的命令式水合 API：

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { digitalTwinApi } from '@/api/modules/manager/digital-twin'
import { ApiError } from '@/api/request'            // v1.8: 统一错误类型（Mock/Real 一致）
import { useSelection } from '@/composables/useSelection'
import { ParkScene } from '@/scene/ParkScene'
import type { BuildingRuntimeItem, PoiRuntimeItem } from '@/api/types/digital-twin'

const canvas = ref<HTMLCanvasElement>()
let scene: ParkScene | null = null
const selection = useSelection()
const hydrating = ref(true)
// v1.8: 拆为按方法的错误态——POI 失败不再连累楼栋水合（Promise.allSettled + 独立状态）
const buildingsError = ref<string>()
const poisError = ref<string>()
const floorDetailError = ref<string>()

onMounted(async () => {
  // 1. 静态脚手架（同步，来自 spec）—— 环境已由 ParkScene 构造时按 spec.buildings 占地 + environment 建好
  scene = new ParkScene(canvas.value!, /* spec 派生的静态脚手架 */)

  // 2+3. 并行水合楼栋 + POI。v1.8: 用 Promise.allSettled 而非 Promise.all——
  //     一个失败不再整批 reject 冲掉另一个已成功的水合；各自 try/catch 写独立错误态。
  const [bRes, pRes] = await Promise.allSettled([
    digitalTwinApi.getBuildings(),
    digitalTwinApi.getPois(),
  ])
  if (bRes.status === 'fulfilled') {
    scene.hydrateBuildings(bRes.value)   // 按 floors 挤出 + 楼顶标签 + 楼层拾取板(floor_ids)
  } else {
    buildingsError.value = errMsg(bRes.reason)   // 降级：脚手架仍可交互，楼名/高度缺失
  }
  if (pRes.status === 'fulfilled') {
    scene.hydratePois(pRes.value)         // POI 标记 + 状态色
  } else {
    poisError.value = errMsg(pRes.reason) // 降级：POI 缺失，楼栋仍可用
  }
  hydrating.value = false
})

// 4. 点击楼层 → 按需拉楼层详情。v1.8: AbortSignal + onCleanup 防快速切换 race
//    （慢请求覆盖新请求）+ 单次超时；错误不再静默吞，写 floorDetailError 驱动面板内联报错 + 重试。
watch(() => [selection.focusedBuildingId, selection.floorIndex], async ([bid, fin], _old, onCleanup) => {
  floorDetailError.value = undefined
  if (!bid || fin == null || !scene) return
  const floorId = scene.getFloorId(bid, fin)         // 由水合时注册的 floor_ids 取
  if (!floorId) return
  const controller = new AbortController()
  onCleanup(() => controller.abort())                // 切换/卸载时取消上一个在飞请求
  try {
    const detail = await digitalTwinApi.getFloorDetail(
      { building_id: bid, floor_id: floorId },
      { signal: controller.signal },                 // v1.8: 透传 AbortSignal
    )
    selection.setFloorDetail(detail)                  // 驱动 UnitDetail 面板
  } catch (e) {
    if (controller.signal.aborted) return             // 被取消的旧请求，忽略
    floorDetailError.value = errMsg(e)               // 驱动 UnitDetail 面板内联「加载失败 + 重试」
  }
})

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message          // HTTP 错误（含状态码）
  return (e as Error)?.message ?? '数据加载失败'
}

onBeforeUnmount(() => scene?.dispose())
</script>

<template>
  <canvas ref="canvas" />
  <!-- loading / 错误态兜底（对齐技能 @error 哲学；v1.8 按方法拆分） -->
  <div v-if="hydrating" class="hydrate-hint">加载园区数据…</div>
  <div v-else-if="buildingsError" class="hydrate-error">{{ buildingsError }}（楼栋数据加载失败，已降级显示场景骨架，<button @click="retry">重试</button>）</div>
  <div v-else-if="poisError" class="hydrate-warn">{{ poisError }}（POI 数据加载失败，楼栋仍可交互）</div>
</template>
```

> **v1.8 关键变更**：① `Promise.all` → `Promise.allSettled`，POI 失败不连累楼栋水合；② floor-detail `watch` 用 `onCleanup` + `AbortController` 取消旧请求，防快速切换楼层时慢请求覆盖新请求（race）；③ floor-detail 错误不再 `catch {}` 静默吞，改为 `floorDetailError` 驱动 UnitDetail 面板内联报错 + 重试按钮；④ 统一用 `ApiError`（§10），Mock 与 Real 抛同型错误，组件 `instanceof ApiError` 可区分 401/404/5xx。

**调用约定**（对齐 `api-typescript-spec`「页面调用」）：从 `@/api/modules/manager/digital-twin` 导入 `digitalTwinApi` 单例；类型/枚举从 `@/api/types/digital-twin` 导入；不在页面里引用 `IDigitalTwinApi`（实现细节）。按钮/交互触发的请求配 Loading + `try/finally`；这里是首屏水合，用 `hydrating` 态控制骨架。

`BuildingSwitcher.vue` 的标签 `name` 与 `UnitDetail.vue` 的数据源同步改为来自 `getBuildings()` / `getFloorDetail()`（详见 `references/shell.md`）。

## 10. 自适应宿主（请求基础设施）

生成时**检测宿主**，决定 `request<T>()` 与 `config` 怎么来：

### 10a. 宿主是 create-thirdnet-admin 项目（`src/api/request.ts` + `src/config/index.ts` 已存在）

**全部复用**，不新生成基础设施：
- `request<T>()` → 复用 `@/api/request`（Axios 封装，含 token 刷新、401 处理）
- `MOCK_ENABLED` → 复用 `@/config`
- Mock 剥离 → 复用 vite 已注册的 `mockDataStripPlugin`
- `.env` → 在宿主 `.env` 里设 `VITE_MOCK_ENABLED=true`（开发/演示），构建生产前改 `false`
- 接口契约文件 ② 放**扁平**路径 `src/api/interfaces/digital-twin.ts`（Admin 模板约定）
- **只新增** ①③④⑤ 四个数字孪生模块文件（② 在扁平 interfaces/；③④⑤ 仍按 `manager/` 嵌套）

### 10b. 宿主是独立最小项目（当前技能默认形态，如一个已有的社区驾驶舱项目或新脚手架）

生成最小内联基础设施（无 axios 依赖，基于 `fetch`；GET/POST-only、JSON、HTTP 错误码透传）：

```ts
// src/config/index.ts
export const MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === 'true'   // 字符串 "true"/"false"
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''        // 默认同源，靠 vite proxy 转发 /api
```

```ts
// src/api/request.ts —— 独立项目最小封装（admin 模板项目复用其自带 request.ts，不生成此文件）
import { API_BASE_URL } from '@/config'

export interface RequestConfig<TData = unknown> {
  url: string                 // 完整路径，如 /api/manager/park/buildings
  method: 'GET' | 'POST'
  params?: Record<string, unknown>
  data?: TData
  headers?: Record<string, string>
  signal?: AbortSignal         // v1.8: 请求取消（防 race）；透传给 fetch
  timeoutMs?: number           // v1.8: 超时（默认 15000），超时抛 ApiError(0, '请求超时')
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function request<T>(config: RequestConfig): Promise<T> {
  const { url, method, params, data, headers, signal, timeoutMs = 15000 } = config
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  // v1.8: 超时——用 AbortController 合并调用方 signal 与超时 signal，任一触发即中止。
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs)
  if (signal) signal.addEventListener('abort', () => ctrl.abort((signal as any).reason))
  try {
    const resp = await fetch(`${API_BASE_URL}${url}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'POST' ? JSON.stringify(data) : undefined,
      signal: ctrl.signal,
    })
    if (!resp.ok) {
      let msg = `HTTP ${resp.status}`
      try { const e = await resp.json(); msg = e.error_description ?? e.error ?? msg } catch { /* 非 JSON 错误体 */ }
      throw new ApiError(resp.status, msg)
    }
    if (resp.status === 204) return undefined as T
    return resp.json() as Promise<T>
  } catch (e: any) {
    // 区分「调用方主动取消」与「超时/网络错误」——前者静默（调用方 onCleanup 已处理），后者抛 ApiError
    if (signal?.aborted) throw e
    if (e?.name === 'AbortError') throw new ApiError(0, '请求超时')
    throw new ApiError(0, e?.message ?? '网络错误')
  } finally {
    clearTimeout(timer)
  }
}
```

> **v1.8**：`request<T>()` 新增 `signal`（取消）与 `timeoutMs`（超时，默认 15s）支持，并统一把网络/超时错误包装成 `ApiError(0, ...)`——组件用 `e instanceof ApiError` + `e.status` 即可区分 401（鉴权）/404（未命中）/5xx（服务端）/0（超时或网络）。`ApiError` 从 `@/api/request` 导出，供跨模块判断。Mock 实现（§7）也抛 `ApiError`（404 未命中），保证 Mock/Real 错误类型一致。

```bash
# .env（开发/演示）
VITE_MOCK_ENABLED=true
VITE_API_BASE_URL=

# .env.production（正式）
VITE_MOCK_ENABLED=false
VITE_API_BASE_URL=
```

```ts
// vite.config.ts —— 把 /api 代理到真实后端（开发期 MOCK_ENABLED=false 时用）
// server: { proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } }
```

**生产剥离**：独立项目不上 `mockDataStripPlugin`，靠 `VITE_MOCK_ENABLED=false`（生产 `.env`）让 `createDigitalTwinApi()` 的 `new MockDigitalTwinApi()` 分支成为死代码，被 Rollup tree-shaking 移除。

> **环境变量是 `VITE_MOCK_ENABLED`**（字符串 `"true"`/`"false"`），**不是** `VITE_USE_MOCK`（后者在本插件不存在）。

## 11. 后端接口契约（前端先行）

后端按 `backend-workflow` / `net-api-developer` 实现以下三个端点。前端类型（§4）与后端 `*Map` DTO 在字段名（snake_case）、类型、枚举值上**必须一致**。

| 端点 | `GET /api/manager/park/buildings` |
|---|---|
| QueryMap | `ParkBuildingQueryMap { park_id?: string }`（`FromQuery`） |
| 返回 | `List<BuildingRuntimeItemMap>` —— 非分页直接返回数组（园区楼栋是有界小集合，不用 `PageListInfo`） |
| 权限 | `[PermissionAuthorize("biz:park:list")]` |
| Controller | `ParkManagerController : AdminControllerBase`（路由前缀 `api/manager/park`） |

| 端点 | `GET /api/manager/park/floor-detail` |
|---|---|
| QueryMap | `FloorDetailQueryMap { building_id: string, floor_id: string }`（`FromQuery`） |
| 返回 | `FloorDetailMap`（未命中抛 `WebApiException(HttpStatusCode.NotFound, ...)`） |
| 权限 | `[PermissionAuthorize("biz:park:query")]` |
| Controller | `ParkManagerController` |

| 端点 | `GET /api/manager/park/pois` |
|---|---|
| QueryMap | `PoiQueryMap { park_id?: string, building_id?: string, type?: string }`（`FromQuery`） |
| 返回 | `List<PoiRuntimeItemMap>` —— 非分页直接返回数组 |
| 权限 | `[PermissionAuthorize("biz:monitor:list")]`（设备/监控点位归监控域） |
| Controller | `MonitorManagerController : AdminControllerBase`（路由前缀 `api/manager/monitor`， pois 端点可挂此 Controller；或并入 `ParkManagerController` 用 `api/manager/park/pois`，二选一，前端 URL 以本表为准） |

**后端 DTO 字段**（snake_case，对齐 §4）：`BuildingRuntimeItemMap { building_id, name, floors, floor_ids, header? }`；`FloorDetailMap { building_id, floor_id, label, tenant?, units }`；`PoiRuntimeItemMap { poi_id, type, label, x, z, y?, building_id?, floor_index?, status, tooltip?, occupancy? }`。

**响应约定**（`net-api-developer`）：成功**无 `{code,message,data}` 信封**，直接返回实体 JSON；错误用 HTTP 状态码（401/403/404/500）+ `{code,error,error_description}`。列表非分页直接返回 `List<T>`。

**实时性**：POI `status` 与停车场 `occupancy` 是实时数据。首屏 `getPois()` 一次性拉取后，若要持续刷新，由调用方在 `GlobalTwin.vue` 加定时轮询（如 `setInterval(() => digitalTwinApi.getPois().then(scene.hydratePois), 30_000)`）或接 WebSocket——本技能只保证契约层支持，轮询策略留给调用方。

## 12. POI 状态色 token 扩展

POI `status` 需要颜色映射。在所选风格 `assets/themes/<style>.tokens.json` 的 `poi` 块下新增 `status` 子对象（颜色单一事实来源，不散落 hex）：

```jsonc
"poi": {
  // 既有的 type → 色映射（entrance/exit/camera/...）保持不变
  "status": {
    "online":  "#3df0c8",   // 正常（沿用 accent 良好色）
    "offline": "#8a93a6",   // 中性灰
    "alarm":   "#ff5a5a",   // 告警红
    "idle":    "#ffb24a"    // 待机暖琥珀
  }
}
```

渲染 POI 标记时：图标底色取 `poi[type]`，外圈光晕/动画色取 `poi.status[status]`（alarm 可加呼吸动画）。`status` 缺省回退 `online`。这套 status 色跨 7 风格各定义一份（cyber/blueprint/holographic/night-realistic 取自发光或亮色、realistic/white-model/isometric 取克制扁平色），换肤只改 token。
