---
name: md-to-word
description: 将 Markdown 文件转换为 Word (.docx) 文件。当用户需要 md 转 word、markdown 转 docx、生成 word 文档、导出 docx 时使用此技能。
---

# Markdown 转 Word 技能

## 功能

将指定的 Markdown 文件转换为格式良好的 Microsoft Word (.docx) 文档。

## 使用步骤

### 1. 确认输入文件

确认用户提供的 Markdown 文件路径：
- 路径可以是相对路径或绝对路径
- 文件必须存在且可读
- 支持标准 Markdown 格式（.md 或 .markdown）

### 2. 检查/安装依赖

运行转换脚本前，确保安装了必要的 Python 库：

```bash
pip install python-docx markdown Pillow
```

### 3. 执行转换

使用内置的转换脚本进行转换：

```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/md_to_docx.py <input.md> [output.docx]
```

参数说明：
- `input.md` - 输入的 Markdown 文件路径（**必需**）
- `output.docx` - 输出的 Word 文件路径（**可选**，默认与输入文件同名，仅扩展名改为 .docx）

### 4. 验证输出

转换完成后，检查以下内容：
- [ ] 输出文件已生成
- [ ] 文件大小合理（不为 0 字节）
- [ ] 文档内容完整，包含所有章节

## 支持的 Markdown 格式

转换脚本支持以下 Markdown 元素：

| Markdown 元素 | Word 格式 |
|--------------|----------|
| `# 标题1` | 标题 1 样式 |
| `## 标题2` | 标题 2 样式 |
| `### 标题3` | 标题 3 样式 |
| `**粗体**` | 粗体 |
| `*斜体*` | 斜体 |
| `` `代码` `` | 等宽字体 |
| `- 列表项` | 项目符号列表 |
| `1. 列表项` | 编号列表 |
| `[链接](url)` | 带下划线的文本 |
| `> 引用` | 缩进文本 |
| 普通段落 | 正文样式 |
| **表格** | **Word 表格**（第一行作为表头加粗）|

## 示例

### 基本用法

**用户输入**：
```
将 documents/report.md 转换为 Word
```

**执行命令**：
```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/md_to_docx.py documents/report.md
```

**输出**：
- `documents/report.docx`

### 指定输出路径

**用户输入**：
```
把 notes.md 转换成 output/notes-v1.docx
```

**执行命令**：
```bash
python ${CLAUDE_PLUGIN_ROOT}/scripts/md_to_docx.py notes.md output/notes-v1.docx
```

## 错误处理

如果遇到问题，按以下顺序排查：

1. **文件不存在**：检查输入路径是否正确
2. **权限错误**：检查文件读取/写入权限
3. **依赖缺失**：运行 `pip install python-docx markdown`
4. **格式异常**：检查 Markdown 文件是否包含特殊格式

## 注意事项

- 转换后的 Word 文档保留基本格式
- **字体统一**：所有文本（正文、标题、代码块、引用块等）统一使用**宋体**
- **表格**：支持 Markdown 表格转换为 Word 表格，第一行自动作为表头加粗
- **图片**：Markdown 图片语法 `![alt](url)` 会转换为文本 `[图片: alt]`，不会嵌入实际图片
- 代码块会保留为等宽字体，但不会保留语法高亮
- 超链接会保留为纯文本，不带点击功能
- **下划线保留**：不处理 `_text_` 格式的斜体标记，以保留技术文档中的下划线命名（如数据库表名 `t_account_name`）
