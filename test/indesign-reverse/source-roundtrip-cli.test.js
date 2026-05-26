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
