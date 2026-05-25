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

  const result = runLint(['--package', configPath, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(path.resolve(payload.htmlPath), path.join(root, 'deck.html'));
});

function runLint(args) {
  return spawnSync(process.execPath, ['scripts/lint-authoring.js', ...args], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  });
}

function makePackageFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-lint-package-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'styles/base.css'), `
    .page {
      width: 400px;
      height: 225px;
      position: relative;
      box-sizing: border-box;
      padding: 10mm;
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 4mm;
    }
    .grid-item { grid-column: var(--grid-col) / span var(--grid-span); }
  `, 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-cover.html'), `
    <section class="page" data-page="cover" data-id-margin="10mm" data-id-grid="12x1" data-id-baseline="4mm">
      <h1 class="page-title grid-item" data-id-object style="--grid-col:1;--grid-span:4">Cover</h1>
    </section>
  `, 'utf8');
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'lint-fixture',
    title: 'Lint Fixture',
    entry: 'deck.html',
    styles: ['styles/base.css'],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }, null, 2), 'utf8');
  return root;
}
