# 加密算法框架（AddCrypto）

本文件归档 ThirdNet 加密套件的注册方式与算法族对应表。本系统的密码哈希、JWT 签名、应用 HMAC 都建立在框架的加密套件上——**国密（GM）与国际双标准统一通过 DI 注册，不要手写加密算法**。

## 一次性注册整套算法

`ThirdNet.Vibe.Common.Algorithm.CryptoServiceExtensions.AddCrypto(...)`（NuGet 包内 `algorithm/CryptoServiceExtensions.cs`）：

```csharp
// 选标准即注册全部 5 个算法接口：IHashAlgorithm / IHmacAlgorithm / ISymmetricAlgorithm / IAsymmetricAlgorithm / IPasswordHasher
services.AddCrypto(CryptoStandard.NationalStandard);   // 国密：SM3/SM4/SM2，密码用 Pbkdf2SM3
services.AddCrypto(CryptoStandard.International);      // 国际：SHA512/AES/RSA，密码用 BCrypt（可选 usePbkdf2:true 用 PBKDF2）
// 可选参数：bcryptWorkFactor=11、usePbkdf2=false、pbkdf2Iterations=100000
```

需要混搭或单独替换某一项时，用构建器：`services.AddCrypto(b => b.UseHash<...>().UsePasswordHasher<...>())`。

## 算法族对应

| 接口 | 国际（International） | 国密（NationalStandard） |
|------|---------------------|------------------------|
| `IHashAlgorithm` | SHA512 | SM3 |
| `IHmacAlgorithm` | HMACSHA512 | HMACSM3（Basic 应用加密认证用） |
| `ISymmetricAlgorithm` | AES-128-CBC | SM4-CBC |
| `IAsymmetricAlgorithm` | RSA | SM2 |
| `IPasswordHasher` | BCrypt / PBKDF2(HMAC-SHA512) | PBKDF2(HMAC-SM3) |

> `IPasswordHasher` 命名空间 `ThirdNet.Vibe.Common.Algorithm.Abstractions`，方法 `Hash(plain)` / `Verify(plain, hash)`。`AdminAccountValidator` 即注入它来校验密码。

## JWT 签名

签名算法由 `JwtSignType`（枚举 `SM2`/`RSA`，定义顺序即如此）配置，框架经 `ISigner` 抽象派发到 `RSASigner`/`SM2Signer`（`ThirdNet.Vibe.WebAPI.Authentication.Bearer.Signing`）。切换签名算法只改配置，不改业务代码。

完整的算法类与签名类清单见 [能力目录](../../backend-workflow/references/framework-and-template-catalog.md) 的「加密算法」「认证」小节。
