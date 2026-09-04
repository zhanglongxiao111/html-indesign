const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { callPlugin, repoRoot, workspaceRoot } = require('./plugin-test-helper');
const { reversePipelineFailureResponse, underlyingHostFailure } = require('../../src/indesign-cli-plugin/tools/reverse-export');
const { compileAuthoringPackage } = require('../../src/indesign-cli-plugin/tools/compile-instructions');

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
  assert.ok(response.data.compatibility);
  assert.equal(typeof response.data.compatibility.summary.normalized, 'number');
  assert.equal(response.artifacts.length, 0);
});

test('html.authoring_lint reports lint_ms and issue counts in metrics on success', () => {
  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      strict: true,
    },
  });

  assert.equal(response.status, 'complete');
  assert.equal(typeof response.metrics.lint_ms, 'number');
  assert.equal(Number.isFinite(response.metrics.lint_ms), true);
  assert.equal(response.metrics.error_count, 0);
  assert.equal(typeof response.metrics.warning_count, 'number');
  assert.equal(response.metrics.artifacts, 0);
});

test('html.authoring_lint reports failed stage and partial metrics on lint failure', () => {
  const root = path.join(repoRoot, 'test', 'workspace', 'plugin-lint-metrics-failing-package');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'lint-metrics-failing',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), '<section class="page"><p>缺网格缺边距的页面</p></section>', 'utf8');

  const response = callPlugin('tools/call', {
    id: 'html.authoring_lint',
    args: {
      package: 'test/workspace/plugin-lint-metrics-failing-package/deck.config.json',
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.stage, 'lint');
  assert.equal(response.error.details.stage, 'lint');
  assert.equal(typeof response.error.details.metrics.lint_ms, 'number');
  assert.equal(response.error.details.metrics.error_count > 0, true);
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
  const summary = JSON.parse(fs.readFileSync(response.data.summaryPath, 'utf8'));
  assert.deepEqual(response.data.compatibility, summary.compatibility);
  assert.equal(typeof response.metrics.compatibility_normalized, 'number');
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

test('html.compile_instructions blocks before writing lossy instructions when compatibility has errors', async () => {
  const outDir = path.join('test', 'workspace', 'plugin-compile-compatibility-blocked');
  fs.rmSync(path.join(repoRoot, outDir), { recursive: true, force: true });

  await assert.rejects(
    () => compileAuthoringPackage({
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
    }, { cwd: repoRoot }, 'html-plugin-compile', {
      snapshot: { pages: [] },
      compatibility: {
        summary: { normalized: 0, warnings: 0, blocked: 1 },
        messages: [{
          level: 'error',
          code: 'HTML_INLINE_SVG_UNSUPPORTED',
          action: 'blocked',
          pageId: 'page-1',
          itemId: 'marker',
          message: 'Unsupported inline SVG content.',
          suggestedFix: 'Use supported primitives.',
          ruleRef: 'vectors/inline-svg',
        }],
      },
    }),
    (error) => {
      assert.equal(error.code, 'HTML_COMPATIBILITY_BLOCKED');
      assert.equal(error.details.stage, 'compile');
      assert.equal(error.details.compatibility.summary.blocked, 1);
      assert.match(error.message, /HTML_INLINE_SVG_UNSUPPORTED/);
      return true;
    },
  );
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'instructions.json')), false);
});

test('html.compile_instructions reports compile_ms, snapshot_ms and task-size metrics', () => {
  const outDir = path.join('test', 'workspace', 'plugin-compile-metrics-smoke');
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
  const { metrics } = response;
  assert.equal(typeof metrics.compile_ms, 'number');
  assert.equal(Number.isFinite(metrics.compile_ms), true);
  assert.equal(typeof metrics.snapshot_ms, 'number');
  assert.equal(Number.isFinite(metrics.snapshot_ms), true);
  assert.equal(typeof metrics.pages, 'number');
  assert.equal(metrics.pages > 0, true);
  assert.equal(typeof metrics.objects, 'number');
  assert.equal(metrics.objects > 0, true);
  assert.equal(typeof metrics.vector_paths, 'number');
  assert.equal(typeof metrics.assets, 'number');
  assert.equal(metrics.error_count, 0);
  assert.equal(metrics.artifacts, 2);
});

