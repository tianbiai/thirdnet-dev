# 生产构建 Mock 数据剥离机制

> 何时需要读：当你要修改 `vite.config.ts` 中的 `mockDataStripPlugin`、排查生产包是否真正不含 Mock 数据、为新前端工程（Web / 小程序 minigram——这些是**构建目标/工程目录**，与端类型 manager/app/third 正交）配备该插件，或排查 tree-shaking 失效问题时再读。日常切换 Mock 开关无需读。

生产构建（`vite build`）**且 Mock 关闭**时，通过自定义 Vite 插件 `mockDataStripPlugin()`（`vite.config.ts`）剥离 Mock 数据，配合 `MOCK_ENABLED` 静态为 `false` 让 Mock 分支成为死代码被 tree-shaking 移除。Mock 开启的生产构建（原型/演示）不剥离。

## 完整插件源码（可直接粘贴运行）

下面是与 `frontend/web/vite.config.ts` 一致的完整实现——不是省略版，含 `fs` 读文件、`@/` 别名解析、导出名提取、空桩生成、`loadEnv` 读 Mock 开关、`command === 'build' && !mockEnabled` 双守卫、`.filter(Boolean)` 挂载。照抄即可运行：

```typescript
// vite.config.ts
import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'

/**
 * 生产构建 Mock 数据剥离插件
 *
 * 仅在「生产构建（command === 'build'）且 Mock 关闭（VITE_MOCK_ENABLED !== 'true'）」时由
 * defineConfig 挂载。挂载后拦截 @/mock/data/ 导入，读取原文件导出名称，生成等价的空数组桩模块。
 * 配合 MOCK_ENABLED=false 让 new MockXxxApi() 分支成为死代码，被 tree-shaking 移除。
 *
 * Mock 开启的生产构建（原型/演示，VITE_MOCK_ENABLED=true）不挂载本插件——此时 Mock 分支是
 * 存活分支，剥离 /mock/data/ 会让演示界面拿不到数据。
 *
 * 拦截范围仅 /mock/data/（数据层）；/mock/api/（Mock 类）靠 MOCK_ENABLED + tree-shaking。
 */
function mockDataStripPlugin(): Plugin {
  const prefix = '\0mock-stub:'
  // 注：__dirname 在 vite.config.ts 中可用 —— vite 加载配置时会 shim（非 Node 原生 ESM 行为）。
  const srcDir = path.resolve(__dirname, 'src')

  return {
    name: 'mock-data-strip',
    enforce: 'pre',
    resolveId(source, importer) {
      // 只拦截路径含 /mock/data/ 的导入
      if (!source.includes('/mock/data/')) return null
      // @/ 别名基于 srcDir 解析；其余按 importer 相对解析
      const resolved = source.startsWith('@/')
        ? path.resolve(srcDir, source.slice(2))
        : path.resolve(path.dirname(importer || srcDir), source)
      return prefix + resolved
    },
    load(id) {
      if (!id.startsWith(prefix)) return null
      const realPath = id.slice(prefix.length)

      // 尝试读取原 mock 文件
      const candidates = [realPath, realPath + '.ts', realPath + '.js']
      let content: string | null = null
      for (const p of candidates) {
        try { content = fs.readFileSync(p, 'utf-8'); break } catch { /* next */ }
      }
      if (!content) return 'export {}'

      // 提取所有具名导出
      const names = [...content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g)]
        .map(m => m[1])
      if (names.length === 0) return 'export {}'

      // 生成空数组桩 —— 桩值不影响正确性：该分支为死代码（MOCK_ENABLED=false 时永不执行），仅为占位
      return names.map(n => `export const ${n} = []`).join('\n')
    },
  }
}

export default defineConfig(({ command, mode }) => {
  // 仅「生产构建 + Mock 关闭」时启用剥离：
  //   MOCK_ENABLED=false（正式/测试）→ 剥离 /mock/data/，配合 tree-shaking 移除 Mock 类
  //   MOCK_ENABLED=true（原型/演示构建）→ 不剥离，保留真实 Mock 数据供演示
  //
  // 注：MOCK_ENABLED（import.meta.env.VITE_MOCK_ENABLED）在 vite.config.ts 作用域不可用，
  //     配置期必须用 loadEnv(mode, process.cwd()) 读 .env。
  const env = loadEnv(mode, process.cwd())
  const mockEnabled = env.VITE_MOCK_ENABLED === 'true'
  return {
    plugins: [
      // 其它插件保持不变：
      //   web      → vue() / AutoImport / Components ...
      //   minigram → uni()
      command === 'build' && !mockEnabled ? mockDataStripPlugin() : null,
    ].filter(Boolean),
  }
})
```

## 拦截范围（重要）

插件**只拦截 `/mock/data/`**（Mock 数据文件），**不拦截 `/mock/api/`**。

- `/mock/data/**`：被替换为空数组桩，真实 Mock 数据不进生产包。
- `/mock/api/**`（`MockXxxApi` 类）：不靠本插件。它通过 `MOCK_ENABLED=false` 让工厂函数中 `new MockXxxApi()` 所在分支不可达，再由 Rollup tree-shaking 移除整个类。

