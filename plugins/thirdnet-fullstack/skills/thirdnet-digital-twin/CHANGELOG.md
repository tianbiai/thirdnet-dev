# 变更历史（CHANGELOG）

数字孪生技能版本演进记录。生成器**无需阅读本文件**——当前能力以 SKILL.md / references / assets 为准；本文件仅供追溯「某能力是哪个版本引入的、为何这么设计」。

---

## v2.21.0（2026-07-26）

**精简风格集：删除 holographic（全息）/ nebula（星云）两风格**。两者渲染管线（ACES + bloom + 自发光窗 + dark 地面）与 cyber 高度重叠，维护三套近似模板成本高、对「拷贝-改」生成器是噪音；保留 4 种区分度高的风格（cyber / isometric / realistic / night-realistic）。**破坏性变更**：含 `holographic`/`nebula` 的 spec 经 `validate_spec.py` 将 FAIL，需改 `spec.style`/`previewStyles`。

1. **删除资产**：`assets/themes/holographic.tokens.json`、`assets/themes/nebula.tokens.json`、`assets/fresnelRim.glsl`（全息/星云专属菲涅尔 rim 着色器，唯一消费者已随风格移除）。
2. **收窄类型与注册表**：`StyleKey` 联合、`THEMES`/`STYLE_LABELS`（theme.ts）、`PROFILES`（park-scene.impl.ts）去掉 holographic/nebula；`StyleProfile.building` 去 `'holo'`、删 `useRim` 字段与 `injectRim` 方法（死代码清扫）。
3. **清理风格分支**：删 holographic 专属灯光分支、`if(b==='holo')` 楼体/屋顶材质分支；地面辉光 `cyber||holographic||nebula` 收窄为 `cyber`；发光窗/立面/地下材质 `emissive||holo` 收窄为 `emissive`。
4. **契约同步**：`spec.schema.json` style/previewStyles 枚举、`validate_spec.py` `VALID_STYLES`、`extract_pen.py`/`generate_theme.py` 提示串去两风格。
5. **文档与计数**：SKILL.md / `references/{styles,scene-recipe,park-scene-impl,park-spec,intake,shell,dynamic-data-api}.md` 去 holographic/nebula 引用，「6 风格」→「4 风格」、「4 深色」→「2 深色」。
6. **evals**：删全息专属 eval 9；eval 17（原 nebula 确定性/写实）改写为 night-realistic（同样有程序化星空+月亮，保留楼顶机房/路面标线/水景覆盖）；eval 12/18 计数断言更新。

文档：`references/styles.md` 删 holographic/nebula 两整节；`SKILL.md` metadata.version `2.20.0→2.21.0`；插件三处 `2.26.0→2.27.0`。

## v2.20.0（2026-07-26）

v2.19 HDRI 升级后用户反馈「夜景地面暗 / 楼墙玻璃反光太强 / 俯视看不清」，本轮在 token + 范式代码层逐项根治（调色值已落 `night-realistic.tokens.json` / `cyber.tokens.json` / `park-scene.impl.ts`，本次补 references 文档 + 版本号）：

1. **路灯 PointLight 真照明**：`buildAmbiance` 给路灯 head 挂 `PointLight`（≤8 盏 `decay=1`）——v2.18 前路灯仅自发光球、不照亮地面。night-realistic `pointIntensity 0.6→1530`、`pointDistance 200→2800`（亮斑有效半径 ∝ intensity，面积大幅扩）。仅 night-realistic 启用（cyber/holo/nebula `lights.point=null` 自动跳过）。
2. **reflBack 衬底 Lambert+emissive**：夜景 `Reflector` 下 `y=-0.05` 不透明衬底由 `MeshBasicMaterial` 改 `MeshLambertMaterial + emissive（road 色，0.9）`——Lambert 受 PointLight 在路灯附近叠加加亮、emissive 让俯视/离路灯远的中央不黑（`Reflector` 是自定义反射 shader、`opacity` 不标准透出下层）。`environment.city-ground #4a5870→#98a6bd`、`road #5e7090→#8090ae` 同步提亮。
3. **ambientFloor 大幅抬升**：cyber/night-realistic `0.28→1.2`——ACES toneMapping + 弱光下旧值 ~0.2 把受光物体压成近黑，须 ~1.2 楼墙/草地才可辨。
4. **楼墙降玻璃反光**：night-realistic `material.envMapIntensity 2.0→0.3`、`roughness 0.3→0.65`、`metalness 0.15→0.05`——用户反馈「墙体玻璃反光太强」，降 PBR 镜面、偏哑光混凝土。
5. **楼幢轮廓更亮**：`building.edgeColor #a8c0d8→#d8e6f8`（越 bloom 阈值、暗天空下多角度 silhouette 可见）；EdgesGeometry `edgeOpacity 0.6→0.85`（线更实）。
6. **fog 推远**：`near 600→1500`（园区内不再被暗雾染）。
7. **cyber 同步提亮**：`ambientFloor 0.4→1.2`、`shaders.grid.u_strength 0.85→1.3`、`environment.city-ground` 提亮、绿化带（grass/treeCanopy）降饱和变淡。

