---
name: net-enum-dict
description: >
  ThirdNet 枚举字典与自定义字典后端开发规范。区分两类字典：枚举字典
  （C# enum + 特性，dict_source=0，value=int，启动时反射幂等同步）与自定义字典（运营手建，
  dict_source=1，value=string，后端无需写 C#）。覆盖响应 DTO 带 *_label、EnumHelper/DictCache
  用法、int vs string 决策。当用户提到"枚举字典"、"自定义字典"、"dict_source"、"SystemDict"、
  "EnumHelper"、"DictCache"、"字典类型"、"新增枚举"、"加个下拉"、"int 还是 string"、
  "*_label"时，必须使用此技能。
---

# ThirdNet 枚举字典与自定义字典（后端）

> 命名空间：`[SystemDict]`、`[EnumMeta]`、`SystemEnumRegistry`、`EnumHelper` 在 `{ProjectName}.Common.Enums`；同步器 `SystemEnumDictSync` 在 `{ProjectName}.Admin.APIService.Data`；`DictCache` 在 `{ProjectName}.Cache.Domain`。完整类清单见 [能力目录](../backend-workflow/references/framework-and-template-catalog.md)「枚举字典」。

## 概览：两条路径不混用

系统把字典分成两类，走**不同接口**，value 类型不同，职责严格分离：

| 维度 | 枚举字典（`dict_source=0`） | 自定义字典（`dict_source=1`） |
|------|------------------------------|--------------------------------|
| **来源** | C# 枚举反射（`[SystemDict]`） | 运营在「字典管理」页手建 |
| **value 类型** | `int`（枚举数值） | `string`（任意业务编码） |
| **取选项接口** | `GET /api/manager/dict/options/{dict_type}` | `GET /api/manager/dict/data/type/{dict_type}` |
| **后端是否写代码** | 写 C# 枚举（唯一文件） | **全程不写 C#**，只配置存储 + 缓存 |
| **CRUD** | 只读——增删改全部被 `SysDictService` 拒绝（抛异常） | 完整 CRUD |
| **同步方式** | 启动时 `SystemEnumDictSync` 单向覆盖 | 不参与代码同步，纯人工维护 |

**核心原则**：前后端传递的是**数值/编码**，显示文字由后端在响应里以 `*_label` 附带返回。新增/修改枚举值**只改后端枚举定义**，注册、字典表同步、前端下拉全部自动生效。不要试图把两类字典"统一类型"——枚举字典改 string 会破坏后端 `int` DTO 反序列化；自定义字典改 int 会丢失非数字编码。

## 决策准则：枚举字典 vs 自定义字典

判断一个问题即可：

> **这个选项集，会不会在不发版的情况下由运营/管理员改动？**

- **不会** → 写成 **C# 枚举**（`dict_source=0`，int）。适用于：选项**稳定、与代码逻辑强绑定**（代码里有 `if (status==0)` 之类的分支判断）。
  - 例：`StatusEnum`（正常/停用）、`MenuTypeEnum`（菜单类型）、`BusinessTypeEnum`（操作类型）、`PriorityEnum`（优先级）。
- **会** → 在字典管理页建 **自定义字典**（`dict_source=1`，string）。适用于：**业务运营性质、经常增删、带业务编码**、代码只存值不做逻辑判断。
  - 例：`user_source`（用户来源渠道 `web`/`app`/`mini_program`）、`id_card_type`（证件类型）、`bank_code`（银行编码）。

**原则**：后端流程依赖的值不能让运营随意增删改，否则代码逻辑会失效；反之，纯展示性的业务编码不必发版，交由运营维护。

## §1 定义一个新枚举（唯一文件）

新增枚举只需**一个文件**，标注两个特性。注册和字典表同步全自动完成。

在 `Tools/{ProjectName}.Common/Enums/` 下新建 `.cs` 文件，每个文件只包含一个枚举定义：

```csharp
using {ProjectName}.Common.Enums;

namespace {ProjectName}.Common.Enums
{
    /// <summary>
    /// 优先级枚举。
    /// <para>对应字典类型：priority。</para>
    /// </summary>
    [SystemDict("priority", "优先级")]   // 注册为系统字典：dict_type 键 + 字典类型显示名
    public enum PriorityEnum
    {
        /// <summary>低</summary>
        [EnumMeta("低")]
        Low = 0,

        /// <summary>中</summary>
        [EnumMeta("中")]
        Medium = 1,

        /// <summary>高</summary>
        [EnumMeta("高")]
        High = 2,
    }
}
```

