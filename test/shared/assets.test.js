const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
  placementFromAttributes,
} = require('../../src/shared/assets');

test('inferAssetKind maps architecture presentation asset extensions', () => {
  assert.equal(inferAssetKind('render.jpg'), 'raster');
  assert.equal(inferAssetKind('render.jfif'), 'raster');
  assert.equal(inferAssetKind('render.PNG'), 'raster');
  assert.equal(inferAssetKind('drawing.pdf'), 'pdf');
  assert.equal(inferAssetKind('lobby.psd'), 'psd');
  assert.equal(inferAssetKind('axon.ai'), 'ai');
  assert.equal(inferAssetKind('diagram.svg'), 'svg');
  assert.equal(inferAssetKind('unknown.xyz'), 'unknown');
});

test('assetSourceFromElementLike reads img src object data and explicit kind', () => {
  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'IMG',
    attributes: { src: 'a.psd', 'data-id-asset-kind': 'psd' },
  }), { src: 'a.psd', explicitKind: 'psd' });

  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'OBJECT',
    attributes: { data: 'plan.pdf', type: 'application/pdf' },
  }), { src: 'plan.pdf', explicitKind: 'pdf' });
});

test('assetSourceFromElementLike uses original asset path instead of generated preview source', () => {
  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'IMG',
    attributes: {
      src: 'previews/item-42.png',
      'data-id-asset-path': '\\\\daga-nas5\\share\\drawing.pdf',
      'data-id-asset-kind': 'pdf',
    },
  }), { src: '\\\\daga-nas5\\share\\drawing.pdf', explicitKind: 'pdf' });
});

test('assetSourceFromElementLike uses generated preview when no original asset path exists', () => {
  assert.deepEqual(assetSourceFromElementLike({
    tagName: 'FIGURE',
    attributes: {
      'data-id-asset-kind': 'image',
      'data-id-preview-src': 'previews/embedded-image.png',
    },
  }), { src: 'previews/embedded-image.png', explicitKind: null });
});

test('createAssetId is stable and filename based', () => {
  assert.equal(createAssetId('./assets/site-plan.pdf'), 'asset-site-plan-pdf');
  assert.equal(createAssetId('C:/Project/Renders/Lobby View.PNG'), 'asset-lobby-view-png');
});

test('placementFromAttributes preserves protocol placement fields', () => {
  assert.deepEqual(placementFromAttributes({
    'data-id-fit': 'manual',
    'data-id-pdf-page': '3',
    'data-id-crop': 'trim',
    'data-id-visible-layers': 'Layer 1|Layer 2',
    'data-id-content-x': '10px',
    'data-id-content-y': '20px',
    'data-id-content-width': '300px',
    'data-id-content-height': '200px',
    'data-id-content-scale-x': '1.25',
    'data-id-content-scale-y': '0.75',
  }, {
    objectPosition: 'left top',
  }), {
    fit: 'manual',
    position: '0% 0%',
    pageNumber: 3,
    crop: 'trim',
    artboard: undefined,
    layerComp: undefined,
    visibleLayers: ['Layer 1', 'Layer 2'],
    hiddenLayers: undefined,
    preserveVector: false,
    contentBox: {
      x: '10px',
      y: '20px',
      width: '300px',
      height: '200px',
      scaleX: 1.25,
      scaleY: 0.75,
    },
  });
});
