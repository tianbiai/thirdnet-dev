# Changelog

## 2.32.1 - 2026-07-31

### Fixed
- **api-typescript-spec v2.2.2「mockDataStripPlugin 仅在 Mock 关闭的生产构建启用」**：修复 `references/mock-stripping.md` 中插件挂载守卫只看 `command === 'build'`、与 `MOCK_ENABLED` 无关的问题。原实现导致**原型/演示构建**（`vite build` + `VITE_MOCK_ENABLED=true`，`proto-workflow` 明确支持的部署形态）时插件仍把 `/mock/data/**` 桩成空数组，而此时 `new MockXxxApi()` 正是存活分支、import 这些数据 → 演示界面无数据。现改为 `command === 'build' && !mockEnabled` 双守卫：Mock 关闭（正式/测试）才剥离，Mock 开启（原型/演示）保留真实数据。技术要点：`MOCK_ENABLED`（`import.meta.env`）在 `vite.config.ts` 不可用，配置期改用 `loadEnv(mode, process.cwd())` 读取，`defineConfig` 解构 `({ command, mode })`。同步更新 web/minigram 两端示例、JSDoc、原理段与「生产包验证」段（注明验证仅适用于 Mock 关闭的构建）。

### 版本同步
- `plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处由 `2.32.0 → 2.32.1`；`api-typescript-spec` `metadata.version` `2.2.1 → 2.2.2`。顶层 `metadata.version` 不变（非重大变更）。

## 2.32.0 - 2026-07-30

### Added
- **proto-workflow v1.0.0「原型驱动迭代编排」**：新增流程编排类技能，自动化《代码发布管理-原型驱动流程.md》定义的 5 阶段 SVN 原型迭代循环（原型分支 → 合并主干 → 补真实实现 → 对照测试 → 发布收尾）。**执行式 + 纯编排**：实际执行 `svn copy` / `svn merge` / `svn delete` / `svn commit`，每个不可逆操作前设确认门（A 建分支 / B 冻结 / C 合并 / D 删分支，均 `AskUserQuestion`）；编码环节委托 `frontend-workflow` + `backend-workflow` + `api-typescript-spec`，本技能不写业务代码。覆盖分支命名（`Park-PT{r}` / `Park-BF{r}` 同级目录）、整体合并纪律（冻结前必清理废弃代码）、工厂文件冲突热点预警、三环境构建参数固化（原型 `VITE_MOCK_ENABLED=true` / 测试正式 `false` + Mock 剥离）、Bug 分支（BF）子流程、DB schema 与微信审核风险提示。结构含 `SKILL.md` + 3 个 references（`svn-commands.md` / `release-params.md` / `checklists.md`），SKILL.md 控制在 500 行内、按需加载 references。事实来源为 `代码发布管理-原型驱动流程.md` v1.0（已逐条对齐《代码发布管理.docx》既有约定）。

### Changed
- 协调技能 `thirdnet-fullstack`「任务路由」表新增一行：原型 / 发布分支管理（拉原型分支、合并回主干、迭代发布、对照原型验收、线上 bug 走分支）→ 委派 `proto-workflow`。
- 协调技能「自包含说明」技能清单新增「迭代发布编排：`proto-workflow`」条目。
- `plugin.json` / `marketplace.json` 的插件描述补列「迭代发布编排」与 `proto-workflow`。

### 版本同步
- `plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处由 `2.31.0 → 2.32.0`；`marketplace.json` 顶层 `metadata.version` `0.62.0 → 0.63.0`；新技能 `proto-workflow` `metadata.version` `1.0.0`。
- `hooks.json` 不变：本技能走 Bash 执行 SVN，不落 PreToolUse 合规门的 `*.cs` / `**/src/**/*.{vue,ts,...}` 模式，无需加入技能路由门。

## 2.31.0 - 2026-07-30

### Fixed
- **api-typescript-spec v2.2.1「mock-stripping 改为完整可运行源码」**：修复 `references/mock-stripping.md` 中 `mockDataStripPlugin` 代码块为不可运行伪代码的问题——`resolveId` 引用未定义的 `resolvedPath`、`load` 引用未定义的 `content`，照抄即 ReferenceError。现替换为与 `frontend/web/vite.config.ts` 一致的完整实现：补齐 `fs` 读文件（含 `.ts`/`.js` 候选扩展名）、`@/` 别名解析（基于 `srcDir = path.resolve(__dirname, 'src')`）、`export` 具名导出提取、`command === 'build'` 守卫、`.filter(Boolean)` 挂载。

### Changed
- 桩值统一为 `export const ${n} = []`（原文档误写 `{}`，与真实实现不符），并注释说明「死代码分支永不执行，桩值仅为占位」。
- 明确拦截范围：只拦截 `/mock/data/`，不拦截 `/mock/api/`（后者靠 `MOCK_ENABLED=false` + tree-shaking）。
- 新增「Web 与小程序端一致性」章节：`mockDataStripPlugin` 两端（`frontend/web` 与 `frontend/minigram`）都需配备；小程序端 `defineConfig` 须用函数形式 `defineConfig(({ command }) => ({...}))` 才能按 `command` 启用插件，给出 minigram 最小集成示例。
- 新增「生产包验证」章节：构建后 grep 一个只存在于 `mock/data/**` 的特征字面量应无命中，并提示 `mock/api/**` 死代码硬编码值可能残留。
- `SKILL.md` 步骤 4 指向语「空对象桩」修正为「空数组桩」。

## 2.30.0 - 2026-07-26

### Added
- **thirdnet-digital-twin v2.30.0「楼栋类型化外观」**：新增 `spec.buildings[].type`（office 写字楼 / residential 居民楼 / commercial 商业，缺省=通用楼），解决「写字楼和居民楼长得一样」——三维度**构造**差异且 3 种风格全覆盖：① 窗户/灯光图案（写字楼横带幕墙密集冷光 / 居民楼单元小窗稀疏暖光 / 商业底层贯通橱窗恒亮，`windows.types.<type>` 四级合并可换肤覆盖）；② 立面纹理构造（日景窗框占比/窗台线）；③ 体块形态（写字楼无裙楼 / 居民楼逐层阳台挑板 / 商业 2 层大裙楼+底盘灯带）。**类型只分构造、不分颜色**：全类型统一 category 配色链（默认色或用户指定色），`tokens.buildingType` 仅为显式按类型分色的可选覆盖。type 缺省时渲染与 v2.29 逐项相等（向后兼容）。契约链同步：spec/tokens schema、validate_spec（type 枚举 FAIL + 覆盖白名单开放 `buildingType.`/`windows.`）、generate_data（缺省 legend 自动补类型条目）、LegendPanel 色块回退 `--twin-building-type-*`。

## 2.29.1 - 2026-07-26

### Fixed
- **thirdnet-digital-twin v2.29.1**：修复 `park-scene.impl.ts` 少声明 `private lastUserInteractMs` 字段（`onPointerMove` 拖拽中赋值但类中无声明），独立工程 `vue-tsc --noEmit` 报 TS2339。已补声明，typecheck 干净通过。

## 2.28.1 - 2026-07-26

