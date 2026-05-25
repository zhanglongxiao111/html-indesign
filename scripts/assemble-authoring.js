#!/usr/bin/env node

const path = require('path');
const { checkAuthorPackageEntry, writeAuthorPackageEntry } = require('../src/authoring');

main();

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help || !options.packagePath) {
      printUsage(options.packagePath ? 0 : 1);
      return;
    }

    const configPath = path.resolve(options.packagePath);
    if (options.check) {
      const result = checkAuthorPackageEntry(configPath);
      if (!result.ok) {
        console.error(`${result.message}: ${result.entryPath}`);
        process.exit(1);
      }
      console.log(`Authoring package is up to date: ${result.entryPath}`);
      return;
    }

    const result = writeAuthorPackageEntry(configPath);
    console.log(`Wrote ${result.entryPath}`);
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
}

function parseArgs(args) {
  const out = { packagePath: null, check: false, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--check') out.check = true;
    else if (arg === '--package') out.packagePath = args[index += 1];
    else if (arg.startsWith('--package=')) out.packagePath = arg.slice('--package='.length);
    else if (!out.packagePath) out.packagePath = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printUsage(exitCode) {
  const usage = [
    'Usage: npm run assemble:authoring -- -- --package <deck.config.json> [--check]',
    '',
    'Options:',
    '  --package <file>  Authoring source package config.',
    '  --check           Verify generated deck.html is up to date.',
  ].join('\n');
  const writer = exitCode ? console.error : console.log;
  writer(usage);
  process.exit(exitCode);
}
