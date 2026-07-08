const test = require('node:test');
const assert = require('node:assert/strict');

const {
  safeAuthorClassToken,
  safeMigrationClassToken,
  safeVisualClassToken,
} = require('../../src/shared/style-utils');

test('safeAuthorClassToken preserves existing author CSS class token behavior', () => {
  assert.equal(safeAuthorClassToken(' [Body Copy]/A  '), '--Body-Copy--A--');
  assert.equal(safeAuthorClassToken(''), 'style');
});

test('safeMigrationClassToken preserves blueprint migration token behavior', () => {
  assert.equal(safeMigrationClassToken(' 项目 名/01 '), '项目-名-01');
  assert.equal(safeMigrationClassToken(''), 'item');
});

test('safeVisualClassToken preserves visual HTML token cleanup behavior', () => {
  assert.equal(safeVisualClassToken(' [Body Copy]/A  '), 'Body-Copy-A');
  assert.equal(safeVisualClassToken('[]'), 'style');
});
