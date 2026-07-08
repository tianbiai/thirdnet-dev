# Apple 设计规范 · 色板与阴影

> 本文件是 `design-apple` 技能的色板与深度参考资料。核心设计原则见 [SKILL.md](../SKILL.md) §1 视觉主题；在 Admin 模板中写样式时，真实 token 映射见 [components.md](components.md) 的「Vue 3 CSS 变量集成 / Element Plus 主题覆盖」。

## 主色

| 角色 | 色值 | CSS 变量 | 用途 |
|------|------|----------|------|
| 纯黑 | `#000000` | `--color-bg-dark` | Hero 区背景、沉浸式产品展示 |
| 浅灰 | `#f5f5f7` | `--color-bg-light` | 交替区背景、信息区域（非纯白，微蓝灰调防止冷感） |
| 近黑 | `#1d1d1f` | `--color-text-dark` | 浅底上的主文字、深色按钮填充 |

## 交互色

| 角色 | 色值 | CSS 变量 | 用途 |
|------|------|----------|------|
| Apple Blue | `#0071e3` | `--color-accent` | 主 CTA 背景、焦点环、**唯一的彩色** |
| Link Blue | `#0066cc` | `--color-link` | 浅底正文链接（略深以保证可读性） |
| Bright Blue | `#2997ff` | `--color-link-dark` | 深底上的链接（更高亮度保证对比度） |

## 文字色阶

| 角色 | 色值 | CSS 变量 |
|------|------|----------|
| 白（深底文字） | `#ffffff` | `--color-text-on-dark` |
| 主文字（浅底） | `#1d1d1f` | `--color-text-dark` |
| 次要文字 | `rgba(0, 0, 0, 0.8)` | `--color-text-secondary` |
| 辅助文字 | `rgba(0, 0, 0, 0.48)` | `--color-text-tertiary` |

## 深色表面

| 层级 | 色值 | CSS 变量 |
|------|------|----------|
| Surface 1 | `#272729` | `--color-surface-1` |
| Surface 2 | `#262628` | `--color-surface-2` |
| Surface 3 | `#28282a` | `--color-surface-3` |
| Surface 4 | `#2a2a2d` | `--color-surface-4` |

## 阴影

| 角色 | 值 | CSS 变量 |
|------|----|----|
| 卡片阴影 | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` | `--shadow-card` |
| 导航玻璃 | `rgba(0,0,0,0.8)` + `backdrop-filter: saturate(180%) blur(20px)` | `--nav-glass` |

## 按钮态

| 角色 | 色值 |
|------|------|
| Active | `#ededf2` |
| Default Light | `#fafafc` |
| Overlay | `rgba(210, 210, 215, 0.64)` |
| Hover White | `rgba(255, 255, 255, 0.32)` |

## 阴影与深度（层级）

| 层级 | 处理 | 用途 |
|------|------|------|
| 平面 | 无阴影、纯色背景 | 标准内容区块 |
| 导航玻璃 | `backdrop-filter: saturate(180%) blur(20px)` | 粘性导航栏 |
| 轻抬升 | `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` | 产品卡片 |
| 媒体控制 | `rgba(210, 210, 215, 0.64)` + scale 变换 | 播放/暂停按钮 |
| 焦点 | `2px solid #0071e3` outline | 所有交互元素的键盘焦点 |

**阴影哲学**：Apple 极少使用阴影。主阴影（`3px 5px 30px` 0.22 透明度）柔和、宽幅、偏移——模拟漫射影棚光投射的自然阴影。大多数元素完全没有阴影；层次感来自背景色对比（深底上的深色卡片，或不同灰度的浅色卡片对比）。
