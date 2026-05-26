#!/usr/bin/env node

'use strict';

const { initProjectSemanticPreset } = require('../src/semantic-preset/init');

main();

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.packagePath) {
    printUsage(options.packagePath ? 0 : 1);
    return;
  }

  try {
    const result = initProjectSemanticPreset(options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`Initialized project semantic preset: ${result.preset.relativePath}`);
  } catch (error) {
    const payload = {
      ok: false,
      code: error && error.code ? error.code : 'SEMANTIC_PRESET_INIT_FAILED',
      message: error && error.message ? error.message : String(error),
      details: error && error.details ? error.details : {},
    };
    if (options.json) {
      console.error(JSON.stringify(payload, null, 2));
    } else {
      console.error(`${payload.code}: ${payload.message}`);
    }
    process.exit(1);
  }
}

function parseArgs(args) {
  const out = {
    packagePath: null,
    profile: null,
    out: null,
    force: false,
    json: false,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--force') out.force = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--package') out.packagePath = args[index += 1];
    else if (arg.startsWith('--package=')) out.packagePath = arg.slice('--package='.length);
    else if (arg === '--profile') out.profile = args[index += 1];
    else if (arg.startsWith('--profile=')) out.profile = arg.slice('--profile='.length);
    else if (arg === '--out') out.out = args[index += 1];
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (!out.packagePath) out.packagePath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printUsage(exitCode) {
  const usage = [
    'Usage: npm run preset:init -- -- --package <deck.config.json> [--profile <id>] [--out <file>] [--force] [--json]',
    '',
    'Options:',
    '  --package <file>  Authoring source package config.',
    '  --profile <id>    Standard preset profile to copy. Defaults to package profile.',
    '  --out <file>      Output path inside authoring package. Defaults to semantic-preset.json.',
    '  --force           Overwrite an existing project preset.',
    '  --json            Print machine-readable output.',
  ].join('\n');
  const writer = exitCode ? console.error : console.log;
  writer(usage);
  process.exit(exitCode);
}
