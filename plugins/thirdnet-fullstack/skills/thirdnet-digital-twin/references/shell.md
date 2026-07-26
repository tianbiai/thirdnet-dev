# 舞台外壳（Shell）—— 1920×1080 舞台 + 楼栋切换器

数字孪生是中央面板。本技能**只**生成「固定舞台 + 楼栋切换器 + 中央 CenterStage（含 3D canvas 与聚焦时的 UnitDetail）」；**不**生成 TopBar、CornerBrackets，也**不**生成任何外围 2D 数据面板。舞台左右两侧与底部**留空**，由调用方自行填充业务面板。

> **2D 层全部从 `assets/components/` 拷贝范式文件**（见下表）。v1.x/v2.0 的「从散文重建」路径已废弃。拷贝后只对齐 import 路径，不改 CSS/逻辑；4 种风格观感差异由 token `ui` 块驱动（组件 CSS 全走 `var(--twin-*)`）。

## 舞台布局

固定 **1920×1080** 舞台，由 `useScaleBoard`（`Math.min(innerW/1920, innerH/1080)`，信箱式）缩放到视口。内部只剩中央：

```
┌────────────────────────────── 1920 ───────────────────────────────┐
│            BuildingSwitcher → CenterStage                            │
│              （GlobalTwin <canvas> + 聚焦时 UnitDetail 叠加）          │
│   （左右两侧 + 底部留空 —— 调用方自行放置业务面板）                       │
└──────────────────────────────────────────────────────────────────────┘
```

一切都在 1920×1080 的 `.stage` 内绝对定位。颜色由 token 驱动（`generate_theme.py` 生成的 `--twin-*` CSS 变量）。字体：**Noto Sans SC**（中文）+ **Rajdhani**（拉丁/数字），从 Google Fonts 加载。

## 需要镜像的组件（拷贝，非重建）

| 组件（`assets/components/`） | 角色 | 数据形状 |
|---|---|---|
| `GlobalTwin.vue` | 挂载 canvas，实例化场景，接入选中 | `onMounted` 拉 `getBuildings()`+`getPois()` 水合场景；点击楼层拉 `getFloorDetail()`（见 `scene-recipe.md §12`）；`onGarageSelect → selectGarage` + `watch(belowView → setBelowView)`；`watch(current → scene.setStyle)` 多风格切换 |
| `CenterStage.vue` | 常驻 `<canvas>` + 聚焦时 `UnitDetail` 叠加 + Legend 定位 + 地下选中时 `GarageCard`（右下） | — |
| `BuildingSwitcher.vue` | 标签页：全局视角 + 每栋楼一个（+ 地下车库） | 骨架读静态脚手架 `parkScaffold.buildings`；标签 `name`/`header` 由 `getBuildings()` 水合；有 `garages[]` 时追加「地下车库」标签 → `enterBelowView` |
| `UnitDetail.vue` | 右半详情面板 + 多单位上一/下一 | 数据源 = `getFloorDetail()` 返回的 `FloorDetail`（`units: UnitDetail[]`） |
| `GarageCard.vue` | 地下车库信息卡（容量/已占用/空余/占用率，右下 `Transition rise`） | 静态读 `parkScaffold.garages`（按 `selectedGarageId` 命中） |
| `LegendPanel.vue` | 屏幕图例（常驻左上） | 静态 `parkScaffold.legend` |
| `PoiOverlay.vue` | POI 悬停名称条 + 点击卡片 | `useTwinData.pois` + `useSelection.openPoiId`（单开契约）；只投影当前打开的一个 |
| `TourToggleButton.vue` | 航拍巡航开关（右上角 `role="switch"`） | `useTour.enabled`；`GlobalTwin` `watch(enabled → scene.setTourEnabled)` |
| `StyleSwitcher.vue` | 多风格实时切换器（左上角） | `useStyle.current`；仅当 `parkScaffold.previewStyles.length > 1` 显示 |
| `useSelection/useScaleBoard/useTwinData/useTour/useStyle.ts` | 选中态 / 舞台缩放 / 动态数据中心 / 航拍开关 / 多风格开关（模块级单例） | 见 `scene-recipe.md §8/§13` |
| `theme.ts` | `applyTheme(style)`（ParkScene 消费）+ `applyCssVars`（spec.tokens 覆盖注入） | 静态 import `src/scene/themes/*.tokens.json`（tsconfig 需 `resolveJsonModule`） |

> 不再生成：`TopBar.vue`、`CornerBrackets.vue` 及任何外围 2D 业务面板。如果调用方的外围面板需要它们，由调用方自行实现。

## 动态数据水合接线

外围留空归外围，但**中央舞台自身**（`GlobalTwin` + `UnitDetail`）消费动态数据（完整契约见 `dynamic-data-api.md`，场景侧见 `scene-recipe.md §12`）：

- `GlobalTwin.vue` `onMounted`：`Promise.allSettled([getBuildings(), getPois()])` → `scene.hydrateBuildings()` + `scene.hydratePois()`。带 `hydrating`/错误态兜底。
- `BuildingSwitcher.vue`：标签骨架来自静态脚手架；每栋楼显示名用 `getBuildings()` 返回的 `name` 水合——水合前显示「加载中…」占位。
- `UnitDetail.vue`：由 `useTwinData.floorDetail` 驱动；`GlobalTwin` 楼层点击 watch 里调 `getFloorDetail({building_id, floor_id}, {signal})` 写入（`onCleanup + AbortController` 防 race）。
- **环境/取景/类别色等基础信息仍静态**，不参与水合——切楼/聚焦/滚轮等交互在水合前就可用（基于占地底板）。

