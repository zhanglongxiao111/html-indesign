const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const { renderSnapshot } = require('../src/adapters/html');
const hostJsx = require('../src/indesign-cli-plugin/host-jsx');
const { compileInstructions } = require('../src/indesign-pipeline');
const { validateInstructions } = require('../src/writers/indesign');
const { readAuthorPackage } = require('../src/authoring');
const { resolveSemanticPreset, presetToStyleNameMap } = require('../src/semantic-preset');
const {
  assertPanelNameAuditOk,
  observedPanelNamesForHtml,
  assertNoTextOverset,
} = require('../src/writers/indesign/audit/e2e-result-audit');
const {
  auditReverseHtmlSemantics,
  assertReverseHtmlSemantics,
  auditSecondPassAuthorStability,
} = require('../src/writers/html/audit/reverse-roundtrip');

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
    } else if (arg === '--reverse-mode') {
      options.reverseMode = parseReverseMode(argv[++index]);
    } else if (arg.startsWith('--reverse-mode=')) {
      options.reverseMode = parseReverseMode(arg.slice('--reverse-mode='.length));
    } else if (arg === '--second-pass-roundtrip') {
      options.secondPassRoundtrip = true;
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
    'Usage: node scripts/indesign-e2e.js [--html <deck.html>] [--target-size qhd|2560x1440|same] [--run-dir <dir>] [--skip-preview] [--reverse-roundtrip] [--reverse-mode structured|inferred|observation] [--second-pass-roundtrip]',
    'npm: npm run e2e:indesign -- -- --target-size qhd --reverse-roundtrip --second-pass-roundtrip',
    '',
    'Default HTML: test/fixtures/e2e/architecture-report/deck.html',
    'Default unit mode: presentation',
    'Default target size: same as captured browser source pixels',
    'Default output: test/workspace/indesign-e2e-<timestamp>/',
  ].join('\n');
}

