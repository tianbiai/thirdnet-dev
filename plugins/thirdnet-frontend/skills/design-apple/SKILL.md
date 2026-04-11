---
name: design-apple
description: Apple 设计规范，所有前端项目（Web + 移动端）的默认设计参考。触发场景：前端页面设计、UI 样式实现、组件视觉规范、配色方案、排版系统、布局设计。触发关键词：Apple 风格、苹果设计、设计规范、UI 设计、视觉规范、配色、排版、布局。
version: "1.0.0"
license: MIT
author: thirdnet
---

# Apple 设计规范

所有前端项目（Web 端 + 移动端）的默认设计参考。基于 Apple 官网设计系统提炼，涵盖视觉主题、色板、排版、组件样式、布局、阴影与深度、Do's & Don'ts、响应式策略。

**何时使用**：所有前端页面的设计实现（Web 端和移动端均适用），或用户明确要求 Apple 风格设计时。

## 1. 视觉主题

Apple 设计的核心是"克制的戏剧感"——大面积纯黑与近白色作为产品展示的电影化背景，界面本身退隐至无形。

- **双色节奏**：纯黑（`#000000`）与浅灰（`#f5f5f7`）交替，创造电影般的叙事节奏——深色区块沉浸、浅色区块开放
- **单一强调色**：Apple Blue（`#0071e3`）仅用于交互元素（链接、按钮、焦点态），是整个界面中唯一的彩色
- **产品即主角**：产品图置于纯色底上，无渐变、无纹理、无干扰
- **极致紧凑标题行高**（1.07-1.14），创造压缩的、广告牌式的冲击力
- **药丸形 CTA**（980px radius），柔和而易于接近的行动按钮
- **充裕的区块间距**，让每个产品时刻都有呼吸空间

## 2. 色板

### 主色

| 角色 | 色值 | CSS 变量 | 用途 |
|------|------|----------|------|
| 纯黑 | `#000000` | `--color-bg-dark` | Hero 区背景、沉浸式产品展示 |
| 浅灰 | `#f5f5f7` | `--color-bg-light` | 交替区背景、信息区域（非纯白，微蓝灰调防止冷感） |
| 近黑 | `#1d1d1f` | `--color-text-dark` | 浅底上的主文字、深色按钮填充 |

### 交互色

| 角色 | 色值 | CSS 变量 | 用途 |
|------|------|----------|------|
| Apple Blue | `#0071e3` | `--color-accent` | 主 CTA 背景、焦点环、**唯一的彩色** |
| Link Blue | `#0066cc` | `--color-link` | 浅底正文链接（略深以保证可读性） |
| Bright Blue | `#2997ff` | `--color-link-dark` | 深底上的链接（更高亮度保证对比度） |

### 文字色阶

| 角色 | 色值 | CSS 变量 |
|------|------|----------|
| 白（深底文字） | `#ffffff` | `--color-text-on-dark` |
| 主文字（浅底） | `#1d1d1f` | `--color-text-dark` |
| 次要文字 | `rgba(0, 0, 0, 0.8)` | `--color-text-secondary` |
| 辅助文字 | `rgba(0, 0, 0, 0.48)` | `--color-text-tertiary` |

### 深色表面

| 层级 | 色值 | CSS 变量 |
|------|------|----------|
| Surface 1 | `#272729` | `--color-surface-1` |
| Surface 2 | `#262628` | `--color-surface-2` |
| Surface 3 | `#28282a` | `--color-surface-3` |
| Surface 4 | `#2a2a2d` | `--color-surface-4` |

### 阴影

| 角色 | 值 | CSS 变量 |
|------|----|----|
| 卡片阴影 | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` | `--shadow-card` |
| 导航玻璃 | `rgba(0,0,0,0.8)` + `backdrop-filter: saturate(180%) blur(20px)` | `--nav-glass` |

### 按钮态

| 角色 | 色值 |
|------|------|
| Active | `#ededf2` |
| Default Light | `#fafafc` |
| Overlay | `rgba(210, 210, 215, 0.64)` |
| Hover White | `rgba(255, 255, 255, 0.32)` |

## 3. 排版

### 字体

- **标题（20px+）**：`SF Pro Display`，回退：`SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`
- **正文（≤19px）**：`SF Pro Text`，回退同上
- SF Pro Display / Text 自动切换光学尺寸——大号更宽松、小号更紧凑

