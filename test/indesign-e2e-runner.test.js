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
  assertPanelNameAuditOk,
  isAllowedBuiltInPanelName,
  parseArgs,
  parseCliResultJson,
  resolveIndesignCliCommand,
  parseTargetSize,
} = require('../scripts/indesign-e2e');
const { renderSnapshot, compileInstructions } = require('../src/paged-html');

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
