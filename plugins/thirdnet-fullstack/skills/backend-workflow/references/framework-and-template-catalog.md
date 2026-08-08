# 框架与模板可复用能力目录

本目录是 ThirdNet 后端**所有现成能力**的单一事实来源。编写任何后端代码前先在此查找——你要的东西大概率框架已经提供，**不要重复造轮子**。各编码技能（`net-api-developer`、`net-cache-use` 等）只讲解「怎么用」，本目录回答「有什么、叫什么、在哪」。

> 路径约定：第 1 层框架库（NuGet 包 `ThirdNet.Vibe.Common` / `ThirdNet.Vibe.WebAPI`）以 NuGet 引用，列出的文件路径为包内相对位置；第 2 层模板生成层列出的是**生成项目内**的相对路径，用 `{ProjectName}` 占位符（生成后替换为实际项目前缀）。代码中引用框架类时一律用**命名空间**。

---

## 第 1 层：框架库（NuGet 包 `ThirdNet.Vibe.Common` / `ThirdNet.Vibe.WebAPI`）

这两个库以 NuGet 形式被项目引用，是**最优先复用**的对象。

### 1.1 `ThirdNet.Vibe.Common`（通用基础库）

#### 树结构（Tree/）

> ⚠️ `TreeBuilder` 与 `TreeHelper` **是两个不同的静态类，均位于 `ThirdNet.Vibe.Common`**，按用途选用，勿混淆。

| 类 | 文件 | 用途 |
|----|------|------|
| `TreeBuilder` | `Library/ThirdNet.Vibe.Common/Tree/TreeBuilder.cs` | 扁平列表 → 树。`BuildForest<T>(flatList, getId, getParentId, getChildren, setChildren)`，根判定 `parent_id==0` 或孤儿。 |
| `TreeHelper` | `Library/ThirdNet.Vibe.Common/Tree/TreeHelper.cs` | 树 → 扁平 / 名称映射 / 环检测。`FlattenTree<T>`、`BuildNameMap<T>(roots, getId, getName, getChildren)`、`ValidateNoCircularReference<T>(...)`。 |

#### 后台任务与异步缓存（async/）

| 类/接口 | 文件 | 用途 |
|---------|------|------|
| `BackgroundRunner` | `.../async/BackgroundRunner.cs` | 抽象基类（继承 `BackgroundService`）。循环任务：设 `SleepTime`/`Name`/`Check`，实现 `WorkAsync()`。经 `IBackgroundLogger` 自动记日志。 |
| `SessionRunner<Key,Value>` | `.../async/SessionRunner.cs` | 抽象字典缓存型后台任务（继承 `BackgroundRunner`），实现 `ISessionReader<Key,Value>` + `ISessionRefresh`。`TryGet`/`GetAll`/`RefreshAsync`，内部 volatile `Dictionary`。 |
| `AsyncMemo<T>` | `.../async/AsyncMemo.cs` | 轻量异步记忆化：`GetOrFetchAsync(fetchFunc)`。 |
| `IBackgroundLogger` / `BackgroundLog` | `.../async/IBackgroundLogger.cs` | 后台任务日志接口与日志条目 POCO。 |
| `ISessionReader<K,V>` / `ISessionRefresh` | `.../async/ISessionReader.cs`、`ISessionRefresh.cs` | 字典缓存读取/刷新接口。 |

#### 加密算法（algorithm/）—— 国密 + 国际双标准

通过 DI 一次性注册整套算法：`CryptoServiceExtensions.AddCrypto(CryptoStandard standard, int bcryptWorkFactor=11, bool usePbkdf2=false, int pbkdf2Iterations=100000)`，或自定义 `AddCrypto(Action<CryptoBuilder> configure)`。`CryptoBuilder` 提供 `UseHash/UseHmac/UseSymmetric/UseAsymmetric/UsePasswordHasher<TImpl>()`。

