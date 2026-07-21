# Park Spec（园区规格说明）

**Park Spec** 是一份园区数字孪生的唯一规范描述。每种输入模式（文字、草图、效果图、`.pen`）都会被转换成这样一份 spec，由用户确认，生成器只从它读取。任何特定园区的内容（“综合楼”、“10 层”等）都绝不硬编码在生成器里——一切都从 spec 流入。

本文件是 schema 的事实来源。`scripts/validate_spec.py` 依据它校验 spec；`assets/spec.schema.json` 是同结构的 JSON Schema（draft-07），可供 IDE 自动补全与 CI 无 Python 校验。编写或编辑 spec 前先读本文件。

> **命名约定边界（v1.8）**：spec 层与运行时 TypeScript **一律 camelCase**（`buildingId`、`floorIndex`、`poiId`）。**snake_case 仅出现在 HTTP DTO**（后端 `*Map` 响应，如 `building_id`、`floor_index`）—— 由 Real 工厂层在请求/响应边界做映射，前端组件永不知晓 snake_case。本文件里的 `buildingId`/`floorIndex` 是 camelCase；`dynamic-data-api.md` §4 的 `PoiRuntimeItem.building_id` 是后端 DTO 形态，工厂层映射为 camelCase 后再交组件消费。

## 数据分层注记（v1.5）

spec 仍是**创作唯一事实来源**（生成时读取），但生成器把它的内容**分区输出**为两层（详见 `dynamic-data-api.md`）：

- **基础信息**（静态内联进页面）：风格 / tokens / shaders / 字体 / 舞台 / boundary / floorHeight；楼栋**位置与占地**（`buildings[].id/w/d/x/z/category/facing`）；园区环境（`environment`）；Legend / switcher 骨架。
- **动态数据**（运行期走 `IDigitalTwinApi` 契约层，开发期由 spec 派生为 Mock、正式环境调真实后端）：楼幢**业务数据**（`buildings[].name/floors/floor_ids/header`、`floors_detail`）与 **POI 点位**（`pois[]`，含停车场 `occupancy`）。

也就是说：下文 schema 里 `buildings[].name/floors/floors_detail` 与 `pois[]` 这些字段，**在生成时用于派生 Mock 数据**（动态），而**不是**静态内联进 `src/data/<park>.ts`——静态脚手架只保留楼栋占地几何。schema 本身不变；变的是生成器如何分区输出这些字段。

## 坐标系与单位

- **世界单位**，任意尺度。X = 东，Z = 南，Y = 上。
- 楼栋坐落在地面（Y=0）的 `(x, z)`；其占地为 `w`（X 方向尺寸）× `d`（Z 方向尺寸），以 `(x, z)` 为中心。
- **`floorHeight`**（默认 `24`）—— 每层的世界单位高度。一栋楼总高 = `floors * floorHeight`。
- **`boundary`**（默认 `{x:360, z:220}`）—— 园区在 X 上延展 ±`boundary.x`、Z 上延展 ±`boundary.z`。网格地面和相机取景都据此确定尺寸。让所有楼栋占地保持在其内部。
- 散开楼栋以填满宽的中央面板（3–5 栋楼大致沿 左上→右下 对角线效果不错）。锁定前用截图目视校验布局。

## TypeScript 接口