test('html.compile_instructions attaches structured validation errors to err.details when instructions fail validation', async () => {
  const scenarioRoot = path.join(repoRoot, 'test', 'workspace', 'plugin-compile-validation-failure');
  fs.rmSync(scenarioRoot, { recursive: true, force: true });
  const packageRoot = path.join(scenarioRoot, 'architecture-report');
  // 有意只复制包本身、不复制同级 smoke-assets 目录，使资产解析必然失败，
  // 从而可靠触发 INSTRUCTIONS_VALIDATION_FAILED（ASSET_FILE_NOT_FOUND）。
  fs.cpSync(path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report'), packageRoot, { recursive: true });

  const outDir = path.join('test', 'workspace', 'plugin-compile-validation-failure', 'out');

  await assert.rejects(
    () => compileAuthoringPackage({
      package: 'test/workspace/plugin-compile-validation-failure/architecture-report/deck.config.json',
      outDir,
    }, { cwd: repoRoot }, 'html-plugin-compile'),
    (error) => {
      assert.equal(error.code, 'INSTRUCTIONS_VALIDATION_FAILED');
      assert.ok(error.details);
      assert.ok(error.details.validation, 'err.details.validation must be populated; dispatcher.errorDetails() only reads err.details');
      assert.equal(error.details.validation.valid, false);
      assert.equal(Array.isArray(error.details.validation.errors), true);
      assert.ok(error.details.validation.errors.length > 0);
      assert.equal(error.details.validation.errors.every((item) => item.code === 'ASSET_FILE_NOT_FOUND'), true);
      assert.ok(error.details.validation.errors[0].assetId);
      return true;
    },
  );
  assert.equal(fs.existsSync(path.join(repoRoot, outDir, 'instructions.json')), false);
});

test('html.compile_instructions plugin response surfaces validation.errors with structured locations on failure', () => {
  const scenarioRoot = path.join(repoRoot, 'test', 'workspace', 'plugin-compile-validation-failure-response');
  fs.rmSync(scenarioRoot, { recursive: true, force: true });
  const packageRoot = path.join(scenarioRoot, 'architecture-report');
  fs.cpSync(path.join(repoRoot, 'test', 'fixtures', 'e2e', 'architecture-report'), packageRoot, { recursive: true });

  const response = callPlugin('tools/call', {
    id: 'html.compile_instructions',
    args: {
      package: 'test/workspace/plugin-compile-validation-failure-response/architecture-report/deck.config.json',
      outDir: 'test/workspace/plugin-compile-validation-failure-response/out',
    },
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'INSTRUCTIONS_VALIDATION_FAILED');
  assert.ok(response.error.details.validation);
  assert.equal(response.error.details.validation.valid, false);
  assert.equal(
    response.error.details.validation.errors.some((item) => item.code === 'ASSET_FILE_NOT_FOUND' && item.assetId),
    true,
  );
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
  assert.ok(response.state.compatibility);
  assert.equal(typeof response.state.compatibility.summary.normalized, 'number');
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
  assert.equal(response.error.details.ok, false);
  assert.equal(response.error.details.errorCount > 0, true);
  assert.equal(Array.isArray(response.error.details.errors), true);
  // 这个夹具触发的是页面契约缺失。原先断言的是"推荐样式文件缺失"，而 strict 已经不再
  // 因此拦截（见 src/authoring/source-package.js），断言留着只是在测一条被撤掉的规则。
  assert.match(response.error.message, /AUTHOR_PAGE_CONTRACT_MISSING/);
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
  assert.ok(response.data.compatibility);
  assert.equal(response.data.verified, false);
  assert.equal(response.data.verificationStatus, 'not-run-draft');
  assert.equal(response.artifacts.some((item) => item.kind === 'indd' && item.path === inddPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'pdf' && item.path === pdfPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml' && item.path === idmlPath), true);
});

test('宿主脚本的 warnings 透传到成功结果（data 直挂 / data.parsed / 字段级回落 / 导出阶段 / details）', () => {
  const driveDraftBuild = draftBuildDriver('plugin-build-host-warnings');

  const previousOutputClosed = {
    code: 'PREVIOUS_OUTPUT_CLOSED',
    message: 'Closed the unmodified previous build output that was still open: D:/run/deck.indd',
  };

  const flat = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: { ok: true, warnings: [previousOutputClosed] },
  });
  const flatCodes = flat.data.warnings.map((item) => item.code);
  assert.equal(flatCodes.includes('PREVIOUS_OUTPUT_CLOSED'), true);
  assert.equal(flatCodes.includes('DRAFT_NOT_VERIFIED'), true);
  assert.match(
    flat.data.warnings.find((item) => item.code === 'PREVIOUS_OUTPUT_CLOSED').message,
    /previous build output/
  );

  // 真实 CLI（mcp-indesign 的 _parse_tool_response）把脚本载荷放在 data.parsed。
  const nested = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: { ok: true, parsed: { ok: true, warnings: [previousOutputClosed] } },
  });
  const nestedCodes = nested.data.warnings.map((item) => item.code);
  assert.equal(nestedCodes.includes('PREVIOUS_OUTPUT_CLOSED'), true);
  assert.equal(nestedCodes.includes('DRAFT_NOT_VERIFIED'), true);

  // 没有 warnings 时不得凭空造出条目。
  const clean = driveDraftBuild({ id: 'html-build-script', status: 'complete', data: { ok: true } });
  assert.deepEqual(clean.data.warnings.map((item) => item.code), ['DRAFT_NOT_VERIFIED']);

  // parsed 存在但里面没有 warnings 时，回落是按字段的：仍要读 data.warnings，不能因为
  // parsed 在就整个换过去，否则真实 CLI 那一侧的 warning 会被 parsed 挡掉。
  const fieldFallback = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: { parsed: { ok: true }, warnings: [{ code: 'PREVIOUS_OUTPUT_CLOSED', message: 'y' }] },
  });
  assert.equal(
    fieldFallback.data.warnings.some((item) => item.code === 'PREVIOUS_OUTPUT_CLOSED'),
    true,
    'parsed 没带 warnings 时必须回落到 data.warnings'
  );

  // 导出脚本自己的 warning（IDML_EXPORT_FAILED 只是警告，不是失败）也必须到达调用方，且只出现一次。
  const exportWarned = driveDraftBuild(
    { id: 'html-build-script', status: 'complete', data: { ok: true } },
    {
      id: 'html-export-script',
      status: 'complete',
      data: { ok: true, warnings: [{ code: 'IDML_EXPORT_FAILED', message: 'x' }] },
    }
  );
  assert.deepEqual(
    exportWarned.data.warnings.filter((item) => item.code === 'IDML_EXPORT_FAILED').length,
    1
  );

  // details 按形状过滤：标量原样透传（不在任何白名单里的 requestedFont/appliedFont 也要活着），
  // 对象/数组这类无界结构丢掉。
  const withDetails = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: {
      ok: true,
      warnings: [{
        code: 'FONT_FALLBACK_APPLIED',
        message: 'z',
        details: {
          requestedFont: 'A',
          appliedFont: 'B',
          bounds: { x: 1 },
          textLength: 12,
          nested: [1],
        },
      }],
    },
  });
  const fallbackEntry = withDetails.data.warnings.find((item) => item.code === 'FONT_FALLBACK_APPLIED');
  assert.ok(fallbackEntry, 'FONT_FALLBACK_APPLIED 必须透传');
  assert.deepEqual(fallbackEntry.details, { requestedFont: 'A', appliedFont: 'B', textLength: 12 });
});

