const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const {
  renderSnapshot,
  compileInstructions,
  validateInstructions,
} = require('../src/paged-html');

function createRunContext(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '..'));
  const workspaceDir = path.resolve(options.workspaceDir || path.join(repoRoot, 'test/workspace'));
  const timestamp = options.timestamp || timestampFor(new Date());
  const runDir = path.resolve(options.runDir || path.join(workspaceDir, `indesign-e2e-${timestamp}`));
  const htmlPath = path.resolve(options.htmlPath || path.join(repoRoot, 'test/fixtures/e2e/architecture-report/deck.html'));
  return {
    repoRoot,
    workspaceDir,
    runDir,
    htmlPath,
    timestamp,
    defaultInstructionsPath: path.join(workspaceDir, 'instructions.json'),
    runInstructionsPath: path.join(runDir, 'instructions.json'),
    compileSummaryPath: path.join(runDir, 'compile-summary.json'),
    resultPath: path.join(runDir, 'e2e-result.json'),
    buildScriptPath: path.join(runDir, 'build-latest.jsx'),
    exportScriptPath: path.join(runDir, 'export-latest.jsx'),
    reverseScriptPath: path.join(runDir, 'reverse-snapshot.jsx'),
    reverseSnapshotPath: path.join(runDir, 'reverse-snapshot.json'),
    reverseOutDir: path.join(runDir, 'reverse-html'),
    previewDir: path.join(runDir, 'preview'),
  };
}

