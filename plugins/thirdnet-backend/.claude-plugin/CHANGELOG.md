# Changelog

## 0.20.0 - 2026-06-09

### Added
- PreToolUse Hook 新增 `net-enum-dict` 和 `net-rbac` 技能检查，确保枚举/权限代码写入前必须加载对应技能
- PostToolUse/Stop Hook 模板引用从 `service-spec-template` 修正为 `project-spec-template`

### Changed
- `plugin.json` 版本号与 `marketplace.json` 对齐

## 0.19.0 - 2026-06-09

### Changed
- 所有技能基于真实代码库重写：从通用模板示例改为引用实际项目文件路径和代码
- 命名空间迁移：`ThirdNet.Core.Common` → `ThirdNet.Vibe.Common`，`ThirdNet.Core.AspNetCore` → `ThirdNet.Vibe.WebAPI`
- `net-api-developer`：新增 AdminControllerBase 详情、完整端点模板、Service 层模板、DTO Map 命名规范
- `net-efcore-developer`：新增 AdminDbContext 约束、IAuditableEntity + ConfigureAuditFields、中间表模式、树形结构实体
- `net-authentication`：替换为真实 AdminAccountValidator（PBKDF2、原子 SQL 锁定、缓存角色查找）、HMAC-SM3
- `net-background-job`：新增三行注册模式、Admin 内置任务文档、IServiceScopeFactory 作用域服务模式
- `net-cache-use`：新增 CacheDbContext、AdminCacheKeys、View 模型指南、缓存域类模板、TTL 约定、Cache-Aside 策略
- `net-database-bulkcopy`：新增决策流程图、方法选择决策树、批量操作与缓存章节
- `net-microservice-generator`：完全重写为模板化创建（`dotnet new thirdnet-service`）、ServiceDbContext 自定义 schema
- `backend-workflow`：新增项目创建命令、双数据库架构表、Program.cs 模式、10 步 DI 管道、8 步功能开发流程、代码规范速查表

### Added
- 新增 `net-enum-dict` 技能：系统枚举字典规范（[SystemDict]、[EnumMeta]、自动同步机制）
- 新增 `net-rbac` 技能：RBAC 权限体系（权限字符串格式、三层授权、CachePermissionProvider、PermissionCatalog 自动同步、OperatorContext）
- 新增 `net-efcore-developer/references/entity-examples.md`：真实代码实体示例
- 新增 `net-api-developer/references/controller-service-examples.md`：真实代码 Controller/Service 示例
- 新增 `backend-workflow/references/project-spec-template.md`：项目级规格说明书模板
- 新增 `net-rbac/references/rbac-flow.md`：RBAC 完整请求生命周期图

### Removed
- 删除 `net-crypto-keygen` 技能（密钥生成工具，功能已由框架内置）
- 删除 `backend-workflow/references/service-spec-template.md`（替换为 project-spec-template.md）

## 0.17.0 - 2026-06-08

### Changed
- `net-microservice-generator` 新增 `appsettings-management.md` 参考文件
- `service-spec-template.md` 配置管理章节扩展为完整配置规范表格

## 0.16.0 - 2026-06-08

### Added
- 新增 `net-microservice-generator/references/appsettings-management.md`：配置文件管理规范（文件职责、说明性字符串模板格式、完整模板、结构一致性规则、版本控制规则、新成员入职指南、CI/CD 集成说明）

### Changed
- `net-microservice-generator` 技能升级至 1.1.0：
  - 标准目录结构新增 `appsettings.Development.json`
  - Redis 配置示例改用说明性字符串，移除硬编码真实值
  - 新增"配置文件管理"章节，包含三文件模型说明、核心规则和参考链接
  - 新增"参考文件索引"章节
- `service-spec-template.md` "配置管理"章节由单行 stub 扩展为完整配置规范表格

## 0.14.0 - 2026-06-07

### Added
- 新增强制规则：**API 必须返回 DTO，禁止直接返回数据库实体**。Controller 层禁止直接返回 EF Core Entity，必须由 Service 层或映射层将 Entity 转换为 DTO（`XXXMap`）后再返回。原因：Entity 包含敏感字段（`password_hash` 等）和 `navigation properties`，直接序列化会泄露敏感数据并产生循环引用。
- 新增强制规则：**DTO 命名规范统一为 `XXXMap`**。所有 API 请求/响应 DTO 一律以 `Map` 结尾（如 `UserCreateMap`、`UserUpdateMap`、`UserQueryMap`、`UserMap`），**完全废除 `Request` / `Response` / `Dto` 后缀**。已使用旧后缀的存量类不在本次整改范围。

### Changed
- `net-api-developer` 技能升级至 1.1.0：
  - 修订"返回类型规范"措辞：API 默认返回 DTO JSON，不再默认返回实体
  - "禁止匿名对象返回"表格删除"直接返回实体"允许行
  - 新增章节"禁止直接返回数据库实体模型（强制要求）"，含原因、允许/禁止表、正确/错误示例
  - DTO 命名规范表：响应模型由 `{Entity}Response` 改为 `{Entity}Map`，所有类型统一为 `Map` 后缀
  - 代码审查清单新增"返回 DTO 而非 Entity"检查项
  - 映射策略：移除 `AutoMapper` 依赖
- `net-cache-use` 技能冲突示例修复：Controller 示例中的 `DepartmentModel` 返回类型改为 `DepartmentMap`；`CreateDepartmentRequest` / `UpdateDepartmentRequest` 重命名为 `DepartmentCreateMap` / `DepartmentUpdateMap`（与 `net-api-developer` 规范对齐）
- `net-database-bulkcopy` 技能冲突示例修复：Excel 导入示例的入参类型 `UserImportDto` 重命名为 `UserImportMap`

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