function parseReverseMode(value) {
  const mode = String(value || '').trim();
  if (['structured', 'inferred', 'observation'].includes(mode)) return mode;
  throw new Error(`Unsupported reverse mode: ${value}`);
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
  assertNoTextOverset(buildResult);

  fs.writeFileSync(context.exportScriptPath, buildExportJsx({
    runDir: context.runDir,
    closeDocument: !options.reverseRoundtrip,
  }), 'utf8');

  const exportCli = runCli(['--json', '--pretty', 'script', 'run', context.exportScriptPath], context.repoRoot);
  const exportResult = parseCliResultJson(exportCli.stdout);
  assertCliResultOk(exportResult, 'InDesign export failed');
  assertPanelNameAuditOk(exportResult, {
    allowedPanelNames: observedPanelNamesForHtml(context.htmlPath),
  });

  const pdfPath = exportResult.outputs && exportResult.outputs.pdf;
  if (!pdfPath) throw new Error('InDesign export did not report a PDF path.');

  const verifyCli = runCli(['--json', '--pretty', 'export', 'verify', pdfPath], context.repoRoot);
  const verifyResult = JSON.parse(verifyCli.stdout);
  if (!verifyResult.ok || !verifyResult.data || verifyResult.data.signature_ok !== true) {
    throw new Error(`PDF verification failed: ${verifyCli.stdout}`);
  }

  const reverse = options.reverseRoundtrip
    ? await runReverseRoundtrip(context, options)
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
  const observedPanelNames = observedPanelNamesForHtml(context.htmlPath);
  const instructions = compileInstructions(snapshot, {
    mode: 'editable-first',
    unitMode: options.unitMode || 'presentation',
    targetSize: options.targetSize || 'same',
    styleNameMap: loadStyleNameMapForHtml(context.htmlPath, options),
    preserveObservedLayerNames: observedPanelNames.length > 0,
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
  const resolved = resolveSemanticPreset({ profile: 'architecture-report' });
  return presetToStyleNameMap(resolved.preset);
}

function loadStyleNameMapForHtml(htmlPath, options = {}) {
  if (options.styleNameMap) return options.styleNameMap;

  const packageInfo = findAuthorPackageForHtml(htmlPath);
  if (packageInfo) {
    const resolved = resolveSemanticPreset({
      rootDir: packageInfo.rootDir,
      config: packageInfo.config,
    });
    return presetToStyleNameMap(resolved.preset);
  }

  return architectureStyleNameMap();
}

function findAuthorPackageForHtml(htmlPath) {
  const dir = path.dirname(path.resolve(htmlPath));
  const configPath = path.join(dir, 'deck.config.json');
  if (!fs.existsSync(configPath)) return null;
  return readAuthorPackage(configPath);
}

function resolveReverseSourceRootForHtml(htmlPath, options = {}) {
  if (options.sourceRoot) return path.resolve(options.sourceRoot);

  const packageInfo = findAuthorPackageForHtml(htmlPath);
  if (!packageInfo) return null;

  const resolvedHtmlPath = path.resolve(htmlPath);
  return path.resolve(packageInfo.entryPath) === resolvedHtmlPath
    ? packageInfo.rootDir
    : null;
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
  if (parsed && parsed.data && parsed.data.parsed && typeof parsed.data.parsed === 'object') {
    return parsed.data.parsed;
  }
  if (parsed && parsed.data) return parsed.data;
  return parsed;
}

function assertCliResultOk(result, message) {
  if (!result || result.ok === false || (Array.isArray(result.errors) && result.errors.length > 0)) {
    throw new Error(`${message}: ${JSON.stringify(result, null, 2)}`);
  }
}

function buildBuildJsx({ repoRoot, instructionsPath }) {
  return hostJsx.buildBuildJsx({ repoRoot, instructionsPath });
}

function buildExportJsx(options) {
  return hostJsx.buildExportJsx(options);
}

function buildReverseSnapshotJsx(options) {
  return hostJsx.buildReverseSnapshotJsx(options);
}

async function runReverseRoundtrip(context, options = {}) {
  const reverseMode = options.reverseMode || 'structured';
  fs.writeFileSync(context.reverseScriptPath, buildReverseSnapshotJsx({
    repoRoot: context.repoRoot,
    outputPath: context.reverseSnapshotPath,
  }), 'utf8');

  const reverseCli = runCli(['--json', '--pretty', 'script', 'run', context.reverseScriptPath], context.repoRoot);
  const reverseResult = parseCliResultJson(reverseCli.stdout);
  assertCliResultOk(reverseResult, 'InDesign reverse snapshot failed');

  const { compileReverseSnapshotToHtml } = require('./indesign-reverse-export');
  const sourceRoot = resolveReverseSourceRootForHtml(context.htmlPath, options);
  const reverseCompileOptions = {
    snapshotPath: context.reverseSnapshotPath,
    outDir: context.reverseOutDir,
    mode: reverseMode,
  };
  if (sourceRoot) {
    reverseCompileOptions.sourceRoot = sourceRoot;
    reverseCompileOptions.strictSourceRoundtrip = true;
  }
  const htmlResult = compileReverseSnapshotToHtml(reverseCompileOptions);
  const reverseHtmlPath = path.join(context.reverseOutDir, 'deck.html');
  const reverseHtml = fs.readFileSync(reverseHtmlPath, 'utf8');
  const htmlAudit = reverseMode === 'observation'
    ? auditReverseHtmlSemantics(reverseHtml)
    : assertReverseHtmlSemantics(reverseHtml, reverseHtmlPath);
  const authorAudit = htmlResult.files && htmlResult.files.author && htmlResult.files.author.audit;
  if (!authorAudit || !authorAudit.ok) {
    throw new Error(`Reverse author package audit failed: ${JSON.stringify(authorAudit, null, 2)}`);
  }
  const author = Object.assign({}, htmlResult.files.author, { audit: authorAudit });
  let secondPass = null;
  let canonicalDrift = null;
  let canonicalStability = null;
  if (options.secondPassRoundtrip) {
    secondPass = await runIndesignE2E({
      repoRoot: context.repoRoot,
      workspaceDir: context.workspaceDir,
      runDir: path.join(context.runDir, 'second-pass'),
      htmlPath: htmlResult.files.author.entry,
      targetSize: options.targetSize,
      unitMode: options.unitMode,
      skipPreview: true,
      reverseRoundtrip: true,
      secondPassRoundtrip: false,
      reverseMode,
      styleNameMap: options.styleNameMap,
    })
    const reportDir = path.join(htmlResult.files.author.outDir, 'reports');
    canonicalStability = auditSecondPassAuthorStability({
      sourceRoot: htmlResult.files.author.outDir,
      reverseRoot: secondPass.reverse && secondPass.reverse.author && secondPass.reverse.author.outDir,
      reportDir,
    });
    canonicalDrift = canonicalStability.sourceDrift;
    if (!canonicalStability.ok) {
      throw new Error(`Second-pass reverse author package lost content or structure: ${JSON.stringify(canonicalStability, null, 2)}`);
    }
  }

  return {
    snapshot: reverseResult,
    html: {
      ...htmlResult,
      audit: htmlAudit,
    },
    author,
    secondPass,
    canonicalDrift,
    canonicalStability,
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
  loadStyleNameMapForHtml,
  parseCliResultJson,
  resolveIndesignCliCommand,
  parseArgs,
  parseTargetSize,
  runIndesignE2E,
  resolveReverseSourceRootForHtml,
};
