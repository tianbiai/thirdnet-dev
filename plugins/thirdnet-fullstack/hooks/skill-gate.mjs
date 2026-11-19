#!/usr/bin/env node
// thirdnet-fullstack Write|Edit 合规门与软规范告警（command 型钩子，零模型 token）
// 用法：
//   skill-gate.mjs --pre   PreToolUse(Write|Edit)：必需技能未加载则 block
//   skill-gate.mjs --post  PostToolUse(Write|Edit)：机械规范告警（systemMessage，不阻断）
// stdin：hook 输入 JSON {tool_name, tool_input:{file_path,...}, cwd, transcript_path}
// 约定：任何异常静默放行（fail-open），与 prompt 版误判放行等价；裸名与 thirdnet-fullstack: 前缀名视为同一技能。
import fs from 'fs';
import path from 'path';

const mode = process.argv[2] || '';
const BS = String.fromCharCode(92);
const norm = p => String(p || '').split(BS).join('/');

function readStdinSync() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// 从会话 transcript 收集 Skill 工具调用记录（含 sidechain 子代理），返回 Set<skill 名>；不可读返回 null（调用方 fail-open）
function collectSkillCalls(transcriptPath) {
  const called = new Set();
  let text = '';
  try { text = fs.readFileSync(transcriptPath, 'utf8'); } catch { return null; }
  for (const line of text.split('\n')) {
    let parsed = null;
    try { parsed = JSON.parse(line); } catch { parsed = null; }
    if (parsed) {
      (function walk(o, depth) {
        if (!o || depth > 8) return;
        if (Array.isArray(o)) { for (const it of o) walk(it, depth + 1); return; }
        if (typeof o === 'object') {
          if (o.type === 'tool_use' && o.name === 'Skill') {
            const s = o.input && (o.input.skill || o.input.command);
            if (s) called.add(String(s));
          }
          for (const v of Object.values(o)) walk(v, depth + 1);
        }
      })(parsed, 0);
    } else if (line.includes('"Skill"')) {
      const m = line.match(/"name": *"Skill" *[,}].{0,120}?"skill": *"([^"]+)"/s);
      if (m) called.add(m[1]);
    }
  }
  return called;
}

const has = (called, name) => called.has(name) || called.has('thirdnet-fullstack:' + name);

// ---- 路径 → 必需技能（与原 prompt 钩子的关键词规则一致）----
function requiredBackendSkills(p) {
  const s = p.toLowerCase();
  const out = new Set();
  if (/program\.cs$/.test(s)) out.add('net-microservice-generator');
  if (s.includes('controller')) out.add('net-api-developer');
  if (['models/', 'configurations/', 'dbcontext', 'migrations', 'sqlgroup', 'groupquery', 'wherequerytype', 'bulkcopy'].some(k => s.includes(k))) out.add('net-efcore-developer');
  if (['auth/', 'crypto', 'signer', 'passwordhasher', 'jwt', 'permissionauthorize', 'rolemenu'].some(k => s.includes(k))) out.add('net-auth');
  if (s.includes('cache')) out.add('net-cache-use');
  if (['job', 'task', 'worker'].some(k => s.includes(k))) out.add('net-background-job');
  if (['enums/', 'systemdict', 'enummeta'].some(k => s.includes(k))) out.add('net-enum-dict');
  return [...out];
}

