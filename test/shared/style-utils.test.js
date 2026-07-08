const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseZIndex,
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

test('parseZIndex preserves browser snapshot z-index normalization behavior', () => {
  assert.equal(parseZIndex(null), 0);
  assert.equal(parseZIndex(undefined), 0);
  assert.equal(parseZIndex('auto'), 0);
  assert.equal(parseZIndex('12'), 12);
  assert.equal(parseZIndex('3.5'), 3.5);
  assert.equal(parseZIndex(0), 0);
  assert.equal(parseZIndex('0'), 0);
  assert.equal(parseZIndex('-2'), -2);
  assert.equal(parseZIndex('front'), 0);
});
