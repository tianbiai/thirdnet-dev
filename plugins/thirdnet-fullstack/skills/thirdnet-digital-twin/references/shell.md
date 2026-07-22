# 舞台外壳（Shell）—— 1920×1080 舞台 + 楼栋切换器

数字孪生是中央面板。本技能**只**生成「固定舞台 + 楼栋切换器 + 中央 CenterStage（含 3D canvas 与聚焦时的 UnitDetail）」；**不再**生成 TopBar、CornerBrackets，也**不**生成任何外围 2D 数据面板（人员出入 / 车辆出入 / 摄像头 / 会议室 / 报修）。舞台左右两侧与底部**留空**，由调用方自行填充其它的业务面板。

> **v2.1 起：2D 层全部从 `assets/components/` 拷贝范式文件**（10 个，清单见 SKILL.md 步骤 6）。v1.x/v2.0 的「从范例拷贝 / 按散文重建」路径已废弃——实测每个组件的 CSS 都会漂移。拷贝后只对齐 import 路径，不改 CSS/逻辑；4 种风格的观感差异由 token `ui` 块驱动（组件 CSS 全走 `var(--twin-*)`）。

## 舞台布局

固定 **1920×1080** 舞台，由 `useScaleBoard`（`Math.min(innerW/1920, innerH/1080)`，信箱式）缩放到视口。内部只剩中央：

