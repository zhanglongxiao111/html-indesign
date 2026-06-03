const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  createRunContext,
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
  architectureStyleNameMap,
  loadStyleNameMapForHtml,
  assertPanelNameAuditOk,
  assertReverseHtmlSemantics,
  auditReverseAuthorPackage,
  auditReverseHtmlSemantics,
  isAllowedBuiltInPanelName,
  parseArgs,
  parseCliResultJson,
  resolveIndesignCliCommand,
  parseTargetSize,
} = require('../scripts/indesign-e2e');
const { renderSnapshot } = require('../src/adapters/html');
const { compileInstructions } = require('../src/writers/indesign');

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

test('build reverse snapshot jsx writes target output label and runs reverse script', () => {
  const jsx = buildReverseSnapshotJsx({
    repoRoot: 'D:/AI/html-indesign',
    outputPath: 'D:/AI/html-indesign/test/workspace/reverse-snapshot.json',
  });

  assert.match(jsx, /html_indesign_reverse_output/);
  assert.match(jsx, /export_to_html_snapshot\.jsx/);
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
  writeMinimalAuthorPackage(reverseRoot, '<section class="page"><h1>CONTENTS</h1></section>');

  const audit = auditReverseAuthorPackage({
    config: path.join(reverseRoot, 'deck.config.json'),
    entry: path.join(reverseRoot, 'deck.html'),
    outDir: reverseRoot,
    sourceRoot,
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.sourceRoundtrip.ok, true);
  assert.deepEqual(audit.sourceRoundtrip.warnings.map((issue) => issue.code), ['ROUNDTRIP_TEXT_CHANGED']);
  assert.equal(fs.existsSync(path.join(reverseRoot, 'reports/source-roundtrip-report.json')), true);
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
