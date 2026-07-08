#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { captureHtmlGeometry } = require('../src/adapters/html/reader/visual-geometry-capture');
const { compareVisualGeometry } = require('../src/writers/html/audit/visual-geometry-audit');
const {
  loadReverseHtmlEvidence,
  enrichCaptureWithReverseModelSourceMetadata,
} = require('../src/writers/html/audit/reverse-visual-evidence');

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--reverse-html') {
      options.reverseHtmlDir = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--reverse-html=')) {
      options.reverseHtmlDir = arg.slice('--reverse-html='.length);
    } else if (arg === '--reference') {
      options.referenceHtml = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--reference=')) {
      options.referenceHtml = arg.slice('--reference='.length);
    } else if (arg === '--candidate') {
      options.candidateHtml = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--candidate=')) {
      options.candidateHtml = arg.slice('--candidate='.length);
    } else if (arg === '--out') {
      options.outFile = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.outFile = arg.slice('--out='.length);
    } else if (arg === '--tolerance') {
      options.tolerance = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--tolerance=')) {
      options.tolerance = numberOption(arg.slice('--tolerance='.length), '--tolerance');
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function resolveInputs(options = {}) {
  const reverseHtmlDir = options.reverseHtmlDir ? path.resolve(options.reverseHtmlDir) : null;
  const referenceHtml = path.resolve(options.referenceHtml || (reverseHtmlDir && path.join(reverseHtmlDir, 'deck.visual.html')) || '');
  const candidateHtml = path.resolve(options.candidateHtml || (reverseHtmlDir && path.join(reverseHtmlDir, 'author/deck.html')) || '');
  return {
    reverseHtmlDir,
    referenceHtml,
    candidateHtml,
    outFile: options.outFile ? path.resolve(options.outFile) : null,
    tolerance: Number.isFinite(Number(options.tolerance)) ? Number(options.tolerance) : 2,
    json: Boolean(options.json),
    help: Boolean(options.help),
  };
}

function usage() {
  return [
    'Usage: node scripts/audit-reverse-visual.js --reverse-html <reverse-html-dir> [--tolerance 2] [--out report.json] [--json]',
    '   or: node scripts/audit-reverse-visual.js --reference <deck.visual.html> --candidate <author/deck.html> [--out report.json]',
    '',
    'Compares browser-computed page and element geometry between visual reverse HTML and editable author HTML.',
  ].join('\n');
}

function validateInputs(inputs) {
  if (!inputs.referenceHtml || inputs.referenceHtml === path.resolve('')) {
    throw new Error('Missing --reference or --reverse-html.');
  }
  if (!inputs.candidateHtml || inputs.candidateHtml === path.resolve('')) {
    throw new Error('Missing --candidate or --reverse-html.');
  }
  if (!fs.existsSync(inputs.referenceHtml)) throw new Error(`Reference HTML not found: ${inputs.referenceHtml}`);
  if (!fs.existsSync(inputs.candidateHtml)) throw new Error(`Candidate HTML not found: ${inputs.candidateHtml}`);
}

function printHuman(report, inputs) {
  const lines = [
    `reverse visual audit: ${report.ok ? 'ok' : 'failed'}`,
    `reference: ${inputs.referenceHtml}`,
    `candidate: ${inputs.candidateHtml}`,
    `pages: ${report.stats.candidatePages}/${report.stats.referencePages}`,
    `elements compared: ${report.stats.compared}`,
    `missing: ${report.stats.missing}`,
    `mismatched: ${report.stats.mismatched}`,
    `text compared: ${report.stats.textCompared || 0}`,
    `text mismatches: ${report.stats.textMismatches || 0}`,
    `accepted: ${report.stats.accepted || 0}`,
    `errors: ${report.errors.length}`,
    `warnings: ${report.warnings.length}`,
  ];
  for (const issue of report.errors.slice(0, 40)) {
    lines.push(`- ${issue.code}${issue.id ? ` ${issue.id}` : ''}: ${issue.message}`);
  }
  if (report.errors.length > 40) lines.push(`- ... ${report.errors.length - 40} more errors`);
  for (const issue of report.warnings.slice(0, 20)) {
    lines.push(`~ ${issue.code}${issue.id ? ` ${issue.id}` : ''}: ${issue.message}`);
  }
  if (report.warnings.length > 20) lines.push(`~ ... ${report.warnings.length - 20} more warnings`);
  console.log(lines.join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const inputs = resolveInputs(options);
  validateInputs(inputs);
  const reference = await captureHtmlGeometry(inputs.referenceHtml);
  const candidate = await captureHtmlGeometry(inputs.candidateHtml);
  const evidence = loadReverseHtmlEvidence(inputs.reverseHtmlDir);
  enrichCaptureWithReverseModelSourceMetadata(reference, evidence.reverseModel);
  const report = compareVisualGeometry({ reference, candidate, tolerance: inputs.tolerance });
  assertComparableReport(report, inputs);
  if (inputs.outFile) {
    fs.mkdirSync(path.dirname(inputs.outFile), { recursive: true });
    fs.writeFileSync(inputs.outFile, JSON.stringify(report, null, 2), 'utf8');
  }
  if (inputs.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report, inputs);
  if (!report.ok) process.exitCode = 1;
}

function assertComparableReport(report, inputs) {
  const stats = report && report.stats || {};
  if (stats.referencePages <= 0 || stats.candidatePages <= 0) {
    throw new Error(`No .page roots found in reference or candidate HTML: ${inputs.referenceHtml}, ${inputs.candidateHtml}`);
  }
  if (stats.compared <= 0) {
    throw new Error(`No comparable visual elements found in reference and candidate HTML: ${inputs.referenceHtml}, ${inputs.candidateHtml}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error && error.message ? error.message : String(error);
    console.error(`REVERSE_VISUAL_INVALID_INPUT: ${message}`);
    process.exit(1);
  });
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

module.exports = {
  parseArgs,
  resolveInputs,
  captureHtmlGeometry,
  usage,
};
