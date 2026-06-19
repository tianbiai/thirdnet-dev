# SFC 大文件重构（指针）

> 本文件已合并到 `vue-best-practices` 的权威参考 [sfc.md](../../vue-best-practices/references/sfc.md)（末尾「SFC 行数上限与大型组件拆分」一节）。

权威内容包含：

- 强制行数上限（`.vue` > 300 行 / `<script setup>` > 200 行 / `<template>` > 150 行 / `<style scoped>` > 100 行）
- 诊断方法、四步拆分法（状态→Composable / UI→子组件 / 跨组件→Pinia / CSS 精简）
- feature folder 目录结构、常见反模式、拆分检查清单

当需要 `.vue` 行数限制与大型组件拆分策略时，请直接阅读 `vue-best-practices` 的 [sfc.md](../../vue-best-practices/references/sfc.md)。
