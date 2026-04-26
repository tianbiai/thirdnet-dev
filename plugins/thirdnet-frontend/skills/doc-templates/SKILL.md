---
name: doc-templates
description: 前端项目文档模板集，提供通用 Markdown 查看器、Changelog 模板、页面规格模板、项目规格模板。当需要创建 spec.md、changelog.md、Markdown 查看页面、项目文档、页面规格说明、生成文档模板时，必须使用此技能。
---

## 使用场景

- 创建项目级规格文档（spec.md）
- 创建页面级规格文档（specs/xxx.md）
- 创建变更日志（changelog.md）
- 创建通用 Markdown 查看页面（viewer.html）

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
