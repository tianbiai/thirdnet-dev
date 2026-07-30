# 三环境发布参数与 release 备注模板

> 何时读：生成发布清单（阶段 1 原型 / 阶段 3 测试 / 阶段 5 正式）时。
> 权威源：《代码发布管理-原型驱动流程.md》§2 / §6.4。
> **本技能不触发 Jenkins / Octopus**，只生成下方参数清单供人在 Jenkins / Octopus 执行。

## 三环境构建参数矩阵

| 环境 | 来源分支 | `VITE_MOCK_ENABLED` | Mock 剥离 | 后端状态 |
|---|---|---|---|---|
| 原型服务器 | `Park-PT{r_base}` | `true` | 否（保留 Mock） | 不强依赖（可缺省） |
| 测试服务器 | 主干 `Park` | `false` | 是 | 真实 |
| 正式服务器 | 主干 `Park`（或发布分支） | `false` | 是 | 真实 |

> 预发布服务器：暂不实现，不在清单生成范围内。

## 固化规则（源文档 §6.4）

为避免人工误填，Jenkins 任务参数必须固化：

- **原型构建任务**：固定 `VITE_MOCK_ENABLED=true`。
- **测试 / 正式构建任务**：固定 `VITE_MOCK_ENABLED=false`。

本技能生成的清单必须按上表填好，不得留空让用户手填 `VITE_MOCK_ENABLED`。

## 发布清单模板

### 阶段 1 ｜ 原型服务器发布清单

```
【原型服务器发布】迭代N（{模块清单}）
- Jenkins 任务：原型构建任务
- 分支：Park-PT{r_base}
- 构建参数：VITE_MOCK_ENABLED=true
- 目标：原型服务器
- 用途：产品/客户功能原型评审
- Octopus：记录该 release 对应的 svn 分支与版本
```

### 阶段 3 ｜ 测试服务器发布清单

```
【测试服务器发布】迭代N（{模块清单}）
- Jenkins 任务：主干构建任务
- 分支：主干 Park
- 构建参数：VITE_MOCK_ENABLED=false（+ Mock 剥离）
- 目标：测试服务器
- 后端：真实实现（{已补 Real 的模块}）
- 备注：测试以原型服务器为功能验收基线，对照验证真实实现
```

### 阶段 5 ｜ 正式服务器发布清单

```
【正式服务器发布】迭代N
- Jenkins 任务：主干构建任务
- 分支：主干 Park（或发布分支）
- 构建参数：VITE_MOCK_ENABLED=false（+ Mock 剥离）
- 目标：正式服务器
- Octopus release 备注：
  - 版本：迭代N
  - 含模块：{模块清单}
  - 来源：svn 主干 revision r{xxx}
```

## release 备注（供 Octopus 填写）

正式发布时，Octopus 需标记 release。备注应包含：

- 版本号（迭代N / v1.x）
- 本次包含的功能模块清单
- svn 来源（主干 revision 号，或发布分支名）
- 是否含 DB schema 变更（如有，附运维知会记录）

## 发布前置项检查（生成测试/正式清单时提醒）

源文档 §6 列出流程落地的技术前提，本技能只提醒、不代为实施：

- [ ] **minigram Mock 剥离**：`frontend/minigram/vite.config.ts` 已有等价 `mockDataStripPlugin`（参照 web 端 `frontend/web/vite.config.ts` 的 `mockDataStripPlugin`）。缺失则小程序测试/正式构建会包含 Mock 代码。
- [ ] **后端多环境配置**：`appsettings.Staging.json` / `appsettings.Production.json` 齐全（Admin 与 Park 两个 API 均需）；`ASPNETCORE_ENVIRONMENT` 注入方式明确。
- [ ] **web 真实签名注入**：`VITE_BASIC_AUTH_APP` / `VITE_BASIC_AUTH_KEY` 的测试/正式注入方式（Jenkins 凭据 / 构建参数）已明确。
- [ ] **Jenkins 参数化**：原型任务固定 `true`、测试/正式任务固定 `false`。

## minigram 发布节奏提醒

小程序多一道微信审核，与 web 同流程但发布周期不同（源文档 §8.5）。生成 minigram 的发布清单时，额外提醒：

> ⚠️ 小程序发布需过微信审核，周期长于 web。请将小程序发布计划与 web 错开，提前提交审核。
