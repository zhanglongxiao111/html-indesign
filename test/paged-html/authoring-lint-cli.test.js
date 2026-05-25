const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('package exposes npm run lint:authoring', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(pkg.scripts['lint:authoring'], 'node scripts/lint-authoring.js');
});

test('lint-authoring CLI includes expected options', () => {
  const source = fs.readFileSync(path.resolve('scripts/lint-authoring.js'), 'utf8');
  assert.match(source, /--html/);
  assert.match(source, /--strict/);
  assert.match(source, /validateAuthoringRules/);
});
