const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { detectAssetsFromItems } = require('../../src/adapters/html/reader/asset-detector');

test('renderSnapshot detects raster pdf psd and ai placed assets', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
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

test('detectAssetsFromItems preserves PDF and AI layer visibility metadata', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const assets = detectAssetsFromItems([{
    id: 'layered-pdf',
    tagName: 'img',
    attributes: {
      src: './previews/layered-pdf.png',
      'data-id-asset-path': './assets/layered.pdf',
      'data-id-asset-kind': 'pdf',
      'data-id-pdf-page': '7',
      'data-id-crop': 'trim',
      'data-id-visible-layers': '结构|标注',
      'data-id-hidden-layers': '家具',
      'data-id-preserve-vector': 'true',
    },
    computedStyle: {
      objectFit: 'contain',
      objectPosition: '50% 50%',
    },
    sourceSelector: '#layered-pdf',
  }], htmlPath);

  assert.equal(assets.length, 1);
  assert.equal(assets[0].src, './assets/layered.pdf');
  assert.equal(assets[0].kind, 'pdf');
  assert.equal(assets[0].placement.pageNumber, 7);
  assert.equal(assets[0].placement.crop, 'trim');
  assert.deepEqual(assets[0].placement.visibleLayers, ['结构', '标注']);
  assert.deepEqual(assets[0].placement.hiddenLayers, ['家具']);
  assert.equal(assets[0].placement.preserveVector, true);
});

test('detectAssetsFromItems treats retired data-id-page as an invalid PDF page field', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const assets = detectAssetsFromItems([{
    id: 'retired-page-field-pdf',
    tagName: 'object',
    attributes: {
      data: './assets/site-plan.pdf',
      type: 'application/pdf',
      'data-id-object': '',
      'data-id-asset-kind': 'pdf',
      'data-id-page': '7',
    },
    computedStyle: {
      objectFit: 'contain',
      objectPosition: '50% 50%',
    },
    sourceSelector: '#retired-page-field-pdf',
  }], htmlPath);

  assert.equal(assets.length, 1);
  assert.equal(assets[0].placement.pageNumber, undefined);
});

test('detectAssetsFromItems ignores invalid data-id-pdf-page values', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const items = ['abc', '0', '-2'].map((page, index) => ({
    id: `invalid-page-${index}`,
    tagName: 'object',
    attributes: {
      data: `./assets/site-plan-${index}.pdf`,
      type: 'application/pdf',
      'data-id-object': '',
      'data-id-asset-kind': 'pdf',
      'data-id-pdf-page': page,
    },
    computedStyle: {
      objectFit: 'contain',
      objectPosition: '50% 50%',
    },
    sourceSelector: `#invalid-page-${index}`,
  }));

  const assets = detectAssetsFromItems(items, htmlPath);

  assert.equal(assets.length, 3);
  assert.deepEqual(assets.map((asset) => asset.placement.pageNumber), [undefined, undefined, undefined]);
});

test('renderSnapshot inherits semantic frame attributes from ignored asset wrappers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const wrapped = snapshot.pages[0].items.find((item) => item.id === 'wrapped-pdf-frame');

  assert.ok(wrapped);
  assert.equal(wrapped.role, 'graphic');
  assert.equal(wrapped.attributes['data-id-object-style'], 'wrapped-drawing');
  assert.equal(wrapped.attributes['data-id-frame-style'], 'wrapped-frame');
  assert.equal(wrapped.attributes['data-id-ignore'], undefined);
  assert.equal(wrapped.attributes.data, './assets/site-plan.pdf');
});

test('renderSnapshot treats semantic asset links as placed graphics', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const linked = snapshot.pages[0].items.find((item) => item.id === 'linked-pdf');

  assert.ok(linked);
  assert.equal(linked.role, 'graphic');
  assert.equal(linked.attributes.href, './assets/site-plan.pdf');
});

test('detectAssetsFromItems keeps same-basename assets from different folders distinct', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const items = [
    assetItem('left', './assets/a/plan.pdf'),
    assetItem('right', './assets/b/plan.pdf'),
  ];
  const assets = detectAssetsFromItems(items, htmlPath);

  assert.equal(assets.length, 2);
  assert.equal(new Set(assets.map((asset) => asset.id)).size, 2);
  assert.deepEqual(assets.map((asset) => asset.src), ['./assets/a/plan.pdf', './assets/b/plan.pdf']);
});

test('detectAssetsFromItems treats css background-image urls as placed assets', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const assets = detectAssetsFromItems([{
    id: 'background-render',
    tagName: 'div',
    attributes: { 'data-id-object': '' },
    computedStyle: {
      backgroundImage: 'url("./assets/render.jpg")',
      backgroundSize: 'contain',
      backgroundPosition: 'left top',
    },
    sourceSelector: '#background-render',
  }], htmlPath);

  assert.equal(assets.length, 1);
  assert.equal(assets[0].src, './assets/render.jpg');
  assert.equal(assets[0].kind, 'raster');
  assert.equal(assets[0].placement.fit, 'contain');
  assert.equal(assets[0].placement.position, '0% 0%');
});

test('detectAssetsFromItems uses generated preview src for embedded image frames without source paths', () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/asset-deck.html');
  const assets = detectAssetsFromItems([{
    id: 'embedded-image',
    tagName: 'figure',
    attributes: {
      'data-id-object': '',
      'data-id-asset-kind': 'image',
      'data-id-preview-src': 'previews/embedded-image.png',
      'data-id-fit': 'manual',
      'data-id-content-x': '-30px',
      'data-id-content-y': '-10px',
      'data-id-content-width': '300px',
      'data-id-content-height': '180px',
    },
    computedStyle: {
      objectFit: 'fill',
      objectPosition: '50% 50%',
    },
    sourceSelector: '#embedded-image',
  }], htmlPath);

  assert.equal(assets.length, 1);
  assert.equal(assets[0].src, 'previews/embedded-image.png');
  assert.equal(assets[0].kind, 'raster');
  assert.equal(assets[0].placement.fit, 'fill');
  assert.equal(assets[0].placement.contentBox, undefined);
});

function assetItem(id, src) {
  return {
    id,
    tagName: 'object',
    attributes: {
      data: src,
      type: 'application/pdf',
      'data-id-object': '',
    },
    computedStyle: {
      objectFit: 'contain',
      objectPosition: '50% 50%',
    },
    sourceSelector: `#${id}`,
  };
}
