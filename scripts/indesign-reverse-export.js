#!/usr/bin/env node

const { compileReverseSnapshotToHtml } = require('../src/reverse-pipeline');

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
