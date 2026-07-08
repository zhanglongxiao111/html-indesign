const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot, workspaceRoot } = require('./plugin-test-helper');

test('html.authoring_lint validates the architecture report author package', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true,
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(
    response.data.packagePath.endsWith('test\\fixtures\\e2e\\architecture-report\\deck.config.json')
      || response.data.packagePath.endsWith('test/fixtures/e2e/architecture-report/deck.config.json'),
    true
  );
  assert.equal(Number.isInteger(response.data.issueCount), true);
  assert.equal(response.artifacts.length, 0);
});

test('html.authoring_lint reports missing package without pretending success', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/missing.config.json',
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHOR_PACKAGE_CONFIG_MISSING');
});

test('html.compile_instructions writes validated instructions and summary', () => {
  const outDir = path.join('test', 'workspace', 'plugin-compile-smoke');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.compile_instructions',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      targetSize: 'same',
      unitMode: 'presentation',
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(fs.existsSync(response.data.instructionsPath), true);
  assert.equal(fs.existsSync(response.data.summaryPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'json' && item.path.endsWith('instructions.json')), true);

  const instructions = JSON.parse(fs.readFileSync(response.data.instructionsPath, 'utf8'));
  assert.equal(Array.isArray(instructions.pages), true);
  assert.equal(instructions.pages.length > 0, true);
});

test('html.build_indesign returns script.run host actions instead of calling InDesign directly', () => {
  const outDir = path.join('test', 'workspace', 'plugin-build-smoke');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      timeout: 300,
    },
  });

  assert.equal(response.status, 'requires_host_actions');
  assert.equal(response.state.tool_id, 'html.build_indesign');
  assert.equal(fs.existsSync(response.state.instructionsPath), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'build.jsx')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'export.jsx')), true);
  assert.deepEqual(response.actions.map((action) => action.tool_id), ['script.run', 'script.run', 'export.verify']);
  const verifyAction = response.actions.find((action) => action.tool_id === 'export.verify');
  assert.equal(verifyAction.args.path.endsWith('plugin-smoke.pdf'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(verifyAction.args, 'file'), false);
  assert.equal(response.resume.method, 'tools/resume');
});

test('html.build_indesign resume returns generated artifacts after host success', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-resume');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inddPath = path.join(outDir, 'plugin-smoke.indd');
  const pdfPath = path.join(outDir, 'plugin-smoke.pdf');
  const idmlPath = path.join(outDir, 'plugin-smoke.idml');
  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  fs.writeFileSync(inddPath, 'fake');
  fs.writeFileSync(pdfPath, 'fake');
  fs.writeFileSync(idmlPath, 'fake');
  fs.writeFileSync(instructionsPath, '{}');
  fs.writeFileSync(summaryPath, '{}');

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      instructionsPath,
      summaryPath,
    },
    host_results: [
      { id: 'html-build-script', status: 'complete', data: { ok: true } },
      { id: 'html-export-script', status: 'complete', data: { ok: true } },
      { id: 'html-export-verify', status: 'complete', data: { ok: true } },
    ],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(response.artifacts.some((item) => item.kind === 'indd' && item.path === inddPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'pdf' && item.path === pdfPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml' && item.path === idmlPath), true);
});

test('html.reverse_export returns script.run host action for an INDD file', () => {
  const outDir = path.join('test', 'workspace', 'plugin-reverse-smoke');
  const absoluteOutDir = path.join(repoRoot, outDir);
  fs.rmSync(absoluteOutDir, { recursive: true, force: true });
  fs.mkdirSync(absoluteOutDir, { recursive: true });

  const fakeIndd = path.join(absoluteOutDir, 'input.indd');
  fs.writeFileSync(fakeIndd, 'fake');

  const response = callPlugin('tools/call', {
    id: 'html.reverse_export',
    args: {
      indd: fakeIndd,
      outDir,
      mode: 'structured',
      assetPolicy: 'reference',
      timeout: 300,
    },
  });

  assert.equal(response.status, 'requires_host_actions');
  assert.equal(response.state.tool_id, 'html.reverse_export');
  assert.equal(fs.existsSync(response.state.reverseScriptPath), true);
  assert.equal(response.actions.length, 1);
  assert.equal(response.actions[0].tool_id, 'script.run');
});

test('html.reverse_export resume writes author html from reverse snapshot', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-reverse-resume');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  fs.copyFileSync(path.join(repoRoot, 'test', 'fixtures', 'indesign-reverse', 'tagged-snapshot.json'), snapshotPath);

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      snapshotPath,
      mode: 'structured',
      assetPolicy: 'reference',
      sourceRoot: null,
      nasPublicRoot: '/nas',
    },
    host_results: [
      { id: 'html-reverse-snapshot', status: 'complete', data: { ok: true } },
    ],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(fs.existsSync(path.join(outDir, 'author', 'deck.html')), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'html'
    && (item.path.endsWith('author\\deck.html') || item.path.endsWith('author/deck.html'))), true);
});

test('html.reverse_export resume fails visibly when reverse author audit fails', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-reverse-audit-failure');
  const sourceRoot = path.join(outDir, 'source');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><h1>Unmatched source text</h1></section>');

  const snapshotPath = path.join(outDir, 'reverse-snapshot.json');
  fs.copyFileSync(path.join(repoRoot, 'test', 'fixtures', 'indesign-reverse', 'tagged-snapshot.json'), snapshotPath);

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      snapshotPath,
      mode: 'structured',
      assetPolicy: 'reference',
      sourceRoot,
      nasPublicRoot: '/nas',
    },
    host_results: [
      { id: 'html-reverse-snapshot', status: 'complete', data: { ok: true } },
    ],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'REVERSE_AUTHOR_AUDIT_FAILED');
  assert.equal(response.error.details.ok, false);
  assert.equal(response.error.details.contentInventory.ok, false);
});

module.exports = {
  callPlugin,
  repoRoot,
  workspaceRoot,
};

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'plugin-reverse-audit-source',
    entry: 'deck.html',
    pages: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-agenda.html'), pageHtml, 'utf8');
}