| 抽象 | 文件（algorithm/abstractions/） | 国际实现（international/） | 国密实现（national/） |
|------|------|------|------|
| `IHashAlgorithm` | IHashAlgorithm.cs | `SHA512HashAlgorithm` | `SM3HashAlgorithm` |
| `IHmacAlgorithm` | IHmacAlgorithm.cs | `HMACSHA512Algorithm` | `HMACSM3Algorithm` |
| `ISymmetricAlgorithm` | ISymmetricAlgorithm.cs | `AESSymmetricAlgorithm`（AES-128-CBC） | `SM4SymmetricAlgorithm`（SM4-CBC） |
| `IAsymmetricAlgorithm` | IAsymmetricAlgorithm.cs | `RSAAsymmetricAlgorithm` | `SM2AsymmetricAlgorithm` |
| `IPasswordHasher` | IPasswordHasher.cs、`Pbkdf2PasswordHasherBase` | `BCryptPasswordHasher`、`Pbkdf2PasswordHasher`（HMAC-SHA512） | `Pbkdf2SM3PasswordHasher`（HMAC-SM3） |

- `CryptoStandard`（枚举）：`International` / `NationalStandard`。
- DI 入口与构建器：`.../algorithm/CryptoServiceExtensions.cs`。`CryptoUtility` 为内部工具。
- 详见 `net-auth` 技能。

#### 数据库批量与工具（database/）

| 类/接口 | 文件 | 用途 |
|---------|------|------|
| `IDbAsyncBulk` / `PostgresqlAsyncBulk` | `.../database/IDbAsyncBulk.cs`、`PostgresqlAsyncBulk.cs` | PostgreSQL 批量：`InitDefaultMappings<T>()`、`CopyToServer`/`CopyToServerWithoutUniqueKey`/`MergeToServer`/`UpdateToServer`/`MergeAndDeleteToServer`/`CreateTempTable`（均有连接串与 DbConnection 两重载）。基于 `NpgsqlBinaryImport`。 |
| `[DbBulk]`（`DbBulkAttribute`） | `.../database/DbBulkAttribute.cs` | 批量列映射特性：`Ignore`/`ColumnName`/`Type(NpgsqlDbType)`/`UnknownType`。 |
| `DbBulkExtension` | `.../database/DbBulkExtension.cs` | `ToNpgsqlType(this Type)` CLR→NpgsqlDbType 映射。 |
| `NpgMappingInfo` | `.../database/NpgMappingInfo.cs` | 列映射 POCO：`DbKey`/`ObjectKey`/`Type`/`UnknownType`。 |
| `ExpressionExtensions` | `.../database/ExpressionExtensions.cs` | LINQ 表达式组合：`Compose<T>`/`And<T>`/`Or<T>`（动态拼 where）。 |
| `PostgresqlToCsvExporter` | `.../database/PostgresqlToCsvExporter.cs` | `TableToCsv`/`SelectToCsv`/`ToCsv`（`COPY ... TO STDOUT` 导出）。 |
| `BulkCopyException` / `NpgSqlParameterCreater` | 同目录 | 异常类 / `IDbParameterCreater` 实现。 |

- 详见 `net-efcore-developer` 技能（批量操作小节）。

#### 分组查询构建器（query/）

用于复杂**分组/聚合/动态条件**查询，避免手拼 SQL 字符串。

| 类/接口 | 文件 | 用途 |
|---------|------|------|
| `ISqlGroupHandler` / `DefaultSqlGroupHandler` | `.../query/ISqlGroupHandler.cs`、`DefaultSqlGroupHandler.cs` | 从分组类型 + 查询数据构建 WHERE/JOIN/GROUP BY/ORDER BY。 |
| `NpgsqlGroupHandler` / `SqlServerGroupHandler` | 同目录 | 数据库方言特化（Npgsql 保留键为独立列；SqlServer 用 `+','+` 拼接）。 |
| `IQueryHandler` / `DefaultQueryHandlerFactory` | `IQueryHandler.cs`、`IQueryHandlerFactory.cs` | 按 `WhereQueryType` 生成条件片段的处理器工厂。 |
| `BetweenQueryHandler`/`InOrNotQueryHandler`/`LikeQueryHandler`/`SingleSymbolQueryHandler` | 同目录 | 各条件处理器（BETWEEN、IN/NOT IN、LIKE/前缀/后缀/包含、=/>/>=/</<=）。 |
| `SqlGroup` / `GroupQueryData` | 同目录 | 结果 POCO（GroupKey/SelectGroupKey/Where/Join/OrderBy/List）/ 输入 POCO（GroupType/QueryType/Values）。 |
| `WhereQueryType`（枚举） | `.../query/WhereQueryType.cs` | `Equals,Between,In,NotIn,Greater,GreaterEquals,Less,LessEquals,Like,NotLike,StartsWith,EndsWith,Contains,NotContains`。 |