test('host warnings 上限按累计后的 state.hostWarnings 算：跨阶段/单阶段溢出都截到 100 条 + 一条计数标记', () => {
  const driveDraftBuild = draftBuildDriver('plugin-build-host-warnings-cap');

  function makeWarnings(count, prefix) {
    const list = [];
    for (let i = 0; i < count; i += 1) list.push({ code: 'W', message: `${prefix}-${i}` });
    return list;
  }

  // 构建阶段 60 条 + 导出阶段 60 条：单阶段收割都不过 100，只有累计后才会溢出。
  const twoStage = driveDraftBuild(
    { id: 'html-build-script', status: 'complete', data: { ok: true, warnings: makeWarnings(60, 'build') } },
    { id: 'html-export-script', status: 'complete', data: { ok: true, warnings: makeWarnings(60, 'export') } },
  );
  const twoStageWarnings = twoStage.data.warnings;
  assert.equal(twoStageWarnings.filter((item) => item.code === 'W').length, 100);
  const twoStageTruncated = twoStageWarnings.filter((item) => item.code === 'HOST_WARNINGS_TRUNCATED');
  assert.equal(twoStageTruncated.length, 1);
  assert.equal(twoStageTruncated[0].details.omitted, 20);
  // 顺序：100 条真实 warning，然后截断标记，最后才是 DRAFT_NOT_VERIFIED。
  assert.equal(twoStageWarnings[100].code, 'HOST_WARNINGS_TRUNCATED');
  assert.equal(twoStageWarnings[101].code, 'DRAFT_NOT_VERIFIED');
  assert.equal(twoStageWarnings.length, 102);

  // 单阶段自己就报 120 条：同样截到 100 + 一条 omitted=20 的标记（不是四个阶段各按 100 算）。
  const singleStage = driveDraftBuild(
    { id: 'html-build-script', status: 'complete', data: { ok: true, warnings: makeWarnings(120, 'solo') } },
    { id: 'html-export-script', status: 'complete', data: { ok: true } },
  );
  const singleStageWarnings = singleStage.data.warnings;
  assert.equal(singleStageWarnings.filter((item) => item.code === 'W').length, 100);
  const singleStageTruncated = singleStageWarnings.filter((item) => item.code === 'HOST_WARNINGS_TRUNCATED');
  assert.equal(singleStageTruncated.length, 1);
  assert.equal(singleStageTruncated[0].details.omitted, 20);
});

test('host warning details 的标量键数上限：单条 warning 30 个键截到 24 个', () => {
  const driveDraftBuild = draftBuildDriver('plugin-build-host-warnings-detail-keys');

  const manyKeys = {};
  for (let i = 0; i < 30; i += 1) manyKeys[`k${i}`] = i;

  const complete = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: { ok: true, warnings: [{ code: 'MANY_SCALAR_KEYS', message: 'x', details: manyKeys }] },
  });
  const entry = complete.data.warnings.find((item) => item.code === 'MANY_SCALAR_KEYS');
  assert.ok(entry, 'MANY_SCALAR_KEYS 必须透传');
  const keys = Object.keys(entry.details);
  assert.equal(keys.length, 24);
  assert.deepEqual(keys, Array.from({ length: 24 }, (_, i) => `k${i}`));
});

// 上限数的是"留下来的标量键"，不是"看过的键"：前面五个对象键若也占名额，真正有用的
// 定位字段就只剩 19 个位置，而被丢掉的那五个键本来一个字节都不占。
test('host warning details 的键数上限只数留下的标量键：5 个对象键在前也仍留 24 个标量键', () => {
  const driveDraftBuild = draftBuildDriver('plugin-build-host-warnings-detail-key-order');

  const mixedKeys = {};
  for (let i = 0; i < 5; i += 1) mixedKeys[`obj${i}`] = { nested: i };
  for (let i = 0; i < 30; i += 1) mixedKeys[`k${i}`] = i;

  const complete = driveDraftBuild({
    id: 'html-build-script',
    status: 'complete',
    data: { ok: true, warnings: [{ code: 'MIXED_DETAIL_KEYS', message: 'x', details: mixedKeys }] },
  });
  const entry = complete.data.warnings.find((item) => item.code === 'MIXED_DETAIL_KEYS');
  assert.ok(entry, 'MIXED_DETAIL_KEYS 必须透传');
  const keys = Object.keys(entry.details);
  assert.equal(keys.length, 24);
  assert.deepEqual(keys, Array.from({ length: 24 }, (_, i) => `k${i}`));
});

test('BUILD_ARTIFACTS_MISSING 时把 state.hostWarnings 一并带出（IDML_EXPORT_FAILED 是缺 IDML 的直接原因）', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-artifacts-missing-warnings');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  // INDD、PDF 正常落盘；IDML 故意不写，用来触发 BUILD_ARTIFACTS_MISSING。
  fs.writeFileSync(path.join(outDir, 'plugin-smoke.indd'), 'fake');
  fs.writeFileSync(path.join(outDir, 'plugin-smoke.pdf'), 'fake');
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
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterBuild.status, 'requires_host_actions');
  assert.equal(afterBuild.state.stage, 'export');

  const afterExport = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{
      id: 'html-export-script',
      status: 'complete',
      data: { ok: true, warnings: [{ code: 'IDML_EXPORT_FAILED', message: 'x' }] },
    }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'BUILD_ARTIFACTS_MISSING');
  assert.ok(response.error.details.hostWarnings, 'BUILD_ARTIFACTS_MISSING 的 details 必须带上 hostWarnings');
  assert.equal(
    response.error.details.hostWarnings.some((item) => item.code === 'IDML_EXPORT_FAILED'),
    true
  );
});

