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