### 排版层级

| 角色 | 字号 | 字重 | 行高 | 字间距 | 用途 |
|------|------|------|------|--------|------|
| Display Hero | 56px (3.5rem) | 600 | 1.07 | -0.28px | 产品发布标题，最大冲击 |
| Section Heading | 40px (2.5rem) | 600 | 1.10 | normal | 特性区块标题 |
| Tile Heading | 28px (1.75rem) | 400 | 1.14 | 0.196px | 产品卡片标题 |
| Card Title | 21px (1.31rem) | 700 | 1.19 | 0.231px | 粗体卡片标题 |
| Sub-heading | 21px (1.31rem) | 400 | 1.19 | 0.231px | 常规卡片标题 |
| Nav Heading | 34px (2.13rem) | 600 | 1.47 | -0.374px | 大导航标题 |
| Sub-nav | 24px (1.5rem) | 300 | 1.50 | normal | 浅色子导航 |
| Body | 17px (1.06rem) | 400 | 1.47 | -0.374px | 标准正文 |
| Body Emphasis | 17px (1.06rem) | 600 | 1.24 | -0.374px | 强调正文、标签 |
| Button Large | 18px (1.13rem) | 300 | 1.00 | normal | 大按钮文字 |
| Button | 17px (1.06rem) | 400 | 2.41 | normal | 标准按钮 |
| Link | 14px (0.88rem) | 400 | 1.43 | -0.224px | 正文链接 |
| Caption | 14px (0.88rem) | 400 | 1.29 | -0.224px | 次要文字、描述 |
| Micro | 12px (0.75rem) | 400 | 1.33 | -0.12px | 脚注 |
| Nano | 10px (0.63rem) | 400 | 1.47 | -0.08px | 法律文本 |

### 排版原则

1. **全局负字间距**：与多数系统只在标题用负 tracking 不同，Apple 在正文也用（17px 时 -0.374px、14px 时 -0.224px、12px 时 -0.12px），创造普遍紧凑的文字
2. **字重克制**：300-700 范围，但大多数文字在 400（常规）和 600（半粗）。300 仅用于装饰性大文字，700 仅用于粗体卡片标题
3. **极端行高范围**：标题压缩到 1.07，正文展开到 1.47，按钮场景可达 2.41——行高本身就是层级信号

## 4. 组件样式

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
  font: 400 14px-17px 'SF Pro Text', sans-serif;
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

## 5. 布局原则

### 间距

- 基准单位：8px
- 精细刻度：2px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 11px, 14px, 15px, 17px, 20px, 24px
- 小尺寸密集（2-11px 间 1px 递增），大尺寸跳跃——便于精确的排版和图标对齐

### 容器

- 最大内容宽度：~980px
- Hero：全视口宽度，内容居中
- 产品网格：2-3 列居中布局
- 单列用于 Hero 时刻——一个产品、一个信息、全部注意力
- 无可见网格线——间距创造隐含结构

### 留白哲学

- **电影式呼吸空间**：每个产品区块占接近整个视口高度。区块之间的空白不是空——是电影场景间的停顿
- **颜色块创造节奏**：用交替的背景色（黑 → `#f5f5f7` → 黑）分隔区块，而非仅靠间距
- **内紧外松**：文字块紧凑设置（负字间距、紧凑行高），而周围的留白巨大——密度与开放之间的张力

### 圆角层级

| 场景 | 圆角 |
|------|------|
| 微小容器、链接标签 | 5px |
| 按钮、卡片、图片容器 | 8px |
| 搜索输入、筛选按钮 | 11px |
| 特性面板、生活方式图片 | 12px |
| CTA 链接（药丸） | 980px |
| 媒体控制按钮 | 50% |

## 6. 阴影与深度

| 层级 | 处理 | 用途 |
|------|------|------|
| 平面 | 无阴影、纯色背景 | 标准内容区块 |
| 导航玻璃 | `backdrop-filter: saturate(180%) blur(20px)` | 粘性导航栏 |
| 轻抬升 | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` | 产品卡片 |
| 媒体控制 | `rgba(210, 210, 215, 0.64)` + scale 变换 | 播放/暂停按钮 |
| 焦点 | `2px solid #0071e3` outline | 所有交互元素的键盘焦点 |

