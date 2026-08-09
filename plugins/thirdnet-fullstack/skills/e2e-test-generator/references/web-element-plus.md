# 变体：Vue3 + Element Plus 后台（首选快速通道）

当 web 后台是 Vue 3 + Element Plus——一种常见的开源后台技术栈——时使用。这些原子是从一套真实套件里提炼的；按阶段 1 探索的结果适配*字符串*（label/菜单名），*机制*保持不变。

## 表单原子——按 label 定位

表单项 = `.el-form-item`；它的 label = `.el-form-item__label`。把 `.el-form-item` 过滤到 label 匹配的那个，再操作里面的控件来定位字段。（label 重复时取 `.last`。）

```python
def _form_item(page, label):
    return page.locator(".el-form-item").filter(
        has=page.locator(".el-form-item__label", has_text=label)
    ).last

def fill_text(page, label, value):       _form_item(page,label).locator("input,textarea").first.fill(value)
def fill_textarea(page, label, value):   _form_item(page,label).locator("textarea").first.fill(value)
def fill_radio(page, label, option):     # 点击 .el-radio__label == option 的那个 .el-radio
def fill_select(page, label, option):    # 点 trigger -> 点匹配 option 的 .el-select-dropdown__item
def fill_tree_select(page, label, option): # el-tree-select：点 trigger -> 点匹配的节点
def fill_multi_select(page, label, *opts):
def fill_switch(page, label, on=True):
def fill_time_select(page, label, hh_mm, index=0):  # el-time-select 滚轮
def fill_rich_text(page, label, html):   # .ql-editor / contenteditable：page.evaluate 设 innerHTML
def fill_file_upload(page, label, path): # page.expect_file_chooser() -> set_input_files
def fill_location_editor(page, ...):     # 多行（楼栋 select + 楼层 multi-select），“+ 添加落点”
```

> **逐个字段确认它的真实控件类型**——一个「状态」字段在某个实体里可能是 `radio`，在另一个里是 `select`（例如一个实体的状态是 select，另一个是带 启用/停用 的 radio）。把辅助函数配错控件类型，是最常见的生成 bug。

## 表格回验——按列头定位

```python
def read_cell(page, keyword, column_label):
    row = find_row(page, keyword)              # 含 keyword 的 .el-table__row
    col_idx = _column_index(page, column_label) # 从 .el-table__header-wrapper th 文本算出的索引
    return row.locator("td").nth(col_idx).inner_text()
```

`find_row` / `row_exists` / `assert_row_exists` / `assert_row_gone` 都基于按文本过滤的 `.el-table__row`。

## 导航——侧边栏菜单优先

```python
def open_module(h, page, key):
    dir_name, menu_name = WEB_MENU[key]        # 来自 selectors.py
    # 展开目录，按文本点菜单项——mock/real 路由下都稳
```

**为什么侧边栏优先：** mock 模式下，空 path 的目录会触发「多数投票」派生出错误的子路由（例如一个目录解析到意料之外的模块）。按文本点菜单完全规避这点。只对已知稳定的页面写死路由（`page.goto`），并把它当兜底。

## 弹窗机制

```python
def submit_dialog(page):    page.get_by_role("button", name="确定").click()  # 或该弹窗的提交动词
def confirm_msgbox(page):   # .el-message-box 的确认按钮
def expect_success(page):   # 等待 TOAST_SUCCESS_TEXTS 里的某个成功 toast 文本
```

**提交动词的意外：** 多数弹窗用「确定」，但有的用业务专属动词（例如回复/表单弹窗可能用「发送」提交）。探索时读真实的按钮文案；别假设。

## 易踩的坑（来自一套真实 Element Plus 套件——留意这些）

- **`status` 通常是 radio，不是 select**——`fill_select` 会静默失败。每个实体都要确认。
- **角色-菜单分配是一棵 `show-checkbox`、`check-strictly=false` 的 `el-tree`**——节点按**可见菜单名**标注，UI 不暴露任何权限串。按 label 文本勾选。勾目录会勾上整个子树；勾叶子会勾上它 + 它的按钮（父节点变半选）。**别做按钮级勾选**——像「查询」这种按钮名在各模块重复，会导致误勾。停留在目录/叶子粒度。
- **用户弹窗**是单表单：所属部门=`el-tree-select`、角色=`el-select multiple`（按角色名）、include_sub_depts=`el-switch`、status=`el-radio-group`。
- **首列不固定**——通常是「ID」，但有的模块标注不同（例如某工单模块首列是业务编码「工单号」，值=id）。按列头 `read_cell` 能处理。
- **条件性行内按钮**——发布/下架（发布/下架）按状态 `v-if` 控制；同一时刻只有一个可见。点存在的那个。
- **直接动作 vs 弹窗**——有的行内动作（受理/完成）只弹个 toast 就立即执行；有的开弹窗；有的嵌套弹窗（一个详情弹窗里再开一个回复子弹窗）。用 try/confirm 兜底处理可选的 MessageBox。

## 这个变体该往 `selectors.py` 里放什么

```python
EL_FORM_ITEM=".el-form-item"; EL_TABLE_ROW=".el-table__row"; EL_RADIO=".el-radio"
EL_SELECT=".el-select"; EL_TREE_SELECT=".el-tree-select"; EL_MESSAGEBOX=".el-message-box"
EL_TABLE_HEADER_CELL=".el-table__header-wrapper th"
WEB_MENU = {"entity":("目录","菜单"), ...}    # 每个模块 (目录, 菜单)——来自探索
WEB_ROUTE = {"entity":"/module/entity-list", ...}   # 稳定的直接路由作为兜底
TOAST_SUCCESS_TEXTS = ["操作成功","成功","添加成功","更新成功","发布成功"]
```

完整的、要适配的辅助函数集见 `assets/adapt-skeletons/web_crud.py.tpl` 和 `selectors.py.tpl`。