```
┌────────────────────────────── 1920 ───────────────────────────────┐
│                                                                  │
│            BuildingSwitcher → CenterStage                        │
│              （GlobalTwin <canvas> + 聚焦时 UnitDetail 叠加）        │
│                                                                  │
│   （左右两侧 + 底部留空 —— 调用方自行放置业务面板）                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

一切都在 1920×1080 的 `.stage` 内绝对定位。颜色由 token 驱动（`generate_theme.py` 生成的 `--twin-*` CSS 变量，来源 `assets/themes/<style>.tokens.json`）。字体：**Noto Sans SC**（中文）+ **Rajdhani**（拉丁/数字）—— 在 `index.html` 里从 Google Fonts 加载两者。

## 需要镜像的组件（v2.1：拷贝，非重建）

| 组件（`assets/components/`） | 角色 | 数据形状 |
|---|---|---|
| `BuildingSwitcher.vue` | 标签页：全局视角 + 每栋楼一个（+ 地下车库） | 骨架读静态脚手架 `parkScaffold.buildings`（楼栋 id）；**标签 `name`/`header`（v1.5）由 `getBuildings()` 水合**；写 `useSelection.focusBuilding/clearFocus` |
| `CenterStage.vue` | 常驻 `<canvas>` + 聚焦时的 `UnitDetail` 叠加 + Legend 定位 | — |
| `GlobalTwin.vue` | 挂载 canvas，实例化场景，接入选中 | **v1.5：`onMounted` 拉 `getBuildings()`+`getPois()` 水合场景；点击楼层拉 `getFloorDetail()`**（见 `scene-recipe.md` §12） |
| `UnitDetail.vue` | 右半详情面板（负责人/电话/在编/面积/性质/服务时间/业务范围/职责）+ 多单位上一/下一 | **v1.5：数据源 = `getFloorDetail()` 返回的 `FloorDetail`（`units: UnitDetail[]`）**，不再直接读静态 `unit.ts` |
| `LegendPanel.vue` | 屏幕图例（常驻左上） | 静态 `parkScaffold.legend`（色值与 token `category` 一致，validate_spec 复核） |
| `PoiOverlay.vue` | POI 悬停名称条 + 点击卡片 | `useTwinData.pois` + `useSelection.openPoiId`（单开契约）；只投影当前打开的一个 |
| `TourToggleButton.vue` | v2.2 航拍巡航开关（右上角 `role="switch"`） | `useTour.enabled`（模块级单例）；`GlobalTwin` `watch(enabled → scene.setTourEnabled)` 推回场景 |
| `useSelection.ts` / `useScaleBoard.ts` / `useTwinData.ts` / `useTour.ts` | 选中态 / 舞台缩放 / 动态数据中心 / 航拍巡航开关（模块级单例） | 见下文「选中 composable」与 scene-recipe §13 |
| `theme.ts` | `applyTheme(style)`（ParkScene 消费）+ `applyCssVars`（spec.tokens 覆盖注入） | 静态 import `src/scene/themes/*.tokens.json`（tsconfig 需 `resolveJsonModule`） |

> 不再生成：`TopBar.vue`、`CornerBrackets.vue`、`PersonAccess.vue`、`VehicleAccess.vue`、`CameraGrid.vue`、`MeetingRooms.vue`、`RepairTimeline.vue` 及其小组件（`MiniChart`/`StatBox`/`AutoScroll` 等）。如果调用方的外围面板需要它们，由调用方自行实现。

## 动态数据水合接线（v1.5）

外围留空归外围，但**中央舞台自身**（`GlobalTwin` + `UnitDetail`）现在消费动态数据。接线要点（完整契约见 `references/dynamic-data-api.md`，场景侧见 `references/scene-recipe.md` §12）：

- `GlobalTwin.vue` `onMounted`：`Promise.allSettled([digitalTwinApi.getBuildings(), digitalTwinApi.getPois()])` → `scene.hydrateBuildings()` + `scene.hydratePois()`。带 `hydrating` / 错误态兜底。
- `BuildingSwitcher.vue`：标签页骨架来自静态脚手架（楼栋 id）；每栋楼的显示名用 `getBuildings()` 返回的 `name`（按 `building_id` 对齐）水合——水合前显示「加载中…」占位。
- `UnitDetail.vue`：由 `useTwinData.floorDetail` 驱动；`GlobalTwin` 的楼层点击 watch 里调 `getFloorDetail({building_id, floor_id}, {signal})` 写入（`onCleanup + AbortController` 防 race）。多单位上一/下一在 `FloorDetail.units[]` 内切换（`useSelection.unitIndex`）。
- **环境/取景/类别色等基础信息仍静态**，不参与水合——切楼/聚焦/滚轮等交互在水合前就可用（基于占地底板）。

## 选中 composable

`assets/components/useSelection.ts` 原样拷贝 —— 它是一个干净的模块级单例：`focusedBuildingId`、`floorIndex`、`unitIndex`、悬停状态、`openPoiId`（v1.8 POI 单开），以及 `eff*` computed（hover ?? focused）。切换器和 3D 点击都通过它写入；当 `focusedBuildingId != null` 时 `CenterStage` 显示 `UnitDetail`。详细交互（射线拾取、聚焦补间、金色高亮、点击/悬停回调接线）见 `references/scene-recipe.md` §8（含 §8.1 契约 + §8.2 代码 + 反面模式）。

> **铁律**：楼层点击只调 `selectFloor`（楼 + 层一次性写入）；`focusBuilding` 仅「切换器标签页」用——**绝不在楼层点击里调用**，否则会清空 `floorIndex`，导致鼠标移开后金色高亮边框消失（详见 `scene-recipe.md` §8 末反面模式）。

## 样式

颜色只来自 token——v2.1 起派生也脚本化：

```bash
python scripts/generate_theme.py <style> --out <项目根>/src/styles/tokens.css   # :root 全量 --twin-* 变量
```

在 `main.ts` 顶部 `import './styles/tokens.css'`；per-park 的 `spec.tokens` 覆盖在 `GlobalTwin` onMounted 里 `applyCssVars(spec.tokens)`（`src/utils/theme.ts`，与脚本同一套展平规则）。**不要加第二套颜色系统，不要在各文件里散落 hex 字面量。** 切换器/详情面板/图例/POI 卡片的观感差异（赛博/全息有发光，白模/等距克制）由 token `ui` 块驱动：`panelOpacity/panelBlur/panelRadius/glowStrength/glowColor/borderWidth/labelBg/labelText/switcherStyle`——组件 CSS 全部 `var(--twin-*)`，改风格只换 token 不改组件。

## 验证

- [ ] 舞台缩放到视口（改变窗口大小；1920×1080 信箱化，不重排）。
- [ ] 切换器每个楼栋一个标签页，含 地下车库；点击聚焦正确的楼。**标签 `name`（v1.5）由 `getBuildings()` 水合**，水合前有占位。
- [ ] 点击 3D 楼层金色高亮并打开 UnitDetail（**v1.5：详情数据由 `getFloorDetail()` 返回**）；多单位时上一/下一可用。
- [ ] 外围区域确为空（未生成 TopBar / 角括号 / 5 个数据面板）。
- [ ] `npm run typecheck` 干净通过。

## 响应式与降级（v1.8）

固定 1920×1080 舞台是设计基准，但实际视口千差万别。生成器须按下列约束保证可用性：

- **最小支持视口**：1280×720。低于此宽度时 `useScaleBoard` 仍缩放（舞台等比缩小），但 UI 文字/图例可读性下降——此时在舞台角落给一行「建议 1920×1080 及以上分辨率查看」提示（token 驱动、可关闭）。
- **portrait / 超宽屏**：舞台永远保持 16:9 信箱化（上下或左右留黑），**不**为 portrait 单独重排——3D 等轴场景旋转到竖屏会丢失可读性。portrait 下舞台占满宽度、上下留黑即可。
- **resize 防抖**：`useScaleBoard` 与 `frameCamera()` 的 resize 回调**必须防抖（~150ms）**，否则拖拽窗口时每帧重算视锥导致卡顿。
- **`devicePixelRatio` 上限 2**：`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`（见 `scene-recipe.md` §2），4K/retina 不限制会爆 framebuffer。
- **低性能设备**：无 WebGL2 或 `navigator.hardwareConcurrency` 低（≤4）时，生成器应降档——bloom 关闭、阴影改 PCF（非 PCFSoft）、环境密度降一档（见 `scene-recipe.md` §10 性能预算与 §1 WebGL2 检测）。

## 可访问性（v1.8）

数字孪生是 3D 画布为主，但仍须提供键盘与屏幕阅读器可达性：

- **楼栋切换器**：用 `role="tablist"` / `role="tab"` + `aria-selected`；方向键（←/→ 或 ↑/↓）在标签间移动焦点；`tab` 键进入/离开。当前聚焦楼写进 `aria-activedescendant`。
- **canvas 文本替代**：`<canvas>` 加 `role="img"` + `aria-label`（如「XX园区 数字孪生 3D 场景，含 N 栋楼，可用键盘楼栋切换器浏览」），给屏幕阅读器一个总览。3D 内部细节无法逐个 aria 化，靠切换器 + UnitDetail 的语义化 HTML 承载信息。
- **POI 标记**：POI 详情走 HTML 弹出卡（§11），弹出时 `aria-live="polite"` 让屏幕阅读器播报；键盘可聚焦打开的 POI 卡片、Esc 关闭。
- **UnitDetail 面板**：打开时把焦点移入面板（`focus()` 首个可聚焦元素），Esc 关闭并把焦点还给触发的楼层——让键盘用户能感知内容变化。
- **对比度**：所有标签文字对背景对比度 ≥ WCAG AA（4.5:1 正文 / 3:1 大字）。§4.2 的「亮底深字 / 暗底亮字」规则已保证大方向；token 选色时用对比检查工具复核边界情况（如 cyber `text-lo` 在 `panel-top` 上）。
- **`prefers-reduced-motion`**：用户系统开启「减少动态效果」时，**禁用**相机聚焦补间（瞬切而非 0.6s tween）、**禁用** POI 告警呼吸动画、bloom 强度减半。**v2.2：航拍巡航整按钮禁用**（`TourToggleButton` 置 `aria-disabled` + `disabled`，`setTourEnabled(true)` 为 no-op——autoRotate 是连续运动，与 tween/呼吸动画同纪律）。用 `window.matchMedia('(prefers-reduced-motion: reduce)').matches` 检测。

## 空 / 加载 / 错误态（v1.8）

三态兜底覆盖每个动态数据消费者（对齐技能既有 `@error` 哲学）：

- **加载态（骨架）**：`hydrating=true` 时——切换器标签显示占位（楼栋 id 或「加载中」灰条）；UnitDetail 区域显示骨架屏（灰色占位块）；POI 层不渲染。脚手架（环境 + 占地底板 + Legend）立即可见，不白屏。
- **空态**：`getBuildings()` 返回 `[]` 时——舞台中央显示空态遮罩「该园区尚未配置楼栋」+ 刷新按钮（调 `getBuildings()` 重试）；切换器仅保留「全局视角」标签。`getPois()` 返回 `[]` 不报错（不渲染 POI，无需遮罩）。`FloorDetail.units` 为空数组时 UnitDetail 显示「该层暂无单位信息」。
- **错误态（分方法 + 重试）**：v1.8 起按方法独立错误（见 `dynamic-data-api.md` §9）——楼栋水合失败显示「楼栋数据加载失败 + 重试」、POI 失败显示「POI 数据加载失败（楼栋仍可交互）」、楼层详情失败在 UnitDetail 面板内联「加载失败 + 重试」。**绝不静默 `catch {}` 吞错误**——每个失败都要给用户可见反馈 + 重试入口。错误文案区分 `ApiError.status`：401→「未授权，请重新登录」、404→「数据不存在」、5xx→「服务端异常」、0（超时/网络）→「网络异常，请检查连接」。

## dispose 与上下文恢复（v1.8）

详见 `scene-recipe.md` §9，shell 侧须确保：
- `GlobalTwin.vue` 的 `onBeforeUnmount` 调 `scene.dispose()`（完整清单见 scene-recipe §9），不止于「取消 RAF」。
- canvas 监听 `webglcontextlost` / `webglcontextrestored`，丢失时显式遮罩 + 停渲染，恢复时重建 GPU 资源。
- `ResizeObserver` 在卸载时 `disconnect()`。