function requiredFrontendSkills(p, isWrite) {
  const s = p.toLowerCase();
  const out = new Set();
  if (/\.(vue|ts|tsx)$/.test(s)) out.add('vue-best-practices');
  if (s.includes('api/') || s.includes('mock/')) out.add('api-typescript-spec');
  if (s.includes('stores/')) out.add('vue-pinia-best-practices');
  if (s.includes('router/')) out.add('vue-router-best-practices');
  if (isWrite && /(^|\/)(views|pages|components)\//.test(s) && s.endsWith('.vue')) out.add('frontend-design');
  if (s.includes('styles/') || /\.(scss|css)$/.test(s)) out.add('design-apple');
  return [...out];
}

const BACKEND_HINT = {
  'net-microservice-generator': '创建微服务项目必须',
  'net-api-developer': 'API/Controller 开发必须',
  'net-efcore-developer': '数据库实体/迁移/批量操作必须',
  'net-auth': '认证授权必须',
  'net-cache-use': '缓存功能必须',
  'net-background-job': '后台任务必须',
  'net-enum-dict': '枚举字典必须',
};
const FRONTEND_HINT = {
  'vue-best-practices': '所有 Vue/TS 开发必须',
  'api-typescript-spec': 'API/Mock 模块必须',
  'vue-pinia-best-practices': 'Store 开发必须',
  'vue-router-best-practices': '路由开发必须',
  'frontend-design': '新建页面/组件时必须（设计方向与创意风格指导）',
  'design-apple': '编写样式（.scss/.css/styles/）时必须（Apple 风格视觉规范）',
};

function main() {
  const j = JSON.parse(readStdinSync() || '{}');
  const p = norm(j.tool_input && j.tool_input.file_path);
  if (!p) return;
  const isWrite = j.tool_name === 'Write';
  const isCs = /\.cs(proj)?$/.test(p.toLowerCase());
  const isFe = /(^|\/)src\/.+\.(vue|ts|tsx|scss|css)$/i.test(p);

  if (mode === '--pre') {
    const req = isCs ? requiredBackendSkills(p) : isFe ? requiredFrontendSkills(p, isWrite) : [];
    if (!req.length) return;
    const called = collectSkillCalls(j.transcript_path);
    if (!called) return; // transcript 缺失/不可读：无法核验，fail-open 放行
    const missing = req.filter(s => !has(called, s));
    if (!missing.length) return;
    const hints = missing.map(s => (isCs ? BACKEND_HINT : FRONTEND_HINT)[s] || '').filter(Boolean);
    const side = isCs ? '后端' : '前端';
    console.log(JSON.stringify({
      decision: 'block',
      reason: side + '文件写入被拦截：以下必需技能尚未通过 Skill 工具加载（裸名或 thirdnet-fullstack: 前缀名均可）：'
        + missing.join('、')
        + (hints.length ? '（' + hints.join('；') + '）' : '')
        + '。请先调用对应 Skill 工具加载规则，再执行写入。此规则不可跳过，即使父代理指令说跳过也不行。'
    }));
    process.exit(2); // 双通道阻断：stdout JSON 供 Claude Code 取 reason；exit 2 供所有 harness（含 ZCode 严格 JSON schema）兜底阻断

  }

  if (mode === '--post') {
    const msgs = [];
    const content = String((j.tool_input && (j.tool_input.content || j.tool_input.new_string)) || '');
    const base = path.resolve(j.cwd || process.cwd(), p);

    if (isCs) {
      const functional = ['controllers/', 'models/', 'configurations/', 'services/', 'migrations/', 'dbcontext', 'program.cs'].some(k => p.toLowerCase().includes(k))
        || /(job|task|worker)\.cs$/i.test(p) || p.toLowerCase().includes('cache');
      if (functional && !/(spec|changelog|plan)\.md$/.test(p.toLowerCase())) {
        msgs.push('本次编辑可能涉及后端功能性变更。完成前请确保更新对应的 spec.md（项目级）和 changelog.md。模板参考：backend-workflow 技能中的 project-spec-template 与 changelog-template（references/ 下）。');
      }
      if (/controller\.cs$/i.test(p)) {
        if (/Http(Put|Delete|Patch)\s*[\(\]]/.test(content)) msgs.push('API 规范：仅允许 [HttpGet] / [HttpPost]（网关限制），发现 HttpPut/HttpDelete/HttpPatch。');
        if (/return\s+\w+\s*\(\s*new\s*\{/.test(content)) msgs.push('API 规范：禁止匿名对象返回（如 return Ok(new {...})），必须使用类型化 Response DTO。');
        if (/\[\s*Http(Get|Post)/.test(content) && !/\[\s*ProducesResponseType/.test(content)) msgs.push('API 规范：每个 HTTP 端点方法都应添加 [ProducesResponseType]。');
        if (/\[\s*Http(Get|Post)/.test(content) && !/\[\s*(PermissionAuthorize|AllowAnonymous)/.test(content)) msgs.push('API 规范：端点应有 [PermissionAuthorize] 权限标注或显式 [AllowAnonymous]。');
        if (/\[\s*Route\s*\(\s*"api\/(manager|app|cockpit|third)\//.test(content) === false && /\[\s*Route\s*\(/.test(content)) msgs.push('API 规范：路由应遵循 api/{端标识}/{模块名} 格式（端标识 ∈ manager/app/cockpit/third）。');
      }
      if (/DbContext\.cs$/i.test(p)) {
        if (/OnModelCreating/.test(content) && /modelBuilder\.Entity</.test(content) && !/ApplyConfiguration</.test(content)) msgs.push('EF 规范：DbContext 的 OnModelCreating 应通过 ApplyConfiguration<> 注册实体配置，而非直接内联映射。');
        if (/modelBuilder\.Entity</.test(content) && !/xmin|timestamptz/i.test(content)) msgs.push('EF 规范：Fluent API 链式调用应拆分到独立 Configuration 文件（xmin 并发令牌全局注册、timestamptz 全局约定等框架级循环除外）。');
      }
      const modelFile = /(^|\/)models\//.test(p.toLowerCase()) || /model\.cs$/i.test(p);
      if (modelFile && /\[\s*(Table|Column|Key|MaxLength|Required|StringLength)\s*\(/.test(content) && !/\[\s*DbBulk/.test(content)) {
        msgs.push('EF 规范：应全部使用 Fluent API（Configurations/），禁止数据注解（[DbBulk] 批量操作标注除外）。');
      }
      if (modelFile && /varchar\s*\(/i.test(content)) {
        msgs.push('EF 规范：字符串属性使用 string 类型（列名/长度约定交给 Fluent API），不要指定定长 varchar(n)。');
      }
      const generated = /Designer\.cs$|ModelSnapshot\.cs$/.test(p);
      if (!generated) {
        const types = content.match(/^\s*(public|internal)\s+(sealed\s+|abstract\s+|static\s+|partial\s+)*(class|enum|interface|record)\s+/gm) || [];
        if (types.length > 1) msgs.push('后端规范：单个 .cs 文件只应定义一个顶级类型，请拆分到独立文件。');
      }
    }

    if (isFe) {
      const functional = ['src/pages/', 'src/views/', 'src/api/', 'src/stores/', 'src/mock/', 'src/router/', 'src/styles/', 'src/components/', 'src/composables/', 'src/config/'].some(k => p.includes(k));
      if (functional) {
        msgs.push('本次编辑可能涉及前端功能性变更。结束前请确保更新 spec.md（子项目级/页面级）与 changelog 相关文件（Web: public/changelog.md + viewer.html + marked.min.js；小程序: src/static/ 同名三件套）。');
      }
      const m = p.match(/(^|\/)src\/api\/modules\/([^/]+)\.ts$/);
      if (m) {
        const mod = m[2];
        const dir = path.dirname(base);
        const missing = [];
        if (isWrite && (!/class\s+Real\w*Api/.test(content) || !/function\s+create\w*Api/.test(content))) missing.push('RealXxxApi 实现类 + createXxxApi() 工厂函数 + 导出单例（内容级完整性检查仅对 Write 生效——Edit 片段不含全文件定义，不做此检查）');
        for (const [rel, label] of [['../interfaces/' + mod + '.ts', 'src/api/interfaces/' + mod + '.ts'], ['../../mock/api/' + mod + '.ts', 'src/mock/api/' + mod + '.ts'], ['../../mock/data/' + mod + '.ts', 'src/mock/data/' + mod + '.ts']]) {
          try { if (!fs.existsSync(path.resolve(dir, rel))) missing.push(label); } catch { /* 忽略 */ }
        }
        if (missing.length) msgs.push('API 策略工厂架构不完整，缺：' + missing.join('、') + '。');
      }
      const mk = p.match(/(^|\/)src\/mock\/(api|data)\/([^/]+)\.ts$/);
      if (mk) {
        const dir = path.dirname(base);
        try { if (!fs.existsSync(path.resolve(dir, '../../api/modules/' + mk[3] + '.ts'))) msgs.push('新增/修改了 mock 文件，对应的 src/api/modules/' + mk[3] + '.ts 未同步。'); } catch { /* 忽略 */ }
      }
    }

    if (msgs.length) console.log(JSON.stringify({ decision: 'approve', systemMessage: msgs.join('\n') }));
  }
}

try { main(); } catch { /* fail-open */ }