### Changed
- **thirdnet-digital-twin v2.28.1「等距 toon 描边 + 赛博/夜景瘦身」**：两类针对性优化
  1. **v2.28.1 等距风格差异化**（解决「等距 vs 写实差不多」）：第二层 toon 描边 + 色彩饱和度提升
     - `ThemeTokens.building` 新增 `toonOutline: { enabled, color, opacity, scale }` 可选块
     - `isometric.tokens.json` 启用 `toonOutline` (`color: #0d1424, opacity: 0.95, scale: 1.005`) + 5 处主色提饱和（`#5b8def → #3a7af2` 等）+ `roomShade: 0.18 → 0.22`
     - `ParkScene.extrudeBuildings` 在 `b==='flat'` 时挂第二层 `LineSegments(EdgesGeometry, scale 1.005)` 形成「内淡外深」双线包围
  2. **v2.28.1.b 赛博/夜景瘦身**（解决「连线和竖线太多」）：禁用 `dataFlow`（楼间贝塞尔弧）+ `pillars`（6-12 根装饰光柱）
     - `cyber.tokens.json` `dataFlow.enabled: true → false`、`pillars.enabled: true → false`
     - `night-realistic.tokens.json` `pillars.enabled: true → false`
     - 保留：cyber 留 `particles` + `scanlines`；night 留 `lampCones` + `particles` + `stars` + 水/雾
     - `buildLightPillars` / `buildDataFlow` 代码保留（双重门 token 化，将来其它风格可启用）
- **类型扩展**：`ThemeTokens.building.toonOutline` 新可选块
- **版本同步**：`plugin.json` 2.28→2.28.1 / 协调技能 `SKILL.md` 2.28→2.28.1 / `marketplace.json` 顶层 `metadata.version` 0.59→0.60 / `thirdnet-fullstack` 条目 2.28→2.28.1 / 数字孪生技能 `metadata.version` 2.28→2.28.1

## 2.28.0 - 2026-07-26

### Changed
- **thirdnet-digital-twin v2.28.0「动效层 + 首屏电影入场」**：让领导首次看场景有「指挥中心」级视觉冲击——每效果走「双重门」 `PROFILES.<flag>===true && tokens.effects.<key>.enabled===true` 控制，关闭某效果改 token 即可。
  1. **4 风格 token 新增 `effects` 段**（13 效果：scan/dataFlow/pillars/particles/lampCones/godRays/stars/water/fog/contactShadow/scanlines/gridPulse/idleTurntable），各含 `enabled` + 颜色 + 数值旋钮——`applyCssVars` 展平为 `--twin-effects-*` CSS 变量。
  2. **`realism.intro` 段**：首屏电影入场旋钮（enabled/durationMs/fromDistanceFactor/fromElevOffset/staggerMs），`GlobalTwin` 水合完成后调 `scene.playIntro()` 推 1.8s 入场（从拉远位 + 抬高俯角 → 默认取景位），期间 `OrbitControls.enabled=false`，用户点击/拖拽立即 `skipIntro` 还原。
  3. **ParkScene 8 个 builder + `updateFx()` 推进器**：`buildScanField`（地面 shader 雷达脉冲）/ `buildDataFlow`（楼间贝塞尔弧 + 数据包流）/ `buildLightPillars`（光柱呼吸）/ `buildParticles`（浮粒粉尘）/ `buildLampCones`（路灯头光锥）/ `buildGodRay`（太阳柔光斑）/ `buildStarField`（星空闪烁）/ `buildContactShadows`（楼底贴地椭圆）。共享 helper `makeSoftDotTexture` + `makeSunGlowTexture`。
  4. **gridGround.glsl 加 3 uniform**：`u_time` / `u_pulseSpeed` / `u_wavelength`——cyber 地面径向亮度波。
  5. **GlobalTwin 扫描线 CSS 叠加层** + **StyleSwitcher 选中态呼吸环**：screen 混合 + 4s 动画；2.4s box-shadow 呼吸。
  6. **per-style 效果矩阵**（Standard）：cyber=scan+dataFlow+pillars+particles+scanlines+gridPulse；realistic=particles+water；night=lampCones+pillars+particles+stars+water；isometric=contactShadow+idleTurntable。lampCones 标准参数：高 60 / 半径 3.5 / 基础 opacity 0.18 + 呼吸 (0.85..1.15)。
  7. **`reduced-motion` 全程守护**：构造期仍建 mesh（静态可视），`updateFx()` 整段 no-op；CSS 动画也 `@media (prefers-reduced-motion: reduce) { animation: none }` 关闭。
  8. **文档同步**：`references/styles.md` 加「动效层」段、`references/scene-recipe.md` 加 §16 动效层调度器与双重门、`references/park-scene-impl.md` 加 v2.28 节。
- **类型扩展**：`theme.ts` 新增 `EffectTokens`/`EffectsTokens` 类型与 `ThemeTokens.realism.intro` 可选块；`StyleProfile.fx` 13 boolean 标志（构造期一次性决定，运行时不可改某风格 fx）。
- **已知遗留**（后续 follow-up）：god ray（realistic）因 `SpriteMaterial+depthTest:false` 透明区 WebGL 黑底 bug 暂禁；water UV 漂移只挂状态未驱动（可见性靠既有 reflector）；skill 模板 writeback 一期只改本仓库工程，回写作为 follow-up。
- **版本同步**：`plugin.json` 2.27→2.28 / 协调技能 `SKILL.md` 2.27→2.28 / `marketplace.json` 顶层 `metadata.version` 0.58→0.59 / `thirdnet-fullstack` 条目 2.27→2.28 / 数字孪生技能 `metadata.version` 2.21→2.28。

## 2.27.0 - 2026-07-26

### Changed
- **thirdnet-digital-twin v2.21.0「精简风格集：删除 holographic/nebula」**：全息/星云两风格渲染管线与 cyber 高度重叠，删除以保留 4 种高区分度风格（cyber/isometric/realistic/night-realistic）。破坏性变更：含 holographic/nebula 的 spec 将被 `validate_spec.py` 拒绝。
  1. 删资产：`holographic.tokens.json`、`nebula.tokens.json`、`fresnelRim.glsl`；`StyleKey`/`THEMES`/`STYLE_LABELS`/`PROFILES` 去两风格，`building` 去 `'holo'`、删 `useRim`/`injectRim` 死代码；schema 枚举 + `VALID_STYLES` + 脚本提示串同步。
  2. 文档计数全量更新（6→4 / 4 深色→2 深色）；evals 删全息专属 eval 9、eval 17 改写 night-realistic。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.26.0 → 2.27.0`；`marketplace.json` 顶层 `metadata.version` `0.57.0 → 0.58.0`；digital-twin 技能 `metadata.version` `2.20.0 → 2.21.0`。

## 2.26.0 - 2026-07-26

### Changed
- **thirdnet-digital-twin v2.20.0「夜景地面/楼墙可辨性调色」**：v2.19 HDRI 升级后用户反馈「夜景地面暗 / 楼墙玻璃反光太强 / 俯视看不清」，在 token + 范式代码层逐项根治（调色值已落 token/代码，本次补 references 文档 + 版本号）：
  1. **路灯 PointLight 真照明**：`buildAmbiance` 给路灯 head 挂 `PointLight`（≤8 盏 `decay=1`，v2.18 前路灯仅自发光球）；night-realistic `pointIntensity 0.6→1530` / `pointDistance 200→2800`（亮斑有效半径 ∝ intensity，面积大幅扩）；仅 night-realistic 启用。
  2. **reflBack 衬底 `MeshLambertMaterial + emissive 0.9`**：俯视/离路灯远的中央不黑（`Reflector` 是自定义反射 shader、`opacity` 不标准透出下层，reflBack 须自发光才有底亮度）；`environment.city-ground/road` 提亮（`#98a6bd`/`#8090ae`）。
  3. **ambientFloor 大幅抬升** cyber/night-realistic `0.28→1.2`（ACES + 弱光下旧值 ~0.2 压成近黑）。
  4. **楼墙降玻璃反光**：`material.envMapIntensity 2.0→0.3` / `roughness 0.3→0.65` / `metalness 0.15→0.05`（偏哑光混凝土）。
  5. **楼幢轮廓**：`building.edgeColor #a8c0d8→#d8e6f8` + `edgeOpacity 0.6→0.85`（暗天空下多角度 silhouette 可见）；`fog.near 600→1500`（园区内不被暗雾染）。
  6. **cyber 同步**：`ambientFloor 0.4→1.2` / `shaders.grid.u_strength 0.85→1.3` / `city-ground` 提亮 / 绿化带降饱和。
  - 文档：`references/styles.md`（L21 ambientFloor + 新增 `## night-realistic` 专属段）、`references/scene-recipe.md`（§2/§3/§10）；`SKILL.md` metadata.version 同步。
