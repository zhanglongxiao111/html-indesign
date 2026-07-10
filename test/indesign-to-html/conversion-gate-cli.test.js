const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const cli = require('../../scripts/audit-conversion-gate');
const {
  buildGateReport,
  DEFAULT_THRESHOLDS,
  summaryFor,
} = require('../../src/writers/html/audit/conversion-gate');
const { parseArgs, run } = cli;

test('audit-conversion-gate CLI reuses the src conversion gate module', () => {
  assert.equal(cli.buildGateReport, buildGateReport);
  assert.equal(cli.summaryFor, summaryFor);
  assert.deepEqual(DEFAULT_THRESHOLDS, {
    p0: 0,
    p1: 0,
    htmlMissing: 0,
    htmlGeometry: 0,
    htmlText: 0,
    htmlPageMismatches: 0,
  });
});

test('package exposes conversion gate and author editability audit commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

  assert.equal(pkg.scripts['audit:conversion-gate'], 'node scripts/audit-conversion-gate.js');
  assert.equal(pkg.scripts['audit:author-editability'], 'node scripts/audit-author-editability.js');
  assert.equal(pkg.scripts['audit:trusted-source-preservation'], 'node scripts/audit-trusted-source-preservation.js');
});

test('audit-conversion-gate passes when effective diff and HTML visual budgets are satisfied', () => {
  const root = fixtureRoot('conversion-gate-pass');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 703 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 19,
    textMismatches: 0,
  }));
  const editability = writeJson(root, 'editability.json', editabilityReport({
    looseTopLevelObjects: 537,
    coverageRatio: 0.22,
    inlineStyleElements: 638,
  }));
  const caseFile = writeJson(root, 'case.json', {
    effectiveDiff,
    reverseVisual,
    editability,
    thresholds: {
      p0: 0,
      p1: 0,
      htmlMissing: 0,
      htmlGeometry: 19,
      htmlText: 0,
    },
  });
  const out = path.join(root, 'gate-report.json');

  const summary = JSON.parse(run(parseArgs(['--case', caseFile, '--out', out])));
  const report = JSON.parse(fs.readFileSync(out, 'utf8'));

  assert.equal(summary.ok, true);
  assert.equal(summary.gates.effectiveDiff.p1.count, 0);
  assert.equal(summary.gates.reverseVisual.geometry.count, 19);
  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
});

test('audit-conversion-gate fails with concrete reasons when hard budgets regress', () => {
  const root = fixtureRoot('conversion-gate-fail');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 1, p1: 2, p2: 10 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 1,
    mismatched: 20,
    textMismatches: 1,
  }));

  const summary = JSON.parse(run(parseArgs([
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
    '--p0-budget', '0',
    '--p1-budget', '0',
    '--html-missing-budget', '0',
    '--html-geometry-budget', '19',
    '--html-text-budget', '0',
  ])));

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failures.map((failure) => failure.code), [
    'CONVERSION_GATE_P0_OVER_BUDGET',
    'CONVERSION_GATE_P1_OVER_BUDGET',
    'CONVERSION_GATE_HTML_MISSING_OVER_BUDGET',
    'CONVERSION_GATE_HTML_GEOMETRY_OVER_BUDGET',
    'CONVERSION_GATE_HTML_TEXT_OVER_BUDGET',
  ]);
});

test('src conversion gate module builds report and summary directly', () => {
  const root = fixtureRoot('conversion-gate-src-direct');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 3 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 2,
    textMismatches: 0,
  }));

  const report = buildGateReport({
    effectiveDiffPath: effectiveDiff,
    reverseVisualPath: reverseVisual,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      htmlGeometry: 2,
    },
  });
  const summary = summaryFor(report);

  assert.equal(report.kind, 'ConversionGateReport');
  assert.equal(report.ok, true);
  assert.equal(report.inputs.effectiveDiff, effectiveDiff);
  assert.equal(summary.ok, true);
  assert.equal(summary.gates.reverseVisual.geometry.count, 2);
});

