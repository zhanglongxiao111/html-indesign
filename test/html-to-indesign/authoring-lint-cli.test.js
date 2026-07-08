const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { lintAuthoringPackage } = require('../../src/authoring');

const ROOT_DIR = path.join(__dirname, '../..');

test('package exposes npm run lint:authoring', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(pkg.scripts['lint:authoring'], 'node scripts/lint-authoring.js');
});

test('lint-authoring CLI includes expected options', () => {
  const source = fs.readFileSync(path.resolve('scripts/lint-authoring.js'), 'utf8');
  const service = fs.readFileSync(path.resolve('src/authoring/lint.js'), 'utf8');
  assert.match(source, /--html/);
  assert.match(source, /--strict/);
  assert.match(source, /lintAuthoringPackage/);
  assert.match(source, /lintAuthoringHtml/);
  assert.match(service, /validateAuthoringRules/);
});

test('public authoring entry exports lintAuthoringPackage', () => {
  assert.equal(typeof lintAuthoringPackage, 'function');
});

test('lint-authoring --strict fails unregistered data-id carriers through registry validation', () => {
  const htmlPath = writeRegistryLintFixture('strict-unknown.html', 'data-id-made-up="x"');

  const result = runLint(['--html', htmlPath, '--strict', '--json']);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(payload.ok, false);
  assert.ok(payload.dataIdAudit);
  assert.ok(payload.errors.some((entry) => (
    entry.code === 'DATA_ID_FIELD_NOT_REGISTERED'
    && entry.attribute === 'data-id-made-up'
  )));
});

test('lint-authoring reports unregistered data-id carriers as warnings outside strict mode', () => {
  const htmlPath = writeRegistryLintFixture('warning-unknown.html', 'data-id-made-up="x"');

  const result = runLint(['--html', htmlPath, '--json']);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(payload.dataIdAudit);
  assert.ok(payload.warnings.some((entry) => (
    entry.code === 'DATA_ID_FIELD_NOT_REGISTERED'
    && entry.attribute === 'data-id-made-up'
  )));
});

function runLint(args) {
  const tmpDir = path.join(ROOT_DIR, 'test/workspace/tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  return spawnSync(process.execPath, ['scripts/lint-authoring.js', ...args], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMP: tmpDir,
      TEMP: tmpDir,
    },
  });
}

function writeRegistryLintFixture(fileName, extraPageAttrs) {
  const root = path.join(ROOT_DIR, 'test/workspace/authoring-lint-registry');
  fs.mkdirSync(root, { recursive: true });
  const htmlPath = path.join(root, fileName);
  fs.writeFileSync(htmlPath, `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .page {
      width: 400px;
      height: 225px;
      position: relative;
      box-sizing: border-box;
      padding: 10mm;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      grid-template-rows: repeat(8, 1fr);
      gap: 4mm;
    }
    .grid-item {
      grid-column: var(--grid-col) / span var(--grid-span);
      grid-row: var(--grid-row) / span var(--grid-row-span);
    }
    .page-title { margin: 0; line-height: 1; }
  </style>
</head>
<body>
  <main class="deck">
    <section class="page" data-page="cover" data-id-margin="10mm" data-id-grid="12x8" data-id-column-gutter="4mm" data-id-row-gutter="4mm" ${extraPageAttrs}>
      <h1 class="page-title grid-item" data-id-paragraph-style="cover-title" style="--grid-col:1;--grid-span:4;--grid-row:1;--grid-row-span:1">Cover</h1>
    </section>
  </main>
</body>
</html>
`, 'utf8');
  return htmlPath;
}
