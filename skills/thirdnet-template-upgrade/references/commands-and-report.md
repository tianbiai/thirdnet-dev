# 速查命令表与升级报告格式（第 10–11 章）

> 本文件用于两条收尾用途：执行过程中**查命令速查**、Phase 5 完成后**输出升级报告**。

## 第 11 章 速查命令表

| 目的 | 命令 |
|------|------|
| 看是否最新 + 清单状态 | `thirdnet-migrate check` |
| 预览差异（只读） | `thirdnet-migrate diff` |
| 预览到指定版本 | `thirdnet-migrate diff -v <版本>` |
| 离线预览 | `thirdnet-migrate diff --nupkg <包> [--base-nupkg <旧包>]` |
| 先 dry-run | `thirdnet-migrate apply --dry-run` |
| 正式应用（交互） | `thirdnet-migrate apply` |
| 非交互（CI） | `thirdnet-migrate apply --non-interactive`（退出码 2=有未决冲突） |
| 强制套用（**慎用**） | `thirdnet-migrate apply --force`（仅纯框架文件） |
| 生成/重建清单 | `thirdnet-migrate init-manifest` |
| 帮助 | `thirdnet-migrate help` |

### 前端速查命令表（create-thirdnet-admin）

> 无需安装，始终用 `npx`；默认注册表 Verdaccio 内网 `http://192.168.1.207:4873`，外网 `http://61.164.57.61:14873/`（用 `--registry` 指定）。**无离线模式、无 `--non-interactive`**。

| 目的 | 命令 |
|------|------|
| 看是否最新 | `npx create-thirdnet-admin check` |
| 查指定注册表 | `npx create-thirdnet-admin check --registry http://61.164.57.61:14873/` |
| 预览差异（只读） | `npx create-thirdnet-admin diff` |
| 预览到指定版本 | `npx create-thirdnet-admin diff --version <版本>` |
| 先 dry-run | `npx create-thirdnet-admin apply --dry-run` |
| 正式应用（交互） | `npx create-thirdnet-admin apply`（⚠️ 文件 `[a]应用 [s]跳过 [v]查看完整diff`） |
| 强制套用（**慎用**） | `npx create-thirdnet-admin apply --force`（业务文件上禁用） |
| 帮助 | `npx create-thirdnet-admin <子命令> -h` |

> **退出码语义**：后端见 [backend-flow 的「退出码速查」](backend-flow.md#退出码速查后端)（`0/1/2`，apply 有未决冲突返回 2）；前端见 [frontend-flow 的「退出码速查」](frontend-flow.md#退出码速查前端)（`0/1`，退出码 2 实际不可达）。

## 第 10 章 升级报告格式（完成后必须输出）

升级收尾时，按以下模板输出报告。报告的价值是留下**可追溯的决策记录**——尤其每个 Conflict 文件的最终决策与理由，方便事后审计或回滚定位。

```
# 模板升级报告

- 项目：<路径>
- 模板类型：ThirdNet.Admin.Template / ThirdNet.Service.Template
- 升级前版本：<X> → 升级后版本：<Y>
- 模式：清单模式 / 基线模式 / 离线
- 编译验证：dotnet build 通过 / 失败（原因）

## 变更汇总
- 🔄 自动套用（UpstreamOnly）：<N> 个
- 📄 新增（Added）：<N> 个
- 🔒 保留（UserOnly）：<N> 个
- 🗑️ 模板已删除（提示，未删）：<N> 个
- ⚠️ 冲突（Conflict）：<N> 个

## 冲突文件决策明细
| 文件 | 工具建议 | 最终决策 | 理由 |
|------|----------|----------|------|
| Admin/.../Startup.cs | 手动编辑 | [m] 合并 | 保留业务注册，吸收框架 DI |
| ... | ... | ... | ... |

## 框架库版本同步
- ThirdNet.Vibe.Common：<旧> → <新>（如适用）
- ThirdNet.Vibe.WebAPI：<旧> → <新>（如适用）

## 待人工跟进
- （列出 [e] 稍后决定、或需用户确认的项）
```

### 前端升级报告格式

前端轨道把「编译验证」改为 `npm run build`，并用「依赖人工合并」替代后端的「框架库版本同步」小节：

```
# 前端模板升级报告

- 项目：<路径>
- 模板类型：ThirdNet.Admin.Frontend
- 升级前版本：<X> → 升级后版本：<Y>
- 模式：3-way / 2-way（基线降级）
- 构建验证：npm run build 通过 / 失败（原因）

## 变更汇总
- ✅ 安全自动应用（Modified · 未改）：<N> 个
- 📄 新增（Added）：<N> 个
- ⚠️ 已修改（需确认）：<N> 个
- 🔒 品牌文件（自动跳过、已手动集成）：<N> 个
- 🗑️ 模板已删除（提示，未删）：<N> 个（2-way 模式下可能为 0，因检测不到删除）

## 需确认文件决策明细
| 文件 | 最终决策 | 理由 |
|------|----------|------|
| src/api/xxx.ts | [a] 应用 | 框架资产，信模板 |
| src/views/xxx/index.vue | [s] 跳过 + 手动合并 | 业务页面，保留定制并叠加模板改动 |
| ... | ... | ... |

## 依赖人工合并（override 文件）
- package.json：Element Plus <旧>→<新>、Vite <旧>→<新>（已 npm install）
- vite.config.ts / index.html / src/config/brand.ts：已对照 diff 合并（说明每项）

## 待人工跟进
- （列出 [s] 跳过后尚未手动合并、或需用户确认的项）
```
