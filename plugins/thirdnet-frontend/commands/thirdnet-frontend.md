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
---
# 前端开发命令

使用前端开发专家 Agent 来创建或修改前端代码。

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

## 执行流程

1. 分析用户提供的需求描述
2. 调用前端开发专家 Agent（`agents/frontend-developer.md`）
3. Agent 将：
   - 理解需求和技术上下文
   - 参考前端技能文档（`vue-best-practices`、全局技能 `/frontend-design`、`vue-pinia-best-practices` 等）
   - 参考 `doc-templates` 技能中的规范模板（project-spec-template、changelog-template 等）
   - 遵循 API 策略工厂架构（`api-typescript-spec` 技能）：API 模块采用接口契约策略工厂模式（`IXxxApi` + `RealXxxApi` + `MockXxxApi` + `createXxxApi()`），与 Mock 数据（`mock/data/{endpoint}/*.ts`）文件名一致
   - 遵循演示模式控制：`MOCK_ENABLED` 开关控制帮助气泡显示与数据来源
   - 遵循文档驱动开发流程
   - 生成或修改相应的代码文件

## 注意事项

- 确保项目已初始化前端框架
- 描述尽量具体，包含必要的功能点
- 如需特定样式或交互，请详细说明
- 遵循文档驱动开发：先有 spec.md 再编写代码
- 设计或开发过程中，可使用 `/ui-ux-pro-max` 全局技能对页面进行优化
