#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const {
  auditEffectiveDiff,
} = require('../src/adapters/indesign/audit/effective-diff');

function parseArgs(argv) {
  const options = {
    expected: null,
    actual: null,
    baseline: null,
    out: null,
    p1Budget: undefined,
    stabilityAudits: [],
    requireStabilityAudits: false,
    compareOptions: {},
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
    } else if (arg === '--baseline') {
      options.baseline = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--baseline=')) {
      options.baseline = arg.slice('--baseline='.length);
    } else if (arg === '--out') {
      options.out = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--p1-budget') {
      options.p1Budget = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--p1-budget=')) {
      options.p1Budget = numberOption(arg.slice('--p1-budget='.length), '--p1-budget');
    } else if (arg === '--stability-audit') {
      options.stabilityAudits.push(readValue(argv, ++index, arg));
    } else if (arg.startsWith('--stability-audit=')) {
      options.stabilityAudits.push(arg.slice('--stability-audit='.length));
    } else if (arg === '--require-stability-audits') {
      options.requireStabilityAudits = true;
    } else if (arg === '--bounds-tolerance') {
      options.compareOptions.boundsTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--bounds-tolerance=')) {
      options.compareOptions.boundsTolerance = numberOption(arg.slice('--bounds-tolerance='.length), '--bounds-tolerance');
    } else if (arg === '--geometry-tolerance') {
      options.compareOptions.geometryTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--geometry-tolerance=')) {
      options.compareOptions.geometryTolerance = numberOption(arg.slice('--geometry-tolerance='.length), '--geometry-tolerance');
    } else if (arg === '--number-tolerance') {
      options.compareOptions.numberTolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--number-tolerance=')) {
      options.compareOptions.numberTolerance = numberOption(arg.slice('--number-tolerance='.length), '--number-tolerance');
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
  const report = auditEffectiveDiff(readJson(options.expected), readJson(options.actual), {
    p1Budget: options.p1Budget,
    baselineReport: options.baseline ? readJson(options.baseline) : null,
    stabilityAudits: options.stabilityAudits.map(readJson),
    requireStabilityAudits: options.requireStabilityAudits,
    compareOptions: options.compareOptions,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    return JSON.stringify(summaryFor(report, outPath), null, 2);
  }
  return json;
}

function summaryFor(report, outPath) {
  return {
    ok: report.ok,
    out: outPath,
    edi: report.edi,
    p0: { ok: report.p0.ok, count: report.p0.count },
    p1: { ok: report.p1.ok, count: report.p1.count, budget: report.p1.budget },
    p2: { ok: report.p2.ok, count: report.p2.count },
    stability: report.stability,
  };
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
    'Usage: node scripts/audit-effective-diff.js --expected <original-reverse-snapshot.json> --actual <roundtrip-reverse-snapshot.json> [--out <report.json>]',
    '       [--baseline <effective-diff-report.json>] [--p1-budget <count>]',
    '       [--stability-audit <reverse-snapshot-audit.json>] [--require-stability-audits]',
    '       [--bounds-tolerance <pt>] [--geometry-tolerance <pt>] [--number-tolerance <value>]',
  ].join('\n');
}

if (require.main === module) {
  try {
    const output = run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${output}\n`);
    try {
      const parsed = JSON.parse(output);
      if (parsed && parsed.ok === false) process.exitCode = 1;
    } catch (_) {}
  } catch (error) {
    process.stderr.write(`${String(error && error.message || error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  run,
};
