# 舞台外壳（Shell）—— 1920×1080 舞台 + 楼栋切换器

数字孪生是中央面板。本技能**只**生成「固定舞台 + 楼栋切换器 + 中央 CenterStage（含 3D canvas 与聚焦时的 UnitDetail）」；**不再**生成 TopBar、CornerBrackets，也**不**生成任何外围 2D 数据面板（人员出入 / 车辆出入 / 摄像头 / 会议室 / 报修）。舞台左右两侧与底部**留空**，由调用方自行填充其它的业务面板。

范例仓库（`references/exemplar.md`）实现了完整外壳——为已存在项目生成时**复用**其中的舞台/切换器/CenterStage/useSelection；为新项目生成时按相同结构**重建**，但**跳过**外围面板组件。

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

一切都在 1920×1080 的 `.stage` 内绝对定位。颜色由 token 驱动（按 `spec.style` 选取 `assets/themes/<style>.tokens.json`）。字体：**Noto Sans SC**（中文）+ **Rajdhani**（拉丁/数字）—— 在 `index.html` 里从 Google Fonts 加载两者。

## 需要镜像的组件

| 组件 | 角色 | 数据形状 |
|---|---|---|
| `BuildingSwitcher.vue` | 标签页：全局视角 + 每栋楼一个（+ 地下车库） | 读 `spec.switcher`；写 `useSelection.focusBuilding/clearFocus` |
| `CenterStage.vue` | 常驻 `<canvas>` + 聚焦时的 `UnitDetail` 叠加 | — |
| `GlobalTwin.vue` | 挂载 canvas，实例化场景，接入选中 | — |
| `UnitDetail.vue` | 右半详情面板（负责人/电话/在编/面积/性质/服务时间/业务范围/职责）+ 多单位上一/下一 | `unit.ts` 的 `UnitDetail` |

> 不再生成：`TopBar.vue`、`CornerBrackets.vue`、`PersonAccess.vue`、`VehicleAccess.vue`、`CameraGrid.vue`、`MeetingRooms.vue`、`RepairTimeline.vue` 及其小组件（`MiniChart`/`StatBox`/`AutoScroll` 等）。如果调用方的外围面板需要它们，由调用方自行实现。

## 选中 composable

原样拷贝 `src/composables/useSelection.ts` —— 它是一个干净的模块级单例：`focusedBuildingId`、`floorIndex`、`unitIndex`、悬停状态，以及 `eff*` computed（hover ?? focused）。切换器和 3D 点击都通过它写入；当 `focusedBuildingId != null` 时 `CenterStage` 显示 `UnitDetail`。详细交互（射线拾取、聚焦补间、金色高亮）见 `references/scene-recipe.md` §9。

## 样式

颜色仍只来自 tokens（按 `spec.style` 选 `assets/themes/<style>.tokens.json`）→ `_tokens.scss` + `:root` CSS 变量 + `theme.ts`。**不要加第二套颜色系统，不要在各文件里散落 hex 字面量。** 由于不再生成面板，原面板表面渐变/描边/发光规则不再适用；切换器与详情面板的观感按所选风格（赛博有发光，简约/写实则克制）从同一套 token 派生。

## 验证

- [ ] 舞台缩放到视口（改变窗口大小；1920×1080 信箱化，不重排）。
- [ ] 切换器每个 `spec.switcher` 条目一个标签页，含 地下车库；点击聚焦正确的楼。
- [ ] 点击 3D 楼层金色高亮并打开 UnitDetail；多单位时上一/下一可用。
- [ ] 外围区域确为空（未生成 TopBar / 角括号 / 5 个数据面板）。
- [ ] `npm run typecheck` 干净通过。
