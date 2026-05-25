#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  readReverseSnapshot,
  reverseSnapshotToSemanticModel,
  semanticModelToHtml,
} = require('../src/indesign-reverse');

function parseArgs(argv) {
  const out = {
    mode: 'structured',
    snapshotPath: null,
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

  const snapshot = readReverseSnapshot(options.snapshotPath);
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: options.mode });
  const html = semanticModelToHtml(model);
  const outDir = path.resolve(options.outDir);
  const report = createReport(model, options);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'deck.html'), html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'reverse-model.json'), JSON.stringify(model, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

  return {
    ok: true,
    outDir,
    files: {
      html: path.join(outDir, 'deck.html'),
      model: path.join(outDir, 'reverse-model.json'),
      report: path.join(outDir, 'report.json'),
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
  if (!options.snapshotPath || !options.outDir) {
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
    pages: model.pages.length,
    parentPages: model.parentPages.length,
    items: model.pages.reduce((sum, page) => sum + page.items.length, 0),
    unresolved: [],
  };
}

function assertCompileOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('compileReverseSnapshotToHtml requires options');
  }
  if (!options.snapshotPath) {
    throw new Error('compileReverseSnapshotToHtml requires snapshotPath');
  }
  if (!options.outDir) {
    throw new Error('compileReverseSnapshotToHtml requires outDir');
  }
  if (!options.mode) {
    throw new Error('compileReverseSnapshotToHtml requires mode');
  }
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function usage() {
  return 'Usage: node scripts/indesign-reverse-export.js --snapshot <reverse-snapshot.json> --out <dir> [--mode structured]';
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
