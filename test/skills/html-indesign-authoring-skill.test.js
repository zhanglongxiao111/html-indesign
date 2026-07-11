const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('html-indesign-authoring skill points agents to the authoring package self-check', () => {
  const skillPath = path.resolve('.codex/skills/html-indesign-authoring/SKILL.md');

  assert.equal(fs.existsSync(skillPath), true);
  const body = fs.readFileSync(skillPath, 'utf8');
  assert.match(body, /^---\nname: html-indesign-authoring\n/m);
  assert.match(body, /description: 当 Agent 编写或修改 html-indesign 固定分页 HTML 作者包时使用/);
  assert.match(body, /# HTML InDesign 作者规则/);
  assert.match(body, /## 核心规则/);
  assert.match(body, /## 规则级别/);
  assert.match(body, /硬要求/);
  assert.match(body, /条件硬要求/);
  assert.match(body, /建议/);
  assert.match(body, /React、Vue 和图表库可以用于创作阶段/);
  assert.match(body, /静态作者包/);
  assert.match(body, /`<canvas>`[^\n]*SVG/);
  assert.match(body, /动画[^\n]*固定/);
  assert.match(body, /异步数据[^\n]*固定/);
  assert.match(body, /普通单次转换/);
  assert.match(body, /无损回环声明/);
  assert.match(body, /AUTHOR_EXECUTABLE_SCRIPT_FORBIDDEN/);
  assert.match(body, /AUTHOR_REMOTE_RUNTIME_SCRIPT_FORBIDDEN/);
  assert.match(body, /## 可变网格，不是固定模板/);
  assert.match(body, /`12x8` 只是建筑汇报的常用默认/);
  assert.match(body, /## 语义字段边界/);
  assert.match(body, /字段名是协议，token 值是项目稳定标识/);
  assert.match(body, /## 互转流程/);
  assert.doesNotMatch(body, /## Core Rule|## Required Package Shape|## Conversion Workflow|## Avoid/);
  assert.match(body, /npm run assemble:authoring -- -- --package <deck\.config\.json>/);
  assert.match(body, /npm run lint:authoring -- -- --package <deck\.config\.json> --strict/);
  assert.match(body, /npm run e2e:indesign -- -- --html <deck\.html>/);
  assert.match(body, /--reverse-roundtrip/);
  assert.match(body, /--second-pass-roundtrip/);
  assert.match(body, /npm run reverse:indesign -- -- --snapshot <reverse-snapshot\.json> --out <out-dir> --source-root <author-root>/);
  assert.match(body, /pages\/\*\.html/);
  assert.match(body, /data-id-grid/);
  assert.doesNotMatch(body, /每页都应声明：\n\n```html\ndata-page="stable-page-id"\ndata-id-parent-page="report-parent"\ndata-id-layout="stable-layout-token"\ndata-id-margin="14mm 16mm 10mm 18mm"\ndata-id-grid="12x8"/);
});

test('agent authoring guide distinguishes static handoff requirements from creative recommendations', () => {
  const guide = fs.readFileSync(path.resolve('docs/规范/AGENT_HTML_AUTHORING_GUIDE.md'), 'utf8');

  assert.match(guide, /硬要求、条件硬要求和建议/);
  assert.match(guide, /React、Vue 和图表库/);
  assert.match(guide, /Canvas[^\n]*SVG/);
  assert.match(guide, /动画[^\n]*固定/);
  assert.match(guide, /异步数据[^\n]*固定/);
  assert.match(guide, /普通单次转换/);
  assert.match(guide, /无损回环声明/);
});
