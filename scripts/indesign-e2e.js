const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const { renderSnapshot } = require('../src/adapters/html');
const hostJsx = require('../src/indesign-cli-plugin/host-jsx');
const {
  compileInstructions,
  validateInstructions,
} = require('../src/writers/indesign');
const { readAuthorPackage } = require('../src/authoring');
const { resolveSemanticPreset, presetToStyleNameMap } = require('../src/semantic-preset');

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

function assertPanelNameAuditOk(result, options = {}) {
  const allowed = panelNameSet(options.allowedPanelNames || []);
  const asciiNames = (result && result.audit && result.audit.panelAsciiNames || [])
    .filter((entry) => !isAllowedBuiltInPanelName(entry.kind, entry.name))
    .filter((entry) => !allowed.has(panelNameKey(entry.kind, entry.name)));
  if (Array.isArray(asciiNames) && asciiNames.length > 0) {
    throw new Error(`InDesign panel names still contain English tokens: ${JSON.stringify(asciiNames, null, 2)}`);
  }
}

function observedPanelNamesForHtml(htmlPath) {
  const html = readTextIfExists(htmlPath);
  if (!/\bdata-id-reverse-mode\s*=\s*["']observation["']/i.test(html)
    && !/\bdata-id-observed\s*=\s*["']true["']/i.test(html)) {
    return [];
  }
  const names = [];
  const seen = new Set();
  const pattern = /\bdata-id-layer\s*=\s*(["'])(.*?)\1/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const name = htmlAttrText(match[2]);
    if (!name) continue;
    const key = panelNameKey('layers', name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push({ kind: 'layers', name });
  }
  return names;
}

function panelNameSet(entries) {
  const out = new Set();
  for (const entry of entries || []) {
    if (!entry || !entry.kind || !entry.name) continue;
    out.add(panelNameKey(entry.kind, entry.name));
  }
  return out;
}

function panelNameKey(kind, name) {
  return `${String(kind || '')}\u0000${String(name || '')}`;
}

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return '';
  }
}

function htmlAttrText(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function assertNoTextOverset(result) {
  const count = Number(result && result.counts && result.counts.oversetTextFrames || 0);
  const directFrames = result && Array.isArray(result.oversetTextFrames) ? result.oversetTextFrames : [];
  const messages = [
    ...(result && result.messages || []),
    ...(result && result.warnings || []),
  ]
    .filter((message) => message && (message.code === 'TEXT_OVERSET' || message.code === 'TABLE_FRAME_OVERSET'));
  const frames = directFrames.length
    ? directFrames
    : messages.map((message) => message.details).filter(Boolean);
  if (count <= 0 && frames.length === 0 && messages.length === 0) return;
  const error = new Error(`InDesign text frames are overset: ${JSON.stringify({
    count,
    frames,
    messages,
  }, null, 2)}`);
  error.oversetTextFrames = frames;
  error.oversetMessages = messages;
  throw error;
}

function auditReverseHtmlSemantics(html) {
  const text = String(html || '');
  const counts = {
    dataPage: attributeCount(text, 'data-page'),
    parentPage: attributeCount(text, 'data-id-parent-page'),
    layout: attributeCount(text, 'data-id-layout'),
    semantic: attributeCount(text, 'data-id-semantic'),
  };
  const missing = [];
  if (counts.dataPage === 0) missing.push('data-page');
  if (counts.parentPage === 0) missing.push('data-id-parent-page');
  if (counts.layout === 0) missing.push('data-id-layout');
  if (counts.semantic === 0) missing.push('data-id-semantic');
  return {
    ok: missing.length === 0,
    counts,
    missing,
  };
}

function assertReverseHtmlSemantics(html, source = 'reverse HTML') {
  const audit = auditReverseHtmlSemantics(html);
  if (!audit.ok) {
    throw new Error(`${source} is missing required bidirectional semantic tags: ${audit.missing.join(', ')}`);
  }
  return audit;
}

function auditReverseAuthorPackage(author) {
  if (!author || !author.config || !fs.existsSync(author.config)) {
    return { ok: false, missing: ['author/deck.config.json'] };
  }
  const { checkAuthorPackageEntry } = require('../src/authoring');
  const { auditReverseAuthorPackage: auditEditableAuthorPackage } = require('../src/writers/html/audit/author-audit');
  const { auditAuthorSourceRoundtrip } = require('../src/writers/html/audit/source-roundtrip-diff');
  const { authorPackageContentInventory, compareContentInventories } = require('../src/writers/html/audit/content-inventory');
  const { authorPackageStructureSignature, compareStructureSignatures } = require('../src/writers/html/audit/structure-signature');
  let check;
  try {
    check = checkAuthorPackageEntry(author.config);
  } catch (error) {
    return {
      ok: false,
      config: author.config,
      error: error && error.message ? error.message : String(error),
    };
  }
  const config = JSON.parse(fs.readFileSync(author.config, 'utf8'));
  const pageFiles = (config.pages || []).map((page) => path.join(path.dirname(author.config), page.file));
  const missingPages = pageFiles.filter((file) => !fs.existsSync(file));
  const outDir = author.outDir || path.dirname(author.config);
  const editable = auditEditableAuthorPackage(outDir);
  const sourceRoundtrip = author.sourceRoot
    ? auditAuthorSourceRoundtrip({
      sourceRoot: author.sourceRoot,
      reverseRoot: outDir,
      strict: !!author.strictSourceRoundtrip,
      includeSourceDrift: true,
    })
    : null;
  if (sourceRoundtrip) {
    const reportDir = path.join(outDir, 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'source-roundtrip-report.json'), JSON.stringify(sourceRoundtrip, null, 2), 'utf8');
  }
  let contentInventory = null;
  let structureSignature = null;
  if (author.sourceRoot) {
    const reportDir = path.join(outDir, 'reports');
    fs.mkdirSync(reportDir, { recursive: true });
    contentInventory = compareContentInventories(
      authorPackageContentInventory(author.sourceRoot),
      authorPackageContentInventory(outDir),
      { strictGeometry: false },
    );
    structureSignature = compareStructureSignatures(
      authorPackageStructureSignature(author.sourceRoot),
      authorPackageStructureSignature(outDir),
    );
    fs.writeFileSync(path.join(reportDir, 'content-inventory-report.json'), JSON.stringify(contentInventory, null, 2), 'utf8');
    fs.writeFileSync(path.join(reportDir, 'structure-signature-report.json'), JSON.stringify(structureSignature, null, 2), 'utf8');
  }
  const contentOk = contentInventory ? contentInventory.ok : true;
  const strictStructureSignature = !!author.strictStructureSignature;
  const structureOk = structureSignature ? (structureSignature.ok || !strictStructureSignature) : true;
  const sourceRoundtripAdvisoryWarnings = sourceRoundtrip && !sourceRoundtrip.ok
    ? [{
      code: 'SOURCE_ROUNDTRIP_DIFF_ADVISORY',
      severity: 'warning',
      message: 'Source exact diff changed but content inventory and structure signature remain the hard integrity gates.',
      errorCount: (sourceRoundtrip.errors || []).length,
      report: 'reports/source-roundtrip-report.json',
    }]
    : [];
  const structureSignatureAdvisoryWarnings = structureSignature && !structureSignature.ok && !strictStructureSignature
    ? [{
      code: 'STRUCTURE_SIGNATURE_DIFF_ADVISORY',
      severity: 'warning',
      message: 'Source author structure changed; first-pass structure signature is recorded as advisory and second-pass canonical drift remains the hard stability gate.',
      errorCount: (structureSignature.errors || []).length,
      report: 'reports/structure-signature-report.json',
    }]
    : [];
  return {
    ok: check.ok && missingPages.length === 0 && editable.ok && contentOk && structureOk,
    config: author.config,
    entry: check.entryPath,
    pages: pageFiles.length,
    missingPages,
    editable,
    sourceRoundtrip,
    contentInventory,
    structureSignature,
    errors: [
      ...(editable.errors || []),
      ...(contentInventory && !contentInventory.ok ? contentInventory.errors : []),
      ...(structureSignature && !structureSignature.ok && strictStructureSignature ? structureSignature.errors : []),
    ],
    warnings: [
      ...(editable.warnings || []),
      ...sourceRoundtripAdvisoryWarnings,
      ...structureSignatureAdvisoryWarnings,
      ...(sourceRoundtrip ? sourceRoundtrip.warnings : []),
      ...(contentInventory ? contentInventory.warnings : []),
      ...(structureSignature ? structureSignature.warnings : []),
    ],
  };
}

function auditSecondPassAuthorStability({ sourceRoot, reverseRoot, reportDir }) {
  const { measureAuthorSourceDrift } = require('../src/writers/html/audit/source-roundtrip-diff');
  const { authorPackageContentInventory, compareContentInventories } = require('../src/writers/html/audit/content-inventory');
  const { authorPackageStructureSignature, compareStructureSignatures } = require('../src/writers/html/audit/structure-signature');
  const sourceDrift = measureAuthorSourceDrift({ sourceRoot, reverseRoot });
  const contentInventory = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot),
  );
  const structureSignature = compareStructureSignatures(
    authorPackageStructureSignature(sourceRoot),
    authorPackageStructureSignature(reverseRoot),
  );
  const outDir = reportDir || path.join(reverseRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'canonical-source-drift-report.json'), JSON.stringify(sourceDrift, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'canonical-content-inventory-report.json'), JSON.stringify(contentInventory, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'canonical-structure-signature-report.json'), JSON.stringify(structureSignature, null, 2), 'utf8');
  const sourceDriftWarning = sourceDrift && sourceDrift.stable === false
    ? [{
      code: 'CANONICAL_SOURCE_DRIFT_ADVISORY',
      severity: 'warning',
      message: 'Second-pass author package has exact source formatting drift; content inventory and structure signature are the hard stability gates.',
      filesChanged: sourceDrift.stats && sourceDrift.stats.filesChanged,
      normalizedFilesChanged: sourceDrift.stats && sourceDrift.stats.normalizedFilesChanged,
      report: 'reports/canonical-source-drift-report.json',
    }]
    : [];
  const errors = [
    ...(contentInventory && !contentInventory.ok ? contentInventory.errors : []),
    ...(structureSignature && !structureSignature.ok ? structureSignature.errors : []),
  ];
  return {
    ok: errors.length === 0,
    sourceDrift,
    contentInventory,
    structureSignature,
    errors,
    warnings: sourceDriftWarning,
  };
}

