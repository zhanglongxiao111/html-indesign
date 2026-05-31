const test = require('node:test');
const assert = require('node:assert/strict');

const { placementFromAttributes } = require('../../src/paged-html/asset-detector');

test('current HTML asset placement reads data-id-pdf-page and not data-id-page', () => {
  const placement = placementFromAttributes({
    src: 'drawings/site.pdf',
    'data-id-pdf-page': '3',
    'data-id-page': '9',
    'data-id-crop': 'trim',
    'data-id-visible-layers': 'base|annotations',
    'data-id-hidden-layers': 'old',
  }, { objectFit: 'contain', objectPosition: '50% 50%' });

  assert.equal(placement.pageNumber, 3);
  assert.equal(placement.crop, 'trim');
  assert.deepEqual(placement.visibleLayers, ['base', 'annotations']);
  assert.deepEqual(placement.hiddenLayers, ['old']);
});