```ts
type Category = 'building' | 'garage'

interface ParkSpec {
  title: string                       // "XX园区" —— 页面/文档标题
  style?: Style                       // 视觉风格；默认 'cyber'（见下方 Style）
  stage?: { width: number; height: number }  // 默认 1920×1080
  tokens?: Record<string, string>     // 颜色覆盖；省略则按 style 用 assets/themes/<style>.tokens.json
  shaders?: {
    grid?: { u_gridColor: string; u_cell: number; u_strength: number }
  }                                   // 仅 cyber 风格消费；其它风格忽略
  floorHeight?: number                // 默认 24
  boundary?: { x: number; z: number } // 默认 {360, 220}
  buildings: BuildingSpec[]
  legend?: LegendEntry[]              // 默认 = 楼幢 + 地下车库 两个类别
  switcher?: (string | { id: string; label?: string })[]
                                // 标签页骨架。v1.8 推荐对象形式 {id,label?}：id 显式对齐
                                // buildings[].id，label 缺省由 getBuildings() 水合 name。
                                // 裸字符串形式仍兼容（按名字推断，较脆弱）。默认 = 全局视角 + 每栋非车库楼 + 地下车库
  environment?: ParkEnvironment       // 园区环境（道路/地面车位/绿化/周边/氛围）；缺省 = 智能默认
  pois?: PoiSpec[]                    // 兴趣点（类型+坐标+提示）；缺省 = []（不生成 POI）
}

type Style = 'cyber' | 'realistic' | 'night-realistic' | 'blueprint' | 'holographic' | 'white-model' | 'isometric'
// cyber          —— 赛博：着色器网格地面 + 自发光霓虹（默认）
// realistic      —— 真实物体：日间 PBR（玻璃/混凝土）、天空+太阳、柔和阴影
// night-realistic—— 夜间写实：PBR + 夜空 + 窗户自发光 + 路灯 + 微反射
// blueprint      —— 蓝图：工程蓝图风（深蓝图底 + 淡白青坐标网格地面 + 白线框楼栋），与 cyber 共用 grid.glsl
// holographic    —— 全息：半透青玻璃体 + 自发光边缘辉光 + bloom（未来科技感）
// white-model    —— 白模：全白磨砂 + 柔和接地阴影（博物馆/沙盘级纯净汇报）
// isometric      —— 等距插画：flatShading cel 着色的鲜活彩色楼栋（扁平信息图风）
// 风格详细分支见 references/styles.md。

interface BuildingSpec {
  id: string                          // slug，唯一 —— 用于切换器、选中、详情视图
  name: string                        // "主楼" —— 作为楼顶常驻标签 + 切换器 + 详情标题显示
  category: Category                  // 驱动 3D 颜色 + 图例色块 + 车库入口渲染分支
  w: number                           // 占地 X 方向尺寸（世界单位）
  d: number                           // 占地 Z 方向尺寸
  floors: number                      // 楼层数（高度 = floors * floorHeight）；车库条目可选/忽略
  x: number                           // 中心 X
  z: number                           // 中心 Z
  facing?: 'N' | 'S' | 'E' | 'W'      // 朝向；仅对 category:'garage' 有意义（半金字塔入口朝向），默认 'S'
  header?: string                     // "10F · 12单位" —— 详情/切换器后缀
  highlightedFloor?: number           // 初始金色高亮的楼层（从 0 开始）
  floors_detail?: FloorSpec[]         // 详情面板的每层租户（可选）
}

// v1.3 起 GarageSpec 已删除：地下车库不再承载占用数据，仅作为 buildings[] 里
// category:'garage' 的入口标记（半金字塔三角门 + P 牌）。运营态车位数据留给后台/详情面板按需拉取。
//
// v1.5 起数据分层（见文首「数据分层注记」与 dynamic-data-api.md）：
//   静态内联（基础信息）= id / category / w / d / x / z / facing（楼栋占地几何 + 类别）。
//   动态走 getBuildings()（Mock 由 spec 派生）= name / floors / header / floors_detail
//     （楼幢业务数据：名/楼层数/floor_ids/楼层详情）。highlightedFloor 仍属静态初始态。
//   即：生成器把 name/floors/floors_detail 派生为 mockBuildings/mockFloorDetails，
//   而不是静态写进 src/data/<park>.ts。

interface PoiSpec {
  id: string                          // slug，唯一 —— 用于拾取/选中
  type: PoiType                       // 驱动 3D 图标 + 颜色（token 的 poi.<type> 映射）
  label: string                       // 标记旁短名；同时作为 tooltip 默认标题
  x: number                           // 世界坐标 X
  z: number                           // 世界坐标 Z
  y?: number                          // 高度；默认地面（0），室内点位可给具体高度或配合 floorIndex
  buildingId?: string                 // 可选：绑定到 buildings[].id（室内点位）
  floorIndex?: number                 // 可选：绑定到某层（与 buildingId 配合，从 0 开始）
  tooltip?: {                         // 可选：悬停/点击弹出的提示卡数据
    title?: string                    // 缺省取 label
    description?: string              // 正文，支持简单换行
    meta?: Record<string, string>     // 键值对（如 负责人/电话/状态/容量）
  }
}

type PoiType = 'entrance' | 'exit' | 'camera' | 'gate' | 'service' | 'landmark' | 'parking' | 'custom'
// entrance  —— 园区/楼栋出入口
// exit      —— 出口
// camera    —— 监控摄像头
// gate      —— 闸机/道闸
// service   —— 服务点（物业/客服/服务中心）
// landmark  —— 地标/景观
// parking   —— 停车场（地面/地下入口）
// custom    —— 其它（用 token 的 poi.custom 兜底色）

interface LegendEntry {
  label: string                       // "楼幢" | "地下车库"
  category: Category
  color: string                       // hex；应与 tokens 中的类别颜色一致
}

interface FloorSpec {
  index: number                       // 从 0 开始，从地面往上
  label: string                       // "1F".."10F"
  tenant: string                      // 租户名
  units?: UnitDetail[]                // ≥1；>1 时启用左右单位切换
}
```