- **技能自身 CHANGELOG 补齐**：digital-twin 技能 `CHANGELOG.md` 此前滞后停在 v2.17.0，本次补 v2.18 / v2.19 / v2.20 三条（v2.18/v2.19 从插件 CHANGELOG `2.24.0`/`2.25.0` 浓缩）。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.25.0 → 2.26.0`；digital-twin 技能 `metadata.version` `2.19.0 → 2.20.0`。

## 2.25.0 - 2026-07-26

### Changed
- **thirdnet-digital-twin v2.19.0「6 风格视觉真实感提升」**：写实两风格真实化 + 风格化 4 风格精品化润色，全部经 PIL 量化 + 视觉分析验收。
  1. **真实 HDRI 天空 IBL（写实最大收益）**：realistic/night-realistic 的 `scene.environment` 由 `RoomEnvironment`（室内工作室烘焙）改用 `public/sky.hdr`（CC0 户外 HDRI，来源 three.js examples `quarry_01_1k.hdr`，~1.5MB）。`RGBELoader`+`PMREM` 异步加载、首帧 `RoomEnvironment` 兜底不黑屏、加载完成后触发一次性 `setStyle` 重建让材质拾取真实天水 IBL——玻璃反射与天空方向/色温一致，消除最大「CG 感」来源。HDRI 资产随包发布到 `assets/sky.hdr`，生成器须拷到目标工程 `public/sky.hdr`。
  2. **玻璃幕墙材质**：`pbr` 楼体由 `MeshStandardMaterial` 升级 `MeshPhysicalMaterial`，消费新增 `realism.material.clearcoat`/`clearcoatRoughness`（realistic 默认 0.9/0.3）——配合 HDRI 给玻璃幕墙漆面反射；屋顶/裙楼仍走哑光混凝土拉开质感对比。
  3. **SMAA 抗锯齿（全 composer 风格）**：`buildPostFX` 在 bloom 之后、`OutputPass` 之前挂 `SMAAPass`。composer 渲染到 WebGLRenderTarget 绕过渲染器 MSAA，致 cyber 网格线/全息星云边缘/写实玻璃边锯齿——视觉分析确认 SMAA 后「premium、无 stair-step」。isometric 无 composer、仍走 MSAA。
  4. **夜景湿润反射恢复 + 曝光重测**：`PROFILES['night-realistic'].reflect` 恢复 `true`（v2.18 误关，签名特性死代码）；`exposure=3.0`（湿润反射补光，较 v2.18 的 4.0 下调，PIL avgL≈38 平衡）。视觉分析确认：湿润镜面反射可见、发光窗冷暖分层、路灯光晕、无 bloom 过曝、楼幢 silhouette 可辨。
  5. **等距伪接触阴影**：等距风格按纪律不开真阴影致楼底「飘」；`extrudeBuildings` 给每栋楼底铺 `CircleGeometry` 半透黑贴片（实色半透，renderOrder=1 在地面后绘制）接地。实测 alpha 贴图在本场景透明路径不稳定，故用实色半透。
  6. **曝光数据化**：`applyProfile` 优先读 `realism.exposure`、缺省回退 `PROFILES.toneExposure`；schema 加可选 `realism.exposure`（0–8）+ `realism.material.clearcoat`/`clearcoatRoughness`（不改 required，不破坏存量 spec）。
  7. **realistic 调参**：`material` 偏玻璃（roughness 0.35→0.18 / metalness 0.1→0.05 / envMapIntensity 1.0→2.0 + clearcoat 0.9）；`shadow.radius` 4→7（更柔）；`sun.elevation` 55→38（更长投影）；fog 维持 null（compact 园区加大气透视 washout 风险大于收益）。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.24.0 → 2.25.0`；digital-twin 技能 `metadata.version` `2.18.0 → 2.19.0`；`tokens.schema.json` / `SKILL.md` / `references/styles.md` / `references/scene-recipe.md` 文档同步。

## 2.24.0 - 2026-07-25

### Changed
- **thirdnet-digital-twin v2.18.0「第一次生成零踩坑」修复**：针对首次生成「红梅社区」暴露的问题逐项修在技能源，下次生成不再踩。
  1. **`scripts/generate_data.py` mock 闭合括号 bug**：`mockPoiDetails: Record<...> = {}` 末尾误用 `]` 闭合（致 `vue-tsc` TS1136，含 POI 的 spec 必触发，每次重跑都要手改）→ 改 `}`。
  2. **自定义类别色进 3D**：`ParkScene.categoryToken()` 只读 `applyTheme(style)` 静态主题、不读 `scaffold.tokens`，致 `spec.tokens.category.<cat>`（如 residential/factory）仅进 CSS 变量、不进 3D 楼幢上色——与 `park-spec.md`/`intake.md` 文档宣称不符。加 `scaffold.tokens.category` 兜底，per-park 自定义类别色真正上色，无需再手改 6 个 theme 文件。
  3. **类型补丁**：`assets/components/theme.ts` `ThemeTokens.building` 加 `edgeColor?: string`（ParkScene 读 `building.edgeColor` 致 TS2339）；`assets/components/useStyle.ts` 再导出 `type StyleKey`（StyleSwitcher 从本模块导入致 TS2459）。
  4. **夜间可见性**：night-realistic 实测首屏 avgL≈16（用户反馈「看不清」）。根因：`PROFILES` 全风格 `toneExposure=1.0`（夜间无提亮）+ 兜底环境光复用近黑 `hemiSky` 作颜色 + `bgTop/bgBottom` 近黑。修复：`PROFILES` night-realistic `toneExposure 1.0→1.3`（主杠杆）；`buildLights` 兜底环境光光色由 `hemiSky` 改白色（旧版让 ambientFloor 强度形同虚设，全风格生效）；`night-realistic.tokens.json` `ambientFloor 0.22→0.28`、`bgTop/bgBottom` 抬亮（`#0a1428`/`#050a14` → `#14264a`/`#0a1428`）、`windows.emissiveIntensity 1.3→1.6`（发光窗在提亮场景里依然可辨——根因是流水线本就在跑、被过暗场景淹没）。
  5. **围合式园区中央可见性**：`OrbitControls.minPolarAngle 0.5→0.08`，让用户可拖到近顶视查看被四周楼栋从斜视角遮挡的中央地面元素（水池/地下坑底）；默认斜视不变。
  6. **脚手架指引**：`SKILL.md`「约定」补三条——独立最小工程 `package.json` 须含 `@types/three`（three 0.169 不自带类型，缺则 TS7016）；`tsconfig.json` 用单文件无 project references（composite+noEmit 致 TS6310）；自定义类别色走 `spec.tokens.category`（v2.18 起进 3D）。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.23.2 → 2.24.0`；digital-twin 技能 `metadata.version` `2.17.0 → 2.18.0`；`CLAUDE.md` 版本引用同步。

## 2.23.2 - 2026-07-25

### Changed
- **thirdnet-digital-twin v2.17.0 渲染问题修复**：1) 夜景楼幢立体轮廓走新增可选 token `building.edgeColor`（night-realistic 配淡冷色 `#a8c0d8`，暗天空下可辨）+ 抬升夜景立面（ambientFloor 0.18→0.22、sunIntensity 0.5→0.7）；2) 发光窗流水线由 night-realistic 扩到全部 4 个深色风格（cyber/holographic/nebula/night-realistic），三风格各加 `windows` token 块（cyber 由整栋均匀发光转为窗光发光）；3) `buildGround()` 外圈城市地面改透明（漂浮园区岛、市政道路保留），cyber 网格与 night Reflector 半透地面下加不透明衬底保证「内不透」+ 维持地下坑体遮挡；4) `buildSurfaceParking` 由单轴直线重写为边界反推的二维网格（必不溢出）+ `validate_spec.py` 加车位越界 WARN；5) 360° 旋转经核验范式代码本就支持、零改动。文档同步 SKILL.md / styles.md / scene-recipe.md(§3/§10/§15) / park-scene-impl.md。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.23.1 → 2.23.2`；digital-twin 技能 `metadata.version` `2.16.0 → 2.17.0`。

