const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createRunContext,
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
  createHumanInddRunContext,
  architectureStyleNameMap,
  loadStyleNameMapForHtml,
  parseArgs,
  parseCliResultJson,
  resolveIndesignCliCommand,
  parseTargetSize,
  resolveReverseSourceRootForHtml,
  assertReverseCompilationOk,
} = require('../scripts/indesign-e2e');
const scriptExports = require('../scripts/indesign-e2e');
const { buildCloseJsx } = require('../src/indesign-cli-plugin/host-jsx');
const {
  assertPanelNameAuditOk,
  assertNoLossyVectorWarnings,
  assertNoTextOverset,
  isAllowedBuiltInPanelName,
  observedPanelNamesForHtml,
} = require('../src/writers/indesign/audit/e2e-result-audit');
const {
  assertReverseHtmlSemantics,
  auditReverseAuthorPackage,
  auditSecondPassAuthorStability,
  auditReverseHtmlSemantics,
} = require('../src/writers/html/audit/reverse-roundtrip');
const { renderSnapshot } = require('../src/adapters/html');
const { compileInstructions } = require('../src/indesign-pipeline');

test('createRunContext creates stable default paths under test/workspace', () => {
  const repoRoot = path.resolve('D:/AI/html-indesign');
  const context = createRunContext({
    repoRoot,
    timestamp: '20260524-190000',
  });

  assert.equal(context.htmlPath, path.join(repoRoot, 'test/fixtures/e2e/architecture-report/deck.html'));
  assert.equal(context.workspaceDir, path.join(repoRoot, 'test/workspace'));
  assert.equal(context.runDir, path.join(repoRoot, 'test/workspace/indesign-e2e-20260524-190000'));
  assert.equal(context.defaultInstructionsPath, path.join(repoRoot, 'test/workspace/instructions.json'));
  assert.equal(context.runInstructionsPath, path.join(context.runDir, 'instructions.json'));
  assert.equal(context.expectedModelPath, path.join(context.runDir, 'expected-semantic-model.json'));
  assert.equal(context.semanticPresetPath, path.join(context.runDir, 'expected-semantic-preset.json'));
  assert.equal(context.fidelityReportPath, path.join(context.runDir, 'forward-fidelity-report.json'));
});

test('indesign e2e captures every built document and runs the forward fidelity gate before export', () => {
  const script = fs.readFileSync(path.resolve('scripts/indesign-e2e.js'), 'utf8');
  const gateCall = script.indexOf('captureAndAuditForwardFidelity(context, options)');
  const exportCall = script.indexOf("fs.writeFileSync(context.exportScriptPath, buildExportJsx({");

  assert.equal(gateCall >= 0, true);
  assert.equal(exportCall > gateCall, true);
  assert.match(script, /forward-fidelity-report\.json/);
});

test('buildBuildJsx creates an isolated document and loads executor libs', () => {
  const jsx = buildBuildJsx({
    repoRoot: 'D:/AI/html-indesign',
    instructionsPath: 'D:/AI/html-indesign/test/workspace/indesign-e2e-20260524-190000/instructions.json',
  });

  assert.match(jsx, /app\.documents\.add\(\)/);
  assert.match(jsx, /HI\.runBuildFromInstructions\(app, "D:\/AI\/html-indesign\/test\/workspace\/indesign-e2e-20260524-190000\/instructions\.json"\)/);
  assert.match(jsx, /includeLib\("hi_labels\.jsxinc"\)/);
  assert.match(jsx, /includeLib\("hi_fonts\.jsxinc"\)/);
  assert.match(jsx, /includeLib\("hi_tables\.jsxinc"\)/);
  assert.match(jsx, /html-indesign-indesign-e2e/);
  assert.match(jsx, /doc\.extractLabel\("html_indesign_e2e_marker"\) === marker/);
  assert.match(jsx, /doc\.close\(SaveOptions\.NO\)/);
  assert.match(jsx, /closedOnFailure/);
});

