const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot, workspaceRoot } = require('./plugin-test-helper');
const { reversePipelineFailureResponse } = require('../../src/indesign-cli-plugin/tools/reverse-export');

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

test('html.authoring_lint lint 失败 invalid-input 必须 fail 而不是包进 complete', () => {
  const root = path.join(repoRoot, 'test', 'workspace', 'plugin-lint-failing-package');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'lint-failing',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), '<section class="page"><p>缺网格缺边距的页面</p></section>', 'utf8');

  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/workspace/plugin-lint-failing-package/deck.config.json',
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  assert.equal(response.error.details.ok, false);
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
  const layerNames = instructions.layers.map((layer) => layer.name);
  assert.equal(layerNames.includes('图片'), true);
  assert.equal(layerNames.includes('遮罩'), true);
  assert.equal(layerNames.includes('文字'), true);
  assert.equal(layerNames.includes('image'), false);
  assert.equal(layerNames.includes('overlay'), false);
  assert.equal(layerNames.includes('text'), false);
});

test('html.build_indesign starts with one build action and defers dependent actions', () => {
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
  assert.equal(fs.existsSync(response.state.expectedModelPath), true);
  assert.equal(fs.existsSync(response.state.semanticPresetPath), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'build.jsx')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'export.jsx')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'fidelity-snapshot.jsx')), true);
  assert.equal(response.state.stage, 'build');
  assert.equal(response.state.mode, 'final');
  assert.deepEqual(response.actions.map((action) => action.id), ['html-build-script']);
  assert.deepEqual(response.actions.map((action) => action.tool_id), ['script.run']);
  assert.equal(response.resume.method, 'tools/resume');
});

test('html.build_indesign runs strict authoring checks internally before creating host scripts', () => {
  const root = path.join(repoRoot, 'test', 'workspace', 'plugin-build-strict-failure');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'build-strict-failure',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), '<section class="page"><p>缺少正式作者契约</p></section>', 'utf8');

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: path.join(root, 'deck.config.json'),
      outDir: path.join(root, 'output'),
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'AUTHORING_LINT_FAILED');
  assert.equal(fs.existsSync(path.join(root, 'output', 'build.jsx')), false);
});

test('html.build_indesign resolves executor libraries from the plugin root outside the caller project', () => {
  const callerRoot = path.join(workspaceRoot, 'external-plugin-caller');
  const outDir = path.join(callerRoot, 'build-output');
  fs.rmSync(callerRoot, { recursive: true, force: true });
  fs.mkdirSync(callerRoot, { recursive: true });

  const response = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report', 'deck.config.json'),
      outDir,
      outputBaseName: 'external-caller',
      exportPdf: false,
      exportIdml: false,
    },
  }, { cwd: callerRoot });

  assert.equal(response.status, 'requires_host_actions');
  const buildJsx = fs.readFileSync(response.state.buildScriptPath, 'utf8');
  const expectedPluginRoot = repoRoot.replace(/\\/g, '/');
  const callerPath = callerRoot.replace(/\\/g, '/');
  assert.match(buildJsx, new RegExp(`var base = ${escapeRegExp(JSON.stringify(expectedPluginRoot))}`));
  assert.doesNotMatch(buildJsx, new RegExp(`var base = ${escapeRegExp(JSON.stringify(callerPath))}`));
});

test('html.build_indesign draft mode exports after build and is always marked unverified', () => {
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

  const afterBuild = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'draft',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      instructionsPath,
      summaryPath,
    },
    host_results: [
      { id: 'html-build-script', status: 'complete', data: { ok: true } },
    ],
  });

  assert.equal(afterBuild.status, 'requires_host_actions');
  assert.equal(afterBuild.state.stage, 'export');
  assert.deepEqual(afterBuild.actions.map((action) => action.id), ['html-export-script']);

  const afterExport = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');
  assert.deepEqual(afterExport.actions.map((action) => action.id), ['html-export-verify']);

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(response.data.verified, false);
  assert.equal(response.data.verificationStatus, 'not-run-draft');
  assert.equal(response.artifacts.some((item) => item.kind === 'indd' && item.path === inddPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'pdf' && item.path === pdfPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml' && item.path === idmlPath), true);
});

test('html.build_indesign final mode requests a current-document snapshot after build', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-final-stage');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
      runDir: outDir,
      outputBaseName: 'plugin-final',
      exportPdf: true,
      exportIdml: true,
      snapshotScriptPath: path.join(outDir, 'fidelity-snapshot.jsx'),
      runMarker: 'plugin-final-marker',
    },
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'requires_host_actions');
  assert.equal(response.state.stage, 'snapshot');
  assert.deepEqual(response.actions.map((action) => action.id), ['html-fidelity-snapshot']);
  assert.equal(response.actions[0].tool_id, 'script.run');
});

