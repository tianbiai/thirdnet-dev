# Changelog

## 0.10.0 - 2026-04-28

### Changed
- 移除 Agent（`agents/backend-developer.md`）和 Command（`commands/thirdnet-backend.md`），统一为单工作流技能模式
- 将 Agent 的行为准则、强制执行规则、需求澄清流程、技能调用检查清单合并到 `backend-workflow` 技能
- 将 Command 的执行阶段流程、必须遵循的约定合并到 `backend-workflow` 技能
- 重构 `backend-workflow/SKILL.md` 结构，与前端 `frontend-workflow` 技能保持对齐（工作流步骤概览 → 行为准则 → 执行规则 → 技能路由表 → 需求澄清 → 项目结构检查 → 文档驱动开发 → 开发阶段 → 完成校验）

### Removed
- 删除 `agents/backend-developer.md`
- 删除 `commands/thirdnet-backend.md`

## 0.5.0 - 2026-04-27

### Changed
- 重构命令执行流程：阶段三显式包含 plan.md → changelog.md → spec.md 完整步骤，不再跳过 changelog.md
- 修正文档驱动开发顺序为 plan.md → changelog.md → spec.md（与 Agent 工作流对齐）
- net-microservice-generator 技能新增"强制规则"章节：明确新建项目必须生成三类文档、编码前必须完成服务规格
- Agent 强化文档驱动阻断机制：增加批量服务实现时先创建所有 spec 再编码的规则
- Agent 计划执行工作流增加 spec 存在性检查步骤
- 必调技能清单补充模板生成说明

## 0.4.0 - 2026-04-26

### Changed
- 技能引用从文件路径改为技能名称（子代理无法访问技能目录路径）
- 将 rules/guidelines.md 开发准则直接合并到 Agent 描述中，删除 rules 文件夹
- 项目目录结构简化：`backend/<ServiceName>/` 替代原来的 `backend/{ProjectName}/{ProjectName}.{ServiceName}/`
- hooks.json 中的路径引用同步更新为技能名称

## 0.3.0 - 2026-04-08

### Added
- .NET 10 微服务后端开发助手
- 7 个开发技能：net-microservice-generator、net-api-developer、net-efcore-developer、net-authentication、net-cache-use、net-background-job、net-database-bulkcopy
- 文档驱动开发工作流（plan.md → changelog.md → spec.md → code）
- Hook 支持（Stop 和 PostToolUse）

### Improved
- 优化技能说明和代码示例