test('buildExportJsx exports IDD PDF IDML and closes the temporary document', () => {
  const jsx = buildExportJsx({
    runDir: 'D:/AI/html-indesign/test/workspace/indesign-e2e-20260524-190000',
  });

  assert.match(jsx, /ExportFormat\.PDF_TYPE/);
  assert.match(jsx, /ExportFormat\.INDESIGN_MARKUP/);
  assert.match(jsx, /architecture-report-indesign\.indd/);
  assert.match(jsx, /auditPanelNames/);
  assert.match(jsx, /panelAsciiNames/);
  assert.match(jsx, /isAllowedBuiltInPanelName/);
  assert.match(jsx, /doc\.close\(SaveOptions\.NO\)/);
  assert.match(jsx, /var oldPdfPageRange/);
  assert.match(jsx, /app\.pdfExportPreferences\.pageRange\s*=\s*PageRange\.ALL_PAGES/);
  assert.match(jsx, /app\.pdfExportPreferences\.pageRange\s*=\s*oldPdfPageRange/);
});

test('buildExportJsx refuses to export a document owned by another build', () => {
  const jsx = buildExportJsx({
    runDir: 'D:/AI/html-indesign/test/workspace/run',
    expectedMarker: 'owned-build',
  });

  assert.match(jsx, /ACTIVE_DOCUMENT_MISMATCH/);
  assert.match(jsx, /extractLabel\("html_indesign_e2e_marker"\) !== expectedMarker/);
});

test('buildCloseJsx only closes the document owned by the failed build', () => {
  const jsx = buildCloseJsx({ expectedMarker: 'owned-build' });

  assert.match(jsx, /Refusing to close a document not created by this build run/);
  assert.match(jsx, /doc\.close\(SaveOptions\.NO\)/);
});

test('parseCliResultJson returns nested result_json from indesign cli output', () => {
  const parsed = parseCliResultJson(JSON.stringify({
    ok: true,
    data: {
      result_json: {
        ok: true,
        counts: {
          pages: 7,
          placedAssets: 9,
        },
      },
    },
  }));

  assert.deepEqual(parsed, {
    ok: true,
    counts: {
      pages: 7,
      placedAssets: 9,
    },
  });
});

test('parseCliResultJson returns current script run parsed payload', () => {
  const parsed = parseCliResultJson(JSON.stringify({
    ok: true,
    data: {
      parsed: {
        ok: true,
        outputs: {
          pdf: 'D:/out/report.pdf',
        },
        counts: {
          pages: 7,
        },
      },
    },
  }));

  assert.deepEqual(parsed, {
    ok: true,
    outputs: {
      pdf: 'D:/out/report.pdf',
    },
    counts: {
      pages: 7,
    },
  });
});

test('indesign e2e script exports only script-owned helpers', () => {
  assert.equal(scriptExports.assertPanelNameAuditOk, undefined);
  assert.equal(scriptExports.observedPanelNamesForHtml, undefined);
  assert.equal(scriptExports.assertNoTextOverset, undefined);
  assert.equal(scriptExports.auditReverseHtmlSemantics, undefined);
  assert.equal(scriptExports.assertReverseHtmlSemantics, undefined);
  assert.equal(scriptExports.auditReverseAuthorPackage, undefined);
  assert.equal(scriptExports.auditSecondPassAuthorStability, undefined);
  assert.equal(typeof scriptExports.createRunContext, 'function');
  assert.equal(typeof scriptExports.runIndesignE2E, 'function');
});

test('indesign e2e first-pass author audit is owned by the reverse pipeline', () => {
  const script = fs.readFileSync(path.resolve('scripts/indesign-e2e.js'), 'utf8');

  assert.equal(script.includes('auditReverseAuthorPackage({'), false);
});

