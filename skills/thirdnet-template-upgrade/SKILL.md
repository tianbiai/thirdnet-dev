---
name: thirdnet-template-upgrade
description: Upgrade existing ThirdNet-based projects (.NET Admin/Service backends and Vue frontends) to the latest template version — refresh the upgrade tools, detect what changed, apply non-conflicting updates automatically, and resolve real conflicts via AI semantic 3-way merge. Use this whenever the user wants to pull template/scaffold updates into an already-generated project, sync bugfixes or structural changes from a newer ThirdNet release, "升级/更新/同步模板", migrate a template project, or fix conflicts between their customizations and template changes — even if they don't name the tool. Also use it right after a new ThirdNet package ships and the user wants existing projects to follow. Covers both `thirdnet-migrate` (backend dotnet tool) and `create-thirdnet-admin` (frontend npx).
---

# ThirdNet 模板升级（前后端统一）

把用 ThirdNet 模板生成的旧项目，升级到模板的最新版本——包括装/升级工具本身、对比变更、套用非冲突更新、用 AI 语义合并真正的冲突文件。

## 何时用

- 用户想把已有 ThirdNet 项目（后端 Admin/Service 或前端）跟进到模板新版
- 新版 ThirdNet 包发布后，用户想让老项目跟着升级
- 用户改动与模板变更出现冲突，需要调和
- 用户说"升级/更新/同步模板""模板出新版了""migrate template"等

## 心智模型（先建立这个，流程才说得通）

- **模板是"活的"，项目是"快照"**：模板持续修 bug / 改结构，但用模板生成的项目是一次性的，不会自动跟进——本技能就是把这个"跟进"做成安全、可回退的流程。
- **文件分 6 态**，工具会自动归类（详见 `references/commands.md`）：
  - `UpstreamOnly` 🔄 —— 你没动过、模板改了 → 工具**自动套用**
  - `UserOnly` 🔒 —— 你改过、模板没动 → **原样保留**（你的业务代码安全）
  - `Conflict` ⚠️ —— 两边都改了 → **需要决策**，交给 AI 合并
  - `Added` / `Deleted` / `Unchanged` —— 模板新增 / 模板已删（永不删你的）/ 无变化
- **确定性边界（关键）**：工具负责找冲突、准备 3-way、备份、哈希校验、落盘、推进版本；**AI 只负责"冲突文件这一处该听用户的还是听模板的"这一步语义裁决**。不要让 AI 去手动备份、手改项目文件、自己推进版本——工具已经把这些做对、做安全了。

## 私有 registry 地址

下面所有命令默认用**内网**地址；内网不通时换**外网**——同一服务，二选一。

| 仓库 | 内网（优先） | 外网（内网不通时） |
|---|---|---|
| NuGet（后端） | `http://192.168.1.156:8088/nuget` | `http://61.164.57.61:8088/nuget` |
| npm（前端） | `http://192.168.1.207:4873/` | `http://61.164.57.61:14873/`（端口 **14873**，非 4873） |

---

## 完整流程

### Phase 0 — 先升级工具本身

用户点名要"卸载老的装最新"。先确保用的是最新版工具，否则流程里查到的是旧模板。

**后端（dotnet 全局工具）**——在任意目录：

```bash
dotnet tool uninstall -g ThirdNet.Migrate
# 内网源（优先）；内网不通则把 --add-source 换成 http://61.164.57.61:8088/nuget
dotnet tool install -g ThirdNet.Migrate --add-source http://192.168.1.156:8088/nuget
# 验证版本：
dotnet tool list -g | grep -i migrate
```

更轻的等价做法：`dotnet tool update -g ThirdNet.Migrate --add-source <内网或外网源>`（内/外网二选一）。

**前端（npx，无持久安装）**——`npx create-thirdnet-admin@latest <cmd>` 每次从 registry 拉最新。
- registry 默认内网 `http://192.168.1.207:4873/`；外网用 `--registry http://61.164.57.61:14873/`，或改项目 `.npmrc`。
- 若曾 `npm i -g create-thirdnet-admin`，先 `npm uninstall -g create-thirdnet-admin` 清掉全局旧版，避免 npx 命中缓存。
- 前端升级子命令**必须在前端项目目录内**运行（该目录 `.npmrc` 指向私有 registry）。

### Phase 1 — 检测 + 对比（在要升级的项目目录内）

```bash
# 后端（cd 进 .slnx 所在的项目根）
thirdnet-migrate check     # 查最新版 + 当前清单状态
thirdnet-migrate diff      # 预览差异，按 6 态分组 + 每个文件的建议

# 前端（cd 进前端项目根）
npx create-thirdnet-admin@latest check
npx create-thirdnet-admin@latest diff
```

**边缘情况**：后端若报缺 `.template-manifest.json`（项目早于清单机制），先跑一次 `thirdnet-migrate init-manifest` 生成清单（不动业务文件），再继续。

### Phase 2 — 套用非冲突更新

```bash
thirdnet-migrate apply                          # 后端，交互式逐文件确认
thirdnet-migrate apply --non-interactive        # 非交互：UpstreamOnly 套用、UserOnly 保留、Conflict 保留并退出码 2
# 前端同理：npx create-thirdnet-admin@latest apply [--dry-run|--force]
```

