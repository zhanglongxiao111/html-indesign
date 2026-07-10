const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  parseArgs,
  compileReverseSnapshotToHtml: compileReverseSnapshotToHtmlFromCli,
} = require('../../scripts/indesign-reverse-export');
const {
  compileReverseSnapshotToHtml,
} = require('../../src/reverse-pipeline');

test('reverse export CLI reuses the src reverse pipeline entry', () => {
  assert.equal(compileReverseSnapshotToHtmlFromCli, compileReverseSnapshotToHtml);
});

test('parseArgs accepts mode, snapshot and out dir', () => {
  const args = parseArgs(['--mode', 'structured', '--snapshot', 'reverse.json', '--out', 'out-dir']);

  assert.equal(args.mode, 'structured');
  assert.equal(args.snapshotPath, 'reverse.json');
  assert.equal(args.outDir, 'out-dir');
});

test('parseArgs accepts historical blueprint input', () => {
  const args = parseArgs(['--mode', 'inferred', '--blueprint', 'blueprint.json', '--out', 'out-dir']);

  assert.equal(args.mode, 'inferred');
  assert.equal(args.blueprintPath, 'blueprint.json');
  assert.equal(args.outDir, 'out-dir');
});

test('parseArgs accepts source root for self-contained reverse author packages', () => {
  const args = parseArgs(['--snapshot', 'reverse.json', '--out', 'out-dir', '--source-root', 'source-package']);

  assert.equal(args.snapshotPath, 'reverse.json');
  assert.equal(args.outDir, 'out-dir');
  assert.equal(args.sourceRoot, 'source-package');
});

test('parseArgs accepts reverse asset reference options', () => {
  const args = parseArgs([
    '--snapshot', 'reverse.json',
    '--out', 'out-dir',
    '--asset-policy', 'reference',
    '--nas-public-root', '/nas',
  ]);

  assert.equal(args.assetPolicy, 'reference');
  assert.equal(args.nasPublicRoot, '/nas');
});

test('parseArgs accepts reconstruction algorithms', () => {
  const args = parseArgs([
    '--snapshot', 'reverse.json',
    '--out', 'out-dir',
    '--reconstruct', 'page-object-graph,caption-structure,figure-grid,text-block',
  ]);

  assert.deepEqual(args.reconstructAlgorithms, ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block']);
});

test('compileReverseSnapshotToHtml writes deck, model and report', () => {
  const outDir = path.resolve('test/workspace/reverse-cli-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'reverse-model.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'reconstruction-report.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'report.json')), true);
  assert.equal(result.files.reconstructionReport, path.join(outDir, 'reconstruction-report.json'));
  assert.equal(result.report.reconstruction.status, 'observed-only');
  assert.equal(result.report.reconstruction.summary.reconstructedItems, 0);
});

test('compileReverseSnapshotToHtml writes visual HTML and author package', () => {
  const outDir = path.resolve('test/workspace/reverse-cli-author-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.visual.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.structured.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/deck.config.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/pages/01-agenda.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/presentation.html')), true);
  assert.equal(result.files.visualHtml, path.join(outDir, 'deck.visual.html'));
  assert.equal(result.files.author.config, path.join(outDir, 'author/deck.config.json'));
  assert.equal(result.files.author.presentation, path.join(outDir, 'author/presentation.html'));
  assert.equal(result.report.authorAudit.ok, true);
  assert.equal(Array.isArray(result.report.authorAudit.warnings), true);
});

