const test = require('node:test');
const assert = require('node:assert/strict');
const { roleFromItem } = require('../../src/adapters/html/reader/candidate-elements');

test('roleFromItem uses protocol role for inline svg vectors without asset sources', () => {
  const role = roleFromItem({
    tagName: 'svg',
    attributes: {
      'data-id-object': '',
      'data-id-role': 'shape',
      'data-id-vector': 'polygon',
    },
    computedStyle: {},
    authoredStyle: {},
  });

  assert.equal(role, 'shape');
});

test('roleFromItem keeps sourced svg assets as graphics', () => {
  const role = roleFromItem({
    tagName: 'svg',
    attributes: {
      src: './diagram.svg',
      'data-id-object': '',
      'data-id-role': 'shape',
      'data-id-vector': 'polygon',
    },
    computedStyle: {},
    authoredStyle: {},
  });

  assert.equal(role, 'graphic');
});

test('roleFromItem treats annotation as semantic metadata instead of a physical role override', () => {
  const role = roleFromItem({
    tagName: 'div',
    attributes: {
      'data-id-role': 'annotation',
      'data-id-object': '',
    },
    classList: ['annotation'],
  });

  assert.equal(role, 'shape');
});
