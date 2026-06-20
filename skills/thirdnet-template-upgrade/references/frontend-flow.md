# 前端模板升级流程（create-thirdnet-admin）

> **适用对象**：用 `create-thirdnet-admin` 创建的 Admin 管理后台前端项目（`.template-version.json` 的 `templateIdentity === "ThirdNet.Admin.Frontend"`）。
>
> 本文件只讲**前端专属**的命令、状态分类与判定。共享的安全铁律、`check→diff→apply` 心智模型、回滚预案见 [SKILL.md](../SKILL.md)；冲突决策见 [conflict-resolution](conflict-resolution.md)，边界情况见 [edge-cases](edge-cases.md)。

前端模板升级用 `create-thirdnet-admin` 包内嵌的更新子命令完成（命令入口 `npx create-thirdnet-admin check|diff|apply`），作用与后端 `thirdnet-migrate` 一致——让已生成的项目跟进模板的新版本，且绝不覆盖用户业务代码。

> 若执行中发现工具行为与本文件不符，以工具源码为准（位于内部模板仓库 `code/frontend/create-thirdnet-admin/`，入口 `bin/create.js`、更新逻辑在 `lib/update/`；发布 marketplace 不含 `code/` 目录，故该路径不可从已安装技能解析），并反馈修订。

## 工具与注册表

- **无需安装**：始终用 `npx create-thirdnet-admin <子命令>`，npx 每次自动拉取最新版 CLI 本身（没有 `dotnet tool install` 这一步）。
- **npm 注册表**：默认 Verdaccio 内网 `http://192.168.1.207:4873`（无鉴权）。内网不可达时改用外网 `http://61.164.57.61:14873/`，在命令里用 `--registry` 指定。
- **选项**（更新模式）：`--registry <URL>`、`--version <版本>`（指定目标版本，默认最新）、`--dry-run`（仅 apply，不写盘）、`--force`（仅 apply，强制套用）、`-h/--help`。
- **环境**：Node.js ≥ 18、npm ≥ 9。

## 前端文件 4 态分类

工具把每个模板下发文件分到以下状态之一（由 `lib/update/file-differ.js` 的 `DiffKind` 决定）。`Modified` 再按 `userModified`（用户是否改过）与 `isOverride`（是否品牌 override 文件）两个布尔位细分为三子类：

| 状态 / 子类 | 图标 | 判定 | apply 行为 |
|------|------|------|------|
| `Unchanged` | — | 用户文件 == 新模板 | 跳过 |
| `Added` | 📄 | 新模板有、项目无 | 提示 `[y/N]` 确认后新增（`--force` 自动加） |
| `Modified` — 安全自动 | ✅ | 用户**未**改过（`!userModified`）、非 override | **自动套用** |
| `Modified` — 需确认 | ⚠️ | 用户改过（`userModified`）、非 override | 交互决策（见 Phase 3） |
| `Modified` — 品牌文件 | 🔒 | 属 override 文件（`isOverride`） | **自动跳过**，交你手动集成 |
| `Deleted` | 🗑️ | 旧基线有、新模板已删、用户仍保留 | **仅提示，永不删** |

> **`userModified` 怎么算**：默认走 3-way——工具会下载 `marker.templateVersion`（你当前所用旧版）作基线，`userModified = (你的文件内容 ≠ 旧基线内容)`。若旧版 tgz 在 Verdaccio 上下载失败，降级为 2-way：此时 `userModified` **一律为真**（保守），所有差异都按 ⚠️ 需确认处理（见 [edge-cases](edge-cases.md)）。
>
> **删除检测依赖基线**：没有基线（2-way 模式）时，模板删除的文件**不会被检测**——它们会变成"用户文件不在模板里"而被直接忽略。
>
> **二进制文件**（图片/字体等，扩展名见源码 `BINARY_EXTENSIONS`）：跳过品牌 token 替换，但仍参与对比——内容字节不一致就报 Modified，diff 预览会是乱码，直接 `[a]` 接受模板版即可。

## 升级主流程（Phase 0–5）

所有命令在**前端项目根目录**（含 `.template-version.json`、`package.json` 的目录）执行。

### Phase 0：预检

**0.1 环境与版本**
```bash
node -v   # 期望 ≥ 18
npm -v    # 期望 ≥ 9
```

**0.2 确认 Verdaccio 可达**
```bash
# 内网优先，不可达改外网（浏览器访问对应 /create-thirdnet-admin 确认包存在）
npm view create-thirdnet-admin versions --registry http://192.168.1.207:4873 --json
# 外网：--registry http://61.164.57.61:14873/
```
记录最新版本号 `LATEST`。**前端无离线模式**——Verdaccio 完全不可达就无法升级，只能先恢复网络（无后端 `--nupkg` 等价物）。