- 详见 `net-efcore-developer` 技能。

#### Redis 缓存与分布式锁（redis/）

| 类 | 文件 | 用途 |
|----|------|------|
| `RedisCacheManager` | `.../redis/RedisCacheManager.cs` | 缓存域基类（**非抽象**）。构造 `(IRedisDatabase redis, ILogger log)`。内置：Polly 熔断（`ExceptionAllowed` 默认 3、`Duration` 默认 5 分钟，熔断期返回默认值）、防击穿（每 key `SemaphoreSlim` + double-check）、TTL ±10% 抖动防雪崩。方法：`GetSingle<TResult>(key, func, timespan?, default_value)`、`GetMultiple<TResult>(keys, func, offset?, default_value)`、`RemoveSingle(key)`、`RemoveMultiple(keys)`、`AddOrUpdate<TResult>(key, model, timespan?)`、`AddOrUpdateMultiple<TResult>(Tuple<string,TResult>[], offset?)`。 |
| `RedisLock` | `.../redis/RedisLock.cs` | 分布式锁，`IAsyncDisposable`。`Lock(key, timespan)`/`UnLock()`，`StringSet When.NotExists` + Lua 原子释放，`await using` 自动释放。 |
| `RedisExtension` | `.../redis/RedisExtension.cs` | DI：`AddRedisExtensionService(services, config)` 注册 `RedisLock`/`IRedisClient`/`IRedisDatabase`/`RedisOptions` 等；`AddRedisHealthCheck()`。配置节 `"RedisExtension"`。 |
| `RedisOptions` / `RedisHealthCheck` | 同目录 | `Connection`/`KeyPrefix`/`DefaultDatabase`；健康检查。 |

- 详见 `net-cache-use` 技能。

#### JSON 序列化（json/）

`DateTimeConverter`、`DateTimeNullableConverter`、`DateTimeOffsetConverter`、`DateTimeOffsetNullableConverter`（统一 `yyyy-MM-dd HH:mm:ss` 格式）、`JsonLowercasePolicy`（属性名全小写）。文件均在 `.../json/`。

#### 其它工具（根目录）

`GpsHelper`、`TransGPS`（WGS-84/GCJ-02/BD-09 转换）、`PinYinConverter`（汉字转拼音）、`TimestampHelper`（Unix 时间戳）、`SocketExtension`、`UdpReceiveSocket`、`PdfSanitizer`。

---

### 1.2 `ThirdNet.Vibe.WebAPI`（Web 框架库）

#### 分页与通用扩展（根 + controller/）

| 类 | 文件 | 用途 |
|----|------|------|
| `ThirdNetWebApiExtensions` | `Library/ThirdNet.Vibe.WebAPI/ThirdNetWebApiExtensions.cs` | **`ToPageListAsync<T>(this IQueryable<T> query, int page_index, int page_size, int? count=null)` → `Task<PageListInfo<List<T>>>`**（分页，框架提供，无需手写）。另有 `GetAllFunctions`/`GetAllPermissionCatalogs`（反射扫描端点与权限目录）。 |
| `PageListInfo<T>` | `.../PageListInfo.cs` | 分页结果 POCO：`List`/`Total`/`Index`/`Pages`。 |
| `WebApiException` | `.../WebApiException.cs` | 业务异常：`HttpStatusCode` + `Error`。 |
| `SaveChangesWithUniqueGuardAsync` | （`DbContext` 扩展方法，本库内） | 保存变更并在唯一约束冲突时转译为 `WebApiException`：`db.SaveChangesWithUniqueGuardAsync(HttpStatusCode, string)`。兜底 `AnyAsync` 查重与落库之间的 TOCTOU 竞态，避免裸 `DbUpdateException` 冒泡成 500。详见 `net-efcore-developer`「保存变更 / 唯一冲突兜底」。 |
| `ErrorInfo` | `.../ErrorInfo.cs` | `error`/`error_description`/`code`。 |
| `DefaultOptions` | `.../DefaultOptions.cs` | 根配置：`DefaultConnectionString`/`VisitLog`/`Timestamp`/`SwaggerAuth`/`AdminSecret`。 |

