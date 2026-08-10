# 动态数据 API 契约层（Dynamic Data API）

数字孪生页面的数据分两层：

- **基础信息**（场景脚手架）—— 生成时从 Park Spec **静态内联**进页面（楼栋占地几何、园区环境、风格 token、舞台尺寸、航拍/连廊/地下坑体）。详见 `park-spec.md` 与 `scene-recipe.md`。
- **动态数据**（运营/业务数据）—— 运行期**通过后端 API 获取**，开发期由 Mock 返回、正式环境走真实 API。

本文件是「动态数据」层的唯一事实来源：定义接口契约、Mock/Real 切换、组件水合时序、宿主自适应、后端端点契约（**前端先行**）。规范细节（5 文件契约层、`IXxxApi`+Real/Mock+工厂、`VITE_MOCK_ENABLED`、GET-only、snake_case、响应无信封）**严格遵循 `api-typescript-spec` 技能**——本文件只补数字孪生特有的内容。编写契约层前若有疑问，先读 `api-typescript-spec`。

> **核心约定**：5 个契约文件中，**4 个静态样板已固化为 `assets/api/` 可拷贝模板**（`types/`、`interfaces/manager/`、`modules/manager/`、`mock/api/manager/` + 独立项目的 `request.ts`/`config/index.ts`）。生成器**逐字拷贝**这些模板（仅按宿主对齐 import 路径），不再照下文代码块手写。下文代码块是「输出形状」的事实来源，与模板逐字一致，仅供理解；真正落地时拷模板即可。只有第 ⑤ 个 `mock/data/manager/digital-twin.ts` 由 `generate_data.py` 从 spec 派生（非模板）。

## 1. 数据分层总表

`spec.json` 仍是**创作唯一事实来源**。生成器把它的内容**分区输出**：

| 数据 | 归属 | 生成去向 | 运行期来源 |
|---|---|---|---|
| 视觉风格 / theme tokens / shaders / 字体 | 基础信息 | 编译进页面（`tokens.css` / `theme.ts`） | 静态 |
| 舞台 / boundary / floorHeight | 基础信息 | 编译进场景 | 静态 |
| 楼栋位置与占地（id/w/d/x/z/category/facing） | 基础信息 | 编译进 `src/data/<park>.ts` | 静态 |
| 园区环境 + 航拍巡航 + 连廊 + 地下坑体 | 基础信息 | 编译进 `ParkScaffold` | 静态 |
| Legend 类别 / switcher 骨架 | 基础信息 | 编译进页面 | 静态 |
| 楼幢业务数据（name/floors/floor_ids/header） | **动态** | 派生为 mock + API 契约 | `getBuildings()` |
| 楼层详情（租户/单位 + 叙事档案块，点击楼层后取） | **动态** | 派生为 mock + API 契约 | `getFloorDetail()` |
| POI 点位（含坐标 + 实时状态 + 占用） | **动态** | 派生为 mock + API 契约 | `getPois()` |
| POI 业务详情（静态档案 + 实时指标，点击 POI 后取，v2.15） | **动态** | 派生为 mock + API 契约 | `getPoiDetail()` |

**为什么这样切**：楼栋的**物理位置/占地**是场景配置（改建才变，生成时内联）；楼栋的**业务身份**（叫什么名、有几层、每层有什么）和**运营点位**（设备/监控/停车场及其实时状态）是后端管理的业务数据——这些是数字孪生「活」的部分，必须走 API。spec 在生成时仍是这些动态数据的**种子**（派生为 Mock），保证开发期开箱即用、不依赖后端。

## 2. 脚手架先行，再水合（页面加载时序）

动态数据是异步的，所以页面按「**先画骨架，再填血肉**」水合，避免白屏与布局抖动：

```
① 静态脚手架（同步，来自 spec）→ 环境 + 楼栋占地底板 + Legend + 相机取景（K=0.66，只用静态几何）
   │  onMounted：Promise.allSettled([getBuildings(), getPois()])
   ▼
② 水合楼栋（getBuildings 返回后）→ 按 floors 挤出盒体 + 楼顶 name 标签 + 注册楼层拾取板(floor_ids)
   │
   ▼
③ 水合 POI（getPois 返回后）→ 标记杆+图标，按 status 上色/动画，停车场 POI 挂 occupancy tooltip
   │  点击某楼层
   ▼
④ 楼层详情（getFloorDetail 按需）→ 弹 UnitDetail 面板
```

