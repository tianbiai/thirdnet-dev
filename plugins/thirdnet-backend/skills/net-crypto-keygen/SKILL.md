---
name: net-crypto-keygen
description: ThirdNet 加密密钥生成工具。生成 SM2、RSA、AES、SM4 等加密算法的密钥对，输出可直接复制粘贴到 appsettings.json 配置文件中。**主动用于**：生成密钥对、配置 JWT 签名密钥、设置加密算法密钥。当用户提到 SM2/RSA/AES/SM4 密钥生成、public_key/private_key 为空、需要更换密钥、或说"帮我生成一对密钥"、"密钥怎么配"、"JWT 密钥"、"加密密钥"时，必须使用此技能。
---

# ThirdNet 加密密钥生成

根据 ThirdNet 框架的加密体系，使用打包的 .NET 脚本生成密钥，输出 JSON 片段供用户直接粘贴到 `appsettings.json`。

## 密钥格式参考

| 算法 | 用途 | public_key | private_key | type |
|------|------|-----------|-------------|------|
| SM2 | JWT（国密） | Base64, 65 字节 | Base64, 32 字节 | `"SM2"` |
| RSA | JWT（国际） | Base64 DER SPKI, ~294 字节 | Base64 DER PKCS#8, ~1218 字节 | `"RSA"` |
| AES/SM4 | 对称加密 | — | — | Base64, 各 16 字节（key + iv） |

## 生成流程

### 1. 确认需求

用户未指定时默认生成 SM2。可选：SM2、RSA、AES、SM4。

算法通过选择不同的脚本目录来切换（非命令行参数），SM2 和 RSA 各有独立脚本，AES/SM4 共用 symmetric 脚本并通过 `dotnet run` 参数区分。

### 2. 复制脚本到临时目录并运行

根据算法类型，将技能目录下对应的脚本复制到 `/tmp/keygen` 并执行：

- **SM2** → `scripts/sm2/`（Program.cs + KeyGen.csproj）
- **RSA** → `scripts/rsa/`（Program.cs + KeyGen.csproj）
- **AES** → `scripts/symmetric/`（Program.cs + KeyGen.csproj），传入 `AES` 参数
- **SM4** → `scripts/symmetric/`（Program.cs + KeyGen.csproj），传入 `SM4` 参数

执行命令：

```bash
rm -rf /tmp/keygen && mkdir -p /tmp/keygen
cp <skill-dir>/scripts/<algorithm>/* /tmp/keygen/
cd /tmp/keygen && dotnet run   # SM2/RSA 无需参数
cd /tmp/keygen && dotnet run -- AES   # 对称加密需指定算法参数
cd /tmp/keygen && dotnet run -- SM4
```

其中 `<skill-dir>` 是本技能文件所在的目录路径。

### 3. 整理输出

脚本输出即为 JSON 格式的配置片段。将其包装为完整的配置节：

**JWT 密钥（SM2/RSA）**：

```json
"JwtOptions": {
  "public_key": "<脚本输出的 public_key>",
  "private_key": "<脚本输出的 private_key>",
  "type": "<脚本输出的 type>"
}
```

**对称密钥（AES/SM4）**：

脚本输出 Base64 编码的 16 字节密钥和 IV，需放置在对应的对称加密配置节中：

```json
"EncryptionOptions": {
  "key": "<Base64 编码的 16 字节密钥>",
  "iv": "<Base64 编码的 16 字节 IV>",
  "type": "<AES 或 SM4>"
}
```

### 4. 提醒用户

- 每次生成唯一，公钥私钥必须成对使用
- 私钥保密，勿提交到版本控制
- SM2 密钥长度由曲线固定，不可更改