文档：`references/styles.md`（L21 ambientFloor 范围更新 + 新增 `## night-realistic` 专属段）、`references/scene-recipe.md`（§2 ambientFloor / §3 reflBack 衬底 / §10 PointLight 数值）；`SKILL.md` metadata.version `2.19.0→2.20.0`；插件三处 `2.25.0→2.26.0`。

## v2.19.0（2026-07-26）

写实两风格视觉真实感提升（详细见插件 CHANGELOG `2.25.0`，此处浓缩）：

1. **HDRI 天空 IBL**：realistic/night-realistic `scene.environment` 由 `RoomEnvironment` 改用 `assets/sky.hdr`（CC0 户外 HDRI）的 PMREM 烘焙——玻璃反射与天空方向/色温一致，消除最大「CG 感」来源。异步加载、首帧 RoomEnvironment 兜底不黑屏。
2. **玻璃幕墙 MeshPhysicalMaterial**：`pbr` 楼体由 `MeshStandardMaterial` 升级 `MeshPhysicalMaterial`（消费新增 `realism.material.clearcoat`/`clearcoatRoughness`）。
3. **SMAAPass 抗锯齿**：所有 composer 风格后处理链在 bloom 后、OutputPass 前挂 `SMAAPass`（composer 绕过渲染器 MSAA 致边缘锯齿）。
4. **曝光数据化**：`applyProfile` 优先读 `realism.exposure`、缺省回退 `PROFILES.toneExposure`；`tokens.schema.json` 加可选 `realism.exposure`（0–8）。night-realistic `exposure=3.0`（湿润反射补光，较 v2.18 的 4.0 下调）。
5. **等距伪接触阴影**：等距风格按纪律不开真阴影致楼底「飘」，改给每栋楼底铺 `CircleGeometry` 半透黑贴片接地。
6. **夜景湿润反射恢复**：`PROFILES['night-realistic'].reflect` 恢复 `true`（v2.18 误关，签名特性死代码）；`reflection` opacity 0.85→0.2 / mixStrength 0.6→0.35（克制，v2.18 的 0.51 过强）。
7. **realistic 调参**：material 偏玻璃（roughness 0.35→0.18 / metalness 0.1→0.05 / envMapIntensity 1.0→2.0 + clearcoat 0.9）+ `shadow.radius 4→7` + `sun.elevation 55→38`。

`sky.hdr` 随包发布到 `assets/sky.hdr`（生成器须拷到目标工程 `public/sky.hdr`）。

## v2.18.0（2026-07-25）

「第一次生成零踩坑」修复——首次生成「红梅社区」暴露的问题逐项修在技能源（详细见插件 CHANGELOG `2.24.0`）：

1. **`generate_data.py` mock 闭合括号 bug**：`mockPoiDetails: Record<...> = {}` 末尾误用 `]` 闭合致 TS1136 → 改 `}`（含 POI 的 spec 必触发，每次重跑要手改）。
2. **自定义类别色进 3D**：`ParkScene.categoryToken()` 加 `scaffold.tokens.category` 兜底——`spec.tokens.category.<cat>` 真正进 3D 楼幢上色，无需再手改 6 个 theme 文件。
3. **类型补丁**：`theme.ts` `ThemeTokens.building` 加 `edgeColor?: string`（TS2339）；`useStyle.ts` 再导出 `type StyleKey`（TS2459）。
4. **夜间可见性**：`PROFILES` night-realistic `toneExposure 1.0→1.3`；`buildLights` 兜底环境光光色由 `hemiSky` 改白色（旧版让 ambientFloor 强度形同虚设）；`night-realistic.tokens.json` `ambientFloor 0.22→0.28`、`bgTop/bgBottom` 抬亮、`windows.emissiveIntensity 1.3→1.6`。
5. **围合式园区中央可见性**：`OrbitControls.minPolarAngle 0.5→0.08`（拖到近顶视查看被四周楼栋从斜视角遮挡的中央地面元素）。
6. **脚手架指引**：`SKILL.md`「约定」补三条——独立最小工程 `package.json` 须含 `@types/three`（three 0.169 不自带类型，缺则 TS7016）；`tsconfig.json` 用单文件无 project references（composite+noEmit 致 TS6310）；自定义类别色走 `spec.tokens.category`（v2.18 起进 3D）。

