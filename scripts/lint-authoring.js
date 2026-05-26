#!/usr/bin/env node

const path = require('path');
const { renderSnapshot, validateAuthoringRules } = require('../src/paged-html');
const { auditAuthorPackageSourceFormat, checkAuthorPackageEntry, readAuthorPackage } = require('../src/authoring');
const { auditAuthoringSemanticTokens, resolveSemanticPreset } = require('../src/semantic-preset');

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
  let sourceFormat = null;
  let semanticAudit = null;
  let semanticPreset = null;
  if (options.packagePath) {
    const packagePath = path.resolve(options.packagePath);
    const sourcePackage = readAuthorPackage(packagePath);
    const resolvedPreset = resolveSemanticPreset({
      rootDir: sourcePackage.rootDir,
      config: sourcePackage.config,
    });
    semanticPreset = publicSemanticPresetMetadata(resolvedPreset);
    sourceFormat = auditAuthorPackageSourceFormat(packagePath, { strict: options.strict });
    if (!sourceFormat.valid) {
      const payload = packageFailure(sourceFormat, null, null, semanticPreset);
      if (options.json) console.log(JSON.stringify(payload, null, 2));
      else printPackageFailure(payload);
      process.exit(1);
    }

    const packageCheck = checkAuthorPackageEntry(packagePath);
    if (!packageCheck.ok) {
      const message = `AUTHOR_GENERATED_ENTRY_DIRTY: ${packageCheck.message}: ${packageCheck.entryPath}`;
      if (options.json) {
        console.log(JSON.stringify(packageFailure(sourceFormat, {
          code: 'AUTHOR_GENERATED_ENTRY_DIRTY',
          message,
          entryPath: packageCheck.entryPath,
        }, null, semanticPreset), null, 2));
      } else {
        console.error(message);
      }
      process.exit(1);
    }
    htmlPath = packageCheck.entryPath;
    semanticAudit = auditAuthoringSemanticTokens({
      preset: resolvedPreset.preset,
      pageFiles: sourcePackage.pageFiles,
      strict: options.strict,
    });
    if (!semanticAudit.valid) {
      const payload = packageFailure(sourceFormat, null, semanticAudit, semanticPreset);
      if (options.json) console.log(JSON.stringify(payload, null, 2));
      else printPackageFailure(payload);
      process.exit(1);
    }
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
      ...(sourceFormat ? { sourceFormat } : {}),
      ...(semanticPreset ? { semanticPreset } : {}),
      ...(semanticAudit ? { semanticAudit } : {}),
      ...result,
    }, null, 2));
  } else {
    printHumanReport(htmlPath, result, sourceFormat, semanticAudit, semanticPreset);
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

function packageFailure(sourceFormat, entryIssue, semanticAudit, semanticPreset) {
  const entryErrors = entryIssue ? [{ level: 'error', ...entryIssue }] : [];
  const semanticErrors = semanticAudit ? semanticAudit.errors : [];
  const semanticWarnings = semanticAudit ? semanticAudit.warnings : [];
  const errors = entryErrors.concat(sourceFormat ? sourceFormat.errors : [], semanticErrors);
  const warnings = (sourceFormat ? sourceFormat.warnings : []).concat(semanticWarnings);
  return {
    ok: false,
    sourceFormat,
    ...(semanticPreset ? { semanticPreset } : {}),
    ...(semanticAudit ? { semanticAudit } : {}),
    errors,
    warnings,
    messages: errors.concat(warnings),
  };
}

function printPackageFailure(payload) {
  console.error('Authoring package: FAILED');
  for (const entry of payload.messages || []) {
    const file = entry.file ? ` file=${entry.file}` : '';
    console.error(`[${entry.level}] ${entry.code}${file} ${entry.message}`);
  }
}

function printHumanReport(htmlPath, result, sourceFormat = null, semanticAudit = null, semanticPreset = null) {
  console.log(`Authoring rules: ${result.valid ? 'OK' : 'FAILED'}`);
  console.log(`Source: ${htmlPath}`);
  if (semanticPreset) {
    console.log(`Semantic preset: ${semanticPreset.source}:${semanticPreset.id}`);
  }
  const messages = [
    ...(sourceFormat ? sourceFormat.messages : []),
    ...(semanticAudit ? semanticAudit.messages : []),
    ...result.messages,
  ];
  console.log(`Errors: ${(sourceFormat ? sourceFormat.errors.length : 0) + (semanticAudit ? semanticAudit.errors.length : 0) + result.errors.length}`);
  console.log(`Warnings: ${(sourceFormat ? sourceFormat.warnings.length : 0) + (semanticAudit ? semanticAudit.warnings.length : 0) + result.warnings.length}`);
  for (const entry of messages) {
    const item = entry.itemId ? ` item=${entry.itemId}` : '';
    const edges = entry.edges && entry.edges.length ? ` edges=${entry.edges.join(',')}` : '';
    const page = entry.pageId ? ` page=${entry.pageId}` : '';
    const file = entry.file ? ` file=${entry.file}` : '';
    console.log(`[${entry.level}] ${entry.code}${page}${file}${item}${edges} ${entry.message}`);
  }
}

function publicSemanticPresetMetadata(resolvedPreset) {
  return {
    source: resolvedPreset.source,
    id: resolvedPreset.preset.id,
    ...(resolvedPreset.relativePath ? { relativePath: resolvedPreset.relativePath } : {}),
    ...(resolvedPreset.profile ? { profile: resolvedPreset.profile } : {}),
  };
}
