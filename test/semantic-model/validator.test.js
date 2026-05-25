const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSemanticModel } = require('../../src/semantic-model');

test('validateSemanticModel requires pages and page labels', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [],
    pages: [{ id: 'p1', items: [], labels: [] }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'DOCUMENT_LABEL_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PAGE_LABEL_MISSING'), true);
});

test('validateSemanticModel rejects duplicate item ids on a page', () => {
  const result = validateSemanticModel({
    kind: 'DocumentModel',
    id: 'doc',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    labels: [{ kind: 'document', id: 'doc' }],
    pages: [{
      id: 'p1',
      labels: [{ kind: 'page', id: 'p1' }],
      items: [
        { id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] },
        { id: 'item-1', labels: [{ kind: 'item', id: 'item-1' }] },
      ],
    }],
    styles: {},
    assets: [],
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'ITEM_ID_DUPLICATED');
});