**关键约束**：
- 相机取景 `frameCamera()` 只用**静态几何**（boundary、最高楼估算），**不能**等 `getBuildings()` 才取景——否则水合前白屏。水合后楼栋高度可能与估算略有出入，可在 `hydrateBuildings()` 末尾再 `frameCamera()` 一次（范式实现已内置）。
- 水合前楼栋以**占地底板**（低 `BoxGeometry`，高 ~2 单位）占位，水合后挤出为完整盒体。
- loading / 空 / 错误三态都要兜底：请求中显骨架/底板；失败显降级提示且脚手架可交互；`getPois()` 返回空数组则不渲染 POI（不报错）。

## 3. 5 文件契约层结构

对齐 `api-typescript-spec`，endpoint 用 `manager`（管理端驾驶舱）：

```
src/
├── config/index.ts                          # MOCK_ENABLED、API_BASE_URL（自适应宿主，见 §10）
├── api/
│   ├── request.ts                           # 统一 request<T>()（自适应宿主，见 §10）
│   ├── types/manager/digital-twin.ts        # ① 类型 + 枚举（按端分层，端=manager）
│   ├── interfaces/manager/digital-twin.ts   # ② IDigitalTwinApi 接口契约
│   └── modules/manager/digital-twin.ts      # ③ RealDigitalTwinApi + createDigitalTwinApi() + 单例
└── mock/
    ├── api/manager/digital-twin.ts          # ④ MockDigitalTwinApi
    └── data/manager/digital-twin.ts         # ⑤ 纯 Mock 数据（generate_data.py 派生）
```

> **Admin 模板宿主**（`create-thirdnet-admin`）的 `api/interfaces/` 是**扁平**结构（无 `manager/` 子目录）——此时把 ② 放 `src/api/interfaces/digital-twin.ts`，③④⑤ 仍按 `manager/` 嵌套。详见 §10。

**①–④ 从 `assets/api/` 模板逐字拷贝**（仅对齐 import 路径）；⑤ 由 `generate_data.py` 生成。下文给出各文件的**字段形状**（与模板逐字一致，供理解 + 后端对齐字段，不需手写）。

## 4. 类型定义（`api/types/manager/digital-twin.ts`）

字段全 snake_case，与后端 `*Map` DTO 一致。**逐字拷贝 `assets/api/types/digital-twin.ts`** 到 `src/api/types/manager/digital-twin.ts`（按端分层、端=manager，对齐 import 路径）。

关键类型形状（字段名即契约，勿改）：
- `BuildingRuntimeItem { building_id, name, floors, floor_ids[], header? }` —— `building_id` 与静态脚手架 `buildings[].id` 对应（join key）。
- `FloorDetail { building_id, floor_id, label, tenant?, units: UnitDetail[] }`。
- `UnitDetail { unit_id, name, tenant?, contact_person?, contact_phone?, staff_count?, area?, nature?, service_hours?, business_scope?, responsibilities?, fields?: {label, value}[] }` —— 办公园区默认字段全集；`fields` 由 `spec.unitTemplate.fields` 驱动（非办公园区），存在时 `UnitDetail.vue` 优先渲染它。
- `PoiStatusEnum { Online, Offline, Alarm, Idle }`、`PoiTypeEnum { Entrance, Exit, Camera, Gate, Service, Landmark, Parking, Custom }`（v2.7 起自定义类型以原样字符串透传，通用圆点渲染）。
- `PoiRuntimeItem { poi_id, type, label, x, z, y?, building_id?, garage_id?, floor_index?, status, tooltip?, occupancy?, room_spec? }` —— `occupancy` 给停车场类 POI；`room_spec`（area/capacity/dept/duty）给政务/功能房间 POI，`PoiOverlay` 优先渲染它。
- `*QueryParams`：`BuildingQueryParams { park_id? }`、`FloorDetailQueryParams { building_id, floor_id }`、`PoiQueryParams { park_id?, building_id?, type? }`。