## 2.23.1 - 2026-07-24

### Changed
- **thirdnet-digital-twin v2.16.0 楼层高度加高**：`floorHeight` 默认值由 `24` 调整为 `40`（`scripts/generate_data.py` 默认 + `references/park-spec.md` 文档两处）；5 个示例 spec（`evals/files/example-spec.json` 与 `generality/` 下 industrial/government/government-complex/underground）显式 `floorHeight` 同步 `24 → 40`。`floorHeight` 为 spec 级单值、与视觉风格解耦，所有几何（楼栋挤出 / 楼层分割虚线 / 女儿墙 / 楼顶机房 / 楼层拾取盒 / 金色高亮 / 连廊悬高 / POI 锚定 / 相机取景 `Hmax = max(floors) × floorHeight`）均从 `scaffold.floorHeight` 派生，运行时无硬编码 24，几何与对齐按新值自动等比缩放，无回归。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.23.0 → 2.23.1`；digital-twin 技能 `metadata.version` `2.15.0 → 2.16.0`。

## 2.22.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.14.0 移除「园区外围墙」特性**：删 `buildSurrounding` 围墙渲染块 + `spec.environment.surrounding.wall` schema 字段 + 6 风格 token 的 `environment.wall` 配色（地下车库玻璃壁 `underground.wall` 不受影响）；同步清理 references / validate_spec.py / evals.json / fixture 相关描述；闸机 / 入口引道保留。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.21.0 → 2.22.0`（顺带修正协调技能此前滞留的 `2.19.0`）；digital-twin 技能 `metadata.version` `2.13.0 → 2.14.0`；`CLAUDE.md` 版本引用同步。

## 2.20.0 - 2026-07-23

### Changed (v2.12.1 增量)
- **thirdnet-digital-twin v2.12.1 文档+脚本+夹具增量**：① **`references/intake.md` 新增「模式 E 建筑施工平面图」+ 政务园区调色指引**（建筑制图 intake 路径：制图轴 1-7/A-H → world 坐标 + 楼栋/房间/车位识别 + 「首层平面图 = 所有 POI floorIndex: 0」语义 + 政务/工业/办公 3 类调色对照表）。② **`references/park-spec.md` 加 3 段文档**：`PoiSpec.tooltip.meta` 标准键名约定（政务/物业/通用 3 组推荐键名 + 注 v2.12 优先 `roomSpec`）；**「阶梯裙楼建模」**段（方案 A 拆多栋 + `connects` 豁免 AABB 即可；方案 B `floorProfile?` v2.13+ 远期）；**PoiType 政务类型扩展表**（警务室/指挥所/武装部/医械库/党群中心映射到 `service`/`custom` + 远期专属 type 计划）。③ **`scripts/generate_data.py` 透传 3 个 v2.12 字段**：`ScaffoldBuilding.connects?`（v2.9 字段补回静态脚手架类型）+ `ParkScaffold.previewStyles?` + `mockPois[].room_spec?`（从 `spec.pois[].roomSpec` 派生），重跑后不再丢字段。④ **`scripts/validate_spec.py` 加车位密度 WARN**（`stalls × 72 / (boundary.x × boundary.z × 4) > 20%` 触发；提示扩 boundary 或拆 multi-lot）。⑤ **`SKILL.md` 验证 checklist 拆 6 个分支**（基础 30 条必查 + POI 条件 4 条 + 地下条件 6 条 + 写实条件 3 条 + 航拍条件 6 条 + 多风格条件 4 条 + 连廊条件 4 条 + 阶梯裙楼条件 2 条），按 spec 实际配置勾选对应子清单。⑥ **新增 `evals/files/generality/government.json` 政务单位模板夹具**（演示 `spec.unitTemplate` 政务单位字段：入驻单位/所属部门/在编人数/服务范围/主要职责/联系电话 + 3 类部门池：综合管理/公共服务/专项职能）。

## 2.20.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.12.0 建筑平面图与多风格预览支持**：① **schema 扩 `poi.roomSpec`**（`area/capacity/dept/duty` 结构化字段，政务/功能房间用例；`PoiRuntimeItem` 同步增 `room_spec`，`PoiOverlay` 优先渲染 `roomSpec` 块，部门/职责/面积/容纳 4 字段 + 暗色 tile-bg 底色）。② **schema 扩顶层 `previewStyles?: Style[]`** — 允许 spec 一次性声明多套待切换风格；配合新增 `assets/components/StyleSwitcher.vue`（左上角 v-switch + 全 `--twin-*` 配色 + a11y `aria-pressed`）与 `assets/composables/useStyle.ts`（current/setStyle 单例 + applyTheme/applyCssVars 联动），`GlobalTwin.vue` 顶部叠加切换器、`watch(current) → scene.setStyle` 单向推回。③ **政府/政务园区 token 调色指引** + 新增 `evals/files/generality/government-complex.json` 夹具（11F 主楼 + 5F 裙楼 `connects` + 6 个功能房间 POI 带 `roomSpec` + 246 地面车位 + `previewStyles: 6 风格` 演示）。④ 顺手修：`ParkScaffold` 接口增 `connects?: string[]`（`v2.9` 字段补回到静态脚手架类型）、`previewStyles?: string[]`；`generate_data.py` 后续将透传这些字段（v2.12 当前由项目侧手动补）。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.19.0 → 2.20.0`；`marketplace.json` 顶层 `metadata.version` `0.56.0 → 0.57.0`；digital-twin 技能 `metadata.version` `2.11.0 → 2.12.0`；`CLAUDE.md` 版本引用同步。