> **版本号必须纯数字 `X.Y.Z`**：不要给模板发 `-beta`/`-rc` 等预发布标签——`check` 的版本比较（`compareSemver`）不解析预发布标签，会把 `0.0.10-beta` 与 `0.0.10` 判为相等，导致漏报更新。

> **发版流程**（仅在需发版时）：前端模板发版为 `npm publish` 到 Verdaccio；模板内容用 `create-thirdnet-admin/scripts/sync-template.js` 从 `code/frontend/web/` 同步并注入品牌占位符。

**0.3 VCS 工作区必须干净**
```bash
git status --porcelain   # 必须为空（git 项目）
# 或
svn status               # 必须为空（svn 项目）
```
> 工具自身的 apply 只对脏工作区**发警告**、不阻断；但脏工作区会让一键回滚失效，所以技能仍硬性要求先提交/暂存/还原。

**0.4 记下升级前版本基点**（回滚用）：
```bash
# git
git rev-parse HEAD

# svn（记录当前工作副本基于的 revision）
svn info | grep "Revision"
```

**0.5 读 changelog（决定冲突取舍前）**
阅读本次版本范围的 changelog：前端项目自带 `public/changelog.md`（也可浏览器打开 `public/viewer.html` 看渲染版），重点看自当前 `.template-version.json.templateVersion` 以来的条目。它解释"为什么改、是否破坏性、是否跨端"，直接指导 Phase 3 的 `[a]/[s]` 取舍与 Phase 3.5 的 override 合并策略。`public/changelog.md` 本身是模板下发文件，升级时通常作为 Added/Modified 出现，一般直接接受。

### Phase 1：检查更新（check）

```bash
npx create-thirdnet-admin check
# 外网：npx create-thirdnet-admin check --registry http://61.164.57.61:14873/
```

读懂输出，判定后续：

| `check` 报告 | 含义 | 后续 |
|--------------|------|------|
| `当前已是最新版本` | 已最新 | **结束** |
| `有新版本可用！` | 有更新 | 走 Phase 2 |
| `本地版本高于注册表版本（可能使用了开发版本）` | 用了未发布的开发版 | 通常无需动作；确需对齐发版后再升 |
| `无法连接 npm 注册表` | Verdaccio 不可达 | 恢复网络或换 `--registry` 外网后重试（前端无离线） |
| `当前目录不是 ThirdNet 生成的项目` | 缺失/损坏 `.template-version.json` | 见 [edge-cases](edge-cases.md) |
| `项目模板标识不匹配: 期望 ThirdNet.Admin.Frontend，实际 Y` | marker 存在但 `templateIdentity` 不是前端（如误放了后端项目的标记） | 注意：`check` 不校验 identity，只有 `diff`/`apply` 会因此退出码 1；修正 `.template-version.json` 的 `templateIdentity` |

### Phase 2：预览差异（diff，只读）

```bash
npx create-thirdnet-admin diff
# 指定目标版本：npx create-thirdnet-admin diff --version <LATEST>
```

输出按 5 类分组，**必须完整阅读**：

- 📄 `新增文件`（Added）—— 通常安全，留意是否与你的业务文件重名。
- ✅ `模板更新（安全自动应用）`（Modified · 未改）—— 将自动套用。
- ⚠️ **`已修改（需确认）`**（Modified · 用户改过）—— **逐一记录路径**，进入 Phase 3 逐文件决策；diff 会附前 6 行变更预览。
- 🔒 **`品牌文件（自动跳过，需手动集成）`**（Modified · override）—— **逐一记录路径**，apply 不会动它们，需对照这里附的上游变更预览手动合并（见 Phase 3.5）。
- 🗑️ `模板已删除的文件（不会自动删除）`（Deleted）—— 仅提示，不动。

> **异常冲突强制门**：若 ⚠️ 需确认数量异常多（大量你并未改过的框架文件报冲突），**不要直接 apply**。先排查：
> - `.template-version.json.tokens` 是否存在且含 5 个 key（`PROJECT_NAME`/`BRAND_NAME`/`BRAND_INITIAL`/`BRAND_ABBR`/`API_PROXY_TARGET`）？缺失或为空 → 品牌占位符未替换，几乎所有含品牌文件都会假冲突（[edge-cases F.8](edge-cases.md)）；
> - diff 输出里是否**没有** 🗑️ 删除类、且几乎所有 Modified 都标 ⚠️？是 → 旧版 tgz 被删，降级为 2-way，`userModified` 一律为真（[edge-cases F.2](edge-cases.md)）；
> - 若属上述任一情况，先按 [edge-cases](edge-cases.md) 处理（补全 tokens、换 `--registry`、或接受大量人工判断），再重新 diff。

### Phase 3：应用升级（apply）

