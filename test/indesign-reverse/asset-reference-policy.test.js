const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  prepareAuthorAssets,
  shouldConsiderGeneratedPreviewPath,
} = require('../../src/writers/html/asset-reference-policy');

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

test('prepareAuthorAssets does not copy first-page PDF previews without explicit page facts', () => {
  const root = path.resolve('test/workspace/asset-reference-pdf-no-page-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  const pdfPath = path.resolve(sourceRoot, '../assets/drawing.pdf');
  const previewPath = path.resolve(sourceRoot, '../assets/drawing-page1.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, 'pdf-bytes');
  fs.writeFileSync(previewPath, 'preview-bytes');

  const result = prepareAuthorAssets(modelWithAssets('../assets/drawing.pdf'), {
    outDir,
    sourceRoot,
  });

  assert.equal(result.pathMap.get('../assets/drawing.pdf'), 'assets/drawing.pdf');
  assert.equal(result.pathMap.get('../assets/drawing-page1.png'), undefined);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/drawing-page1.png')), false);
});

test('prepareAuthorAssets copies explicit PDF page previews only for the declared page', () => {
  const root = path.resolve('test/workspace/asset-reference-pdf-page-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  const pdfPath = path.resolve(sourceRoot, '../assets/drawing.pdf');
  const previewPath = path.resolve(sourceRoot, '../assets/drawing-page3.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, 'pdf-bytes');
  fs.writeFileSync(previewPath, 'preview-bytes');

  const result = prepareAuthorAssets(modelWithPdfPage('../assets/drawing.pdf', 3), {
    outDir,
    sourceRoot,
  });

  assert.equal(result.pathMap.get('../assets/drawing-page3.png'), 'assets/drawing-page3.png');
  assert.equal(fs.readFileSync(path.join(outDir, 'assets/drawing-page3.png'), 'utf8'), 'preview-bytes');
});

test('prepareAuthorAssets copy policy does not package first-page PDF previews without explicit page facts', () => {
  const root = path.resolve('test/workspace/asset-reference-copy-pdf-no-page-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  const pdfPath = path.resolve(sourceRoot, '../assets/drawing.pdf');
  const previewPath = path.resolve(sourceRoot, '../assets/drawing-page1.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, 'pdf-bytes');
  fs.writeFileSync(previewPath, 'preview-bytes');

  const result = prepareAuthorAssets(modelWithAssets('../assets/drawing.pdf'), {
    outDir,
    sourceRoot,
    assetPolicy: 'copy',
  });

  assert.equal(result.pathMap.get('../assets/drawing.pdf'), 'assets/drawing.pdf');
  assert.equal(result.pathMap.get('../assets/drawing-page1.png'), undefined);
  assert.equal(fs.existsSync(path.join(outDir, 'assets/drawing-page1.png')), false);
});

test('prepareAuthorAssets copy policy packages explicit PDF page previews only for the declared page', () => {
  const root = path.resolve('test/workspace/asset-reference-copy-pdf-page-test');
  const sourceRoot = path.join(root, 'source');
  const outDir = path.join(root, 'author');
  const pdfPath = path.resolve(sourceRoot, '../assets/drawing.pdf');
  const previewPath = path.resolve(sourceRoot, '../assets/drawing-page4.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
  fs.writeFileSync(pdfPath, 'pdf-bytes');
  fs.writeFileSync(previewPath, 'preview-bytes');

  const result = prepareAuthorAssets(modelWithPdfPage('../assets/drawing.pdf', 4), {
    outDir,
    sourceRoot,
    assetPolicy: 'copy',
  });

  assert.equal(result.pathMap.get('../assets/drawing-page4.png'), 'assets/drawing-page4.png');
  assert.equal(fs.readFileSync(path.join(outDir, 'assets/drawing-page4.png'), 'utf8'), 'preview-bytes');
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

test('prepareAuthorAssets copies generated placed-asset previews while keeping NAS originals referenced in place', () => {
  const root = path.resolve('test/workspace/asset-reference-generated-preview-test');
  const outDir = path.join(root, 'author');
  const previewPath = path.join(root, 'snapshot-previews', 'item-42.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, 'png-bytes');
  const originalPath = '\\\\daga-nas5\\daga-2025-project\\D0474_大兴城建\\图纸 A.pdf';
  const model = {
    kind: 'DocumentModel',
    pages: [
      {
        id: 'page-1',
        items: [
          {
            id: 'asset-1',
            role: 'graphic',
            asset: {
              path: originalPath,
              graphicType: 'PDF',
              preview: {
                path: previewPath,
                relativePath: 'previews/item-42.png',
                source: 'indesign-frame-export',
              },
            },
          },
        ],
      },
    ],
    assets: [{ name: '图纸 A.pdf', path: originalPath }],
  };

  const result = prepareAuthorAssets(model, { outDir });

  assert.equal(result.pathMap.get(previewPath.replace(/\\/g, '/').toLowerCase()), 'previews/item-42.png');
  assert.equal(result.pathMap.get('previews/item-42.png'), 'previews/item-42.png');
  assert.equal(fs.readFileSync(path.join(outDir, 'previews/item-42.png'), 'utf8'), 'png-bytes');
  assert.equal(result.report.generated, 1);
  assert.deepEqual(result.report.generatedFiles, ['previews/item-42.png']);
  assert.equal(result.report.copied, 0);
  assert.equal(result.report.entries[0].reason, 'nas-reference');
});

test('prepareAuthorAssets copies source-node preview-only images into the previews folder', () => {
  const root = path.resolve('test/workspace/asset-reference-preview-only-test');
  const outDir = path.join(root, 'author');
  const previewPath = path.join(root, 'snapshot-previews', 'embedded-image.png');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, 'preview-only-bytes');
  const model = {
    kind: 'DocumentModel',
    pages: [
      {
        id: 'page-1',
        items: [
          {
            id: 'embedded-image',
            role: 'graphic',
            sourceNode: {
              tagName: 'figure',
              attributes: {
                'data-id-asset-kind': 'image',
                'data-id-preview-src': 'previews/embedded-image.png',
              },
            },
            asset: {
              path: previewPath,
              name: 'embedded-image.png',
              graphicType: 'Image',
            },
          },
        ],
      },
    ],
    assets: [],
  };

  const result = prepareAuthorAssets(model, { outDir });

  assert.equal(result.pathMap.get(previewPath.replace(/\\/g, '/').toLowerCase()), 'previews/embedded-image.png');
  assert.equal(result.pathMap.get('previews/embedded-image.png'), 'previews/embedded-image.png');
  assert.equal(fs.readFileSync(path.join(outDir, 'previews/embedded-image.png'), 'utf8'), 'preview-only-bytes');
  assert.equal(result.report.generated, 1);
  assert.deepEqual(result.report.generatedFiles, ['previews/embedded-image.png']);
  assert.equal(result.report.copied, 0);
});

test('generated preview policy treats UNC cache files as copyable generated files', () => {
  assert.equal(shouldConsiderGeneratedPreviewPath('\\\\daga-nas5\\share\\previews\\item-42.png'), true);
  assert.equal(shouldConsiderGeneratedPreviewPath('//daga-nas5/share/previews/item-42.png'), true);
  assert.equal(shouldConsiderGeneratedPreviewPath('https://example.test/previews/item-42.png'), false);
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

function modelWithPdfPage(assetPath, pageNumber) {
  const model = modelWithAssets(assetPath);
  model.pages[0].items[0].sourceNode.attributes['data-id-pdf-page'] = String(pageNumber);
  model.pages[0].items[0].asset.placement = { pageNumber };
  return model;
}