#### 框架数据库与实体（model/）

`ThirdNetDbContext`（`.../model/ThirdNetDbContext.cs`）—— 框架库 DbContext（public schema），管理：`IpBlackList`/`IpWhiteList`/`RolesInfoList`/`ApplicationInfoList`/`RolesAuthorityList`/`ApplicationAuthorityList`/`VisitLogList`/`VisitLogHistoryList`/`ActionList`/`PermissionCatalog`/`BackgroundInfo` 等。配套实体模型与 EF 配置在 `model/`、`model/configuration/`、`model/cache/`。

#### 认证（Authentication/）

| 类/接口 | 文件（Authentication/） | 用途 |
|---------|------|------|
| `IAccountValidator` | Bearer/Validation/IAccountValidator.cs | `Task<List<Claim>> Validate(account, password)`，校验账密并产出 JWT claims（无 scope）。 |
| `ICheckClient` / `DefaultCheckClient` | Basic/ | 应用（HMAC）认证：`Check(name, password, request)`；默认实现查应用缓存、校验 IP 白名单或 HMAC 签名。 |
| `IRolesProvider` / `DefaultRolesProvider` | Basic/ | `GetRolesAsync(name)`，默认读 `ApplicationAuthorityCache`。 |
| `IApiKeyValidator` / `ApiKeyValidationResult` | ApiKey/ | `ValidateAsync(apiKeyPlain)`；默认 no-op，Admin 项目用 `CachedApiKeyValidator` 覆盖。 |
| `BasicAuthenticationHandler` / `ApiKeyAuthenticationHandler` | Basic/、ApiKey/ | "Basic"/"ApiKey" scheme 处理器，写 `client_id`/`scope` claims。 |

**JWT 签名与 Token（Authentication/Bearer/）：**
`ISigner` / `RSASigner` / `SM2Signer`（Signing/）、`IJtiCheck`/`InMemoryJtiCheck`（JTI 去重）、`JwtTokenManager`/`JwtTokenGenerator`/`JwtHelper`、`JwtOptions`、`JwtSignType`（枚举 `SM2`/`RSA`，定义顺序即如此）、`ThirdNetTokenHandler`（TokenManagement/）。

- 详见 `net-auth` 技能。

#### 授权（Authorization/）—— 三层

| 层 | 类/特性 | 文件（Authorization/） | 用途 |
|----|---------|------|------|
| 权限（细粒度+通配符） | `[PermissionAuthorize("sys:user:add")]`、`PermissionAuthorizationHandler`、`PermissionAuthorizationRequirement`、`IPermissionProvider`、`PermissionMatcher` | Permission/ | 读 `admin_roles` claim → `IPermissionProvider.GetPermissionsAsync` → `PermissionMatcher.Matches`（支持 `*`、`sys:*`、`sys:user:*`）。多特性为 OR。 |
| 范围（scope） | `[ProviderAuthorize("scope1,scope2")]`、`ProviderAuthorizationHandler`、`ProviderRequirement` | Provider/ | 基于 JWT **scope claim** 的范围授权，按逗号拆分匹配。API Key 场景常用。 |
| 策略路由 | `ProviderPolicyProvider` | Provider/ | `IAuthorizationPolicyProvider`：`Permission*`→权限、`Provider*`→范围、其余回落默认。 |
| 角色 | `ThirdNetAuthorizationHandler`、`ThirdNetAuthorizationRequirement`、`RolesAuthorityComparer` | RoleBased/ | 默认基于角色的授权。 |

- 详见 `net-auth` 技能。

