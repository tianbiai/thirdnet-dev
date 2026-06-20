# 通用 Markdown 查看器

> 通用 HTML 页面，通过 URL 参数加载并渲染任意 Markdown 文件。

## 使用方式

将 `viewer.html` 和 `marked.min.js`（获取方式见 [marked-js-setup](marked-js-setup.md)）放在同一目录下。

**文件存放位置**：

- **Web 应用**：`public/viewer.html` + `public/marked.min.js`
- **小程序应用**：`static/viewer.html` + `static/marked.min.js`

**访问方式**：

| URL | 加载文件 |
|-----|---------|
| `http://localhost:{port}/viewer.html` | 默认加载 `changelog.md` |
| `http://localhost:{port}/viewer.html?file=changelog.md` | 加载 changelog |
| `http://localhost:{port}/viewer.html?file=spec.md` | 加载项目规格 |
| `http://localhost:{port}/viewer.html?file=specs/首页.md` | 加载页面规格 |

通过 `?file=` 参数指定任意 `.md` 文件的相对路径。

---

## 文件内容

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>文档查看器</title>
  <script src="marked.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #24292f;
      background-color: #f6f8fa;
      padding: 40px 20px;
    }

    .container {
      max-width: 1012px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 48px;
    }

    .header {
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid #d8dee4;
    }

    .header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #0969da;
      margin-bottom: 8px;
    }

    .header .subtitle {
      font-size: 14px;
      color: #656d76;
    }

    /* Markdown 样式 */
    .markdown-body h1 {
      font-size: 2em;
      font-weight: 600;
      margin: 24px 0 16px;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #d8dee4;
    }

    .markdown-body h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin: 24px 0 16px;
      padding-bottom: 0.3em;
      border-bottom: 1px solid #d8dee4;
      color: #1f2328;
    }

    .markdown-body h3 {
      font-size: 1.25em;
      font-weight: 600;
      margin: 20px 0 12px;
      color: #1f2328;
    }

    .markdown-body p {
      margin-bottom: 16px;
    }

    .markdown-body ul,
    .markdown-body ol {
      margin-bottom: 16px;
      padding-left: 2em;
    }

    .markdown-body li {
      margin-bottom: 4px;
    }

    .markdown-body li > ul,
    .markdown-body li > ol {
      margin-top: 4px;
    }

    .markdown-body code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: rgba(175, 184, 193, 0.2);
      border-radius: 6px;
    }

    .markdown-body pre {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
      border-radius: 6px;
      margin-bottom: 16px;
    }

    .markdown-body pre code {
      padding: 0;
      background-color: transparent;
    }

    .markdown-body blockquote {
      padding: 0 1em;
      color: #656d76;
      border-left: 0.25em solid #d0d7de;
      margin-bottom: 16px;
    }

    .markdown-body hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: #d0d7de;
      border: 0;
    }

    .markdown-body table {
      border-spacing: 0;
      border-collapse: collapse;
      margin-bottom: 16px;
      width: auto;
      overflow: auto;
      display: block;
    }

    .markdown-body table th,
    .markdown-body table td {
      padding: 6px 13px;
      border: 1px solid #d0d7de;
    }

    .markdown-body table th {
      font-weight: 600;
      background-color: #f6f8fa;
    }

    .markdown-body table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }

    .markdown-body a {
      color: #0969da;
      text-decoration: none;
    }

    .markdown-body a:hover {
      text-decoration: underline;
    }

    .markdown-body strong {
      font-weight: 600;
    }

    .markdown-body img {
      max-width: 100%;
      height: auto;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #656d76;
    }

    .error {
      text-align: center;
      padding: 40px;
      color: #cf222e;
    }

    @media (max-width: 768px) {
      body {
        padding: 0;
      }

      .container {
        padding: 24px 16px;
        border-radius: 0;
        box-shadow: none;
      }

      .header h1 {
        font-size: 24px;
      }

      .markdown-body h1 {
        font-size: 1.75em;
      }

      .markdown-body h2 {
        font-size: 1.25em;
      }

      .markdown-body h3 {
        font-size: 1.125em;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 id="page-title">文档查看器</h1>
      <div class="subtitle" id="page-subtitle"></div>
    </div>
    <div id="content" class="markdown-body">
      <div class="loading">加载中...</div>
    </div>
  </div>

  <script>
    // 从 URL 参数读取目标文件路径，默认加载 changelog.md
    function getFilePath() {
      const params = new URLSearchParams(window.location.search);
      return params.get('file') || 'changelog.md';
    }

    // 根据文件名生成页面标题
    function getFileTitle(filePath) {
      const fileName = filePath.split('/').pop().replace('.md', '');
      return fileName;
    }

    // 修正 markdown 内容中的图片路径
    // 当 markdown 文件位于子目录时，图片路径需要加上目录前缀
    // 例如：markdown 在 docs/manual/abc.md，图片路径 manual/screenshots/login.png
    // 需要修正为 docs/manual/screenshots/login.png
    function fixImagePaths(markdown, filePath) {
      // 获取 markdown 文件所在的目录
      const pathParts = filePath.split('/');
      pathParts.pop(); // 移除文件名
      const dir = pathParts.join('/');

      if (!dir) return markdown; // 文件在根目录，无需修正

      // 匹配 markdown 中的图片语法：![](path)
      return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // 跳过绝对路径（以 / 开头）或外部 URL（以 http:// 或 https:// 开头）
        if (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://')) {
          return match;
        }
        // 跳过带协议或 data: 的图片
        if (src.includes('://')) {
          return match;
        }
        // 修正相对路径：加上 markdown 所在目录作为前缀
        const fixedSrc = dir + '/' + src;
        return `![${alt}](${fixedSrc})`;
      });
    }

    // 加载并渲染 Markdown 文件
    async function loadMarkdown() {
      const contentEl = document.getElementById('content');
      const titleEl = document.getElementById('page-title');
      const subtitleEl = document.getElementById('page-subtitle');
      const filePath = getFilePath();

      try {
        const response = await fetch(filePath);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let markdown = await response.text();

        // 更新页面标题
        const fileTitle = getFileTitle(filePath);
        titleEl.textContent = fileTitle;
        subtitleEl.textContent = filePath;
        document.title = fileTitle;

        // 修正图片路径
        markdown = fixImagePaths(markdown, filePath);

        // 使用 marked 解析 markdown
        const html = marked.parse(markdown, {
          breaks: true,
          gfm: true
        });

        contentEl.innerHTML = html;
      } catch (error) {
        console.error('加载失败:', error);
        contentEl.innerHTML = `
          <div class="error">
            <p>加载失败</p>
            <p>无法加载文件: ${filePath}</p>
            <p style="font-size: 14px; margin-top: 8px;">${error.message}</p>
          </div>
        `;
      }
    }

    // 页面加载完成后执行
    document.addEventListener('DOMContentLoaded', loadMarkdown);
  </script>
</body>
</html>
```

## 自定义

如需修改页面默认标题样式，编辑 `.header h1` 相关 CSS。页面标题会根据加载的文件名自动设置。
