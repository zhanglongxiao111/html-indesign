#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_THRESHOLDS = {
  p0: 0,
  p1: 0,
  htmlMissing: 0,
  htmlGeometry: 0,
  htmlText: 0,
  htmlPageMismatches: 0,
};

function parseArgs(argv) {
  const options = {
    caseFile: null,
    effectiveDiff: null,
    reverseVisual: null,
    editability: null,
    trustedSource: null,
    out: null,
    thresholds: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--case') {
      options.caseFile = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--case=')) {
      options.caseFile = arg.slice('--case='.length);
    } else if (arg === '--effective-diff') {
      options.effectiveDiff = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--effective-diff=')) {
      options.effectiveDiff = arg.slice('--effective-diff='.length);
    } else if (arg === '--reverse-visual') {
      options.reverseVisual = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--reverse-visual=')) {
      options.reverseVisual = arg.slice('--reverse-visual='.length);
    } else if (arg === '--editability') {
      options.editability = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--editability=')) {
      options.editability = arg.slice('--editability='.length);
    } else if (arg === '--trusted-source') {
      options.trustedSource = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--trusted-source=')) {
      options.trustedSource = arg.slice('--trusted-source='.length);
    } else if (arg === '--out') {
      options.out = readValue(argv, ++index, arg);
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--p0-budget') {
      options.thresholds.p0 = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--p0-budget=')) {
      options.thresholds.p0 = numberOption(arg.slice('--p0-budget='.length), '--p0-budget');
    } else if (arg === '--p1-budget') {
      options.thresholds.p1 = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--p1-budget=')) {
      options.thresholds.p1 = numberOption(arg.slice('--p1-budget='.length), '--p1-budget');
    } else if (arg === '--html-missing-budget') {
      options.thresholds.htmlMissing = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-missing-budget=')) {
      options.thresholds.htmlMissing = numberOption(arg.slice('--html-missing-budget='.length), '--html-missing-budget');
    } else if (arg === '--html-geometry-budget') {
      options.thresholds.htmlGeometry = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-geometry-budget=')) {
      options.thresholds.htmlGeometry = numberOption(arg.slice('--html-geometry-budget='.length), '--html-geometry-budget');
    } else if (arg === '--html-text-budget') {
      options.thresholds.htmlText = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-text-budget=')) {
      options.thresholds.htmlText = numberOption(arg.slice('--html-text-budget='.length), '--html-text-budget');
    } else if (arg === '--html-page-budget') {
      options.thresholds.htmlPageMismatches = numberOption(readValue(argv, ++index, arg), arg);
    } else if (arg.startsWith('--html-page-budget=')) {
      options.thresholds.htmlPageMismatches = numberOption(arg.slice('--html-page-budget='.length), '--html-page-budget');
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
  const resolved = resolveOptions(options);
  if (!resolved.effectiveDiff || !resolved.reverseVisual) throw new Error(usage());
  const report = buildGateReport({
    effectiveDiffPath: resolved.effectiveDiff,
    reverseVisualPath: resolved.reverseVisual,
    editabilityPath: resolved.editability,
    trustedSourcePath: resolved.trustedSource,
    thresholds: resolved.thresholds,
  });
  if (resolved.out) {
    fs.mkdirSync(path.dirname(resolved.out), { recursive: true });
    fs.writeFileSync(resolved.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return JSON.stringify(summaryFor(report), null, 2);
}

function resolveOptions(options) {
  const casePath = options.caseFile ? path.resolve(options.caseFile) : null;
  const caseConfig = casePath ? readJson(casePath) : {};
  const baseDir = casePath ? path.dirname(casePath) : process.cwd();
  return {
    effectiveDiff: resolveInputPath(options.effectiveDiff || caseConfig.effectiveDiff, baseDir),
    reverseVisual: resolveInputPath(options.reverseVisual || caseConfig.reverseVisual, baseDir),
    editability: resolveInputPath(options.editability || caseConfig.editability, baseDir),
    trustedSource: resolveInputPath(options.trustedSource || caseConfig.trustedSource, baseDir),
    out: options.out ? path.resolve(options.out) : null,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...(caseConfig.thresholds || {}),
      ...definedEntries(options.thresholds),
    },
  };
}

function buildGateReport({ effectiveDiffPath, reverseVisualPath, editabilityPath, trustedSourcePath, thresholds }) {
  const effectiveDiff = readJson(effectiveDiffPath);
  const reverseVisual = readJson(reverseVisualPath);
  const editability = editabilityPath ? readJson(editabilityPath) : null;
  const trustedSource = trustedSourcePath ? readJson(trustedSourcePath) : null;
  assertEffectiveDiffReport(effectiveDiff, effectiveDiffPath);
  assertReverseVisualReport(reverseVisual, reverseVisualPath);
  if (editability) assertEditabilityReport(editability, editabilityPath);
  const failures = [];
  const gates = {
    effectiveDiff: effectiveDiffGate(effectiveDiff, thresholds, failures),
    reverseVisual: reverseVisualGate(reverseVisual, thresholds, failures),
  };
  if (editability) {
    gates.editability = editabilityGate(editability, failures);
  }
  if (trustedSource) {
    gates.trustedSource = trustedSourceGate(trustedSource, failures);
  }
  return {
    kind: 'ConversionGateReport',
    ok: failures.length === 0,
    thresholds,
    inputs: {
      effectiveDiff: effectiveDiffPath,
      reverseVisual: reverseVisualPath,
      editability: editabilityPath || null,
      trustedSource: trustedSourcePath || null,
    },
    gates,
    failures,
  };
}

function effectiveDiffGate(report, thresholds, failures) {
  const p0 = metric('p0', report && report.p0 && report.p0.count, thresholds.p0);
  const p1 = metric('p1', report && report.p1 && report.p1.count, thresholds.p1);
  const p2 = {
    count: numberOr(report && report.p2 && report.p2.count, 0),
    advisory: true,
  };
  addBudgetFailure(failures, 'CONVERSION_GATE_P0_OVER_BUDGET', 'ID P0 content loss exceeds budget.', p0);
  addBudgetFailure(failures, 'CONVERSION_GATE_P1_OVER_BUDGET', 'ID P1 effective structure loss exceeds budget.', p1);
  const stability = report && report.stability ? {
    ok: report.stability.ok !== false,
    available: Boolean(report.stability.available),
    auditCount: report.stability.auditCount || 0,
  } : { ok: true, available: false, auditCount: 0 };
  if (!stability.ok) {
    failures.push({
      code: 'CONVERSION_GATE_STABILITY_FAILED',
      message: 'Second-pass structure stability audit failed.',
      actual: false,
      budget: true,
    });
  }
  return {
    ok: p0.ok && p1.ok && stability.ok,
    p0,
    p1,
    p2,
    stability,
    edi: numberOr(report && report.edi, 0),
  };
}

function reverseVisualGate(report, thresholds, failures) {
  const stats = report && report.stats || {};
  const missing = metric('missing', stats.missing, thresholds.htmlMissing);
  const geometry = metric('geometry', stats.mismatched, thresholds.htmlGeometry);
  const text = metric('text', stats.textMismatches, thresholds.htmlText);
  const pages = metric('pages', stats.pageMismatches, thresholds.htmlPageMismatches);
  addBudgetFailure(failures, 'CONVERSION_GATE_HTML_MISSING_OVER_BUDGET', 'Author HTML is missing visual elements beyond budget.', missing);
  addBudgetFailure(failures, 'CONVERSION_GATE_HTML_GEOMETRY_OVER_BUDGET', 'Author HTML geometry mismatches exceed budget.', geometry);
  addBudgetFailure(failures, 'CONVERSION_GATE_HTML_TEXT_OVER_BUDGET', 'Author HTML text mismatches exceed budget.', text);
  addBudgetFailure(failures, 'CONVERSION_GATE_HTML_PAGE_OVER_BUDGET', 'Author HTML page mismatches exceed budget.', pages);
  return {
    ok: missing.ok && geometry.ok && text.ok && pages.ok,
    missing,
    geometry,
    text,
    pages,
    compared: numberOr(stats.compared, 0),
    accepted: numberOr(stats.accepted, 0),
  };
}

function editabilityGate(report, failures) {
  const gate = {
    ok: report.ok !== false,
    metrics: {
      looseTopLevelObjects: numberOr(report.summary && report.summary.looseTopLevelObjects, 0),
      semanticContainerCoverage: numberOr(
        report.summary && report.summary.semanticContainerCoverage && report.summary.semanticContainerCoverage.ratio,
        0,
      ),
      inlineStyleElements: numberOr(report.summary && report.summary.inlineStyleElements, 0),
      lowLevelGeometryAttrs: numberOr(report.summary && report.summary.lowLevelGeometryAttrs, 0),
      vectorSvgElements: numberOr(report.summary && report.summary.vectorSvgElements, 0),
    },
    failures: Array.isArray(report.failures) ? report.failures : [],
  };
  if (!gate.ok) {
    failures.push({
      code: 'CONVERSION_GATE_EDITABILITY_FAILED',
      message: 'Author editability audit failed its configured budgets.',
      actual: false,
      budget: true,
      failures: gate.failures,
    });
  }
  return gate;
}

function trustedSourceGate(report, failures) {
  const audit = report && report.trustedSourcePreservation
    ? report.trustedSourcePreservation
    : report;
  if (!audit || audit.kind !== 'TrustedSourcePreservationAudit') {
    const gate = {
      ok: false,
      summary: {
        trustedPages: 0,
        trustedItems: 0,
        checked: 0,
        mutations: 0,
        missing: 0,
      },
      failures: [{
        code: 'TRUSTED_SOURCE_REPORT_INVALID',
        message: 'Trusted source preservation report is missing or invalid.',
      }],
    };
    failures.push({
      code: 'CONVERSION_GATE_TRUSTED_SOURCE_REPORT_INVALID',
      message: 'Trusted source preservation report is missing or invalid.',
      actual: false,
      budget: true,
    });
    return gate;
  }
  const gate = {
    ok: audit && audit.ok !== false,
    summary: {
      trustedPages: numberOr(audit && audit.summary && audit.summary.trustedPages, 0),
      trustedItems: numberOr(audit && audit.summary && audit.summary.trustedItems, 0),
      checked: numberOr(audit && audit.summary && audit.summary.checked, 0),
      mutations: numberOr(audit && audit.summary && audit.summary.mutations, 0),
      missing: numberOr(audit && audit.summary && audit.summary.missing, 0),
    },
    failures: Array.isArray(audit && audit.failures) ? audit.failures : [],
  };
  if (!gate.ok) {
    failures.push({
      code: 'CONVERSION_GATE_TRUSTED_SOURCE_MUTATED',
      message: 'Trusted author source structure changed during semantic reconstruction.',
      actual: gate.summary.mutations + gate.summary.missing,
      budget: 0,
      failures: gate.failures,
    });
  }
  return gate;
}

function assertEffectiveDiffReport(report, file) {
  if (!isObject(report)
    || !isObject(report.p0)
    || !isObject(report.p1)
    || !Number.isFinite(Number(report.p0.count))
    || !Number.isFinite(Number(report.p1.count))) {
    throw invalidInput(`Effective diff report is missing numeric p0.count or p1.count: ${file}`);
  }
}

function assertReverseVisualReport(report, file) {
  const stats = report && report.stats;
  if (!isObject(report)
    || !isObject(stats)
    || !Number.isFinite(Number(stats.missing))
    || !Number.isFinite(Number(stats.mismatched))
    || !Number.isFinite(Number(stats.textMismatches))) {
    throw invalidInput(`Reverse visual report is missing numeric stats: ${file}`);
  }
}

function assertEditabilityReport(report, file) {
  if (!isObject(report) || !isObject(report.summary)) {
    throw invalidInput(`Author editability report is missing summary metrics: ${file}`);
  }
}

function metric(name, count, budget) {
  const actual = numberOr(count, 0);
  const threshold = numberOr(budget, 0);
  return {
    name,
    count: actual,
    budget: threshold,
    ok: actual <= threshold,
  };
}

function addBudgetFailure(failures, code, message, value) {
  if (value.ok) return;
  failures.push({
    code,
    message,
    actual: value.count,
    budget: value.budget,
  });
}

function summaryFor(report) {
  return {
    ok: report.ok,
    gates: report.gates,
    failures: report.failures,
  };
}

function resolveInputPath(value, baseDir) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw invalidInput(`Invalid JSON input: ${file}: ${error.message}`);
  }
}

function definedEntries(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidInput(message) {
  return new Error(`CONVERSION_GATE_INVALID_INPUT: ${message}`);
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
    'Usage: node scripts/audit-conversion-gate.js --case <gate.case.json> [--out report.json]',
    '   or: node scripts/audit-conversion-gate.js --effective-diff <report.json> --reverse-visual <report.json> [--editability <report.json>] [--trusted-source <report.json>]',
    '       [--p0-budget 0] [--p1-budget 0] [--html-missing-budget 0]',
    '       [--html-geometry-budget 0] [--html-text-budget 0] [--html-page-budget 0]',
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
  buildGateReport,
};
