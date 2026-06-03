#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  blueprintMigrationToSemanticModel,
} = require('../src/adapters/indesign');
const {
  semanticModelToHtml,
  writeReverseAuthorPackage,
} = require('../src/writers/html');
const { reconstructSemanticModel } = require('../src/semantic-reconstruction');
const { auditReverseAuthorPackage } = require('../src/writers/html/audit/author-audit');

function parseArgs(argv) {
  const out = {
    mode: 'structured',
    snapshotPath: null,
    blueprintPath: null,
    outDir: null,
    sourceRoot: null,
    assetPolicy: 'reference',
    nasPublicRoot: '/nas',
    reconstructAlgorithms: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--mode') {
      out.mode = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--mode=')) {
      out.mode = arg.slice('--mode='.length);
    } else if (arg === '--snapshot') {
      out.snapshotPath = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--snapshot=')) {
      out.snapshotPath = arg.slice('--snapshot='.length);
    } else if (arg === '--blueprint') {
      out.blueprintPath = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--blueprint=')) {
      out.blueprintPath = arg.slice('--blueprint='.length);
    } else if (arg === '--out') {
      out.outDir = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--out=')) {
      out.outDir = arg.slice('--out='.length);
    } else if (arg === '--source-root') {
      out.sourceRoot = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--source-root=')) {
      out.sourceRoot = arg.slice('--source-root='.length);
    } else if (arg === '--asset-policy') {
      out.assetPolicy = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--asset-policy=')) {
      out.assetPolicy = arg.slice('--asset-policy='.length);
    } else if (arg === '--nas-public-root') {
      out.nasPublicRoot = readValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith('--nas-public-root=')) {
      out.nasPublicRoot = arg.slice('--nas-public-root='.length);
    } else if (arg === '--reconstruct') {
      out.reconstructAlgorithms = parseAlgorithmList(readValue(argv, index, arg));
      index += 1;
    } else if (arg.startsWith('--reconstruct=')) {
      out.reconstructAlgorithms = parseAlgorithmList(arg.slice('--reconstruct='.length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return out;
}

function compileReverseSnapshotToHtml(options) {
  assertCompileOptions(options);

  const inputFormat = options.blueprintPath ? 'historical-blueprint' : 'reverse-snapshot';
  const observedModel = options.blueprintPath
    ? blueprintMigrationToSemanticModel(readJson(options.blueprintPath), { mode: options.mode })
    : reverseSnapshotToSemanticModel(readReverseSnapshot(options.snapshotPath), { mode: options.mode });
  const reconstruction = reconstructSemanticModel(observedModel, {
    mode: options.mode,
    inputFormat,
    algorithms: options.reconstructAlgorithms || [],
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
    assetPolicy: options.assetPolicy || 'reference',
    nasPublicRoot: options.nasPublicRoot || '/nas',
  });
  const authorAudit = auditReverseAuthorPackage(authorResult.outDir, { model });

  fs.writeFileSync(path.join(outDir, 'deck.visual.html'), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, modeHtmlName), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'deck.html'), visualHtml, 'utf8');
  fs.writeFileSync(path.join(outDir, 'reverse-model.json'), JSON.stringify(model, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, reconstructionReportName), JSON.stringify(reconstruction.report, null, 2), 'utf8');
  const finalReport = { ...report, authorAudit };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(finalReport, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, modeReportName), JSON.stringify(finalReport, null, 2), 'utf8');

  return {
    ok: true,
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
      },
    },
    report: finalReport,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  if ((!options.snapshotPath && !options.blueprintPath) || !options.outDir) {
    console.error(usage());
    process.exit(1);
  }

  const result = compileReverseSnapshotToHtml(options);
  console.log(JSON.stringify(result, null, 2));
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

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseAlgorithmList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function usage() {
  return 'Usage: node scripts/indesign-reverse-export.js (--snapshot <reverse-snapshot.json> | --blueprint <historical-blueprint.json>) --out <dir> [--mode structured|inferred|observation] [--source-root <author-package-root>] [--asset-policy reference|copy] [--nas-public-root /nas] [--reconstruct page-object-graph,caption-structure,figure-grid,text-block]';
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  compileReverseSnapshotToHtml,
};
