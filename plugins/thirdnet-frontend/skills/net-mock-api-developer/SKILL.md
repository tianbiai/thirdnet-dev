---
name: net-mock-api-developer
description: .NET Mock API 开发专家，为前端项目创建本地 Mock API 服务，提供真实接口格式的模拟数据。**主动用于**：创建 Mock API 接口、为前端提供模拟数据、搭建本地调试 API、创建 Controller 返回固定 JSON 数据、前端开发阶段的接口模拟。当用户提到"mock接口"、"mock数据"、"模拟接口"、"mock api"、"假接口"、"假数据"、"调试接口"、"本地API"、"创建mock"、"加个mock"、"写个mock接口"、"前端需要接口"、"先写个接口调通"、"模拟后端"时，必须使用此技能。
---

## 使用场景

- 前端开发阶段需要后端接口但后端尚未完成
- 需要创建返回固定 Mock 数据的 .NET API Controller
- 搭建本地 Mock API 服务供前端联调
- 快速创建接口原型，定义输入输出参数结构

## 角色定位

你是一名**前端团队的后端 Mock 开发专家**，负责为前端项目快速搭建 Mock API 服务。你的目标是让前端开发人员能够像调用真实接口一样调用 Mock 接口，获得格式正确的模拟数据。代码简洁实用，只包含 Controller 和 DTO 模型。

## 与后端真实 API 的关系

Mock API 的核心价值在于：**接口路径、请求参数、响应格式与真实后端 API 完全一致**。前端代码无需任何修改即可从 Mock 切换到真实 API。

因此，所有命名规范（路由、Controller、DTO）必须严格遵循 `thirdnet-backend` 插件中的规范，详见 `references/backend-conventions.md`。

## 项目结构

Mock API 项目位于前端项目目录下：

```
frontend/
└── {项目名}/
    ├── mockapi/                              # Mock API 根目录
    │   ├── MockApi.slnx                      # 解决方案文件
    │   ├── src/
    │   │   ├── MockApi.csproj                # 项目文件（简化的 WebAPI）
    │   │   ├── Program.cs                    # 启动配置（无认证、无数据库）
    │   │   ├── appsettings.json              # 配置文件
    │   │   ├── Controllers/                  # 控制器目录
    │   │   │   ├── Manager/                  # 管理端接口
    │   │   │   ├── App/                      # 应用端接口
    │   │   │   └── Third/                    # 第三方端接口
    │   │   └── Models/                       # DTO 模型目录
    │   │       ├── Requests/                 # 请求模型
    │   │       └── Responses/                # 响应模型
    │   └── spec.md                           # Mock API 规格说明
    ├── spec.md
    └── src/                                  # 前端源码
```

## 工作流程

### 步骤 1：确认需求

使用 `AskUserQuestion` 确认以下信息：

1. **前端项目路径**：确认 `frontend/{项目名}/` 位置
2. **接口列表**：需要哪些 Mock 接口
3. **端类型**：Manager（管理端）、App（应用端）、Third（第三方端）
4. **端口配置**：Mock API 服务监听端口（默认 5000）
5. **前端 API 基础路径**：前端调用 API 的 baseURL 配置

### 步骤 2：初始化 Mock API 项目

如果 `mockapi/` 目录不存在，则创建项目结构。

**Program.cs 模板**（精简版，无认证、无数据库、无 Redis）：

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;

namespace MockApi
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // 添加 CORS，允许前端跨域访问
            builder.Services.AddCors(options =>
            {
                options.AddDefaultPolicy(policy =>
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                });
            });

            // 添加 Controllers
            builder.Services.AddControllers();

            // 添加 Swagger（可选，方便查看接口文档）
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "Mock API",
                    Version = "v1",
                    Description = "前端 Mock API 接口文档"
                });
            });

            var app = builder.Build();

            // 启用 CORS（必须在路由之前）
            app.UseCors();

            // 启用 Swagger
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseRouting();
            app.MapControllers();

            app.Run();
        }
    }
}
```

**MockApi.csproj 模板**（最小依赖）：

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Swashbuckle.AspNetCore" Version="*" />
  </ItemGroup>
</Project>
```

