#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { auditSynthesizedStyles } = require('../src/adapters/indesign/audit/synthesized-style-audit');
const { validateSemanticModel } = require('../src/semantic-model');

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.model) {
    throw new Error('SYNTHESIZED_STYLE_AUDIT_MODEL_REQUIRED: pass --model <semantic-model.json>');
  }
  const modelPath = path.resolve(args.model);
  const model = readJson(modelPath);
  assertDocumentModel(model, modelPath);
  const report = auditSynthesizedStyles(model);
  const json = JSON.stringify(report, null, 2);
  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${json}\n`, 'utf8');
  }
  process.stdout.write(`${json}\n`);
  if (!report.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--model') {
      args.model = readValue(argv, ++index, arg);
    } else if (arg === '--out') {
      args.out = readValue(argv, ++index, arg);
    } else {
      throw new Error(`SYNTHESIZED_STYLE_AUDIT_ARG_UNKNOWN:${arg}`);
    }
  }
  return args;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw invalidInput(`Invalid JSON input: ${file}: ${error.message}`);
  }
}

function assertDocumentModel(model, file) {
  if (!model || model.kind !== 'DocumentModel') {
    throw invalidInput(`Expected DocumentModel semantic model: ${file}`);
  }
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

function invalidInput(message) {
  return new Error(`SYNTHESIZED_STYLE_INVALID_INPUT: ${message}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message || String(error)}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
