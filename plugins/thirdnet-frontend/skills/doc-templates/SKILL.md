---
name: doc-templates
description: >
  前端项目文档模板集。**必须在以下场景主动使用**：新建前端项目时（必须读取模板并生成
  changelog.md、viewer.html、marked.min.js 到正确目录）、创建页面/项目规格文档时
  （必须读取对应模板按格式输出）。当关键词涉及 spec.md、changelog、Markdown 查看器、
  变更日志时，必须触发此技能。
license: MIT
metadata:
  version: "1.0.0"
  author: thirdnet
---

## 使用场景

- 创建项目级规格文档（spec.md）
- 创建页面级规格文档（specs/xxx.md）
- 创建变更日志（changelog.md）
- 创建通用 Markdown 查看页面（viewer.html）

> **重要提示**：本技能不仅是模板参考，还定义了新建项目时必须执行的文件生成规则。加载本技能后，请务必阅读"强制规则"小节。

## 强制规则

### 新建项目时必须生成的文件

当创建新的前端项目时（Web 应用或小程序），**必须**生成以下文件，不可跳过：

| 文件 | Web 应用 | 小程序应用 | 操作 |
|------|----------|-----------|------|
| changelog.md | `public/changelog.md` | `static/changelog.md` | 读取 `references/changelog-template.md`，按模板格式生成 |
| viewer.html | `public/viewer.html` | `static/viewer.html` | 读取 `references/markdown-viewer.md`，按模板生成完整 HTML |
| marked.min.js | `public/marked.min.js` | `static/marked.min.js` | 读取 `references/marked-js-setup.md`，下载或创建文件 |

**执行步骤**：
1. 判断项目类型（Web → `public/`，小程序 → `static/`）
2. 逐一读取上表中对应的 reference 文件
3. 按模板内容生成文件到目标路径
4. 这一步与创建 spec.md 同等重要，不可省略

### 编码前必须完成页面规格

每个页面的编码前，**必须**在 `specs/` 目录下创建对应的页面规格文件：

**流程**：
1. 判断待实现的页面列表
2. 读取 `references/page-spec-template.md` 模板
3. 为每个页面创建 `specs/{页面名}.md`，填写：业务目标、功能清单、API 接口、组件架构
4. 所有页面 spec 完成后，才能开始编码
5. **spec 不存在 → 停止编码 → 先生成规格文档**

**注意**：项目级 spec.md 定义全局架构，页面级 specs 定义每个页面的具体实现规格。两者缺一不可。

## 模板文件

根据当前任务选择对应模板：

| 场景 | 模板文件 | 说明 |
|------|----------|------|
| 创建项目规格 | [project-spec-template](references/project-spec-template.md) | 项目级功能说明书，涵盖业务、功能架构、设计系统、技术栈 |
| 创建页面规格 | [page-spec-template](references/page-spec-template.md) | 页面级规格，与 `.vue` 文件一一对应 |
| 创建变更日志 | [changelog-template](references/changelog-template.md) | 版本历史 + 页面变更记录 |
| 创建 Markdown 查看器 | [markdown-viewer](references/markdown-viewer.md) | 通用 HTML 页面，通过 URL 参数加载任意 .md 文件 |
| 配置 marked.js | [marked-js-setup](references/marked-js-setup.md) | marked.min.js 获取与配置 |
| SFC 组件重构 | [sfc-large-component-refactoring](references/sfc-large-component-refactoring.md) | .vue 文件行数限制与四步拆分法 |

## 文件存放位置

| 文件 | Web 应用 | 小程序应用 |
|------|----------|-----------|
| changelog.md | `public/changelog.md` | `static/changelog.md` |
| viewer.html | `public/viewer.html` | `static/viewer.html` |
| marked.min.js | `public/marked.min.js` | `static/marked.min.js` |
| spec.md | `frontend/{子系统名}/spec.md` | 同左 |
| 页面 spec | `frontend/{子系统名}/specs/{页面名}.md` | 同左 |
