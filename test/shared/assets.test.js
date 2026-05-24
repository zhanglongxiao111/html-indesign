const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
} = require('../../src/shared/assets');

test('inferAssetKind maps architecture presentation asset extensions', () => {
  assert.equal(inferAssetKind('render.jpg'), 'raster');
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

test('createAssetId is stable and filename based', () => {
  assert.equal(createAssetId('./assets/site-plan.pdf'), 'asset-site-plan-pdf');
  assert.equal(createAssetId('C:/Project/Renders/Lobby View.PNG'), 'asset-lobby-view-png');
});
