const fs = require('fs');
const path = require('path');
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  blueprintMigrationToSemanticModel,
} = require('../adapters/indesign');
const {
  reconstructSemanticModel,
  assertResolvedReconstructionProfile,
} = require('../semantic-reconstruction');
const { semanticModelToHtml } = require('../writers/html/visual-html-writer');
const { writeReverseAuthorPackage } = require('../writers/html/author-package-writer');
const { auditReverseAuthorPackage } = require('../writers/html/audit/reverse-roundtrip');
const { resolveSemanticPreset } = require('../semantic-preset');

function compileReverseSnapshotToHtml(options) {
  assertCompileOptions(options);
  const reconstructionProfile = assertResolvedReconstructionProfile(options.reconstructionProfile);

  const inputFormat = options.blueprintPath ? 'historical-blueprint' : 'reverse-snapshot';
  const semanticPreset = options.blueprintPath ? null : sourceSemanticPreset(options.sourceRoot);
  const adapterOptions = semanticPreset
    ? { mode: options.mode, semanticPreset }
    : { mode: options.mode };
  const observedModel = options.blueprintPath
    ? blueprintMigrationToSemanticModel(readJson(options.blueprintPath), adapterOptions)
    : reverseSnapshotToSemanticModel(readReverseSnapshot(options.snapshotPath), adapterOptions);
  const reconstruction = reconstructSemanticModel(observedModel, {
    mode: options.mode,
    inputFormat,
    reconstructionProfile: reconstructionProfile.name,
    algorithms: reconstructionProfile.algorithms,
  });
  const model = reconstruction.model;
  const outDir = path.resolve(options.outDir);
  const visualHtml = semanticModelToHtml(model, { outputDir: outDir });
  const report = createReport(model, { ...options, inputFormat, reconstruction: reconstruction.report });
  const modeHtmlName = `deck.${options.mode}.html`;
  const modeReportName = `${options.mode}-report.json`;
  const reconstructionReportName = 'reconstruction-report.json';

  fs.mkdirSync(outDir, { recursive: true });
  const authorResult = writeReverseAuthorPackage(model, {
    outDir: path.join(outDir, 'author'),
    mode: options.mode,
    sourceRoot: options.sourceRoot,
    ...(semanticPreset ? { semanticPreset } : {}),
    assetPolicy: options.assetPolicy || 'reference',
    nasPublicRoot: options.nasPublicRoot || '/nas',
  });
  const authorAudit = auditReverseAuthorPackage({
    config: authorResult.configPath,
    entry: authorResult.entryPath,
    outDir: authorResult.outDir,
    pages: authorResult.pages,
    sourceRoot: options.sourceRoot,
  });

  fs.writeFileSync(path.join(outDir, 'deck.visual.html'), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, modeHtmlName), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'deck.html'), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'reverse-model.json'), JSON.stringify(model, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, reconstructionReportName), JSON.stringify(reconstruction.report, null, 2), 'utf8');
  const finalReport = {
    ...report,
    ok: report.ok
      && authorAudit.ok
      && reconstructionPassedTrustedSourceGate(reconstruction.report),
    authorAudit,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, modeReportName), JSON.stringify(finalReport, null, 2), 'utf8');

  return {
    ok: finalReport.ok,
    outDir,
    files: {
      html: path.join(outDir, 'deck.html'),
      visualHtml: path.join(outDir, 'deck.visual.html'),
      modeHtml: path.join(outDir, modeHtmlName),
      model: path.join(outDir, 'reverse-model.json'),
      reconstructionReport: path.join(outDir, reconstructionReportName),
      report: path.join(outDir, 'report.json'),
      modeReport: path.join(outDir, modeReportName),
      author: {
        config: authorResult.configPath,
        entry: authorResult.entryPath,
        presentation: authorResult.presentation,
        outDir: authorResult.outDir,
        pages: authorResult.pages,
        audit: authorAudit,
      },
    },
    report: finalReport,
  };
}

function createReport(model, options) {
  return {
    ok: true,
    mode: options.mode,
    inputFormat: options.inputFormat,
    reconstruction: options.reconstruction,
    pages: model.pages.length,
    parentPages: model.parentPages.length,
    items: model.pages.reduce((sum, page) => sum + page.items.length, 0),
    assets: (model.assets || []).length,
    inference: model.report && model.report.inference ? model.report.inference : null,
    unresolved: [],
  };
}

function assertCompileOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('compileReverseSnapshotToHtml requires options');
  }
  if (!options.snapshotPath && !options.blueprintPath) {
    throw new Error('compileReverseSnapshotToHtml requires snapshotPath or blueprintPath');
  }
  if (options.snapshotPath && options.blueprintPath) {
    throw new Error('compileReverseSnapshotToHtml accepts only one of snapshotPath or blueprintPath');
  }
  if (!options.outDir) {
    throw new Error('compileReverseSnapshotToHtml requires outDir');
  }
  if (!options.mode) {
    throw new Error('compileReverseSnapshotToHtml requires mode');
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function sourceSemanticPreset(sourceRoot) {
  if (!sourceRoot) return null;
  const rootDir = path.resolve(sourceRoot);
  const configPath = path.join(rootDir, 'deck.config.json');
  if (!fs.existsSync(configPath)) return null;
  const config = readJson(configPath);
  if (!config.semanticPreset) return null;
  return resolveSemanticPreset({ rootDir, config }).preset;
}

function reconstructionPassedTrustedSourceGate(report) {
  return Boolean(report
    && report.trustedSourcePreservation
    && report.trustedSourcePreservation.ok === true);
}

module.exports = {
  compileReverseSnapshotToHtml,
  reconstructionPassedTrustedSourceGate,
  sourceSemanticPreset,
};
