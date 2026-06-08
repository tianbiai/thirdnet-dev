# appsettings 配置文件管理规范

## 概述

.NET 微服务项目的配置文件分为三个层级，各司其职、严格隔离。`appsettings.json` 作为配置模板提交到版本库，通过有意义的字符串值或注释说明每个字段的用途，让开发者一目了然。CI/CD 流水线在部署时直接替换对应属性值为生产环境配置。

## 1. 文件职责

| 文件 | 用途 | 是否提交 |
|------|------|---------|
| `appsettings.json` | 配置模板 — 包含所有配置项的结构定义，值使用说明性字符串或注释标识用途，不包含任何真实环境信息 | ✅ 提交至版本库 |
| `appsettings.Development.json` | 开发环境配置 — 包含本地开发用的真实连接字符串、密钥等，会覆盖模板中的对应项 | ❌ 不提交（已加入 .gitignore） |
| 生产环境配置 | 运行时注入 — 由 CI/CD 流水线在部署时直接替换 JSON 属性值为生产配置 | ❌ 不提交 |

## 2. 模板值格式

`appsettings.json` 作为配置模板，不使用占位符语法，而是通过**有意义的字符串值**或**注释说明**让开发者理解每个字段的用途：

- 敏感值（密码、密钥、连接字符串）使用说明性字符串（如 `"数据库连接字符串"`, `"Redis连接地址"`）
- 非敏感默认值（如 `KeyPrefix`、`DefaultDatabase`）直接写入实际默认值

```json
{
  "DefaultConnectionString": "数据库连接字符串（PostgreSQL）",
  "RedisExtension": {
    "Connection": "Redis连接地址（host:port,password=xxx）",
    "KeyPrefix": "myapp",
    "DefaultDatabase": 0
  },
  "JwtOptions": {
    "public_key": "JWT公钥（SM2/RSA）"
  }
}
```

### 新增配置项流程

新增配置项时，必须严格按以下顺序操作：

1. **先**在 `appsettings.json` 中添加模板版本（说明性值或默认值）
2. **再**在 `appsettings.Development.json` 中添加对应的开发值

## 3. 完整 appsettings.json 模板

新建微服务项目时，`appsettings.json` 应包含以下标准配置节（根据项目需要增减）：

```json
{
  // 数据库连接字符串
  "DefaultConnectionString": "框架配置库连接字符串（Host=localhost;Port=5432;Username=xxx;Password=xxx;Database=xxx）",

  // Redis 缓存配置
  "RedisExtension": {
    "Connection": "Redis连接地址（host:port,password=xxx）",
    "KeyPrefix": "myapp",
    "DefaultDatabase": 0
  },

  // JWT 认证配置
  "JwtOptions": {
    "public_key": "JWT公钥",
    "private_key": "JWT私钥",
    "type": "SM2"
  },

  // Swagger 帮助页面
  "HelpPage": {
    "Title": "服务名称 API",
    "Description": "服务描述"
  },

  // 跨域配置
  "Cors": {
    "Origins": "允许的跨域来源（逗号分隔，如 http://localhost:5173,http://localhost:3000）"
  }
}
```

## 4. appsettings.Development.json 示例

开发人员克隆项目后，需手动创建此文件并填入本地开发环境的真实值：

```json
{
  "DefaultConnectionString": "Host=localhost;Port=5432;Username=devuser;Password=devpass;Database=myapp_dev",

  "RedisExtension": {
    "Connection": "localhost:6379,password=devpass",
    "KeyPrefix": "myapp"
  },

  "JwtOptions": {
    "public_key": "MIIBIjANBgkq...开发环境公钥...",
    "private_key": "MIIEvgIBADAN...开发环境私钥...",
    "type": "SM2"
  },

  "HelpPage": {
    "Title": "MyApp API",
    "Description": "MyApp 开发环境 API 文档"
  },

  "Cors": {
    "Origins": "http://localhost:5173,http://localhost:3000"
  }
}
```

> **注意**：此文件中的值仅为本地开发环境配置，不得提交至版本库。

## 5. 字段一致性要求

`appsettings.json` 与 `appsettings.Development.json` 的配置节结构必须保持一致，具体要求：

| 规则 | 说明 |
|------|------|
| 覆盖机制 | `appsettings.Development.json` 仅需包含需要覆盖的属性，未覆盖的属性自动继承 `appsettings.json` 的值 |
| 属性名匹配 | `appsettings.Development.json` 中出现的属性名必须与 `appsettings.json` 中的同名属性一致，值类型必须匹配 |
| 新增配置项 | 在 `appsettings.json` 中新增配置项后，如需在开发环境使用不同值，再在 `appsettings.Development.json` 中添加覆盖 |

### 验证方式

在本地开发环境启动项目时，确认所有配置节均能正确读取且无缺失字段警告。

## 6. 版本控制

### .gitignore 配置

确保以下条目在 `.gitignore` 中存在：

```gitignore
# 环境配置（包含敏感信息，不提交）
**/appsettings.Development.json
**/appsettings.Production.json
```

### 安全规则

- Git/SVN 提交时自动忽略 `appsettings.Development.json`
- **禁止**将包含真实密码、密钥的配置文件提交至版本库
- 如需共享开发环境配置，应通过内部文档或安全渠道传递，不进入代码仓库

## 7. 新成员入职

新开发人员克隆代码后，按以下步骤配置本地开发环境：

1. **克隆仓库**：`git clone <repo-url>`
2. **阅读模板**：查看 `appsettings.json` 中每个字段的说明，确定需要填写哪些配置项
3. **创建 `appsettings.Development.json`**：在对应 API 项目目录下创建此文件，填入本地开发环境的真实配置值
4. **获取开发凭据**：向团队成员索取开发环境的数据库连接、Redis 地址、JWT 密钥等
5. **验证启动**：运行项目，确认所有配置节均能正确读取且无报错
6. **确认不提交**：确保 `appsettings.Development.json` 不会被 `git add` 提交

## 8. CI/CD 集成

生产环境的配置通过 CI/CD 流水线注入，不进入版本库：

| 阶段 | 操作 |
|------|------|
| 构建 | 使用 `appsettings.json` 模板 |
| 部署 | CI/CD 流水线直接替换 JSON 中对应属性的值为生产环境配置（通过配置中心或文件替换） |
| 验证 | 部署后检查应用启动日志，确认所有配置节已正确注入 |

### 常见配置项说明

| 配置节 | 属性 | 说明 |
|--------|------|------|
| 顶层 | `DefaultConnectionString` | PostgreSQL 框架配置库连接字符串 |
| `RedisExtension` | `Connection` | Redis 连接地址（host:port,password=xxx） |
| `RedisExtension` | `KeyPrefix` | 缓存键前缀，多应用隔离 |
| `RedisExtension` | `DefaultDatabase` | 默认数据库编号 |
| `JwtOptions` | `public_key` | JWT 公钥 |
| `JwtOptions` | `private_key` | JWT 私钥 |
| `JwtOptions` | `type` | 密钥类型（SM2/RSA） |
| `HelpPage` | `Title` | Swagger 文档标题 |
| `HelpPage` | `Description` | Swagger 文档描述 |
| `Cors` | `Origins` | 允许的跨域来源（逗号分隔） |
