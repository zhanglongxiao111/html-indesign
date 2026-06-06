const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('npm package metadata publishes html-indesign as the Sa scoped plugin package', () => {
  const pkg = readJson('package.json');
  const manifest = readJson('src/indesign-cli-plugin/manifest.json');

  assert.equal(pkg.name, '@sa/html-indesign');
  assert.equal(pkg.version, manifest.version);
  assert.equal(pkg.description, 'Sa fixed semantic HTML and InDesign bidirectional translation plugin');
  assert.equal(pkg.main, 'index.js');
  assert.equal(pkg.type, 'commonjs');
  assert.equal(pkg.author, 'Sa');
  assert.equal(pkg.license, 'ISC');
  assert.equal(pkg.engines.node, '>=20.18.1');
  assert.equal(manifest.requires.node, '>=20.18.1');
});

test('npm package ships only runtime plugin files and keeps workspace artifacts out', () => {
  const pkg = readJson('package.json');
  assert.deepEqual(pkg.files, [
    'index.js',
    'src/',
    'scripts/',
    '_indesign_scripts/build_from_instructions.jsx',
    '_indesign_scripts/export_to_html_snapshot.jsx',
    '_indesign_scripts/extract_blueprint.jsx',
    '_indesign_scripts/lib/',
    'presets/',
    'docs/规范/HTML_INDESIGN_LIBRARY_SPEC.md',
    'docs/规范/SEMANTIC_PROTOCOL.md',
    'docs/规范/LABEL_PROTOCOL.md',
    'docs/规范/REVERSE_EXPORT.md',
    'docs/规范/FONT_POLICY.md',
  ]);
  assert.equal(pkg.files.includes('test/'), false);
  assert.equal(pkg.files.includes('test/workspace/'), false);
  for (const command of Object.values(pkg.scripts)) {
    const match = /^node scripts\/([^ ]+\.js)/.exec(command);
    if (match) {
      assert.equal(pkg.files.includes('scripts/'), true, command);
    }
  }
});

test('npm package exposes plugin validation helpers and runtime browser dependencies', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.scripts['plugin:validate'], 'indesign-cli plugin validate .');
  assert.equal(pkg.scripts['plugin:install'], 'indesign-cli plugin install .');
  assert.equal(pkg.scripts['pack:dry-run'], 'npm pack --dry-run --json');
  assert.equal(pkg.dependencies.playwright, '^1.56.0');
  assert.equal(Object.prototype.hasOwnProperty.call(pkg.devDependencies || {}, 'playwright'), false);
});

test('npm package has a root README with Sa install commands', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.match(readme, /@sa\/html-indesign/);
  assert.match(readme, /indesign-cli plugin validate/);
  assert.match(readme, /indesign-cli plugin install/);
});
