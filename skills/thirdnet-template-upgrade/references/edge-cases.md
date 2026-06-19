# 边界情况手册（第 7 章）

> 本文件覆盖非主流程的特殊场景：旧项目无清单/标记过期、离线升级、版本漂移、命名空间与占位符。当 `check`/`diff` 报异常或需离线时读取。

## 7.1 旧项目无清单 / 标记过期 / 标记丢失

**背景**：旧模板（<0.0.24）生成的 `.template-version.json` 可能版本号过期（历史 bug 导致写死旧值，如 0.0.13）；且肯定没有 `.template-manifest.json`。

**两种处理路径，按优先级选**：

### 路径 A（推荐：标记版本可信且旧 nupkg 在服务器）

直接走基线模式：
```bash
thirdnet-migrate diff        # 自动下载标记版本作基线，3-way
thirdnet-migrate apply       # apply 后自动生成清单
```

**判定「标记版本可信」**：diff 输出的 `Conflict`/`UserOnly` 数量合理（不是几十上百个用户「明明没碰过」的文件都报冲突）。若数量异常多 → 标记版本与实际创建版本不符，改走路径 B。

### 路径 B（标记不可信 / 旧 nupkg 不在服务器 / 想以最新模板为干净基线）

```bash
thirdnet-migrate init-manifest      # 以最新模板为基线生成清单（不改业务文件）
thirdnet-migrate diff               # 此后所有「相对最新的差异」都会显式列出
```

**注意**：路径 B 下，项目里所有「与最新模板不同」的文件都会显示为 `UserOnly`/`Conflict`（因为基线=最新）。**这更保守、更安全**（不会被自动覆盖），但人工判断量更大。须耐心逐文件按 [conflict-resolution](conflict-resolution.md) 处理。

## 7.2 离线流程（服务器不可达）

`check` 不支持离线（需查服务器最新版）。离线时跳过 check，用本地模板包：

```bash
# 准备本地模板包（从能联网的机器下载或从发版产物取）
# 文件名须为 ThirdNet.Admin.Template.<版本>.nupkg

thirdnet-migrate diff    -p <项目> --nupkg ./ThirdNet.Admin.Template.<版本>.nupkg
thirdnet-migrate apply   -p <项目> --nupkg ./ThirdNet.Admin.Template.<版本>.nupkg
# 如需 3-way 基线，额外提供旧包：
thirdnet-migrate diff    -p <项目> --nupkg ./新.nupkg --base-nupkg ./旧.nupkg
```
> `--nupkg` 自动从文件名解析版本；`--version` 可显式覆盖。`init-manifest` 同样支持 `--nupkg`。

## 7.3 清单与标记版本漂移（drift）

`check` 报 `清单版本(X)与标记版本(Y)不一致` —— 通常因某次 apply 被中断。处理：
```bash
thirdnet-migrate apply      # 重新跑一次完整 apply，让标记与清单对齐
# 或重建清单：
thirdnet-migrate init-manifest
```

## 7.4 命名空间 / 项目前缀

- Admin 项目 `sourceName` = `ThirdNetVibe`；Service 项目 = `ThirdNetVibe.Service`。
- 工具自动完成 `ThirdNetVibe`→项目前缀（如 `MyCompany`）替换。**不得手动改 `ThirdNetVibe` 引用**——手动改会制造伪冲突。
- 项目前缀由工具从 `.csproj` 文件名推断（如 `MyCompany.Admin.APIService.csproj` → 前缀 `MyCompany`）。若推断失败（非标准命名），用 `-p` 指定正确目录并确保 csproj 命名规范。

## 7.5 `.csproj` 里的版本占位符

`VIBE_COMMON_VERSION` / `VIBE_WEBAPI_VERSION` / `VIBE_COMMON_PACKAGE` / `VIBE_WEBAPI_PACKAGE` 占位符会被工具在比对前替换为当前默认值，**不会因版本号变化误报**。无需关心。

## 7.6 清单 JSON 损坏 → 静默降级基线模式

`.template-manifest.json` 存在但 JSON 解析失败时，工具打印警告并当作无清单处理，**自动降级为基线/2-way 模式**（不再走清单哈希比对）。修复：删除损坏的清单，用 `thirdnet-migrate init-manifest` 以最新模板为基线重建。

## 7.7 基线下载失败 → 2-way 降级（后端）

无清单、走基线模式时，若标记版本对应的旧 nupkg 已不在 NuGet 服务器，工具打印 `ℹ 无法下载基线版本` 并降级为 2-way。此时：
- 所有内容差异都归 `Conflict`（保守：用户改了 + 模板也"改了"）。
- 上游变更段（`UpstreamDiffText`）默认不可用；apply 时 `[v]` 会按需懒加载基线，加载不到则提示用 `--base-nupkg` 提供本地旧包。
- 应对：用 `--base-nupkg` 指定本地旧包恢复 3-way，或走 `init-manifest` 以最新模板为基线。

## 7.8 临时目录

工具在 `%TEMP%` 下创建 `thirdnet-migrate-*` 临时目录，启动时自动清理其中超过 1 小时的（上次崩溃遗留），正常退出清理本次。崩溃残留一般无需手动处理。

---

## 前端边界情况（前端轨道）

> 前端 CLI（`create-thirdnet-admin` 的 check/diff/apply）与后端机制平行但更简，以下是其特有的边界。

### F.1 无离线模式（Verdaccio 完全不可达）

