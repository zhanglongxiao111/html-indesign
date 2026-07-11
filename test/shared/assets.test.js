const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
  placementFromAttributes,
  normalizePathKey,
  sourceFileKey,
  sanitizeRelative,
  isRemoteReference,
  resolveLocalAssetReference,
  resourceReferenceIdentity,
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

test('asset path helpers share one canonical path identity contract', () => {
  assert.equal(normalizePathKey('C:\\Project\\Assets\\Site Plan.PDF'), 'c:/project/assets/site plan.pdf');
  assert.equal(normalizePathKey('//daga-nas5/share/图纸 A.pdf'), '//daga-nas5/share/图纸 a.pdf');
  assert.equal(sourceFileKey('C:/Project/Assets/../Assets/Site Plan.PDF'), sourceFileKey('C:\\Project\\Assets\\Site Plan.PDF'));
  assert.equal(sanitizeRelative('../assets/./bad:name?.pdf'), 'assets/bad_name_.pdf');
});

test('remote reference detection keeps file URLs local and HTTP style URLs remote', () => {
  assert.equal(isRemoteReference('https://example.test/render.png'), true);
  assert.equal(isRemoteReference('data:image/png;base64,AAAA'), true);
  assert.equal(isRemoteReference('file:///C:/Project/render.png'), false);
  assert.equal(isRemoteReference('C:\\Project\\render.png'), false);
});

test('local asset references convert file URLs to filesystem paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'html-indesign-file-url-'));
  const assetPath = path.join(root, '素材 图.png');
  fs.writeFileSync(assetPath, 'image-bytes');

  assert.equal(resolveLocalAssetReference(pathToFileURL(assetPath).href), assetPath);
  assert.equal(resolveLocalAssetReference('素材 图.png', { sourceRoot: root }), assetPath);
  assert.equal(resolveLocalAssetReference('https://example.test/素材 图.png', { sourceRoot: root }), null);
});

test('resource identities treat UNC NAS URLs and hosted file URLs as the same original resource', () => {
  const unc = '\\\\daga-nas5\\share\\项目 A\\图纸 01.pdf';
  const nas = '/nas/daga-nas5/share/%E9%A1%B9%E7%9B%AE%20A/%E5%9B%BE%E7%BA%B8%2001.pdf';
  const fileUrl = 'file://daga-nas5/share/%E9%A1%B9%E7%9B%AE%20A/%E5%9B%BE%E7%BA%B8%2001.pdf';

  assert.equal(resourceReferenceIdentity(unc), resourceReferenceIdentity(nas));
  assert.equal(resourceReferenceIdentity(fileUrl), resourceReferenceIdentity(nas));
});
