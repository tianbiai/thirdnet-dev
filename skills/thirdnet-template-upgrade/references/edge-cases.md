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
