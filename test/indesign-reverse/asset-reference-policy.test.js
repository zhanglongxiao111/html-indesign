const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { prepareAuthorAssets } = require('../../src/indesign-reverse/asset-reference-policy');

test('prepareAuthorAssets references NAS assets by default without copying source files', () => {
  const outDir = path.resolve('test/workspace/asset-reference-policy-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = modelWithAssets('\\\\daga-nas5\\daga-2025-project\\D0474_大兴城建\\图纸 A.pdf');

  const result = prepareAuthorAssets(model, { outDir });

  const mapped = result.pathMap.get('//daga-nas5/daga-2025-project/d0474_大兴城建/图纸 a.pdf');
  assert.equal(mapped, '/nas/daga-nas5/daga-2025-project/D0474_%E5%A4%A7%E5%85%B4%E5%9F%8E%E5%BB%BA/%E5%9B%BE%E7%BA%B8%20A.pdf');
  assert.equal(result.report.policy, 'reference');
  assert.equal(result.report.referenced, 1);
  assert.equal(result.report.copied, 0);
  assert.equal(result.report.entries[0].reason, 'nas-reference');
  assert.equal(fs.existsSync(path.join(outDir, 'assets')), false);
});

test('prepareAuthorAssets copies local relative assets in reference mode for portable previews', () => {
  const root = path.resolve('test/workspace/asset-reference-local-copy-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  const imagePath = path.resolve(sourceRoot, '../assets/site.png');
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  fs.writeFileSync(imagePath, 'image-bytes');

  const result = prepareAuthorAssets(modelWithAssets('../assets/site.png'), {
    outDir,
    sourceRoot,
  });

  assert.equal(result.report.policy, 'reference');
  assert.equal(result.report.copied, 1);
  assert.equal(result.report.entries[0].reason, 'local-copy-for-preview');
  assert.equal(result.pathMap.get('../assets/site.png'), 'assets/site.png');
  assert.equal(fs.existsSync(path.join(outDir, 'assets/site.png')), true);
});

test('prepareAuthorAssets keeps copy policy available for portable author packages', () => {
  const root = path.resolve('test/workspace/asset-reference-copy-policy-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  fs.rmSync(root, { recursive: true, force: true });
  const imagePath = path.resolve(sourceRoot, '../assets/site.png');
  fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  fs.writeFileSync(imagePath, 'image-bytes');

  const result = prepareAuthorAssets(modelWithAssets('../assets/site.png'), {
    outDir,
    sourceRoot,
    assetPolicy: 'copy',
  });

  assert.equal(result.report.policy, 'copy');
  assert.equal(result.report.copied, 1);
  assert.equal(result.pathMap.get('../assets/site.png'), 'assets/site.png');
  assert.equal(fs.existsSync(path.join(outDir, 'assets/site.png')), true);
});

function modelWithAssets(assetPath) {
  return {
    kind: 'DocumentModel',
    pages: [
      {
        id: 'page-1',
        items: [
          {
            id: 'asset-1',
            role: 'graphic',
            sourceNode: {
              tagName: 'img',
              attributes: { src: assetPath },
            },
            asset: { path: assetPath, graphicType: /\.pdf$/i.test(assetPath) ? 'pdf' : 'image' },
          },
        ],
      },
    ],
    assets: [{ name: path.basename(assetPath), path: assetPath }],
  };
}
