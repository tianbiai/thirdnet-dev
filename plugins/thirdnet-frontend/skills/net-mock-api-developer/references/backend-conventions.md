# 后端 API 规范参考（摘自 thirdnet-backend）

本文档摘录 thirdnet-backend 插件中的关键命名规范和路由规则，确保 Mock API 与真实后端接口格式完全一致。

## HTTP 方法限制

**仅允许 GET 和 POST**，禁止 DELETE、PUT、PATCH。

| 允许的方法 | 用途 | 示例路由 |
|-----------|------|---------|
| GET | 查询、获取资源 | `GET /api/manager/users` |
| POST | 创建、更新、删除 | `POST /api/manager/users/create` |

**原因**：项目网关会屏蔽 DELETE、PUT、PATCH 方法。

## 路由定义规范

API 路径格式：`api/{端标识}/{模块名}`

**禁止在路径中包含版本号**（v1、v2 等）。

### 端标识

| Controllers 子目录 | 端标识 | 说明 |
|-------------------|--------|------|
| `Manager/` | `manager` | 管理端（管理后台，运营人员） |
| `App/` | `app` | 应用端（C 端用户：Web、H5、小程序、App） |
| `Third/` | `third` | 第三方端（开放 API，第三方系统对接） |

### 路由模式

| 操作 | 方法 | 路由模式 | 示例 |
|------|------|---------|------|
| 列表/查询 | GET | `api/{endpoint}/{module}` 或 `api/{endpoint}/{module}/list` | `GET api/manager/user` |
| 获取单个 | GET | `api/{endpoint}/{module}/{id}` | `GET api/manager/user/123` |
| 创建 | POST | `api/{endpoint}/{module}/create` | `POST api/manager/user/create` |
| 更新 | POST | `api/{endpoint}/{module}/update` | `POST api/manager/user/update` |
| 删除 | POST | `api/{endpoint}/{module}/delete` | `POST api/manager/user/delete` |

## DTO 模型命名规范

### 类名：PascalCase，以功能后缀结尾

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 创建请求 | `{Entity}CreateRequest` | `UserCreateRequest` |
| 更新请求 | `{Entity}UpdateRequest` | `UserUpdateRequest` |
| 查询请求 | `{Entity}QueryRequest` | `UserQueryRequest` |
| 删除请求 | `{Entity}DeleteRequest` | `UserDeleteRequest` |
| 响应模型 | `{Entity}Response` | `UserResponse` |

### 属性名：lowercase snake_case

属性命名与数据库字段保持一致，使用小写 + 下划线风格：

```csharp
public long id { get; set; }
public string user_name { get; set; } = string.Empty;
public DateTime create_time { get; set; }
public int role_id { get; set; }
```

**不要使用** PascalCase 属性名（如 `UserName`、`CreateTime`）。

## 响应格式规范

- **成功**：直接返回实体 JSON，不包装。`return Ok(entity);`
- **错误**：返回带 HTTP 状态码的响应
- **禁止包装**：不要用 `{ "code": 200, "data": ... }` 或 `{ "code": 404, "message": ... }` 包装

## Controller 类命名

- 类名：PascalCase，以 `Controller` 结尾
- 命名空间：`MockApi.Controllers.{Endpoint}`
- Route 特性：`[Route("api/{endpoint}/{module}")]`

```csharp
namespace MockApi.Controllers.Manager;

[ApiController]
[Route("api/manager/user")]
public class UserController : ControllerBase
{
    // ...
}
```

## 常用 HTTP 状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|---------|
| 200 | OK | 请求成功，返回实体或分页数据 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 操作成功无返回内容 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
| 404 | Not Found | 资源不存在 |
| 500 | Server Error | 服务器内部错误 |
