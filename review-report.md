# 全栈质量审查报告

> 审查范围：当前工作区相对 `HEAD` 的 `thirdnet-digital-twin` 范式、主题 token、Vue 接线、schema、evals、版本与文档变更。
> 审查日期：2026-07-24

## 1. 审查概要

本次变更覆盖：

- `assets/park-scene.impl.ts`：地面车位布局、城市/园区地面开口、地下车库地表拾取、OrbitControls 极角与方位角、低层装饰材质与轮廓。
- `assets/components/GlobalTwin.vue`、`theme.ts`：地表车库开口进入地下的状态接线与 token 类型。
- 六套主题、两个 token/schema、Park Spec/场景配方/实现导读/壳层/风格文档、evals 与版本记录。

审查重点是实际失败场景、TypeScript 语法风险、Three.js 深度/拾取生命周期、六风格分支、文档与版本同步。

## 2. 严重级别统计

| 级别 | 数量 | 结论 |
|---|---:|---|
| Critical | 0 | 无编译阻断、数据破坏或安全问题 |
| Major | 0 | 未发现新增功能性阻断 |
| Minor | 1 | 无宿主项目，无法运行 `vue-tsc`/浏览器截图 |
| Info | 2 | 建议后续持续补充运行时回归 |

## 3. 问题清单

### Minor

#### MIN-001：当前仓库没有生成项目宿主，未执行运行时 Three.js/Vue 编译与截图

- **范围**：仓库是插件/技能包，不含 `package.json`、Three.js 依赖或可运行页面。
- **影响**：本次只能完成 JSON/schema、spec fixture、静态源码契约和布局公式验证，不能在真实 WebGL 上确认 Reflector 对分割几何的最终表现。
- **处理**：已保留普通地面材质降级路径；交付前应在任一生成宿主中运行 `npm run typecheck`，并按六风格截图验证深度排序、开口、拾取和装饰对比度。

## 4. 已验证的关键行为

1. **地面车位**：移除固定 `rowX/rowZ0` 单排；24 个车位形成东西侧多排布局，246 个车位继续扩展为多行，统一缩放公式和安全 inset 保证边界内；placement 同时驱动车位面、边线、P 标牌和车辆，南北停车带同步旋转。
2. **地下可见性**：城市底板改为 `boundary` 外环带，园区地面按 `garages[]` footprint 分割留开口；实际 `buildUndergroundGarage` 几何仍位于 Y<0，不以假玻璃盖替代。地表与地下拾取数组分离。
3. **地下退出相机**：审查中发现 `setBelowView(false)` 原逻辑会把用户在地下拖动后的相机跳回旧 `sideCamPos`；已修复为退出时捕获当前地下相机作为补间起点，并回到进入地下前保存的地面锚点。
4. **全方位旋转**：方位角显式设为 `[-Infinity, Infinity]`；极角为 `[0.05, Math.PI - 0.05]`，接近天顶/天底但不进入 OrbitControls 极点奇异区。
5. **暗色装饰**：暗色风格使用不受光/轻自发光装饰材质，平面景观使用 `decorOutline` 轮廓；night-realistic 保留 Standard/PBR，realistic/isometric 分支未改为 Basic。
6. **生命周期**：`garageSurfacePickables` 在 `clearSceneGroup()` 重建时清空，所有 marker/hit 对象挂入 `sceneGroup`，沿现有 `disposeObject` 释放。

## 5. 验证记录

- `validate_spec.py`：
  - `evals/files/example-spec.json`：通过。
  - `evals/files/generality/government-complex.json`：通过。
  - `evals/files/generality/government.json`：通过。
  - `evals/files/generality/industrial.json`：通过。
  - `evals/files/generality/underground.json`：通过。
  - `evals/files/sample-pen-extract.json`：仍为仓库已有的抽取草稿，缺少建筑几何 id/w/d/x/z 与完整 legend，按预期返回 FAIL；本次未改动该 fixture。
- JSON 解析：六套主题、`spec.schema.json`、`tokens.schema.json`、`evals.json`、插件 metadata 与 marketplace 均通过 Python JSON 解析。
- `jsonschema`：六套主题均通过 `tokens.schema.json`。
- `git diff --check`：通过（仅提示 Windows 工作区 `CLAUDE.md` 的 LF/CRLF 转换警告）。
- 车位布局公式静态验证：边界 `(360,220)` 下 24/246 个车位均生成完整 placement、剩余数为 0、中心均在安全 inset 内；极小边界/1000 车位压力样例也能通过统一缩放生成 1000 个 placement。
- 静态旧逻辑检查：未发现固定 `rowX = boundary.x - 70`、旧 `rowZ0`、旧 `[0.5, π-0.1]` 或重复 `garageSurfacePickables` 字段。

## 6. 整体优缺点

### 优点

- 根因修复在范式实现单一事实源完成，生成器后续拷贝即可获得修复，不要求目标项目新增 spec 字段。
- 地下开口直接暴露既有地下几何，避免 CSG/stencil 和“只画一个玻璃盖但仍看不到内容”的伪修复。
- 暗色装饰材质集中到 helper，主题色仍由 token 驱动，且保留六风格的 PBR/flatShading 分工。
- 版本号、CHANGELOG、schema、references 和 evals 已同步，历史 v2.16.0 漂移也补齐。

### 需要宿主侧确认

- `Reflector` 在目标 Three.js 版本中对带矩形开口的自定义 `BufferGeometry` 的实际反射表现。
- 透明地下墙、车位线和上方开口在六种风格及不同 GPU 上的深度排序。
- 真实生成项目中的 `vue-tsc` 与 WebGL 截图结果。

## 7. 修改方案汇总

- **P0 已完成**：修复地下退出补间丢失用户相机状态的问题。
- **P1 已完成**：完成车位换行/边界保护、地下地面开口、全方位旋转、暗色装饰可读性与版本同步。
- **P2 待宿主验证**：在生成项目中运行 `npm run typecheck`，对六风格执行浏览器交互和截图回归；若 Reflector 对开口几何不稳定，按范式的普通地面降级路径确认视觉可接受。

## 8. 阻断结论

**PASS（0 Critical / 0 Major）**。

本次仓库内可执行的静态/spec/schema 验证已完成。唯一未完成的是插件仓库本身不存在的宿主运行时验证，已明确记录为 Minor，不阻断本次技能包交付。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
