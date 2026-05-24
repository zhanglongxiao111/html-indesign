const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot detects raster pdf psd and ai placed assets', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const kinds = snapshot.assets.map((asset) => asset.kind).sort();

  assert.deepEqual(kinds, ['ai', 'pdf', 'psd', 'raster']);
  assert.equal(snapshot.assets.some((asset) => asset.src.includes('browser-preview')), false);
  assert.equal(snapshot.pages[0].items.some((item) => item.sourceSelector === 'img.ignored-preview'), false);

  const pdf = snapshot.assets.find((asset) => asset.kind === 'pdf');
  assert.equal(pdf.id, 'asset-site-plan-pdf');
  assert.equal(pdf.placement.pageNumber, 3);
  assert.equal(pdf.placement.crop, 'trim');
  assert.equal(pdf.placement.fit, 'contain');

  const psd = snapshot.assets.find((asset) => asset.kind === 'psd');
  assert.equal(psd.placement.layerComp, 'presentation');

  const ai = snapshot.assets.find((asset) => asset.kind === 'ai');
  assert.equal(ai.placement.artboard, '2');
});