两个特性：

| 特性 | 标注位置 | 作用 |
|------|----------|------|
| `[SystemDict(dictTypeKey, displayName)]` | 枚举类 | 声明该枚举为系统字典。`dictTypeKey` 是前后端约定的字典类型编码，使用 **snake_case** 且与字段名一致（如 `status`、`menu_type`、`business_type`）；`displayName` 是字典管理页显示名 |
| `[EnumMeta(label)]` | 枚举成员 | `label`（构造参数，必填）：该成员的中文显示文字。每个成员都标，并从 0 开始**显式赋值**。另有可选属性 `DbValue`（`string?`）：当某枚举成员需在数据库中以**字符串**而非数值存储时，用它指定入库字符串值（如 `[EnumMeta("男", DbValue = "M")]`）；不设 `DbValue` 则按枚举数值（int）入库。 |

完成后 `GET /api/manager/dict/options/priority` 立即可用：

```json
[
  {"value": 0, "label": "低", "name": "Low"},
  {"value": 1, "label": "中", "name": "Medium"},
  {"value": 2, "label": "高", "name": "High"}
]
```

## §2 自动注册与同步（无需手写注册代码）

应用启动时自动发生两件事：

1. **注册发现**：`SystemEnumRegistry` 反射 `{ProjectName}.Common` 程序集中所有带 `[SystemDict]` 的枚举，自动加入注册表（按 `dict_type` 排序）。
2. **字典表同步**：`SystemEnumDictSync.SyncAsync(dbContext)` 每次启动幂等地把枚举同步到 `t_sys_dict_type`（`dict_source=0`）和 `t_sys_dict_data`（`dict_value = 数值.ToString()`）：
   - **新增**：代码中有、表中无 → 插入
   - **更新**：label 变化 → 更新 `dict_label`
   - **删除**：表中有、代码已移除 → 硬删除
   - 所有变更用单次 `SaveChangesAsync` 提交

**无需手动操作**：不需要改 Startup.cs、不需要手动注册、不需要手动写迁移。

### 程序集约束

枚举必须定义在 `{ProjectName}.Common` 程序集中（`SystemEnumRegistry` 只扫描 `typeof(SystemEnumRegistry).Assembly`）。不要在其他项目中定义 `[SystemDict]` 枚举。

### 启动路径

```
Program.cs → MigrateHelper.InitializeDatabasesAsync()
            └── SystemEnumDictSync.SyncAsync(dbContext)
                └── SystemEnumRegistry.All（反射 {ProjectName}.Common 程序集）
```

## §3 响应 DTO：必须带 `<field>` + `<field>_label`（枚举字典）

**规则**：响应 DTO 中凡含枚举字段，必须**同时**返回 `<字段>`（数值 int）和 `<字段>_label`（文字 string）。label 用 `EnumHelper.GetLabel` 反射填充。

```csharp
public class OperLogMap
{
    public int business_type { get; set; }
    public string business_type_label { get; set; } = string.Empty;
    // ...其他字段

    public static OperLogMap FromEntity(Database.Models.SysOperLogModel entity) => new()
    {
        business_type = entity.business_type,
        business_type_label = EnumHelper.GetLabel(typeof(BusinessTypeEnum), entity.business_type),  // 反射填 label
        // ...
    };
}
```

> 若实体字段是裸 `int`（为兼容 PostgreSQL bulk copy，部分实体用 `int` 而非枚举类型，如 `SysOperLogModel.business_type`），`EnumHelper.GetLabel` 第二参直接传 int，内部按数值匹配。

`EnumHelper` 两个核心方法：

| 方法 | 用途 |
|------|------|
| `GetEnumMetadata(Type)` | 返回某枚举的全部选项列表（`List<EnumItemDto>`），供 `/dict/options` 接口使用 |
| `GetLabel(Type, int)` | 按枚举类型 + 数值查单个 label，**进程级缓存**，供 DTO 映射填 `*_label` 使用 |

## §4 DTO 字段类型规则（枚举字典）

