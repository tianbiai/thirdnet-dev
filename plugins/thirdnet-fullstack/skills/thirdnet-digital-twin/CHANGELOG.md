# 变更历史（CHANGELOG）

数字孪生技能版本演进记录。生成器**无需阅读本文件**——当前能力以 SKILL.md / references / assets 为准；本文件仅供追溯「某能力是哪个版本引入的、为何这么设计」。

---

## v2.14.2（2026-07-23）

- **消除「地平线长直线」**：`buildGround` 外圈城市地面 plane `PlaneGeometry(bx*3.2, bz*3.2)`→`bx*30, bz*30`（1152×704→10800×6600）。原尺寸远端 Z 边（z=−352）落在画面中段、且 X±576 略大于可视区±545 故横贯整屏，地面在此戛然而止露出星空背景 → 一条贯穿页面的地平线硬边；放大后远端退到真实地平线（视消失点），地面与天空在色差极小处（cyber `environment.city-ground` `#080418` ≈ 背景渐变中段 `~#080614`）天然相接，硬边消失。技能 `assets/park-scene.impl.ts` 与生成产物 `src/scene/ParkScene.ts` 同改（单 plane，成本可忽略）。注：移除外围墙（v2.14）后该地平线硬边才暴露——此前被远端围墙遮挡。

## v2.14.1（2026-07-23）

- **文档纠偏**：清理 v2.10 改代码（`defaultMaxPolar` 1.3→π-0.1 解锁地下俯仰）时遗留的 3 处过时极角文案——`spec.schema.json` / `generate_data.py` 模板 / `references/park-spec.md` 中 `cameraTour.elevation` 的注释由 `钳到 polar[0.5,1.3]` 更正为 `polar[0.5,π-0.1]`（引擎代码自 v2.10 起即 π-0.1，纯文档对齐，能力零增减）。该文案此前会随生成器拷进目标项目脚手架注释（如 `data/park.ts`），让人误以为相机仍被锁在水平面之上。

## v2.14（2026-07-23）

- **移除「园区外围墙」特性**：删 `buildSurrounding` 的围墙渲染块（沿 boundary 矮 `BoxGeometry` 链，俯瞰视角下远端成一条横贯画面的长直线）+ `spec.environment.surrounding.wall` schema 字段 + 6 风格 token 的 `environment.wall` 配色；**地下车库玻璃壁**（`underground.wall`/`wallOpacity`、`building-geometry.ts` 坑体 4 面壁、`park-scene.impl.ts` 的 `wallHex/wallOp`、楼栋立面底色 `wall`）全部不受影响、保留。同步清理 `references/`（park-spec / scene-recipe / intake）、`validate_spec.py`（「围墙」→「边界」措辞）、`evals.json`、fixture（example-spec / government-complex）的相关描述与中文「围墙」字样；闸机 / 入口引道保留（独立于围墙）。

## v2.13（2026-07-23）

- **文档全面精简**：SKILL.md 由 298 行精简至 ~150 行，清理散落在正文各处的 `v1.x/v2.x 起` 版本前缀噪声（生成器只消费当前事实，版本演变下沉本文件）；references 合计由 ~2400 行精简至 ~1500 行，移除文档间抄写（5 文件契约层表 / 13 组件拷贝清单 / 数据分层表此前在 SKILL.md + 3 个 references 重复出现）、移除与 `assets/api/*.ts` 模板逐字重复的代码块（改为「逐字拷贝模板」指针）、收敛 `DigitalTwin.ts` 说明性引用为脚注。能力零增减。

## v2.12

- **建筑平面图与多风格预览支持**：① schema 扩 `poi.roomSpec`（`area/capacity/dept/duty` 结构化字段，政务/功能房间用例）；`PoiRuntimeItem` 同步增 `room_spec`；`PoiOverlay` 优先渲染 `roomSpec` 块，`tooltip.meta` 退为兜底。② schema 扩顶层 `previewStyles?: Style[]`——spec 一次性声明多套待切换风格；配合新增 `StyleSwitcher.vue` + `useStyle.ts`（current/setStyle 单例 + applyTheme/applyCssVars 联动），`GlobalTwin.vue` 顶部叠加切换器、`watch(current) → scene.setStyle` 单向推回；缺省仅 spec.style 一套。③ 政府/政务园区 token 调色指引（见 `references/intake.md` 模式 E 与 `evals/files/generality/government-complex.json` 夹具：11F 主楼 + 5F 裙楼 `connects` + 6 功能房间 POI + 246 地面车位 + `previewStyles: 6 风格`）。④ 顺手修：`ParkScaffold` 接口增 `connects?`/`previewStyles?`。

