# Changelog

## 0.14.0 - 2026-06-07

### Added
- 新增强制规则：**API 必须返回 DTO，禁止直接返回数据库实体**。Controller 层禁止直接返回 EF Core Entity，必须由 Service 层或映射层将 Entity 转换为 DTO（`XXXResponse`）后再返回。原因：Entity 包含敏感字段（`password_hash` 等）和 `navigation properties`，直接序列化会泄露敏感数据并产生循环引用。
- 新增强制规则：**DTO 命名规范统一**。请求对象必须以 `Request` 结尾（如 `UserCreateRequest`），响应对象必须以 `Response` 结尾（如 `UserResponse`），**完全禁止 `Dto` 后缀**。已使用 `Dto` 后缀的存量类不在本次整改范围。

### Changed
- `net-api-developer` 技能升级至 1.1.0：
  - 修订"返回类型规范"措辞：API 默认返回 DTO JSON，不再默认返回实体
  - "禁止匿名对象返回"表格删除"直接返回实体"允许行
  - 新增章节"禁止直接返回数据库实体模型（强制要求）"，含原因、允许/禁止表、正确/错误示例
  - DTO 命名规范表删除 `{Entity}Dto` 选项
  - 代码审查清单新增"返回 DTO 而非 Entity"检查项
- `net-cache-use` 技能冲突示例修复：Controller 示例中的 `DepartmentModel` 返回类型改为 `DepartmentResponse`；`CreateDepartmentRequest` / `UpdateDepartmentRequest` 重命名为 `DepartmentCreateRequest` / `DepartmentUpdateRequest`（与 `net-api-developer` 规范对齐）
- `net-database-bulkcopy` 技能冲突示例修复：Excel 导入示例的入参类型 `UserImportDto` 重命名为 `UserImportRequest`

## 0.11.0 - 2026-05-17

### Added
- 新增 `net-crypto-keygen` 密钥生成技能（SM2/RSA/AES/SM4），输出可直接粘贴到 appsettings.json 的 JSON 配置片段
- Stop Hook 新增注释完整性检查：模型、控制器、枚举、Fluent API 配置需 XML doc comments

### Changed
- 后端技能优化：修正 ThirdNet.Core 框架源码偏差、精简缓存技能内容、补充 RedisLock 用法
- 将密钥生成技能移入后端插件目录
- 清理构建产物，完善 Mock 配置规范

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
