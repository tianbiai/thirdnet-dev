# Park Spec（园区规格说明）

**Park Spec** 是一份园区数字孪生的唯一规范描述。每种输入模式（文字、草图、效果图、`.pen`、平面图）都会被转换成这样一份 spec，由用户确认，生成器只从它读取。任何特定园区的内容（"综合楼"、"10 层"等）都绝不硬编码在生成器里——一切都从 spec 流入。

本文件是 schema 的事实来源。`scripts/validate_spec.py` 依据它校验 spec；`assets/spec.schema.json` 是同结构的 JSON Schema（draft-07），可供 IDE 自动补全与 CI 无 Python 校验。编写或编辑 spec 前先读本文件。

> **命名约定**：spec 层一律 **camelCase**（`buildingId`、`floorIndex`）。运行时 TypeScript 契约层（`api/types/digital-twin.ts`，工程内扁平）与组件默认 snake_case（`building_id`、`floor_index`，类型即契约、零漂移）——见 `dynamic-data-api.md §4`。

## 数据分层注记

spec 仍是**创作唯一事实来源**（生成时读取），但生成器把内容**分区输出**为两层（详见 `dynamic-data-api.md`）：

- **基础信息**（静态内联）：风格/tokens/shaders/字体/舞台/boundary/floorHeight；楼栋**位置与占地**（`buildings[].id/w/d/x/z/category/type/facing`）；园区环境（`environment`）；航拍（`cameraTour`）；连廊（`corridor`）；地下坑体（`garages`）；Legend/switcher 骨架。
- **动态数据**（运行期走 `IDigitalTwinApi`，开发期由 spec 派生为 Mock、正式环境调真实后端）：楼幢**业务数据**（`buildings[].name/floors/floor_ids/header`、`floors_detail`）与 **POI 点位**（`pois[]`，含停车场 `occupancy`）。

下文 schema 里 `buildings[].name/floors/floors_detail` 与 `pois[]` 在生成时**用于派生 Mock 数据**（动态），而非静态内联——静态脚手架只保留楼栋占地几何。schema 本身不变；变的是生成器如何分区输出。

## 坐标系与单位

- **世界单位**，任意尺度。X = 东，Z = 南，Y = 上。
- 楼栋坐落在地面（Y=0）的 `(x, z)`；占地为 `w`（X 方向）× `d`（Z 方向），以 `(x, z)` 为中心。
- **`floorHeight`**（默认 `40`）—— 每层世界单位高度。一栋楼总高 = `floors * floorHeight`。
- **`boundary`**（默认 `{x:360, z:220}`）—— 园区在 X 上延展 ±`boundary.x`、Z 上延展 ±`boundary.z`。网格地面和相机取景都据此确定尺寸。
- 散开楼栋填满宽的中央面板（3–5 栋楼大致沿 左上→右下 对角线效果不错）。锁定前用截图目视校验布局。

## TypeScript 接口

