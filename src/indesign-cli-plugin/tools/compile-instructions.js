const fs = require('node:fs');
const path = require('node:path');
const { auditHtmlCompatibility, renderSnapshot } = require('../../adapters/html');
const { compileDocument } = require('../../indesign-pipeline');
const { validateInstructions } = require('../../writers/indesign');
const { checkAuthorPackageEntry, readAuthorPackage } = require('../../authoring');
const { resolveSemanticPreset, presetToStyleNameMap } = require('../../semantic-preset');
const { resolveProjectPath, ensureOutputDir } = require('../path-policy');
const { artifact } = require('../artifacts');

async function compileAuthoringPackage(args, context, prefix = 'html-plugin-compile', internal = {}) {
  const packagePath = resolveProjectPath(context, args.package, 'package');
  const sourcePackage = readAuthorPackage(packagePath);
  const packageCheck = checkAuthorPackageEntry(packagePath);
  if (!packageCheck.ok) {
    const err = new Error(`AUTHOR_GENERATED_ENTRY_DIRTY: ${packageCheck.message}: ${packageCheck.entryPath}`);
    err.code = 'AUTHOR_GENERATED_ENTRY_DIRTY';
    err.details = { stage: 'compile' };
    throw err;
  }

  const outDir = ensureOutputDir(context, args.outDir, prefix);
  const outputName = args.outputName || 'instructions.json';
  const instructionsPath = path.join(outDir, outputName);
  const summaryPath = path.join(outDir, 'compile-summary.json');

  const hasProvidedSnapshot = Boolean(internal.snapshot);
  const snapshotStartedAt = Date.now();
  const snapshot = internal.snapshot || await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const snapshotMs = hasProvidedSnapshot ? null : Date.now() - snapshotStartedAt;
  const compatibility = internal.compatibility || auditHtmlCompatibility(snapshot);

  const compileStartedAt = Date.now();
  const styleNameMap = loadStyleNameMap(sourcePackage);
  const compiled = compileDocument(snapshot, {
    mode: 'editable-first',
    unitMode: args.unitMode || 'presentation',
    targetSize: args.targetSize || 'same',
    styleNameMap,
    preserveObservedLayerNames: false,
  });
  const { model, instructions } = compiled;

  const validation = validateInstructions(instructions, {
    checkAssetFiles: true,
    baseDir: path.dirname(sourcePackage.entryPath),
  });
  const compileMs = Date.now() - compileStartedAt;

  if (!validation.valid) {
    const err = new Error(`Compiled instructions failed validation: ${validation.errors.map((item) => item.message || item.code).join('; ')}`);
    err.code = 'INSTRUCTIONS_VALIDATION_FAILED';
    err.validation = validation;
    err.details = {
      stage: 'compile',
      metrics: buildMetrics({
        snapshot_ms: snapshotMs,
        compile_ms: compileMs,
        error_count: validation.errors.length,
      }),
      compatibility,
    };
    throw err;
  }

  fs.writeFileSync(instructionsPath, JSON.stringify(instructions, null, 2), 'utf8');
  const expectedModelName = internal.expectedModelName || null;
  const expectedModelPath = expectedModelName ? path.join(outDir, expectedModelName) : null;
  if (expectedModelPath) {
    fs.writeFileSync(expectedModelPath, JSON.stringify(model, null, 2), 'utf8');
  }
  const summary = compileSummary({
    sourcePackage,
    instructions,
    model,
    expectedModelPath,
    instructionsPath,
    summaryPath,
    validation,
    compatibility,
  });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  const metrics = buildMetrics({
    snapshot_ms: snapshotMs,
    compile_ms: compileMs,
    pages: Array.isArray(instructions.pages) ? instructions.pages.length : undefined,
    objects: Array.isArray(instructions.pages)
      ? instructions.pages.reduce((sum, page) => sum + (Array.isArray(page.items) ? page.items.length : 0), 0)
      : undefined,
    vector_paths: countVectorPaths(instructions),
    assets: Array.isArray(instructions.assets) ? instructions.assets.length : undefined,
    error_count: validation.errors.length,
    compatibility_normalized: compatibility.summary.normalized,
    compatibility_blocked: compatibility.summary.blocked,
  });

  return {
    outDir,
    packagePath: sourcePackage.configPath,
    htmlPath: sourcePackage.entryPath,
    instructionsPath,
    summaryPath,
    instructions,
    model,
    expectedModelPath,
    summary,
    validation,
    compatibility,
    metrics,
  };
}

function countVectorPaths(instructions) {
  const pages = instructions && Array.isArray(instructions.pages) ? instructions.pages : [];
  return pages.reduce((sum, page) => {
    const items = Array.isArray(page.items) ? page.items : [];
    return sum + items.reduce((itemSum, item) => {
      const paths = item && item.vectorGeometry && Array.isArray(item.vectorGeometry.paths)
        ? item.vectorGeometry.paths.length
        : 0;
      return itemSum + paths;
    }, 0);
  }, 0);
}

function buildMetrics(values) {
  const metrics = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (typeof value === 'number' && Number.isFinite(value)) metrics[key] = value;
    else if (typeof value === 'boolean') metrics[key] = value;
  }
  return metrics;
}

function loadStyleNameMap(sourcePackage) {
  const resolved = resolveSemanticPreset({
    rootDir: sourcePackage.rootDir,
    config: sourcePackage.config,
  });
  return presetToStyleNameMap(resolved.preset);
}

function compileSummary({ sourcePackage, instructions, instructionsPath, summaryPath, validation, compatibility }) {
  return {
    ok: true,
    packagePath: sourcePackage.configPath,
    htmlPath: sourcePackage.entryPath,
    instructionsPath,
    summaryPath,
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
    validation,
    compatibility,
  };
}

async function call(args, context) {
  const result = await compileAuthoringPackage(args, context);
  const artifacts = [
    artifact('json', result.instructionsPath, 'InDesign instructions'),
    artifact('json', result.summaryPath, 'Compile summary'),
  ];
  return {
    status: 'complete',
    data: {
      ok: true,
      outDir: result.outDir,
      packagePath: result.packagePath,
      htmlPath: result.htmlPath,
      instructionsPath: result.instructionsPath,
      summaryPath: result.summaryPath,
      pageCount: Array.isArray(result.instructions.pages) ? result.instructions.pages.length : 0,
      compatibility: result.compatibility,
    },
    metrics: buildMetrics({ ...(result.metrics || {}), artifacts: artifacts.length }),
    artifacts,
  };
}

module.exports = {
  call,
  compileAuthoringPackage,
  countVectorPaths,
  buildMetrics,
};
