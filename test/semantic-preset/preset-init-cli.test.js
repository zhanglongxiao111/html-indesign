const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

test('preset-init copies the standard preset and configures the author package', () => {
  const root = makePackageFixture();
  const configPath = path.join(root, 'deck.config.json');

  const result = runPresetInit(['--package', configPath, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.preset.source, 'project');
  assert.equal(payload.preset.relativePath, 'semantic-preset.json');
  assert.equal(config.semanticPreset, 'semantic-preset.json');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'semantic-preset.json'), 'utf8')).id, 'architecture-report');
});

test('preset-init refuses to overwrite an existing project preset without force', () => {
  const root = makePackageFixture({
    semanticPreset: 'semantic-preset.json',
  });
  const configPath = path.join(root, 'deck.config.json');
  fs.writeFileSync(path.join(root, 'semantic-preset.json'), '{}\n', 'utf8');

  const result = runPresetInit(['--package', configPath, '--json']);

  assert.equal(result.status, 1);
  assert.match(result.stderr + result.stdout, /SEMANTIC_PRESET_EXISTS/);
});

test('preset-init overwrites an existing project preset with force', () => {
  const root = makePackageFixture({
    semanticPreset: 'semantic-preset.json',
  });
  const configPath = path.join(root, 'deck.config.json');
  fs.writeFileSync(path.join(root, 'semantic-preset.json'), '{}\n', 'utf8');

  const result = runPresetInit(['--package', configPath, '--force', '--json']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'semantic-preset.json'), 'utf8')).id, 'architecture-report');
});

function runPresetInit(args) {
  return spawnSync(process.execPath, ['scripts/preset-init.js', ...args], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  });
}

function makePackageFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-preset-init-'));
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'styles/tokens.css'), ':root { --ink: #123456; }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-cover.html'), '<section class="page" data-page="cover"></section>\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'deck.config.json'),
    JSON.stringify({
      schemaVersion: 1,
      id: 'demo-deck',
      title: 'Demo Deck',
      profile: 'architecture-report',
      entry: 'deck.html',
      styles: ['styles/tokens.css'],
      pages: [
        { id: 'cover', file: 'pages/00-cover.html' },
      ],
      ...(options.semanticPreset ? { semanticPreset: options.semanticPreset } : {}),
    }, null, 2),
    'utf8'
  );
  return root;
}
