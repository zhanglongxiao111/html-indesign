const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLineEndings,
  collapseWhitespace,
} = require('../../src/shared/text');

test('normalizeLineEndings preserves spacing while normalizing CRLF and CR', () => {
  assert.equal(normalizeLineEndings('  A\r\nB\rC  '), '  A\nB\nC  ');
  assert.equal(normalizeLineEndings(null), '');
});

test('collapseWhitespace folds regular whitespace and NBSP into single spaces', () => {
  assert.equal(collapseWhitespace('  A\u00a0B\r\n C\tD  '), 'A B C D');
  assert.equal(collapseWhitespace(undefined), '');
});