test('compileReverseSnapshotToHtml forwards source root into the author package writer', () => {
  const root = path.resolve('test/workspace/reverse-cli-source-root-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'out');
  fs.rmSync(root, { recursive: true, force: true });
  writeFixtureFile(path.join(sourceRoot, 'styles/tokens.css'), ':root { --id-text: #123456; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/layout.css'), '.page { display:grid; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/components.css'), '.swatch { width: 18px; height: 18px; }');
  writeFixtureFile(path.join(sourceRoot, 'styles/pages.css'), '#agenda-page { color:#123456; }');
  writeAuthorPackage(sourceRoot, '<section class="page"><h2 id="agenda-title">汇报结构</h2></section>');

  compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
    sourceRoot,
  });

  assert.equal(
    fs.readFileSync(path.join(outDir, 'author/styles/components.css'), 'utf8'),
    '.swatch { width: 18px; height: 18px; }',
  );
});

test('compileReverseSnapshotToHtml returns src-level author audit gates when source root is explicit', () => {
  const root = path.resolve('test/workspace/reverse-cli-author-audit-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'out');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><h1>Unmatched source text</h1></section>');

  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'structured',
    sourceRoot,
  });

  assert.equal(result.files.author.audit.sourceRoundtrip.ok, false);
  assert.equal(result.files.author.audit.contentInventory.ok, false);
  assert.equal(result.files.author.audit.structureSignature.ok, false);
  assert.equal(result.files.author.audit.ok, false);
  assert.equal(result.ok, false);
  assert.equal(result.report.ok, false);
  assert.equal(result.report.authorAudit, result.files.author.audit);
  assert.equal(fs.existsSync(path.join(outDir, 'author/reports/content-inventory-report.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'author/reports/structure-signature-report.json')), true);
});

test('standalone reverse export CLI exits nonzero when shared author audit fails', () => {
  const root = path.resolve('test/workspace/reverse-cli-author-audit-exit-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'out');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><h1>Unmatched source text</h1></section>');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/indesign-reverse-export.js'),
    '--snapshot', path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    '--out', outDir,
    '--mode', 'structured',
    '--source-root', sourceRoot,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });
  const report = JSON.parse(result.stdout);

  assert.notEqual(result.status, 0);
  assert.equal(report.ok, false);
  assert.equal(report.files.author.audit.ok, false);
  assert.deepEqual(report.report.authorAudit, report.files.author.audit);
});

test('compileReverseSnapshotToHtml writes historical blueprint through reverse pipeline', () => {
  const outDir = path.resolve('test/workspace/reverse-blueprint-cli-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    blueprintPath: path.resolve('test/artifacts/blueprint.json'),
    outDir,
    mode: 'inferred',
  });

  assert.equal(result.ok, true);
  assert.equal(result.report.inputFormat, 'historical-blueprint');
  assert.equal(result.report.mode, 'inferred');
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.inferred.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'inferred-report.json')), true);

  const html = fs.readFileSync(path.join(outDir, 'deck.inferred.html'), 'utf8');
  assert.match(html, /data-id-reverse-mode="inferred"/);
  assert.match(html, /data-id-source="blueprint-migration"/);
  assert.match(html, /data-id-migration-slot="true"/);

  const candidates = JSON.parse(fs.readFileSync(path.join(outDir, 'author/reports/semantic-candidates.json'), 'utf8'));
  assert.equal(candidates.presetId, null);
});

test('compileReverseSnapshotToHtml can run page object graph reconstruction', () => {
  const outDir = path.resolve('test/workspace/reverse-cli-object-graph-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    snapshotPath: path.resolve('test/fixtures/indesign-reverse/tagged-snapshot.json'),
    outDir,
    mode: 'observation',
    reconstructAlgorithms: ['page-object-graph'],
  });

  assert.deepEqual(result.report.reconstruction.algorithms, ['page-object-graph']);
  assert.equal(result.report.reconstruction.passes[0].name, 'page-object-graph');
  assert.equal(fs.existsSync(path.join(outDir, 'reconstruction-report.json')), true);
});

function writeFixtureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'reverse-cli-author-audit-source',
    entry: 'deck.html',
    styles: ['styles/tokens.css', 'styles/layout.css', 'styles/components.css', 'styles/pages.css'],
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-agenda.html'), pageHtml, 'utf8');
}