#### 过滤器（Filters/）

`ValidateModelAttribute`（`ModelState` 无效抛 `WebApiException(BadRequest)`）、`CustomExceptionFilter`（捕获 `WebApiException`→结构化 JSON 错误；其它→500 `server_error`）、`DefaultResultHeaderFilter`（加 `X-Content-Type-Options:nosniff`/`X-Frame-Options:deny`）、`AdminSecretAuthorizeAttribute`（校验 `X-Admin-Secret` 头，常量时间比较）。

#### 中间件（Middleware/）

`AccountTokenCheckMiddleware`（Token `nbf` 与缓存失效时间比对，过期抛 `WebApiException(Unauthorized,"token_need_change")`）、`BlackIpMiddleware`（CIDR 黑名单，403）、`RequestLoggerMiddleware`（经 `IVisitLogger` 记访问日志）；配套 `IAccountTokenTimeCache`/`DefaultAccountTokenTimeCache`、`IGetAccountTokenKey`/`DefaultGetAccountTokenKey`。

#### 限流（ratelimit/）

`ThirdNetRateLimitingExtensions`：`AddThirdNetIpRateLimiting()` / `AddThirdNetIpAndApplicationRateLimiting()` / `AddThirdNetIpAndApplicationPathRateLimiting()`（基于 ASP.NET Core 内置 `RateLimiter`，固定窗口/分钟，超限 429）。配置 `"RateLimiting": { "Times": 500 }`。**Admin 模板在 `AddAdminCommonInfrastructure` 内实际注册的是 `AddThirdNetIpAndApplicationPathRateLimiting(config)`（IP+应用+路径 变体），而非 IP-only 版本。**

#### Multipart 上传（multipart/）

`MultipartData`：`Files`（`List<MultipartFileInfo>`）+ `DataList`（`List<MultipartStringInfo>`）。

#### 访问日志（Logging/）

`IVisitLogger` / `DefaultVisitLogger` / `DatabaseVisitLogger`、`NpgsqlVisitLogRunner`（`BackgroundRunner` 批量写访问日志）、`VisitLogCleanupRunner`（清理历史访问日志）。

#### 内置管理控制器（controller/）

`CacheManagerController`、`RedisManagerController`、`LogManagerController`、`BackgroundLogController`（开箱即用的管理端点）、`DatabaseBackgroundLogger`（`IBackgroundLogger` 写库实现）、`ManagerControllerHelper`（`Check(context, server_secret)` 校验 admin secret）。

#### DI 与管线扩展

| 类 | 文件 | 用途 |
|----|------|------|
| `ThirdNetServiceCollectionExtensions` | `.../ThirdNetServiceCollectionExtensions.cs` | `AddThirdNetMvcWithPostgresql()`（MVC+认证+缓存 runner+过滤器+批量等一站式注册）、`AddThirdNetDefaultDatabaseAndCache()`、`AddThirdNetDefaultMvc()`。 |
| `ThirdNetApplicationBuilderExtensions` | `.../ThirdNetApplicationBuilderExtensions.cs` | `UseThirdNetMvc()` 管线顺序：ForwardedHeaders → RateLimiter → ExceptionHandler → Routing → RequestLogger → Authentication → Authorization → AccountTokenCheck → MapControllers。 |
| `HttpContextHelper` | `.../HttpContextHelper.cs` | `GetRemoteIp()`/`GetCurrentClientId()`/`GetCurrentUserName()`/`GetCurrentRoles()`/`GetCurrentIdentityProvider()`/`GetCurrentNameIdentifier()`。 |
| `DatabaseMigrationExtensions` | Data/DatabaseMigrationExtensions.cs | EF Core 迁移辅助。 |
| `CidrMatcher` | `.../CidrMatcher.cs` | CIDR 表示法 IP 匹配。 |
| `CorsOptions` / `ThirdNetCorsExtensions` | 根 | CORS 配置与辅助。 |

---

## 第 2 层：模板生成层（非框架，随项目生成）

