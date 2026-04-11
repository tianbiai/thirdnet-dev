# [项目名称] - 项目功能说明书

> 本文档是项目的唯一权威文档，提供全局定位、业务规划、设计规范和技术架构。

## 必读技能文档

| 优先级 | 技能 | 适用场景 |
|--------|------|----------|
| ⭐⭐⭐ | `vue-best-practices` | 所有 Vue 开发工作 |
| ⭐⭐ | `/frontend-design` | 任何 UI/界面设计工作（全局技能） |

完整技能清单：[skills-checklist.md](./skills-checklist.md)

---

## 项目概述

### 项目背景

[在此描述项目背景、业务背景、市场定位...]

**项目类型**：

- [ ] 移动端应用（uniapp）- 必须以 H5 模式开发验证（`npm run dev:h5`），最终发布为微信小程序（mp-weixin），代码需兼容微信小程序
- [ ] Web 应用（Vue 3）
- [ ] 双端应用（uniapp + Vue 3）

### 核心定位

**项目愿景**：[在此描述项目愿景...]

**核心价值**：
- [价值点1]：[描述]
- [价值点2]：[描述]

### 目标用户

**用户群体**：
- **主要用户**：[用户群体描述]
- **次要用户**：[用户群体描述]

**核心痛点**：
- [痛点1]：[描述]
- [痛点2]：[描述]

---

## 功能架构

### 功能模块

**P0 核心功能**：
- **[模块A]**：[功能描述]
- **[模块B]**：[功能描述]

**P1 重要功能**：
- **[模块C]**：[功能描述]

**P2 增强功能**：
- **[模块E]**：[功能描述]

### 功能依赖关系

```
[模块A] → [模块B] → [模块C]
   ↓
[模块D]
```

---

## 设计系统

> ⚠️ 必须遵循 `/frontend-design` 全局技能规范，避免通用 AI 美学。

### 设计风格

- **设计基调**：[极简主义/极繁主义/复古未来主义/有机自然主义/奢华精致/玩趣玩具感/编辑杂志风/野兽派/装饰艺术/工业实用主义/赛博朋克...]
- **情感定位**：[专业/友好/活力/冷静/奢华/亲民/科技感/艺术感]
- **差异化亮点**：[什么让这个设计难以忘怀？]

### 严禁使用

- [X] 通用字体（Inter, Roboto, Arial, 系统字体）
- [X] 陈词滥调配色（尤其是紫色渐变）
- [X] 预测性布局和组件模式
- [X] 缺乏个性的千篇一律设计

### 色彩系统

**主色调**：
- **--primary-[颜色名]**：[色值] - [用途]

**功能色**：
- **--success**：[色值] - 成功状态
- **--warning**：[色值] - 警告状态
- **--error**：[色值] - 错误状态
- **--info**：[色值] - 信息提示

### 布局规范

- **整体布局**：[单栏/双栏/三栏/网格]
- **响应式策略**：[移动优先/桌面优先]
- **断点**：移动端 <768px | 平板 768-1024px | 桌面 ≥1024px

---

## 技术架构

### 技术栈

**uniapp 项目**：H5 模式开发（`npm run dev:h5`），最终发布为微信小程序，需兼容小程序环境（详见 Agent 规则9）

**默认版本**：
- **移动端**：Vue 3.4.x、Vant 4.x、Vite 5.x、Pinia 2.x、Vue Router 4.x、Axios 1.x
- **Web端**：Vue 3.4.x、Vite 5.x、Element Plus 2.x、Vue Router 4.x、Pinia 2.x、Axios 1.x

### 项目结构

```
frontend/[项目名]/
├── spec.md                    # 项目级功能说明书（本文档）
├── specs/                     # 页面级规格说明目录
│   └── [页面名].md
├── {public 或 static}/        # Web: public/  小程序: static/
│   ├── changelog.md           # 变更日志
│   ├── changelog.html         # 渲染页面
│   └── marked.min.js          # Markdown 解析库
├── src/
│   ├── main.js                # 应用入口
│   ├── App.vue                # 根组件
│   ├── config/                # 配置文件
│   │   └── index.js           # MOCK_ENABLED 等全局配置
│   ├── {pages 或 views}/      # 移动端: pages/  Web端: views/
│   ├── components/            # 通用组件（含 HelpBubble）
│   ├── composables/           # 可复用逻辑
│   ├── api/                   # API 接口层
│   │   ├── index.js           # API 统一导出
│   │   └── modules/           # API 模块（按业务命名）
│   │       ├── order.js
│   │       └── user.js
│   ├── mock/                  # Mock 路由拦截层
│   │   ├── index.js           # Mock 路由入口（按 URL+Method 匹配）
│   │   └── data/              # Mock 数据（与 api/modules/ 一一对应）
│   │       ├── order.js       # ←→ api/modules/order.js
│   │       └── user.js        # ←→ api/modules/user.js
│   ├── stores/                # 状态管理（Pinia）
│   ├── router/                # 路由配置（Web端）
│   ├── utils/                 # 工具函数
│   │   └── request.js         # 统一请求方法
│   ├── styles/                # 全局样式
│   └── assets/                # 静态资源
└── ...
```

### API 规范

> 详细规范见 Agent 规则10（API-Mock 一一对应架构）和规则11（演示模式与帮助气泡控制）

- **架构**：Mock 路由拦截层，API 模块（`api/modules/*.js`）与 Mock 数据（`mock/data/*.js`）一一对应
- **切换控制**：通过 `MOCK_ENABLED` 开关控制 Mock/真实 API，业务代码零修改
- **路径**：用户端 `api/app/{资源名}`，管理端 `api/manager/{资源名}`
- **参数命名**：snake_case（`user_name`, `order_id`, `created_at`）
- **响应**：直接返回数据，HTTP 状态码表达结果，禁止 `code` 字段

### 演示模式控制

- **开关**：`MOCK_ENABLED`（位于 `src/config/index.js`）
- **演示模式（true）**：显示帮助气泡（HelpBubble），使用 Mock 数据
- **生产模式（false）**：帮助气泡完全移除（`v-if`），使用真实 API