test('html.build_indesign returns the concrete failed stage and does not request the next action', () => {
  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'build',
      mode: 'final',
    },
    host_results: [{
      id: 'html-build-script',
      ok: true,
      data: {
        ok: false,
        errors: [{ code: 'FONT_NOT_FOUND', message: 'Missing font: Example' }],
      },
    }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INDESIGN_BUILD_FAILED');
  assert.equal(response.error.retryable, false);
  assert.match(response.error.message, /Missing font/);
});

test('html.build_indesign closes its owned document before returning a fidelity failure', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-fidelity-failure');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const cleanupScriptPath = path.join(outDir, 'cleanup.jsx');
  fs.writeFileSync(cleanupScriptPath, 'cleanup', 'utf8');

  const afterSnapshot = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'snapshot',
      mode: 'final',
      runDir: outDir,
      expectedModelPath: path.join(outDir, 'missing-model.json'),
      semanticPresetPath: path.join(outDir, 'missing-preset.json'),
      instructionsPath: path.join(outDir, 'missing-instructions.json'),
      snapshotPath: path.join(outDir, 'missing-snapshot.json'),
      cleanupScriptPath,
    },
    host_results: [{ id: 'html-fidelity-snapshot', status: 'complete', data: { ok: true } }],
  });

  assert.equal(afterSnapshot.status, 'requires_host_actions');
  assert.equal(afterSnapshot.state.stage, 'cleanup');
  assert.equal(afterSnapshot.state.pendingError.code, 'FIDELITY_INPUT_MISSING');
  assert.deepEqual(afterSnapshot.actions.map((action) => action.id), ['html-build-cleanup']);

  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });
  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'FIDELITY_INPUT_MISSING');
  assert.equal(response.error.retryable, false);
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
  assert.deepEqual(response.state.reconstructionProfile, {
    name: 'safe',
    algorithms: ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block', 'reading-order-lite'],
  });
  assert.equal(fs.existsSync(response.state.reverseScriptPath), true);
  assert.equal(response.actions.length, 1);
  assert.equal(response.actions[0].tool_id, 'script.run');
});

test('html.reverse_export resolves its snapshot script from the plugin root outside the caller project', () => {
  const callerRoot = path.join(workspaceRoot, 'external-reverse-caller');
  const outDir = path.join(callerRoot, 'reverse-output');
  fs.rmSync(callerRoot, { recursive: true, force: true });
  fs.mkdirSync(callerRoot, { recursive: true });
  const fakeIndd = path.join(callerRoot, 'input.indd');
  fs.writeFileSync(fakeIndd, 'fake');

  const response = callPlugin('tools/call', {
    id: 'html.reverse_export',
    args: {
      indd: fakeIndd,
      outDir,
    },
  }, { cwd: callerRoot });

  assert.equal(response.status, 'requires_host_actions');
  const reverseJsx = fs.readFileSync(response.state.reverseScriptPath, 'utf8');
  const expectedScript = path.join(repoRoot, '_indesign_scripts', 'export_to_html_snapshot.jsx').replace(/\\/g, '/');
  const wrongScript = path.join(callerRoot, '_indesign_scripts', 'export_to_html_snapshot.jsx').replace(/\\/g, '/');
  assert.match(reverseJsx, new RegExp(escapeRegExp(JSON.stringify(expectedScript))));
  assert.doesNotMatch(reverseJsx, new RegExp(escapeRegExp(JSON.stringify(wrongScript))));
});

test('html.reverse_export stores the resolved experimental profile for resume', () => {
  const outDir = path.join('test', 'workspace', 'plugin-reverse-experimental-profile');
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
      reconstructionProfile: 'experimental',
      reconstruct: ['reading-order-lite', 'figure-grid', 'figure-grid', 'text-block'],
    },
  });

  assert.deepEqual(response.state.reconstructionProfile, {
    name: 'experimental',
    algorithms: ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block', 'reading-order-lite'],
  });
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
      reconstructionProfile: { name: 'none', algorithms: [] },
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

test('html.reverse_export resume maps a failed trusted-source gate to an error response', () => {
  const response = reversePipelineFailureResponse({
    ok: false,
    report: {
      reconstruction: {
        trustedSourcePreservation: {
          ok: false,
          failures: [{ code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED' }],
        },
      },
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'REVERSE_PIPELINE_FAILED');
  assert.equal(response.error.details.reconstruction.trustedSourcePreservation.ok, false);
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
      reconstructionProfile: { name: 'none', algorithms: [] },
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
