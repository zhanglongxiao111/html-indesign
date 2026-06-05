#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const {
  auditParentPageFurniture,
} = require('../src/adapters/indesign/audit/parent-page-furniture');

function parseArgs(argv) {
  const options = {
    source: null,
    actual: null,
    secondPass: null,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      options.source = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--source=')) {
      options.source = arg.slice('--source='.length);
    } else if (arg === '--actual') {
      options.actual = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--actual=')) {
      options.actual = arg.slice('--actual='.length);
    } else if (arg === '--second-pass') {
      options.secondPass = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--second-pass=')) {
      options.secondPass = arg.slice('--second-pass='.length);
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
  if (!options.source || !options.actual) throw new Error(usage());
  const sourceSnapshot = readJson(options.source);
  const actualSnapshot = readJson(options.actual);
  const auditOptions = {};
  if (options.secondPass) auditOptions.secondPassSnapshot = readJson(options.secondPass);
  const report = auditParentPageFurniture(sourceSnapshot, actualSnapshot, auditOptions);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.out) {
    const outPath = path.resolve(options.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, json, 'utf8');
    return JSON.stringify({
      ok: true,
      out: outPath,
      summary: report.summary,
      metrics: report.metrics,
      stability: report.stability,
    }, null, 2);
  }
  return json;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function readValue(argv, index, arg) {
  if (index >= argv.length || argv[index].startsWith('--')) throw new Error(`Missing value for ${arg}`);
  return argv[index];
}

function usage() {
  return [
    'Usage: node scripts/audit-parent-page-furniture.js --source <original-reverse-snapshot.json> --actual <roundtrip-reverse-snapshot.json> [--out <report.json>]',
    '       [--second-pass <second-pass-reverse-snapshot.json>]',
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
