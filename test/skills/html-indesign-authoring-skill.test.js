const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('published authoring skill has a single source of truth in indesign-cli', () => {
  const skillPath = path.resolve('.codex/skills/html-indesign-authoring/SKILL.md');

  assert.equal(fs.existsSync(skillPath), false);
  const agents = fs.readFileSync(path.resolve('AGENTS.md'), 'utf8');
  assert.match(agents, /D:\\AI\\mcp-indesign\\skills\\indesign-cli/);
  assert.match(agents, /唯一发布源/);
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