## 选中 composable

`useSelection.ts` 原样拷贝——模块级单例：`focusedBuildingId`、`floorIndex`、`unitIndex`、悬停状态、`openPoiId`（POI 单开）、`belowView`/`selectedGarageId`（地下），以及 `eff*` computed（hover ?? focused）。切换器和 3D 点击都通过它写入。详细交互（铁律 + 反面模式）见 `scene-recipe.md §8`，地下选中见 `scene-recipe.md §14.3`。

> **铁律**：楼层点击只调 `selectFloor`（楼 + 层一次性写入）；`focusBuilding` 仅「切换器标签页」用——**绝不在楼层点击里调用**，否则会清空 `floorIndex`，导致鼠标移开后金色高亮边框消失。

## 样式

颜色只来自 token（v2.1 起派生也脚本化）：
```bash
python scripts/generate_theme.py <style> --out <项目根>/src/styles/tokens.css   # :root 全量 --twin-* 变量
```
在 `main.ts` 顶部 `import './styles/tokens.css'`；per-park 的 `spec.tokens` 覆盖在 `GlobalTwin` onMounted 里 `applyCssVars(spec.tokens)`（`src/utils/theme.ts`）。**不要加第二套颜色系统，不要在各文件里散落 hex。** 切换器/详情面板/图例/POI 卡片的观感差异由 token `ui` 块驱动——组件 CSS 全部 `var(--twin-*)`，改风格只换 token 不改组件。

## 响应式与降级

- **最小支持视口**：1280×720。低于此 `useScaleBoard` 仍缩放（舞台等比缩小），UI 文字可读性下降——舞台角落给一行「建议 1920×1080 及以上分辨率查看」提示（token 驱动、可关闭）。
- **portrait / 超宽屏**：舞台永远保持 16:9 信箱化（上下或左右留黑），**不**为 portrait 重排。
- **resize 防抖**：`useScaleBoard` 与 `frameCamera()` 的 resize 回调**必须防抖 150ms**。
- **`devicePixelRatio` 上限 2**：`renderer.setPixelRatio(Math.min(dpr, 2))`。
- **低性能设备**：无 WebGL2 或 `navigator.hardwareConcurrency` 低（≤4）时降档——bloom 关闭、阴影改 PCF、环境密度降一档。

## 可访问性

数字孪生是 3D 画布为主，但仍须提供键盘与屏幕阅读器可达性：

- **楼栋切换器**：`role="tablist"`/`role="tab"` + `aria-selected`；方向键在标签间移动焦点；当前聚焦楼写进 `aria-activedescendant`。
- **canvas 文本替代**：`<canvas>` 加 `role="img"` + `aria-label`（如「XX园区 数字孪生 3D 场景，含 N 栋楼，可用键盘楼栋切换器浏览」）。
- **POI 标记**：POI 详情走 HTML 弹出卡，弹出时 `aria-live="polite"`；键盘可聚焦打开的 POI 卡片、Esc 关闭。
- **UnitDetail 面板**：打开时把焦点移入面板，Esc 关闭并把焦点还给触发的楼层。
- **对比度**：所有标签文字对背景对比度 ≥ WCAG AA（4.5:1 正文 / 3:1 大字）。
- **`prefers-reduced-motion`**：禁用相机聚焦补间（瞬切）、POI 告警呼吸动画、bloom 强度减半；**航拍巡航整按钮禁用**（`aria-disabled` + `disabled`，`setTourEnabled(true)` 为 no-op）。

## 空 / 加载 / 错误态

三态兜底覆盖每个动态数据消费者（对齐技能既有 `@error` 哲学）：

- **加载态（骨架）**：`hydrating=true` 时——切换器标签显占位；UnitDetail 区域显骨架屏；POI 层不渲染。脚手架立即可见，不白屏。
- **空态**：`getBuildings()` 返回 `[]` 时——中央显空态遮罩「该园区尚未配置楼栋」+ 刷新按钮；`getPois()` 返回 `[]` 不报错；`FloorDetail.units` 为空时 UnitDetail 显「该层暂无单位信息」。
- **错误态（分方法 + 重试）**：楼栋水合失败显「楼栋数据加载失败 + 重试」、POI 失败显「POI 数据加载失败（楼栋仍可交互）」、楼层详情失败在 UnitDetail 面板内联「加载失败 + 重试」。**绝不静默 `catch {}` 吞错误**。错误文案区分 `ApiError.status`：401→「未授权」、404→「数据不存在」、5xx→「服务端异常」、0→「网络异常」。

## dispose 与上下文恢复

详见 `scene-recipe.md §9`，shell 侧须确保：
- `GlobalTwin.vue` 的 `onBeforeUnmount` 调 `scene.dispose()`（完整清单见 scene-recipe §9）。
- canvas 监听 `webglcontextlost`/`webglcontextrestored`，丢失时显式遮罩 + 停渲染，恢复时重建 GPU 资源。
- `ResizeObserver` 在卸载时 `disconnect()`。