```ts
type Category = string  // 开放：'building'（挤出楼栋）/ 'garage'（地面入口标记）/ 任意自定义串（factory/warehouse/residential/office…——按挤出楼栋渲染，配色取 tokens.category.<cat>，缺省回退 building）。详「类别语义」。

interface ParkSpec {
  title: string                       // "XX园区" —— 页面/文档标题
  style?: Style                       // 视觉风格；默认 'cyber'
  stage?: { width: number; height: number }  // 默认 1920×1080
  tokens?: Record<string, string>     // 颜色覆盖；省略则按 style 用 assets/themes/<style>.tokens.json
  shaders?: { grid?: { u_gridColor: string; u_cell: number; u_strength: number } }  // 仅 cyber 消费
  floorHeight?: number                // 默认 40
  boundary?: { x: number; z: number } // 默认 {360, 220}
  buildings: BuildingSpec[]
  legend?: LegendEntry[]              // 默认 = 楼幢 + 实际用到的楼栋类型（v2.30）+ 地下车库
  switcher?: (string | { id: string; label?: string })[]  // 标签页骨架（推荐对象形式，id 对齐 buildings[].id）
  environment?: ParkEnvironment       // 园区环境；缺省 = 智能默认
  pois?: PoiSpec[]                    // 兴趣点；缺省 = []（不生成 POI）
  garages?: GarageSpec[]              // 地下场景；缺省 = []（无地下层）
  cameraTour?: CameraTourSpec         // 航拍巡航；缺省 = 智能默认（按钮触发）
  corridor?: CorridorSpec            // 空中连廊；缺省 = 不画连廊
}

type Style = 'cyber' | 'realistic' | 'night-realistic'

interface BuildingSpec {
  id: string                          // slug，唯一 —— 切换器/选中/详情
  name: string                        // "主楼" —— 楼顶常驻标签 + 切换器 + 详情标题
  category: Category                  // building/garage/自定义；驱动 3D 颜色 + 图例 + 是否按车库入口渲染
  type?: BuildingType                 // v2.30 楼栋类型：office=写字楼 / residential=居民楼 / commercial=商业（缺省=通用楼）。驱动类型化外观三维度，详「楼栋类型语义」
  w: number                           // 占地 X 尺寸
  d: number                           // 占地 Z 尺寸
  floors: number                      // 楼层数（高度 = floors * floorHeight）；车库条目可选/忽略
  x: number                           // 中心 X
  z: number                           // 中心 Z
  facing?: 'N' | 'S' | 'E' | 'W'      // 仅 category:'garage' 有意义（半金字塔入口朝向），默认 'S'
  header?: string                     // "10F · 12单位" —— 详情/切换器后缀
  connects?: string[]                 // 声明物理连通的其它楼栋 id（裙楼/连体楼）；豁免 validate_spec 的 AABB 间距/重叠 FAIL
  floors_detail?: FloorSpec[]         // 详情面板的每层租户（可选）
}

type BuildingType = 'office' | 'residential' | 'commercial'  // v2.30；缺省/未知 = 通用楼（行为与 v2.29 一致）

// category:'garage' 楼栋 = 地面入口标记（半金字塔三角门 + P 牌，Y=0 之上、无几何体积）。
// garages[] = 真正的地下剖面坑体（Y=0 之下透明玻璃柱，可整园范围）。两者可共存也可只用其一。

interface GarageSpec {
  id: string                          // slug，唯一 —— 地下拾取/选中/GarageCard
  name: string                        // "地下车库 B1" —— 层标牌 + GarageCard 标题
  usage?: string                      // 'parking'(缺省)/'mall'/'subway'/'shelter'/'workshop'/'custom'。非 parking 跳过车位网格，改显功能房间 + usage 标签
  level: number                       // 负整数：-1 = B1，-2 = B2
  x: number; z: number                // 坑体中心（Y 隐式 = 0，几何向下）
  w: number; d: number                // 坑体占地尺寸（可整园）
  deck_y: number                      // 该层底板距地面深度（正数；渲染取负，B1 典型 140；偏浅 <140 触发 WARN）
  cols?: number; rows?: number        // 车位网格采样列/行（仅 parking）
  capacity?: number; occupied?: number  // 总车位/已占用（仅 parking）
  rooms?: { name: string; x: number; z: number; w: number; d: number }[]  // 功能房间（非 parking 为主内容；parking 缺省 8 间）
  facing?: 'N' | 'S' | 'E' | 'W'      // 坡道朝向；默认 'S'
}

interface PoiSpec {
  id: string                          // slug，唯一 —— 拾取/选中
  type: PoiType                       // 已知 8 类有专属图标；自定义类型以通用圆点渲染
  label: string                       // 标记旁短名；同时作 tooltip 默认标题
  x: number; z: number                // 世界坐标
  y?: number                          // 高度；默认地面（0）
  buildingId?: string                 // 可选：绑定到 buildings[].id（室内点位）
  garageId?: string                   // 可选：绑定到 garages[].id（地下点位）
  floorIndex?: number                 // 可选：绑定到某层（0=地面层、正=地上、负=地下 -1=B1）
  tooltip?: { title?: string; description?: string; meta?: Record<string, string> }
  roomSpec?: { area?: string | number; capacity?: string | number; dept?: string; duty?: string }  // 功能房间结构化字段（推荐，比 meta 可读）
}

type PoiType = string  // 已知 entrance/exit/camera/gate/service/landmark/parking/custom；任意自定义串以通用圆点标记渲染

interface LegendEntry { label: string; category: Category; color: string; type?: BuildingType }
// v2.30：条目对应楼栋类型时给 type——color 留空则色块回退 var(--twin-building-type-<type>)（再回退 category 链）。

interface FloorSpec { index: number; label: string; tenant: string; units?: UnitDetail[] }
```

`UnitDetail`（用于 `FloorSpec.units`）镜像运行时契约层的 `UnitDetail` —— 参见 `references/dynamic-data-api.md §4`。

## POI tooltip 标准键名约定

