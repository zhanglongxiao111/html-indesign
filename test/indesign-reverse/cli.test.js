const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  parseArgs,
  compileReverseSnapshotToHtml,
} = require('../../scripts/indesign-reverse-export');

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
  assert.equal(fs.existsSync(path.join(outDir, 'report.json')), true);
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
});

function writeFixtureFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}
