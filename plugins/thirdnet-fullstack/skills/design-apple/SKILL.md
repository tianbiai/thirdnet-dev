---
name: design-apple
description: >
  Apple 风格设计系统与具体 CSS/SCSS 规范——所有前端项目（Web + 移动端）的默认视觉参考：
  色板（Apple Blue 强调色 + 纯黑/浅灰双色节奏）、SF Pro 排版层级、组件样式（药丸 CTA / 卡片 / 玻璃导航）、
  布局与响应式、Vue/Admin CSS 变量与 Element Plus 主题覆盖。当用户要"编写 CSS/SCSS"、"落地 Apple 风格视觉规范"、
  "配色 / 排版 / 布局 / 圆角 / 阴影"，或在 Admin 模板写样式时，必须使用此技能。
  与 frontend-design 分工：本技能管具体视觉系统与样式实现，frontend-design 管设计方向与创意风格决策。
license: MIT
metadata:
  version: "1.1.0"
  author: thirdnet
---

# Apple 设计规范

所有前端项目（Web 端 + 移动端）的默认视觉参考。基于 Apple 官网设计系统提炼。

**何时使用**：所有前端页面的样式实现（Web 端和移动端均适用），或用户明确要求 Apple 风格设计时。

## 参考文件索引

详细色值表、类型刻度、断点、组件 CSS、Admin 模板 token 映射等已拆分到参考文件，按需读取：

| 主题 | 文件 |
|------|------|
| 色板（主色/交互色/文字色阶/深色表面/阴影/按钮态）与深度层级 | [color.md](references/color.md) |
| 排版（SF Pro 字体、完整类型刻度表、排版原则） | [typography.md](references/typography.md) |
| 布局（间距刻度、容器、留白哲学、圆角层级）与响应式（断点、折叠、触控） | [layout.md](references/layout.md) |
| 组件 CSS（按钮/药丸/卡片/导航）+ Vue CSS 变量集成 + Admin 模板 token 映射 + Element Plus 主题覆盖 | [components.md](references/components.md) |

## 1. 视觉主题

Apple 设计的核心是"克制的戏剧感"——大面积纯黑与近白色作为产品展示的电影化背景，界面本身退隐至无形。

- **双色节奏**：纯黑（`#000000`）与浅灰（`#f5f5f7`）交替，创造电影般的叙事节奏——深色区块沉浸、浅色区块开放
- **单一强调色**：Apple Blue（`#0071e3`）仅用于交互元素（链接、按钮、焦点态），是整个界面中唯一的彩色
- **产品即主角**：产品图置于纯色底上，无渐变、无纹理、无干扰
- **极致紧凑标题行高**（1.07-1.14），创造压缩的、广告牌式的冲击力
- **药丸形 CTA**（980px radius），柔和而易于接近的行动按钮
- **充裕的区块间距**，让每个产品时刻都有呼吸空间

## 2. 色板（速查）

| 角色 | 色值 | 用途 |
|------|------|------|
| 纯黑 | `#000000` | Hero 区/沉浸式背景 |
| 浅灰 | `#f5f5f7` | 交替区/信息区背景 |
| 近黑 | `#1d1d1f` | 浅底主文字、深色按钮填充 |
| Apple Blue | `#0071e3` | **唯一强调色**——主 CTA、焦点环 |
| Link Blue | `#0066cc` / `#2997ff`（深底） | 正文链接 |

完整色阶（文字色阶、深色表面 Surface 1-4、阴影值、按钮态）见 [color.md](references/color.md)。

> ⚠️ **Admin 模板**：写样式时以 `styles/variables.css` 的真实 token 为准（如 `--color-primary`/`--color-bg-page`/`--color-text-primary`），**不要**假设本技能的设计意图变量名（`--color-accent` 等）存在。设计意图 → Admin 真实 token 映射见 [components.md](references/components.md)。

## 3. 排版（速查）

- **标题（20px+）**：`SF Pro Display`；**正文（≤19px）**：`SF Pro Text`；回退 `Helvetica Neue, Arial, sans-serif`
- **全局负字间距**：正文也用（17px→-0.374px、14px→-0.224px、12px→-0.12px）
- **字重克制**：多数文字 400/600；300 仅装饰大字，700 仅粗体卡片标题
- **行高即层级**：标题压缩到 1.07，正文展开到 1.47

完整类型刻度表（Display Hero 56px → Nano 10px 共 14 级）见 [typography.md](references/typography.md)。

> ⚠️ **Admin 模板未加载 SF Pro**，沿用 Element Plus 默认字体栈——不要在 Admin 模板里强制 `font-family: 'SF Pro Display'`。

## 4. 组件样式

按钮（CTA / 深色）、药丸链接（Learn More/Shop，980px 圆角透明底蓝字）、搜索筛选按钮、卡片（无边框、多数无阴影）、玻璃导航栏（`backdrop-filter: saturate(180%) blur(20px)`）的完整 CSS 见 [components.md](references/components.md)；从零搭建时的 `:root` CSS 变量定义与使用示例亦在其中。

## 5. 布局（速查）

- **间距基准 8px**（精细刻度 2-11px 间 1px 递增，大尺寸跳跃）
- **容器最大宽度 ~980px**；Hero 全视口宽、内容居中
- **电影式留白**：每个产品区块接近全视口高，用黑/浅灰交替背景创造节奏
- **内紧外松**：文字块紧凑（负字间距、紧凑行高），周围留白巨大
- **圆角**：按钮/卡片 8px、筛选 11px、特性面板 12px、药丸 CTA 980px

完整间距刻度、容器规则、圆角层级表、响应式断点（8 档 <360px→>1440px）、折叠策略、触控目标见 [layout.md](references/layout.md)。

## 6. 阴影哲学

Apple **极少使用阴影**。唯一主阴影（`rgba(0,0,0,0.22) 3px 5px 30px 0px`）柔和、宽幅、偏移——模拟漫射影棚光。大多数元素完全没有阴影；层次感来自**背景色对比**（深底上的深色卡片，或不同灰度的浅色卡片对比），而非阴影或边框（Apple 几乎不用可见边框）。深度层级表见 [color.md](references/color.md)。

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

## 8. Agent 组件提示词参考

### Hero 区

> 创建 Hero 区：纯黑背景。标题 56px SF Pro Display weight 600，行高 1.07，字间距 -0.28px，白色。副标题 21px SF Pro Display weight 400，行高 1.19，白色。两个药丸 CTA：「了解更多」（透明底、白文字、1px 白色边框、980px 圆角）和「购买」（Apple Blue #0071e3 底、白文字、8px 圆角、8px 15px 内边距）。

### 产品卡片

> 产品卡片：#f5f5f7 背景，8px 圆角，无边框，无阴影。产品图占卡片上方 60%，纯色背景。标题 28px SF Pro Display weight 400，字间距 0.196px，行高 1.14。描述 14px SF Pro Text weight 400，色值 rgba(0,0,0,0.8)。「了解更多」和「购买」链接 #0066cc 14px。

### 导航栏

> Apple 导航栏：粘性定位，48px 高，背景 rgba(0,0,0,0.8) 加 backdrop-filter: saturate(180%) blur(20px)。链接 12px SF Pro Text weight 400，白色。Apple logo 左对齐，链接居中，搜索和购物袋图标右对齐。

### 交替区块

> 交替区块布局：第一区块黑底白字，居中产品图；第二区块 #f5f5f7 底 #1d1d1f 文字。每区块接近全视口高度，56px 标题下方两个药丸 CTA。
