#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { auditAuthorEditability } = require('../src/writers/html/audit/author-editability');

function parseArgs(argv) {
  const options = {
    authorRoot: null,
    out: null,
    baseline: null,
    thresholds: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--author-root') {
      options.authorRoot = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--author-root=')) {
      options.authorRoot = arg.slice('--author-root='.length);
    } else if (arg === '--out') {
      options.out = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--baseline') {
      options.baseline = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--baseline=')) {
      options.baseline = arg.slice('--baseline='.length);
    } else if (arg === '--max-loose-top-level') {
      options.thresholds.maxLooseTopLevelObjects = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--max-loose-top-level=')) {
      options.thresholds.maxLooseTopLevelObjects = numberOption(arg.slice('--max-loose-top-level='.length), '--max-loose-top-level');
    } else if (arg === '--max-inline-style') {
      options.thresholds.maxInlineStyleElements = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--max-inline-style=')) {
      options.thresholds.maxInlineStyleElements = numberOption(arg.slice('--max-inline-style='.length), '--max-inline-style');
    } else if (arg === '--max-low-level-geometry') {
      options.thresholds.maxLowLevelGeometryAttrs = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--max-low-level-geometry=')) {
      options.thresholds.maxLowLevelGeometryAttrs = numberOption(arg.slice('--max-low-level-geometry='.length), '--max-low-level-geometry');
    } else if (arg === '--max-vector-svg') {
      options.thresholds.maxVectorSvgElements = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--max-vector-svg=')) {
      options.thresholds.maxVectorSvgElements = numberOption(arg.slice('--max-vector-svg='.length), '--max-vector-svg');
    } else if (arg === '--min-semantic-container-coverage') {
      options.thresholds.minSemanticContainerCoverage = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--min-semantic-container-coverage=')) {
      options.thresholds.minSemanticContainerCoverage = numberOption(arg.slice('--min-semantic-container-coverage='.length), '--min-semantic-container-coverage');
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
  if (!options.authorRoot) throw new Error(usage());
  const authorRoot = path.resolve(options.authorRoot);
  const out = options.out ? path.resolve(options.out) : null;
  const report = auditAuthorEditability(authorRoot, {
    thresholds: options.thresholds,
    baselineReport: options.baseline ? readJson(options.baseline) : null,
  });
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
    metrics: {
      pages: report.summary.pages,
      objectIdElements: report.summary.objectIdElements,
      semanticContainerCoverage: report.summary.semanticContainerCoverage.ratio,
      looseTopLevelObjects: report.summary.looseTopLevelObjects,
      inlineStyleElements: report.summary.inlineStyleElements,
      lowLevelGeometryAttrs: report.summary.lowLevelGeometryAttrs,
      vectorSvgElements: report.summary.vectorSvgElements,
      figureCaptionPairs: report.summary.figureCaptionPairs,
      textElements: report.summary.textElements,
    },
    failures: report.failures,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
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
    'Usage: node scripts/audit-author-editability.js --author-root <reverse-html/author> [--out report.json]',
    '       [--baseline <author-editability-report.json>]',
    '       [--max-loose-top-level <count>] [--max-inline-style <count>]',
    '       [--max-low-level-geometry <count>] [--max-vector-svg <count>]',
    '       [--min-semantic-container-coverage <ratio>]',
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
};