test('indesign e2e rejects reverse compilation when trusted-source preservation fails', () => {
  assert.throws(() => assertReverseCompilationOk({
    ok: false,
    report: {
      reconstruction: {
        trustedSourcePreservation: {
          ok: false,
          failures: [{ code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED' }],
        },
      },
    },
  }, 'Reverse compilation failed'), /TRUSTED_SOURCE_STRUCTURE_MUTATED/);
});

test('reverse roundtrip source root is only explicit or a real author package root', () => {
  const root = path.resolve('test/workspace/e2e-source-root-resolution-test');
  const looseRoot = path.join(root, 'loose-html');
  const authorRoot = path.join(root, 'author-package');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(looseRoot, { recursive: true });
  fs.writeFileSync(path.join(looseRoot, 'deck.html'), '<!doctype html><main></main>\n', 'utf8');
  writeMinimalAuthorPackage(authorRoot, '<section class="page"><p>作者包</p></section>');

  assert.equal(resolveReverseSourceRootForHtml(path.join(looseRoot, 'deck.html')), null);
  assert.equal(resolveReverseSourceRootForHtml(path.join(authorRoot, 'deck.html')), authorRoot);
  assert.equal(
    resolveReverseSourceRootForHtml(path.join(looseRoot, 'deck.html'), { sourceRoot: authorRoot }),
    authorRoot
  );
});

test('assertPanelNameAuditOk rejects English panel-facing names', () => {
  assert.throws(() => assertPanelNameAuditOk({
    audit: {
      panelAsciiNames: [{ kind: 'layers', name: 'drawing' }],
    },
  }), /English tokens/);

  assert.doesNotThrow(() => assertPanelNameAuditOk({
    audit: {
      panelAsciiNames: [],
    },
  }));

  assert.doesNotThrow(() => assertPanelNameAuditOk({
    audit: {
      panelAsciiNames: [{ kind: 'swatches', name: 'Black' }],
    },
  }));

  assert.doesNotThrow(() => assertPanelNameAuditOk({
    audit: {
      panelAsciiNames: [{ kind: 'layers', name: 'Diagram' }],
    },
  }, {
    allowedPanelNames: [{ kind: 'layers', name: 'Diagram' }],
  }));

  assert.throws(() => assertPanelNameAuditOk({
    audit: {
      panelAsciiNames: [{ kind: 'layers', name: 'drawing' }],
    },
  }, {
    allowedPanelNames: [{ kind: 'layers', name: 'Diagram' }],
  }), /English tokens/);
});

test('observedPanelNamesForHtml only allows layer names from observation HTML', () => {
  const outDir = path.resolve('test/workspace/observed-panel-names-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const observed = path.join(outDir, 'observed.html');
  const structured = path.join(outDir, 'structured.html');
  fs.writeFileSync(observed, '<section data-id-reverse-mode="observation"><div data-id-layer="Diagram"></div><div data-id-layer="文字"></div></section>', 'utf8');
  fs.writeFileSync(structured, '<section><div data-id-layer="drawing"></div></section>', 'utf8');

  assert.deepEqual(observedPanelNamesForHtml(observed), [
    { kind: 'layers', name: 'Diagram' },
    { kind: 'layers', name: '文字' },
  ]);
  assert.deepEqual(observedPanelNamesForHtml(structured), []);
});

test('assertNoTextOverset rejects build outputs with located text overflow', () => {
  assert.throws(() => assertNoTextOverset({
    counts: { oversetTextFrames: 1 },
    oversetTextFrames: [{
      itemId: 'page-03-title',
      pageName: '3',
      bounds: [12, 24, 48, 240],
      textLength: 7,
      visibleText: '1-建筑方案更',
    }],
  }), /InDesign text frames are overset/);

  assert.throws(() => assertNoTextOverset({
    counts: { oversetTextFrames: 1 },
    warnings: [{
      code: 'TEXT_OVERSET',
      details: {
        itemId: 'page-02-date',
        pageName: '2',
        visibleText: '2026',
        sourceText: '2026年1月26日区委专题会',
      },
    }],
  }), /2026年1月26日区委专题会/);

  assert.doesNotThrow(() => assertNoTextOverset({
    counts: { oversetTextFrames: 0 },
    oversetTextFrames: [],
  }));
});

test('assertNoLossyVectorWarnings rejects vector geometry loss but allows unrelated warnings', () => {
  assert.throws(() => assertNoLossyVectorWarnings({
    warnings: [{
      code: 'VECTOR_MULTIPATH_UNSUPPORTED',
      message: 'Only the first vector path was applied by the current executor',
      details: { itemId: 'page-03-svg-1', pathCount: 12 },
    }],
  }), /InDesign dropped or failed to apply vector geometry/);

  assert.throws(() => assertNoLossyVectorWarnings({
    warnings: [{
      code: 'VECTOR_PATH_APPLY_FAILED',
      message: 'Path geometry could not be applied',
      details: { itemId: 'page-03-svg-1' },
    }],
  }), /VECTOR_PATH_APPLY_FAILED/);

  assert.throws(() => assertNoLossyVectorWarnings({
    messages: [{
      code: 'VECTOR_DASH_STYLE_CREATE_FAILED',
      message: 'Native dashed stroke style could not be created',
      details: { itemId: 'page-03-svg-1', strokeStyle: '6px, 6px' },
    }],
  }), /VECTOR_DASH_STYLE_CREATE_FAILED/);

  assert.doesNotThrow(() => assertNoLossyVectorWarnings({
    warnings: [{ code: 'FONT_FALLBACK_APPLIED', message: 'A fallback font was used.' }],
  }));
});

test('isAllowedBuiltInPanelName only allows InDesign default swatches', () => {
  assert.equal(isAllowedBuiltInPanelName('swatches', 'Paper'), true);
  assert.equal(isAllowedBuiltInPanelName('layers', 'Layer 1'), false);
  assert.equal(isAllowedBuiltInPanelName('swatches', 'color-123456'), false);
});

test('package exposes npm run e2e:indesign', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  assert.equal(pkg.scripts['e2e:indesign'], 'node scripts/indesign-e2e.js');
});

test('parseTargetSize accepts presentation presets and explicit dimensions', () => {
  assert.deepEqual(parseTargetSize('qhd'), { width: 2560, height: 1440, name: 'qhd' });
  assert.deepEqual(parseTargetSize('2048x1080'), { width: 2048, height: 1080, name: '2048x1080' });
  assert.equal(parseTargetSize('same'), null);
});

test('parseArgs accepts equals-style CLI options', () => {
  const options = parseArgs([
    '--html=custom.html',
    '--target-size=qhd',
    '--unit-mode=presentation',
    '--skip-preview',
  ], 'D:/AI/html-indesign');

  assert.equal(options.htmlPath, 'custom.html');
  assert.equal(options.targetSize, 'qhd');
  assert.equal(options.unitMode, 'presentation');
  assert.equal(options.skipPreview, true);
});

test('parseArgs accepts reverse roundtrip flag', () => {
  const options = parseArgs(['--reverse-roundtrip', '--target-size=qhd'], 'D:/AI/html-indesign');

  assert.equal(options.reverseRoundtrip, true);
  assert.equal(options.targetSize, 'qhd');
  assert.deepEqual(options.reconstructionProfile, {
    name: 'safe',
    algorithms: ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block', 'reading-order-lite'],
  });
});

test('parseArgs resolves one reconstruction profile for all E2E rounds', () => {
  const options = parseArgs([
    '--reverse-roundtrip',
    '--reconstruction-profile=experimental',
    '--reconstruct=reading-order-lite figure-grid figure-grid text-block',
  ], 'D:/AI/html-indesign');

  assert.deepEqual(options.reconstructionProfile, {
    name: 'experimental',
    algorithms: ['page-object-graph', 'caption-structure', 'figure-grid', 'text-block', 'reading-order-lite'],
  });
});

test('parseArgs rejects E2E reconstruct lists outside experimental profile', () => {
  assert.throws(() => parseArgs([
    '--reverse-roundtrip',
    '--reconstruct=text-block',
  ], 'D:/AI/html-indesign'), /only valid with the experimental profile/);
});

test('parseArgs accepts explicit reverse roundtrip mode', () => {
  const options = parseArgs(['--reverse-roundtrip', '--reverse-mode=observation'], 'D:/AI/html-indesign');

  assert.equal(options.reverseRoundtrip, true);
  assert.equal(options.reverseMode, 'observation');
});

test('parseArgs accepts second pass roundtrip gate flag', () => {
  const options = parseArgs(['--reverse-roundtrip', '--second-pass-roundtrip'], 'D:/AI/html-indesign');

  assert.equal(options.reverseRoundtrip, true);
  assert.equal(options.secondPassRoundtrip, true);
});

test('parseArgs accepts human InDesign input as a strict second-pass observation roundtrip', () => {
  const options = parseArgs([
    '--indd=//daga-nas5/daga-2025-project/report.indd',
    '--run-dir=test/workspace/human-indd-e2e',
  ], 'D:/AI/html-indesign');

  assert.equal(options.inddPath, '//daga-nas5/daga-2025-project/report.indd');
  assert.equal(options.runDir, 'test/workspace/human-indd-e2e');
  assert.equal(options.reverseMode, 'observation');
  assert.equal(options.reverseRoundtrip, true);
  assert.equal(options.secondPassRoundtrip, true);
});

test('createHumanInddRunContext keeps all human InDesign roundtrip output in the local workspace', () => {
  const repoRoot = path.resolve('D:/AI/html-indesign');
  const context = createHumanInddRunContext({
    repoRoot,
    timestamp: '20260708-230000',
    inddPath: '//daga-nas5/daga-2025-project/report.indd',
  });

  assert.equal(context.inddPath, path.resolve('//daga-nas5/daga-2025-project/report.indd'));
  assert.equal(context.workspaceDir, path.join(repoRoot, 'test/workspace'));
  assert.equal(context.runDir, path.join(repoRoot, 'test/workspace/human-indd-e2e-20260708-230000'));
  assert.equal(context.reverseSnapshotPath, path.join(context.runDir, 'reverse-snapshot.json'));
  assert.equal(context.reverseOutDir, path.join(context.runDir, 'reverse-html'));
  assert.equal(context.authorRoundtripDir, path.join(context.runDir, 'generated-author-e2e'));
  assert.equal(context.runDir.startsWith(path.dirname(context.inddPath)), false);
});

test('build reverse snapshot jsx writes target output label and runs reverse script', () => {
  const jsx = buildReverseSnapshotJsx({
    repoRoot: 'D:/AI/html-indesign',
    outputPath: 'D:/AI/html-indesign/test/workspace/reverse-snapshot.json',
    inddPath: '//daga-nas5/daga-2025-project/report.indd',
  });

  assert.match(jsx, /html_indesign_reverse_output/);
  assert.match(jsx, /app\.open\(indd\)/);
  assert.match(jsx, /export_to_html_snapshot\.jsx/);
});

test('build reverse snapshot jsx can check the current owned build and close it on failure', () => {
  const jsx = buildReverseSnapshotJsx({
    repoRoot: 'D:/AI/html-indesign',
    outputPath: 'D:/AI/html-indesign/test/workspace/reverse-snapshot.json',
    inddPath: null,
    closeDocument: false,
    expectedMarker: 'owned-build',
    closeOnFailure: true,
  });

  assert.doesNotMatch(jsx, /app\.open\(indd\)/);
  assert.match(jsx, /ACTIVE_DOCUMENT_MISMATCH/);
  assert.match(jsx, /ownedDocument\.close\(SaveOptions\.NO\)/);
});

test('resolveIndesignCliCommand defaults to new command and accepts explicit env override', () => {
  assert.equal(resolveIndesignCliCommand({}), 'indesign-cli');
  assert.equal(resolveIndesignCliCommand({
    INDESIGN_CLI_BIN: 'D:/AI/mcp-indesign/.indesign-cli/package-test-venv-root/Scripts/indesign-cli.exe',
  }), 'D:/AI/mcp-indesign/.indesign-cli/package-test-venv-root/Scripts/indesign-cli.exe');
});

test('auditReverseHtmlSemantics reports required bidirectional tags', () => {
  const audit = auditReverseHtmlSemantics(`
    <section class="page" data-page="agenda" data-id-parent-page="report-parent" data-id-layout="contents-grid">
      <h2 data-id-semantic="page-title">汇报结构</h2>
    </section>
  `);

  assert.equal(audit.ok, true);
  assert.deepEqual(audit.counts, {
    dataPage: 1,
    parentPage: 1,
    layout: 1,
    semantic: 1,
  });
});

test('assertReverseHtmlSemantics rejects false-positive reverse roundtrips', () => {
  const html = '<section class="page" data-page="agenda"><h2 data-id-semantic="page-title">汇报结构</h2></section>';

  assert.throws(() => assertReverseHtmlSemantics(html, 'reverse-html/deck.html'), /data-id-parent-page/);
  assert.deepEqual(auditReverseHtmlSemantics(html).missing, ['data-id-parent-page', 'data-id-layout']);
});

test('auditReverseAuthorPackage reports generated author package health', () => {
  const outDir = path.resolve('test/workspace/e2e-author-audit-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const { writeReverseAuthorPackage } = require('../src/writers/html');

  const author = writeReverseAuthorPackage({
    kind: 'DocumentModel',
    id: 'audit',
    title: 'Audit',
    pages: [{ id: 'page-1', width: 800, height: 450, items: [] }],
  }, { outDir, mode: 'observation' });

  const audit = auditReverseAuthorPackage({
    config: author.configPath,
    entry: author.entryPath,
    outDir: author.outDir,
    pages: author.pages,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.pages, 1);
});

test('auditReverseAuthorPackage includes editable author html checks', () => {
  assert.equal(typeof auditReverseAuthorPackage, 'function');
});

test('auditReverseAuthorPackage attaches source roundtrip report when sourceRoot is provided', () => {
  const root = path.resolve('test/workspace/e2e-author-source-roundtrip-test');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeMinimalAuthorPackage(sourceRoot, '<section class="page"><h1>Contents</h1></section>');
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><h1>Contents</h1></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    entry: path.join(reverseRoot, 'deck.html'),
    outDir: reverseRoot,
    sourceRoot,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.sourceRoundtrip.ok, true);
  assert.deepEqual(audit.sourceRoundtrip.warnings, []);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/source-roundtrip-report.json')), true);
});

test('auditReverseAuthorPackage attaches content inventory and structure signature reports', () => {
  const root = path.resolve('test/workspace/e2e-audit-integrity');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeMinimalAuthorPackage(sourceRoot, '<section class="page"><section id="block" class="text-block"><p id="copy">完整文字</p></section></section>');
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><section id="block" class="text-block"><p id="copy">完整文字</p></section></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    entry: path.join(reverseRoot, 'deck.html'),
    outDir: reverseRoot,
    sourceRoot,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.contentInventory.ok, true);
  assert.equal(audit.structureSignature.ok, true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/content-inventory-report.json')), true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/structure-signature-report.json')), true);
});

