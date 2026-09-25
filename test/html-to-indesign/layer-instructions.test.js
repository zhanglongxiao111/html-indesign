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

test('collectLayers builds only the declared layer list plus used layers when the package declares layers', () => {
  const options = { styleNameMap: { layers: { text: '文字', graphics: '图形', annotation: '标注' } } };
  const pages = [{ items: [{ id: 'shape', layer: '图层 1' }, { id: 'note', layer: '备注' }] }];
  const declared = collectLayers(pages, options, [{ name: '图层 1' }, { name: '空图层' }]).map((layer) => layer.name);
  assert.deepEqual(new Set(declared), new Set(['图层 1', '空图层', '备注']));
  assert.equal(declared.includes('文字'), false, 'preset standard layers are not added to a declared layer list');

  const undeclared = collectLayers(pages, options, []).map((layer) => layer.name);
  assert.deepEqual(new Set(undeclared), new Set(['文字', '图形', '标注', '图层 1', '备注']));
});