> **命名约定**：这些 snake_case 字段是 **HTTP DTO 形态**（后端响应）。组件层直接消费 snake_case（与 `GlobalTwin.vue`/`useTwinData` 实现一致，类型即契约、零漂移）。若项目偏好组件层只见 camelCase，可由 Real 工厂层在 `request<T>()` 返回后映射——但需整个模块统一一种。

## 5. 接口契约（`IDigitalTwinApi`）

**逐字拷贝 `assets/api/interfaces/manager/digital-twin.ts`**。数字孪生动态数据全是**只读聚合查询**，一个接口承载四方法（GET-only、响应**无 `{code,message,data}` 信封**——列表直接返回数组、详情直接返回对象）：

```ts
export interface DigitalTwinRequestOptions { signal?: AbortSignal }   // 透传 AbortSignal（防快速切换楼层/POI race）

export interface IDigitalTwinApi {
  getBuildings(params?: BuildingQueryParams, opts?): Promise<BuildingRuntimeItem[]>
  getFloorDetail(params: FloorDetailQueryParams, opts?): Promise<FloorDetail>
  getPois(params?: PoiQueryParams, opts?): Promise<PoiRuntimeItem[]>
  getPoiDetail(params: PoiDetailQueryParams, opts?): Promise<PoiDetail>   // v2.15：POI 业务详情（点击 POI 后取）
}
```

`getPoiDetail`（v2.15）：参数 `{ park_id?, poi_id }`，返回 `PoiDetail { poi_id, ref_id?, type, title, subtitle?, status, fields:[{label,value}], live?:[{label,value}] }`——通用键值包（静态档案 `fields` + 实时指标 `live`），后端按 `(type, ref_id)` 分派查业务表、业务表零改动（参照 Park 驾驶舱）。POI 详情失败时 `PoiOverlay` 降级读列表项 inline `tooltip`/`room_spec`/`occupancy`，不阻断。

## 6. Mock 数据（由 spec 派生）

由 `scripts/generate_data.py` 生成（**非模板**）：
```bash
python scripts/generate_data.py spec.json --out-dir <项目根> --mock-only
```
种子 = FNV-1a(spec.title) 的 mulberry32（与范式实现视觉装饰同款伪随机），同一 spec 重跑输出逐字节一致。行业/公司名/负责人/电话默认从脚本内置的 8 行业办公池选取；非办公园区可由 `spec.unitTemplate`（`tenants`/`fields`）覆盖（缺省时产物逐字节不变）。

产出四个导出：`mockBuildings: BuildingRuntimeItem[]`（从 `spec.buildings[]` 派生 name/floors/floor_ids）、`mockFloorDetails: FloorDetail[]`（每层 1–3 个单位，含 v2.15 叙事档案块 `subtitle/scope/intro_title/intro_body/duties[]/closing`，确定性生成）、`mockPois: PoiRuntimeItem[]`（从 `spec.pois[]` 派生，status 给合理初值 ~85% online，停车场 POI 带 occupancy）、`mockPoiDetails: Record<string, PoiDetail>`（v2.15，键=`poi_id`，按 type 套档案模板：camera/gate 给设备编码/IP/厂家 + 实时抓拍/通行，其余给点位档案）。`building_id` 必须与静态脚手架 `buildings[].id` 一致。

## 7. Mock 实现（`mock/api/manager/digital-twin.ts`）

**逐字拷贝 `assets/api/mock/api/manager/digital-twin.ts`**。`async` 方法直接返回派生数据；`getFloorDetail` 按 `building_id + floor_id` 查找、`getPoiDetail` 按 `poi_id` 查 `mockPoiDetails` 表，未命中抛 `ApiError(404)`，响应 `signal.aborted` 抛 `ApiError(0, 'aborted')`（Mock 也尊重取消，便于测试 race）。Mock 抛 `ApiError` 与 Real 一致——组件 `instanceof ApiError` 可判 status。

## 8. Real 实现 + 工厂（`api/modules/manager/digital-twin.ts`）

**逐字拷贝 `assets/api/modules/manager/digital-twin.ts`**。Real 适配 HTTP，工厂按 `MOCK_ENABLED` 选实例，模块级单例：

