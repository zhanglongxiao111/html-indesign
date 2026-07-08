const test = require('node:test');
const assert = require('node:assert/strict');

const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');

function dashedArrowLine(id, y) {
  return {
    id,
    type: 'GraphicLine',
    labels: [],
    bounds: { x: 100, y, width: 200, height: 0 },
    visualStyle: {
      strokeColor: '#111111',
      strokeWeight: 0.2834645669,
      strokeStyle: '虚线（3 和 2）',
      lineStartMarker: null,
      lineEndMarker: '箭头',
    },
  };
}

test('reverse snapshot creates synthesized line style from unstyled dashed arrows', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'unstyled-lines.indd', mode: 'observation' },
    document: { name: 'unstyled-lines.indd', labels: [] },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 800, height: 450 },
      items: [
        dashedArrowLine('line-a', 120),
        dashedArrowLine('line-b', 180),
      ],
    }],
  }, { mode: 'observation' });

  const lineStyles = model.styles.synthesized.filter((style) => style.kind === 'line');
  assert.equal(lineStyles.length, 1);
  assert.equal(lineStyles[0].displayName, '线条样式 01');
  assert.equal(lineStyles[0].token, 'synth_line_001');
  assert.equal(model.pages[0].items[0].styleRefs.synthesizedToken, 'synth_line_001');
  assert.equal(model.pages[0].items[1].styleRefs.synthesizedToken, 'synth_line_001');
  assert.equal(model.pages[0].items[0].visualStyle.strokeStyle, '虚线（3 和 2）');
});

test('reverse snapshot keeps effective grouped audit child objects in observation model', () => {
  const model = reverseSnapshotToSemanticModel({
    metadata: { sourceDocument: 'grouped-assets.indd', mode: 'observation' },
    document: { name: 'grouped-assets.indd', labels: [] },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 800, height: 450 },
      items: [{
        id: 'group-frame',
        type: 'GraphicFrame',
        labels: [],
        zIndex: 10,
        bounds: { x: 10, y: 20, width: 200, height: 120 },
        visualStyle: { opacity: 100 },
        placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 3 } },
      }, {
        id: 'outer-marker',
        type: 'Polygon',
        labels: [],
        zIndex: 11,
        bounds: { x: 180, y: 10, width: 12, height: 24 },
        visualStyle: {
          strokeColor: '#111111',
          strokeWeight: 2,
          strokeStyle: '实底',
        },
      }],
      auditItems: [{
        id: 'group-frame',
        type: 'GraphicFrame',
        labels: [],
        parent: { id: 'spread-1', type: 'Spread' },
        zIndex: 30,
        bounds: { x: 10, y: 20, width: 200, height: 120 },
        visualStyle: { opacity: 100 },
        placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 3 } },
      }, {
        id: 'outer-marker',
        type: 'Polygon',
        labels: [],
        parent: { id: 'spread-1', type: 'Spread' },
        zIndex: 31,
        bounds: { x: 180, y: 10, width: 12, height: 24 },
        visualStyle: {
          strokeColor: '#111111',
          strokeWeight: 2,
          strokeStyle: '实底',
        },
      }, {
        id: 'inner-pdf-frame',
        type: 'Rectangle',
        labels: [],
        parent: { id: 'group-frame', type: 'Group' },
        zIndex: 28,
        bounds: { x: 12, y: 22, width: 180, height: 110 },
        visualStyle: { opacity: 42 },
        placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 3 } },
      }, {
        id: 'inner-marker',
        type: 'Polygon',
        labels: [],
        parent: { id: 'group-frame', type: 'Group' },
        zIndex: 29,
        bounds: { x: 180, y: 100, width: 12, height: 24 },
        visualStyle: {
          strokeColor: '#e63c32',
          strokeWeight: 2,
          strokeStyle: '实底',
        },
      }, {
        id: 'pdf-content-leaf',
        type: 'PDF',
        labels: [],
        parent: { id: 'inner-pdf-frame', type: 'Rectangle' },
        bounds: { x: -20, y: -30, width: 300, height: 200 },
        visualStyle: { opacity: 100 },
      }],
    }],
  }, { mode: 'observation' });

  const ids = model.pages[0].items.map((item) => item.id);
  assert.deepEqual(ids, ['group-frame', 'outer-marker', 'inner-pdf-frame', 'inner-marker']);
  assert.equal(model.pages[0].items.find((item) => item.id === 'group-frame').zIndex, 30);
  assert.equal(model.pages[0].items.find((item) => item.id === 'outer-marker').zIndex, 31);
  assert.equal(model.pages[0].items.find((item) => item.id === 'inner-pdf-frame').role, 'graphic');
  assert.equal(model.pages[0].items.find((item) => item.id === 'inner-pdf-frame').zIndex, 28);
  assert.equal(model.pages[0].items.find((item) => item.id === 'inner-pdf-frame').visualStyle.opacity, 42);
  assert.equal(model.pages[0].items.find((item) => item.id === 'inner-marker').role, 'shape');
});
