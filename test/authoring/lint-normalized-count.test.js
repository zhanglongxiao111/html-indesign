const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLintPayload } = require('../../src/authoring/lint');

test('normalized entries leave warningCount and fold into normalizedSummary', () => {
  const payload = normalizeLintPayload({
    errors: [],
    warnings: [
      { level: 'warning', code: 'HTML_ROLE_INFERRED', action: 'normalized' },
      { level: 'warning', code: 'HTML_ROLE_INFERRED', action: 'normalized' },
      { level: 'warning', code: 'SEMANTIC_TOKEN_MISSING', action: 'normalized' },
      { level: 'warning', code: 'GRID_ALIGNMENT_OFF' },
    ],
  });
  assert.equal(payload.warningCount, 1);
  assert.equal(payload.warnings.length, 1);
  assert.equal(payload.warnings[0].code, 'GRID_ALIGNMENT_OFF');
  assert.equal(payload.normalizedCount, 3);
  assert.deepEqual(payload.normalizedSummary, [
    { code: 'HTML_ROLE_INFERRED', count: 2 },
    { code: 'SEMANTIC_TOKEN_MISSING', count: 1 },
  ]);
  assert.equal(payload.messages.length, 4);
  assert.equal(payload.issueCount, 4);
});

test('payloads without normalized entries keep their counts unchanged', () => {
  const payload = normalizeLintPayload({
    errors: [{ level: 'error', code: 'X' }],
    warnings: [{ level: 'warning', code: 'Y' }],
  });
  assert.equal(payload.errorCount, 1);
  assert.equal(payload.warningCount, 1);
  assert.equal(payload.normalizedCount, 0);
  assert.deepEqual(payload.normalizedSummary, []);
});

test('grid exemption and offset counts pass through normalizeLintPayload as numbers', () => {
  const payload = normalizeLintPayload({
    errors: [],
    warnings: [],
    gridIgnoredCount: 1147,
    gridOffCount: '3',
  });
  assert.equal(payload.gridIgnoredCount, 1147);
  assert.equal(payload.gridOffCount, 3);

  const missing = normalizeLintPayload({ errors: [], warnings: [] });
  assert.equal(missing.gridIgnoredCount, 0);
  assert.equal(missing.gridOffCount, 0);
});
