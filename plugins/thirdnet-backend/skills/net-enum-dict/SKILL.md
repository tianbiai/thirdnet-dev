---
name: net-enum-dict
description: >
  ThirdNet 系统枚举字典开发规范。定义可复用的下拉选项为 [SystemDict] 枚举，
  通过反射自动同步到数据库字典表（t_sys_dict_type + t_sys_dict_data）。
  后端代码中需要做 if/switch 流程判断的值必须定义为系统枚举（前端只读 dict_source=0）；
  仅作为前端下拉展示、后端无需判断流程的选项，通过前端字典管理页面手动创建（dict_source=1）。
  覆盖 [SystemDict] 属性、[EnumMeta] 标签、自动同步机制、枚举模板、决策指南。
  当用户提到"枚举字典"、"下拉选项"、"EnumMeta"、"SystemDict"、"字典枚举"、
  "状态选项"、"字典类型"、"新增枚举"、"dict_source"、"枚举下拉"、"状态枚举"、
  "类型枚举"、"加个下拉"、"选项字典"时，必须使用此技能。
---

# ThirdNet 系统枚举字典

> 命名空间：`[SystemDict]`、`[EnumMeta]`、`SystemEnumRegistry` 在 `{ProjectName}.Admin.Common.Enums`；同步器 `SystemEnumDictSync` 在 `{ProjectName}.Admin.APIService.Data`。完整类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「枚举字典」。

## 决策指南：系统枚举 vs 前端手动字典

在创建下拉选项前，先判断属于哪种类型：

```
后端代码是否需要对此值做 if / switch 流程判断？
├── 是 → 定义为系统枚举（[SystemDict]，本技能）
│       前端字典管理页面中显示为只读（dict_source=0）
│       例如：状态（StatusEnum）、菜单类型（MenuTypeEnum）
│
└── 否 → 通过前端字典管理界面手动创建用户自定义字典
        前端可编辑（dict_source=1）
        例如："通知渠道"（邮件/短信/站内信）、"优先级"（高/中/低）
```

**原则**：后端流程依赖的值不能让用户随意增删改，否则代码逻辑会失效。

## 核心规则

### 一个文件一个枚举

在 `Tools/{ProjectName}.Admin.Common/Enums/` 下新建 `.cs` 文件（参考仓库 `code/backend/src/Tools/ThirdNetVibe.Common/Enums/`），每个文件只包含一个枚举定义。

### 枚举必须标注 [SystemDict]

类上标注 `[SystemDict("字典类型编码", "显示名称")]`：

- `字典类型编码`：前端查询字典时的 key，使用 snake_case（如 `"notice_status"`）
- `显示名称`：在字典管理页面展示的中文名（如 `"通知状态"`）

### 每个成员标注 [EnumMeta]

每个枚举成员标注 `[EnumMeta("中文标签")]` 并从 0 开始显式赋值：

```csharp
[EnumMeta("正常")]
Normal = 0,
```

### 自动同步机制

应用启动时，`SystemEnumRegistry` 通过反射自动扫描当前程序集中所有带 `[SystemDict]` 的枚举，然后 `SystemEnumDictSync.SyncAsync()` 将枚举值同步到数据库：

- **新增枚举类型** → 自动插入 `t_sys_dict_type`（dict_source=0）和 `t_sys_data`
- **更新标签** → 枚举成员的 `[EnumMeta]` 标签变化时自动更新
- **硬删除** → 枚举成员被移除后，对应的 `t_sys_dict_data` 行自动删除

**无需手动操作**：不需要改 Startup.cs、不需要手动注册、不需要手动写迁移。

### 程序集约束

枚举必须定义在 `{ProjectName}.Admin.Common` 程序集中（`SystemEnumRegistry` 只扫描 `typeof(SystemEnumRegistry).Assembly`）。不要在其他项目中定义 `[SystemDict]` 枚举。

## 完整模板