## v2.17.0（2026-07-25）

修复用户反馈的 5 项生成页渲染问题（全部落在范式资产 `assets/park-scene.impl.ts` + tokens + `scripts/validate_spec.py`，未来生成本自带）：

1. **夜景楼幢融入天空看不清**：立体轮廓 `EdgesGeometry` 色解耦——新增可选 token `building.edgeColor`（缺省回退 `dividerColor`），night-realistic 配淡冷月光色 `#a8c0d8`，暗天空下楼幢 silhouette 可辨（旧版用极暗 `dividerColor=#2a3a50` 轮廓与天空同色）。逐层虚线仍用 `dividerColor`、连廊边缘同步走 `edgeColor`。另按 `park-scene-impl.md` 调参建议抬升夜景立面：`night-realistic.tokens.json` 的 `lights.ambientFloor` 0.18→0.22、`sunIntensity` 0.5→0.7。`tokens.schema.json` 登记 `edgeColor`。
2. **只有 night-realistic 有窗户/开关灯**：发光窗流水线门控由 `if (b==='pbr-night')` 扩到 `(pbr-night || emissive || holo)`——`makeFacadeTexture` 的窗户 albedo 分支与 `buildWindowEmissive` 的 emissiveMap+动画同步覆盖全部 4 个深色风格（cyber/holographic/nebula/night-realistic）。给 cyber/holographic/nebula 各加 `windows` token 块（gradient/glassOff/暖冷色 per 风格）。后果（用户已确认）：cyber 由「整栋均匀霓虹蓝自发光」转为「深青蓝渐变墙 + 点亮窗户辉光」（emissive:white 驱动 emissiveMap）；holo/nebula 半透体上叠发光窗、菲涅尔 rim 保留。realistic/isometric 立面像素不变。**发光窗是 emissive、不属于写实引擎**，不破坏「4 风格守纪律」规则。
3. **地面不分内外**：`buildGround()` 外圈城市地面改全透明（`opacity:0`，边界外透出页面背景 →「漂浮园区岛」；市政道路/人行道/闸机是独立 mesh、保留）。园区内地面保证不透明——cyber 网格 shader 地面与 night-realistic `Reflector`（均半透）其下 `y=-0.05` 各加一块 `bx*2×bz*2` 不透明衬底（色取 `environment.city-ground`/`environment.road`），既满足「内不透」、又维持 §14 地下车库坑体被地面遮挡。flat/pbr/dark 本就不透明。
4. **地面车位是一条直线 + 溢出边界**：`buildSurfaceParking` 由单轴循环（`rowX=bx-70` 仅变 Z）重写为**二维网格**——由 `boundary` 反推容量（`cols=floor(2*(bz-70)/stallD)`、`rows=floor(2*(bx-70)/(stallW+laneGap))`，stallW14/stallD26/laneGap8/margin70），`cols` 取 `ceil(sqrt(stalls))` 尽量方阵再被容量封顶，`actualStalls=min(stalls, rows*cols)` 超出自动截断；X 排锚在边界 +X 内侧向内延展、Z 关于中心对称，**必不溢出**（思路同 `building-geometry.ts` 地下车位 `w/cols、d/rows`）。`validate_spec.py` 加车位越界 WARN（超容量提醒自动截断）。
5. **无法 360° 旋转**：经核验范式 OrbitControls（`enableDamping`+极角 `[0.5,π-0.1]`+缩放 `[0.45,2.6]`，无方位角夹紧、`enableRotate` 默认 true、LEFT=ROTATE）**水平 360° 本就支持**。用户确认「能旋转就不调整」——**零代码改动**。若产物不可旋转属拷贝漂移，重新生成本技能产物即恢复。

文档同步：`SKILL.md`（版本+风格表+验证清单）、`references/styles.md`（逐风格窗户/地面）、`references/scene-recipe.md`（§3 地面内外透明、§10 车位二维网格、§15 窗户多风格）、`references/park-scene-impl.md`（纪律澄清+edgeColor+地面透明注记）。

## v2.15.0（2026-07-24）

两条工作流合并升级：写实夜景窗户流水线移植（参照 Park 驾驶舱）+ POI/楼层单位信息 API 标准化。

### Part A — 写实夜景程序化窗户流水线（移植自 Park 驾驶舱 `DigitalTwin.ts`）

旧 v2.14 夜景发光窗是**静态烘焙**：单一 `emissiveMap`、整楼统一 ~42% 点亮、单暖色、无动画、整楼统一窗列数。本次移植 Park 项目成熟流水线到 `night-realistic`（其余 5 风格像素级不变）：

