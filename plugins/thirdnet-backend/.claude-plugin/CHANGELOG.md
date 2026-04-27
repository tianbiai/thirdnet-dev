# Changelog

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