`PoiSpec.tooltip.meta` 跨项目可比性靠这套约定（不强校验）：

- 政务园区：`部门` / `职责` / `编制` / `在岗` / `面积` / `容纳`
- 物业场景：`负责人` / `电话` / `营业时间` / `状态`
- 通用：`状态` / `容量` / `编号` / `备注`

> 优先推荐 `poi.roomSpec` 结构化字段（schema 已落）；`tooltip.meta` 退为兜底/兼容老项目。

## 园区环境（ParkEnvironment）

`spec.environment` 可选。提供则按值生成园区地面、道路、地面车位、绿化、周边市政道路、路灯；**省略则用智能默认**（环形内部道路 + 按楼栋规模推算的地面车位 + 普通密度绿化 + 四向市政道路 + 主闸机 + 路灯）——保证「不问也能产出一张完整的全景图」。生成细则见 `references/scene-recipe.md §10`。

```ts
interface ParkEnvironment {
  internalRoads?: 'loop' | 'cross' | 'grid' | 'none'        // 默认 'loop'
  surfaceParking?: { stalls: number; occupied?: number } | null  // stalls=长方形车位数；occupied=示意停放车辆数（缺省 ~30%）；null=无
  greenery?: {
    treeDensity?: 'sparse' | 'normal' | 'lush'               // 默认 'normal'
    centralPlaza?: boolean                                   // 默认 true
    waterFeature?: boolean                                   // 默认 false
  }
  surrounding?: {
    roads?: boolean        // 四向市政道路；默认 true
    sidewalk?: boolean     // 园区边沿人行道；默认 true
    gate?: boolean         // 主出入口闸机；默认 true
  }
  ambiance?: {
    streetLamps?: boolean  // 街灯（night-realistic 挂暖色实光源，其余仅自发光灯头）；默认 true
    groundGlow?: boolean   // 地面发光标线；cyber 默认 true，其余 false
    vehicles?: boolean     // 周边道路与车位的车辆/行人代理体；默认 true
  }
}
```

**校验规则**：`environment` 缺失 → 仅 `WARN`；存在时枚举字段必须合法、`surfaceParking.stalls > 0`、若给 `occupied` 则 `≤ stalls`。**字段全部可选**——给空 `{}` 也合法，等同智能默认。

## 兴趣点（POI）

`spec.pois` 可选（缺省 `[]` = 不生成任何 POI）。每个 POI = 类型 + 世界坐标 + 可选楼层归属 + 可选提示卡数据。**v1.5 起 POI 是动态数据**：`pois[]` 在生成时派生为 `mockPois`，运行期通过 `getPois()` 获取，而不静态内联。Mock 项在 `PoiSpec` 基础上补 `status`（`PoiStatusEnum`）与停车场 `occupancy`。生成细则见 `references/scene-recipe.md §11`。

**校验规则**：`pois` 缺失 → 合法（不 WARN）；存在时必须是数组，每项 `id` 唯一、`type` 非空、`label` 非空、`x/z` 为数字；`buildingId` 给定时必须命中某栋 `buildings[].id`，`floorIndex` 为整数（v2.7 起允许负值）。

## 地下车库（garages）

`spec.garages` 可选（缺省 `[]` = 不生成地下层）。每个条目描述**一个地下负层坑体**——`level: -1` 为 B1、`-2` 为 B2，多层即多个条目并按 `level` 堆叠。坑体渲染为 **Y=0 之下的透明玻璃柱**：地面**不开洞**（楼栋不悬空），4 面半透明玻璃壁 + 半透明自发光底板，从侧面透视内部的车位网格 + 车辆 + 功能房间线框 + 出入口坡道 + 层标牌。`usage` 区分用途：缺省 `'parking'`（车位网格 + 车辆 + GarageCard 占用）；`'mall'`/`'subway'`/`'shelter'`/`'workshop'` 等跳过车位网格，改显功能房间——可表达地下商场/地铁通道/人防工程/地下车间。生成细则见 `references/scene-recipe.md §14`。

> **与 `category:'garage'` 楼栋的区别**：`buildings[]` 里 `category:'garage'` 是**地面入口标记**（半金字塔 + P 牌，Y=0 之上、无体积）；`garages[]` 是**真正的地下剖面几何**。二者独立——可只用地面试标记、可只用地下坑体、也可共存。地下交互走切换器「地下车库」标签 → `setBelowView(true)` 相机俯冲。

