const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot, workspaceRoot } = require('./plugin-test-helper');

test('html.authoring_lint validates the architecture report author package', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true,
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(
    response.data.packagePath.endsWith('test\\fixtures\\e2e\\architecture-report\\deck.config.json')
      || response.data.packagePath.endsWith('test/fixtures/e2e/architecture-report/deck.config.json'),
    true
  );
  assert.equal(Number.isInteger(response.data.issueCount), true);
  assert.equal(response.artifacts.length, 0);
});

test('html.authoring_lint reports missing package without pretending success', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/missing.config.json',
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHOR_PACKAGE_CONFIG_MISSING');
});

test('html.compile_instructions writes validated instructions and summary', () => {
  const outDir = path.join('test', 'workspace', 'plugin-compile-smoke');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.compile_instructions',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      targetSize: 'same',
      unitMode: 'presentation',
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(fs.existsSync(response.data.instructionsPath), true);
  assert.equal(fs.existsSync(response.data.summaryPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'json' && item.path.endsWith('instructions.json')), true);

  const instructions = JSON.parse(fs.readFileSync(response.data.instructionsPath, 'utf8'));
  assert.equal(Array.isArray(instructions.pages), true);
  assert.equal(instructions.pages.length > 0, true);
});

module.exports = {
  callPlugin,
  repoRoot,
  workspaceRoot,
};
