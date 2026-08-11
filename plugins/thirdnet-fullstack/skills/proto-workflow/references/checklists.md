# 同步与合并检查清单

> 何时读：同步 main→.Proto（门 B）/ 合并 .Proto→main（门 C）/ 合并功能分支→main（门 E）/ 同步 .Proto→功能分支（门 F）前后的预检与冲突处理。
> **提交由用户手动执行**——技能不自动 `svn commit`；建原型分支 `svn copy` 经门 A、建原型功能分支 `svn copy` 经门 D 由技能执行，merge 为非提交。

## 合并预检清单（门 B 同步前 / 门 C 合并回前通用）

纪律：合并前两边工作副本都提交到最新；整体合并会把源分支的代码带进目标分支/主干。

- [ ] main 工作副本 `{wcMain}` `svn status` 无输出（已全部提交）
- [ ] 原型分支工作副本 `{wcProto}` `svn status` 无输出（已全部提交）
- [ ] `.Proto` 上废弃实验代码已清理（未被 spec 收录的 `views/` 页面、临时 Mock 数据、console 调试输出、注释死代码、孤儿页面）——双向合并都会保留/带入这些
- [ ] 已与前端协同确认工厂文件（`src/api/modules/**/*.ts`，多端工程如 protohub 含 `manager/`、`app/` 等按端子目录）的合并风险
- [ ] 已确认无他人在另一端并行写同一模块（时序纪律）

预检通过后，触发对应确认门（B 或 C）执行 `svn merge`。

## 功能分支预检清单（门 E 合并主干前 / 门 F 基线回灌前）

并行功能场景专用，在通用预检之上额外确认：

**门 F 前（.Proto → 功能分支）：**
- [ ] `.Proto` 已先经门 B 把最新 main 同步进来（基线要先新鲜，门 F 才能把含已落地功能的基线喂给功能分支）
- [ ] 功能分支工作副本 `{wcProtoFeat}` `svn status` 无输出（已全部提交）
- [ ] 已预警共享脚手架冲突热点：`src/router/index.ts` 路由表、`src/api/modules/index.ts` 工厂注册——多功能都改过，门 F 高发冲突

**门 E 前（功能分支 → main）：**
- [ ] 该功能分支已先经门 F 把最新 `.Proto`（含已落地功能）同步进来、共享脚手架冲突已解决（**跳过则门 E 必撞冲突**）
- [ ] `{wcProtoFeat}` 与 `{wcMain}` 两边 `svn status` 无输出
- [ ] 功能分支上废弃实验代码已清理（整体合并会带进 main）
- [ ] 选择性正确：确认本次只合并目标 `{Project}.Proto.{Feature}`，其它功能分支不被带入

预检通过后，触发对应确认门（F 或 E）执行 `svn merge`。

## 合并冲突处理清单（merge 后，双向通用）

`svn merge` 后在目标工作副本执行 `svn status`，按此清单处理：

- [ ] 记录所有冲突标记 `C` 文件
- [ ] 重点检查工厂文件 `src/api/modules/**/*.ts`（双向高发冲突点）
- [ ] **门 F 额外重点**：共享脚手架 `src/router/index.ts`（路由表）、`src/api/modules/index.ts`（工厂注册）——多功能并行时这些文件被各功能分支同时改动，门 F 必查
- [ ] 逐个冲突文件人工解决（本技能不自动改业务代码）
- [ ] 解决后 `svn status` 确认无残留 `C` 标记
- [ ] 提交由**用户手动执行**（技能给出建议命令、不自动提交）：门 B 后 `svn commit -m "sync: 合并 main 进 {Project}.Proto"`；门 C 后 `svn commit -m "merge: 合并 {Project}.Proto 回 main"`；门 E 后 `svn commit -m "merge: 合并 {Project}.Proto.{Feature} 回 main"`；门 F 后 `svn commit -m "sync: 合并 {Project}.Proto 进 {Project}.Proto.{Feature}"`