## 2.19.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.11.0 地下坑体推荐默认回调**：`deck_y` 推荐典型值 200→140（对 v2.10 加深的回调，平衡坑体可见性与场景紧凑度）；`validate_spec.py` 偏浅 WARN 阈值 `<160`→`<140`（否则新默认会自触告警）+ 提示文案 B1 典型 200→140、B2 范例 400→280；`setBelowView` 相机兜底深度常量 200→140；文档同步 `references/park-spec.md`（deck_y 注释 + 多层堆叠深度约定 + 校验规则偏浅 WARN）/`scene-recipe.md`（§14 序段）/`SKILL.md` description；范例 fixture `example-spec.json` B1 200→140 / B2 400→280、`underground.json` B1 200→140；顺手清理 `industrial.json` 漏改的 B1 120→140 与 `building-geometry.ts` `deckY` docstring -120→-140。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.18.0 → 2.19.0`；`marketplace.json` 顶层 `metadata.version` `0.55.0 → 0.56.0`；digital-twin 技能 `metadata.version` `2.10.0 → 2.11.0`；`CLAUDE.md` 版本引用同步。

## 2.18.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.10.0 地下坑体加深 + 相机解锁地下俯仰**：① **deck_y 推荐默认 120→200**——renderer 仍 `deckY=-|deck_y|` 透传、不在引擎侧 clamp（避免多层堆叠相邻层 clamp 到同值致深层零高度）；`validate_spec.py` 新增 `deck_y<160` 偏浅 WARN；`setBelowView` 相机兜底深度 120→200；范例 fixture 同步（`underground.json` B1 120→200 / B2 100→320 修反向 bug，`example-spec.json` B1 120→200 / B2 240→400）。② **相机解锁地下俯仰**——`defaultMaxPolar` 1.3→π-0.1、`BELOW_POLAR_MAX` 2.6→π-0.1、构造期 `controls.maxPolarAngle` 改读 `defaultMaxPolar` 字段（修硬编码 1.3 脱节、启动仍被锁 bug）；正常交互即可拖到地面之下仰视坑体，从下方看 Y=0 不透明地面因 BackSide culling 自然消失。文档同步 `references/park-spec.md`（deck_y 注释 + 多层堆叠深度约定 + 校验规则补偏浅 WARN）/`scene-recipe.md`（极角范围 [0.5,1.3]→[0.5,π-0.1]、§14 序段 + §14.2 maxPolarAngle 说明）。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.17.0 → 2.18.0`；`marketplace.json` 顶层 `metadata.version` `0.54.0 → 0.55.0`；digital-twin 技能 `metadata.version` `2.9.0 → 2.10.0`；`CLAUDE.md` 版本引用同步。

> 注：2.17.0（digital-twin v2.9 连廊跨层 + connects 豁免 + typecheck 修复）未单独记入 CHANGELOG，内容见 digital-twin 技能 `SKILL.md` 变更历史 v2.9 条目。

## 2.16.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.8.0 通用化与死代码清扫**：① **解锁 `corridor`（楼栋间空中连廊）**——`spec.schema.json` 登记 `corridor` `$def` + 根属性、`park-spec.md` 补「连廊」节（引擎 `buildCorridor` 与 `generate_data.py` 早有实现，此前被 closed schema `additionalProperties:false` 锁死、用户走 `validate_spec.py` 会被拒）。② **删除引擎死代码**——v2.4 遗留的 `wire|white` 不可达材质分支（`PROFILES` 从不赋值，约 30 处）+ `fresnelRim.glsl` 空 `#if` 块 + `configureGTAO` 空 try/catch + `dispose()` 漏释放 `selectionOverlay.geometry` + `useTwinData` 返回对象里冗余的 `errMsg`（命名导出已是消费方）。③ **文档对齐当前 6 风格 / 13 组件事实**——清掉「当前 4 风格不启用 env/AO/反射」等与 v2.5 矛盾的陈述（scene-recipe / park-scene-impl / SKILL / evals）、渲染管线表补 realistic/night-realistic 两行、组件数 12→13（补 `GarageCard.vue`）、`DigitalTwin.ts` 幽灵引用改指 `park-scene.impl.ts`、`design-source.md` 去特定化重写为示例化通用指南、`spec.schema.json` 描述 v1.9→v2.7 + `building.floors` number→integer。④ 脚本小修——`extract_pen` 注入备注补 6 风格、`validate_spec` `VALID_CATEGORIES`→`KNOWN_CATEGORIES` + 无 jsonschema 降级路径补齐 token 必需块、`generate_theme` 去冗余判断、`generate_data` 收敛双重 `or {}`；删除冗余 `scripts/__pycache__/`。SKILL.md `description` 由 40 行 changelog 瘦身为紧凑触发描述、变更历史移入正文。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.15.0 → 2.16.0`；`marketplace.json` 顶层 `metadata.version` `0.52.0 → 0.53.0`；digital-twin 技能 `metadata.version` `2.7.0 → 2.8.0`；`README.md`/`CLAUDE.md` 版本引用同步。

## 2.15.0 - 2026-07-23

### Changed
- **thirdnet-digital-twin v2.7.0 通用化**（不再假设园区是办公楼，办公为默认、向后兼容）：放开 `buildings[].category`（任意自定义串 factory/warehouse/residential/office…；非 garage 按挤出楼栋渲染、配色取 `tokens.category.<cat>` 缺省回退 building；`garage` 可多栋多入口）与 `pois[].type`（任意自定义串，未知类型通用圆点标记）；新增可选 `spec.unitTemplate`（`fields`/`tenants`）让非办公园区楼层单位字段与租户池可定制（缺省=办公 8 字段 + 8 行业池，产物逐字节不变）；契约层 `UnitDetail.fields?` + `UnitDetail.vue` 优先渲染 fields；renderer 楼栋配色按类别解析、图例/POI 容错回退。**地下泛化**——POI `floorIndex` 允许负值（-1=B1，标注地下楼层设施）+ 增 `garageId`（绑定 garages[].id）、`garages[]` 增 `usage`（缺省 `parking`；`mall`/`subway`/`shelter`/`workshop` 等非车库跳过车位网格、改显功能房间 + usage 标签，`GarageCard` 据 capacity 分支），可表达地下商场/地铁/人防/车间；`buildUndergroundGarage` 用 `if (cols && rows)` 守卫车位块、`resolveGarageRooms` 非 parking 无 rooms 返空。同步更新 `spec.schema.json`/`validate_spec.py`/`generate_data.py`/`building-geometry.ts`/`park-scene.impl.ts`/`GarageCard.vue`/`park-spec.md`/`scene-recipe.md`/`SKILL.md`。
- **版本同步**：`plugin.json` / 协调技能 `SKILL.md` `metadata.version` / `marketplace.json` `thirdnet-fullstack` 条目 `version` 三处 `2.14.0 → 2.15.0`；`marketplace.json` 顶层 `metadata.version` `0.51.0 → 0.52.0`；digital-twin 技能 `metadata.version` `2.6.0 → 2.7.0`；`README.md`/`CLAUDE.md` 版本引用同步。

### Cleanup（/simplify）
- 删除死着色器 `assets/grid.glsl`（运行时仅消费 `gridGround.glsl`）+ 修正相关引用；删除自述「不随技能发布」的历史参考 `references/exemplar.md`；取消跟踪误提交的 `scripts/__pycache__/*.pyc` 并新增技能级 `.gitignore`；修正陈旧「4 风格」→「6 风格」计数；`validate_spec.py` 主题文件读取由 4 次/次收口为 1 次（`lru_cache`）；`park-scene.impl.ts` 移除 3 处死 `ground:'light'` 分支；`park-spec.md` 去重 `CameraTourSpec`。

## 2.5.0 - 2026-07-08