test('宿主动作失败（hostFailureResponse）时把之前阶段的 hostWarnings 与本阶段失败结果自带的 warning 一并带出', () => {
  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'final',
      hostWarnings: [{ code: 'PREVIOUS_OUTPUT_CLOSED', message: 'z' }],
    },
    host_results: [{
      id: 'html-export-script',
      status: 'complete',
      data: {
        ok: false,
        errors: [{ code: 'INDD_SAVE_FAILED', message: 'save failed' }],
        warnings: [{ code: 'PDF_PAGE_APPLY_FAILED', message: 'y' }],
      },
    }],
  });

  assert.equal(response.status, 'error');
  assert.ok(response.error.details.hostWarnings, 'hostFailureResponse 的 details 必须带上 hostWarnings');
  const codes = response.error.details.hostWarnings.map((item) => item.code);
  assert.equal(codes.includes('PREVIOUS_OUTPUT_CLOSED'), true);
  assert.equal(codes.includes('PDF_PAGE_APPLY_FAILED'), true);
});

// 上一条用的是插件契约里的 data 直挂形状。真实 CLI 失败时给的是
// { ok:false, error:{ code:'INDESIGN_SCRIPT_FAILED', message:<整段 JSON 文本> } }：没有 data，
// warnings 只存在于那段被序列化的载荷里。只按 data 收割等于在生产路径上一条都收不到。
test('宿主失败结果被 CLI 序列化成 JSON 文本时，warning 也要从解包后的载荷里收上来', () => {
  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'final',
    },
    host_results: [{
      id: 'html-export-script',
      ok: false,
      error: {
        code: 'INDESIGN_SCRIPT_FAILED',
        message: JSON.stringify({
          ok: false,
          errors: [{ code: 'INDD_SAVE_FAILED', message: 'busy' }],
          warnings: [{ code: 'PDF_PAGE_APPLY_FAILED', message: 'y' }],
        }),
      },
    }],
  });

  assert.equal(response.status, 'error');
  // 下层 code 仍从序列化载荷里解回来（既有行为，一并锁住）。
  assert.equal(response.error.details.causeCode, 'INDD_SAVE_FAILED');
  assert.ok(response.error.details.hostWarnings, '序列化载荷里的 warning 必须进 details.hostWarnings');
  const codes = response.error.details.hostWarnings.map((item) => item.code);
  assert.equal(codes.includes('PDF_PAGE_APPLY_FAILED'), true);
  // 同一条 warning 只能出现一次：failed 与解包后的载荷都被收割，不许重复计数。
  assert.equal(codes.filter((code) => code === 'PDF_PAGE_APPLY_FAILED').length, 1);
});

test('三个产物都与开工前快照一致时报 BUILD_ARTIFACTS_MISSING，并把 stale 路径列出来', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-stale-artifacts');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inddPath = path.join(outDir, 'plugin-smoke.indd');
  const pdfPath = path.join(outDir, 'plugin-smoke.pdf');
  const idmlPath = path.join(outDir, 'plugin-smoke.idml');
  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  // 上一轮遗留的三个产物：先落盘再拍快照，本轮宿主脚本什么都没写出来。
  fs.writeFileSync(inddPath, 'fake');
  fs.writeFileSync(pdfPath, 'fake');
  fs.writeFileSync(idmlPath, 'fake');
  fs.writeFileSync(instructionsPath, '{}');
  fs.writeFileSync(summaryPath, '{}');

  const snapshotOf = (file) => {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  };

  const afterExport = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'draft',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      instructionsPath,
      summaryPath,
      preRunDeliverables: {
        indd: snapshotOf(inddPath),
        pdf: snapshotOf(pdfPath),
        idml: snapshotOf(idmlPath),
      },
    },
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'BUILD_ARTIFACTS_MISSING');
  assert.deepEqual(response.error.details.missing, [inddPath, pdfPath, idmlPath]);
  assert.deepEqual(response.error.details.stale, [inddPath, pdfPath, idmlPath]);
  assert.match(response.error.message, /stale from a previous build/);
  assert.equal(response.artifacts, undefined);
});

test('本轮真的覆盖了三个产物时照常完成：快照比对只认变化，不认工位时钟', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-fresh-artifacts');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inddPath = path.join(outDir, 'plugin-smoke.indd');
  const pdfPath = path.join(outDir, 'plugin-smoke.pdf');
  const idmlPath = path.join(outDir, 'plugin-smoke.idml');
  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  // 上一轮遗留的三个产物：先落盘再拍快照，state 里带的就是这份“开工前”的样子。
  for (const file of [inddPath, pdfPath, idmlPath]) fs.writeFileSync(file, 'stale');
  fs.writeFileSync(instructionsPath, '{}');
  fs.writeFileSync(summaryPath, '{}');

  const snapshotOf = (file) => {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  };
  const preRunDeliverables = {
    indd: snapshotOf(inddPath),
    pdf: snapshotOf(pdfPath),
    idml: snapshotOf(idmlPath),
  };

  // 本轮宿主脚本把三个产物都重写了：内容与大小都变了，mtime 还往前跳了一小时
  // （NAS 与工位的钟差常有这个量级，判定不能因此翻脸）。
  const bumped = new Date(Date.now() + 60 * 60 * 1000);
  for (const file of [inddPath, pdfPath, idmlPath]) {
    fs.writeFileSync(file, 'freshly-written-by-this-run');
    fs.utimesSync(file, bumped, bumped);
  }

  const afterExport = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'draft',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: true,
      instructionsPath,
      summaryPath,
      preRunDeliverables,
    },
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  assert.equal(response.data.inddPath, inddPath);
  assert.equal(response.data.pdfPath, pdfPath);
  assert.equal(response.data.idmlPath, idmlPath);
  assert.equal(response.artifacts.some((item) => item.kind === 'indd' && item.path === inddPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'pdf' && item.path === pdfPath), true);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml' && item.path === idmlPath), true);
});