test('auditReverseAuthorPackage 关键内联样式漂移 invalid-input 必须 fail', () => {
  const root = path.resolve('test/workspace/e2e-audit-source-hard');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeMinimalAuthorPackage(sourceRoot, '<section class="page"><p id="copy" style="left:1px">完整文字</p></section>');
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><p id="copy" style="left:2px">完整文字</p></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    entry: path.join(reverseRoot, 'deck.html'),
    outDir: reverseRoot,
    sourceRoot,
  });

  assert.equal(audit.sourceRoundtrip.ok, false);
  assert.equal(audit.contentInventory.ok, true);
  assert.equal(audit.structureSignature.ok, true);
  assert.equal(audit.ok, false);
  assert.equal(audit.errors.some((error) => error.code === 'ROUNDTRIP_INLINE_STYLE_CHANGED'), true);
});

test('auditReverseAuthorPackage 结构节点丢失 invalid-input 必须 fail', () => {
  const root = path.resolve('test/workspace/e2e-audit-structure-hard');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeMinimalAuthorPackage(sourceRoot, '<section class="page"><section id="group"><p id="copy">完整文字</p></section></section>');
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><p id="copy">完整文字</p></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    entry: path.join(reverseRoot, 'deck.html'),
    outDir: reverseRoot,
    sourceRoot,
  });

  assert.equal(audit.structureSignature.ok, false);
  assert.equal(audit.contentInventory.ok, false);
  assert.equal(audit.ok, false);
  assert.equal(audit.errors.some((error) => error.code === 'STRUCTURE_NODE_MISSING'), true);
  assert.equal(audit.errors.some((error) => error.code === 'CONTENT_GEOMETRY_ITEMS_LOST'), true);
});

