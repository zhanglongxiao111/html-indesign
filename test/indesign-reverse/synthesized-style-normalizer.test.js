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
