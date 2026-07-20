# 范例（Exemplar）—— 现有的 `d:\Vibe\社区` 实现

本技能所在的仓库已包含一个可工作的园区驾驶舱实现。把它当作**模式参考**。这份地图说明每个文件做什么、该**拷贝**什么、该**修**什么（五个已知缺口）。为同一仓库生成时，你是在扩展/泛化这些文件；为新项目生成时，你是从这些模式 + 配方重建它们。

> 范例是**参考**，不是约束。本技能产出**符合所选风格规范的**版本（赛博下接入着色器；类别颜色、图例、车库作为一栋楼、点击选中/详情在所有风格下都成立）。范例偏离的地方就修——不要复制偏差。

## 原样拷贝的内容

| 文件 | 为什么好 |
|---|---|
| `src/composables/useSelection.ts` | 干净的模块级选中单例（focused/floor/unit + 悬停 + `eff*`）。原样使用。 |
| `src/data/parkModel.ts` | `BuildingModel`/`FloorSpec`/`Unit` 形状 + 用于合成租户的 `inferCategory`/`CAT` 8 行业模板映射。泛化数据，保留模式。 |
| `src/data/unit.ts` | `UnitDetail` 形状（负责人/联系电话/在编人员/办公面积/单位性质/服务时间/业务范围/职责）。 |
| `src/styles/_tokens.scss`、`_glow.scss` | 忠实的赛博 token + 发光 mixin。**统一**以 `assets/themes/<style>.tokens.json` 为来源（赛博风格即范例的 token）。 |
| `src/utils/theme.ts` | `valueColor` 映射 + `hexOf`/`glowHex` 用于内联图表样式。 |
| `src/composables/useScaleBoard.ts`、`useClock.ts` | 缩放适配 + 实时时钟。原样使用。 |
| `src/components/center/UnitDetail.vue` 及中央小组件 | 忠实的 1:1 赛博复刻，是中央 CenterStage 的一部分——镜像它。**注意**：范例里的外围 2D 组件（TopBar、PersonAccess、VehicleAccess、CameraGrid、MeetingRooms、RepairTimeline、CornerBrackets）本技能**不再生成**——外围留空（见 `references/shell.md`）。 |

## 作为模式拷贝（然后改造）

**`src/scene/DigitalTwin.ts`**（约 1,477 行）—— Three.js 工作。把以下章节当作新 `ParkScene.ts` 的模式：
- `1-216` —— 渲染器（alpha/ACES/DPR）、`OrthographicCamera` 等轴设置、灯光、雾、PMREM 环境。**拷贝相机 + 渲染器；**把重 IBL/VSM **修剪**成更平的赛博观感。
- `272-327` —— 地面。**替换**程序化沥青画布为**着色器地面**（`scene-recipe.md §3`）。
- `424-465, 766-890` —— 楼栋：`BoxGeometry`、6 材质数组、`makeFacadeTexture` 画布、`addFloorRings`、`addDoors`、屋顶 + `EdgesGeometry`。**拷贝幕墙/楼层环线模式；按类别重上色。**
- `509-560, 623-725` —— 楼层拾取板 + 指针悬停/点击/射线投射。**原样拷贝。**
- `708` —— `setSelection(buildingId, floorIndex)` 金色光晕（`LineSegments2` + 半透明填充）。**拷贝。**
- `1368-1416` —— 聚焦补间（`target.lerp`）。**借鉴其相机过渡思路，但改写成「事件触发 + 有限时长」tween，勿照搬「每帧无条件 lerp zoom/target」**——那会与 `OrbitControls` 滚轮缩放/平移冲突（见 `scene-recipe.md` §9 警告）。
- `1434-1452` —— 动画循环。**拷贝。**
- `1454` —— `dispose()` 完整拆除。**拷贝。**

## 要修的五个缺口（不要复制偏差）

1. **着色器未接入。** `grid.glsl`（仓库根）和适配后的 `src/scene/shaders/gridGround.glsl` 的**导入数为零**。运行时只用程序化沥青 + `UnrealBloomPass`。→ 按 `scene-recipe.md §3` 接入。（`?raw` 类型管线已存在于 `src/vite-env.d.ts`。）
2. **没有屏幕图例。** → 添加 Hdr → Legend 叠加（`scene-recipe.md §7`）。
3. **地下车库 是斜坡而不是一栋楼；缺少 地下车库 切换器标签页**（`switcher.ts` 只有 4 个标签页，设计要求 5 个）。→ 加一栋 `category: 'garage'` 的楼 + 第 5 个标签页。
4. **三套颜色系统** —— `_tokens.scss`、`DigitalTwin.ts` 里的 `COL` 数字 hex、`theme.ts` 里的 `valueColor`。→ 所选风格的 `assets/themes/<style>.tokens.json` 是唯一来源；派生其余。
5. **数据硬编码为 3 栋楼。** → 由 spec 驱动：从 `ParkSpec` 生成 `src/data/buildings.ts`（或每个园区一个文件）。
6. *（附加，外围面板相关——本技能不再生成这些面板，仅供调用方参考）* **硬编码时间戳** —— 范例 `CameraGrid` 的 `09:12:46`、`RepairTimeline` 的 `2026-07-18`。→ 若调用方自行重建外围面板，用 `useClock`。
7. *（附加）* **每个标签页重建场景**（无 keep-alive）。→ 长生命周期单例（`scene-recipe.md §10`）。
8. *（附加）* **`FloorIndex.vue` 孤立** —— 被取代的 调整版 视图里的 SVG 等轴楼栋。→ 决定：删除，或留作 地下车库/调整 详情视图。

## 技术栈事实（用于新项目生成）

- `package.json` 是手写的最小集（24 行）：Vue `^3.5`、Vite `^8`、`@vitejs/plugin-vue`、`three` `^0.185`、`sass`、`typescript`、`vue-tsc`。**不是** `create-thirdnet-admin`。入口是 `createApp(App).mount('#app')` —— 没有 router/pinia/i18n。
- 开发服务器**端口 3000**（`vite.config.ts → server.port: 3000, host: true`）。
- `index.html` 从 Google Fonts 加载 **Noto Sans SC** + **Rajdhani**。
- 脚本：`dev`、`build`（`vue-tsc --noEmit && vite build`）、`preview`、`typecheck`。
- `tsconfig.json`：ES2022、bundler resolution、strict、`types: ["vite/client"]`。

对于**新项目**，搭这个最小技术栈脚手架（匹配范例的 `package.json`/`vite.config.ts`/`tsconfig.json`/`index.html`），然后从 spec 生成数据 + `ParkScene.ts` + 组件 + 样式。