```csharp
using {ProjectName}.Admin.Common.Enums;

namespace {ProjectName}.Admin.Common.Enums
{
    /// <summary>
    /// 通知状态枚举。
    /// <para>对应字典类型：notice_status。</para>
    /// </summary>
    [SystemDict("notice_status", "通知状态")]
    public enum NoticeStatusEnum
    {
        /// <summary>草稿</summary>
        [EnumMeta("草稿")]
        Draft = 0,

        /// <summary>已发布</summary>
        [EnumMeta("已发布")]
        Published = 1,

        /// <summary>已撤回</summary>
        [EnumMeta("已撤回")]
        Revoked = 2
    }
}
```

## 现有系统枚举

以下枚举已定义并在数据库中同步，可直接在代码中引用，无需重复创建：

| 枚举类 | 字典编码 | 显示名称 | 值 |
|--------|---------|---------|-----|
| `StatusEnum` | `status` | 系统状态 | 0=正常, 1=停用 |
| `MenuTypeEnum` | `menu_type` | 菜单类型 | 0=目录, 1=页面, 2=按钮 |
| `VisibleEnum` | `visible` | 显示状态 | 0=显示, 1=隐藏 |
| `BusinessTypeEnum` | `business_type` | 业务类型 | 0=其他, 1=新增, 2=修改, 3=删除, 4=导出 |
| `OperLogStatusEnum` | `oper_log_status` | 操作状态 | 0=成功, 1=失败 |
| `ConfigTypeEnum` | `config_type` | 配置值类型 | 0=字符串, 1=数字, 2=布尔 |

### 已有系统枚举的完整声明格式

这些枚举的声明方式如下（以 `StatusEnum` 为例），了解其格式有助于在代码中正确引用：

```csharp
/// <summary>
/// 系统状态
/// </summary>
[SystemDict("status", "系统状态")]
public enum StatusEnum
{
    /// <summary>正常</summary>
    [EnumMeta("正常")]
    Normal = 0,

    /// <summary>停用</summary>
    [EnumMeta("停用")]
    Disabled = 1
}
```

在 Service 层中引用时：`(StatusEnum)dto.status`（DTO 中为 int，需要显式转换）。

## 同步流程详解

```
1. 应用启动
   └── Program.cs → MigrateHelper.InitializeDatabasesAsync()
       └── SystemEnumDictSync.SyncAsync(dbContext)

2. 自动发现
   └── SystemEnumRegistry.All
       └── 反射扫描 {ProjectName}.Admin.Common 程序集
           └── 找到所有 [SystemDict] 标注的枚举
               └── 为每个枚举创建 EnumRegistration(DictTypeKey, DisplayName, Type)

3. 数据库同步（幂等）
   ├── dict_type 不存在 → INSERT t_sys_dict_type (dict_source=0)
   ├── dict_type 已存在 → 跳过（不修改显示名称）
   ├── dict_value 不存在 → INSERT t_sys_dict_data
   ├── dict_value 存在但 label 变了 → UPDATE dict_label
   └── dict_value 在数据库中但枚举中已移除 → DELETE（硬删除）

4. 单次 SaveChangesAsync 提交所有变更
```

## 使用枚举的前端 API

前端通过字典 API 获取枚举选项：

```
GET /api/manager/dict/type/{dict_type}/data
```

返回该字典类型下的所有选项（value + label），系统枚举和自定义字典使用同一接口。

## 反模式

| 场景 | 错误做法 | 正确做法 |
|------|---------|---------|
| "通知渠道"选项（邮件/短信/站内信），后端只用它展示 | 定义 [SystemDict] 枚举 | 前端字典管理页面手动创建 |
| 新增一个后端需要 switch 判断的状态值 | 前端手动创建字典 | 定义 [SystemDict] 枚举 |
| 在 Admin.APIService 项目中定义枚举 | 在其他程序集定义 [SystemDict] | 只在 Admin.Common/Enums/ 中定义 |
| 每次新增枚举后手动改 Startup.cs | 手动注册 | 无需操作，自动发现 |

## 相关技能

- **backend-workflow**: 完整工作流和技能路由
- **net-efcore-developer**: 数据库实体开发（实体中的状态/类型字段引用枚举）
- **net-api-developer**: API 接口开发（接口返回枚举选项）
- **net-cache-use**: 缓存功能（字典数据有缓存）
