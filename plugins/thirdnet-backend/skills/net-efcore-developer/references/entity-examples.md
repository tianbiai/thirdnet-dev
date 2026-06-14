# 实体开发完整示例

本文档包含从代码库提取的完整实体 + 配置代码示例，供开发时参考。

## 目录

1. [SysUserModel + SysUserConfiguration](#sysusermodel--sysuserconfiguration)
2. [SysRoleModel + SysRoleConfiguration](#sysrolemodel--sysroleconfiguration)
3. [SysMenuModel + SysMenuConfiguration](#sysmenumodel--sysmenuconfiguration)
4. [中间关联表示例](#中间关联表)
5. [审计字段配置详解](#审计字段配置详解)

---

## SysUserModel + SysUserConfiguration

**参考文件**（生成项目）：
- `Admin/{ProjectName}.Admin.Database/Models/SysUserModel.cs`
- `Admin/{ProjectName}.Admin.Database/EntityConfigurations/SysUserConfiguration.cs`

### SysUserModel

```csharp
using {ProjectName}.Common.Enums;
using {ProjectName}.Common.Interfaces;

namespace {ProjectName}.Admin.Database.Models
{
    /// <summary>
    /// 系统用户实体 — 管理后台的登录账户。
    /// 对应数据库表：t_sys_user。
    /// RBAC 关系：User →（N:M）→ Role →（N:M）→ Menu/Permission
    /// </summary>
    public class SysUserModel : IAuditableEntity
    {
        public long id { get; set; }
        public string user_name { get; set; }         // 登录名，唯一
        public string password_hash { get; set; }      // PBKDF2 自包含格式
        public string nick_name { get; set; }          // 昵称
        public string email { get; set; }              // 可选
        public string phone { get; set; }              // 可选
        public string avatar { get; set; }             // 头像路径
        public long dept_id { get; set; }              // 所属部门
        public bool include_sub_depts { get; set; }    // 是否包含子部门数据
        public StatusEnum status { get; set; }         // 0=正常 1=禁用
        public string login_ip { get; set; }           // 最后登录IP
        public DateTime? login_date { get; set; }      // 最后登录时间

        // 审计字段（IAuditableEntity）
        public string created_by { get; set; }
        public DateTime created_time { get; set; }
        public string? updated_by { get; set; }
        public DateTime? updated_time { get; set; }
        public string remark { get; set; }

        // 安全字段
        public int failed_login_attempts { get; set; }  // 连续登录失败次数
        public DateTime? lockout_end { get; set; }      // 锁定截止时间
        public DateTime? password_changed_time { get; set; } // 密码最后修改时间
        public DateTime? last_active_time { get; set; } // 最后活跃时间
    }
}
```

### SysUserConfiguration

```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using {ProjectName}.Common.Enums;
using {ProjectName}.Admin.Database.Models;

namespace {ProjectName}.Admin.Database.EntityConfigurations
{
    public class SysUserConfiguration : IEntityTypeConfiguration<SysUserModel>
    {
        public void Configure(EntityTypeBuilder<SysUserModel> builder)
        {
            builder.ToTable("t_sys_user");        // t_ 前缀
            builder.HasKey(x => x.id);             // long id 主键

            // 唯一索引
            builder.HasIndex(x => x.user_name).IsUnique();

            // 普通索引
            builder.HasIndex(x => x.dept_id).HasDatabaseName("idx_user_dept_id");

            // 字段配置
            builder.Property(x => x.id).HasComment("主键");
            builder.Property(x => x.user_name).IsRequired().HasComment("用户名（登录名）");
            builder.Property(x => x.password_hash).IsRequired().HasComment("密码哈希（自包含格式）");
            builder.Property(x => x.nick_name).IsRequired().HasComment("昵称");
            builder.Property(x => x.email).HasComment("邮箱");
            builder.Property(x => x.phone).HasComment("手机号");
            builder.Property(x => x.avatar).HasComment("头像路径");
            builder.Property(x => x.dept_id).HasComment("所属部门ID");
            builder.Property(x => x.include_sub_depts).HasDefaultValue(false).HasComment("是否包含子部门数据");
            builder.Property(x => x.status).HasDefaultValue(StatusEnum.Normal).HasComment("状态（0=正常 1=禁用）");
            builder.Property(x => x.login_ip).HasComment("最后登录IP");
            builder.Property(x => x.login_date).HasComment("最后登录时间");
            builder.Property(x => x.failed_login_attempts).HasDefaultValue(0).HasComment("连续登录失败次数");
            builder.Property(x => x.lockout_end).HasComment("锁定截止时间（UTC）");
            builder.Property(x => x.password_changed_time).HasComment("密码最后修改时间（UTC）");
            builder.Property(x => x.last_active_time).HasComment("最后活跃时间（UTC）");

            // 审计字段（一行搞定 5 个字段）
            builder.ConfigureAuditFields();
        }
    }
}
```

---

## SysRoleModel + SysRoleConfiguration

### SysRoleModel

```csharp
using {ProjectName}.Common.Enums;
using {ProjectName}.Common.Interfaces;

namespace {ProjectName}.Admin.Database.Models
{
    public class SysRoleModel : IAuditableEntity
    {
        public long id { get; set; }
        public string role_name { get; set; }   // 角色名称（显示用）
        public string role_key { get; set; }    // 角色标识（程序引用，唯一）
        public int role_sort { get; set; }      // 排序号
        public StatusEnum status { get; set; }  // 0=正常 1=禁用
        public long dept_id { get; set; }       // 所属部门

        // 审计字段
        public string created_by { get; set; }
        public DateTime created_time { get; set; }
        public string? updated_by { get; set; }
        public DateTime? updated_time { get; set; }
        public string remark { get; set; }
    }
}
```

### SysRoleConfiguration

```csharp
public class SysRoleConfiguration : IEntityTypeConfiguration<SysRoleModel>
{
    public void Configure(EntityTypeBuilder<SysRoleModel> builder)
    {
        builder.ToTable("t_sys_role");
        builder.HasKey(x => x.id);

        // role_key 唯一索引
        builder.HasIndex(x => x.role_key).IsUnique();

        // dept_id 索引（用于范围过滤）
        builder.HasIndex(x => x.dept_id);

        builder.Property(x => x.id).HasComment("主键");
        builder.Property(x => x.role_name).IsRequired().HasComment("角色名称");
        builder.Property(x => x.role_key).IsRequired().HasComment("角色标识");
        builder.Property(x => x.role_sort).HasDefaultValue(0).HasComment("排序");
        builder.Property(x => x.status).HasDefaultValue(StatusEnum.Normal).HasComment("状态（0=正常 1=禁用）");
        builder.Property(x => x.dept_id).HasComment("所属部门ID");

        builder.ConfigureAuditFields();
    }
}
```

---

## SysMenuModel + SysMenuConfiguration

菜单是树形结构实体，包含三种节点类型（目录/菜单/按钮）。

### SysMenuModel

```csharp
using {ProjectName}.Common.Enums;
using {ProjectName}.Common.Interfaces;

namespace {ProjectName}.Admin.Database.Models
{
    public class SysMenuModel : IAuditableEntity
    {
        public long id { get; set; }
        public long parent_id { get; set; }          // 父菜单ID（0=顶级）
        public string menu_name { get; set; }        // 菜单名称
        public MenuTypeEnum menu_type { get; set; }  // 0=目录 1=菜单 2=按钮
        public string path { get; set; }             // 路由地址
        public string component { get; set; }        // 前端组件路径
        public string permission { get; set; }       // 权限标识（如 sys:user:add）
        public string permission_prefix { get; set; } // 权限前缀
        public string icon { get; set; }             // 图标
        public int order_num { get; set; }           // 排序号
        public VisibleEnum visible { get; set; }     // 0=显示 1=隐藏
        public StatusEnum status { get; set; }       // 0=正常 1=禁用
        public bool is_external { get; set; }        // 是否外链

        // 审计字段
        public string created_by { get; set; }
        public DateTime created_time { get; set; }
        public string? updated_by { get; set; }
        public DateTime? updated_time { get; set; }
        public string remark { get; set; }
    }
}
```

### SysMenuConfiguration

```csharp
public class SysMenuConfiguration : IEntityTypeConfiguration<SysMenuModel>
{
    public void Configure(EntityTypeBuilder<SysMenuModel> builder)
    {
        builder.ToTable("t_sys_menu");
        builder.HasKey(x => x.id);

        // 权限标识唯一索引（过滤空值）
        builder.HasIndex(x => x.permission)
            .HasFilter("permission <> ''").IsUnique();

        // 父菜单ID索引
        builder.HasIndex(x => x.parent_id).HasDatabaseName("idx_menu_parent_id");

        builder.Property(x => x.id).HasComment("主键");
        builder.Property(x => x.parent_id).HasDefaultValue(0).HasComment("父菜单ID（0=顶级）");
        builder.Property(x => x.menu_name).IsRequired().HasComment("菜单名称");
        builder.Property(x => x.menu_type).IsRequired().HasComment("菜单类型（0=目录 1=菜单 2=按钮）");
        builder.Property(x => x.path).HasComment("路由地址");
        builder.Property(x => x.component).HasComment("组件路径");
        builder.Property(x => x.permission).HasComment("权限标识");
        builder.Property(x => x.permission_prefix).HasComment("权限前缀");
        builder.Property(x => x.icon).HasComment("图标");
        builder.Property(x => x.order_num).HasDefaultValue(0).HasComment("排序");
        builder.Property(x => x.visible).HasDefaultValue(VisibleEnum.Show).HasComment("是否可见");
        builder.Property(x => x.status).HasDefaultValue(StatusEnum.Normal).HasComment("状态");
        builder.Property(x => x.is_external).HasDefaultValue(false).HasComment("是否外链");

        builder.ConfigureAuditFields();
    }
}
```

---

## 中间关联表

### SysUserRoleModel（用户-角色关联）

```csharp
namespace {ProjectName}.Admin.Database.Models
{
    public class SysUserRoleModel
    {
        public long id { get; set; }      // 自增主键
        public long user_id { get; set; } // 用户 ID
        public long role_id { get; set; } // 角色 ID
    }
}

// 配置
public class SysUserRoleConfiguration : IEntityTypeConfiguration<SysUserRoleModel>
{
    public void Configure(EntityTypeBuilder<SysUserRoleModel> builder)
    {
        builder.ToTable("t_sys_user_role");
        builder.HasKey(x => x.id);
        // 复合唯一约束
        builder.HasIndex(x => new { x.user_id, x.role_id }).IsUnique();
    }
}
```

### SysRoleMenuModel（角色-菜单关联）

```csharp
namespace {ProjectName}.Admin.Database.Models
{
    public class SysRoleMenuModel
    {
        public long id { get; set; }
        public long role_id { get; set; }
        public long menu_id { get; set; }
        public string permission_string { get; set; } // 权限标识（冗余存储，加速查询）
    }
}
```

注意：中间表不实现 `IAuditableEntity`，不调用 `ConfigureAuditFields()`。

---

## 审计字段配置详解

`ConfigureAuditFields()` 扩展方法（生成项目 `Admin/{ProjectName}.Admin.Database/EntityConfigurations/AuditPropertyExtensions.cs`）：

```csharp
public static void ConfigureAuditFields<T>(this EntityTypeBuilder<T> builder)
    where T : class, IAuditableEntity
{
    builder.Property(x => x.created_by).HasComment("创建人");
    builder.Property(x => x.created_time).HasDefaultValueSql("now()").HasComment("创建时间");
    builder.Property(x => x.updated_by).HasComment("更新人");
    builder.Property(x => x.updated_time).HasComment("更新时间");
    builder.Property(x => x.remark).HasComment("备注");
}
```

**特点**：
- `created_time` 有数据库默认值 `now()`，Service 层无需手动赋值
- `updated_by` 和 `updated_time` 可空（首次创建时无更新）
- 只有实现 `IAuditableEntity` 的实体才能调用（泛型约束保证编译时类型安全）