> **全部静态内联**：坑体几何与 `capacity`/`occupied` 占用数据都写进 `ParkScaffold.garages`，由 `generate_data.py` 输出、ParkScene 构造期读取渲染，**不**走动态水合。如需运营态实时占用，后续可在 `IDigitalTwinApi` 加 `getGarages()` 覆盖（见 `dynamic-data-api.md`）。

**多层堆叠**：`garages[]` 按 `level` 升序渲染。最浅层（B1）的坑顶 = Y=0；更深层（B2）的坑顶 = 上一层底板（`-deck_y`）。外壁从 Y=0 连续延伸到最深底，各层底板处画虚线层分隔。**深度约定**：`deck_y` 为距地面的**绝对**深度，故 B2 须大于 B1（如 B1=140、B2=280）保证多层单调；偏浅（<140）由 `validate_spec.py` 出 WARN。

**校验规则**：`garages` 缺失 → 合法（不 WARN）；存在时每项 `id` 唯一、`level` 为 ≤ -1 的整数、`w/d/deck_y > 0`。`usage='parking'`（缺省）另校验 `cols/rows > 0`、`0 ≤ occupied ≤ capacity`；非 parking 这些字段可省。坑体 AABB **不参与**楼栋出界/重叠 FAIL（地下与楼上不同 Y，XZ 重叠合法）；仅超出 `boundary` 时 WARN。**`deck_y < 140` 出偏浅 WARN**。

## 相机巡航（cameraTour）

`spec.cameraTour` 可选。提供则配置「航拍巡航」——相机过渡到鸟瞰取景后，沿园区缓慢自动环绕。**省略则用智能默认**（按钮触发，speed 0.6 / elevation 1.0 / framingK 0.55 / pauseOnInteract true）。生成细则见 `references/scene-recipe.md §13`。

```ts
interface CameraTourSpec {
  enabled?: boolean                   // 首屏自动开启；默认 false
  speed?: number                      // autoRotateSpeed（度/帧）；默认 0.6
  elevation?: number                  // 巡航俯角 rad；默认 1.0 鸟瞰；钳到 polar[0.08,π-0.1]（v2.18 起 minPolarAngle 0.5→0.08）
  framingK?: number                   // 巡航取景内容占比；默认 0.55
  pauseOnInteract?: boolean           // 用户拖拽自动退出；默认 true
}
```

归属**基础信息（静态）**——`generate_data.py` 写进 `ParkScaffold.cameraTour`，ParkScene 构造期读取；**不**参与动态水合。

要点（理解 why）：
- **auto-orbit 而非路径飞行**：复用 `OrbitControls.autoRotate` + 现有 `focusBuilding` tween 机制，零新增运动学。
- **释放控制权铁律**：取景过渡是「事件触发 + 有限时长」tween，结束后把控制权完整交还 OrbitControls；用户一拖拽即自动退出。
- **`prefers-reduced-motion` 禁用**：autoRotate 是连续运动，按钮 `aria-disabled`。

**校验规则**：`cameraTour` 缺失 → 合法；存在时 `enabled`/`pauseOnInteract` 为布尔、`speed>0`、`framingK∈(0,1)`、`elevation∈[0,π/2]`；未知键 → FAIL。

## 连廊（corridor）

`spec.corridor` 可选。描述两栋楼之间的一条**空中连廊**（悬空连接体）。提供则 `generate_data.py` 原样写进 `ParkScaffold.corridor`，`ParkScene.buildCorridor` 架悬空桥体（`width × 厚 × len`，`len` = from→to 距离），配同名常驻标签；单层时悬高 = `floor*floorHeight`，给 `floorEnd`（≥ `floor`）则**跨层**。**省略即不画连廊**。

```jsonc
"corridor": {
  "from": { "x": -60, "z": 0 },   // 起点（世界坐标 XZ）
  "to":   { "x":  60, "z": 0 },   // 终点
  "floor": 3,                      // 悬空起始楼层；缺省 1
  "floorEnd": 5,                   // 跨层终止楼层（≥ floor）；省略 = 单层薄桥
  "width": 12, "thickness": 6,    // 缺省 12 / 6
  "label": "空中连廊"               // 缺省「连廊」
}
```

归属**基础信息（静态）**——与 `cameraTour`/`garages` 同层，不参与动态水合。`from`/`to` 必填，其余可选。多条连廊目前需后续版本支持；当前 `corridor` 为单个对象。

## 类别语义

