const test = require('node:test');
const assert = require('node:assert/strict');
const { collectLayers } = require('../../src/writers/indesign/layer-instructions');

test('collectLayers does not invent an unused default layer missing from the project map', () => {
  const layers = collectLayers([{
    items: [
      { id: 'title', layer: '文字' },
      { id: 'custom-rule', layer: '自定义线' },
    ],
  }], {
    styleNameMap: {
      layers: {
        text: '文字',
        annotation: '标注',
      },
    },
  });
  const names = layers.map((layer) => layer.name);

  assert.deepEqual(new Set(names), new Set(['文字', '标注', '自定义线']));
  assert.equal(names.includes('annotations'), false);
});