```ts
class RealDigitalTwinApi implements IDigitalTwinApi {
  getBuildings(params, opts) { return request<BuildingRuntimeItem[]>({ url: '/api/manager/park/buildings', method: 'GET', params, signal: opts?.signal }) }
  getFloorDetail(params, opts) { return request<FloorDetail>({ url: '/api/manager/park/floor-detail', method: 'GET', params, signal: opts?.signal }) }
  getPois(params, opts) { return request<PoiRuntimeItem[]>({ url: '/api/manager/park/pois', method: 'GET', params, signal: opts?.signal }) }
  getPoiDetail(params, opts) { return request<PoiDetail>({ url: '/api/manager/park/poi-detail', method: 'GET', params, signal: opts?.signal }) }
}
export function createDigitalTwinApi(): IDigitalTwinApi {
  return MOCK_ENABLED ? new MockDigitalTwinApi() : new RealDigitalTwinApi()
}
export const digitalTwinApi = createDigitalTwinApi()   // 模块级单例
```

调用方（`.vue` 组件）只看到 `IDigitalTwinApi` 类型，Real/Mock 对其透明。

## 9. 组件水合

`GlobalTwin.vue`（拷贝自 `assets/components/`）在 `onMounted` 拉取动态数据并驱动 `ParkScene` 命令式水合 API。完整代码在范式组件里，要点：

- `Promise.allSettled([getBuildings(), getPois()])`（**非** `Promise.all`）——POI 失败不连累楼栋水合，各自 try/catch 写独立错误态。
- 成功 → `scene.hydrateBuildings(items)` / `scene.hydratePois(items)`；失败 → 分方法错误态（楼栋失败显降级 + 重试，POI 失败显轻提示且楼栋仍可交互）。
- 点击楼层 → `watch([focusedBuildingId, floorIndex], …, onCleanup)` + `AbortController` 取消旧请求（防快速切换 race）；错误驱动 UnitDetail 面板内联报错 + 重试。
- 点击 POI → `watch(openPoiId, …, onCleanup)` + `AbortController` 取 `getPoiDetail({poi_id})`（v2.15，同款防 race）；详情按 `poi_id === openPoiId` 防串显；失败时 `PoiOverlay` 降级读列表 inline tooltip，不阻断。
- 统一用 `ApiError`（§10），Mock 与 Real 抛同型错误，组件 `instanceof ApiError` 可区分 401/404/5xx/0。

**调用约定**（对齐 `api-typescript-spec`）：从 `@/api/modules/manager/digital-twin` 导入 `digitalTwinApi` 单例；类型/枚举从 `@/api/types/manager/digital-twin` 导入；不在页面里引用 `IDigitalTwinApi`（实现细节）。`BuildingSwitcher` 标签与 `UnitDetail` 数据源来自 `getBuildings()` / `getFloorDetail()`（详见 `references/shell.md`）。

## 10. 自适应宿主（请求基础设施）

生成时**检测宿主**，决定 `request<T>()` 与 `config` 怎么来：

### 10a. 宿主是 create-thirdnet-admin 项目（`src/api/request.ts` + `src/config/index.ts` 已存在）

**全部复用**：`request<T>()` 复用 `@/api/request`（Axios 封装，含 token 刷新、401 处理）；`MOCK_ENABLED` 复用 `@/config`；Mock 剥离复用 `mockDataStripPlugin`；`.env` 设 `VITE_MOCK_ENABLED=true`（开发/演示）、生产前改 `false`。接口契约文件 ② 放**扁平**路径 `src/api/interfaces/digital-twin.ts`。只新增 ①③④⑤ 四个数字孪生模块文件。

### 10b. 宿主是独立最小项目

生成最小内联基础设施（**逐字拷贝 `assets/api/request.ts` + `assets/api/config/index.ts`**，基于 `fetch`、无 axios、GET/POST-only、JSON、HTTP 错误码透传）。`request<T>()` 支持 `signal`（取消）与 `timeoutMs`（超时 15s），网络/超时错误包装为 `ApiError(0, ...)`——组件用 `e instanceof ApiError` + `e.status` 区分 401/404/5xx/0。`ApiError` 从 `@/api/request` 导出。

```bash
# .env（开发/演示）          # .env.production（正式）
VITE_MOCK_ENABLED=true       VITE_MOCK_ENABLED=false
VITE_API_BASE_URL=           VITE_API_BASE_URL=
```