`UnitDetail`（用于 `FloorSpec.units`）镜像已存在的 `src/data/unit.ts` 形状 —— 参见 `references/shell.md` 和 `references/exemplar.md`。

## 园区环境（ParkEnvironment）

`spec.environment` 是**可选**的。提供则按值生成园区地面、道路、地面车位、绿化、周边市政道路、围墙、路灯等环境元素；**省略则用智能默认**（环形内部道路 + 按楼栋规模推算的地面车位 + 普通密度绿化 + 四向市政道路 + 围墙 + 主闸机 + 路灯）——保证「不问也能产出一张完整的、嵌在城市里的全景图」。生成细则见 `references/scene-recipe.md §10`。

```ts
interface ParkEnvironment {
  internalRoads?: 'loop' | 'cross' | 'grid' | 'none'        // 园区内部道路形状；默认 'loop'
  surfaceParking?: { stalls: number; occupied?: number } | null
                                // v1.4 地面车位；stalls = 长方形车位数；occupied = 「示意停放车辆数」（缺省 round(stalls*0.3)≈30%，≤stalls），决定多少个车位放汽车代理体。null = 无地面车位
  greenery?: {
    treeDensity?: 'sparse' | 'normal' | 'lush'               // 行道树密度；默认 'normal'
    centralPlaza?: boolean                                   // 中央广场；默认 true
    waterFeature?: boolean                                   // 水景/水池；默认 false
  }
  surrounding?: {
    roads?: boolean        // 四向市政道路；默认 true
    sidewalk?: boolean     // 园区边沿人行道；默认 true
    wall?: boolean         // 围墙/护栏（false 则改用绿篱）；默认 true
    gate?: boolean         // 主出入口闸机；默认 true
  }
  ambiance?: {
    streetLamps?: boolean  // 街灯（night-realistic 下挂 PointLight）；默认 true
    groundGlow?: boolean   // 地面发光标线；cyber 默认 true，其余风格默认 false
    vehicles?: boolean     // 周边道路与车位的车辆/行人代理体；默认 true
  }
}
```

**校验规则**（`validate_spec.py`）：`environment` 缺失 → 仅 `WARN`（不 FAIL）；存在时枚举字段必须合法、`surfaceParking.stalls > 0`、若给 `occupied` 则 `≤ stalls`。**字段全部可选**——给一个空 `{}` 也合法，等同智能默认。

## 兴趣点（POI）

`spec.pois` 是**可选**的（缺省 `[]` = 不生成任何 POI）。每个 POI 描述地图上一个打点：**类型（驱动图标+颜色）+ 世界坐标 + 可选楼层归属 + 可选提示卡数据**。POI 与楼幢/单位同源——全部走 spec，是后台 API 可配置的数据契约。生成细则见 `references/scene-recipe.md §11`。

> **v1.5 起 POI 是动态数据**：`pois[]` 在生成时**派生为 `mockPois`**（`mock/data/manager/digital-twin.ts`），运行期通过 `getPois()` 获取（开发期 Mock、正式环境真实 API），而**不**静态内联进页面。Mock 项在 spec 的 `PoiSpec` 基础上补 `status`（`PoiStatusEnum`）与停车场 `occupancy`（v1.3 外包的车库占用并入此处）。POI 的 `tooltip` / 坐标 / 楼层归属字段在 spec 与运行期 `PoiRuntimeItem` 之间保持一致（见 `dynamic-data-api.md` §4）。

POI 的 `tooltip` 是规范化的「提示数据」：`title` / `description` / `meta`（键值对）。生成器把它渲染成悬停/点击的 HTML 弹出卡。不给 `tooltip` 的 POI 仅显示 `label` 标签。打点位置用世界坐标 `{x, z, y?}`；室内点位用 `buildingId` + `floorIndex` 绑定到具体楼层。

**校验规则**（`validate_spec.py`）：`pois` 缺失 → 合法（不 WARN）；存在时必须是数组，每项 `id` 唯一、`type` ∈ 枚举、`label` 非空、`x/z` 为数字；`buildingId` 给定时必须命中某栋 `buildings[].id`，`floorIndex` 为非负整数。