function attributeCount(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (String(html || '').match(new RegExp(`\\b${escaped}\\s*=`, 'g')) || []).length;
}

function isAllowedBuiltInPanelName(kind, name) {
  return kind === 'swatches' && ['None', 'Registration', 'Paper', 'Black'].includes(String(name));
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
  const htmlResult = compileReverseSnapshotToHtml({
    snapshotPath: context.reverseSnapshotPath,
    outDir: context.reverseOutDir,
    mode: reverseMode,
    sourceRoot: path.dirname(context.htmlPath),
  });
  const reverseHtmlPath = path.join(context.reverseOutDir, 'deck.html');
  const reverseHtml = fs.readFileSync(reverseHtmlPath, 'utf8');
  const htmlAudit = reverseMode === 'observation'
    ? auditReverseHtmlSemantics(reverseHtml)
    : assertReverseHtmlSemantics(reverseHtml, reverseHtmlPath);
  const authorAudit = auditReverseAuthorPackage({
    ...htmlResult.files.author,
    sourceRoot: path.dirname(context.htmlPath),
    strictSourceRoundtrip: true,
  });
  if (!authorAudit.ok) {
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
  auditReverseAuthorPackage,
  auditSecondPassAuthorStability,
  auditReverseHtmlSemantics,
  assertReverseHtmlSemantics,
  parseArgs,
  parseTargetSize,
  assertPanelNameAuditOk,
  assertNoTextOverset,
  isAllowedBuiltInPanelName,
  observedPanelNamesForHtml,
  runIndesignE2E,
};
