# 生产构建 Mock 数据剥离机制

> 何时需要读：当你要修改 `vite.config.ts` 中的 `mockDataStripPlugin`、排查生产包是否真正不含 Mock 数据，或排查 tree-shaking 失效问题时再读。日常切换 Mock 开关无需读。

生产构建（`vite build`）时，通过自定义 Vite 插件 `mockDataStripPlugin()`（`vite.config.ts`）剥离 Mock 数据，配合 `MOCK_ENABLED` 静态为 `false` 让 Mock 分支成为死代码被 tree-shaking 移除。

**真实机制**（与 `vite.config.ts` 一致，不是 alias 重定向）：

```typescript
// 仅在 command === 'build' 时启用
function mockDataStripPlugin(): Plugin {
  return {
    name: 'mock-data-strip',
    enforce: 'pre',
    resolveId(source, importer) {
      // 只拦截路径含 /mock/data/ 的导入
      if (!source.includes('/mock/data/')) return null
      // 解析到虚拟桩模块 ID
      return '\0mock-stub:' + resolvedPath
    },
    load(id) {
      if (!id.startsWith('\0mock-stub:')) return null
      // 读取原 mock 数据文件，提取所有 export 的名称
      const names = [...content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g)].map(m => m[1])
      // 为每个具名导出生成空对象桩（死代码分支不会实际使用）
      return names.map(n => `export const ${n} = {}`).join('\n') // 无具名导出则返回 'export {}'
    },
  }
}
```

**原理**：生产构建时，所有 `/mock/data/**` 的导入被 `mockDataStripPlugin` 拦截，替换为"每个具名导出 = 空对象 `{}`"的虚拟桩模块（不是空数组、也不重定向整个 `@/mock`）。由于 `MOCK_ENABLED` 静态为 `false`，工厂函数中 `new MockXxxApi()` 所在分支不可达，Rollup tree-shaking 移除该分支；Mock 数据本身已被桩替换为空对象，最终产物中不含真实 Mock 数据。**注意**：拦截范围是 `/mock/data/`（Mock 数据文件），不含 `/mock/api/`；Mock API 类的剥离依赖 `MOCK_ENABLED=false` + tree-shaking。开发模式下插件不启用，Mock 模块正常加载。

**切换流程**：通过环境变量 `VITE_MOCK_ENABLED`（开发期 `.env`）控制，无需手动改配置。工厂函数在模块初始化时执行一次，运行期间不再切换。

**生产环境剥离开发辅助文案**：帮助气泡文案、操作提示、开发辅助说明等仅用于演示/调试的文本，不能仅靠 `v-if` 隐藏——字符串本身仍会进入生产 JS bundle。必须通过 `MOCK_ENABLED` 条件守卫，让 Vite 在生产构建时通过 dead code elimination 彻底移除：

```typescript
// ✅ 正确：MOCK_ENABLED 生产构建时静态为 false，整个分支被 tree-shake 掉
const helpContent = MOCK_ENABLED
  ? '本页面用于管理订单，支持筛选、导出和批量操作'
  : ''

// ❌ 错误：字符串字面量会被直接打包进生产 bundle
const helpContent = '本页面用于管理订单，支持筛选、导出和批量操作'
```

适用于所有仅面向开发/演示的辅助文本，包括但不限于 HelpBubble 的 `content` prop。
