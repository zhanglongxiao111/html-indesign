const test = require('node:test');
const assert = require('node:assert/strict');
const { roleFromItem } = require('../../src/adapters/html/reader/candidate-elements');
const {
  ITEM_ROLE,
  htmlItemRoleFromElementFacts,
  registeredItemRole,
} = require('../../src/protocol');

test('htmlItemRoleFromElementFacts is the shared registry-backed SVG role source', () => {
  assert.equal(htmlItemRoleFromElementFacts({
    tagName: 'svg',
    attributes: { src: './diagram.svg', 'data-id-role': ITEM_ROLE.SHAPE },
    hasAssetSource: true,
  }), ITEM_ROLE.GRAPHIC);

  assert.equal(htmlItemRoleFromElementFacts({
    tagName: 'svg',
    attributes: { 'data-id-role': ITEM_ROLE.LINE, 'data-id-vector': 'line' },
  }), ITEM_ROLE.LINE);

  assert.equal(registeredItemRole(ITEM_ROLE.ANNOTATION), ITEM_ROLE.ANNOTATION);
});

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
