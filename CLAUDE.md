# Thirdnet Plugins - Claude Code 插件集合

本项目是为 Claude Code 开发的全栈开发插件集合，提供后端（.NET 微服务）和前端（Vue 3）的专业开发辅助。

## 项目结构

```
thirdnet-dev/
├── plugins/
│   └── thirdnet-fullstack/        # 全栈开发插件（自包含）(v2.22.0)：后端 .NET 微服务 + 前端 Vue 3 + 数字孪生 + 全栈协调 + 全栈审查 + 项目文档生成 + 模板升级 + Markdown 转 Word（全部技能内聚于此）
└── .claude-plugin/
    └── marketplace.json      # 插件集合注册清单 (v0.57.0)
```

## 核心约定

### 文档驱动开发

本插件强制执行文档驱动开发流程：

```
需求分析 → 生成 plan.md → 生成 changelog.md → 生成 spec.md → 编码 → 校验 + 同步更新文档
```

所有功能变更必须同步更新文档——**文档完整性 Stop Hook（后端文档门 + 前端文档门，共两个）** 会在文档未更新时阻断完成。另有**全栈质量收尾门 Stop Hook**：检测到功能性代码变更（后端 `*.cs` 或前端 `*.vue`/`*.ts`）未通过 `fullstack-review` 审查、或仍有 Critical/Major 问题时，阻断会话结束。合计**三个 Stop Hook**。

### 技能体系

`thirdnet-fullstack` 插件通过 `skills/` 目录组织全部领域知识（共 25 个技能）：