test('exportIdml 关闭时不去追究上一轮遗留的旧 IDML，idmlPath 报 null 而不是报缺产物', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-idml-opt-out');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const inddPath = path.join(outDir, 'plugin-smoke.indd');
  const pdfPath = path.join(outDir, 'plugin-smoke.pdf');
  const idmlPath = path.join(outDir, 'plugin-smoke.idml');
  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  for (const file of [inddPath, pdfPath, idmlPath]) fs.writeFileSync(file, 'stale');
  fs.writeFileSync(instructionsPath, '{}');
  fs.writeFileSync(summaryPath, '{}');

  const snapshotOf = (file) => {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  };
  const preRunDeliverables = {
    indd: snapshotOf(inddPath),
    pdf: snapshotOf(pdfPath),
    idml: snapshotOf(idmlPath),
  };

  // 本轮只写 INDD 与 PDF；那个 .idml 是上一轮遗留的、与开工前快照一字不差的旧文件，
  // 本轮既没要它也没碰它，不该被算成本轮的缺件。
  const bumped = new Date(Date.now() + 60 * 60 * 1000);
  for (const file of [inddPath, pdfPath]) {
    fs.writeFileSync(file, 'freshly-written-by-this-run');
    fs.utimesSync(file, bumped, bumped);
  }

  const afterExport = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.build_indesign',
      stage: 'export',
      mode: 'draft',
      runDir: outDir,
      outputBaseName: 'plugin-smoke',
      exportPdf: true,
      exportIdml: false,
      instructionsPath,
      summaryPath,
      preRunDeliverables,
    },
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.error, undefined);
  assert.equal(response.data.idmlPath, null);
  assert.equal(response.data.pdfPath, pdfPath);
  assert.equal(response.artifacts.some((item) => item.kind === 'idml'), false);
  assert.equal(fs.existsSync(idmlPath), true);
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
    // 快照脚本自己也会报 warning（预览导出失败之类）。收割 hostWarnings 早先只写在构建/导出两个
    // 分支里，快照阶段的整批被丢掉；现在四个阶段共用一次收割，这里的条目必须活到下一段 state。
    host_results: [{
      id: 'html-fidelity-snapshot',
      status: 'complete',
      data: { ok: true, warnings: [{ code: 'PLACED_ASSET_PREVIEW_EXPORT_FAILED', message: 'preview failed' }] },
    }],
  });

  assert.equal(afterSnapshot.status, 'requires_host_actions');
  assert.equal(afterSnapshot.state.stage, 'cleanup');
  assert.equal(afterSnapshot.state.pendingError.code, 'FIDELITY_INPUT_MISSING');
  assert.deepEqual(afterSnapshot.actions.map((action) => action.id), ['html-build-cleanup']);
  assert.deepEqual(
    (afterSnapshot.state.hostWarnings || []).map((item) => item.code),
    ['PLACED_ASSET_PREVIEW_EXPORT_FAILED']
  );

  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });
  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'FIDELITY_INPUT_MISSING');
  assert.equal(response.error.retryable, false);
  // cleanupThenError 现在把 state.hostWarnings 一并塞进 details：快照阶段的这条 warning
  // 不该在 cleanup 之后的最终错误响应里消失。
  assert.deepEqual(
    (response.error.details.hostWarnings || []).map((item) => item.code),
    ['PLACED_ASSET_PREVIEW_EXPORT_FAILED']
  );
});

test('html.build_indesign states that a rejected build exported no deliverable', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-build-rejected-artifacts');
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

  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.details.artifactsExported, false);
  assert.match(response.error.details.artifactNote, /未导出/);
  assert.equal(response.error.details.intermediateDir, outDir);
});

test('html.build_indesign draft mode success reports staged timing and task-size metrics', () => {
  const outDir = path.join('test', 'workspace', 'plugin-build-metrics-draft');
  const absoluteOutDir = path.join(repoRoot, outDir);
  fs.rmSync(absoluteOutDir, { recursive: true, force: true });

  const callResponse = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      outputBaseName: 'metrics-draft',
      mode: 'draft',
      exportPdf: true,
      exportIdml: true,
    },
  });
  assert.equal(callResponse.status, 'requires_host_actions');
  assert.equal(callResponse.state.stage, 'build');

  const afterBuild = callPlugin('tools/resume', {
    state: callResponse.state,
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterBuild.status, 'requires_host_actions');
  assert.equal(afterBuild.state.stage, 'export');

  const afterExport = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-export-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterExport.status, 'requires_host_actions');
  assert.equal(afterExport.state.stage, 'verify');

  fs.writeFileSync(path.join(absoluteOutDir, 'metrics-draft.indd'), 'fake');
  fs.writeFileSync(path.join(absoluteOutDir, 'metrics-draft.pdf'), 'fake');
  fs.writeFileSync(path.join(absoluteOutDir, 'metrics-draft.idml'), 'fake');

  const response = callPlugin('tools/resume', {
    state: afterExport.state,
    host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'complete');
  assert.equal(response.data.ok, true);
  const { metrics } = response;
  for (const key of ['lint_ms', 'compile_ms', 'indesign_build_ms', 'export_ms', 'verify_ms']) {
    assert.equal(typeof metrics[key], 'number', `expected numeric metrics.${key}`);
    assert.equal(Number.isFinite(metrics[key]), true, `expected finite metrics.${key}`);
  }
  assert.equal(typeof metrics.pages, 'number');
  assert.equal(metrics.pages > 0, true);
  assert.equal(typeof metrics.objects, 'number');
  assert.equal(typeof metrics.assets, 'number');
  assert.equal(typeof metrics.vector_paths, 'number');
  assert.equal(metrics.error_count, 0);
  assert.equal(typeof metrics.warning_count, 'number');
  assert.equal(metrics.artifacts > 0, true);
  // draft mode never runs the readback/fidelity-gate stage; those keys must be absent, not zero.
  assert.equal('readback_ms' in metrics, false);
  assert.equal('fidelity_gate_ms' in metrics, false);
  assert.equal('fidelity_error_count' in metrics, false);
});

