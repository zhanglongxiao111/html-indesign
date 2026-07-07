const test = require('node:test');
const assert = require('node:assert/strict');

const { compareViolationsToBaseline } = require('./helpers/baseline-ratchet');

test('compareViolationsToBaseline reports new violations and expired exemptions', () => {
  const result = compareViolationsToBaseline({
    actualViolations: [
      { rule: 'G1', file: 'src/new.js', detail: 'new edge' },
      { rule: 'G1', file: 'src/kept.js', detail: 'known edge' },
    ],
    baseline: {
      exemptions: [
        { rule: 'G1', file: 'src/kept.js', detail: 'known edge', reason: 'existing debt', cleanupRef: 'W3' },
        { rule: 'G1', file: 'src/fixed.js', detail: 'old edge', reason: 'existing debt', cleanupRef: 'W3' },
      ],
    },
  });

  assert.equal(result.passed, false);
  assert.deepEqual(result.newViolations, [
    { rule: 'G1', file: 'src/new.js', detail: 'new edge' },
  ]);
  assert.deepEqual(result.expiredExemptions, [
    { rule: 'G1', file: 'src/fixed.js', detail: 'old edge', reason: 'existing debt', cleanupRef: 'W3' },
  ]);
});

test('compareViolationsToBaseline passes only when actual violations exactly match baseline exemptions', () => {
  const result = compareViolationsToBaseline({
    actualViolations: [
      { rule: 'G8', file: 'src/orphan.js', detail: 'unreachable module' },
    ],
    baseline: {
      exemptions: [
        { rule: 'G8', file: 'src/orphan.js', detail: 'unreachable module', reason: 'pending removal', cleanupRef: 'W0' },
      ],
    },
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.newViolations, []);
  assert.deepEqual(result.expiredExemptions, []);
});

test('compareViolationsToBaseline rejects malformed baseline entries instead of falling back', () => {
  assert.throws(
    () => compareViolationsToBaseline({
      actualViolations: [],
      baseline: { exemptions: [{ rule: 'G1', file: 'src/a.js', reason: 'missing detail', cleanupRef: 'W3' }] },
    }),
    /baseline\.exemptions\[0\]\.detail is required/
  );
});