| 类别 | 含义 | 默认颜色 | 3D 处理 |
|---|---|---|---|
| `building` | 楼幢 | 青色 `#27a8ff` | 挤出盒体、幕墙纹理（每层 1–5 块贴砖、相邻深浅交替）、楼层虚线分隔、屋顶边线、楼顶常驻名称标签 |
| `garage` | 地下车库 —— **地面**入口标记 | 薄荷绿 `#3df0c8` | 半金字塔三角门入口 + P 牌（Y=0 之上、无几何体积）。真正的地下剖面由顶层 `garages[]` 描述 |
| 自定义串 | factory/warehouse/residential/office/amenity… | `tokens.category.<cat>`（缺省回退 `building` 青） | 按挤出楼栋渲染（与 `building` 同几何）；用 `spec.tokens` 的 `category.<cat>` 或 `legend.color` 单独定色。`floors` 必填（仅 `garage` 免） |

`garage` 不限制栋数——多个 `category:'garage'` 楼栋即多个地面入口标记（多入口物流园场景）。地下剖面坑体用 `garages[]`，二者可共存。

## 楼栋类型语义（v2.30）

`buildings[].type` 可选（枚举 `office`/`residential`/`commercial`，缺省 = 通用楼）。与 `category` **正交**：category 管图例/配色/车库入口语义，type 管**类型化构造外观**——解决「写字楼和居民楼长得一样」。**类型只区分构造、不改变颜色**：全类型楼栋颜色一致（统一走 category 配色链，默认色或用户 `spec.tokens.category.*`/`--brand` 指定色）；类型差异落在三个构造维度：

| 维度 | `office` 写字楼 | `residential` 居民楼 | `commercial` 商业 |
|---|---|---|---|
| ① 窗户/灯光（深色两风格发光窗） | 横带幕墙（winWRatio 0.82）、6 列、密集冷光均匀点亮（warmRatio 0.2） | 单元小窗（winWRatio 0.34）、4 列、稀疏暖光慢闪（warmRatio 0.88） | 底层贯通橱窗恒亮（storefront）+ 塔身零星 |
| ② 立面纹理构造（写实日景） | 细框满玻幕墙（玻璃占比 ~90%） | 实墙窗洞（~60%）+ 每窗窗台线 | 标准网格（底商表达在体块层） |
| ③ 体块形态 | **无裙楼**、点式塔直落地面 | 逐层**阳台挑板** | **2 层大裙楼**（×1.18）+ 底盘贯通灯带 |

- **颜色一致原则**：楼栋颜色 = `tokens.category.<cat>`（或 `spec.tokens.category.<cat>` 覆盖、`generate_theme.py --brand` 派生），与 type 无关。`tokens.buildingType.<type>` 是**可选覆盖通道**——仅当用户显式要求按类型区分颜色时才配置（优先级高于 category 链；默认主题不配）。
- **窗参四级合并**：内置 `DEFAULT_WINDOWS` → `tokens.windows`（风格通用）→ 内置 `KIND_WINDOWS[type]` 预设（**类型签名，压过风格通用值**——3 个内置主题都配了完整 windows 块，否则类型差异会被抹平）→ `tokens.windows.types.<type>`（换肤微调最末级）。换肤微调（如把居民楼 warmRatio 调到 0.95）改 `windows.types.<type>` 即可；新旋钮 `winWRatio`（窗宽占比）与 `storefront`（底层橱窗）同样可覆盖。
- **缺省 = 通用楼**：不给 `type` 的楼渲染与 v2.29 完全一致；`category:'garage'` 时 type 无意义。
- **图例**：`generate_data.py` 缺省 legend 会扫描 spec 实际用到的 type 自动补「写字楼/居民楼/商业」条目（color 留空——色块回退 `var(--twin-building-type-*)`，未配 buildingType 时再回退 category 色，故默认与楼色一致）。
- 校验：`validate_spec.py` 对未知 type FAIL（schema enum + 手工兜底）；`spec.tokens` 覆盖白名单开放 `buildingType.` 与 `windows.` 前缀。

## 阶梯裙楼建模

`BuildingSpec.floors` 是**统一整数**——无法把一栋楼渲染成「主体 N 层、局部 M 层」的阶梯造型。**推荐方案**：拆多栋 + `connects`——将阶梯裙楼拆为多个 `BuildingSpec`，每段一层用一栋楼 + `connects` 字段豁免 AABB 间距校验：