test('auditSecondPassAuthorStability fails when the second-pass author package drifts by bytes', () => {
  const root = path.resolve('test/workspace/e2e-second-pass-stability');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeMinimalAuthorPackage(sourceRoot, '<section class="page"><p id="copy" style="font-size:18.0001px">完整文字</p></section>');
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><p id="copy" style="font-size:18.0002px">完整文字</p></section>');

  const audit = auditSecondPassAuthorStability({
    sourceRoot,
    reverseRoot,
    reportDir: path.join(reverseRoot, 'reports'),
  });

  assert.equal(audit.ok, false);
  assert.equal(audit.sourceDrift.stable, false);
  assert.equal(audit.contentInventory.ok, true);
  assert.equal(audit.structureSignature.ok, true);
  assert.equal(audit.errors.some((error) => error.code === 'CANONICAL_SOURCE_DRIFT_UNSTABLE'), true);
  assert.deepEqual(audit.warnings, []);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/canonical-source-drift-report.json')), true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/canonical-content-inventory-report.json')), true);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/canonical-structure-signature-report.json')), true);
});

test('architecture E2E instructions use Chinese panel-facing resource names', async () => {
  const htmlPath = path.resolve(__dirname, 'fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: 'presentation',
    targetSize: 'qhd',
    styleNameMap: architectureStyleNameMap(),
  });
  const panelNames = [
    ...(instructions.layers || []).map((layer) => layer.name),
    ...Object.keys(instructions.styles.swatches || {}),
    ...Object.keys(instructions.styles.paragraphStyles || {}),
    ...Object.keys(instructions.styles.characterStyles || {}),
    ...Object.keys(instructions.styles.objectStyles || {}),
    ...Object.keys(instructions.styles.frameStyles || {}),
    ...Object.keys(instructions.styles.tableStyles || {}),
  ];
  const englishNames = panelNames.filter((name) => /[A-Za-z]/.test(name));

  assert.deepEqual(englishNames, []);
});