## 类别语义

| 类别 | 含义 | 默认颜色 | 3D 处理 |
|---|---|---|---|
| `building` | 楼幢 —— 一栋普通的地上建筑 | 青色 `#27a8ff` | 挤出的盒体、幕墙纹理（v1.4 每层 1–5 块贴砖；v1.7 相邻贴砖深浅两色交替 + 深色竖实线）、**楼层虚线分隔**、屋顶边线、**楼顶常驻名称标签** |
| `garage` | 地下车库 —— 地下车库入口 | 薄荷绿 `#3df0c8` | **半金字塔三角门入口 + P 标识牌**（v1.3 起；不再有占用标牌/进度条） |

至多**一栋**楼是 `category: 'garage'`（校验器会拒绝更多）。车库楼承载入口标记，朝向由 `facing`（默认 `'S'`）决定。

## 完整示例

一份完整、通过校验的示例在 `evals/files/example-spec.json`（XX园区，含 综合楼/主楼/服务楼/地下车库 + 若干 POI）。从真实 `.pen` 自动抽取的草稿在 `evals/files/sample-pen-extract.json` —— 当输入是 `.pen` 时把它作为起点，然后通过检查 Scene 填补 `id`/`category`/`w`/`d`/`x`/`z`（抽取器把它们留为 null）。

## 字段如何映射到输出

| Spec 字段 | 驱动 |
|---|---|
| `title` | 页面/文档标题 |
| `style` | 选取 `assets/themes/<style>.tokens.json` + 决定渲染器/灯光/材质/地面分支（见 `references/styles.md`） |
| `tokens` / `shaders` | `_tokens.scss`、`theme.ts`、Three.js `Color`、着色器 uniform（唯一事实来源；`shaders` 仅 `cyber` 消费） |
| `buildings[].category` | 3D 材质/边线颜色 + 图例色块 + 车库入口渲染分支（**静态**） |
| `buildings[].name` | 楼顶常驻名称标签 + 切换器标签页 + 详情标题（**v1.5 动态：`getBuildings()`**） |
| `buildings[]` 几何 | 占地底板（**静态**）；挤出高度 / 楼层拾取板 / 楼层虚线分隔 + 房间明度层次（v1.4 程序化，不进 spec）/ 详情视图楼层 —— 由动态 `floors`/`floor_ids` 驱动（**v1.5：`getBuildings()`**） |
| `garage` 类别的楼栋 + `facing` | §5 半金字塔三角门入口 + P 标识牌（**静态**；占用数据 v1.5 走 `getPois()` 停车场 POI 的 `occupancy`） |
| `legend` | 屏幕上的 Legend 叠加（Hdr → Legend）（**静态**） |
| `switcher` | BuildingSwitcher 标签页骨架（全局视角 + 每栋非车库楼一个条目 + 地下车库）（**静态骨架**；标签 `name` v1.5 由 `getBuildings()` 水合） |
| `pois` | §11 `buildPOIs` —— 类型化标记杆 + 图标 + tooltip/popup（悬停/点击）（**v1.5 动态：`getPois()`**） |
| `environment.internalRoads` | §10 `buildInternalRoads` —— 园区内部环形/十字/井字道路 |
| `environment.surfaceParking` | §10 `buildSurfaceParking` —— 长方形车位 + 每位印 P + ~30% 示意车辆（v1.4；`occupied` 控制放车数量） |
| `environment.greenery` | §10 `buildGreenery` —— 草地色块 + 行道树（密度）+ 中央广场/水景 |
| `environment.surrounding` | §10 `buildSurrounding` —— 四向市政道路 + 人行道 + 围墙 + 主闸机 |
| `environment.ambiance` | §10 `buildAmbiance` —— 街灯（夜间 PointLight）+ 地面发光标线 + 车辆/行人 |

## 编辑规则

- **绝不在生成器里硬编码园区内容。** 如果你发现自己在场景代码里写了“主楼”或 `10`，那它应该进 spec。
- **颜色只有一个事实来源。** 园区颜色放在所选风格的 `assets/themes/<style>.tokens.json`（或用 `spec.tokens` 覆盖）。从中派生 SCSS 变量、CSS 自定义属性、Three.js `Color` 和着色器 uniform 颜色——不要散落 hex 字面量。
- 编辑后运行 `python scripts/validate_spec.py <spec.json>`，生成前修掉每一个 `FAIL:`。