`apply` 会自动套用 `UpstreamOnly`、保留 `UserOnly`。**`Conflict` 文件不会被 apply 触碰**——这些就是 Phase 3 要处理的对象。`--dry-run` 先预览，`--force` 强制覆盖你的改动（会先备份，慎用）。

### Phase 3 — 用 AI 合并冲突（核心）

对真正两边都改过的文件，做语义 3-way 合并：

```bash
# 1) 导出冲突文件的工作目录（base/mine/theirs + meta）
thirdnet-migrate export-merge -o ./.tw          # 后端
npx create-thirdnet-admin@latest export-merge -o ./.tw   # 前端
#   前端想连 package.json 等品牌文件一起合并，加 --include-override

# 2) Claude 充当合并器：逐个 unit 写 merged（或 declined）—— 见下方协议

# 3) 安全落盘
thirdnet-migrate import-merge -i ./.tw          # 后端：备份→写入→推进版本→重算清单
npx create-thirdnet-admin@latest import-merge -i ./.tw   # 前端
#   全部已决且无陈旧/放弃时，加 --purge 清理工作目录（默认保留作审计）
```

**备选（批量/无人值守）**：用 headless 脚本逐文件调 Claude API（工作目录格式两端一致，后端导出的也能用）：

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # 绝不作 CLI 参数
npx create-thirdnet-admin@latest merge-workdir ./.tw   # 退出码 0=全决 / 2=有放弃 / 1=致命错误
```

---

## Claude 合并协议（Phase 3 你亲自合并时按这个来）

这是本技能的核心。当你（Claude）作为合并器，对 `.tw/units/*/` 里的每个 unit 操作：

1. **读上下文**：先读 `.tw/manifest.json`（tool / mode / templateIdentity / targetTemplateVersion），再列出 `.tw/units/` 下所有 unit 目录。

2. **逐 unit 处理**，每个先读它的 `meta.json`。

3. **跳过规则**（写一个空 `declined` 文件，不自己合并）：
   - `meta.isBinary === true` → 二进制，放弃
   - `meta.role === "brand"` → 品牌文件（package.json / brand.ts / index.html 等），交回人工
   - 该 unit 已有 `merged` 或 `declined` → 跳过（幂等，支持断点续做）

4. **读三份内容**：`base`（仅 `3-way` 模式有，共同祖先）/ `mine`（用户当前）/ `theirs`（新模板）。按**角色信任矩阵**裁决每一处：

   | role | 信任倾向 | 含义 |
   |---|---|---|
   | `framework` / `config` / `infra` | 信 **THEIRS** | 吸收模板的 bugfix 与结构调整 |
   | `business` | 信 **MINE** | 保留用户的业务逻辑、自定义、注释 |
   | `unknown` | 当 `business`（保守） | 优先保留用户改动 |
   | `brand` | **DECLINED** | （上方已跳过） |

5. **产出 `merged`**——把合并后的**完整文件内容**写入 unit 目录的 `merged` 文件：
   - **只写完整文件内容本身**，不要解释、前言、"以下是合并结果"、代码围栏（```）
   - 保留原文件的缩进、换行风格、编码
   - 只调和真正冲突的区域；不要重排或重格式化无关代码

6. **DECLINED 纪律**——拿不准时写一个空 `declined` 文件（不写 `merged`），把该文件交回人工：
   - `mine` 与 `theirs` 在**同一处**做了真正冲突的编辑，且你没有 >90% 把握 → DECLINED
   - `meta.mode === "2-way"`（无 BASE 共同祖先）→ 更保守，任何拿不准的块都 DECLINED

7. **收尾**：所有 unit 处理完，运行 `import-merge -i ./.tw`。

完整规范（工作目录格式、`meta.json` 全字段、角色分类规则、与 `merge-workdir.js` 提示词对齐的权威版本）见 `references/merge-protocol.md`。

## 工具的安全保证（知道这些，就不必反复猜疑）

- `import-merge` 覆盖前自动备份到 `.thirdnet-backup/<时间戳>/`，可回退
- **陈旧检查**：导出时记录 `mineHash`，导入时重算磁盘哈希；不一致（导出后文件又被改）→ 该 unit 报 `stale`、**不覆盖、不推进版本**
- 版本标记**仅在 `applied > 0` 时推进**
- `UserOnly` 文件**永不进工作目录**——你的纯业务代码零风险
- 工具**永不删文件**（`Deleted` 态只提示，不动手）

所以你（Claude）的唯一职责是产出正确的 `merged`（或 `declined`）。不要手动备份、不要手改项目文件、不要自己改版本号——交给工具。

## 验证升级成功

```bash
# 后端
thirdnet-migrate check                 # 应显示已是最新 / 无冲突
dotnet build                           # 编译通过
dotnet test                            # 测试通过

# 前端
npx create-thirdnet-admin@latest check
npm run build                          # vue-tsc + vite 构建通过
npm test                               # Vitest 通过
```

## 深入参考

- 完整命令、flag、6 态详解、离线模式 → `references/commands.md`
- 合并协议权威规范、工作目录格式、角色矩阵、DECLINED 全规则 → `references/merge-protocol.md`
- 设计原文 → `docs/ai-template-merge.md`
- 权威实现：后端 `backend/Template/ThirdNet.Migrate/`（`Services/WorkDirWriter.cs` / `WorkDirReader.cs`）、前端 `frontend/create-thirdnet-admin/scripts/merge-workdir.js`