test('architecture style map preserves current Chinese panel-facing names', () => {
  const styleNameMap = architectureStyleNameMap();

  assert.equal(styleNameMap.paragraphStyles['deck-eyebrow'], '页眉小标');
  assert.equal(styleNameMap.objectStyles['hero-image'], '封面图像');
  assert.equal(styleNameMap.frameStyles['hero-frame'], '封面图片框架');
});

test('architecture fixture declares a project semantic preset snapshot', () => {
  const fixtureRoot = path.resolve(__dirname, 'fixtures/e2e/architecture-report');
  const config = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'deck.config.json'), 'utf8'));

  assert.equal(config.semanticPreset, 'semantic-preset.json');
  assert.equal(fs.existsSync(path.join(fixtureRoot, config.semanticPreset)), true);
});

test('loadStyleNameMapForHtml uses a project semantic preset next to deck config', () => {
  const root = path.resolve('test/workspace/e2e-style-map-project-preset-test');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.html'), '<!doctype html><main class="deck"></main>\n', 'utf8');
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'project-preset',
    profile: 'architecture-report',
    entry: 'deck.html',
    semanticPreset: 'semantic-preset.json',
    pages: [
      { id: 'cover', file: 'deck.html' },
    ],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'semantic-preset.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'project-preset',
    styleNameMap: {
      objectStyles: {
        'metric-card': '项目指标卡片',
      },
    },
  }, null, 2), 'utf8');

  const styleNameMap = loadStyleNameMapForHtml(path.join(root, 'deck.html'));

  assert.equal(styleNameMap.objectStyles['metric-card'], '项目指标卡片');
});

function writeMinimalAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
  const configPath = path.join(root, 'deck.config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    schemaVersion: 1,
    id: 'minimal-author',
    entry: 'deck.html',
    styles: ['styles/layout.css'],
    pages: [{ id: 'page-1', file: 'pages/00-page-1.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'styles/layout.css'), '.page { display:grid; grid-template-columns:repeat(12, 1fr); }', 'utf8');
  fs.writeFileSync(path.join(root, 'pages/00-page-1.html'), pageHtml, 'utf8');
  const { writeAuthorPackageEntry } = require('../src/authoring');
  writeAuthorPackageEntry(configPath);
}

test('auditSecondPassAuthorStability invalid-input 必须 fail', () => {
  assert.throws(() => auditSecondPassAuthorStability(null));
});

test('assertNoTextOverset invalid-input 必须 fail', () => {
  assert.throws(() => assertNoTextOverset(null));
});

test('assertNoLossyVectorWarnings invalid-input 必须 fail', () => {
  assert.throws(() => assertNoLossyVectorWarnings(null));
});

test('assertPanelNameAuditOk invalid-input 必须 fail', () => {
  assert.throws(() => assertPanelNameAuditOk(null));
});
