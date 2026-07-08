# Apple 设计规范 · 组件样式与 Token 集成

> 本文件是 `design-apple` 技能的组件 CSS、CSS 变量集成与 Admin 模板主题覆盖参考资料。核心设计原则见 [SKILL.md](../SKILL.md) §1 视觉主题；色板色值见 [color.md](color.md)。

## 组件样式

### 主按钮（CTA）

```css
.btn-primary {
  background: #0071e3;
  color: #ffffff;
  padding: 8px 15px;
  border-radius: 8px;
  border: 1px solid transparent;
  font: 400 17px 'SF Pro Text', sans-serif;
}
.btn-primary:hover { filter: brightness(1.1); }
.btn-primary:active { background: #ededf2; color: #1d1d1f; }
.btn-primary:focus { outline: 2px solid #0071e3; }
```

### 深色按钮

```css
.btn-dark {
  background: #1d1d1f;
  color: #ffffff;
  padding: 8px 15px;
  border-radius: 8px;
  font: 400 17px 'SF Pro Text', sans-serif;
}
```

### 药丸链接（Learn More / Shop）

Apple 标志性的行内 CTA——透明底、蓝色文字、药丸形容器。

```css
.pill-link {
  background: transparent;
  color: #0066cc; /* 浅底 */ /* #2997ff 深底 */
  border-radius: 980px;
  border: 1px solid #0066cc;
  font: 400 15px 'SF Pro Text', sans-serif; /* 药丸链接字号 14–17px 视场景取 */
}
.pill-link:hover { text-decoration: underline; }
```

### 搜索/筛选按钮

```css
.btn-filter {
  background: #fafafc;
  color: rgba(0, 0, 0, 0.8);
  padding: 0 14px;
  border-radius: 11px;
  border: 3px solid rgba(0, 0, 0, 0.04);
}
.btn-filter:focus { outline: 2px solid #0071e3; }
```

### 卡片

```css
.card {
  background: #f5f5f7; /* 浅底 */ /* #272729 深底 */
  border: none; /* Apple 几乎不用可见边框 */
  border-radius: 8px;
  box-shadow: none; /* 多数卡片无阴影 */
  /* 仅产品展示卡片用阴影 */
  /* box-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px; */
}
```

### 导航栏

```css
.nav-apple {
  position: sticky;
  height: 48px;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  color: #ffffff;
  font: 400 12px 'SF Pro Text', sans-serif;
}
```

## Vue 3 CSS 变量集成

> ⚠️ **与 Admin 模板真实 token 的关系**：下文 CSS 变量是 Apple 设计规范的**设计意图**命名。**ThirdNet Admin 模板的 `styles/variables.css` 已经内置了一套真实 token，命名与下文不同**，且**未加载 SF Pro 字体**（沿用 Element Plus 默认字体栈）。在 Admin 模板中写样式时，**务必以 `variables.css` 的真实变量为准**，不要假设下文的 `--color-accent`/`--color-bg-dark`/`--nav-glass-bg`/`--radius-pill` 等存在。

### 设计意图 → Admin 模板真实 token 映射

| 设计意图（本技能） | Admin 模板真实 token（`styles/variables.css`） |
|---|---|
| Apple Blue `--color-accent` | `--color-primary: #0071e3`（运行时由 `stores/theme.ts` 的 6 套预设覆写，见下「Element Plus 主题覆盖」） |
| `--color-bg-light` | `--color-bg-page: #f4f5f7`（页面底）/ `--color-bg-base: #ffffff`（卡片/表面底） |
| `--color-bg-dark`（纯黑） | 无纯黑 token；侧边栏用渐变 `--color-sidebar-bg: linear-gradient(180deg,#0d1117,#010409)` |
| `--color-text-dark` | `--color-text-primary: #1d1d1f` |
| `--color-text-secondary` | `--color-text-secondary: #6e6e73` |
| `--radius-md`（8px） | `--radius-md: 8px`（一致）；另有 `--radius-sm:4px` / `--radius-lg:12px` |
| `--radius-pill`（980px 药丸） | 无对应（Admin 管理后台不使用药丸 CTA） |
| `--space-unit`（8px） | `--space-xs/sm/md/lg/xl`（4/8/16/24/32px） |
| `--shadow-card` | `--shadow-xs/sm/md/lg/xl` |
| `--font-display`/`--font-text`（SF Pro） | 无；模板未加载 SF Pro，沿用 Element Plus 默认字体栈 |
| `--nav-glass-bg`（深色玻璃） | `--color-navbar-bg: rgba(255,255,255,0.78)`（浅色玻璃，非深色） |

下面 `:root` 是**从零搭建 Apple 风格项目时的参考 token 定义**（设计意图命名）。**在 Admin 模板中不要照抄这套变量名**——直接复用 `variables.css` 的真实 token（见上表）。