test('audit-conversion-gate fails when trusted source preservation regresses', () => {
  const root = fixtureRoot('conversion-gate-trusted-source-fail');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  }));
  const trustedSource = writeJson(root, 'trusted-source.json', {
    kind: 'TrustedSourcePreservationAudit',
    ok: false,
    summary: {
      trustedPages: 0,
      trustedItems: 2,
      checked: 2,
      mutations: 1,
      missing: 0,
    },
    failures: [
      {
        code: 'TRUSTED_SOURCE_STRUCTURE_MUTATED',
        itemId: 'copy-1',
        changedFields: ['structure'],
      },
    ],
  });

  const summary = JSON.parse(run(parseArgs([
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
    '--trusted-source', trustedSource,
  ])));

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failures.map((failure) => failure.code), [
    'CONVERSION_GATE_TRUSTED_SOURCE_MUTATED',
  ]);
  assert.equal(summary.gates.trustedSource.summary.mutations, 1);
});

test('audit-conversion-gate rejects malformed trusted source reports instead of passing empty data', () => {
  const root = fixtureRoot('conversion-gate-trusted-source-invalid');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  }));
  const trustedSource = writeJson(root, 'trusted-source.json', {
    kind: 'NotTrustedSourceAudit',
    ok: true,
    summary: {},
  });

  const summary = JSON.parse(run(parseArgs([
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
    '--trusted-source', trustedSource,
  ])));

  assert.equal(summary.ok, false);
  assert.deepEqual(summary.failures.map((failure) => failure.code), [
    'CONVERSION_GATE_TRUSTED_SOURCE_REPORT_INVALID',
  ]);
});

test('audit-conversion-gate invalid-input 必须 fail', () => {
  const root = fixtureRoot('conversion-gate-invalid-input');
  const effectiveDiff = writeJson(root, 'effective-diff.json', { kind: 'not-effective-diff' });
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  }));

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-conversion-gate.js'),
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONVERSION_GATE_INVALID_INPUT/);
});

test('audit-conversion-gate rejects parseable editability report with missing metrics', () => {
  const root = fixtureRoot('conversion-gate-invalid-editability');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  }));
  const editability = writeJson(root, 'editability.json', { ok: true, summary: {} });

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-conversion-gate.js'),
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
    '--editability', editability,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONVERSION_GATE_INVALID_INPUT/);
});

test('audit-conversion-gate rejects parseable reverse visual report with missing page mismatches', () => {
  const root = fixtureRoot('conversion-gate-invalid-reverse-visual-pages');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisualReportValue = reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  });
  delete reverseVisualReportValue.stats.pageMismatches;
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReportValue);

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-conversion-gate.js'),
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONVERSION_GATE_INVALID_INPUT/);
  assert.match(result.stderr, /pageMismatches/);
});

test('audit-conversion-gate rejects parseable trusted source report with missing summary metrics', () => {
  const root = fixtureRoot('conversion-gate-invalid-trusted-source-summary');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({
    missing: 0,
    mismatched: 0,
    textMismatches: 0,
  }));
  const trustedSource = writeJson(root, 'trusted-source.json', {
    kind: 'TrustedSourcePreservationAudit',
    ok: true,
    summary: {},
    failures: [],
  });

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-conversion-gate.js'),
    '--effective-diff', effectiveDiff,
    '--reverse-visual', reverseVisual,
    '--trusted-source', trustedSource,
  ], { cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONVERSION_GATE_INVALID_INPUT/);
  assert.match(result.stderr, /Trusted source preservation report is missing numeric summary/);
});

test('audit-conversion-gate 缺失必需报告 invalid-input 必须 fail', () => {
  const root = fixtureRoot('conversion-gate-required-missing');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({ missing: 0, mismatched: 0, textMismatches: 0 }));

  const report = buildGateReport({
    effectiveDiffPath: effectiveDiff,
    reverseVisualPath: reverseVisual,
    thresholds: DEFAULT_THRESHOLDS,
    requiredGates: ['editability', 'trustedSource'],
  });

  assert.equal(report.ok, false);
  assert.deepEqual(report.skipped.sort(), ['editability', 'trustedSource']);
  assert.equal(report.failures.filter((failure) => failure.code === 'CONVERSION_GATE_REQUIRED_REPORT_MISSING').length, 2);
});

