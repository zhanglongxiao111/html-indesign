const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

test('audit-reverse-author-roundtrip cli prints JSON report and honors strict mode', () => {
  const root = path.resolve('test/workspace/source-roundtrip-cli');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writePackage(sourceRoot, '<section class="page"><h1>Contents</h1></section>');
  writePackage(reverseRoot, '<section class="page"><h1>CONTENTS</h1></section>');

  const script = path.resolve('scripts/audit-reverse-author-roundtrip.js');
  const normal = spawnSync(process.execPath, [
    script,
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });
  const normalReport = JSON.parse(normal.stdout);

  assert.equal(normal.status, 0);
  assert.equal(normalReport.ok, true);
  assert.deepEqual(normalReport.warnings.map((issue) => issue.code), ['ROUNDTRIP_TEXT_CHANGED']);

  const strict = spawnSync(process.execPath, [
    script,
    '--source', sourceRoot,
    '--reverse', reverseRoot,
    '--strict',
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });
  const strictReport = JSON.parse(strict.stdout);

  assert.equal(strict.status, 1);
  assert.equal(strictReport.ok, false);
  assert.deepEqual(strictReport.errors.map((issue) => issue.code), ['ROUNDTRIP_TEXT_CHANGED']);
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
