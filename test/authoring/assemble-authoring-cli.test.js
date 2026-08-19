const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('assemble-authoring CLI writes deck.html and supports --check', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');

  const write = runCli(['--package', configPath]);
  assert.equal(write.status, 0, write.stderr);
  assert.match(write.stdout, /Wrote/);
  assert.equal(fs.existsSync(path.join(root, 'deck.html')), true);

  const check = runCli(['--package', configPath, '--check']);
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /up to date/);

  fs.appendFileSync(path.join(root, 'deck.html'), '\n<!-- dirty -->\n', 'utf8');
  const dirty = runCli(['--package', configPath, '--check']);
  assert.equal(dirty.status, 1);
  assert.match(dirty.stderr, /out of date/);
});

test('unknown argument error points runtime users to the installed-runtime entry', () => {
  const scriptPath = path.resolve(__dirname, '../../scripts/assemble-authoring.js');
  const result = spawnSync(process.execPath, [scriptPath, 'first.json', 'second-positional'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown argument: second-positional/);
  assert.match(result.stderr, /prepare-author-package\.ps1 -Package/);
  assert.match(result.stderr, /assemble-author-package\.cjs <pluginRoot> <deck\.config\.json>/);
});

function runCli(args) {
  return spawnSync(process.execPath, ['scripts/assemble-authoring.js', ...args], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  });
}

function makePackageFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-author-cli-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'styles/base.css'), '.page { width: 100px; height: 100px; }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-cover.html'), '<section class="page" data-page="cover"></section>\n', 'utf8');
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'cli-fixture',
    title: 'CLI Fixture',
    entry: 'deck.html',
    styles: ['styles/base.css'],
    pages: [{ id: 'cover', file: 'pages/00-cover.html' }],
  }, null, 2), 'utf8');
  return root;
}
