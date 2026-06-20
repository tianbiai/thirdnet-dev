# 框架管道与中间件

本文件归档 Service / Admin 共用的框架管道细节：`AddThirdNetMvcWithPostgresql` 一次调用注册的组件清单，以及 `UseThirdNetMvc` 内部的中间件执行顺序。了解执行顺序有助于排查认证/授权问题。

## AddThirdNetMvcWithPostgresql 内部注册

`AddThirdNetMvcWithPostgresql` 是框架核心注册方法，一次调用自动注册以下组件：

| 分类 | 注册内容 | 说明 |
|------|---------|------|
| MVC | `CustomExceptionFilter` | 全局异常，`WebApiException` 返回对应 HTTP 状态码 |
| MVC | `ValidateModelAttribute` | 自动校验 ModelState |
| MVC | JSON 序列化 | 小写策略 + DateTime 转换器 |
| 认证 | Basic + Bearer | 双层认证 |
| 授权 | 四个策略 | Default、Logon、Basic、Both |
| 授权 | 通配符授权 | 支持角色通配符 `*` |
| 缓存 | 应用/IP/角色缓存 | 内存缓存 |
| 日志 | 访问日志 + 后台日志 | 批量写入 |
| 批量 | `IDbAsyncBulk` | PostgreSQL 批量操作（Transient） |
| 其他 | `ICheckClient`/`IAccountTokenTimeCache` 等 | 客户端签名、Token 检测 |

> **Redis 不在此方法内注册**。Redis 需通过 `AddRedisExtensionService` 单独注册，且必须在 `AddThirdNetMvcWithPostgresql` 之前调用。

## 中间件执行顺序

`UseThirdNetMvc` 内部中间件执行顺序：

| 序号 | 中间件 | 说明 |
|-----|-------|------|
| 1 | `UseForwardedHeaders` | 处理反向代理头 |
| 2 | `UseRateLimiter` | 限流（`AddThirdNetIpAndApplicationPathRateLimiting` 注册的固定窗口） |
| 3 | `UseThirdNetUseExceptionHandler` | 全局异常处理 |
| 4 | `UseRouting` | 路由匹配 |
| 5 | `RequestLoggerMiddleware` | 访问日志记录 |
| 6 | `UseAuthentication` | 认证中间件 |
| 7 | `UseAuthorization` | 授权中间件 |
| 8 | `AccountTokenCheckMiddleware` | Token 有效性检查 |
| 9 | `MapControllers` | 映射控制器路由 |

**注意**：不要在 `UseThirdNetMvc` 外部手动添加认证/授权中间件，会导致重复执行。
