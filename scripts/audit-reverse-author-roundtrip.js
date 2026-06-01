#!/usr/bin/env node

const {
  auditAuthorSourceRoundtrip,
  measureAuthorSourceDrift,
} = require('../src/writers/html/audit/source-roundtrip-diff');

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      options.sourceRoot = argv[++index];
    } else if (arg.startsWith('--source=')) {
      options.sourceRoot = arg.slice('--source='.length);
    } else if (arg === '--reverse') {
      options.reverseRoot = argv[++index];
    } else if (arg.startsWith('--reverse=')) {
      options.reverseRoot = arg.slice('--reverse='.length);
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg === '--drift') {
      options.drift = true;
    } else if (arg === '--fail-on-drift') {
      options.drift = true;
      options.failOnDrift = true;
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

function usage() {
  return [
    'Usage: node scripts/audit-reverse-author-roundtrip.js --source <source-author-root> --reverse <reverse-author-root> [--strict] [--drift] [--fail-on-drift] [--json]',
    '',
    'Default mode reports source-level losses as warnings and exits 0.',
    'Strict mode reports source-level losses as errors and exits 1.',
    '--drift adds an exact file-level source drift report.',
    '--fail-on-drift exits 1 when any comparable author source file changed exactly.',
  ].join('\n');
}

function printHuman(report) {
  const lines = [
    `source roundtrip: ${report.ok ? 'ok' : 'failed'}`,
    `pages compared: ${report.stats.pagesCompared}/${report.stats.pagesExpected}`,
    `warnings: ${report.warnings.length}`,
    `errors: ${report.errors.length}`,
  ];
  for (const issue of [...report.errors, ...report.warnings]) {
    lines.push(`- ${issue.severity} ${issue.code}${issue.page ? ` ${issue.page}` : ''}: ${issue.message}`);
  }
  if (report.sourceDrift) {
    lines.push(
      `source drift files changed: ${report.sourceDrift.stats.filesChanged}/${report.sourceDrift.stats.filesCompared}`,
      `source drift normalized files changed: ${report.sourceDrift.stats.normalizedFilesChanged}/${report.sourceDrift.stats.filesCompared}`,
      `source drift line edit distance: ${report.sourceDrift.stats.lineEditDistance}`
    );
  }
  console.log(lines.join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.sourceRoot || !options.reverseRoot) {
    throw new Error('Both --source and --reverse are required.');
  }

  const report = auditAuthorSourceRoundtrip(options);
  if (options.drift) {
    report.sourceDrift = measureAuthorSourceDrift({
      sourceRoot: options.sourceRoot,
      reverseRoot: options.reverseRoot,
    });
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  if (!report.ok) process.exitCode = 1;
  if (
    options.failOnDrift
    && report.sourceDrift
    && (!report.sourceDrift.ok || report.sourceDrift.stats.filesChanged > 0)
  ) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  usage,
};