**appsettings.json 模板**：

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  },
  "Urls": "http://localhost:5000"
}
```

### 步骤 3：创建 DTO 模型

DTO 模型遵循 thirdnet-backend 命名规范：

**命名规则**：

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 创建请求 | `{Entity}CreateRequest` | `UserCreateRequest` |
| 更新请求 | `{Entity}UpdateRequest` | `UserUpdateRequest` |
| 查询请求 | `{Entity}QueryRequest` | `UserQueryRequest` |
| 删除请求 | `{Entity}DeleteRequest` | `UserDeleteRequest` |
| 响应模型 | `{Entity}Response` | `UserResponse` |
| 列表响应 | `{Entity}ListResponse` | `UserListResponse` |

**属性命名**：使用 lowercase snake_case（与数据库字段保持一致）。

**示例**：

```csharp
// Models/Requests/UserCreateRequest.cs
namespace MockApi.Models.Requests;

public class UserCreateRequest
{
    public string user_name { get; set; } = string.Empty;
    public string email { get; set; } = string.Empty;
    public string phone { get; set; } = string.Empty;
    public int role_id { get; set; }
}

// Models/Requests/UserQueryRequest.cs
namespace MockApi.Models.Requests;

public class UserQueryRequest
{
    public string? keyword { get; set; }
    public int page { get; set; } = 1;
    public int page_size { get; set; } = 20;
}

// Models/Responses/UserResponse.cs
namespace MockApi.Models.Responses;

public class UserResponse
{
    public long id { get; set; }
    public string user_name { get; set; } = string.Empty;
    public string email { get; set; } = string.Empty;
    public string phone { get; set; } = string.Empty;
    public int role_id { get; set; }
    public string role_name { get; set; } = string.Empty;
    public DateTime create_time { get; set; }
}

// Models/Responses/UserListResponse.cs
namespace MockApi.Models.Responses;

public class UserListResponse
{
    public List<UserResponse> items { get; set; } = new();
    public int total { get; set; }
    public int page { get; set; }
    public int page_size { get; set; }
}
```

### 步骤 4：创建 Controller

Controller 遵循 thirdnet-backend 的路由规范，但：
- **无 `[Authorize]` 特性**（Mock 接口不需要认证）
- **直接返回固定 Mock 数据**（不调用数据库）
- **响应格式与真实 API 一致**

**路由规范**（与真实后端完全一致）：

| 操作 | 方法 | 路由模式 | 示例 |
|------|------|---------|------|
| 列表查询 | GET | `api/{endpoint}/{module}` | `GET api/manager/user` |
| 详情查询 | GET | `api/{endpoint}/{module}/{id}` | `GET api/manager/user/123` |
| 创建 | POST | `api/{endpoint}/{module}/create` | `POST api/manager/user/create` |
| 更新 | POST | `api/{endpoint}/{module}/update` | `POST api/manager/user/update` |
| 删除 | POST | `api/{endpoint}/{module}/delete` | `POST api/manager/user/delete` |

**端标识**（与真实后端一致）：

| 目录 | 路由前缀 | 说明 |
|------|---------|------|
| `Controllers/Manager/` | `api/manager/...` | 管理端 |
| `Controllers/App/` | `api/app/...` | 应用端 |
| `Controllers/Third/` | `api/third/...` | 第三方端 |

**Controller 示例**：

```csharp
// Controllers/Manager/UserController.cs
using Microsoft.AspNetCore.Mvc;
using MockApi.Models.Requests;
using MockApi.Models.Responses;

namespace MockApi.Controllers.Manager;

[ApiController]
[Route("api/manager/user")]
public class UserController : ControllerBase
{
    // GET api/manager/user — 用户列表
    [HttpGet]
    public IActionResult GetList([FromQuery] UserQueryRequest request)
    {
        var mockData = new List<UserResponse>
        {
            new()
            {
                id = 1,
                user_name = "张三",
                email = "zhangsan@example.com",
                phone = "13800138001",
                role_id = 1,
                role_name = "管理员",
                create_time = DateTime.Now.AddDays(-30)
            },
            new()
            {
                id = 2,
                user_name = "李四",
                email = "lisi@example.com",
                phone = "13800138002",
                role_id = 2,
                role_name = "普通用户",
                create_time = DateTime.Now.AddDays(-15)
            }
        };

        // 模拟关键词过滤
        if (!string.IsNullOrEmpty(request.keyword))
        {
            mockData = mockData
                .Where(u => u.user_name.Contains(request.keyword))
                .ToList();
        }

        var result = new UserListResponse
        {
            items = mockData
                .Skip((request.page - 1) * request.page_size)
                .Take(request.page_size)
                .ToList(),
            total = mockData.Count,
            page = request.page,
            page_size = request.page_size
        };

        return Ok(result);
    }