- **逐层窗户宽度/数量**：新增 `windowMetricsTower`（读 `roomsAxisTower`，默认 3 列）+ `floorRoomDividerFracs` 砖错位面板切片，每层 2–5 窗、面板太窄自动过滤（替代旧整楼统一 `cols`）。`roomsAxisPodium`（默认 5 列）已入 schema/`tokens.windows` **预留**，当前 facade 仅绘塔体（schema 自承「预留；当前 facade 仅绘塔体」），裙楼分支后续接入。
- **分层点亮率**：底层 0%（商业/大堂夜间暗）、中层 0.38、顶层 0.22（注意 BoxGeometry `flipY`：canvas 行 0=顶层、行 rows-1=底层）。
- **暖冷双辉光**：70% 暖 `#ffd989` / 30% 冷 `#bfe2ff`，未亮 `#0c2240`；albedo 立面改纵向渐变墙（`gradient.top→bottom`）。
- **开关灯动画**：`animRatio=0.2` 的窗户 dirty-gated 翻转（800ms smoothstep、3–11s 错峰、绝对时钟 `performance.now()` 暂停/恢复不跳相、`prefers-reduced-motion` 关闭保留静态点亮图）。仅重绘 emissiveMap 上动画窗小矩形、仅脏帧 `tex.needsUpdate=true`（空闲零 GL 上传）。
- **双纹理接线**：`map`（albedo 全窗）+ `emissiveMap`（仅亮窗辉光），`emissive:white` 让贴图驱动色；`buildWindowEmissive` 返回 `{tex, anim}`，动画子集入 `facadeAnims`，`animate()` 逐帧 `updateFacade`，`clearSceneGroup` 弃引用、`CanvasTexture` 经 `disposeObject.emissiveMap.dispose()` 释放。
- **token 化**：新增可选 `tokens.windows` 块（schema + night-realistic 主题；缺省走 `DEFAULT_WINDOWS`，`animRatio=0` 退化为静态烘焙=与 v2.14 一致）。确定性（三条独立流，禁用 `Math.random`）：点亮种子 `hashStr('lit:'+salt+id)`、动画子集选择 `hashStr('flip:'+salt+id)`、翻转时序 `hashStr('fliprng:'+salt+id)`。
- **规则改写**：`references/park-scene-impl.md` 的「❌ 不要每帧重算 emissiveMap」改写为——禁止整图全量重烘焙，**允许**对动画子集（≤ animRatio·窗数、reduced-motion 门控）dirty-gated 局部重绘。

### Part B — API 标准化：POI 业务详情 + 楼层单位档案

楼层点击→单位信息**已**走 `getFloorDetail`（含 mock、AbortController 防竞态）；本次补齐 POI 详情标准接口并丰富单位档案（参照 Park `IParkTwinApi`）：

- **`getPoiDetail(park_id?, poi_id)`**：新增 `IDigitalTwinApi` 第 4 个方法（`GET /api/manager/park/poi-detail`，权限 `biz:monitor:query`）。返回 `PoiDetail { title, subtitle?, status, fields:[{label,value}], live?:[{label,value}] }`——通用键值包（静态档案 + 实时指标），后端按 `(type,ref_id)` 分派、业务表零改动。Mock 查 `mockPoiDetails[poi_id]` 表，缺失抛 404。
- **消费接线**：`useTwinData` 增 `poiDetail`/`poiDetailLoading`/`poiDetailError`；`GlobalTwin.vue` watch `sel.openPoiId` → `getPoiDetail({signal})`（onCleanup + AbortController 防快速切点 race）；`PoiOverlay.vue` 优先渲染详情 fields/live 表格，失败降级读列表 inline `tooltip`/`room_spec`/`occupancy`（向后兼容）。详情按 `poi_id === openPoiId` 防串显。
- **单位档案丰富**：`UnitDetail` 加可选叙事块 `subtitle`/`scope`/`intro_title`/`intro_body`/`duties[]`/`closing`（参照 Park `ParkUnit`）；`UnitDetail.vue` 含叙事字段时追加「业务范围/单位介绍/主要职责/结尾语」段落。`generate_data.py` 确定性派生叙事文案（`_narrative_fragment`）+ 产 `mockPoiDetails`（按 type 套 camera/gate/通用档案模板）。
- **保留技能既有更优约定**：`floor_id` 字符串（非 Park 的 0-based int `floor`）、可选 `park_id`、POI `floor_index` 0-based 带符号——不为对齐 Park 而改既有楼层点击链路。GET-only / snake_case / 无分页不变。

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
