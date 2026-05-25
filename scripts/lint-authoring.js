#!/usr/bin/env node

const path = require('path');
const { renderSnapshot, validateAuthoringRules } = require('../src/paged-html');
const { checkAuthorPackageEntry } = require('../src/authoring');

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || (!options.html && !options.packagePath)) {
    printUsage(options.html || options.packagePath ? 0 : 1);
    return;
  }

  let htmlPath;
  if (options.packagePath) {
    const packageCheck = checkAuthorPackageEntry(path.resolve(options.packagePath));
    if (!packageCheck.ok) {
      const message = `AUTHOR_GENERATED_ENTRY_DIRTY: ${packageCheck.message}: ${packageCheck.entryPath}`;
      if (options.json) {
        console.log(JSON.stringify({
          ok: false,
          errors: [{ code: 'AUTHOR_GENERATED_ENTRY_DIRTY', message, entryPath: packageCheck.entryPath }],
          warnings: [],
          messages: [{ level: 'error', code: 'AUTHOR_GENERATED_ENTRY_DIRTY', message, entryPath: packageCheck.entryPath }],
        }, null, 2));
      } else {
        console.error(message);
      }
      process.exit(1);
    }
    htmlPath = packageCheck.entryPath;
  } else {
    htmlPath = path.resolve(options.html);
  }

  const snapshot = await renderSnapshot({ htmlPath });
  const result = validateAuthoringRules(snapshot, {
    strict: options.strict,
    gridTolerance: options.gridTolerance,
  });

  if (options.json) {
    console.log(JSON.stringify({
      ok: result.valid,
      htmlPath,
      ...result,
    }, null, 2));
  } else {
    printHumanReport(htmlPath, result);
  }

  if (!result.valid) process.exit(1);
}

function parseArgs(args) {
  const out = {
    html: null,
    packagePath: null,
    strict: false,
    json: false,
    help: false,
    gridTolerance: undefined,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') continue;
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--package') out.packagePath = args[index += 1];
    else if (arg.startsWith('--package=')) out.packagePath = arg.slice('--package='.length);
    else if (arg === '--html') out.html = args[index += 1];
    else if (arg.startsWith('--html=')) out.html = arg.slice('--html='.length);
    else if (arg === '--grid-tolerance') out.gridTolerance = Number(args[index += 1]);
    else if (arg.startsWith('--grid-tolerance=')) out.gridTolerance = Number(arg.slice('--grid-tolerance='.length));
    else if (!out.html) out.html = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printUsage(exitCode) {
  const usage = [
    'Usage: npm run lint:authoring -- <file> [--strict] [--json] [--grid-tolerance <mm>]',
    '       npm run lint:authoring -- -- --html <file> [--strict] [--json]',
    '       npm run lint:authoring -- -- --package <deck.config.json> [--strict] [--json]',
    '',
    'Options:',
    '  --html <file>            HTML file to snapshot and validate.',
    '  --package <file>         Authoring source package config; generated deck.html must be current.',
    '  --strict                 Treat authoring warnings as errors.',
    '  --json                   Print machine-readable validation output.',
    '  --grid-tolerance <mm>    Edge alignment tolerance in millimeters. Defaults to 1.',
  ].join('\n');
  const writer = exitCode ? console.error : console.log;
  writer(usage);
  process.exit(exitCode);
}

function printHumanReport(htmlPath, result) {
  console.log(`Authoring rules: ${result.valid ? 'OK' : 'FAILED'}`);
  console.log(`Source: ${htmlPath}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  for (const entry of result.messages) {
    const item = entry.itemId ? ` item=${entry.itemId}` : '';
    const edges = entry.edges && entry.edges.length ? ` edges=${entry.edges.join(',')}` : '';
    console.log(`[${entry.level}] ${entry.code} page=${entry.pageId}${item}${edges} ${entry.message}`);
  }
}