**先 dry-run（不写盘）**：
```bash
npx create-thirdnet-admin apply --dry-run
```
确认将要发生的改动符合预期。

**正式 apply（交互式）**：
```bash
npx create-thirdnet-admin apply
```
对每个 ⚠️ `已修改（需确认）` 文件，工具先打印前 30 行 diff，然后提示：
```
[a]应用 [s]跳过 [v]查看完整diff? [s]
```
- `[a]` 应用模板版
- `[s]` 跳过、保留你的版本（默认；业务定制选这个）
- `[v]` 查看完整 diff，随后再 `[a]`/`[s]`

> **前端没有 `[m]` 冲突标记文件、也没有 `.thirdnet.merge`**——这是前端相对后端的一个能力差距。复杂冲突只能 `[s]` 跳过，apply 完成后**在编辑器里手动合并**（参考 Phase 2 的 diff 预览），再回到 Phase 4 验证。

**代为决策时**：严格遵循 [conflict-resolution](conflict-resolution.md)，并在最终报告里记录每个决策与理由。

**`--force` 慎用**：`--force` 会把所有 ⚠️ 需确认文件**当作安全文件自动套用**（等于盲覆盖用户的业务改动），**同时让所有 📄 Added 文件免确认直接添加**。它仅适合"确信所有差异都是纯框架文件、无业务逻辑"的批量场景，且这是前端唯一的"非交互"手段（没有后端的 `--non-interactive`）。业务文件上用 `--force` = 灾难。

### CI 场景（前端）

前端 apply **不适合 CI 自动化**：没有 `--non-interactive`、没有 `.thirdnet.merge` 合并标记、`--force` 等同盲覆盖业务代码。CI 里只跑只读的 `check`/`diff`（发现新版本即通知人工），apply 留给有人值守的本地环境交互完成。

### Phase 3.5：override 品牌文件人工集成（前端特有重点）

这 4 个文件 apply 会自动 🔒 跳过，**必须对照 Phase 2 的 🔒 预览手动合并**——它们承载品牌定制，工具不敢覆盖：

| 文件 | 通常含什么定制 | 升级时要合并什么 |
|------|----------------|------------------|
| `package.json` | 项目名、品牌相关字段 | **依赖版本升级**——这是前端最常见的人工 merge 点：模板可能升了 Element Plus / Vite / Vue / Pinia / Vue Router / Axios 等版本号。把模板新增/升级的依赖同步进你的 `dependencies/devDependencies`，保留你的项目名与业务依赖 |
| `vite.config.ts` | API 代理目标（`--api-target`）、构建配置 | 模板对构建插件/分包/代理的调整 |
| `index.html` | 品牌标题（`<title>`）、favicon、meta | 模板对脚本加载/结构微调 |
| `src/config/brand.ts` | 品牌名、首字母、缩写等常量 | 模板新增/调整的配置项（保留你的品牌值） |

> 合并 `package.json` 依赖后，**必须 `npm install`** 让锁文件与新依赖对齐，再进 Phase 4。

> **override 列表由 CLI 版本硬编码**（`lib/constants.js` 的 `OVERRIDE_FILES`），就是这 4 个文件。改 `.template-version.json` 里的 `overrideFiles` 字段无效——它纯展示。

### Phase 4：验证

```bash
npm install        # 合并了 package.json 依赖后尤其必要
npm run build      # TypeScript 类型检查 + 生产构建，必须通过
```
若构建失败：通常是 Phase 3 `[a]` 套用或 Phase 3.5 手动合并引入的问题（如 API 模块签名变了、类型不匹配）。回到对应文件按 diff 重新核对。

> **加深验证（推荐）**：若本次升级触碰了 `src/api/`、`src/stores/auth.ts`、`src/utils/basicAuth.ts`、`src/mock/`，`npm run build` 通过后**加跑 `npm test`（Vitest）**，并在 mock 模式（`.env` 设 `VITE_MOCK_ENABLED=true`）下过一遍登录 + 系统管理 + API 管理冒烟——签名/权限/路由生成的回归编译期发现不了。
>
> **跨端契约同步**：若后端本次升级改了 `SeedData.cs`（菜单/权限种子），前端的 `mock/data/manager/auth.ts`（mock 菜单树）**必须人工同步**，否则 mock 模式菜单树与真实后端不符。

可选冒烟：
```bash
npm run dev        # 本地启动，过一遍登录、系统管理、API 管理等核心页面
```

再次确认状态：
```bash
npx create-thirdnet-admin check
# 期望：当前已是最新版本
```

**落地核对**：比较本次实际被覆盖/新增的文件数与 Phase 2 diff 预期。若版本标记已前进但磁盘上几乎没有文件变更（或远低于 diff 预期），说明本次 apply 基本在跳过（大量 `[s]`）或 tokens/占位符未正确替换导致假冲突。**这种情况不得收尾**，应退回 Phase 2 重新检查 `tokens`、基线可用性、是否有 2-way 降级，必要时补全 tokens 或换 `--registry`。

