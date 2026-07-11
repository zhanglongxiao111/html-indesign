const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyReadingOrderLite,
  reconstructSemanticModel,
} = require('../../src/semantic-reconstruction');

test('reading-order-lite compares wide-page positions as y then x', () => {
  const model = documentModel([
    item('lower-left', { x: 0, y: 101, width: 100, height: 40 }),
    item('upper-right', { x: 2000, y: 100, width: 100, height: 40 }),
  ], { width: 4000 });

  applyReadingOrderLite(model);

  assert.deepEqual(orders(model, ['upper-right', 'lower-left']), [1, 2]);
});

test('reading-order-lite uses original index for equal coordinates and unbounded items', () => {
  const model = documentModel([
    item('unbounded-1', null),
    item('equal-first', { x: 100, y: 100, width: 100, height: 40 }),
    item('equal-second', { x: 100, y: 100, width: 100, height: 40 }),
    item('unbounded-2', null),
  ]);

  applyReadingOrderLite(model);

  assert.deepEqual(
    orders(model, ['equal-first', 'equal-second', 'unbounded-1', 'unbounded-2']),
    [1, 2, 3, 4],
  );
});

test('reading-order-lite preserves trusted structures while ordering observed siblings', () => {
  const trustedWithoutOrder = trustedItem('trusted-without-order', { x: 40, y: 40, width: 100, height: 40 });
  const trustedWithOrder = trustedItem('trusted-with-order', { x: 40, y: 240, width: 100, height: 40 }, 7);
  const model = documentModel([
    item('observed-lower', { x: 40, y: 320, width: 100, height: 40 }),
    trustedWithOrder,
    item('observed-upper', { x: 40, y: 120, width: 100, height: 40 }),
    trustedWithoutOrder,
  ]);
  const trustedBefore = JSON.stringify([trustedWithoutOrder, trustedWithOrder]);

  const pass = applyReadingOrderLite(model);

  assert.equal(JSON.stringify([
    findItem(model, 'trusted-without-order'),
    findItem(model, 'trusted-with-order'),
  ]), trustedBefore);
  assert.deepEqual(orders(model, ['observed-upper', 'observed-lower']), [1, 2]);
  assert.equal(pass.summary.applied, 2);
  assert.equal(pass.skipped.filter((entry) => entry.reason === 'trusted-source-protected').length, 2);
});

test('reading-order-lite is byte-stable and reports already stable items as skipped', () => {
  const model = documentModel([
    item('second', { x: 40, y: 240, width: 100, height: 40 }),
    item('first', { x: 40, y: 40, width: 100, height: 40 }),
  ]);
  applyReadingOrderLite(model);
  const firstBytes = JSON.stringify(model);

  const secondPass = applyReadingOrderLite(model);

  assert.equal(JSON.stringify(model), firstBytes);
  assert.equal(secondPass.summary.applied, 0);
  assert.equal(secondPass.skipped.filter((entry) => entry.reason === 'order-already-stable').length, 2);
});

test('reconstructSemanticModel executes reading-order-lite after structure passes', () => {
  const model = documentModel([
    textItem('copy-2', 80, 224, '第二段'),
    textItem('copy-1', 80, 140, '第一段'),
  ]);

  const result = reconstructSemanticModel(model, {
    mode: 'observation',
    algorithms: ['reading-order-lite', 'text-block'],
  });

  assert.deepEqual(result.report.algorithms, ['text-block', 'reading-order-lite']);
  assert.deepEqual(result.report.passes.map((pass) => pass.name), ['text-block', 'reading-order-lite']);
  assert.equal(findItem(result.model, 'page-1-text-block-1').structure.order, 1);
});

function documentModel(items, page = {}) {
  return {
    kind: 'DocumentModel',
    id: 'reading-order-deck',
    reverseMode: 'observation',
    parentPages: [],
    pages: [{
      id: 'page-1',
      width: page.width || 1000,
      height: page.height || 1000,
      items,
    }],
    assets: [],
  };
}

function item(id, bounds) {
  return {
    id,
    role: 'container',
    semantic: null,
    ...(bounds ? { bounds } : {}),
    structure: { parentId: 'page-1' },
  };
}

function trustedItem(id, bounds, order) {
  return {
    ...item(id, bounds),
    labelStatus: 'accepted',
    semantic: 'trusted-block',
    tagName: 'section',
    sourceNode: {
      tagName: 'section',
      id,
      classList: ['trusted-block'],
      attributes: {},
    },
    structure: {
      parentId: 'page-1',
      ...(order == null ? {} : { order }),
    },
  };
}

function textItem(id, x, y, text) {
  return {
    id,
    role: 'text',
    semantic: null,
    bounds: { x, y, width: 280, height: 72 },
    styleRefs: { paragraphStyle: '正文' },
    textStyle: {
      pointSize: 18,
      leading: 26,
      fontFamily: 'Microsoft YaHei',
      fillColor: '#333333',
      justification: 'left',
    },
    content: { text },
    structure: { parentId: 'page-1' },
  };
}

function orders(model, ids) {
  return ids.map((id) => findItem(model, id).structure.order);
}

function findItem(model, id) {
  return model.pages[0].items.find((entry) => entry.id === id);
}