- **后端（8 个）**：微服务生成、API 开发、EF Core（含批量操作）、认证授权、缓存、后台任务、枚举字典、后端工作流
- **前端（11 个）**：Vue 3 最佳实践、设计规范、API TypeScript 规范、Admin 模板安装、前端工作流、Pinia、Router、JSX、Composable 设计、Apple 设计规范、枚举字典规范（vue-enum-dict）
- **数字孪生（1 个）**：`thirdnet-digital-twin`（v2.14.0）——园区数字孪生 3D 模块生成（Vue 3 + Three.js，1920×1080 舞台 + 楼栋切换器 + POI 打点 + **地下车库多层剖面**，6 种视觉风格（cyber/holographic/isometric/nebula/realistic/night-realistic））；数据分层：基础信息静态内联（含地下车库 `garages[]` 几何+占用），动态数据（楼幢名/楼层数/楼层详情/POI 点位）走 `IDigitalTwinApi` 契约层（Mock/Real 工厂，`VITE_MOCK_ENABLED` 切换）；随包发布完整范式实现 `assets/park-scene.impl.ts` + `building-geometry.ts` + 14 个 2D 组件范式文件（`assets/components/` 含 v2.12 新增 `StyleSwitcher.vue`）+ 6 个 API 契约层模板（`assets/api/`），生成器「拷贝-改」消灭渲染管线/组件 CSS/契约层漂移；3 个生成脚本（generate_data.py 脚手架+Mock 数据、generate_theme.py token→tokens.css 含 `--brand` 品牌色派生、layout_park.py 自动不重叠布局）+ validate_spec.py 校验（含楼栋出界/重叠/POI 越界 FAIL、spec.tokens 覆盖白名单 WARN）；v2.5 恢复写实两风格（realistic/night-realistic）并以提交 token 文件激活内置写实引擎（RoomEnvironment 环境贴图 + GTAO + 2048² 软阴影 + Reflector 湿润反射 + 雾 + 强 bloom + 夜间发光窗），强化共享几何（真实窗户立面/升级车辆/树冠/楼顶设备），修复失效旋钮（ao.radius/reflection.mixStrength/shadow），5 文件契约层 4 个静态样板固化为可拷贝模板；v2.6 新增地下场景（顶层 `garages[]` 负层坑体，Y<0 透明玻璃柱 + `setBelowView` 相机俯冲 + `GarageCard` + `underground` token，支持 B1/B2 多层堆叠）；v2.7 通用化——放开楼栋 `category` 与 POI `type` 枚举（自定义类别/类型，garage 可多栋多入口）、新增 `spec.unitTemplate` 定制非办公园区（工业/物流/住宅）单位字段与租户池（办公为默认、向后兼容）；v2.8 解锁 `corridor`（楼栋间空中连廊）+ 清引擎 v2.4 遗留 `wire/white` 不可达分支等死代码 + 文档全面对齐 6 风格 / 13 组件事实；v2.9 连廊跨层（`corridor.floorEnd`）+ 连体楼 `connects` 豁免间距校验 + 修 typecheck bug；v2.10 地下坑体加深（`deck_y` 推荐 120→200 + 偏浅 `<160` WARN + 范例 B2 反向 bug 修正）+ 相机解锁地下俯仰（`defaultMaxPolar` 1.3→π-0.1，可拖到地面之下仰视看坑）；v2.11 地下坑体推荐默认回调（`deck_y` 200→140 + 偏浅 WARN 阈值 <160→<140 + 兜底常量/文档/范例 fixture 同步 + 顺手清理 industrial.json 漏改的 120）；v2.12 建筑平面图与多风格预览支持——schema 扩 `poi.roomSpec`（area/capacity/dept/duty 结构化字段）+ 顶层 `previewStyles?`（多风格实时切换清单）+ 新增 `StyleSwitcher.vue` + `useStyle.ts` 范式文件 + 政府/政务园区 token 调色指引与 `government-complex.json` 夹具；v2.14 移除园区外围墙特性（删 `buildSurrounding` 围墙渲染块 + `environment.surrounding.wall` schema + 6 风格 `environment.wall` token，地下车库玻璃壁 `underground.wall` 保留）
- **全栈协调（1 个）**：`thirdnet-fullstack` 协调技能——前端先行开发顺序、Admin CRUD 页面模式、前后端类型映射、RBAC 桥接、子代理调度
- **质量保障（1 个）**：`fullstack-review`——功能开发完成后的全栈代码审查与验证（前后端规范、API、数据库、跨端契约、业务正确性、性能、安全、文档），产出审查报告与修改方案
- **文档交付（1 个）**：`thirdnet-doc-generator`——功能开发完成后基于代码库功能模块生成项目交付文档（需求规格说明书、系统设计文档、用户手册、测试用例文档等，每类有专属模板，输出 Markdown 可转 Word）
- **模板升级（1 个）**：`thirdnet-template-upgrade`——前后端模板升级操作指南（thirdnet-migrate / create-thirdnet-admin），工具出 diff 素材、AI 全量判定并直接升级文件
- **工具（1 个）**：`md-to-word`——Markdown 转 Word（.docx）转换工具技能

## 插件说明

### thirdnet-fullstack

ThirdNet 全栈 Admin 开发插件（自包含），是前后端开发技能的唯一来源。技术栈：

- **后端**：.NET 10 + PostgreSQL + EF Core；ThirdNet.Vibe 框架（自定义模板）；Redis 缓存 + JWT（国密）认证；仅允许 GET/POST 方法（网关限制）
- **前端**：Vue 3 + Element Plus + Vite（Web 端）；uniapp + Vant（移动端，发布为微信小程序 mp-weixin）
- **全栈协调**：前端先行、Admin CRUD 页面模式、前后端类型映射、RBAC 权限桥接、共享 API 约定同步；含 `backend-developer` / `frontend-developer` 两个子代理隔离重型阶段

**使用方式**：全栈场景由 `thirdnet-fullstack` 协调技能进入（可派发子代理）；纯后端/纯前端单侧任务直接用 `backend-workflow` / `frontend-workflow` 技能。技能可被 PreToolUse 钩子按编辑的文件类型自动触发，或用 Skill 工具手动调用。

## 开发注意事项

- 所有文档和 commit message 使用中文
- 插件内的技能（skills/）和钩子（hooks/）定义了具体的开发规范
- 修改插件内容后，注意同步更新版本号：插件 `plugin.json`、协调技能 `SKILL.md` 的 `metadata.version`、`marketplace.json` 中对应条目三处须保持一致
