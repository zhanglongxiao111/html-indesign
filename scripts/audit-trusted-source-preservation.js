#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { auditTrustedSourcePreservation } = require('../src/semantic-reconstruction');
const { validateSemanticModel } = require('../src/semantic-model');

function parseArgs(argv) {
  const options = {
    expected: null,
    actual: null,
    out: null,
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
  const expectedPath = path.resolve(options.expected);
  const actualPath = path.resolve(options.actual);
  const out = options.out ? path.resolve(options.out) : null;
  const expected = readJson(expectedPath);
  const actual = readJson(actualPath);
  assertSemanticModel(expected, expectedPath);
  assertSemanticModel(actual, actualPath);
  const report = auditTrustedSourcePreservation(expected, actual);
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return JSON.stringify(summaryFor(report, out), null, 2);
}

function summaryFor(report, out) {
  return {
    ok: report.ok,
    out,
    trustedItems: report.summary.trustedItems,
    mutations: report.summary.mutations,
    missing: report.summary.missing,
    failures: report.failures,
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw invalidInput(`Invalid JSON input: ${file}: ${error.message}`);
  }
}

function invalidInput(message) {
  return new Error(`TRUSTED_SOURCE_INVALID_INPUT: ${message}`);
}

function assertSemanticModel(model, file) {
  const validation = validateSemanticModel(model, { strictFields: true });
  if (!validation.valid) {
    const codes = validation.errors.map((error) => error.code).join(', ');
    throw invalidInput(`Invalid DocumentModel semantic model: ${file}: ${codes}`);
  }
}

function readValue(argv, index, arg) {
  if (index >= argv.length || argv[index].startsWith('--')) throw new Error(`Missing value for ${arg}`);
  return argv[index];
}

function usage() {
  return [
    'Usage: node scripts/audit-trusted-source-preservation.js --expected <before-model.json> --actual <after-model.json> [--out report.json]',
    'Compares accepted source-backed page/item structure before and after semantic reconstruction.',
  ].join('\n');
}

if (require.main === module) {
  try {
    const output = run(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${output}\n`);
    const parsed = JSON.parse(output);
    if (parsed && parsed.ok === false) process.exitCode = 1;
  } catch (error) {
    const message = String(error && error.message || error);
    process.stderr.write(`${message.startsWith('TRUSTED_SOURCE_INVALID_INPUT:')
      ? message
      : `TRUSTED_SOURCE_INVALID_INPUT: ${message}`}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
  run,
};
