const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  parseArgs,
  run,
} = require('../../scripts/audit-conversion-gate');

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
  const editability = writeJson(root, 'editability.json', {
    ok: true,
    summary: {
      looseTopLevelObjects: 537,
      semanticContainerCoverage: { ratio: 0.22 },
      inlineStyleElements: 638,
    },
    failures: [],
  });
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
    summary: { trustedItems: 2, mutations: 1 },
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