test('html.build_indesign final mode fidelity-gate failure reports failed stage and partial metrics', () => {
  const outDir = path.join('test', 'workspace', 'plugin-build-metrics-fidelity-failure');
  const absoluteOutDir = path.join(repoRoot, outDir);
  fs.rmSync(absoluteOutDir, { recursive: true, force: true });

  const callResponse = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      outputBaseName: 'metrics-fidelity-failure',
      mode: 'final',
    },
  });
  assert.equal(callResponse.status, 'requires_host_actions');
  assert.equal(callResponse.state.stage, 'build');

  const afterBuild = callPlugin('tools/resume', {
    state: callResponse.state,
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterBuild.status, 'requires_host_actions');
  assert.equal(afterBuild.state.stage, 'snapshot');

  // The real InDesign host never ran in this test, so fabricate an "actual" snapshot that
  // cannot match the real compiled instructions/expected model: a single near-empty page
  // instead of the real 7-page deck. This drives auditForwardFidelity down its real
  // page/item-count mismatch path instead of asserting on fabricated numbers.
  const fakeActualSnapshot = {
    document: { labels: [] },
    report: { ok: true, errors: [], oversetTextFrames: [] },
    parentPages: [],
    assets: [],
    layers: [],
    styles: {},
    pages: [{
      id: 'fake-page-1',
      index: 0,
      bounds: { x: 0, y: 0, width: 100, height: 80 },
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      guides: [],
      labels: [],
      items: [],
    }],
  };
  fs.writeFileSync(afterBuild.state.snapshotPath, JSON.stringify(fakeActualSnapshot, null, 2), 'utf8');

  const afterSnapshot = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-fidelity-snapshot', status: 'complete', data: { ok: true } }],
  });

  // The fidelity gate failed, so build-indesign requests cleanup of its owned document
  // before surfacing the final error (see cleanupThenError).
  assert.equal(afterSnapshot.status, 'requires_host_actions');
  assert.equal(afterSnapshot.state.stage, 'cleanup');

  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'FIDELITY_GATE_FAILED');
  assert.equal(response.error.stage, 'fidelity');
  assert.equal(response.error.details.stage, 'fidelity');

  const { metrics } = response.error.details;
  for (const key of ['lint_ms', 'compile_ms', 'indesign_build_ms', 'readback_ms', 'fidelity_gate_ms']) {
    assert.equal(typeof metrics[key], 'number', `expected numeric metrics.${key}`);
    assert.equal(Number.isFinite(metrics[key]), true, `expected finite metrics.${key}`);
  }
  assert.equal(metrics.fidelity_error_count > 0, true);
  assert.equal(typeof metrics.pages, 'number');
  assert.equal(metrics.pages > 0, true);
  assert.equal(typeof metrics.objects, 'number');
  assert.equal(typeof metrics.assets, 'number');
  // the export/verify stages never ran; their timing keys must be absent.
  assert.equal('export_ms' in metrics, false);
  assert.equal('verify_ms' in metrics, false);
});

