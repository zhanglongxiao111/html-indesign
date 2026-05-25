#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  semanticModelToHtml,
  legacyBlueprintToSemanticModel,
} = require('../src/indesign-reverse');

function parseArgs(argv) {
  const out = {
    mode: 'structured',
    snapshotPath: null,
    blueprintPath: null,
    outDir: null,
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
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return out;
}

function compileReverseSnapshotToHtml(options) {
  assertCompileOptions(options);

  const inputFormat = options.blueprintPath ? 'legacy-blueprint' : 'reverse-snapshot';
  const model = options.blueprintPath
    ? legacyBlueprintToSemanticModel(readJson(options.blueprintPath), { mode: options.mode })
    : reverseSnapshotToSemanticModel(readReverseSnapshot(options.snapshotPath), { mode: options.mode });
  const outDir = path.resolve(options.outDir);
  const html = semanticModelToHtml(model, { outputDir: outDir });
  const report = createReport(model, { ...options, inputFormat });
  const modeHtmlName = `deck.${options.mode}.html`;
  const modeReportName = `${options.mode}-report.json`;

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.html'), html, 'utf8');
  fs.writeFileSync(path.join(outDir, modeHtmlName), html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'reverse-model.json'), JSON.stringify(model, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, modeReportName), JSON.stringify(report, null, 2), 'utf8');

  return {
    ok: true,
    outDir,
    files: {
      html: path.join(outDir, 'deck.html'),
      modeHtml: path.join(outDir, modeHtmlName),
      model: path.join(outDir, 'reverse-model.json'),
      report: path.join(outDir, 'report.json'),
      modeReport: path.join(outDir, modeReportName),
    },
    report,
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

function usage() {
  return 'Usage: node scripts/indesign-reverse-export.js (--snapshot <reverse-snapshot.json> | --blueprint <legacy-blueprint.json>) --out <dir> [--mode structured|inferred|observation]';
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
