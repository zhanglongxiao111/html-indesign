#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const {
  reverseSnapshotStructureSignature,
  compareReverseSnapshotStructures,
} = require('../src/adapters/indesign/audit/reverse-snapshot-structure');

function parseArgs(argv) {
  const options = {
    expected: null,
    actual: null,
    out: null,
    boundsTolerance: undefined,
    geometryTolerance: undefined,
    guideTolerance: undefined,
    numberTolerance: undefined,
    coverageThreshold: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--expected') {
      options.expected = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--expected=')) {
      options.expected = arg.slice('--expected='.length);
    } else if (arg === '--actual') {
      options.actual = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--actual=')) {
      options.actual = arg.slice('--actual='.length);
    } else if (arg === '--out') {
      options.out = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--bounds-tolerance') {
      options.boundsTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--bounds-tolerance=')) {
      options.boundsTolerance = numberOption(arg.slice('--bounds-tolerance='.length), '--bounds-tolerance');
    } else if (arg === '--geometry-tolerance') {
      options.geometryTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--geometry-tolerance=')) {
      options.geometryTolerance = numberOption(arg.slice('--geometry-tolerance='.length), '--geometry-tolerance');
    } else if (arg === '--guide-tolerance') {
      options.guideTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--guide-tolerance=')) {
      options.guideTolerance = numberOption(arg.slice('--guide-tolerance='.length), '--guide-tolerance');
    } else if (arg === '--number-tolerance') {
      options.numberTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--number-tolerance=')) {
      options.numberTolerance = numberOption(arg.slice('--number-tolerance='.length), '--number-tolerance');
    } else if (arg === '--coverage-threshold') {
      options.coverageThreshold = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--coverage-threshold=')) {
      options.coverageThreshold = numberOption(arg.slice('--coverage-threshold='.length), '--coverage-threshold');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function run(options) {
  if (options.help) return usage();
  if (!options.expected || !options.actual) throw new Error(usage());
  const compareOptions = pickCompareOptions(options);
  const expectedSnapshot = readJson(options.expected);
  const actualSnapshot = readJson(options.actual);
  const expectedSignature = reverseSnapshotStructureSignature(expectedSnapshot, compareOptions);
  const actualSignature = reverseSnapshotStructureSignature(actualSnapshot, compareOptions);
  const comparison = compareReverseSnapshotStructures(expectedSignature, actualSignature, compareOptions);
  const report = {
    ok: comparison.ok,
    options: compareOptions,
    comparison,
    expectedSignature,
    actualSignature,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    return JSON.stringify({ ok: comparison.ok, out: outPath, errors: comparison.errors.length, warnings: comparison.warnings.length }, null, 2);
  }
  return json;
}

function pickCompareOptions(options) {
  const out = {};
  for (const key of ['boundsTolerance', 'geometryTolerance', 'guideTolerance', 'numberTolerance', 'coverageThreshold']) {
    if (typeof options[key] === 'number') out[key] = options[key];
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function readValue(argv, index, arg) {
  if (index >= argv.length || argv[index].startsWith('--')) throw new Error(`Missing value for ${arg}`);
  return argv[index];
}

function numberOption(value, arg) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${arg} requires a numeric value`);
  return number;
}

function usage() {
  return [
    'Usage: node scripts/audit-reverse-snapshot-structure.js --expected <reverse-snapshot.json> --actual <reverse-snapshot.json> [--out <report.json>]',
    '       [--bounds-tolerance <pt>] [--geometry-tolerance <pt>] [--guide-tolerance <pt>] [--number-tolerance <value>] [--coverage-threshold <0-1>]',
  ].join('\n');
}

if (require.main === module) {
  try {
    const output = run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${output}\n`);
  } catch (error) {
    process.stderr.write(`${String(error && error.message || error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  run,
};