**阴影哲学**：Apple 极少使用阴影。主阴影（`3px 5px 30px` 0.22 透明度）柔和、宽幅、偏移——模拟漫射影棚光投射的自然阴影。大多数元素完全没有阴影；层次感来自背景色对比（深底上的深色卡片，或不同灰度的浅色卡片对比）。

## 7. Do's & Don'ts

### Do

- SF Pro Display 用于 20px+，SF Pro Text 用于 20px 以下——遵守光学尺寸边界
- 所有字号都用负字间距——Apple 全局紧凑
- Apple Blue（`#0071e3`）仅用于交互元素——它是唯一的强调色
- 黑色和浅灰（`#f5f5f7`）交替使用——创造电影节奏
- CTA 链接用 980px 药丸圆角——Apple 标志性形状
- 产品图放在纯色底上——无竞争视觉元素
- 粘性导航用半透明深色玻璃效果——Apple UI 身份的核心
- 标题行高压缩到 1.07-1.14——紧凑而有力

### Don't

- 不引入额外的强调色——整个色彩预算都花在蓝色上
- 不使用重阴影或多层阴影——一个柔和漫射阴影或不使用
- 不在卡片或容器上加边框——Apple 几乎从不使用可见边框
- 不给 SF Pro 加宽字间距——它在所有尺寸都应该是紧凑的
- 不使用 800 或 900 字重——最高 700（粗体），且极少使用
- 不在背景上加纹理、图案或渐变——仅纯色
- 不让导航栏不透明——玻璃模糊效果是 Apple UI 身份的关键
- 不居中对齐正文——Apple 正文左对齐，仅标题居中
- 不在矩形元素上使用超过 12px 的圆角（980px 仅用于药丸）

## 8. 响应式策略

### 断点

| 名称 | 宽度 | 关键变化 |
|------|------|----------|
| 小手机 | <360px | 最小支持，单列 |
| 手机 | 360-480px | 标准移动布局 |
| 大手机 | 480-640px | 更宽单列，更大图片 |
| 小平板 | 640-834px | 2 列产品网格开始 |
| 平板 | 834-1024px | 完整平板布局，展开导航 |
| 小桌面 | 1024-1070px | 标准桌面布局开始 |
| 桌面 | 1070-1440px | 完整布局，最大内容宽度 |
| 大桌面 | >1440px | 居中，充裕边距 |

### 折叠策略

- **标题**：56px → 40px → 28px，保持紧凑行高比例
- **网格**：3 列 → 2 列 → 单列堆叠
- **导航**：完整水平 → 紧凑移动菜单（汉堡）
- **背景节奏**：所有断点都保持全宽色块——电影节奏从不中断
- **图片**：产品图等比缩放，不裁切——产品轮廓是神圣的

### 触控目标

- 主 CTA：8px 15px 内边距，约 44px 触控高度
- 导航链接：48px 高度，充足间距
- 媒体控制：50% 圆形按钮，最小 44×44px

## 9. Vue 3 CSS 变量集成

在 Vue 项目中，将上述色板定义为 CSS 变量，全局可用：

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

## 10. Agent 组件提示词参考

### Hero 区

> 创建 Hero 区：纯黑背景。标题 56px SF Pro Display weight 600，行高 1.07，字间距 -0.28px，白色。副标题 21px SF Pro Display weight 400，行高 1.19，白色。两个药丸 CTA：「了解更多」（透明底、白文字、1px 白色边框、980px 圆角）和「购买」（Apple Blue #0071e3 底、白文字、8px 圆角、8px 15px 内边距）。

### 产品卡片

> 产品卡片：#f5f5f7 背景，8px 圆角，无边框，无阴影。产品图占卡片上方 60%，纯色背景。标题 28px SF Pro Display weight 400，字间距 0.196px，行高 1.14。描述 14px SF Pro Text weight 400，色值 rgba(0,0,0,0.8)。「了解更多」和「购买」链接 #0066cc 14px。

### 导航栏

> Apple 导航栏：粘性定位，48px 高，背景 rgba(0,0,0,0.8) 加 backdrop-filter: saturate(180%) blur(20px)。链接 12px SF Pro Text weight 400，白色。Apple logo 左对齐，链接居中，搜索和购物袋图标右对齐。

### 交替区块

> 交替区块布局：第一区块黑底白字，居中产品图；第二区块 #f5f5f7 底 #1d1d1f 文字。每区块接近全视口高度，56px 标题下方两个药丸 CTA。