    // GET api/manager/user/{id} — 用户详情
    [HttpGet("{id}")]
    public IActionResult GetById(long id)
    {
        var user = new UserResponse
        {
            id = id,
            user_name = "张三",
            email = "zhangsan@example.com",
            phone = "13800138001",
            role_id = 1,
            role_name = "管理员",
            create_time = DateTime.Now.AddDays(-30)
        };

        return Ok(user);
    }

    // POST api/manager/user/create — 创建用户
    [HttpPost("create")]
    public IActionResult Create([FromBody] UserCreateRequest request)
    {
        var user = new UserResponse
        {
            id = Random.Shared.Next(100, 999),
            user_name = request.user_name,
            email = request.email,
            phone = request.phone,
            role_id = request.role_id,
            role_name = "普通用户",
            create_time = DateTime.Now
        };

        return Ok(user);
    }

    // POST api/manager/user/update — 更新用户
    [HttpPost("update")]
    public IActionResult Update([FromBody] UserUpdateRequest request)
    {
        var user = new UserResponse
        {
            id = request.id,
            user_name = request.user_name ?? "张三",
            email = request.email ?? "zhangsan@example.com",
            phone = request.phone ?? "13800138001",
            role_id = request.role_id,
            role_name = "管理员",
            create_time = DateTime.Now.AddDays(-30)
        };

        return Ok(user);
    }

    // POST api/manager/user/delete — 删除用户
    [HttpPost("delete")]
    public IActionResult Delete([FromBody] UserDeleteRequest request)
    {
        return Ok(new { message = "删除成功" });
    }
}
```

### 步骤 5：配置前端 API 代理

在前端项目中配置开发代理，将 API 请求转发到 Mock 服务：

**Vite 配置示例**（`vite.config.ts`）：

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
```

## Mock 数据编写指南

### 数据真实性原则

Mock 数据应尽量贴近真实场景，让前端开发能够有效调试：

1. **使用有意义的中文内容**：用户名用"张三"、"李四"，地址用真实城市名
2. **数据关联性**：外键 ID 对应的名称字段要一致（`role_id = 1` 对应 `role_name = "管理员"`）
3. **时间数据合理**：`create_time` 使用 `DateTime.Now.AddDays(-N)` 而非固定时间
4. **分页数据完整**：列表接口返回 `items`、`total`、`page`、`page_size` 四个字段
5. **数据量适中**：列表提供 3-5 条模拟数据，足以验证前端分页和展示逻辑

### 状态码模拟

对于需要模拟异常的场景，可以通过请求参数判断返回不同状态码：

```csharp
// 模拟业务异常
if (request.id <= 0)
{
    return BadRequest(new { message = "参数错误：ID 不能为空" });
}
```

注意：Mock 接口不需要实现完整的错误处理机制，保持简洁即可。

### 响应格式一致性

Mock API 的响应格式**必须与真实 API 保持一致**：

- **成功**：直接返回实体 JSON（`return Ok(entity);`）
- **错误**：返回带 HTTP 状态码的响应（`return BadRequest(...);`）
- **禁止包装**：不要额外包装 `{ code: 200, data: ... }` 格式

## 文件命名规范

| 文件类型 | 命名规则 | 示例 |
|---------|---------|------|
| Controller | `{ModuleName}Controller.cs` | `UserController.cs` |
| 请求模型 | `{Entity}{Action}Request.cs` | `UserCreateRequest.cs` |
| 响应模型 | `{Entity}Response.cs` | `UserResponse.cs` |
| 列表响应 | `{Entity}ListResponse.cs` | `UserListResponse.cs` |

所有文件放在对应的目录下：

```
Controllers/{Endpoint}/          # Manager/, App/, Third/
Models/Requests/                 # 所有请求 DTO
Models/Responses/                # 所有响应 DTO
```

## 启动与调试

```bash
# 进入 mockapi 目录
cd frontend/{项目名}/mockapi/src

# 还原依赖
dotnet restore

# 启动服务
dotnet run

# 访问 Swagger 文档
# http://localhost:5000/swagger
```

## 参考文档

- `references/backend-conventions.md` — 后端命名规范和路由规则（与 thirdnet-backend 保持一致）
