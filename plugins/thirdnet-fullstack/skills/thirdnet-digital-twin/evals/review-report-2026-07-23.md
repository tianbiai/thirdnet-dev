# 数字孪生技能——资产前端模板代码审查报告

> 审查技能：`thirdnet-fullstack:fullstack-review`
> 审查日期：2026-07-23
> 审查对象：`thirdnet-digital-twin` 技能 v2.8.0 的**资产前端模板代码**（`assets/` 下随包发布的范式文件）
> 审查者：Claude（fullstack-review）

---

## ① 审查概要

### 背景

`thirdnet-digital-twin` 技能采用「拷贝-改」生成模型（SKILL.md v2.0/v2.1）：`assets/` 下的 `.vue` / `.ts` / `.glsl` / `.json` 范式文件是**权威基线**，生成器把它们近乎逐字拷进宿主项目。因此模板自身的规范瑕疵会被放大到每一个生成的园区模块——本次审查的对象不是应用代码，而是「规范的源头」。

### 范围

| 区块 | 文件 |
|------|------|
| 2D 组件（8 `.vue`） | `assets/components/{GlobalTwin,CenterStage,BuildingSwitcher,UnitDetail,GarageCard,LegendPanel,PoiOverlay,TourToggleButton}.vue` |
| 组合式 / 工具（5 `.ts`） | `assets/components/{useSelection,useTwinData,useTour,useScaleBoard,theme}.ts` |
| API 契约层（5 文件） | `assets/api/{types,interfaces/manager,modules/manager,mock/api/manager}/digital-twin.ts` + `config/index.ts` + `request.ts` |
| 3D 引擎范式 | `assets/park-scene.impl.ts`（2,221 行）、`assets/building-geometry.ts`（512 行） |
| Token / Schema | `assets/themes/*.tokens.json`（6 风格）、`spec.schema.json`、`tokens.schema.json` |
| 着色器 | `assets/gridGround.glsl`、`assets/fresnelRim.glsl` |

### 权威规则源

`vue-best-practices`、`api-typescript-spec`、`design-apple`、`vue-enum-dict`、`create-adaptable-composable`、`frontend-workflow`，以及技能自身的端到端 checklist（SKILL.md「验证」「约定」）。

### 方法

3 个 Explore 子代理并行盘点（资产清单+质量、规范规则抽取、SKILL.md 契约对照）→ 主上下文定点 grep/read 核验 claim-vs-code 分歧 → 应用修复 → grep 自检。

---

## ② 严重级别统计

| 级别 | 数量 | 阻断 |
|------|------|------|
| 🔴 Critical | 0 | — |
| 🟠 Major | 0 | — |
| 🟡 Minor | 3 | 否 |
| 🔵 Info | 4（其中 1 项核验后降级为「无需改」） | 否 |

**初始判定：PASS（无阻断）。** 用户选定「报告 + 修全部 Minor+Info」，全部可执行项已落地（见 ⑥）。

---

## ③ 问题清单（按维度分组）

> 每条标注：维度 / 严重级别 / 规则依据 / 位置 / 修复状态。

### 维度 B——前端规范遵守