function timestampFor(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function parseArgs(argv, repoRoot) {
  const options = { repoRoot };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--html') {
      options.htmlPath = argv[++index];
    } else if (arg.startsWith('--html=')) {
      options.htmlPath = arg.slice('--html='.length);
    } else if (arg === '--run-dir') {
      options.runDir = argv[++index];
    } else if (arg.startsWith('--run-dir=')) {
      options.runDir = arg.slice('--run-dir='.length);
    } else if (arg === '--timestamp') {
      options.timestamp = argv[++index];
    } else if (arg.startsWith('--timestamp=')) {
      options.timestamp = arg.slice('--timestamp='.length);
    } else if (arg === '--target-size') {
      options.targetSize = argv[++index];
    } else if (arg.startsWith('--target-size=')) {
      options.targetSize = arg.slice('--target-size='.length);
    } else if (arg === '--unit-mode') {
      options.unitMode = argv[++index];
    } else if (arg.startsWith('--unit-mode=')) {
      options.unitMode = arg.slice('--unit-mode='.length);
    } else if (arg === '--skip-preview') {
      options.skipPreview = true;
    } else if (arg === '--reverse-roundtrip') {
      options.reverseRoundtrip = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  return [
    'Usage: node scripts/indesign-e2e.js [--html <deck.html>] [--target-size qhd|2560x1440|same] [--run-dir <dir>] [--skip-preview] [--reverse-roundtrip]',
    'npm: npm run e2e:indesign -- -- --target-size qhd --reverse-roundtrip',
    '',
    'Default HTML: test/fixtures/e2e/architecture-report/deck.html',
    'Default unit mode: presentation',
    'Default target size: same as captured browser source pixels',
    'Default output: test/workspace/indesign-e2e-<timestamp>/',
  ].join('\n');
}

async function runIndesignE2E(options = {}) {
  const context = createRunContext(options);
  fs.mkdirSync(context.runDir, { recursive: true });

  const compileSummary = await compileToInstructions(context, options);
  const health = runCli(['--json', '--pretty', 'server', 'health'], context.repoRoot);
  const healthJson = JSON.parse(health.stdout);
  if (!healthJson.ok || healthJson.tool_success === false) {
    throw new Error(`${resolveIndesignCliCommand()} health failed: ${health.stdout || health.stderr}`);
  }

  fs.writeFileSync(context.buildScriptPath, buildBuildJsx({
    repoRoot: context.repoRoot,
    instructionsPath: context.runInstructionsPath,
  }), 'utf8');

  const buildCli = runCli(['--json', '--pretty', 'script', 'run', context.buildScriptPath], context.repoRoot);
  const buildResult = parseCliResultJson(buildCli.stdout);
  assertCliResultOk(buildResult, 'InDesign build failed');

  fs.writeFileSync(context.exportScriptPath, buildExportJsx({
    runDir: context.runDir,
    closeDocument: !options.reverseRoundtrip,
  }), 'utf8');

  const exportCli = runCli(['--json', '--pretty', 'script', 'run', context.exportScriptPath], context.repoRoot);
  const exportResult = parseCliResultJson(exportCli.stdout);
  assertCliResultOk(exportResult, 'InDesign export failed');
  assertPanelNameAuditOk(exportResult);

  const pdfPath = exportResult.outputs && exportResult.outputs.pdf;
  if (!pdfPath) throw new Error('InDesign export did not report a PDF path.');

  const verifyCli = runCli(['--json', '--pretty', 'export', 'verify', pdfPath], context.repoRoot);
  const verifyResult = JSON.parse(verifyCli.stdout);
  if (!verifyResult.ok || !verifyResult.data || verifyResult.data.signature_ok !== true) {
    throw new Error(`PDF verification failed: ${verifyCli.stdout}`);
  }

  const reverse = options.reverseRoundtrip
    ? await runReverseRoundtrip(context)
    : null;

  const preview = options.skipPreview
    ? { skipped: true }
    : await renderPdfPreview(context, pdfPath);

  const result = {
    ok: true,
    runDir: context.runDir,
    htmlPath: context.htmlPath,
    instructionsPath: context.runInstructionsPath,
    compile: compileSummary,
    build: buildResult,
    export: exportResult,
    verify: verifyResult.data,
    reverse,
    preview,
  };
  fs.writeFileSync(context.resultPath, JSON.stringify(result, null, 2), 'utf8');
  return result;
}

async function compileToInstructions(context, options = {}) {
  const snapshot = await renderSnapshot({ htmlPath: context.htmlPath });
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: options.unitMode || 'presentation',
    targetSize: options.targetSize || 'same',
    styleNameMap: options.styleNameMap || architectureStyleNameMap(),
  });
  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: path.dirname(context.htmlPath),
  });
  if (!validation.valid) {
    const error = new Error('Compiled instructions failed validation.');
    error.validation = validation;
    throw error;
  }

  fs.mkdirSync(context.workspaceDir, { recursive: true });
  fs.mkdirSync(context.runDir, { recursive: true });
  const json = JSON.stringify(instructions, null, 2);
  fs.writeFileSync(context.defaultInstructionsPath, json, 'utf8');
  fs.writeFileSync(context.runInstructionsPath, json, 'utf8');

  const summary = {
    ok: true,
    htmlPath: context.htmlPath,
    pages: instructions.pages.length,
    unitMode: instructions.document.unitMode,
    coordinateUnit: instructions.document.coordinateUnit,
    targetSize: instructions.document.pages[0] ? {
      width: instructions.document.pages[0].width,
      height: instructions.document.pages[0].height,
    } : null,
    items: instructions.pages.reduce((sum, page) => sum + (page.items || []).length, 0),
    assets: (instructions.assets || []).length,
    fonts: Object.keys(instructions.styles.fonts || {}),
    styleCounts: {
      swatches: Object.keys(instructions.styles.swatches || {}).length,
      paragraphStyles: Object.keys(instructions.styles.paragraphStyles || {}).length,
      characterStyles: Object.keys(instructions.styles.characterStyles || {}).length,
      objectStyles: Object.keys(instructions.styles.objectStyles || {}).length,
      frameStyles: Object.keys(instructions.styles.frameStyles || {}).length,
      tableStyles: Object.keys(instructions.styles.tableStyles || {}).length,
    },
  };
  fs.writeFileSync(context.compileSummaryPath, JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

function parseTargetSize(value) {
  if (!value || value === 'same' || value === 'source') return null;
  const presets = {
    fhd: { width: 1920, height: 1080 },
    qhd: { width: 2560, height: 1440 },
    uhd: { width: 3840, height: 2160 },
    'dci-2k': { width: 2048, height: 1080 },
  };
  const key = String(value).toLowerCase();
  if (presets[key]) return { ...presets[key], name: key };
  const match = key.match(/^(\d+)x(\d+)$/);
  if (match) return { width: Number(match[1]), height: Number(match[2]), name: key };
  throw new Error(`Unsupported target size: ${value}`);
}

function architectureStyleNameMap() {
  return {
    layers: {
      background: '背景',
      image: '图片',
      drawing: '图纸',
      graphics: '图形',
      content: '内容',
      overlay: '遮罩',
      tables: '表格',
      text: '文字',
      annotation: '标注',
      annotations: '标注组',
    },
    paragraphStyles: {
      'deck-eyebrow': '页眉小标',
      'cover-title': '封面标题',
      'cover-subtitle': '封面副标题',
      'metric-value': '指标数字',
      'metric-label': '指标说明',
      folio: '页码',
      'page-title': '页面标题',
      'body-copy': '正文',
      'chapter-title': '章节标题',
      'chapter-body': '章节正文',
      caption: '图注',
      'legend-label': '图例文字',
      'strategy-title': '策略标题',
      'strategy-body': '策略正文',
      'table-heading': '表头文字',
      'table-body': '表格正文',
      annotation: '标注文字',
    },
    characterStyles: {
      'cover-accent': '封面强调',
      'term-accent': '术语强调',
      'layer-accent': '图层强调',
      'asset-accent': '资产强调',
    },
    objectStyles: {
      'hero-image': '封面图像',
      'cover-veil': '封面渐变遮罩',
      'metric-card': '指标卡片',
      'chapter-card': '章节卡片',
      'timeline-line': '时间轴线',
      'annotation-dot': '标注圆点',
      'map-frame': '总图图框',
      'annotation-line': '标注引线',
      'annotation-label': '标注标签',
      'legend-block': '图例框',
      'image-frame': '图片图框',
      'diagram-frame-object': '图解对象',
      'strategy-card': '策略卡片',
      'drawing-frame-object': '图纸图框',
      'material-frame-object': '材料图框',
      'facade-frame-object': '平面图框',
      'material-note-panel': '说明面板',
      'table-frame': '表格框',
      swatch: '色块',
    },
    frameStyles: {
      'hero-frame': '封面图片框架',
      'veil-frame': '封面遮罩框架',
      'metric-card-frame': '指标卡片文本框架',
      'chapter-frame': '章节卡片文本框架',
      'line-frame': '线条框架',
      'dot-frame': '圆点框架',
      'annotation-frame': '标注文本框架',
      'legend-frame': '图例文本框架',
      'swatch-frame': '色块框架',
      'strategy-card-frame': '策略卡片文本框架',
      'panel-frame': '面板框架',
      'context-map-frame': '总图框架',
      'render-frame-cover': '渲染图裁切框架',
      'section-frame': '剖面图框架',
      'diagram-frame': '图解框架',
      'drawing-frame': '图纸框架',
      'material-frame': '材料框架',
      'facade-frame': '平面图框架',
      'grid-frame': '网格图片框架',
      'panel-frame': '面板框架',
    },
    tableStyles: {
      'area-table': '面积指标表',
    },
  };
}

function runCli(args, cwd) {
  return runCommand(resolveIndesignCliCommand(), args, cwd);
}

function resolveIndesignCliCommand(env = process.env) {
  const explicit = env.INDESIGN_CLI_BIN;
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  return 'indesign-cli';
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = [
      `${command} ${args.join(' ')} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n');
    throw new Error(message);
  }
  return result;
}

function parseCliResultJson(stdout) {
  const parsed = JSON.parse(stdout);
  if (parsed && parsed.data && parsed.data.result_json) return parsed.data.result_json;
  if (parsed && parsed.data && parsed.data.parsed && parsed.data.parsed.result) {
    return JSON.parse(parsed.data.parsed.result);
  }
  if (parsed && parsed.data) return parsed.data;
  return parsed;
}

function assertCliResultOk(result, message) {
  if (!result || result.ok === false || (Array.isArray(result.errors) && result.errors.length > 0)) {
    throw new Error(`${message}: ${JSON.stringify(result, null, 2)}`);
  }
}

function assertPanelNameAuditOk(result) {
  const asciiNames = (result && result.audit && result.audit.panelAsciiNames || [])
    .filter((entry) => !isAllowedBuiltInPanelName(entry.kind, entry.name));
  if (Array.isArray(asciiNames) && asciiNames.length > 0) {
    throw new Error(`InDesign panel names still contain English tokens: ${JSON.stringify(asciiNames, null, 2)}`);
  }
}

function isAllowedBuiltInPanelName(kind, name) {
  return kind === 'swatches' && ['None', 'Registration', 'Paper', 'Black'].includes(String(name));
}

function buildBuildJsx({ repoRoot, instructionsPath }) {
  const base = toJsxPath(repoRoot);
  const instructions = toJsxPath(instructionsPath);
  return `(function () {
    var base = ${JSON.stringify(base)};
    function includeLib(name) {
        var lib = File(base + "/_indesign_scripts/lib/" + name);
        if (!lib.exists) throw new Error("Missing executor lib: " + lib.fsName);
        $.evalFile(lib);
    }

    includeLib("hi_core.jsxinc");
    includeLib("hi_labels.jsxinc");
    includeLib("hi_document.jsxinc");
    includeLib("hi_fonts.jsxinc");
    includeLib("hi_styles.jsxinc");
    includeLib("hi_assets.jsxinc");
    includeLib("hi_tables.jsxinc");
    includeLib("hi_items.jsxinc");
    includeLib("hi_executor.jsxinc");

    var marker = "html-indesign-indesign-e2e";
    var doc = app.documents.add();
    doc.insertLabel("html_indesign_e2e_marker", marker);
    var report = HI.runBuildFromInstructions(app, ${JSON.stringify(instructions)});
    doc.insertLabel("html_indesign_e2e_report", JSON.stringify(report));

    return JSON.stringify({
        ok: report.ok !== false,
        marker: marker,
        pageCount: doc.pages.length,
        counts: report.counts,
        errors: report.errors,
        warnings: report.warnings
    });
})();`;
}

function buildExportJsx({ runDir, closeDocument = true }) {
  const outDir = toJsxPath(runDir);
  const closeBlock = closeDocument ? `
    try {
        doc.close(SaveOptions.NO);
        result.closed = true;
    } catch (closeError) {
        add("warning", "DOC_CLOSE_FAILED", String(closeError));
    }
` : `
    result.closed = false;
`;
  return `(function () {
    var runDir = ${JSON.stringify(outDir)};
    var result = { ok: true, outputs: {}, counts: {}, errors: [], warnings: [] };

    function add(level, code, message) {
        result[level === "error" ? "errors" : "warnings"].push({ code: code, message: message });
        if (level === "error") result.ok = false;
    }

    if (app.documents.length < 1) {
        add("error", "NO_ACTIVE_DOCUMENT", "No active document to export.");
        return JSON.stringify(result);
    }

    var doc = app.activeDocument;
    var indd = File(runDir + "/architecture-report-indesign.indd");
    var pdf = File(runDir + "/architecture-report-indesign.pdf");
    var idml = File(runDir + "/architecture-report-indesign.idml");

    function auditCollection(kind, collection) {
        result.audit.panelNames[kind] = [];
        try {
            var items = collection.everyItem().getElements();
            for (var i = 0; i < items.length; i++) {
                var name = String(items[i].name || "");
                result.audit.panelNames[kind].push(name);
                if (/[A-Za-z]/.test(name) && !isAllowedBuiltInPanelName(kind, name)) {
                    result.audit.panelAsciiNames.push({ kind: kind, name: name });
                }
            }
        } catch (error) {
            add("warning", "PANEL_AUDIT_FAILED", kind + ": " + String(error));
        }
    }

    function isAllowedBuiltInPanelName(kind, name) {
        return kind === "swatches" && /^(None|Registration|Paper|Black)$/.test(String(name));
    }

    function auditPanelNames() {
        result.audit = { panelAsciiNames: [], panelNames: {} };
        auditCollection("layers", doc.layers);
        auditCollection("swatches", doc.swatches);
        auditCollection("paragraphStyles", doc.paragraphStyles);
        auditCollection("characterStyles", doc.characterStyles);
        auditCollection("objectStyles", doc.objectStyles);
        auditCollection("tableStyles", doc.tableStyles);
        auditCollection("cellStyles", doc.cellStyles);
    }

    try {
        doc.save(indd);
        result.outputs.indd = indd.fsName;
    } catch (error) {
        add("error", "INDD_SAVE_FAILED", String(error));
    }

    try {
        doc.exportFile(ExportFormat.PDF_TYPE, pdf, false);
        result.outputs.pdf = pdf.fsName;
    } catch (error2) {
        add("error", "PDF_EXPORT_FAILED", String(error2));
    }

    try {
        doc.exportFile(ExportFormat.INDESIGN_MARKUP, idml, false);
        result.outputs.idml = idml.fsName;
    } catch (error3) {
        add("warning", "IDML_EXPORT_FAILED", String(error3));
    }

    try {
        result.counts.pages = doc.pages.length;
        result.counts.links = doc.links.length;
        result.counts.pageItems = doc.pageItems.length;
        result.counts.textFrames = doc.textFrames.length;
        result.counts.rectangles = doc.rectangles.length;
        result.counts.graphicLines = doc.graphicLines.length;
        result.counts.tables = doc.stories.everyItem().tables.length;
    } catch (countError) {
        add("warning", "COUNT_FAILED", String(countError));
    }

    try {
        var overset = 0;
        var frames = doc.textFrames.everyItem().getElements();
        for (var i = 0; i < frames.length; i++) {
            if (frames[i].overflows) overset += 1;
        }
        result.counts.oversetTextFrames = overset;
    } catch (oversetError) {
        add("warning", "OVERSET_COUNT_FAILED", String(oversetError));
    }

    auditPanelNames();

${closeBlock}

    return JSON.stringify(result);
})();`;
}

function buildReverseSnapshotJsx({ repoRoot, outputPath, closeDocument = true }) {
  const base = toJsxPath(repoRoot);
  const output = toJsxPath(outputPath);
  const closeBlock = closeDocument ? `
    try {
        if (app.documents.length > 0) app.activeDocument.close(SaveOptions.NO);
        result.closed = true;
    } catch (closeError) {
        result.warnings.push({ code: "DOC_CLOSE_FAILED", message: String(closeError) });
        if (result.ok !== false) result.ok = true;
    }
` : '';
  return `(function () {
    var result = { ok: false, outputPath: ${JSON.stringify(output)}, errors: [], warnings: [] };
    try {
        app.insertLabel("html_indesign_reverse_output", ${JSON.stringify(output)});
        var raw = $.evalFile(File(${JSON.stringify(base + "/_indesign_scripts/export_to_html_snapshot.jsx")}));
        if (!raw) throw new Error("Reverse snapshot script returned an empty result.");
        result = JSON.parse(String(raw));
        if (!result) throw new Error("Reverse snapshot script returned invalid JSON.");
        if (!result.errors) result.errors = [];
        if (!result.warnings) result.warnings = [];
    } catch (error) {
        if (!result.errors) result.errors = [];
        if (!result.warnings) result.warnings = [];
        result.ok = false;
        result.errors.push({ code: "REVERSE_SNAPSHOT_FAILED", message: String(error) });
    } finally {
        app.insertLabel("html_indesign_reverse_output", "");
    }
${closeBlock}
    return JSON.stringify(result);
})();`;
}

async function runReverseRoundtrip(context) {
  fs.writeFileSync(context.reverseScriptPath, buildReverseSnapshotJsx({
    repoRoot: context.repoRoot,
    outputPath: context.reverseSnapshotPath,
  }), 'utf8');

  const reverseCli = runCli(['--json', '--pretty', 'script', 'run', context.reverseScriptPath], context.repoRoot);
  const reverseResult = parseCliResultJson(reverseCli.stdout);
  assertCliResultOk(reverseResult, 'InDesign reverse snapshot failed');

  const { compileReverseSnapshotToHtml } = require('./indesign-reverse-export');
  const htmlResult = compileReverseSnapshotToHtml({
    snapshotPath: context.reverseSnapshotPath,
    outDir: context.reverseOutDir,
    mode: 'structured',
  });

  return {
    snapshot: reverseResult,
    html: htmlResult,
  };
}

async function renderPdfPreview(context, pdfPath) {
  fs.mkdirSync(context.previewDir, { recursive: true });
  const prefix = path.join(context.previewDir, 'page');
  const render = spawnSync('pdftoppm', ['-png', '-r', '96', pdfPath, prefix], {
    cwd: context.repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (render.error || render.status !== 0) {
    return {
      ok: false,
      warning: 'pdftoppm failed; PDF was exported but PNG preview was not generated.',
      stderr: render.stderr || String(render.error || ''),
    };
  }

  const pages = fs.readdirSync(context.previewDir)
    .filter((name) => /^page-\d+\.png$/i.test(name))
    .sort((a, b) => pageNumber(a) - pageNumber(b));
  const htmlPath = path.join(context.previewDir, 'contact-sheet.html');
  const pngPath = path.join(context.runDir, 'architecture-report-indesign-contact-sheet.png');
  fs.writeFileSync(htmlPath, contactSheetHtml(pages), 'utf8');

  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 1800 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href);
    await page.screenshot({ path: pngPath, fullPage: true });
    await browser.close();
  } catch (error) {
    return {
      ok: false,
      pages: pages.map((name) => path.join(context.previewDir, name)),
      html: htmlPath,
      warning: `Playwright contact sheet screenshot failed: ${String(error)}`,
    };
  }

  return {
    ok: true,
    pages: pages.map((name) => path.join(context.previewDir, name)),
    html: htmlPath,
    image: pngPath,
  };
}

function contactSheetHtml(pages) {
  const images = pages.map((name, index) => (
    `<figure><figcaption>Page ${index + 1}</figcaption><img src="./${escapeHtml(name)}" alt="Page ${index + 1}"></figure>`
  )).join('\n');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>InDesign E2E Contact Sheet</title>
  <style>
    body { margin: 24px; background: #eeeeee; font: 13px Arial, sans-serif; color: #222222; }
    main { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
    figure { margin: 0; padding: 10px; background: #ffffff; border: 1px solid #bcbcbc; }
    figcaption { margin: 0 0 8px; }
    img { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
  <main>
${images}
  </main>
</body>
</html>
`;
}

function pageNumber(name) {
  const match = String(name).match(/page-(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toJsxPath(value) {
  return path.resolve(value).replace(/\\/g, '/');
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const options = parseArgs(process.argv.slice(2), repoRoot);
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await runIndesignE2E(options);
  console.log(JSON.stringify({
    ok: result.ok,
    runDir: result.runDir,
    pages: result.compile.pages,
    unitMode: result.compile.unitMode,
    coordinateUnit: result.compile.coordinateUnit,
    targetSize: result.compile.targetSize,
    items: result.compile.items,
    assets: result.compile.assets,
    counts: result.export.counts,
    outputs: result.export.outputs,
    preview: result.preview,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    if (error.validation) console.error(JSON.stringify(error.validation, null, 2));
    else console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  createRunContext,
  buildBuildJsx,
  buildExportJsx,
  buildReverseSnapshotJsx,
  architectureStyleNameMap,
  parseCliResultJson,
  resolveIndesignCliCommand,
  parseArgs,
  parseTargetSize,
  assertPanelNameAuditOk,
  isAllowedBuiltInPanelName,
  runIndesignE2E,
};
