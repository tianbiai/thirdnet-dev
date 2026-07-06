# 报告格式与严重级别（report-format）

> 本文件定义 fullstack-review 技能的严重级别、finding 条目格式、报告模板，以及大范围审查时的子代理派发 prompt。

---

## 一、严重级别定义

| 级别 | 含义 | 阻断 | 示例 |
|------|------|------|------|
| 🔴 **Critical** | 必须立即修，否则不可交付：安全漏洞、数据丢失、跨端契约断裂、编译错误、运行时必抛异常、SQL 注入 | **阻断**（Stop Hook 不放行） | `DateTime.Now` 写 `timestamptz`；`appsettings.json` 真实密钥；SQL 拼接；`View` 含 `password_hash` |
| 🟠 **Major** | 应当修，违反明确规范或引入显著风险/性能问题 | **阻断** | 缺 `[PermissionAuthorize]`/`[OperLog]`；`Map` 后缀错；手写分页；漏 `dept_id` 索引；前后端权限串不一致；按钮无防抖 |
| 🟡 **Minor** | 建议修，命名瑕疵、注释缺失、轻微不一致 | 不阻断 | 注释不全；命名小瑕疵；次要格式 |
| 🔵 **Info** | 肯定优点 / 更优模式建议 | 不阻断 | 复用得当；可换某模式更优 |

**Stop Hook 阻断阈值**：报告中存在**任一 Critical 或 Major** → 判 `fail`。全部清零（或仅剩 Minor/Info）→ `pass`。

---

## 二、finding 条目格式

每条问题在报告「问题清单」中按下表呈现。**客观有据**——`违反规则`与`来源技能`不可省，否则不写进清单（猜测归入「歧义与待确认」）。

| 字段 | 说明 | 示例 |
|------|------|------|
| **编号** | `C-001` / `M-001` / `m-001` / `I-001`（C/M/m/I 对应四级） | `C-003` |
| **级别** | 🔴 Critical / 🟠 Major / 🟡 Minor / 🔵 Info | 🔴 Critical |
| **维度** | A 后端 / B 前端 / C 跨端 / D 业务 / E 性能 / F 安全 / G 文档 | F 安全 |
| **位置** | `file_path:line` （可点击） | `backend/X.Admin/.../UserService.cs:87` |
| **描述** | 一句话说清问题 | 应用层用 `DateTime.Now` 赋值 `login_date` |
| **违反规则** | 原文摘录或规则陈述 | 应用层对时间字段赋值必须用 `DateTime.UtcNow`，禁止 `DateTime.Now` |
| **来源技能** | 规则出处 | `net-efcore-developer` §时间字段类型 |
| **修改方案** | 具体改法（改哪、怎么改） | 改为 `user.login_date = DateTime.UtcNow;`；确认该列已映射 `timestamptz` |

**清单展示样式**（Markdown）：

```
#### C-003 🔴 Critical ｜ F 安全 ｜ backend/.../UserService.cs:87
- **问题**：应用层用 `DateTime.Now` 赋值 `login_date`
- **违反规则**：时间字段赋值必须用 `DateTime.UtcNow`，禁止 `DateTime.Now`（`timestamptz` 要求 `Kind==Utc`，否则 Npgsql 抛 `InvalidCastException`）
- **来源**：`net-efcore-developer` §时间字段类型
- **修改方案**：改为 `user.login_date = DateTime.UtcNow;`，并确认该列已 `.HasColumnType("timestamptz")`
```

---

## 三、报告模板（review-report.md）

```markdown
# 全栈代码审查报告 — {模块名/范围}

## 1. 审查概要
- **审查范围**：{模式：SVN 未提交 / SVN 最近 N 次提交 / 整个项目 / 显式路径}
- **VCS**：{SVN / git / 无（全扫描）}
- **受影响模块**：{notice, order, ...}
- **审查文件数**：{N}（后端 {n1} / 前端 {n2}）
- **审查时间**：{YYYY-MM-DD HH:mm}
- **运行时校验**：{已跑 dotnet build / vue-tsc 且通过 ｜ 未做（注明原因）}

## 2. 严重级别统计
| 级别 | 数量 |
|------|------|
| 🔴 Critical | {n} |
| 🟠 Major | {n} |
| 🟡 Minor | {n} |
| 🔵 Info | {n} |
| **合计** | **{N}** |

## 3. 问题清单（按维度分组）

### A 后端规范遵守
（按编号列 finding，样式见上）

### B 前端规范遵守
...

### C 跨端契约一致性
...

### D 业务功能正确性
...

### E 性能
...

### F 安全性
...

### G 文档与流程
...

## 4. 整体优缺点
**优点**（做得好的，值得保持）：
- ...

**不足**（系统性问题、反复出现的模式）：
- ...

## 5. 歧义与待确认
（技能间分歧或代码与规范矛盾处，向用户提问而非判定）
- **{歧义主题}**：{描述}。建议：{选项}。请确认项目既定约定。

## 6. 修改方案汇总（优先级排序）
| 优先级 | 编号 | 位置 | 动作 |
|--------|------|------|------|
| P0 | C-001 | ... | ... |
| P0 | C-003 | ... | ... |
| P1 | M-002 | ... | ... |
| P2 | m-005 | ... | ... |

## 7. 阻断结论
- **结论**：🔴 **FAIL**（存在 {n} Critical / {m} Major，须修复后重跑本技能） ｜ 🟢 **PASS**（仅余 Minor/Info）
- **Stop Hook**：{阻断中，修复后自动放行 ｜ 已放行}
- **下一步建议**：{修复路径建议，如「回到 backend-workflow 修复 C-003 后重跑 fullstack-review」}
```

