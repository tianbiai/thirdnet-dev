# marked.min.js 获取说明

> Markdown 解析库，用于在浏览器中将 changelog.md 渲染为 HTML。

## 文件放置位置

- **Web应用**：`public/marked.min.js`
- **小程序应用**：`static/marked.min.js`

## 获取方式

### 方式一：下载已压缩版本（推荐）

从 jsDelivr CDN 下载：

```bash
# Web应用
curl -o public/marked.min.js https://cdn.jsdelivr.net/npm/marked/marked.min.js

# 小程序应用
curl -o static/marked.min.js https://cdn.jsdelivr.net/npm/marked/marked.min.js
```

或手动下载：访问 https://cdn.jsdelivr.net/npm/marked/marked.min.js，保存到对应目录。

### 方式二：使用 npm 安装（项目已有 Node.js 环境）

```bash
npm install marked
```

然后复制：

```bash
# Web应用
cp node_modules/marked/marked.min.js public/

# 小程序应用
cp node_modules/marked/marked.min.js static/
```

## 版本信息

当前模板使用的 marked 版本：**v17.x**（通过 jsDelivr 获取的最新稳定版）

如需指定版本：

```bash
# 指定版本，例如 v17.0.6
curl -o public/marked.min.js https://cdn.jsdelivr.net/npm/marked@17.0.6/marked.min.js
```

## 功能特性

marked.js 支持以下 Markdown 语法：

- ✅ 标题（H1-H6）
- ✅ 段落和换行
- ✅ 粗体、斜体、删除线
- ✅ 有序/无序列表
- ✅ 链接和图片
- ✅ 代码块和行内代码
- ✅ 引用块
- ✅ 表格（GFM 扩展）
- ✅ 任务列表（GFM 扩展）
- ✅ 水平分割线

## 与 viewer.html 的配合

`viewer.html` 通过以下代码使用 marked.js：

```javascript
const html = marked.parse(markdown, {
  breaks: true,   // 支持换行符转 <br>
  gfm: true       // 启用 GitHub Flavored Markdown
});
```

确保 `marked.min.js`、`viewer.html`、`changelog.md` 三者在同一目录下。

## 验证

启动开发服务器后访问 `http://localhost:{port}/viewer.html?file=changelog.md`，应能看到格式化的 changelog 内容。