test('audit-conversion-gate records skipped optional gates explicitly', () => {
  const root = fixtureRoot('conversion-gate-skipped-visible');
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({ missing: 0, mismatched: 0, textMismatches: 0 }));

  const report = buildGateReport({
    effectiveDiffPath: effectiveDiff,
    reverseVisualPath: reverseVisual,
    thresholds: DEFAULT_THRESHOLDS,
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.skipped.sort(), ['editability', 'trustedSource']);
});

test('audit-conversion-gate 空视觉比对 invalid-input 必须 fail', () => {
  const root = fixtureRoot('conversion-gate-nothing-compared');
  const emptyVisual = reverseVisualReport({ missing: 0, mismatched: 0, textMismatches: 0 });
  emptyVisual.stats.compared = 0;
  const effectiveDiff = writeJson(root, 'effective-diff.json', effectiveDiffReport({ p0: 0, p1: 0, p2: 0 }));
  const reverseVisual = writeJson(root, 'reverse-visual.json', emptyVisual);

  const report = buildGateReport({
    effectiveDiffPath: effectiveDiff,
    reverseVisualPath: reverseVisual,
    thresholds: DEFAULT_THRESHOLDS,
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((failure) => failure.code === 'CONVERSION_GATE_HTML_NOTHING_COMPARED'), true);
});

test('audit-conversion-gate 缺失稳定性审计在 require-stability 下必须 fail', () => {
  const root = fixtureRoot('conversion-gate-stability-required');
  const diffWithoutStability = effectiveDiffReport({ p0: 0, p1: 0, p2: 0 });
  diffWithoutStability.stability = { ok: true, available: false, auditCount: 0 };
  const effectiveDiff = writeJson(root, 'effective-diff.json', diffWithoutStability);
  const reverseVisual = writeJson(root, 'reverse-visual.json', reverseVisualReport({ missing: 0, mismatched: 0, textMismatches: 0 }));

  const report = buildGateReport({
    effectiveDiffPath: effectiveDiff,
    reverseVisualPath: reverseVisual,
    thresholds: DEFAULT_THRESHOLDS,
    requiredGates: ['stability'],
  });

  assert.equal(report.ok, false);
  assert.equal(report.failures.some((failure) => failure.code === 'CONVERSION_GATE_STABILITY_MISSING'), true);
});

function fixtureRoot(name) {
  const root = path.resolve('test/workspace', name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function writeJson(root, file, value) {
  const out = path.join(root, file);
  fs.writeFileSync(out, JSON.stringify(value, null, 2), 'utf8');
  return out;
}

function effectiveDiffReport({ p0, p1, p2 }) {
  return {
    ok: p0 === 0 && p1 === 0,
    edi: p0 * 100 + p1 * 10 + p2,
    p0: { ok: p0 === 0, count: p0 },
    p1: { ok: p1 === 0, count: p1, budget: 0 },
    p2: { ok: true, count: p2 },
    stability: { ok: true, available: true },
  };
}

function reverseVisualReport({ missing, mismatched, textMismatches }) {
  return {
    ok: missing === 0 && mismatched === 0 && textMismatches === 0,
    stats: {
      missing,
      mismatched,
      textMismatches,
      pageMismatches: 0,
      compared: 537,
      accepted: 0,
    },
    errors: [],
    warnings: [],
  };
}

function editabilityReport({ looseTopLevelObjects, coverageRatio, inlineStyleElements }) {
  return {
    kind: 'AuthorEditabilityAudit',
    ok: true,
    summary: {
      pages: 1,
      sourcePageFiles: 1,
      idElements: 537,
      objectIdElements: 537,
      semanticContainerElements: 118,
      coveredObjectIdElements: Math.round(537 * coverageRatio),
      looseTopLevelObjects,
      inlineStyleElements,
      lowLevelGeometryAttrs: 0,
      vectorSvgElements: 0,
      figureCaptionPairs: 0,
      textElements: 100,
      characterStyleSpans: 0,
      semanticContainerCoverage: {
        covered: Math.round(537 * coverageRatio),
        total: 537,
        ratio: coverageRatio,
      },
    },
    pages: [],
    failures: [],
    warnings: [],
  };
}