> 报告写入位置见 [SKILL.md「报告输出」](../SKILL.md)：默认被审模块 docs 目录，跨模块/全项目放仓库根。

---

## 四、子代理派发（大范围审查）

范围较大（≥3 模块或全项目）时，用 Task 工具并行派发三路审查子代理。**跨端对照与汇总留在主上下文，不派发。**

### 子代理返回 schema（统一）

每个审查子代理返回如下结构（JSON 或结构化文本）：

```json
{
  "reviewer": "backend | frontend | cross-stack",
  "modules": ["notice", "order"],
  "findings": [
    {
      "id": "C-001",
      "level": "Critical | Major | Minor | Info",
      "dimension": "A | B | C | D | E | F | G",
      "location": "file:line",
      "description": "问题描述",
      "violated_rule": "违反规则原文/陈述",
      "source_skill": "来源技能",
      "fix": "修改方案"
    }
  ],
  "notes": "该侧整体观察/歧义"
}
```

### 4.1 后端审查者 prompt

```
你是 ThirdNet 后端代码审查者，专精本插件（thirdnet-fullstack）的后端规范。
任务：对以下后端文件做维度 A（后端规范）+ 后端侧 D（业务正确性）/E（性能）/F（安全）/G（文档）审查。

【范围】{VCS 模式 + 受影响后端文件清单 + 模块名}

【必做】
1. 先通过 Skill 工具调用 thirdnet-fullstack:net-api-developer 与 thirdnet-fullstack:net-cache-use
   读取其「代码审查清单」；调用 thirdnet-fullstack:backend-workflow 读取「开发完成校验」。
2. 按 references/review-rules.md 的 A1-A7、D、E、F、G 逐项检查。
3. 高优先扫：DateTime.Now→timestamptz、[HttpPut/Delete/Patch]、匿名/实体返回、
   缺 [PermissionAuthorize]/[OperLog]、_tokenCache.SetTokenInvalidationTime、SQL 拼接、
   View 含敏感字段、缺 dept_id 索引、批量后未删缓存。
4. 已知例外（勿误报）：online-user 无独立 Controller；Sys 前缀不统一——读实际类名判定。

【返回】按上述 schema 返回 findings 数组 + notes。每条必须含 violated_rule + source_skill + fix，
无依据不要写。客观、可执行、抓大放小。
```

### 4.2 前端审查者 prompt

```
你是 ThirdNet 前端代码审查者，专精本插件（thirdnet-fullstack）的前端规范。
任务：对以下前端文件做维度 B（前端规范）+ 前端侧 D/E/F/G 审查。

【范围】{VCS 模式 + 受影响前端文件清单 + 模块名}

【必做】
1. 先通过 Skill 工具调用 thirdnet-fullstack:api-typescript-spec、thirdnet-fullstack:vue-best-practices、
   thirdnet-fullstack:admin-template-setup、thirdnet-fullstack:vue-enum-dict 读取规范；
   调用 thirdnet-fullstack:frontend-workflow 读取「开发完成校验」。
2. 按 references/review-rules.md 的 B1-B4、D、E、F、G 逐项检查。
3. 高优先扫：5 文件契约齐全性、策略工厂三件、useCrudTable/PaginationBar/useDialogFocus/validators、
   el-pagination 违禁、v-permission 数组与 action 混用、MOCK_ENABLED 守卫、按钮防抖、
   字典 useDict/getDictDataByType 不混、表列 *_label、.js 违禁、Pinia 解构、Router next() 违禁。
4. 已知例外：/add vs /create 以模块内一致为准；模板内置模块业务逻辑不应被改。

【返回】按上述 schema 返回 findings 数组 + notes。客观、可执行、抓大放小。
```

### 4.3 跨端审查者 prompt

```
你是 ThirdNet 跨端契约审查者。任务：对以下模块做维度 C（跨端契约一致性）审查——必须同时读前后端产物。

【范围】{受影响模块清单 + 前后端契约文件路径}

【必做】
1. 调用 thirdnet-fullstack:thirdnet-fullstack 读取「前后端类型映射规则」「RBAC 前后端桥接」「约定同步检查清单」。
2. 逐模块对照：
   - 命名映射：{Entity}QueryParams↔QueryMap、CreateParams↔CreateMap、UpdateParams↔UpdateMap、Item↔ItemMap
   - 字段逐个：名称(snake_case)、类型(number↔long 等)、可空(?↔?)、枚举值
   - 分页：PaginatedResponse<T>↔PageListInfo<List<T>>（list/total/index/pages）
   - 权限串逐字：前端 v-permission/usePermission 串 ↔ 后端 [PermissionAuthorize] 串
   - URL action(/detail 等) ≠ 权限 action(query 等)
   - 约定同步 7 项
3. 不一致即 Major（契约断裂 Critical）。

【返回】按上述 schema 返回 findings（dimension=C）+ notes（含歧义）。
```

### 主上下文汇总职责（不派发）

- 收集三路子代理 findings → 去重（同位置合并）→ 按级别排序
- 跨端对照结果与各侧 findings 交叉验证
- 填写报告 7 段（概要/统计/清单/优缺点/歧义/方案/结论）
- 写 `review-report.md` + 对话摘要