这些类**不在框架 NuGet 里**，而是 `dotnet new thirdnet-admin` 生成项目时带出，位于生成项目的 `Tools/{ProjectName}.Common`、`Tools/{ProjectName}.Cache`、`Admin/{ProjectName}.Admin.APIService`。命名空间以 `{ProjectName}` 前缀。

### 控制器基类与操作者上下文

| 类 | 命名空间 | 参考文件 | 用途 |
|----|---------|---------|------|
| `AdminControllerBase` | `{ProjectName}.Common.Controllers` | `Tools/{ProjectName}.Common/Controllers/AdminControllerBase.cs` | 抽象 `[ApiController][Authorize]`。属性 `CurrentUserId`/`CurrentUserName`/`CurrentDeptId`；`IActionFilter` 在 Action 前自动 `IOperatorContext.Initialize(CurrentUserId)`（ApiKey 鉴权跳过）。 |
| `IOperatorContext` | `{ProjectName}.Common.Interfaces` | `.../Interfaces/IOperatorContext.cs` | `Initialize(long operatorId)`。 |
| `OperatorContext` | `{ProjectName}.Cache.Context` | `Tools/{ProjectName}.Cache/Context/OperatorContext.cs` | Scoped，基于 `AsyncMemo`。`GetPermissions()`/`HasWildcardPermission()`/`GetUserInfo()`/`GetUserRoleIds()`/`GetVisibleDeptIds()`。 |
| `ClaimsPrincipalExtensions` | `{ProjectName}.Common.Extensions` | `.../Extensions/ClaimsPrincipalExtensions.cs` | `GetUserId()`/`GetUserName()`/`GetDeptId()`（从 JWT claim 取）。 |

### 分页 / 常量

| 类 | 命名空间 | 用途 |
|----|---------|------|
| `PageQueryDto` | `{ProjectName}.Common.DTOs` | 基础分页入参：`page_index`(默认1)/`page_size`(默认20，上限1000)。 |
| `SystemConfigKeys` | `{ProjectName}.Common.Constants` | 系统配置键常量（对应 `t_sys_config.config_key`，见下表）。 |

**`SystemConfigKeys` 全部键**：

| 常量 | 值 | 默认 |
|------|----|------|
| `MaxLoginAttempts` | `max_login_attempts` | 5 |
| `LockoutDurationHours` | `lockout_duration_hours` | 12 |
| `SessionTimeoutMinutes` | `session_timeout_minutes` | 15 |
| `PasswordExpiryDays` | `password_expiry_days` | 0（永不过期） |
| `ShowLoginErrorDetail` | `show_login_error_detail` | false |
| `CaptchaEnabled` | `captcha_enabled` | true |
| `UploadAllowedExtensions` | `upload_allowed_extensions` | 15 种 |
| `HeartbeatIntervalSeconds` | `heartbeat_interval_seconds` | 180（在线阈值 3×） |

### 操作日志（OperLog/）

| 类 | 命名空间 | 用途 |
|----|---------|------|
| `[OperLog]`（`OperLogAttribute`） | `{ProjectName}.Common.OperLog` | 标记 Action 记录操作日志：`Title`/`BusinessType`。 |
| `OperLogFilter` | 同上 | `IAsyncActionFilter`，拦截 `[OperLog]` 采集请求/响应。 |
| `IOperLogLogger` / `OperLogEntry` | 同上 | 日志接口 / 日志 POCO。 |
| `DatabaseOperLogLogger` | 同上 | `BackgroundRunner` + `IOperLogLogger`，每 30s 经 `IDbAsyncBulk` 批量写 `admin.t_sys_oper_log`。 |

### 枚举字典（Enums/）

| 类 | 命名空间 | 用途 |
|----|---------|------|
| `[SystemDict]`（`SystemDictAttribute`） | `{ProjectName}.Common.Enums` | 标记枚举为系统字典：`DictTypeKey`/`DisplayName`，启动自动同步到 `t_sys_dict_type`/`t_sys_dict_data`。 |
| `[EnumMeta]`（`EnumMetaAttribute`） | 同上 | 标记枚举成员：`Label`（显示名）、可选 `DbValue`。 |
| `SystemEnumRegistry` | 同上 | 反射扫描带 `[SystemDict]` 的枚举。 |
| `SystemEnumDictSync` | `{ProjectName}.Admin.APIService.Data` | `SyncAsync(AdminDbContext)`，幂等同步代码枚举到库。 |