### Fixed
- **移除 `hooks.json` 非法 `_comment` 键**：前端 PreToolUse 钩子对象内的 `_comment` 不属于 Claude Code 钩子 schema，已删除；其注释语义并入 hooks.json 顶层 `description`。
- **补齐缺失的 `README.md`**：仓库根插件目录长期无 README（CHANGELOG 历史条目曾引用、但磁盘上不存在），本次新建，含概述、24 技能清单（按类分组，6 个英文第三方技能标注来源）、安装、使用入口。

### Changed（去重与瘦身）
- **模板安装命令三重复收敛**：`backend-workflow`、`net-microservice-generator`、`thirdnet-template-upgrade` 三处逐字重复的「清 NuGet http-cache → 卸载 → --force 安装 → list 核对」命令与 a/b/c/d 注释，抽取到新共享参考 `backend-workflow/references/template-install.md`，三处正文改为一行引用 + 可执行命令。
- **内部源地址单点化**：NuGet / npm 内外网地址散落 5+ 处（`thirdnet-template-upgrade` 单文件内重复 3 次），统一到新参考 `backend-workflow/references/internal-registry.md`（含 npm 外网端口 14873 非 4873 的坑）；`backend-workflow`、`frontend-workflow`、`thirdnet-fullstack`、`thirdnet-template-upgrade` 正文改引用。
- **`thirdnet-template-upgrade` 瘦身**：Phase 4 报告模板（~270 行内联）外移到新参考 `references/report-template.md`；「执行铁律」三处重复（14-25 / 52-63 / 78-83）合并为单一定义节；frontmatter `description` 由 580 字符政令式长段重写为第三人称摘要 + 触发词。正文由 1516 词降至 ~900 词。
- **`design-apple` 拆分（渐进披露）**：19KB（479 行）全内联 SKILL.md 拆为精瘦正文（~165 行：视觉主题原则 + 色板/排版/布局速查 + Do's & Don'ts + Agent 提示词）+ 4 份参考（`color.md` / `typography.md` / `layout.md` / `components.md`，后者含 Admin 模板真实 token 映射与 Element Plus 主题覆盖）。技能自身版本 `1.0.0 → 1.1.0`。
- **`md-to-word` 正文口吻**：由产品文档描述口吻（"将 Markdown 转换为…"）改为祈使指令（"使用 scripts/md_to_docx.py 转换，校验…"）。
- **子代理内联契约精简**：`agents/backend-developer.md`、`agents/frontend-developer.md` 内联重述的共享 API 契约改为「权威源在已加载技能」+ 3 条速记 + 链接到协调技能「共享 API 约定」，去除与 `net-api-developer` / `net-auth` / `api-typescript-spec` 的重复。

### Added（元数据）
- `plugin.json` 补 `homepage`、`repository`、`keywords`；`marketplace.json` 的 `thirdnet-fullstack` 条目补 `homepage`（与其余 4 个第三方插件条目对齐）。
- 新增 7 份参考文件：`backend-workflow/references/{template-install,internal-registry}.md`、`thirdnet-template-upgrade/references/report-template.md`、`design-apple/references/{color,typography,layout,components}.md`（design-apple 的 `references/` 目录为新建，另两目录原有参考）。

### 文档同步
- 仓库根 `CLAUDE.md`：项目结构注释版本号 `v2.2.0 → v2.5.0`、`marketplace v0.46.0 → v0.49.0`；Stop Hook 描述明确为「后端文档门 + 前端文档门 + 全栈质量收尾门」共三个。
- `frontend-workflow` 路由表 `design-apple` 行措辞收紧（落地 Apple 风格视觉系统 / 编写 CSS-SCSS），与 `frontend-design`（设计方向与创意风格）分工更清晰。

