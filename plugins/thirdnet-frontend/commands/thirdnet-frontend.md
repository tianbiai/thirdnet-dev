---
name: thirdnet-frontend
description: 创建或修改前端页面和组件
argument-hint: '"页面描述" - 例如: "创建登录页面" 或 "修改首页布局"'
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - LSP
  - AskUserQuestion
  - TodoWrite
  - WebSearch
---
# 前端开发命令

委托给 `frontend-developer` Agent 执行前端开发任务。Agent 会自动完成需求澄清、技能加载、编码和校验。

## 使用方法

```
/thirdnet-frontend "你的需求描述"
```

## 示例

```
/thirdnet-frontend "创建一个用户个人资料页面"
/thirdnet-frontend "在首页添加一个轮播图组件"
/thirdnet-frontend "修复移动端导航栏的显示问题"
/thirdnet-frontend "优化登录表单的验证逻辑"
```

## 代理委托

将用户的需求描述作为任务传递给 `frontend-developer` Agent。Agent 会根据任务类型自动选择执行模式（直接调用 / 计划执行），并负责所有流程控制、技能调用和校验。

关键入口技能：`thirdnet-frontend:frontend-workflow`（所有前端任务必须首先调用）。

## 注意事项

- 确保项目已初始化前端框架
- 描述尽量具体，包含必要的功能点
- 如需特定样式或交互，请详细说明
- 设计或开发过程中，可使用 `/ui-ux-pro-max` 全局技能对页面进行优化