| DTO 类型 | 枚举字段类型 | 示例 |
|----------|--------------|------|
| 创建 / 更新 | `int` | `UserCreateMap.status` → `int` |
| 查询条件 | `int?` | `OperLogQueryMap.business_type` → `int?` |

**禁止**将 DTO 枚举字段声明为 `string` 或枚举名类型，以保证前后端数值口径一致。

## §5 前端取选项接口（枚举字典）

枚举字典前端通过**专用接口**取选项（int）：

```
GET /api/manager/dict/options/{dict_type}
```

返回 `[{value: int, label, name}]`，纯内存反射生成、不查库。

> 自定义字典走**另一个接口** `GET /api/manager/dict/data/type/{dict_type}`（string），见 §6。两者不可混用。
>
> 前端落地规范（下拉、提交、表格、筛选四场景）见 **`vue-enum-dict`** 技能。

## §6 自定义字典后端（`dict_source=1`，string）

自定义字典与枚举字典最大的区别：**全程不写 C# 代码**——后端不定义枚举/特性，全部由运营在「字典管理」页维护；后端只提供存储 + 缓存取值接口，业务字段用普通 `string` 列。

### 6.1 配置步骤（只做一次）

**步骤 1 — 运营在「字典管理」页建字典**（无需改代码）

访问 `/system/dict` 页面：

1. 左侧新建**字典类型**，例如 `user_source`（用户来源）。新建时自动设 `dict_source = 1`。
2. 右侧给该类型添加**字典数据**，每条含：
   - `dict_label`：显示文字（如 "网页"）
   - `dict_value`：**实际存储值**（如 `"web"`，string）
   - `dict_sort`、`tag_type`、`css_class`、`remark`（可选）

CRUD 写操作后 `SysDictService` 自动清缓存（`_dictCache.RemoveDictData`）。

**步骤 2 — 业务实体字段用 string 存储**

业务表里存字典值的列用普通 `text`/`string`，**不要用 int、也不要建枚举**（即便值形如 `"1"`/`"2"` 数字形态编码，也按 string 存，自定义字典值统一 string；`"web"` 等更存不进 int）：

```csharp
// backend/src/Admin/.../Models/SysUserModel.cs
public string user_source { get; set; } = string.Empty;   // 存 "web" / "app" / "mini_program"
```

EF 配置（text 类型 + 注释）：

```csharp
// EntityConfigurations/SysUserConfiguration.cs
builder.Property(x => x.user_source).HasComment("用户来源（自定义字典 user_source 的 dict_value）");
```

**步骤 3 — 响应 DTO 带上显示文字（`*_label`）**

与枚举字典一样要同时返回存储值和显示文字，**但 label 来源不同**：

| 字典类别 | label 查询方式 | 数据源 |
|----------|----------------|--------|
| 枚举字典 | `EnumHelper.GetLabel(typeof(XxxEnum), intValue)` | C# 枚举反射（进程内缓存） |
| 自定义字典 | **注入 `DictCache`，从缓存列表 LINQ 查找** | Redis 缓存（key `admin.dict.data.{dictType}`，TTL 24h，DB 回退） |

自定义字典**没有现成的"按 value 反查 label"工具方法**——`EnumHelper.GetLabel` 只认 C# 枚举，自定义字典用不了；`DictDataView` 也只是缓存数据结构（POCO），**没有 `GetLabel` 方法**。需在 Service / DTO 映射处用 `DictCache.GetDictData(dictType)` 取列表后查找：

```csharp
public class XxxService
{
    private readonly DictCache _dictCache;   // 已注入

    public async Task<List<UserItemMap>> GetUserList(...)
    {
        // 1. 取该字典类型的缓存列表（命中 Redis，未命中回退 DB）
        var sourceDict = await _dictCache.GetDictData("user_source");
        // 2. 构建 value → label 查找表
        var sourceLabelMap = sourceDict.ToDictionary(d => d.dict_value, d => d.dict_label);

        // 3. 填充每条记录的 *_label（EF 表达式树内不能查字典，先 ToList 再回填）
        var list = await q.Select(x => new UserItemMap
                {
                    // ...其他字段
                    user_source = x.user_source,
                }).ToListAsync();

        foreach (var m in list)
            m.user_source_label = sourceLabelMap.TryGetValue(m.user_source, out var lb) ? lb : m.user_source;

        return list;
    }
}
```

