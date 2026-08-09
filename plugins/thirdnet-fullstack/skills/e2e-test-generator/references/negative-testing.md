# 负向测试——权限 & 冲突用例

负向用例正是纯 UI 测试大显身手、而 API 驱动测试会出错的地方。两个模式几乎覆盖一切。

## 模式 1：无权限控件**在 DOM 中不存在**（不是 403）

前端权限指令（Element Plus 里的 `v-permission`，或某个 wrapper）把无权限的按钮/菜单从 DOM 移除。真实用户体验是「按钮压根不在那儿」——所以就这么断言：

```python
def assert_no_button(page, text):
    expect(page.get_by_role("button", name=text)).to_have_count(0)

def assert_no_menu(page, menu_text):
    expect(page.locator(".el-menu-item, .el-sub-menu__title", has_text=menu_text)).to_have_count(0)
```

**为什么不是「点了等 403」？**
1. **不够忠实**——真实用户从来看不到那个按钮；点它是个合成场景。
2. **污染被动监听器**——一次触发的 403 会作为红色发现出现，除非你把每一个都登记成预期，这就是噪音。
3. **指令行为一变就崩**——如果指令哪天改成「渲染再禁用」（或点了才显示再隐藏）而非移除，点击路径就崩；count=0 路径不会。
4. **不存在的东西你点不了**——一旦指令把它移除，就没有可点的；403 测试不先强制按钮可见根本写不出来。

**正向范围配对：** 对每个范围受限的角色，断言它*能看到*自己范围的数据、*看不到*兄弟范围的数据：
```python
assert_row_exists(page, own_entity_name)        # 在范围内
assert_row_gone(page, sibling_entity_name)      # 范围外（被过滤掉了）
```

## 行内按钮按可见性控制时

有些行内动作 `v-if` 绑在行状态上（发布/下架、受理/完成）。那是*状态*控制，不是*权限*控制。对那些，断言「这一对里恰好一个可见」——点那个 `to_have_count(1)` 的。别把两者搞混：权限 → 换个角色跑并期望不存在；状态 → 同角色，期望状态对应的那个按钮。

## 模式 2：冲突 / 校验 toast + `expect_response` 兜底

当前端执行某条规则（如时间重叠或唯一约束冲突），它会弹 toast 且不跳转。断言 toast：
```python
crud.fill_...(page, ...)         # 重叠的时间
crud.submit_dialog(page)
expect_toast(page, "时间冲突")    # 或项目真实文案——探索得到
assert_row_gone(page, bad_name)  # 没被创建出来
```

有时前端预检不完善，**后端**返回 409/422，前端再把它展示成 toast。这时 5xx/4xx 被动监听器*会*看到这个 409——把它登记为**预期**，免得被误报成 bug：

```python
h.expect_response("/api/<module>/<entity>", status=409)   # 在动作之前
crud.submit_dialog(page)
expect_toast(page, "时间冲突")
```

原则：**把预期内的失败显式标记；其余的全部上报。** `expect_response` 登记表是测试工具表达「这个 4xx 是该发生的」的方式。流程里任何*别的* 4xx/5xx 才是真实发现。

## 探索要负向测什么

阶段 1 里，对每个权限码（如 `<module>:<entity>:<action>`，例如 `order:order:approve`、`cms:notice:publish`），记录：
- 哪些角色**有**它（→ 正向：能做），
- 哪些角色**缺**它（→ 负向：按钮/菜单不存在），
- 以及对于状态/状态机，哪些行状态控制哪些动作。

把每一个映射成一条测试断言。一套好套件对其范围内的每个权限受限动作都有一条负向断言。
