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

test('parseArgs accepts legacy blueprint input', () => {
  const args = parseArgs(['--mode', 'inferred', '--blueprint', 'blueprint.json', '--out', 'out-dir']);

  assert.equal(args.mode, 'inferred');
  assert.equal(args.blueprintPath, 'blueprint.json');
  assert.equal(args.outDir, 'out-dir');
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

test('compileReverseSnapshotToHtml writes legacy blueprint through reverse pipeline', () => {
  const outDir = path.resolve('test/workspace/reverse-blueprint-cli-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  const result = compileReverseSnapshotToHtml({
    blueprintPath: path.resolve('test/artifacts/blueprint.json'),
    outDir,
    mode: 'inferred',
  });

  assert.equal(result.ok, true);
  assert.equal(result.report.inputFormat, 'legacy-blueprint');
  assert.equal(result.report.mode, 'inferred');
  assert.equal(fs.existsSync(path.join(outDir, 'deck.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'deck.inferred.html')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'inferred-report.json')), true);

  const html = fs.readFileSync(path.join(outDir, 'deck.inferred.html'), 'utf8');
  assert.match(html, /data-id-reverse-mode="inferred"/);
  assert.match(html, /data-id-source="legacy-blueprint"/);
  assert.match(html, /data-id-legacy-slot="true"/);
});