**【B-1 / Minor / 已修复】不必要的 `computed` 返回函数**
- 位置：[useTwinData.ts:34-37](assets/components/useTwinData.ts#L34-L40)（原）
- 现象：`buildingName` / `poiById` 写成 `computed(() => (id) => …)`。内层函数已闭包响应式 ref，`computed` 外壳无收益，反而在每次依赖变化时重建闭包。
- 依据：`vue-best-practices`「MUST derive values with computed rather than watch-assigned refs」「computed getter 应派生纯值」；属 computed 反模式。
- 修复：改为模块级命名导出函数 `export function buildingName(id)` / `export function poiById(id)`，从 `useTwinData()` 返回对象移除（与 `errMsg` 同纪律）。同步更新消费方 [PoiOverlay.vue:68-69](assets/components/PoiOverlay.vue#L68-L69)、[UnitDetail.vue:75](assets/components/UnitDetail.vue#L75)。响应性不损（函数内即时访问 `buildings.value` / `pois.value`）。

**【B-2 / Minor / 已修复】`request.ts` 两处 `any`**
- 位置：[request.ts:33](assets/api/request.ts#L33)（`(signal as any).reason`）、[request.ts:48](assets/api/request.ts#L48)（`catch (e: any)`）
- 依据：`api-typescript-spec` 要求严格 TS；`frontend-workflow` 代码规范禁止滥用 `any`。
- 修复：前者改 `(signal as AbortSignal & { reason?: unknown }).reason`；后者改 `catch (e: unknown)` + 属性收窄（`name` / `message`）。

**【B-3 / Info / 已修复】`PoiOverlay.vue` 在 setup 顶层启动 `requestAnimationFrame`**
- 位置：[PoiOverlay.vue:110](assets/components/PoiOverlay.vue#L110)（原）
- 现象：`rafId = requestAnimationFrame(tick)` 写在 `<script setup>` 顶层而非 `onMounted`，耦合 DOM 时序。本技能纯 CSR 可运行，但偏离生命周期规范。
- 依据：`vue-best-practices` 副作用应在生命周期钩子内启动。
- 修复：移入 `onMounted(() => { rafId = requestAnimationFrame(tick) })`，保留 `onBeforeUnmount(cancelAnimationFrame)`。

**【B-4 / Info / 已修复】`UnitDetail.vue` 模板非空断言**
- 位置：[UnitDetail.vue:47-48](assets/components/UnitDetail.vue#L47-L48)（原 `detail!.units.length` ×2）
- 现象：靠上游 `v-if` 链保证安全，但非空断言略脆、对模板重构不友好。
- 修复：新增 `units` / `unitCount` computed，模板改用 `unitCount`，消除两处 `!` 并顺手收紧 `v-if`。

**【B-5 / Info / 已修复（局部）】`GarageCard.vue` 可选字段**
- 位置：[GarageCard.vue:26](assets/components/GarageCard.vue#L26) 模板 `{{ garage.occupied }}`、[GarageCard.vue:71-76](assets/components/GarageCard.vue#L71-L76) 脚本算术
- 现象：初判「`capacity - occupied` 算术在可选字段上不安全」。**核验后降级**：脚本侧 `empty` / `rate` 已用 `(garage.value.capacity ?? 0)` / `(garage.value.occupied ?? 0)` 守卫，算术安全；唯一未守卫处是模板展示 `{{ garage.occupied }}`（`isParking` 只保证 `capacity != null`，`occupied` 仍可能为空 → 渲染空白）。
- 修复：模板改 `{{ garage.occupied ?? 0 }}`，与脚本侧守卫对齐（「已占用」缺数据时显 0 而非空白）。

**【B-6 / Info / 已修复】`TourToggleButton.vue` 在 setup 顶层读 `window.matchMedia`**
- 位置：[TourToggleButton.vue:31](assets/components/TourToggleButton.vue#L31)（原）
- 现象：`const reducedMotion = window.matchMedia(...).matches` 顶层读取，SSR 下会炸；且不监听运行时变化。
- 依据：`vue-best-practices` 浏览器 API 应在生命周期内访问。
- 修复：改 `ref(false)` + `onMounted` 读取并 `addEventListener('change')` + `onBeforeUnmount` 清理；顺带支持运行时切换减少动态效果时实时更新禁用态。

### 维度 G——文档与流程

**【G-1 / Minor / 已修复】陈旧文档注释引用已删分支**
- 位置：[park-scene.impl.ts:1494](assets/park-scene.impl.ts#L1494)
- 现象：`undergroundMaterials` 上方注释写「按 profile.building 分支：emissive/pbr/flat/wire/white」，但实现只分支 `flat` / `pbr` / 默认 emissive（`pbr-night`/`holo` 经 `emissiveIntensity` 区分）。`wire`/`white` 分支 v2.8 已删，注释未同步——文档与代码漂移。
- 依据：SKILL.md v2.8 变更历史明确「清扫 v2.4 遗留 wire/white 死代码」；注释须与代码一致。
- 修复：注释改为「flat / pbr / emissive，pbr-night 与 holo 经 emissiveIntensity 区分」。

> grep 复核：剩余 `wire` 命中（[park-scene.impl.ts:1439](assets/park-scene.impl.ts#L1439)、[building-geometry.ts:380](assets/building-geometry.ts#L380)）均为**真实在用**的边缘高亮变量（`THREE.LineSegments`），非死代码；剩余 `white` 均为 CSS `white-space` 属性。无残留死分支。

---

## ④ 整体优缺点

### 优点（值得作为范式保留）

1. **Three.js 完全游离于 Vue 响应式之外**——[GlobalTwin.vue:69](assets/components/GlobalTwin.vue#L69) 用 `let scene: ParkScene | null = null`（非 `ref`/`shallowRef`/`reactive`），`park-scene.impl.ts` 与 `building-geometry.ts` 全程零 Vue 响应式 API、零 `any`。从根上规避了「Vue 代理 Three.js → modelViewMatrix 错 → 黑屏」陷阱，是本项目记忆里那条教训的最佳实践范本。
2. **5 文件契约层完整且纪律严明**——`IDigitalTwinApi` + `Real` + `Mock` + 工厂 + 单例；`MOCK_ENABLED = VITE_MOCK_ENABLED === 'true'`；Mock/Real 都抛 `ApiError`、`AbortSignal` 端到端打通。
3. **数据分层 + 三态兜底到位**——脚手架先行 → `Promise.allSettled` → 楼层 `watch` 带 `onCleanup` + `AbortController`；`webglcontextlost/restored` + 全量 `dispose()`。
4. **样式纪律过硬**——8 个 `.vue` 全部 `<style scoped>`、type-only `defineProps` + `withDefaults`、组件内**零 hex 字面量**（全走 `var(--twin-*)`）。
5. **a11y 一致且完整**——`role=tablist/tab`、`aria-*`、Esc 关闭、焦点管理、`prefers-reduced-motion`、canvas `aria-label`。
6. **v2.8 清理已扎实落地**——`errMsg` 改命名导出且不重复挂返回对象、`wire|white` 死分支确已删、`corridor` 全链路接通、6 风格 token 必备块齐全、`validate_spec.py` 四条规则全实现。

### 缺点（均为本次已修的 Minor/Info）

- 少量生命周期/类型/反模式瑕疵（见 ③），均为局部、不影响运行时正确性，但作为「规范源头」应收紧，避免被拷贝放大。

---

## ⑤ 歧义与待确认

1. **`setStyle` vs `applyTheme`/`applyCssVars` 命名**——SKILL.md 只命名 `theme.ts` 的 `applyTheme(style)` + `applyCssVars(tokens)`，但 `park-scene.impl.ts` 的 `ParkScene` 另有 `setStyle` 公共方法（引擎侧换肤）。二者职责不同（`applyTheme` 管 2D CSS token、`setStyle` 管 3D profile），并非冲突，但 SKILL.md 未点名 `setStyle`。**建议**（非本次改动）：SKILL.md「约定」补一句说明 `ParkScene.setStyle` 与 `theme.applyTheme` 的分工，消除生成器侧困惑。
2. **是否升版本号**——本次为模板源码 Minor/Info 清理，无契约层签名/字段/URL 变更。当前版本已为插件 `2.17.0`（`plugin.json` / 协调技能 SKILL.md / `marketplace.json` 三处同步）、digital-twin 技能 `2.9.0`——均高于会话开始时快照，说明用户正在并发迭代该技能、版本已在流动。**不建议本次再单独 bump**（避免与在途改动撞版本）；若确需标记，patch +1 至 `2.17.1` / `2.9.1` 并加 CHANGELOG 一条，由用户定。
3. **运行时构建校验未做**——本次仅改模板源码、无宿主项目，跑不了 `vue-tsc --noEmit` / `vite build`。由生成宿主项目时 `npm run typecheck` 兜底。

---

## ⑥ 修改方案汇总（action list，已全部落地）

| # | 级别 | 文件 | 改法 | 状态 |
|---|------|------|------|------|
| 1 | Minor | [park-scene.impl.ts:1494](assets/park-scene.impl.ts#L1494) | 注释去掉 `wire/white`，对齐实际分支 | ✅ 已修复 |
| 2 | Minor | [useTwinData.ts](assets/components/useTwinData.ts) + PoiOverlay + UnitDetail | `buildingName`/`poiById` 由 computed 改命名导出函数；消费方同步 | ✅ 已修复 |
| 3 | Minor | [request.ts:33,48](assets/api/request.ts#L33) | 两处 `any` → 严格类型（`AbortSignal & {reason?}` / `unknown` + 收窄） | ✅ 已修复 |
| 4 | Info | [PoiOverlay.vue](assets/components/PoiOverlay.vue) | rAF 启动移入 `onMounted` | ✅ 已修复 |
| 5 | Info | [UnitDetail.vue](assets/components/UnitDetail.vue) | 新增 `unitCount` computed，去两处 `!` | ✅ 已修复 |
| 6 | Info | [GarageCard.vue:26](assets/components/GarageCard.vue#L26) | 模板 `occupied` 显式 `?? 0`（脚本侧本已守卫） | ✅ 已修复 |
| 7 | Info | [TourToggleButton.vue](assets/components/TourToggleButton.vue) | `matchMedia` 移入 `onMounted` + 监听变化 + 清理 | ✅ 已修复 |

**自检结果（grep 复核）**：
- `(buildingName|poiById).value` → 0 命中（消费方全迁移）
- `twinData.(buildingName|poiById)` → 0 命中（无残留旧访问）
- `: any` / `as any` → 0 命中
- `detail!.` → 0 命中
- `wire|white` 残留死分支/陈旧注释 → 0（剩余均为在用变量与 CSS 属性）

---

## ⑦ 阻断结论

**PASS —— 可交付。**

- 0 Critical、0 Major，不触发全栈质量收尾门 Stop Hook 阻断。
- 全部 3 Minor + 4 Info 已修复并通过 grep 自检。
- 无跨端契约层变更（`IDigitalTwinApi` 签名/字段/URL 全未动），无需跨端重审。
- 版本号当前为插件 `2.17.0`（三处同步）/ digital-twin `2.9.0`，无漂移；本次不建议单独 bump（见 ⑤.2），由用户定夺。

> 闭环说明：本次审查为模板源码自查，修复后无需再跑后端/前端工作流；若后续生成宿主项目，由该项目的 `npm run typecheck` 做运行时兜底校验。
