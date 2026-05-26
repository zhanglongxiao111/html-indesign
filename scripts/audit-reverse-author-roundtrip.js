#!/usr/bin/env node

const { auditAuthorSourceRoundtrip } = require('../src/indesign-reverse/source-roundtrip-diff');

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
    'Usage: node scripts/audit-reverse-author-roundtrip.js --source <source-author-root> --reverse <reverse-author-root> [--strict] [--json]',
    '',
    'Default mode reports source-level losses as warnings and exits 0.',
    'Strict mode reports source-level losses as errors and exits 1.',
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
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  if (!report.ok) process.exitCode = 1;
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