```jsonc
"buildings": [
  { "id": "podium-5f", "category": "building", "w": 200, "d": 100, "floors": 5, "x": 80, "z": -30, "connects": ["podium-2f"] },
  { "id": "podium-2f", "category": "building", "w": 80,  "d": 60,  "floors": 2, "x": -50, "z": -20, "connects": ["podium-5f"] }
]
```

优点：完全靠现有 schema 表达；validate_spec 自动豁免；引擎无需改。缺点：楼顶标签各自独立（可加 `header` 区分）。完整范式见 `evals/files/generality/government-complex.json`（11F 主楼 + 5F 裙楼 connects 演示）。

## 楼层单位模板（unitTemplate）

`spec.unitTemplate` 可选。缺省 = 办公园区默认（内置 8 行业租户名池 + 8 个办公字段）。非办公园区（工业/物流/住宅/商业…）提供 `unitTemplate` 让 Mock 单位数据贴合园区语义：

```ts
interface UnitTemplate {
  fields?: { key: string; label: string; unit?: string }[]                  // 单位详情字段描述；提供则每单位产 UnitDetail.fields:[{label,value}]
  tenants?: { label: string; names: string[]; scope?: string; duty?: string }[]  // 租户/实体池（替代内置 8 行业）
}
```

- **`fields`**：提供时 `generate_data.py` 为每个单位产出 `UnitDetail.fields`，`UnitDetail.vue` 优先渲染它（覆盖办公字段）。`value` 按字段 `key`/`label` 语义启发式采样。
- **`tenants`**：替代内置 8 行业池。每项 `{label, names[], scope?, duty?}`。

> `unitTemplate` 只影响**开发/演示期 Mock 数据**（`generate_data.py` 派生）。正式环境单位详情仍由后端 `getFloorDetail()` 返回。

## 完整示例

一份完整、通过校验的示例在 `evals/files/example-spec.json`（XX园区，含 综合楼/主楼/服务楼/地下车库 + 若干 POI）。从真实 `.pen` 自动抽取的草稿在 `evals/files/sample-pen-extract.json`。泛化夹具（工业/政务/地下）在 `evals/files/generality/`。

## 字段如何映射到输出

| Spec 字段 | 驱动 |
|---|---|
| `title` | 页面/文档标题 |
| `style` | 选取 `assets/themes/<style>.tokens.json` + 渲染器/灯光/材质/地面分支（见 `styles.md`） |
| `tokens` / `shaders` | CSS 变量、`theme.ts`、Three.js `Color`、着色器 uniform（唯一事实来源；`shaders` 仅 `cyber` 消费） |
| `buildings[].category` | 3D 材质/边线颜色 + 图例色块 + 车库入口渲染分支（**静态**） |
| `buildings[].type` | v2.30 类型化外观：窗户/灯光模式 + 立面基色 + 体块形态（**静态**） |
| `buildings[].name` | 楼顶常驻标签 + 切换器标签 + 详情标题（**动态：`getBuildings()`**） |
| `buildings[]` 几何 | 占地底板（**静态**）；挤出高度/楼层拾取板/楼层虚线分隔由动态 `floors`/`floor_ids` 驱动（**`getBuildings()`**） |
| `garage` 类别楼栋 + `facing` | 半金字塔三角门入口 + P 牌（**静态**；占用走 `getPois()` 停车场 POI 的 `occupancy`） |
| `garages[]` | Y=0 之下透明玻璃柱坑体；多层按 `level` 堆叠；`generate_data.py` 写进 `ParkScaffold.garages`（**静态**，含 `capacity`/`occupied`） |
| `legend` | 屏幕 Legend 叠加（**静态**） |
| `switcher` | BuildingSwitcher 标签骨架（**静态**；标签 `name` 由 `getBuildings()` 水合） |
| `pois` | 类型化标记杆 + 图标 + tooltip/popup（**动态：`getPois()`**） |
| `environment.*` | 道路/车位/绿化/周边/氛围（§10，**静态**） |
| `cameraTour` | 航拍巡航（**静态**，写进 `ParkScaffold.cameraTour`） |
| `corridor` | 空中连廊（**静态**，写进 `ParkScaffold.corridor`） |

## 编辑规则

- **绝不在生成器里硬编码园区内容。** 发现自己在场景代码里写了"主楼"或 `10`，那它应该进 spec。
- **颜色只有一个事实来源。** 园区颜色放在所选风格的 `assets/themes/<style>.tokens.json`（或用 `spec.tokens` 覆盖）。不要散落 hex 字面量。
- 编辑后运行 `python scripts/validate_spec.py <spec.json>`，生成前修掉每一个 `FAIL:`。
