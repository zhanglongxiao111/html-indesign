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

function buildGateReport({ effectiveDiffPath, reverseVisualPath, editabilityPath, trustedSourcePath, thresholds }) {
  const effectiveDiff = readJson(effectiveDiffPath);
  const reverseVisual = readJson(reverseVisualPath);
  const editability = editabilityPath ? readJson(editabilityPath) : null;
  const trustedSource = trustedSourcePath ? readJson(trustedSourcePath) : null;
  assertEffectiveDiffReport(effectiveDiff, effectiveDiffPath);
  assertReverseVisualReport(reverseVisual, reverseVisualPath);
  if (editability) assertEditabilityReport(editability, editabilityPath);
  if (trustedSource) assertTrustedSourceReport(trustedSource, trustedSourcePath);
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
  if (!hasFiniteNumber(stats, 'pageMismatches')) {
    throw invalidInput(`Reverse visual report is missing numeric stats.pageMismatches: ${file}`);
  }
}

function assertEditabilityReport(report, file) {
  if (!isObject(report) || report.kind !== 'AuthorEditabilityAudit' || !isObject(report.summary)) {
    throw invalidInput(`Author editability report is missing summary metrics: ${file}`);
  }
  const summary = report.summary;
  const numericFields = [
    'pages',
    'sourcePageFiles',
    'idElements',
    'objectIdElements',
    'semanticContainerElements',
    'coveredObjectIdElements',
    'looseTopLevelObjects',
    'inlineStyleElements',
    'lowLevelGeometryAttrs',
    'vectorSvgElements',
    'figureCaptionPairs',
    'textElements',
    'characterStyleSpans',
  ];
  for (const field of numericFields) {
    if (!hasFiniteNumber(summary, field)) {
      throw invalidInput(`Author editability report is missing numeric summary.${field}: ${file}`);
    }
  }
  if (!isObject(summary.semanticContainerCoverage)
    || !hasFiniteNumber(summary.semanticContainerCoverage, 'covered')
    || !hasFiniteNumber(summary.semanticContainerCoverage, 'total')
    || !hasFiniteNumber(summary.semanticContainerCoverage, 'ratio')) {
    throw invalidInput(`Author editability report is missing numeric semanticContainerCoverage metrics: ${file}`);
  }
  if (!Array.isArray(report.failures)) {
    throw invalidInput(`Author editability report is missing failures array: ${file}`);
  }
}

function assertTrustedSourceReport(report, file) {
  const audit = report && report.trustedSourcePreservation
    ? report.trustedSourcePreservation
    : report;
  if (!audit || audit.kind !== 'TrustedSourcePreservationAudit') return;
  if (!isObject(audit.summary)) {
    throw invalidInput(`Trusted source preservation report is missing summary metrics: ${file}`);
  }
  const numericFields = [
    'trustedPages',
    'trustedItems',
    'checked',
    'mutations',
    'missing',
  ];
  for (const field of numericFields) {
    if (!hasFiniteNumber(audit.summary, field)) {
      throw invalidInput(`Trusted source preservation report is missing numeric summary.${field}: ${file}`);
    }
  }
  if (!Array.isArray(audit.failures)) {
    throw invalidInput(`Trusted source preservation report is missing failures array: ${file}`);
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

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  } catch (error) {
    throw invalidInput(`Invalid JSON input: ${file}: ${error.message}`);
  }
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFiniteNumber(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field) && Number.isFinite(Number(object[field]));
}

function invalidInput(message) {
  return new Error(`CONVERSION_GATE_INVALID_INPUT: ${message}`);
}

module.exports = {
  buildGateReport,
  DEFAULT_THRESHOLDS,
  summaryFor,
};