### 版本号同步
- `plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `2.4.0 → 2.5.0`；`marketplace.json` 顶层 `metadata.version` 由 `0.48.0 → 0.49.0`。

### Benefits
- 消除命令/地址/契约的多处重复，单一事实源后改一处即生效，降低维护漂移。
- 两个最臃肿的 SKILL.md（template-upgrade、design-apple）回归渐进披露，正文聚焦决策与速查，细节按需读取参考。
- 元数据与文档补齐，插件在 marketplace 中更规范、更易发现。

### 本轮不做（Tier 3，记录在案）
- 技能命名前缀统一（9 个无前缀技能）、`thirdnet-fullstack` 协调技能自命名冲突、frontmatter schema 统一（metadata vs 顶层 version）——级联改动 hooks.json/agents/跨技能引用，风险高，留作下一轮 v3.0 专项。

## 2.4.0 - 2026-07-07

### Added
- **`thirdnet-doc-generator` 支持批量生成（交付套件）**：在原「一次一份」基础上新增「全部 4 类」与「多类子集」批量路径。用户明确点名一类时仍走单类线性 5 步快路径（行为不变）；含糊/泛指（如"生成项目交付文档"）时，Step 1 的 `AskUserQuestion` 把「全部 4 类（交付套件）」作为推荐首选。批量路径核心：Step 2 **共享扫描**一次（采集所选类型采集项的并集，4 类同源、不重复扫 N 遍）→ Step 3 **一次裁剪**（适用全集，保障跨文档一致）→ 新增 Step 3.6 **批量事实确认**（一次合并 `AskUserQuestion` 收集代码无法确定的业务背景/优先级/验收标准/非功能性指标，避免每个填充子代理分别打断用户）→ Step 4 **并行填充**（每类派 1 个 `general-purpose` 子代理并发产出，规避长上下文后半段质量下滑）→ Step 5 多文件输出（逐个转 Word）。

### Changed
- Step 1 由「确定文档类型」改为「确定文档集合」；description 增补触发词「交付套件 / 全套文档 / 四件套 / 一次性生成所有文档」，并把含糊时的推荐默认从「强制单选询问」改为「推荐全部 4 类，其次单类/自定义」。
- Step 3.5 触发条件由「仅当文档类型为用户手册」改为「仅当 用户手册 ∈ 文档集合」（单类用户手册、批量含用户手册均执行逐页截图）。
- `references/doc-scan-guide.md` 通用约定补「批量并集扫描」一条。
- 版本号同步：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `2.3.0` → `2.4.0`；`marketplace.json` 顶层 `metadata.version` 由 `0.47.0` → `0.48.0`；`thirdnet-doc-generator` 技能自身 `metadata.version` 由 `1.2.0` → `1.3.0`。

### Benefits
- 交付/归档/验收场景从「跑 4 次技能、扫 4 遍代码、答 4 轮问题」缩短为「一次共享扫描 + 并行填充」，且 4 份文档的模块清单/角色/实体天然一致，消除跨文档漂移。
- 单类定向场景快路径完全不变，无回归。

## 2.3.0 - 2026-07-07

### Changed
- **技能重命名 `doc-generator` → `thirdnet-doc-generator`**：技能目录、`SKILL.md` 的 `name:` 字段、调用 ID（`thirdnet-fullstack:doc-generator` → `thirdnet-fullstack:thirdnet-doc-generator`）同步更新。目录名与 `name:` 字段保持一致（沿用 `thirdnet-fullstack`、`thirdnet-template-upgrade` 的约定）。
- **引用同步**：协调技能 `thirdnet-fullstack/SKILL.md` 的任务路由表与技能清单、`plugin.json` 与 `marketplace.json` 的 description、仓库根 `CLAUDE.md`、技能内 6 个 reference 模板（`user-manual-template` / `user-manual-screenshot-guide` / `requirement-spec-template` / `doc-scan-guide` / `test-case-template` / `system-design-template`）的 prose 自引用，全部由 `doc-generator` 改为 `thirdnet-doc-generator`。
- **版本号同步**：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `2.2.0` → `2.3.0`；`marketplace.json` 顶层 `metadata.version` 由 `0.46.0` → `0.47.0`；`thirdnet-doc-generator` 技能自身 `metadata.version` 由 `1.1.0` → `1.2.0`。

### 说明
- `thirdnet-` 前缀此前仅用于品牌/伞型技能（`thirdnet-fullstack` 协调技能、`thirdnet-template-upgrade` 工具技能）；本次为有意的局部前缀扩展，其余交付类技能（`fullstack-review`、`md-to-word`）暂不迁移，保持现状。
- 2.2.0 条目中的 `skills/doc-generator/`、`新增 doc-generator` 等表述为历史记录，按仓库惯例保留不重写。
- `hooks.json`、`agents/*.md`、`README.md` 均不引用该技能，无需改动。

### Benefits
- 技能命名与插件命名空间（`thirdnet-fullstack:`）及品牌前缀（`thirdnet-`）更一致，便于在 marketplace 中识别为 ThirdNet 自有技能。

## 2.2.0 - 2026-07-07

### Added
- **`skills/doc-generator/`（新技能，项目交付文档生成）**：功能开发完成后基于代码库功能模块生成项目交付文档，覆盖需求规格说明书、系统设计文档、用户手册、测试用例文档四类，每类配专属模板（`requirement-spec-template.md` / `system-design-template.md` / `user-manual-template.md` / `test-case-template.md`），并附 `user-manual-screenshot-guide.md`、`custom-doc-guide.md`、`doc-scan-guide.md` 三份操作指南。输出 Markdown 可由 `md-to-word` 转 Word。description 含明确触发词 + AskUserQuestion 兜底确认文档类型。

### Changed
- 技能总数 21 → 24（新增 doc-generator；此前迁入的 fullstack-review、thirdnet-template-upgrade、md-to-word 一并纳入计数）。
- `README.md`、`CLAUDE.md` 中 `thirdnet-fullstack` 版本标注统一为 v2.2.0（修正历史漂移：README 曾标 v1.7.0、CLAUDE 曾标 v2.1.0）。
- `md-to-word` / `thirdnet-template-upgrade` 两个技能的 SKILL.md frontmatter 规范化：顶层 `version:` 迁移为 `metadata.version`，补 `license: MIT` 与 `metadata.author`，与全插件其他 thirdnet 技能风格一致。

### Benefits
- 项目交付文档从手工拼装升级为「扫描代码库 → 套模板 → 一键转 Word」的闭环，doc-generator 产 Markdown、md-to-word 转 docx，两技能协同。
- 插件内技能 frontmatter 结构统一，便于版本跟踪与漂移管理。

## 2.1.0 - 2026-07-06

### Changed
- **`md-to-word` 工具技能迁入插件**：从仓库根 `skills/md-to-word/` 移至 `plugins/thirdnet-fullstack/skills/md-to-word/`，纳入 `thirdnet-fullstack:` 命名空间。`scripts/md_to_docx.py`、`evals/evals.json` 及 10 个 eval fixtures 一并随迁；SKILL.md 内脚本调用路径改用 `${CLAUDE_PLUGIN_ROOT}/skills/md-to-word/scripts/md_to_docx.py`。
- 根目录 `skills/md-to-word/` 删除（git 索引标记 deleted），仓库根不再保留独立技能目录，插件成为唯一来源。

### Benefits
- Markdown 转 Word 能力与全栈开发流程同插件内闭环，无需跨目录引用。

## 2.0.0 - 2026-07-06

### Added
- **`skills/thirdnet-template-upgrade/`（模板升级技能迁入）**：前后端模板升级操作指南（`thirdnet-migrate` / `create-thirdnet-admin`）从独立位置迁入本插件，纳入 `thirdnet-fullstack:` 命名空间。工具只做 diff 对比、AI 全量判定并直接升级文件，覆盖 `references/commands.md` 与 `references/merge-protocol.md`。

### Changed
- 主版本号升至 2.x，标志插件成为完全自包含的全栈开发技能全集（不再依赖任何外部/独立技能目录）。
- 配合 1.9.0 引入的 `fullstack-review` 审查技能与 Stop Hook「全栈质量收尾门」，形成「文档驱动（Stop Hook #1/#2）+ 全栈质量审查（Stop Hook #3）」三重收尾门。

### Benefits
- 模板升级流程由 AI 主导语义判定，工具退化为纯 diff oracle，合并权与判定权收归 AI。

## 1.9.0 - 2026-07-06

### Added
- **`skills/fullstack-review/`（新技能，全栈代码审查与验证）**：填补开发完成后缺少统一验证环节的空白。功能开发完成后对已实现的前后端模块做全方位审查，覆盖七大维度——后端规范遵守、前端规范遵守、跨端契约一致性、业务功能正确性、性能、安全性、文档与流程；严格编排既有规范技能（`net-*` / `vue-*` / `api-typescript-spec` / `thirdnet-fullstack` 的 `代码审查清单` / `开发完成校验` / `约定同步检查清单`），不重述其正文。产出 `review-report.md`（问题清单 + 严重级别 Critical/Major/Minor/Info + 整体优缺点 + 歧义与待确认 + 优先级排序的修改方案 + 阻断结论）。含三份 references：`review-rules.md`（可检查规则目录）、`report-format.md`（严重级别与报告模板、子代理派发 prompt）、`scope-and-vcs.md`（SVN 未提交/最近提交/整个项目三种范围 + git 兜底 + 模块推断）。
- **Stop Hook 第 3 条（全栈质量收尾门）**：在 `hooks.json` 的 Stop 数组新增一个 prompt 钩子——检测到前后端功能性代码变更（`backend/**/*.cs` 或 `frontend/**/src/**/*.{vue,ts,tsx}`）且尚未通过 `fullstack-review` 审查（或仍有 Critical/Major）时，阻断会话结束并提示调用本技能。与既有两条文档完整性 Stop 钩子叠加，形成「文档 + 注释 + 全栈质量」三重收尾门。

### Changed
- 版本号同步：`plugin.json`、协调技能 `thirdnet-fullstack/SKILL.md` 的 `metadata.version`、`marketplace.json` 中 `thirdnet-fullstack` 条目 `version` 三处由 `1.8.0` → `1.9.0`；`marketplace.json` 目录 `metadata.version` 由 `0.43.0` → `0.44.0`。
- `thirdnet-fullstack` 协调技能：任务路由表新增「功能开发完成 / 上线前检查 → 委派 `fullstack-review`」一行；约定同步检查清单补一条「审查发现跨端不一致 → 调 fullstack-review 复核」。
- `backend-workflow` / `frontend-workflow`：「开发完成校验」末尾新增「最终建议调用 `thirdnet-fullstack:fullstack-review` 做全栈审查（由 Stop Hook 强制）」；路由表加入审查入口。
- 仓库根 `CLAUDE.md`：技能总数 20 → 21，新增「质量保障（1 个）：`fullstack-review`」分类；文档驱动开发段补注 Stop Hook 现含全栈质量门。
- `plugin.json` / `marketplace.json` 的 `thirdnet-fullstack` description 更新，体现审查技能与质量收尾门。

### Benefits
- 开发完成后的验证从「碎片化」（6 钩子 + 2 域清单 + 2 交付清单 + 1 同步清单）升级为「一站式全栈审查 + 强制收尾门」，跨端契约不一致、缺权限注解、时间类型错误、缓存误用等高频问题在交付前被统一拦截。
- 审查范围适配目标项目的 SVN 工作流（未提交 / 最近提交 / 整个项目），git 兜底，模块推断自动定位前后端完整产物。
- 报告带严重级别与可执行修改方案，审查与开发职责分离（默认只报告不改码），避免审查客观性被修复动作稀释。

## 1.7.0 - 2026-06-20

### Changed（技能精简与合并，后端 10 → 8，总数 22 → 20）
- **合并 `net-authentication` + `net-rbac` → 新技能 `net-auth`**：认证（AuthN）与授权（AuthZ）本是一个安全域，两技能触发词互锁（auth 列 "Policy"、rbac 列 "授权"/"permission"）、几乎总同时加载。合并为单一 `net-auth` 技能，`crypto-catalog.md` 与 `rbac-flow.md` 作为 references。
- **折叠 `net-database-bulkcopy` → `net-efcore-developer`**：批量操作（BulkCopy / COPY 协议）本就是 EF Core 的窄分支（内存数据走 BulkCopy，已在库数据走 CTE），共享 `[DbBulk]` 故事。`bulk-operations.md` 迁入 efcore references，efcore SKILL 新增「批量数据操作」小节并保留 BulkCopy-vs-CTE 决策指针。
- **后端技能补 `metadata.version`（基线 1.0.0）**：原 10 个后端技能全部缺版本号（前端技能全有），统一补 `license: MIT` + `metadata: {version, author}`，纳入版本跟踪。
- **`reference/` → `references/` 命名统一**：`vue-pinia-best-practices`、`vue-router-best-practices` 目录与内部链接改复数，与多数技能一致；`vue-jsx-best-practices` 按既定决策保留单数不动（已知例外）。
- 同步更新所有引用点：`hooks.json` PreToolUse 钩子（net-auth 替代 net-authentication+net-rbac、net-efcore-developer 吸收 net-database-bulkcopy）、`backend-workflow` 路由表/检查清单/速查表/功能流程、`thirdnet-fullstack` 协调技能、`backend-developer` 子代理、`framework-and-template-catalog.md` 反向索引、`project-spec-template.md`、各跨技能 cross-ref。

### Added
- `skills/net-auth/`（合并自 net-authentication + net-rbac，含 crypto-catalog.md + rbac-flow.md）。

### Removed
- `skills/net-authentication/`、`skills/net-rbac/`、`skills/net-database-bulkcopy/` 三个目录。

### Benefits
- 后端技能 10 → 8（总数 22 → 20），触发词冲突降低、维护面收窄。
- 后端技能纳入版本跟踪，便于跨技术栈（.NET 10 / EF Core 10.x / Npgsql 10.x）漂移管理。

> DI/Startup 去重评估：`di-pipeline-and-startup.md`（项目级 10 步 DI）、`framework-pipeline.md`（框架级管道注册）、`appsettings-management.md`（配置层）经核对分属三个抽象层、无实质重复，未强行合并；仅在 di-pipeline 加交叉引用指针连接两者。

## 1.6.1 - 2026-06-20

### Changed
- **移除独立的 `thirdnet-backend` 与 `thirdnet-frontend` 插件**：自 1.6.0 起本插件已自包含全部前后端技能，两个独立插件成为冗余副本。删除后本插件成为 ThirdNet 前后端开发技能的**唯一来源**。
- 清理描述性引用：`plugin.json`、`hooks/hooks.json`、协调 `SKILL.md` 的「自包含说明」段落、`marketplace.json`、`README.md`、`CLAUDE.md` 中关于"已集成 thirdnet-backend / thirdnet-frontend"与"⚠️ 勿同装"的措辞，改为"唯一来源 / 开箱即用"（被警告的对象已不存在）。
- 协调 `SKILL.md`「自包含说明」段去掉 ⚠️ 同装警告，重述为单插件技能全集。
- `skills/thirdnet-template-upgrade/references/frontend-flow.md` 中 `thirdnet-frontend:frontend-workflow` 改为 `thirdnet-fullstack:frontend-workflow`。

### Removed
- `plugins/thirdnet-backend/`、`plugins/thirdnet-frontend/` 两个目录（git 历史保留）。
- `marketplace.json` 中 `thirdnet-backend`、`thirdnet-frontend` 两个 plugin 条目。

### Benefits
- 消除 1.6.0 记载的「跨插件三处同步」负担——今后技能只需在本插件维护一处。
- 消除「同装导致 PreToolUse 钩子命名空间互斥阻断」的风险（不再有可同装的对象）。

> 注：1.6.0 条目（含"backend/frontend 逐字节不变仍提供"）作为历史记录保留，其结论已被本条目推翻。

## 1.6.0 - 2026-06-20

### Changed
- 由包装型插件重构为**自包含集成型插件**：把 `thirdnet-backend`（10 个后端技能）与 `thirdnet-frontend`（11 个前端技能）的全部技能**复制集成**进本插件 `skills/`，技能命名空间统一为 `thirdnet-fullstack:`，本插件**可独立运行**，无需另装前后端插件
- 协调技能 `thirdnet-fullstack/SKILL.md`：跨插件相对链接本地化（`../backend-workflow/...`、`../frontend-workflow/...`）；原「前置条件检查（依赖前后端插件）」改为「自包含说明」并加 ⚠️ 勿与前后端插件同装的提示
- 两个子代理 `agents/backend-developer.md`、`agents/frontend-developer.md`：由「包装 thirdnet-backend/thirdnet-frontend 插件」改为「专精本插件集成的后端/前端本地技能」，强制技能调用表指向 `thirdnet-fullstack:` 技能
- `plugin.json` 与 `marketplace.json` 中 `thirdnet-fullstack` 条目描述改为反映自包含集成

### Added
- `.claude-plugin/hooks/hooks.json`：合并自前后端插件的 **6 条钩子**（Stop / PreToolUse / PostToolUse 各 2），技能合规检查的 14 个技能字符串统一为 `thirdnet-fullstack:` 前缀；本插件单独安装即具备与前后端插件等价的文档驱动与技能强制调用能力
- 集成进来的 21 个技能（含各自 `references/` 或单数 `reference/` 参考文档）：
  - 后端：`backend-workflow`、`net-api-developer`、`net-efcore-developer`、`net-rbac`、`net-authentication`、`net-cache-use`、`net-background-job`、`net-database-bulkcopy`、`net-enum-dict`、`net-microservice-generator`
  - 前端：`frontend-workflow`、`api-typescript-spec`、`vue-best-practices`、`admin-template-setup`、`vue-pinia-best-practices`、`vue-router-best-practices`、`vue-jsx-best-practices`、`vue-enum-dict`、`create-adaptable-composable`、`design-apple`、`frontend-design`

### Removed
- 上一版（未发布）的包装型设计：子代理不再引用 `thirdnet-backend:` / `thirdnet-frontend:` 外部插件技能

### 说明
- `thirdnet-backend` 与 `thirdnet-frontend` 插件本身**逐字节不变**，仍作为单端插件在 marketplace 提供。
- ⚠️ **勿同时安装** `thirdnet-fullstack` 与 `thirdnet-backend` / `thirdnet-frontend`：本插件自带的 PreToolUse 钩子（检查 `thirdnet-fullstack:` 技能）与前后端插件钩子（检查 `thirdnet-backend:` / `thirdnet-frontend:`）命名空间不同，同装会导致编辑同一文件时两个钩子互斥阻断。请二选一。
- 集成为复制（非移动），因此技能内容在 fullstack 与前后端插件中各有一份，后续改动需同步——这是「保留前后端插件 + 自包含 fullstack」的既定代价。
