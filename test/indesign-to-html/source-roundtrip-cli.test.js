const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

test('audit-reverse-author-roundtrip cli 文本丢失 invalid-input 必须 fail', () => {
  const root = path.resolve('test/workspace/source-roundtrip-cli');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writePackage(sourceRoot, '<section class="page"><h1>Contents</h1></section>');
  writePackage(reverseRoot, '<section class="page"><h1>CONTENTS</h1></section>');

  const script = path.resolve('scripts/audit-reverse-author-roundtrip.js');
  const result = spawnSync(process.execPath, [
    script,
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(report.ok, false);
  assert.deepEqual(report.errors.map((issue) => issue.code), ['ROUNDTRIP_TEXT_CHANGED']);
  assert.deepEqual(report.warnings, []);
});

test('audit-reverse-author-roundtrip cli rejects the retired --strict flag', () => {
  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-author-roundtrip.js'),
    '--source', 'x',
    '--reverse', 'y',
    '--strict',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown argument: --strict/);
});

test('audit-reverse-author-roundtrip cli can fail on exact source drift', () => {
  const root = path.resolve('test/workspace/source-roundtrip-cli-drift');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writePackage(sourceRoot, '<section class="page"><h1>Contents</h1></section>');
  writePackage(reverseRoot, '<section class="page">\n  <h1>Contents</h1>\n</section>\n');

  const script = path.resolve('scripts/audit-reverse-author-roundtrip.js');
  const result = spawnSync(process.execPath, [
    script,
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--drift',
    '--fail-on-drift',
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(report.ok, true);
  assert.equal(report.sourceDrift.ok, true);
  assert.equal(report.sourceDrift.stats.filesChanged, 1);
});

test('audit-reverse-author-roundtrip invalid-input 必须 fail', () => {
  const root = path.resolve('test/workspace/source-roundtrip-invalid-input');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(sourceRoot, { recursive: true });
  writePackage(reverseRoot, '<section class="page"><h1>Contents</h1></section>');
  fs.writeFileSync(path.join(sourceRoot, 'deck.config.json'), '{ "pages": [', 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-author-roundtrip.js'),
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ROUNDTRIP_INVALID_INPUT/);
});

test('audit-reverse-author-roundtrip rejects parseable source package without pages', () => {
  const root = path.resolve('test/workspace/source-roundtrip-no-pages');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(sourceRoot, { recursive: true });
  writePackage(reverseRoot, '<section class="page"><h1>Contents</h1></section>');
  fs.writeFileSync(path.join(sourceRoot, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'roundtrip-fixture',
    entry: 'deck.html',
  }, null, 2), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-author-roundtrip.js'),
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ROUNDTRIP_INVALID_INPUT/);
});

function writePackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'roundtrip-fixture',
    entry: 'deck.html',
    pages: [{ id: 'page-1', file: 'pages/00-page-1.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-page-1.html'), pageHtml, 'utf8');
}
