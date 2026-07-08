# 模板安装（取最新版的强制流程）

ThirdNet 模板（Admin / Service）每次安装都必须拿到 NuGet 源上的**最新版本**。下列四步是强制流程，不可省略：

```bash
dotnet nuget locals http-cache clear
dotnet new uninstall {TemplateName} 2>/dev/null || true
dotnet new install {TemplateName} --force
dotnet new list {TemplateShortName}
```

## 各步作用（关键：取最新真正依赖第 1 步的 http-cache clear）

- **a. 清 NuGet http-cache** —— 强制"最新版本号"解析回源，避免读到缓存的旧 `latest`。
- **b. 卸载已注册模板** —— 仅清 `dotnet new` 注册表，避免重复注册 / 路径混装；首次报"找不到"属正常。
- **c. `--force` 安装** —— 从源拉取最新模板并注册；`--force` 的作用是避免"模板已注册"报错，**不是**取最新的手段。
- **d. 核对版本** —— `list` 出已注册版本号，确认与 NuGet 源最新版一致；不一致说明源未发布新版或缓存未清。

## 各模板的包名 / 短名

| 模板 | `{TemplateName}`（包名） | `{TemplateShortName}`（list 用） |
|------|--------------------------|----------------------------------|
| Admin 管理后台 | `ThirdNet.Admin.Template` | `thirdnet-admin` |
| Service 微服务 | `ThirdNet.Service.Template` | `thirdnet-service` |

## NuGet 源

地址见 [internal-registry](internal-registry.md)（内网默认 `192.168.1.156:8088`，外网 `61.164.57.61:8088`）。
