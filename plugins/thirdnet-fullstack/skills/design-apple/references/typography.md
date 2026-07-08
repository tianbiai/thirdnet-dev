# Apple 设计规范 · 排版

> 本文件是 `design-apple` 技能的排版参考资料。核心设计原则见 [SKILL.md](../SKILL.md) §1 视觉主题。

## 字体

- **标题（20px+）**：`SF Pro Display`，回退：`SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif`
- **正文（≤19px）**：`SF Pro Text`，回退同上
- SF Pro Display / Text 自动切换光学尺寸——大号更宽松、小号更紧凑

## 排版层级

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

## 排版原则

1. **全局负字间距**：与多数系统只在标题用负 tracking 不同，Apple 在正文也用（17px 时 -0.374px、14px 时 -0.224px、12px 时 -0.12px），创造普遍紧凑的文字
2. **字重克制**：300-700 范围，但大多数文字在 400（常规）和 600（半粗）。300 仅用于装饰性大文字，700 仅用于粗体卡片标题
3. **极端行高范围**：标题压缩到 1.07，正文展开到 1.47，按钮场景可达 2.41——行高本身就是层级信号
