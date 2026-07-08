const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLineEndings,
  collapseWhitespace,
  normalizeInstructionText,
} = require('../../src/shared/text');

test('normalizeLineEndings preserves spacing while normalizing CRLF and CR', () => {
  assert.equal(normalizeLineEndings('  A\r\nB\rC  '), '  A\nB\nC  ');
  assert.equal(normalizeLineEndings(null), '');
});

test('collapseWhitespace folds regular whitespace and NBSP into single spaces', () => {
  assert.equal(collapseWhitespace('  A\u00a0B\r\n C\tD  '), 'A B C D');
  assert.equal(collapseWhitespace(undefined), '');
});

test('normalizeInstructionText uses shared whitespace normalization semantics', () => {
  assert.equal(normalizeInstructionText('  总图\u00a0说明\r\n 分段\t文本  '), '总图 说明 分段 文本');
  assert.equal(normalizeInstructionText(null), '');
});
