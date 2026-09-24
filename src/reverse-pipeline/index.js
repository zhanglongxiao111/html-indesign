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
const { createRunId, writeReportFile } = require('../shared/report-file');
const {
  CONTENT_MANIFEST_FILE,
  buildContentManifest,
  writeContentManifest,
} = require('./content-manifest');

// 不经插件调用（scripts/indesign-reverse-export.js、e2e）时没有外部 runId，这里自己生成，
// 保证 report.json 顶层永远带着可核对的运行标识。
const DEFAULT_REPORT_TOOL = 'reverse-pipeline';

function compileReverseSnapshotToHtml(options) {
  assertCompileOptions(options);
  const reconstructionProfile = assertResolvedReconstructionProfile(options.reconstructionProfile);

  const inputFormat = options.blueprintPath ? 'historical-blueprint' : 'reverse-snapshot';
  const semanticPreset = options.blueprintPath ? null : sourceSemanticPreset(options.sourceRoot);
  const adapterOptions = semanticPreset
    ? { mode: options.mode, semanticPreset }
    : { mode: options.mode };
  const snapshot = options.blueprintPath ? null : readReverseSnapshot(options.snapshotPath);
  const observedModel = options.blueprintPath
    ? blueprintMigrationToSemanticModel(readJson(options.blueprintPath), adapterOptions)
    : reverseSnapshotToSemanticModel(snapshot, adapterOptions);
  const reconstruction = reconstructSemanticModel(observedModel, {
    mode: options.mode,
    inputFormat,
    reconstructionProfile: reconstructionProfile.name,
    algorithms: reconstructionProfile.algorithms,
  });
  const model = reconstruction.model;
  const outDir = path.resolve(options.outDir);
  const visualHtml = semanticModelToHtml(model, { outputDir: outDir });
  const report = createReport(model, {
    ...options,
    inputFormat,
    reconstruction: reconstruction.report,
    warnings: snapshotReportWarnings(snapshot),
  });
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
  // 作者 HTML 写出 warning 与快照 warning 一起进 report.json 和工具返回体的 warningsByCode。
  for (const warning of authorResult.warnings || []) report.warnings.push(warning);
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
  // report.json、<mode>-report.json 与 content-manifest.json 用同一个运行标识。
  const reportRun = {
    runId: options.runId || createRunId('reverse'),
    tool: options.reportTool || DEFAULT_REPORT_TOOL,
  };
  const contentManifestPath = path.join(outDir, CONTENT_MANIFEST_FILE);
  const contentManifest = buildContentManifest(model, {
    ...reportRun,
    outDir,
    authorDir: authorResult.outDir,
    assetPathMap: authorResult.assetPathMap,
    pageNames: snapshot ? (snapshot.pages || []).map((page) => page && page.id) : [],
    files: {
      report: path.join(outDir, 'report.json'),
      reverseModel: path.join(outDir, 'reverse-model.json'),
      authorEntry: authorResult.entryPath,
      authorConfig: authorResult.configPath,
    },
  });
  writeContentManifest(contentManifestPath, contentManifest);
  const finalReport = {
    ...report,
    ok: report.ok
      && authorAudit.ok
      && reconstructionPassedTrustedSourceGate(reconstruction.report),
    authorAudit,
    contentManifest: { path: CONTENT_MANIFEST_FILE, summary: contentManifest.summary },
  };
  writeReportFile(path.join(outDir, 'report.json'), finalReport, reportRun);
  writeReportFile(path.join(outDir, modeReportName), finalReport, reportRun);

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
      contentManifest: contentManifestPath,
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
    runId: reportRun.runId,
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
    warnings: options.warnings || [],
  };
}

// InDesign 端（HI.exportReverseSnapshot）把回读时的 warning 记在快照的 report 里，
// 例如 REVERSE_GRADIENT_APPROXIMATED。这里原样转进 report.json，不按 code 挑选；
// 快照只落在中间文件里的话，Agent 读 report.json 和工具返回体都看不到。
function snapshotReportWarnings(snapshot) {
  const report = snapshot && snapshot.report;
  if (!report || typeof report !== 'object') return [];
  const list = Array.isArray(report.warnings)
    ? report.warnings
    : (Array.isArray(report.messages) ? report.messages.filter((entry) => entry && entry.level === 'warning') : []);
  return list
    .filter((entry) => entry && typeof entry === 'object' && entry.code)
    .map((entry) => ({
      code: String(entry.code),
      message: entry.message == null ? '' : String(entry.message),
      source: 'reverse-snapshot',
      ...(entry.details && typeof entry.details === 'object' ? { details: entry.details } : {}),
    }));
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
