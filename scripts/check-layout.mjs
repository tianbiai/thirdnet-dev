#!/usr/bin/env node
// 发版断言：本地插件布局符合 Claude Code 约定——钩子必须在 <插件根>/hooks/hooks.json，
// .claude-plugin/ 只放 plugin.json 清单。thirdnet-fullstack ≤2.55.1 曾因钩子放在
// .claude-plugin/hooks/ 而整组静默失效（Claude Code 从不读取该位置），此脚本防止复发。
// 另断言 thirdnet-fullstack 版本号在 plugin.json / marketplace 条目 / 协调技能 frontmatter /
// README.md / 仓库根 CLAUDE.md 五处一致（2.55.3 曾出现 CLAUDE.md 版本引用滞后）。
// 用法：在仓库根运行 node scripts/check-layout.mjs；失败时退出码 1。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const marketplace = JSON.parse(fs.readFileSync(path.join(repoRoot, '.claude-plugin/marketplace.json'), 'utf8'));
const localPlugins = (marketplace.plugins || []).filter(p => typeof p.source === 'string' && p.source.startsWith('./'));

let fail = 0;
for (const p of localPlugins) {
  const dir = path.resolve(repoRoot, p.source);
  const name = p.name;
  const manifestOk = fs.existsSync(path.join(dir, '.claude-plugin/plugin.json')) || fs.existsSync(path.join(dir, 'plugin.json'));
  if (!manifestOk) { console.error(`FAIL ${name}: 找不到 plugin.json 清单（.claude-plugin/plugin.json 或根 plugin.json）`); fail++; }
  const deadHooks = path.join(dir, '.claude-plugin/hooks');
  if (fs.existsSync(deadHooks)) {
    console.error(`FAIL ${name}: 存在 .claude-plugin/hooks/ ——Claude Code 不读取该位置，钩子会静默失效！应移至插件根 hooks/`);
    fail++;
  }
  const hooksFile = path.join(dir, 'hooks/hooks.json');
  if (fs.existsSync(hooksFile)) {
    const text = fs.readFileSync(hooksFile, 'utf8');
    JSON.parse(text); // 顺带断言合法 JSON
    if (text.includes('.claude-plugin/hooks')) {
      console.error(`FAIL ${name}: hooks/hooks.json 内仍引用 .claude-plugin/hooks 路径`);
      fail++;
    }
    console.log(`OK   ${name}: hooks/hooks.json 位于插件根且合法`);
  } else {
    console.log(`OK   ${name}: 无钩子（hooks/hooks.json 不存在，跳过钩子断言）`);
  }
}

// ---- 版本号同步断言（thirdnet-fullstack：plugin.json / marketplace 条目 / 协调技能 frontmatter / README / 仓库根 CLAUDE.md）----
const tf = localPlugins.find(p => p.name === 'thirdnet-fullstack');
if (tf) {
  const dir = path.resolve(repoRoot, tf.source);
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, '.claude-plugin/plugin.json'), 'utf8')).version;
    const mism = [];
    if (tf.version !== v) mism.push(`marketplace 条目 version=${tf.version}`);
    const skillText = fs.readFileSync(path.join(dir, 'skills/thirdnet-fullstack/SKILL.md'), 'utf8');
    const fm = skillText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fmVer = fm && fm[1].match(/version:\s*"([^"]+)"/);
    if (!fmVer || fmVer[1] !== v) mism.push(`协调技能 frontmatter metadata.version=${fmVer ? fmVer[1] : '未找到'}`);
    const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
    if (!readme.includes(v)) mism.push(`README.md 版本行未包含 ${v}`);
    const claudeMd = fs.readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
    if (!claudeMd.includes(`（v${v}）`)) mism.push(`仓库根 CLAUDE.md 版本引用未更新（应含「（v${v}）」）`);
    if (mism.length) {
      console.error(`FAIL 版本同步: plugin.json=${v}，不一致 → ${mism.join('；')}`);
      fail++;
    } else {
      console.log(`OK   版本同步: thirdnet-fullstack ${v}（plugin.json / marketplace 条目 / 协调技能 frontmatter / README / CLAUDE.md）`);
    }
  } catch (e) {
    console.error(`FAIL 版本同步: 读取失败 ${e.message}`);
    fail++;
  }
}
if (fail) { console.error(`\n${fail} 项布局检查未通过`); process.exit(1); }
console.log('插件布局检查全部通过');