### Phase 5：收尾

1. 审阅改动：执行 `git status` / `git diff` 或 `svn status` / `svn diff`，确认所有变更都是预期中的框架升级。
2. 确认 `.template-version.json` 的 `templateVersion` 已前进到新版本（或按工具实际行为确认产物文件已落地）。
3. **不要自动提交**。输出升级报告后，把落库操作交给用户，可建议如下命令：
   ```bash
   # git
   git add -A
   git commit -m "chore: 升级前端模板至 <新版本>"

   # svn
   svn status          # 逐个审阅 M/A/? 标记
   svn add <新增文件>   # 📄 Added 文件需要手动 svn add
   svn commit -m "chore: 升级前端模板至 <新版本>"
   ```
4. 按 [commands-and-report](commands-and-report.md) 的前端模板输出升级报告。

## 前端文件分类决策经验

呼应 [SKILL.md](../SKILL.md) 的安全铁律总则——**框架/基础设施代码以模板为准，业务代码以用户为准**。前端落地的判断：

- **框架资产**（信模板、倾向 `[a]`）：`src/api/`、`src/stores/`、`src/composables/`、`src/layouts/`、`src/router/`、`src/utils/`、`src/directives/`、`src/mock/`、`src/styles/`、`src/components/`。
- **业务代码**（信用户、倾向 `[s]` 或手动合并）：`src/views/` 下你新增的业务页面、以及任何用户自定义。
- **受保护目录**：按 `thirdnet-fullstack:frontend-workflow` 的"模板功能代码保护"规则，`src/views/system`、`src/views/api`、`src/api/modules/manager` 的**业务逻辑**本就不该被改动。若你遵守了这条，这些目录在升级时应是干净的安全自动套用；若曾违反，预期会在 ⚠️ 需确认里见到它们——按业务优先处理。

## 前端相对后端的能力差距（如实知晓）

套用后端流程时，要预期这些落差，不是 bug：

1. **无离线模式**——没有 `--nupkg`，Verdaccio 不可达即无法升级。
2. **无 `.thirdnet.merge` 冲突标记文件**——复杂冲突只能 `[s]` 跳过后手改。
3. **无 `.template-manifest.json` 哈希清单**——只靠下载旧版 tgz 做基线；基线不可用就降级 2-way，此时 `userModified` 全为真、且检测不到模板删除。

## 退出码速查（前端）

| 命令 | 退出码 | 含义 |
|------|--------|------|
| `check` | `0` | 正常（含"已最新"/"有新版"/"本地更高"） |
| `check` | `1` | 非 ThirdNet 项目（无/损坏 `.template-version.json`），或 Verdaccio 不可达 |
| `diff` | `0` | 正常（含"无差异"/"有差异"——**diff 不把"有差异"当错误**） |
| `diff` | `1` | `prepareUpdate` 失败（identity 不匹配 / 下载失败 / 包损坏） |
| `apply` | `0` | 完成（无论是否有 ⚠️ 文件被 `[s]` 跳过） |
| `apply` | `1` | `prepareUpdate` 失败 |

> **退出码 2 在当前实现中不可达**：CLI 设计了 `conflicted > 0 ? 2 : 0`，但交互分支从不产生 conflict 计数（只返回 apply/skip），所以 apply 实际只返回 0 或 1。自动化脚本别依赖退出码 2 判断前端冲突。

## 前端执行 Checklist

- [ ] Phase 0.1 Node ≥ 18 / npm ≥ 9
- [ ] Phase 0.2 Verdaccio 可达，记下 `LATEST`
- [ ] Phase 0.3 `git status` / `svn status` 干净，记下升级前版本基点
- [ ] Phase 0.5 读 changelog（`public/changelog.md` 或 `viewer.html`）
- [ ] Phase 1 `check`，确认有新版本
- [ ] Phase 2 `diff`，读完所有 ⚠️ 需确认 与 🔒 品牌文件；若数量异常多，先排查 tokens/2-way 降级，不直接 apply
- [ ] Phase 3 `apply --dry-run` → `apply`（⚠️ 按 conflict-resolution 决策）
- [ ] Phase 3.5 手动合并 4 个 override 文件（**尤其 package.json 依赖**）→ `npm install`
- [ ] Phase 4 `npm run build` 通过；`check` 报「已是最新」；核对实际套用数与 diff 预期一致（触碰 auth/api/mock 时加跑 `npm test` + mock 冒烟；后端改 SeedData 时同步 mock 菜单树）
- [ ] Phase 5 审阅 + 出报告 + 给出落库建议（不自动提交）
- [ ] 输出升级报告（commands-and-report.md 前端模板）