```css
/* styles/variables.css 或 styles/apple-design.css */

:root {
  /* 背景色 */
  --color-bg-dark: #000000;
  --color-bg-light: #f5f5f7;

  /* 文字色 */
  --color-text-dark: #1d1d1f;
  --color-text-on-dark: #ffffff;
  --color-text-secondary: rgba(0, 0, 0, 0.8);
  --color-text-tertiary: rgba(0, 0, 0, 0.48);

  /* 强调色 */
  --color-accent: #0071e3;
  --color-link: #0066cc;
  --color-link-dark: #2997ff;

  /* 深色表面 */
  --color-surface-1: #272729;
  --color-surface-2: #262628;
  --color-surface-3: #28282a;
  --color-surface-4: #2a2a2d;

  /* 阴影 */
  --shadow-card: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;

  /* 导航玻璃 */
  --nav-glass-bg: rgba(0, 0, 0, 0.8);
  --nav-glass-blur: saturate(180%) blur(20px);

  /* 圆角 */
  --radius-sm: 5px;
  --radius-md: 8px;
  --radius-lg: 11px;
  --radius-xl: 12px;
  --radius-pill: 980px;
  --radius-circle: 50%;

  /* 字体 */
  --font-display: 'SF Pro Display', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
  --font-text: 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;

  /* 字号 */
  --text-hero: 3.5rem;      /* 56px */
  --text-section: 2.5rem;   /* 40px */
  --text-tile: 1.75rem;     /* 28px */
  --text-card: 1.31rem;     /* 21px */
  --text-body: 1.06rem;     /* 17px */
  --text-link: 0.88rem;     /* 14px */
  --text-caption: 0.88rem;  /* 14px */
  --text-micro: 0.75rem;    /* 12px */

  /* 间距基准 */
  --space-unit: 8px;
}
```

### 使用示例

```vue
<template>
  <section class="hero-section">
    <h1 class="hero-title">产品名称</h1>
    <p class="hero-subtitle">一句话描述</p>
    <div class="hero-ctas">
      <a class="pill-link" href="#">了解更多</a>
      <a class="btn-primary" href="#">购买</a>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  background: var(--color-bg-dark);
  text-align: center;
  padding: 120px 24px;
}
.hero-title {
  font-family: var(--font-display);
  font-size: var(--text-hero);
  font-weight: 600;
  line-height: 1.07;
  letter-spacing: -0.28px;
  color: var(--color-text-on-dark);
}
.hero-subtitle {
  font-family: var(--font-display);
  font-size: var(--text-card);
  font-weight: 400;
  line-height: 1.19;
  color: var(--color-text-on-dark);
}
.hero-ctas {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 24px;
}
</style>
```

## Element Plus 主题覆盖（Admin 模板真实实现）

Admin 模板的 `styles/variables.css` **直接**用 Apple Blue 覆盖 Element Plus 主色（不经过中间变量），并覆写完整的 `--el-*` 派生色：

```css
:root {
  --el-color-primary: #0071e3;          /* Apple Blue，默认品牌色 */
  --el-border-radius-base: 8px;          /* Apple 圆角 */
  /* 另有 --el-bg-color / --el-text-color-primary/regular / --el-border-color 等整块覆写 */
}
```

### 运行时主题预设（6 套品牌色）

模板支持运行时切换 6 套品牌色预设，定义在 `styles/themes.ts` 的 `THEME_PRESETS`：

| 预设键 | 主色 | 渐变 |
|--------|------|------|
| `blue`（默认） | `#0071e3` | `linear-gradient(135deg,#0071e3,#00a8ff)` |
| `green` | `#34c759` | `linear-gradient(135deg,#34c759,#30d158)` |
| `purple` | `#8b5cf6` | `linear-gradient(135deg,#8b5cf6,#a78bfa)` |
| `orange` | `#f97316` | `linear-gradient(135deg,#f97316,#fb923c)` |
| `red` | `#ef4444` | `linear-gradient(135deg,#ef4444,#f87171)` |
| `cyan` | `#06b6d4` | `linear-gradient(135deg,#06b6d4,#22d3ee)` |

切换由 `stores/theme.ts` 的 `applyColorPreset(presetKey)` 完成——它经 `document.documentElement.style.setProperty` 动态写入 `--color-primary`/`--color-primary-light`/`--color-primary-gradient`/`--color-avatar-gradient`，**并同步覆写整套 `--el-color-primary` 与 `--el-color-primary-light-3/5/7/8/9`、`--el-color-primary-dark-2`**（经 `mixColor` 计算色阶），保证 Element Plus 所有派生色（按钮、链接、focus 环、禁用态）随之变化。改默认色须同时改 `themes.ts` 的 `blue.primary`。

### 其它尺寸 token（CRUD 页面应复用，勿硬编码）

`variables.css` 还定义了对话框与表单的尺寸分级：

- 对话框宽度：`--dialog-sm: 440px` / `--dialog-md: 560px` / `--dialog-lg: 680px` / `--dialog-xl: 900px`
- 表单标签宽度：`--form-label-sm: 80px` / `--form-label-md: 90px` / `--form-label-lg: 110px`

> **不要**在 Admin 模板里重新定义 `--color-accent`/`--font-display`/`--radius-pill` 等设计意图变量——要么用 `variables.css` 的真实 token，要么走主题预设。
