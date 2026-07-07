# 用户手册截图指引（user-manual-screenshot-guide）

> 本文件定义 thirdnet-doc-generator 技能在生成**用户手册**时，于 Step 3.5「启动 mock 前端并逐页截图」执行的详细操作。
> 目的：让用户手册图文并茂、与代码同源——mock 数据驱动真实页面，无需后端即可独立产出界面截图，并据此核对功能流程文案。
> **扫描/启动阶段除后台启动 dev server 外不修改业务源码**；如需切换 mock 开关，优先用临时环境变量或建议用户修改 `.env`，不擅自改源文件。

## 为什么用 mock 模式截图

用户手册的截图必须反映系统真实界面与字段文案。直接连真实后端往往受制于：后端未部署、数据库无演示数据、登录账号受限、写操作不敢执行。**mock 模式**让前端用内置假数据完整运行全部模块（登录直接放行、CRUD 全可用），既保证截图真实，又零外部依赖、零数据风险。

## 前置判定

1. **识别前端项目根与类型**
   - Web Admin（`create-thirdnet-admin` 脚手架生成，优先）：含 `vite.config.ts`、`src/views/`、`src/mock/data/`。
   - uniapp / 移动端：含 `manifest.json`、`src/pages/`、`.env.{mode}` 三文件。
   - 若仓库内**无前端项目代码**（如本仓库只有插件/技能，无实际业务前端），直接走降级（见文末），不要凭空生成截图。
2. **确认 mock 开关已开**
   - 开关变量：`VITE_MOCK_ENABLED`（字符串 `"true"` / `"false"`，**不是**布尔，也**不存在** `VITE_USE_MOCK`）。读取点 `src/config/index.ts`：`MOCK_ENABLED = import.meta.env.VITE_MOCK_ENABLED === 'true'`。
   - Admin 模板：检查根 `.env`，`VITE_MOCK_ENABLED` 应为 `true`。
   - 非 Admin：检查 `.env.development`（dev 模式默认连真实后端，需手动置 `true`）或改用 `prototype` 模式。
   - 若未开：**不要擅自改源文件**，优先用临时 env 启动：`VITE_MOCK_ENABLED=true npm run dev`；或建议用户修改 `.env` 后重启。
3. **记录截图可行性摘要**（供主上下文判定主路径 vs 降级）：项目类型、`VITE_MOCK_ENABLED` 当前值、dev 启动命令、默认端口、Playwright MCP 是否可用。

## 启动 dev server

- **命令**：在确认的前端项目根执行 `npm run dev`（Admin 模板默认端口 **3009**，访问 `http://localhost:3009`）。
- **方式**：后台运行（Bash 工具 `run_in_background: true`），记录任务 ID；轮询基础 URL（如 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3009`）直至返回 200/3xx，再开始截图。
- **超时**：等待端口就绪超过 ~60s 视为启动失败，走降级。
- **登录**：mock 模式下登录通常直接放行——导航到登录页，填任意账号密码（按页面实际占位提示），点「登录」进入主界面。

## 逐页截图（核心）

截图范围严格以 **Step 3 用户确认/裁剪后的模块清单**为准，不要截全量菜单（避免无关模块污染手册）。

**工具首选**：Playwright MCP（`playwright@claude-plugins-official` 插件，会话内已启用，仓库无需任何 npm 依赖）。

最小调用序列（每个模块）：

1. `browser_navigate` → 进入模块路由（或从主界面点左侧菜单进入，更贴近用户真实路径）。
2. `browser_snapshot` → 取可访问性快照，定位列表/按钮/表单元素，**记录实际按钮文案、菜单名、字段标签**（供 Step 4 写「操作步骤」「字段说明」）。
3. 等待列表/表单渲染稳定（必要时 `browser_wait_for` 等待某文案出现）。
4. `browser_take_screenshot`（`type: png`、`scale: css`、`fullPage: true`）→ 落盘到 `docs/images/user-manual/{模块key}-{视图}.png`。

**命名与覆盖约定**：
- 文件名使用小写英文 kebab-case，如 `user-list.png`、`user-edit.png`、`role-perm.png`。
- 每个模块至少一张**列表页**；新增/编辑等关键弹窗（dialog）**另截一张**（先 `browser_click` 触发弹窗再截）。
- 登录页、主界面总览各一张（模板已预留占位）。
- 图片存放目录：`docs/images/user-manual/`（与最终 `.md` 同 `docs/` 根，保证相对路径 `images/user-manual/xxx.png` 在 Markdown 与 Word 中都有效）。

**功能流程记录**：截图过程中同步记录每个模块的「进入路径 → 主要按钮 → 字段 → 操作顺序」，作为 Step 4 文案的权威来源——手册里写的按钮名、字段名必须与截图页面一致，杜绝臆造或凭扫描代码猜测。

## 截图清单（返回给主上下文）

完成截图后，产出一份结构化清单供 Step 4 引用：

```markdown
## 截图清单（mock 模式，dev server: http://localhost:3009）

| 模块 | 视图 | 图片相对路径 | 关键操作/字段记录 |
|------|------|-------------|------------------|
| 用户管理 | 列表 | images/user-manual/user-list.png | 入口：系统管理→用户；按钮：新增/编辑/删除；字段：用户名/姓名/角色 |
| 用户管理 | 新增弹窗 | images/user-manual/user-edit.png | 必填：用户名、初始密码；角色下拉多选 |
| ... | ... | ... | ... |
```

## 降级路径

当出现以下任一情况，**不阻断**用户手册生成，转入降级：

- 仓库无前端项目代码 / mock 数据缺失 → 无法启动。
- dev server 启动超时 / 端口被占用且无法让出。
- Playwright MCP 工具不在会话中。

**降级动作**：
1. **备选工具**：若 Playwright MCP 不可用，可改用 Playwright CLI（需先 `npm i -D playwright` + `npx playwright install chromium`）：`npx playwright screenshot --full-page --wait-for-timeout 2000 http://localhost:3009/#/user docs/images/user-manual/user-list.png`。CLI 不可用则继续降级。
2. **保留占位符**：用户手册模板中的 `![...](images/...)` 占位符原样保留，不替换为真实路径。
3. **记录待补清单**：在手册文末「备注」列出「待补截图清单：模块 → 失败原因」，并提示用户：环境就绪后可单独重跑本步骤补齐截图（图片替换占位符即可，无需重写全文）。

## 收尾

- 截图全部完成（或降级判定成立）后，**停止后台 dev server**（`TaskStop` 或 `kill`），释放端口。
- 将「截图清单」或「待补截图清单」交回主上下文，进入 Step 4 填充模板。