生产剥离靠 `VITE_MOCK_ENABLED=false` 让 `createDigitalTwinApi()` 的 Mock 分支成为死代码，被 Rollup tree-shaking 移除。

> **环境变量是 `VITE_MOCK_ENABLED`**（字符串 `"true"`/`"false"`），**不是** `VITE_USE_MOCK`（后者在本插件不存在）。

## 11. 后端接口契约（前端先行）

后端按 `backend-workflow` / `net-api-developer` 实现以下四个端点。前端类型（§4）与后端 `*Map` DTO 在字段名（snake_case）、类型、枚举值上**必须一致**。成功**无 `{code,message,data}` 信封**，直接返回实体 JSON；错误用 HTTP 状态码（401/403/404/500）+ `{code,error,error_description}`。列表非分页直接返回 `List<T>`。

| 端点 | QueryMap（`FromQuery`） | 返回 | 权限 | Controller |
|---|---|---|---|---|
| `GET /api/manager/park/buildings` | `ParkBuildingQueryMap { park_id? }` | `List<BuildingRuntimeItemMap>` | `[PermissionAuthorize("biz:park:list")]` | `ParkManagerController`（`api/manager/park`） |
| `GET /api/manager/park/floor-detail` | `FloorDetailQueryMap { building_id, floor_id }` | `FloorDetailMap`（未命中 `NotFound`） | `[PermissionAuthorize("biz:park:query")]` | `ParkManagerController` |
| `GET /api/manager/park/pois` | `PoiQueryMap { park_id?, building_id?, type? }` | `List<PoiRuntimeItemMap>` | `[PermissionAuthorize("biz:monitor:list")]` | `MonitorManagerController`（`api/manager/monitor`）或并入 `ParkManagerController`（前端 URL 以上表为准） |
| `GET /api/manager/park/poi-detail` | `PoiDetailQueryMap { park_id?, poi_id }` | `PoiDetailMap`（未命中 `NotFound`） | `[PermissionAuthorize("biz:monitor:query")]` | `MonitorManagerController` 或 `ParkManagerController`（前端 URL 以上表为准） |

**后端 DTO 字段**（snake_case，对齐 §4）：`BuildingRuntimeItemMap { building_id, name, floors, floor_ids, header? }`；`FloorDetailMap { building_id, floor_id, label, tenant?, units }`（`UnitDetailMap` 含办公字段 + 可选叙事块 `subtitle/scope/intro_title/intro_body/duties[]/closing`）；`PoiRuntimeItemMap { poi_id, type, label, x, z, y?, building_id?, floor_index?, status, tooltip?, occupancy?, room_spec? }`；`PoiDetailMap { poi_id, ref_id?, type, title, subtitle?, status, fields:[{label,value}], live?:[{label,value}] }`。

**POI 详情分派**（v2.15）：`poi-detail` 端点收到 `poi_id` 后，按 POI 记录的 `(type, ref_id)` 在后端内部分派查业务表（camera→摄像头档案、gate→门禁设备…），业务表零改动；返回通用键值包（静态 `fields` + 实时 `live`），前端不感知具体业务类型。

**实时性**：POI `status` 与停车场 `occupancy` 是实时数据。首屏 `getPois()` 一次性拉取后，若要持续刷新，由调用方在 `GlobalTwin.vue` 加定时轮询（如 `setInterval(() => getPois().then(scene.hydratePois), 30_000)`）或接 WebSocket——本技能只保证契约层支持，轮询策略留给调用方。

## 12. POI 状态色 token 扩展

POI `status` 需要颜色映射。在所选风格 `assets/themes/<style>.tokens.json` 的 `poi` 块下有 `status` 子对象（颜色单一事实来源，不散落 hex）：

```jsonc
"poi": {
  "status": { "online": "#3df0c8", "offline": "#8a93a6", "alarm": "#ff5a5a", "idle": "#ffb24a" }
}
```

渲染 POI 标记时：图标底色取 `poi[type]`，外圈光晕/动画色取 `poi.status[status]`（alarm 可加呼吸动画）。`status` 缺省回退 `online`。这套 status 色跨 3 风格各定义一份，换肤只改 token。