test('html.build_indesign 保真失败的 hint 越过不带 hint 的首条差异，指向文本溢出', () => {
  const outDir = path.join('test', 'workspace', 'plugin-build-fidelity-hint-uplift');
  const absoluteOutDir = path.join(repoRoot, outDir);
  fs.rmSync(absoluteOutDir, { recursive: true, force: true });

  const callResponse = callPlugin('tools/call', {
    id: 'html.build_indesign',
    args: {
      package: 'test/fixtures/e2e/architecture-report/deck.config.json',
      outDir,
      outputBaseName: 'fidelity-hint-uplift',
      mode: 'final',
    },
  });
  assert.equal(callResponse.status, 'requires_host_actions');

  const afterBuild = callPlugin('tools/resume', {
    state: callResponse.state,
    host_results: [{ id: 'html-build-script', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterBuild.status, 'requires_host_actions');
  assert.equal(afterBuild.state.stage, 'snapshot');

  // 真实 InDesign 没跑过，所以把 instructions / expected model / snapshot 一起换成受控的两项差异：
  // 页面内第一项是被挪走的矩形（几何差异不带 hint），第二项文本读回是源文本的严格前缀（溢出，带 hint）。
  const fixture = oversetBehindGeometryFixture();
  fs.writeFileSync(afterBuild.state.instructionsPath, JSON.stringify(fixture.instructions, null, 2), 'utf8');
  fs.writeFileSync(afterBuild.state.expectedModelPath, JSON.stringify(fixture.expectedModel, null, 2), 'utf8');
  fs.writeFileSync(afterBuild.state.snapshotPath, JSON.stringify(fixture.actualSnapshot, null, 2), 'utf8');

  const afterSnapshot = callPlugin('tools/resume', {
    state: afterBuild.state,
    host_results: [{ id: 'html-fidelity-snapshot', status: 'complete', data: { ok: true } }],
  });
  assert.equal(afterSnapshot.status, 'requires_host_actions');
  assert.equal(afterSnapshot.state.stage, 'cleanup');

  const response = callPlugin('tools/resume', {
    state: afterSnapshot.state,
    host_results: [{ id: 'html-build-cleanup', status: 'complete', data: { ok: true } }],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'FIDELITY_GATE_FAILED');

  const report = JSON.parse(fs.readFileSync(afterBuild.state.fidelityReportPath, 'utf8'));
  assert.equal(report.errors[0].code, 'FORWARD_ITEM_GEOMETRY_CHANGED');
  assert.equal(report.errors[0].hint, undefined);
  assert.equal(report.errors.some((entry) => entry.reason === 'overset'), true);

  assert.match(response.error.hint, /文本框/);
  assert.match(response.error.hint, /Full list: forward-fidelity-report\.json\.$/);
  // hint 越过第一条差异指向第二条（body 项），前缀得带上那条自己的定位，不能顶着第一条的名字。
  assert.match(response.error.hint, /^page-1 \/ body: /);
  // 首条消息仍然报第一条差异，所以那里不该出现溢出口径。
  assert.equal(response.error.message.includes('text overset'), false);
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

test('html.reverse_export resume reports readback_ms, export_ms and task-size metrics on success', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-reverse-metrics-resume');
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
      readbackStartedAt: Date.now() - 5,
    },
    host_results: [
      { id: 'html-reverse-snapshot', status: 'complete', data: { ok: true } },
    ],
  });

  assert.equal(response.status, 'complete');
  const { metrics } = response;
  assert.equal(typeof metrics.readback_ms, 'number');
  assert.equal(Number.isFinite(metrics.readback_ms), true);
  assert.equal(typeof metrics.export_ms, 'number');
  assert.equal(Number.isFinite(metrics.export_ms), true);
  assert.equal(typeof metrics.pages, 'number');
  assert.equal(typeof metrics.objects, 'number');
  assert.equal(typeof metrics.assets, 'number');
  assert.equal(typeof metrics.error_count, 'number');
  assert.equal(metrics.artifacts > 0, true);
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
  assert.match(response.error.message, /TRUSTED_SOURCE_STRUCTURE_MUTATED/);
  assert.notEqual(response.error.message, 'Reverse pipeline failed; refusing to report a successful export.');
});

test('html.reverse_export resume pipeline failure message carries the trusted-source count, first reason and reportPath', () => {
  const reportPath = path.join(repoRoot, 'test', 'workspace', 'fake-reverse-report.json');
  const response = reversePipelineFailureResponse({
    ok: false,
    report: {
      reconstruction: {
        trustedSourcePreservation: {
          ok: false,
          summary: { trustedPages: 3, trustedItems: 12, checked: 15, mutations: 2, missing: 0 },
          failures: [
            {
              code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED',
              message: 'Trusted source item field changed after reconstruction.',
              pageId: 'page-1',
              itemId: 'headline-1',
            },
            { code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED', pageId: 'page-2', itemId: 'headline-2' },
          ],
        },
      },
    },
  }, {}, reportPath);

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'REVERSE_PIPELINE_FAILED');
  assert.match(response.error.message, /2 issues/);
  assert.match(response.error.message, /page-1/);
  assert.match(response.error.message, /headline-1/);
  assert.match(response.error.message, /Trusted source item field changed after reconstruction\./);
  assert.ok(response.error.hint);
  assert.match(response.error.hint, new RegExp(escapeRegExp(reportPath)));
  assert.equal(response.error.details.reportPath, reportPath);
});

test('underlyingHostFailure extracts the real cause from a failed host_results entry', () => {
  assert.deepEqual(
    underlyingHostFailure({ error: { code: 'INDESIGN_SCRIPT_FAILED', message: 'No document open' } }),
    { code: 'INDESIGN_SCRIPT_FAILED', message: 'No document open' },
  );
  assert.deepEqual(
    underlyingHostFailure({ data: { errors: [{ code: 'NO_ACTIVE_DOCUMENT', message: 'No document open' }] } }),
    { code: 'NO_ACTIVE_DOCUMENT', message: 'No document open' },
  );
  assert.deepEqual(
    underlyingHostFailure({ data: { error: { code: 'TIMEOUT', message: 'Script timed out' } } }),
    { code: 'TIMEOUT', message: 'Script timed out' },
  );
  assert.deepEqual(underlyingHostFailure({}), { code: null, message: null });
});

test('html.reverse_export resume surfaces the real host failure reason in the message, not just the action id', () => {
  const outDir = path.join(repoRoot, 'test', 'workspace', 'plugin-reverse-host-failure');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const response = callPlugin('tools/resume', {
    state: {
      tool_id: 'html.reverse_export',
      outDir,
      snapshotPath: path.join(outDir, 'reverse-snapshot.json'),
      mode: 'structured',
      assetPolicy: 'reference',
      sourceRoot: null,
      nasPublicRoot: '/nas',
      reconstructionProfile: { name: 'none', algorithms: [] },
    },
    host_results: [
      {
        id: 'html-reverse-snapshot',
        status: 'error',
        data: { errors: [{ code: 'NO_ACTIVE_DOCUMENT', message: 'No document open' }] },
      },
    ],
  });

  assert.equal(response.status, 'error');
  assert.equal(response.error.code, 'HOST_ACTION_FAILED');
  assert.match(response.error.message, /No document open/);
  assert.equal(response.error.details.causeCode, 'NO_ACTIVE_DOCUMENT');
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

// 三处 host warning 用例的驱动步骤此前逐字抄了三份：备好 outDir 与三个产物，再走
// build → export → verify 的 draft 全程。抄三份的代价是口径各自漂移（改一处忘两处），
// 收成一个助手：入参只有工作目录名，返回的就是那三个用例原来各自定义的 driveDraftBuild。
function draftBuildDriver(workspaceName) {
  const outDir = path.join(repoRoot, 'test', 'workspace', workspaceName);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const instructionsPath = path.join(outDir, 'instructions.json');
  const summaryPath = path.join(outDir, 'compile-summary.json');
  fs.writeFileSync(path.join(outDir, 'plugin-smoke.indd'), 'fake');
  fs.writeFileSync(path.join(outDir, 'plugin-smoke.pdf'), 'fake');
  fs.writeFileSync(path.join(outDir, 'plugin-smoke.idml'), 'fake');
  fs.writeFileSync(instructionsPath, '{}');
  fs.writeFileSync(summaryPath, '{}');

  return function driveDraftBuild(buildHostResult, exportHostResult) {
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
      host_results: [buildHostResult],
    });
    assert.equal(afterBuild.status, 'requires_host_actions');
    assert.equal(afterBuild.state.stage, 'export');

    const afterExport = callPlugin('tools/resume', {
      state: afterBuild.state,
      host_results: [exportHostResult || { id: 'html-export-script', status: 'complete', data: { ok: true } }],
    });
    assert.equal(afterExport.status, 'requires_host_actions');
    assert.equal(afterExport.state.stage, 'verify');

    const complete = callPlugin('tools/resume', {
      state: afterExport.state,
      host_results: [{ id: 'html-export-verify', status: 'complete', data: { ok: true } }],
    });
    assert.equal(complete.status, 'complete');
    return complete;
  };
}

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

// 单页两项的最小保真夹具：页面事实全对得上，只留两处受控差异，
// 且顺序固定为「几何差异（无 hint）在前、文本溢出（有 hint）在后」。
function oversetBehindGeometryFixture() {
  const sourceText = '项目策划与执行/Project planning and delivery';
  const readBackText = '项目策划与执行/Project ';
  const pageFacts = {
    width: 100,
    height: 80,
    margins: { top: 5, right: 5, bottom: 5, left: 5 },
    guides: [{ orientation: 'vertical', position: 50 }],
  };
  const pageLabel = {
    protocol: 'html-indesign',
    version: 1,
    kind: 'page',
    id: 'page-1',
    source: 'html-to-indesign',
    semantic: 'cover',
    layout: 'cover-grid',
  };
  const shapeLabel = fidelityItemLabel('panel', 'shape', 0, '');
  const textLabel = fidelityItemLabel('body', 'text', 1, sourceText);

  const expectedModel = {
    kind: 'DocumentModel',
    id: 'deck',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    pages: [{
      id: 'page-1',
      index: 0,
      semantic: 'cover',
      layout: 'cover-grid',
      ...pageFacts,
      // expected model 只提供页面级事实；两项条目差异都从 instructions 与 snapshot 的逐项比对里产生。
      items: [],
    }],
  };
  const instructions = {
    document: { id: 'deck', parentPages: [] },
    assets: [],
    pages: [{
      id: 'page-1',
      ...pageFacts,
      labels: [pageLabel],
      items: [{
        id: 'panel',
        role: 'shape',
        type: 'SHAPE',
        shapeKind: 'rectangle',
        bounds: { x: 10, y: 10, width: 80, height: 20 },
        layer: '图形',
        text: '',
        runs: [],
        labels: [shapeLabel],
      }, {
        id: 'body',
        role: 'text',
        type: 'TEXT',
        bounds: { x: 10, y: 35, width: 80, height: 12 },
        layer: '文字',
        text: sourceText,
        runs: [{ text: sourceText, characterStyle: null }],
        labels: [textLabel],
      }],
    }],
  };
  const actualSnapshot = {
    document: { labels: [] },
    report: { ok: true, errors: [], oversetTextFrames: [] },
    parentPages: [],
    assets: [],
    layers: [],
    styles: {},
    pages: [{
      id: '1',
      index: 0,
      bounds: { x: 0, y: 0, width: pageFacts.width, height: pageFacts.height },
      margins: pageFacts.margins,
      guides: pageFacts.guides,
      labels: [pageLabel],
      items: [{
        id: '201',
        type: 'Rectangle',
        // 差异一：矩形横向被挪了 12pt，远超容差；几何差异不带 hint。
        bounds: { x: 22, y: 10, width: 80, height: 20 },
        layerName: '图形',
        paragraphStyleName: '',
        objectStyleName: '',
        text: '',
        textRuns: [],
        table: null,
        placedAsset: null,
        labels: [shapeLabel],
      }, {
        id: '202',
        type: 'TextFrame',
        bounds: { x: 10, y: 35, width: 80, height: 12 },
        layerName: '文字',
        paragraphStyleName: '',
        objectStyleName: '',
        // 差异二：读回文本是源文本的严格前缀 —— 溢出签名，带 hint。
        text: readBackText,
        textRuns: [{ text: readBackText, characterStyle: null }],
        table: null,
        placedAsset: null,
        labels: [textLabel],
      }],
    }],
  };
  return { expectedModel, instructions, actualSnapshot };
}

function fidelityItemLabel(id, role, order, sourceText) {
  const tagName = role === 'text' ? 'p' : 'div';
  return {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id,
    source: 'html-to-indesign',
    role,
    semantic: null,
    htmlTag: tagName,
    className: role,
    sourceFile: 'pages/01.html',
    sourceNode: {
      tagName,
      id,
      classList: [role],
      attributes: { id },
    },
    sourceText,
    sourceHtml: null,
    sourceRuns: [],
    sourceAncestorNodes: [],
    structure: { parentId: 'page-1', order, containerPolicy: 'group' },
    layout: null,
  };
}
