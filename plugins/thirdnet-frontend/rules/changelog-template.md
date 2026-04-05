# 变更日志 (Changelog)

> 记录项目的版本演变和页面功能变更。

## 文件存放位置

- **Web应用**：`public/changelog.md` — 发布时会自动包含在构建产物中
- **小程序应用**：`static/changelog.md` — 发布时会自动包含在构建产物中

---

## Changelog 渲染页面

为便于团队成员通过浏览器直接查看格式化的更新日志，需同时创建以下配套文件：

### 文件清单

- **Web应用**：
  - `public/changelog.html` — Changelog 渲染页面（模板见 `changelog-html-template.md`）
  - `public/marked.min.js` — Markdown 解析库（获取方式见 `marked-js-reference.md`）

- **小程序应用**：
  - `static/changelog.html` — Changelog 渲染页面（模板见 `changelog-html-template.md`）
  - `static/marked.min.js` — Markdown 解析库（获取方式见 `marked-js-reference.md`）

### 使用方法

1. 复制 `changelog-html-template.md` 中的代码，保存为 `changelog.html`
2. 按 `marked-js-reference.md` 说明获取 `marked.min.js`
3. 将两个文件放置到对应目录（`public/` 或 `static/`）
4. 启动开发服务器后，访问 `http://localhost:{port}/changelog.html` 查看

### 注意事项

- `changelog.html`、`changelog.md`、`marked.min.js` 必须在同一目录下
- 修改 `changelog.md` 后刷新页面即可看到最新内容
- 如需自定义页面标题，编辑 `changelog.html` 中的 `<title>` 和 `.subtitle`

---

## 版本历史

### vX.Y.Z (YYYY-MM-DD)

**类型**: 功能发布 / 功能更新 / Bug修复 / 重要更新

**变更**:
- [变更项1]
- [变更项2]

---

## 页面变更记录

| 页面 | 版本 | 变更类型 | 描述 |
|------|------|----------|------|
| [页面名].md | vX.Y.Z | 新增 | [变更描述] |
| [页面名].md | vX.Y.Z | 优化 | [变更描述] |
| [页面名].md | vX.Y.Z | 修复 | [变更描述] |
| [页面名].md | vX.Y.Z | 移除 | [变更描述] |

**变更类型**：`新增` - 新页面/新功能 | `优化` - 性能/体验改进 | `修复` - Bug 修复 | `移除` - 功能下线

---

## 维护规范

### 版本号（SemVer）

- `MAJOR` - 不兼容的重大变更
- `MINOR` - 向下兼容的功能新增
- `PATCH` - 向下兼容的问题修复

### 变更类型

- `功能发布` - 新版本正式发布
- `功能更新` - 功能迭代优化
- `Bug修复` - 问题修复
- `重要更新` - 重大架构/技术变更

### 维护建议

1. 新版本发布时，在「版本历史」添加条目
2. 涉及页面变更时，同步更新「页面变更记录」
3. 保持简洁，无需记录过于细节的内容