> 同步触发点：`Program.cs` 调 `host.InitializeDatabasesAsync()`（即 `MigrateHelper.InitializeDatabasesAsync(this IHost)` 扩展），迁移 `AdminDbContext` 时调用 `SystemEnumDictSync.SyncAsync(db)`。

### 缓存域（{ProjectName}.Cache.Domain）

均继承框架 `RedisCacheManager`，作为 Singleton 经 `AddAdminCacheServices()` 注册（**例外：`OnlineCache` 不继承 `RedisCacheManager`、无 Read-Through 语义，构造时直接注入 `IDatabase`**）。参考实现中的缓存域：

| 缓存域 | 参考文件（Tools/{ProjectName}.Cache/Domain/） | 主要职责 |
|--------|------|---------|
| `UserCache` | UserCache.cs | 用户信息、权限、角色缓存；`UserCacheInvalidation` 配套失效。 |
| `MenuCache` | MenuCache.cs | 菜单树缓存（用 `TreeBuilder.BuildForest`）。 |
| `RoleCache` | RoleCache.cs | 角色→权限（`GetRolePermissions`）。 |
| `TokenCache` | TokenCache.cs | Token 失效时间（实现 `IAccountTokenTimeCache`：`SetTokenInvalidationTime`/`ClearTokenInvalidationTime`/`TryGetAsync`）。注意：`GetUserRoleIds` 在 `UserCache` 上，不在 `TokenCache`。 |
| `ConfigCache` | ConfigCache.cs | 系统配置缓存（`GetConfigInt`/`GetConfigBool`/`RemoveConfigDic`）。 |
| `DictCache` | DictCache.cs | 字典数据按 dict_type 缓存（含系统枚举和自定义字典）；key `admin.dict.data.{dictType}`，TTL 24h。 |
| `DeptCache` | DeptCache.cs | 部门树/可见部门。 |
| `OnlineCache` | OnlineCache.cs | 在线状态（`BatchCheckOnlineStatus`）。**例外**：不继承 `RedisCacheManager`、无 Read-Through，直接注入 `IDatabase`；在线阈值 = 3× 心跳（默认 180s → 540s）。 |
| `ApiKeyCache` | ApiKeyCache.cs | API Key SHA256 哈希验证；key `admin.apikey.hash.{hash[:16]}`，TTL 8h。 |

### 业务层失效助手

| 类 | 命名空间 | 参考文件 | 用途 |
|----|---------|---------|------|
| `UserCacheInvalidation` | `{ProjectName}.Admin.APIService.Services` | `Admin/{ProjectName}.Admin.APIService/Services/UserCacheInvalidation.cs` | 静态 `InvalidateUserAuthAsync(UserCache, TokenCache, userId)`：清权限+角色缓存并设 Token 失效时间。**用户/角色变更后必须调用**。 |
| `AdminAccountValidator` | `{ProjectName}.Admin.APIService.Auth` | `.../Auth/AdminAccountValidator.cs` | `IAccountValidator` 实现：校验账密、查锁定（用 `SystemConfigKeys`）、产出 JWT claims。 |
| `CachePermissionProvider` | `{ProjectName}.Cache.Auth` | `Tools/{ProjectName}.Cache/Auth/CachePermissionProvider.cs` | `IPermissionProvider` 实现：经 `RoleCache` 解析角色权限。 |
| `CachedApiKeyValidator` | `{ProjectName}.Cache.Auth` | `Tools/{ProjectName}.Cache/Auth/CachedApiKeyValidator.cs` | `IApiKeyValidator` 实现：SHA256 哈希 → `ApiKeyCache` 查找 → 状态/过期检查。 |

### DI 扩展（{ProjectName}.Common 与 .Cache）

