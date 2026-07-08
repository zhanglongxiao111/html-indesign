const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const cli = require('../../scripts/audit-reverse-visual');
const {
  parseArgs,
  resolveInputs,
  captureHtmlGeometry: captureHtmlGeometryFromCli,
} = cli;
const {
  captureHtmlGeometry,
} = require('../../src/adapters/html/reader/visual-geometry-capture');

test('audit-reverse-visual CLI reuses the src HTML geometry capture reader', () => {
  assert.equal(captureHtmlGeometryFromCli, captureHtmlGeometry);
});

test('audit-reverse-visual cli resolves reverse-html directory defaults', () => {
  const root = path.resolve('test/workspace/reverse-html');
  const options = parseArgs(['--reverse-html', root, '--tolerance', '3', '--json']);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.join(root, 'deck.visual.html'));
  assert.equal(inputs.candidateHtml, path.join(root, 'author/deck.html'));
  assert.equal(inputs.reverseHtmlDir, root);
  assert.equal(inputs.tolerance, 3);
  assert.equal(inputs.json, true);
});

test('audit-reverse-visual cli accepts explicit reference and candidate files', () => {
  const options = parseArgs([
    '--reference',
    'visual.html',
    '--candidate',
    'author.html',
    '--out',
    'report.json',
  ]);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.resolve('visual.html'));
  assert.equal(inputs.candidateHtml, path.resolve('author.html'));
  assert.equal(inputs.outFile, path.resolve('report.json'));
});

test('audit-reverse-visual does not accept table height drift via stale authoring-report source aliases', () => {
  const reverseRoot = path.resolve('test/workspace/visual-audit-stale-alias-test');
  fs.rmSync(reverseRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(reverseRoot, 'author/reports'), { recursive: true });
  fs.writeFileSync(
    path.join(reverseRoot, 'deck.visual.html'),
    htmlWithMetricsTable({
      height: 301,
      sourceCsv: '../real/ref.csv',
    }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(reverseRoot, 'author/deck.html'),
    htmlWithMetricsTable({
      height: 284,
      sourceCsv: 'assets/fake.csv',
    }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(reverseRoot, 'author/reports/authoring-report.json'),
    JSON.stringify({
      assets: {
        entries: [{
          originalPath: '../real/ref.csv',
          htmlPath: 'assets/fake.csv',
        }],
      },
    }),
    'utf8',
  );

  const result = spawnSync(process.execPath, [
    'scripts/audit-reverse-visual.js',
    '--reverse-html',
    reverseRoot,
    '--json',
  ], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(report.ok, false);
  assert.equal(report.stats.accepted, 0);
  assert.deepEqual(report.warnings.map((issue) => issue.code), []);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_GEOMETRY_MISMATCH' && issue.id === 'metrics'), true);
});

test('audit-reverse-visual invalid-input 必须 fail', () => {
  const reverseRoot = path.resolve('test/workspace/visual-audit-invalid-input');
  fs.rmSync(reverseRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(reverseRoot, 'author'), { recursive: true });
  fs.writeFileSync(path.join(reverseRoot, 'deck.visual.html'), htmlWithMetricsTable({
    height: 301,
    sourceCsv: '../real/ref.csv',
  }), 'utf8');
  fs.writeFileSync(path.join(reverseRoot, 'author/deck.html'), htmlWithMetricsTable({
    height: 301,
    sourceCsv: '../real/ref.csv',
  }), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-visual.js'),
    '--reverse-html', reverseRoot,
    '--tolerance', 'not-a-number',
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REVERSE_VISUAL_INVALID_INPUT/);
});

test('audit-reverse-visual rejects comparable HTML with no pages', () => {
  const reverseRoot = path.resolve('test/workspace/visual-audit-no-pages');
  fs.rmSync(reverseRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(reverseRoot, 'author'), { recursive: true });
  fs.writeFileSync(path.join(reverseRoot, 'deck.visual.html'), '<main><h1>No page roots</h1></main>', 'utf8');
  fs.writeFileSync(path.join(reverseRoot, 'author/deck.html'), '<main><h1>No page roots</h1></main>', 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-visual.js'),
    '--reverse-html', reverseRoot,
    '--json',
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REVERSE_VISUAL_INVALID_INPUT/);
});

function htmlWithMetricsTable({ height, sourceCsv }) {
  return [
    '<!doctype html>',
    '<section id="page-1" class="page" style="position:relative;width:1000px;height:600px">',
    `<table id="metrics" style="position:absolute;left:300px;top:100px;width:500px;height:${height}px" data-id-table-style="area-table" data-id-source-csv="${sourceCsv}">`,
    '<tbody><tr><td>metric</td></tr></tbody>',
    '</table>',
    '</section>',
  ].join('');
}