> `DictCache.GetDictData(dictType)` 返回 `List<DictDataView>`，`DictDataView` 含 `dict_value`/`dict_label`/`tag_type` 等字段。
>
> 因为 EF 表达式树内不能调用字典查找，自定义字典的 `*_label` 通常在 `ToListAsync()` **之后**遍历回填（枚举字典用 `EnumHelper` 是因为它是纯内存计算，可以放进 `Select` 表达式）。

### 6.2 DTO 字段类型规则（自定义字典）

| DTO 类型 | 字段类型 | 示例 |
|----------|----------|------|
| 创建 / 更新 | `string` | `UserCreateMap.user_source` → `string` |
| 查询条件 | `string?` | `UserQueryMap.user_source` → `string?`，Service 按 string 匹配 |

## §7 端到端新增枚举清单

以新增 `priority`（优先级）枚举为例，完整步骤：

| # | 层 | 文件 / 位置 | 动作 |
|---|----|-------------|------|
| 1 | 枚举定义 | `Enums/PriorityEnum.cs` | 新建枚举，标 `[SystemDict("priority","优先级")]` + 每成员 `[EnumMeta]` |
| 2 | （自动） | 启动时 | `SystemEnumRegistry` 注册 + `SystemEnumDictSync` 同步字典表 |
| 3 | 实体 + EF 配置 | 业务实体类 + `EntityConfigurations/*` | 加 `priority` 字段（建议裸 `int` 兼容 bulk copy，参考 `SysOperLogModel.business_type`） |
| 4 | 响应 DTO Map | `DTOs/*/XxxMap.cs` | 加 `priority`(int) + `priority_label`(string)，`FromEntity` 里用 `EnumHelper.GetLabel(typeof(PriorityEnum), entity.priority)` |
| 5 | 创建/更新 DTO | `DTOs/*/XxxCreateMap.cs` 等 | 加 `int priority` 字段 |
| 6 | 查询 DTO + Service | `XxxQueryMap.cs` + `XxxService.cs` | 加 `int? priority`，Service 按 int 精确匹配 |
| 7 | 前端页面 | `views/**/*.vue` | `useDict('priority')` 取下拉；表格列用 `priority_label`；表单提交 number（详见 **`vue-enum-dict`** 技能） |

## §8 禁止事项（后端相关）

| # | 禁止行为 | 原因 |
|---|----------|------|
| 1 | 前端提交 label 字符串或枚举名（如 `"高"` / `"High"`） | 后端 `int` DTO 反序列化失败 |
| 2 | 在 `t_sys_dict_data` 手改枚举字典的 label | 会被下次启动的 `SystemEnumDictSync` 覆盖回 `[EnumMeta]` 的值（单向同步） |
| 3 | DTO 枚举字段声明为 `string` 或枚举名类型 | 破坏数值口径 |
| 4 | 自定义字典 label 用 `EnumHelper.GetLabel`，或以为 `DictDataView.GetLabel` 存在 | `EnumHelper` 只认 C# 枚举；`DictDataView` 是 POCO 无查询方法。自定义字典须用 `DictCache.GetDictData` 取列表 LINQ 查找 |
| 5 | 自定义字典业务字段用 int 存储 | 即便值是 `"1"`/`"2"` 数字形态，自定义字典值统一 string；`"web"` 等更存不进 int |

> 前端禁止事项（硬编码选项数组、用 `getDictDataByType` 给枚举字典做下拉、表格列用 `formatLabel` 等）见 **`vue-enum-dict`** 技能。

## 相关技能

- **vue-enum-dict**：前端枚举字典与自定义字典使用规范（下拉/提交/表格/筛选四场景）——前后端配套技能
- **backend-workflow**：后端开发入口与文档驱动开发流程（**编码前确认 `backend/spec.md` 已存在并已阅读**，否则文档驱动流程会被跳过）
- **net-efcore-developer**：数据库实体开发（实体中的状态/类型字段引用枚举；自定义字典字段用 string 列）
- **net-api-developer**：API 接口开发（接口返回 `*_label`）
- **net-cache-use**：缓存功能（自定义字典 `DictCache` 取值与刷新）