`AdminServiceCollectionExtensions`（`Extensions/AdminServiceCollectionExtensions.cs`）：`AddAdminCommonInfrastructure(config, assemblyName)`（框架 DB+JWT+Redis+限流+加密+MVC）、`AddAdminCacheServices()`（所有缓存域 Singleton）、`AddAdminCommonHelpPage(config)`、`AddAdminCommonControllers(...)`。`AdminApplicationBuilderExtensions`（`Extensions/AdminApplicationBuilderExtensions.cs`）：`UseAdminCommonMiddleware(IApplicationBuilder, ILoggerFactory, IApiVersionDescriptionProvider, HelpPageOptions)` —— 依次 `UseResponseCompression` → `UseThirdNetVersioningHelpPage` → `UseThirdNetMvc`（最内层即框架层 `UseThirdNetMvc()` 的管线顺序；不存在 `UseAdminCommonMvc()` 方法）。`AdminHostBuilder`（`Hosting/AdminHostBuilder.cs`，命名空间 `{ProjectName}.Common.Hosting`）：`BuildAdminWebHost<TStartup>(args) → IHost`（名字含"Admin"但为通用构建方法）。

---

## 第 3 层：项目结构与命名校准

### 命名约定

- 模板 `sourceName` 为 `"ThirdNetVibe"`，生成时按 `-n` 前缀替换为 `{ProjectName}`，所有类命名空间随之变为 `{ProjectName}.*`。
- 技能中描述「文件放在哪」时一律用**生成项目路径**（`Admin/{ProjectName}.Admin.APIService/...`、`Tools/{ProjectName}.Common/...`）。

### 生成项目结构（`dotnet new thirdnet-admin -n {ProjectName} -o {ProjectName}.Admin`）

```
{ProjectName}.Admin/
├── Admin/
│   ├── {ProjectName}.Admin.APIService/   # Controllers/Services/DTOs/Auth/Data/Jobs, Program.cs, Startup.cs, MigrateHelper.cs
│   └── {ProjectName}.Admin.Database/     # AdminDbContext + Models + EntityConfigurations + SeedData
└── Tools/
    ├── {ProjectName}.Common/       # Constants/Enums/Controllers/DTOs/Extensions/Hosting/Interfaces/OperLog/Validation
    └── {ProjectName}.Cache/        # Auth/Context/DbContext/Domain/Extensions/View
```

### `ThirdNet.Migrate` —— 模板升级工具（非数据库工具）

模板升级工具 `ThirdNet.Migrate`，CLI：

```
thirdnet-migrate check   # 检查模板是否有新版本
thirdnet-migrate diff    # 预览用户项目与最新模板的差异
thirdnet-migrate apply   # 把模板更新应用到用户项目（支持 --dry-run --force --non-interactive）
```

内部经 `ProjectScanner`/`TemplateExtractor`/`SourceNameReplacer`/`FileDiffer`/`MigrationPreparer` 完成「扫描→下载→替换 sourceName→三方 diff→应用」。用于让已生成的项目跟进模板更新。

> 这里只给出命令速查。**完整的升级流程**——manifest 模式、6 态文件分类（框架文件 vs 业务文件）、冲突决策矩阵、`--force` 仅限纯框架文件的边界——见独立的 `thirdnet-template-upgrade` 技能（模板升级的单一事实来源）。`net-microservice-generator` 技能则覆盖「新建项目」场景。

---

## 反向索引：按域查技能

| 需求 | 技能 | 本目录小节 |
|------|------|-----------|
| 控制器/Service/DTO/分页 | `net-api-developer` | 1.2 分页、2 控制器基类 |
| 实体/DbContext/迁移/分组查询/批量增改同步 | `net-efcore-developer` | 1.1 query、1.1 database、1.2 model |
| 缓存域/RedisCacheManager/锁 | `net-cache-use` | 1.1 redis、2 缓存域 |
| 认证/授权/加密/Token/角色/菜单/scope | `net-auth` | 1.1 algorithm、1.2 认证、1.2 授权、2 OperatorContext |
| 后台任务 | `net-background-job` | 1.1 async |
| 枚举字典 | `net-enum-dict` | 2 Enums |
| 创建项目/架构/限流/上传/IP/模板升级 | `backend-workflow` | 1.2 限流/multipart/Middleware、3 |
