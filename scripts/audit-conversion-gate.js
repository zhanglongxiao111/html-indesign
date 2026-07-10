#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  buildGateReport,
  DEFAULT_THRESHOLDS,
  summaryFor,
} = require('../src/writers/html/audit/conversion-gate');

function parseArgs(argv) {
  const options = {
    caseFile: null,
    effectiveDiff: null,
    reverseVisual: null,
    editability: null,
    trustedSource: null,
    out: null,
    thresholds: {},
    requiredGates: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case') {
      options.caseFile = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--case=')) {
      options.caseFile = arg.slice('--case='.length);
    } else if (arg === '--effective-diff') {
      options.effectiveDiff = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--effective-diff=')) {
      options.effectiveDiff = arg.slice('--effective-diff='.length);
    } else if (arg === '--reverse-visual') {
      options.reverseVisual = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--reverse-visual=')) {
      options.reverseVisual = arg.slice('--reverse-visual='.length);
    } else if (arg === '--editability') {
      options.editability = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--editability=')) {
      options.editability = arg.slice('--editability='.length);
    } else if (arg === '--trusted-source') {
      options.trustedSource = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--trusted-source=')) {
      options.trustedSource = arg.slice('--trusted-source='.length);
    } else if (arg === '--out') {
      options.out = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--p0-budget') {
      options.thresholds.p0 = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--p0-budget=')) {
      options.thresholds.p0 = numberOption(arg.slice('--p0-budget='.length), '--p0-budget');
    } else if (arg === '--p1-budget') {
      options.thresholds.p1 = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--p1-budget=')) {
      options.thresholds.p1 = numberOption(arg.slice('--p1-budget='.length), '--p1-budget');
    } else if (arg === '--html-missing-budget') {
      options.thresholds.htmlMissing = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-missing-budget=')) {
      options.thresholds.htmlMissing = numberOption(arg.slice('--html-missing-budget='.length), '--html-missing-budget');
    } else if (arg === '--html-geometry-budget') {
      options.thresholds.htmlGeometry = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-geometry-budget=')) {
      options.thresholds.htmlGeometry = numberOption(arg.slice('--html-geometry-budget='.length), '--html-geometry-budget');
    } else if (arg === '--html-text-budget') {
      options.thresholds.htmlText = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-text-budget=')) {
      options.thresholds.htmlText = numberOption(arg.slice('--html-text-budget='.length), '--html-text-budget');
    } else if (arg === '--html-page-budget') {
      options.thresholds.htmlPageMismatches = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-page-budget=')) {
      options.thresholds.htmlPageMismatches = numberOption(arg.slice('--html-page-budget='.length), '--html-page-budget');
    } else if (arg === '--require-editability') {
      options.requiredGates.push('editability');
    } else if (arg === '--require-trusted-source') {
      options.requiredGates.push('trustedSource');
    } else if (arg === '--require-stability') {
      options.requiredGates.push('stability');
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
  const resolved = resolveOptions(options);
  if (!resolved.effectiveDiff || !resolved.reverseVisual) throw new Error(usage());
  const report = buildGateReport({
    effectiveDiffPath: resolved.effectiveDiff,
    reverseVisualPath: resolved.reverseVisual,
    editabilityPath: resolved.editability,
    trustedSourcePath: resolved.trustedSource,
    thresholds: resolved.thresholds,
    requiredGates: resolved.requiredGates,
  });
  if (resolved.out) {
    fs.mkdirSync(path.dirname(resolved.out), { recursive: true });
    fs.writeFileSync(resolved.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return JSON.stringify(summaryFor(report), null, 2);
}

function resolveOptions(options) {
  const casePath = options.caseFile ? path.resolve(options.caseFile) : null;
  const caseConfig = casePath ? readJson(casePath) : {};
  const baseDir = casePath ? path.dirname(casePath) : process.cwd();
  return {
    effectiveDiff: resolveInputPath(options.effectiveDiff || caseConfig.effectiveDiff, baseDir),
    reverseVisual: resolveInputPath(options.reverseVisual || caseConfig.reverseVisual, baseDir),
    editability: resolveInputPath(options.editability || caseConfig.editability, baseDir),
    trustedSource: resolveInputPath(options.trustedSource || caseConfig.trustedSource, baseDir),
    out: options.out ? path.resolve(options.out) : null,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...(caseConfig.thresholds || {}),
      ...definedEntries(options.thresholds),
    },
    requiredGates: [...new Set([
      ...(Array.isArray(caseConfig.requiredGates) ? caseConfig.requiredGates : []),
      ...(options.requiredGates || []),
    ])],
  };
}

function resolveInputPath(value, baseDir) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw invalidInput(`Invalid JSON input: ${file}: ${error.message}`);
  }
}

function definedEntries(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined));
}

function invalidInput(message) {
  return new Error(`CONVERSION_GATE_INVALID_INPUT: ${message}`);
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
    'Usage: node scripts/audit-conversion-gate.js --case <gate.case.json> [--out report.json]',
    '   or: node scripts/audit-conversion-gate.js --effective-diff <report.json> --reverse-visual <report.json> [--editability <report.json>] [--trusted-source <report.json>]',
    '       [--p0-budget 0] [--p1-budget 0] [--html-missing-budget 0]',
    '       [--html-geometry-budget 0] [--html-text-budget 0] [--html-page-budget 0]',
    '       [--require-editability] [--require-trusted-source] [--require-stability]',
  ].join('\n');
}

if (require.main === module) {
  try {
    const output = run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${output}\n`);
    const parsed = JSON.parse(output);
    if (parsed && parsed.ok === false) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${String(error && error.message || error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  run,
  buildGateReport,
  summaryFor,
};
