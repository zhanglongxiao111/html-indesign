const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { writeAuthorPackageEntry } = require('../../src/authoring');

test('lint-authoring --package fails before snapshot when generated deck is stale', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);
  fs.appendFileSync(path.join(root, 'deck.html'), '\n<!-- stale -->\n', 'utf8');

  const result = runLint(['--package', configPath]);

  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /AUTHOR_GENERATED_ENTRY_DIRTY|out of date/);
});

test('lint-authoring --package snapshots the generated entry when it is current', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);

  const result = runLint(['--package', configPath, '--strict', '--json']);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(path.resolve(payload.htmlPath), path.join(root, 'deck.html'));
  assert.deepEqual(payload.sourceFormat.errors, []);
  assert.deepEqual(payload.sourceFormat.warnings, []);
});

test('lint-authoring --package --strict rejects full html documents as page fragments', () => {
  const root = makePackageFixture({
    pageHtml: '<!doctype html><html><body><section class="page" data-page="cover"></section></body></html>',
  });
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);

  const result = runLint(['--package', configPath, '--strict', '--json']);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(payload.ok, false);
  assert.ok(payload.errors.some((entry) => entry.code === 'AUTHOR_PAGE_FRAGMENT_FULL_DOCUMENT'));
});

test('lint-authoring --package --strict rejects grid items without explicit grid coordinates', () => {
  const root = makePackageFixture({
    pageHtml: `
      <section class="page" data-page="cover" data-id-margin="10mm" data-id-grid="12x8" data-id-column-gutter="4mm" data-id-row-gutter="4mm" data-id-baseline="4mm">
        <h1 class="page-title grid-item" data-id-paragraph-style="cover-title">Cover</h1>
      </section>
    `,
  });
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);

  const result = runLint(['--package', configPath, '--strict', '--json']);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.ok(payload.errors.some((entry) => entry.code === 'AUTHOR_GRID_ITEM_COORDS_MISSING'));
});

test('lint-authoring --package --strict allows pages without baseline declarations', () => {
  const root = makePackageFixture({
    pageHtml: `
      <section class="page" data-page="cover" data-id-layout="cover" data-id-margin="10mm" data-id-grid="12x8" data-id-column-gutter="4mm" data-id-row-gutter="4mm">
        <h1 class="page-title grid-item" data-id-paragraph-style="cover-title" style="--grid-col:1;--grid-span:4;--grid-row:1;--grid-row-span:2">Cover</h1>
      </section>
    `,
  });
  const configPath = path.join(root, 'deck.config.json');
  writeAuthorPackageEntry(configPath);

  const result = runLint(['--package', configPath, '--strict', '--json']);
  const payload = JSON.parse(result.stdout);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(!payload.errors.some((entry) => entry.attribute === 'data-id-baseline'));
});

function runLint(args) {
  return spawnSync(process.execPath, ['scripts/lint-authoring.js', ...args], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  });
}

function makePackageFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-lint-package-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'styles/tokens.css'), ':root { --brand-blue: #123456; }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'styles/layout.css'), `
    .page {
      width: 400px;
      height: 225px;
      position: relative;
      box-sizing: border-box;
      padding: 10mm;
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-template-rows: repeat(8, minmax(0, 1fr));
      gap: 4mm;
    }
    .grid-item {
      grid-column: var(--grid-col) / span var(--grid-span);
      grid-row: var(--grid-row) / span var(--grid-row-span);
    }
  `, 'utf8');
  fs.writeFileSync(path.join(root, 'styles/components.css'), '.page-title { color: var(--brand-blue); }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'styles/pages.css'), '.deck { background: #f5f7f8; }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-cover.html'), options.pageHtml || `
    <section class="page" data-page="cover" data-id-parent-page="report-parent" data-id-layout="cover" data-id-margin="10mm" data-id-grid="12x8" data-id-column-gutter="4mm" data-id-row-gutter="4mm" data-id-baseline="4mm">
      <h1 class="page-title grid-item" data-id-paragraph-style="cover-title" style="--grid-col:1;--grid-span:4;--grid-row:1;--grid-row-span:2">Cover</h1>
    </section>
  `, 'utf8');
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'lint-fixture',
    title: 'Lint Fixture',
    profile: 'architecture-report',
    entry: 'deck.html',
    styles: [
      'styles/tokens.css',
      'styles/layout.css',
      'styles/components.css',
      'styles/pages.css',
    ],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }, null, 2), 'utf8');
  return root;
}