开发模式（`command !== 'build'`）插件不启用，Mock 模块正常加载。**Mock 开启的生产构建**（`command === 'build'` 且 `VITE_MOCK_ENABLED=true`，即原型/演示构建）也不启用——此时 Mock 分支存活，需保留真实 Mock 数据。

## 原理

生产构建**且 Mock 关闭**时（`command === 'build' && !mockEnabled`），所有 `/mock/data/**` 的导入被 `mockDataStripPlugin` 拦截，替换为「每个具名导出 = 空数组 `[]`」的虚拟桩模块。由于 `MOCK_ENABLED` 静态为 `false`，工厂函数中 `new MockXxxApi()` 所在分支不可达，Rollup tree-shaking 移除该分支；Mock 数据本身已被桩替换为空数组，最终产物中不含真实 Mock 数据。若 Mock 开启（原型/演示构建），插件不挂载，`/mock/data/**` 原样保留供演示。

**切换流程**：通过环境变量 `VITE_MOCK_ENABLED`（开发期 `.env`）控制，无需手动改配置。工厂函数在模块初始化时执行一次，运行期间不再切换。

## Web 与小程序端一致性

`api-typescript-spec` 覆盖 Web 与 uniapp 小程序两端，`mockDataStripPlugin` 因此**两端都需配备**：`frontend/web/vite.config.ts` 与 `frontend/minigram/vite.config.ts` 直接复用同一个 `mockDataStripPlugin` 函数即可。

**小程序端关键差异**：`frontend/minigram/vite.config.ts` 默认常写成对象形式 `defineConfig({...})`，对象形式拿不到 `command`/`mode`，插件守卫失效。必须改为**函数形式** `defineConfig(({ command, mode }) => ({...}))` 才能既按 `command === 'build'` 启用插件、又用 `loadEnv(mode, ...)` 读 Mock 开关：

```typescript
// frontend/minigram/vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
// mockDataStripPlugin 定义同上文（两端可共享一个文件导入，或各自内联同一函数）

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd())
  const mockEnabled = env.VITE_MOCK_ENABLED === 'true'
  return {
    plugins: [
      uni(),
      command === 'build' && !mockEnabled ? mockDataStripPlugin() : null,
    ].filter(Boolean),
  }
})
```

> Web 端 `defineConfig` 已是函数形式；只在小程序端需注意从对象形式改为函数形式（并解构 `mode`）。

## 生产包验证

> 仅适用于 **Mock 关闭**的正式/测试构建。原型/演示构建（`VITE_MOCK_ENABLED=true`）产物**应含** Mock 数据，本验证不适用。

构建后验证生产包确实不含 Mock 数据：在产物目录（如 `dist/`）grep 一个**只存在于 `mock/data/**`** 的特征字面量（如某条 mock 订单号、测试手机号），应**无命中**。

> 注意：`mock/api/**` 的 Mock 类方法体中硬编码的值（如某些测试手机号）即使成为死代码也可能在 tree-shaking 阶段残留——这是 Mock 类死代码遗留（与 web 一致）。因此验证字面量应挑选 `mock/data` 文件**独有**的，而非 `mock/api` 类方法体里的。

## 生产环境剥离开发辅助文案

帮助气泡文案、操作提示、开发辅助说明等仅用于演示/调试的文本，不能仅靠 `v-if` 隐藏——字符串本身仍会进入生产 JS bundle。必须通过 `MOCK_ENABLED` 条件守卫，让 Vite 在生产构建时通过 dead code elimination 彻底移除：

```typescript
// ✅ 正确：MOCK_ENABLED 生产构建时静态为 false，整个分支被 tree-shake 掉
const helpContent = MOCK_ENABLED
  ? '本页面用于管理订单，支持筛选、导出和批量操作'
  : ''

// ❌ 错误：字符串字面量会被直接打包进生产 bundle
const helpContent = '本页面用于管理订单，支持筛选、导出和批量操作'
```

适用于所有仅面向开发/演示的辅助文本，包括但不限于 HelpBubble 的 `content` prop。

## 通用性

该实现完全通用，不绑定具体项目或模块：

- `source.includes('/mock/data/')` 按路径子串拦截——任何模块、任何端类型（manager/app/third，及 shared 桶）只要数据放在 `mock/data/` 下都自动覆盖，**新增模块、新增端类型均无需改插件**。
- `srcDir = path.resolve(__dirname, 'src')` 中 `__dirname` 是 vite.config.ts 自身位置，`src` 是 ThirdNet 全前端统一的源码目录约定——约定依赖，非硬编码。
- `@/`→`src/` 是所有 ThirdNet 前端标准别名；`.ts`/`.js` 候选扩展名不限定文件名。

唯一前提是项目布局约定：vite.config 在工程根、源码在 `src/`、mock 数据在 `src/mock/data/`、别名 `@/`→`src/`——这正是 `api-typescript-spec` 在「目录结构」中规定的标准布局，所有遵循该技能的项目都满足。