## v2.11

- **地下坑体推荐默认回调**：`deck_y` 推荐典型值 200→140（平衡坑体可见性与场景紧凑度）；`validate_spec.py` 偏浅 WARN 阈值 `<160`→`<140`；`setBelowView` 相机兜底深度常量 200→140；范例 fixture 同步。

## v2.10

- **地下坑体加深 + 相机解锁地下俯仰**：① `deck_y` 推荐默认 120→200（renderer 透传 `deckY=-|deck_y|`，不在引擎侧 clamp，避免多层堆叠下相邻层 clamp 到同一最小值致深层零高度）；`validate_spec.py` 增 `deck_y<160` 偏浅 WARN。② 相机解锁地下俯仰：`defaultMaxPolar` 1.3→π-0.1、`BELOW_POLAR_MAX` 2.6→π-0.1，可拖到地面之下仰视坑体（从下方看 Y=0 不透明地面因 BackSide culling 自然消失）。

## v2.9

- **连廊跨层 + 连体楼豁免 + 引擎 bug 修复**：① `corridor.floorEnd`：空中连廊支持跨层（如 3–5 层）。② `buildings[].connects`：声明物理连通楼栋对（裙楼/连体楼）豁免 `validate_spec.py` 的 AABB 间距/重叠 FAIL。③ 修复潜伏 typecheck bug。

## v2.8

- **通用化与死代码清扫**：① 解锁 `corridor`（空中连廊）。② 删除引擎死代码：v2.4 遗留 `wire|white` 不可达材质分支、`fresnelRim.glsl` 空块、`configureGTAO` 空 try/catch、selectionOverlay.geometry dispose 泄漏、useTwinData 返回对象冗余 errMsg。③ 文档对齐当前事实：渲染管线表补 realistic/night-realistic 两行、组件数 12→13、DigitalTwin.ts 幽灵引用改指 park-scene.impl.ts。

## v2.7

- **通用化**（不再假设园区是办公楼）：放开 `buildings[].category` 与 `pois[].type` 枚举；新增 `spec.unitTemplate`（fields/tenants）定制非办公园区单位字段与租户池；地下泛化（POI `floorIndex` 负值 + `garageId`、`garages[].usage`）。

## v2.6

- **地下场景**：顶层 `garages[]` 负层坑体（Y<0 透明玻璃柱）+ `setBelowView` 相机俯冲 + `GarageCard.vue` + `underground` token。

## v2.5

- **恢复写实两风格**（realistic/night-realistic）并以提交 token 文件激活内置写实引擎（envMap + GTAO + 软阴影 + 湿润反射 + 雾 + 强 bloom + 发光窗）；强化共享几何、修复失效旋钮、5 文件契约层 4 个静态样板固化为 `assets/api/` 可拷贝模板。

## v2.4

- 精简为 4 风格（移除 blueprint/white-model；引擎写实分支保留未删，v2.5 起被写实两风格重新激活）。

## v2.3

- 选中楼层高亮增强（描边 + 4 立面半透明填充，按风格 token 配色）。

## v2.2

- **航拍巡航**（`useTour` + `TourToggleButton` + `setTourEnabled` + `spec.cameraTour`）；v2.2.1/2.2.2 维护修复（广告牌 sprite 绕过 GTAO、夜景/全息地面可辨）。

## v2.1

- 随包发布 `assets/components/` 范式文件 + 3 个生成脚本（generate_data/theme/layout_park）；`validate_spec` 增楼栋出界/重叠/POI 越界 FAIL；真实感细节层（天空/楼顶设备/标线/绿化/水景）。

## v2.0

- 随包发布完整范式实现 `assets/park-scene.impl.ts`（生成器「拷贝-改」消灭渲染管线漂移）+ `realism` token 旋钮块 + `tokens.schema.json`。

## v1.8 / v1.9

- 性能纪律、健壮性（WebGL context loss / Promise.allSettled / AbortSignal）、响应式与 a11y、防黑屏（显式 `scene.background` + `ambientFloor`）、POI 名称仅悬停、程序化地面纹理。

## v1.5

- 数据分层（基础信息静态内联 vs 动态数据走 `IDigitalTwinApi` 契约层）。

## v1.2 – v1.4

- 园区环境、POI 打点、楼层虚线 + 贴砖拼花、地面车位升级、高对比可读标签。