前端**没有** `--nupkg` 等价物。`check`/`diff`/`apply` 都要连 Verdaccio 下载模板 tgz。内网 `192.168.1.207:4873` 不可达时，唯一的办法是换外网 `http://61.164.57.61:14873/`（命令加 `--registry`）或恢复网络。两条路都不通则**无法升级**——这是硬限制，不像后端还能用本地 nupkg 离线迁移。

### F.2 2-way 降级（旧版本 tgz 不在 Verdaccio）

前端默认 3-way：下载你当前所用旧版（`marker.templateVersion`）作基线。若该旧版 tgz 已被从 Verdaccio 删除，工具静默降级为 2-way，带来两个后果：

- **所有 `Modified` 文件的 `userModified` 一律为真** → 全部归入 ⚠️ 需确认（哪怕你其实没改过），人工判断量骤增。
- **检测不到模板删除的文件** → 删除判定依赖基线存在；2-way 下模板删的文件会被当成"用户文件不在模板里"而直接忽略（不提示 🗑️）。

识别降级：diff/apply 里几乎所有差异都标 ⚠️、且看不到 🗑️ 删除类。应对：按 [conflict-resolution](conflict-resolution.md) 耐心逐文件判断，对确实没改过的框架文件放心 `[a]`。

### F.3 `package.json` 依赖版本人工合并

`package.json` 是 override 文件，apply 自动 🔒 跳过。模板若升了 Element Plus / Vite / Vue / Pinia 等依赖版本，**必须手动**把版本号同步进你的 `package.json`，再 `npm install`（详见 [frontend-flow](frontend-flow.md) Phase 3.5）。漏掉这一步会出现"模板已升级但依赖仍旧版"的不一致。

### F.4 版本标记缺失或损坏

项目根没有 `.template-version.json`（或 JSON 解析失败）时，`check`/`diff`/`apply` 都报 `当前目录不是 ThirdNet 生成的项目`。通常是文件被误删或项目并非由 `create-thirdnet-admin` 创建。若确系该工具创建但标记丢了，需要从已知版本手动补一个 `.template-version.json`（含 `templateIdentity: "ThirdNet.Admin.Frontend"`、`templateVersion`、`tokens`、`overrideFiles` 四字段），否则无法升级。

### F.5 本地版本高于注册表版本

`check` 报 `本地版本高于注册表版本（可能使用了开发版本）`：说明你当前 `.template-version.json` 的版本比 Verdaccio 最新版还高（通常是装过未发布的开发版）。此时 `check` 不会建议升级——通常无需动作；确需对齐就等模板正式发版后再升。

### F.6 自动忽略的文件不参与对比

工具会跳过这些，diff/apply 都看不到它们：目录 `node_modules` / `dist` / `.vscode` / `__tests__` / `e2e` / `playwright-report` / `test-results`；文件 `package-lock.json` / `playwright.config.ts` / `.template-version.json`；前缀 `.env.*`（但保留 `.gitignore`）；自动生成文件 `auto-imports.d.ts` / `components.d.ts`。所以本地依赖、锁文件、环境文件不会被升级改动——这是预期行为。

### F.7 品牌 token / 占位符不得手改

`__BRAND_NAME__` / `__BRAND_INITIAL__` / `__BRAND_ABBR__` / `__PROJECT_NAME__` / `__API_PROXY_TARGET__` 占位符由工具在比对前用 `.template-version.json.tokens` 自动替换（与后端的 `ThirdNetVibe`→项目前缀同理）。**不要手改这些占位符或 `.template-version.json.tokens`**——手动改会让干净的安全更新变成假的需确认项（伪冲突）。

### F.8 `.template-version.json.tokens` 缺失或为空

升级时 token 替换取自 `marker.tokens`。若该字段缺失或为 `{}`（如手动构造 marker 时漏填），模板里的 `__BRAND_NAME__` 等占位符**不会被替换**、原样进 reference 目录，与你的项目（已替换为真实品牌值）逐字对比 → **大量假 ⚠️ 需确认冲突**（几乎每个含品牌的文件都报）。恢复：补全 `tokens` 的 5 个 key（`PROJECT_NAME`/`BRAND_NAME`/`BRAND_INITIAL`/`BRAND_ABBR`/`API_PROXY_TARGET`）。

### F.9 Verdaccio 半挂（无超时 / 无重试）

CLI 下载 tgz 时**没有超时、没有重试**（`package-resolver` 用原生 http）。若 Verdaccio 半挂——TCP 连得上但不下发数据——CLI 会**无限等待**，需手动 Ctrl+C 中断，换 `--registry` 外网或恢复服务器后重试。瞬时网络抖动也会直接失败（无重试），重跑一次即可。

### F.10 check 通过 ≠ diff/apply 可用

`check` 只读 `.template-version.json`（不校验 `templateIdentity`）、不下载模板；`diff`/`apply` 才校验 identity 并下载。所以 check 报"有新版本"不保证 diff 一定能跑——若 identity 字段被改错、或 check 之后该版本从 Verdaccio 被删，diff/apply 会退出码 1。

> 顺带：`--dry-run`/`--force` 传给 `check`/`diff` 会被解析但**静默忽略**（不报错），只有 `apply` 真正读取它们。

> 解压依赖内置 `tar` npm 包；若安装环境依赖损坏且系统无 `tar` 命令（部分精简 Windows），解压会失败。
