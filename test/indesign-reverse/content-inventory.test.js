const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  authorPackageContentInventory,
  documentModelContentInventory,
  compareContentInventories,
} = require('../../src/writers/html/audit/content-inventory');

test('compareContentInventories reports text resource page and geometry losses', () => {
  const root = path.resolve('test/workspace/content-inventory-loss');
  const sourceRoot = path.join(root, 'source');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page" style="width:1000px;height:600px"><p id="title" style="left:10px;top:20px;width:200px;height:40px">完整标题</p><img src="assets/site.png"></section>');
  writeFile(path.join(sourceRoot, 'assets/site.png'), 'image-bytes');

  const expected = authorPackageContentInventory(sourceRoot);
  const actual = {
    kind: 'AuthorContentInventory',
    pages: [{
      id: 'page-1',
      size: { width: 1000, height: 600 },
      textDigest: ['完整'],
      resources: [],
      itemRoles: [{ role: 'text', count: 1 }],
      geometry: [{ id: 'title', role: 'text', x: 0, y: 0, width: 0, height: 0 }],
    }],
    summary: { pages: 1, texts: 1, resources: 0, geometryItems: 1 },
  };

  const diff = compareContentInventories(expected, actual, { strictGeometry: true });

  assert.equal(diff.ok, false);
  assert.deepEqual(diff.errors.map((issue) => issue.code).sort(), [
    'CONTENT_GEOMETRY_CHANGED',
    'CONTENT_RESOURCE_MISSING',
    'CONTENT_TEXT_CHANGED',
  ].sort());
});

test('documentModelContentInventory preserves visible text and source resource identity', () => {
  const model = {
    kind: 'DocumentModel',
    pages: [{
      id: 'p1',
      width: 1000,
      height: 600,
      items: [
        { id: 't1', role: 'text', bounds: { x: 10, y: 20, width: 300, height: 40 }, content: { text: '会议室屏幕尺寸 3x6.5m' } },
        { id: 'g1', role: 'graphic', bounds: { x: 20, y: 80, width: 500, height: 300 }, asset: { kind: 'pdf', path: '\\\\nas\\share\\drawing.pdf' } },
      ],
    }],
  };

  const inventory = documentModelContentInventory(model);

  assert.equal(inventory.summary.pages, 1);
  assert.equal(inventory.summary.texts, 1);
  assert.equal(inventory.summary.resources, 1);
  assert.deepEqual(inventory.pages[0].textDigest, ['会议室屏幕尺寸 3x6.5m']);
  assert.equal(inventory.pages[0].resources[0].identity, '\\\\nas\\share\\drawing.pdf');
});

test('compareContentInventories treats package-relative preview resources as stable across output roots', () => {
  const root = path.resolve('test/workspace/content-inventory-relative-resource');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><img src="previews/2383-psd.png"></section>');
  writeAuthorPackage(reverseRoot, '<section class="page"><img src="previews/2383-psd.png"></section>');

  const diff = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot)
  );

  assert.equal(diff.ok, true);
});

test('authorPackageContentInventory excludes parent page furniture from page text', () => {
  const root = path.resolve('test/workspace/content-inventory-parent-furniture');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><p id="title">正文</p><span id="folio" data-id-object data-id-role="text" data-id-placement="parent-page-furniture" data-id-parent-page-item="report-folio">01</span></section>');
  writeAuthorPackage(reverseRoot, '<section class="page"><p id="title">正文</p></section>');

  const diff = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot)
  );

  assert.equal(diff.ok, true);
  assert.deepEqual(authorPackageContentInventory(sourceRoot).pages[0].textDigest, ['正文']);
});

test('compareContentInventories matches copied package assets to original asset path', () => {
  const root = path.resolve('test/workspace/content-inventory-original-asset-path');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  const originalAsset = path.join(root, 'shared/photo.png');
  fs.rmSync(root, { recursive: true, force: true });
  writeFile(originalAsset, 'image-bytes');
  writeAuthorPackage(sourceRoot, '<section class="page"><img src="../shared/photo.png"></section>');
  writeAuthorPackage(reverseRoot, `<section class="page"><img src="assets/photo.png" data-id-asset-path="${htmlAttr(originalAsset)}"></section>`);
  writeFile(path.join(reverseRoot, 'assets/photo.png'), 'image-bytes');

  const diff = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot)
  );

  assert.equal(diff.ok, true);
});

test('compareContentInventories uses authoring report asset map for copied resources', () => {
  const root = path.resolve('test/workspace/content-inventory-authoring-report-assets');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  const originalAsset = path.join(root, 'shared/diagram.svg');
  fs.rmSync(root, { recursive: true, force: true });
  writeFile(originalAsset, '<svg/>');
  writeAuthorPackage(sourceRoot, '<section class="page"><img src="../shared/diagram.svg"></section>');
  writeAuthorPackage(reverseRoot, '<section class="page"><img src="assets/diagram.svg"></section>');
  writeFile(path.join(reverseRoot, 'assets/diagram.svg'), '<svg/>');
  writeFile(path.join(reverseRoot, 'reports/authoring-report.json'), JSON.stringify({
    assets: {
      entries: [{
        originalPath: originalAsset,
        htmlPath: 'assets/diagram.svg',
        reason: 'local-copy-for-preview',
      }],
    },
  }, null, 2));

  const diff = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot)
  );

  assert.equal(diff.ok, true);
});

test('compareContentInventories follows copied asset aliases across a second authoring pass', () => {
  const root = path.resolve('test/workspace/content-inventory-transitive-authoring-assets');
  const originalRoot = path.join(root, 'original');
  const firstRoot = path.join(root, 'first-reverse');
  const secondRoot = path.join(root, 'second-reverse');
  const originalAsset = path.join(originalRoot, 'shared/diagram.svg');
  fs.rmSync(root, { recursive: true, force: true });
  writeFile(originalAsset, '<svg/>');
  writeAuthorPackage(firstRoot, '<section class="page"><img src="assets/diagram.svg"></section>');
  writeFile(path.join(firstRoot, 'assets/diagram.svg'), '<svg/>');
  writeFile(path.join(firstRoot, 'reports/authoring-report.json'), JSON.stringify({
    assets: {
      entries: [{
        originalPath: originalAsset,
        htmlPath: 'assets/diagram.svg',
        reason: 'local-copy-for-preview',
      }],
    },
  }, null, 2));
  writeAuthorPackage(secondRoot, '<section class="page"><img src="assets/diagram.svg"></section>');
  writeFile(path.join(secondRoot, 'assets/diagram.svg'), '<svg/>');
  writeFile(path.join(secondRoot, 'reports/authoring-report.json'), JSON.stringify({
    assets: {
      entries: [{
        originalPath: path.join(firstRoot, 'assets/diagram.svg'),
        htmlPath: 'assets/diagram.svg',
        reason: 'local-copy-for-preview',
      }],
    },
  }, null, 2));

  const diff = compareContentInventories(
    authorPackageContentInventory(firstRoot),
    authorPackageContentInventory(secondRoot)
  );

  assert.equal(diff.ok, true);
});

test('authorPackageContentInventory ignores preview-only resources marked data-id-ignore', () => {
  const root = path.resolve('test/workspace/content-inventory-ignore-preview');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(root, '<section class="page"><img src="assets/preview.png" data-id-ignore><object data="assets/source.pdf"></object></section>');

  const inventory = authorPackageContentInventory(root);

  assert.deepEqual(inventory.pages[0].resources, [{ kind: 'object', identity: 'assets\\source.pdf' }]);
});

test('compareContentInventories does not treat regenerated preview file names as source content loss', () => {
  const root = path.resolve('test/workspace/content-inventory-preview-cache');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><img src="previews/2383-psd.png"><img src="assets/source.png"></section>');
  writeAuthorPackage(reverseRoot, '<section class="page"><img src="previews/1087-psd.png"><img src="assets/source.png"></section>');

  const diff = compareContentInventories(
    authorPackageContentInventory(sourceRoot),
    authorPackageContentInventory(reverseRoot)
  );

  assert.equal(diff.ok, true);
});

test('compareContentInventories treats /nas URLs and UNC paths as the same host resource', () => {
  const root = path.resolve('test/workspace/content-inventory-nas-resource');
  const sourceRoot = path.join(root, 'source');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(sourceRoot, '<section class="page"><img src="/nas/daga-nas5/share/%E4%B8%AD.png"></section>');
  const expected = authorPackageContentInventory(sourceRoot);
  const actual = {
    kind: 'AuthorContentInventory',
    pages: [{
      id: 'page-1',
      size: { width: 0, height: 0 },
      textDigest: [],
      resources: [{ kind: 'image', identity: '\\\\daga-nas5\\share\\中.png' }],
      itemRoles: [],
      geometry: [],
    }],
    summary: { pages: 1, texts: 0, resources: 1, geometryItems: 0 },
  };

  const diff = compareContentInventories(expected, actual);

  assert.equal(diff.ok, true);
});

test('compareContentInventories treats CJK line wrap spaces as equivalent text', () => {
  const diff = compareContentInventories(
    inventoryWithText(['团队最终采用暖色清水 混凝土为立面主材料， 局部采用阳极氧化铝板 点缀']),
    inventoryWithText(['团队最终采用暖色清水混凝土为立面主材料，局部采用阳极氧化铝板点缀'])
  );

  assert.equal(diff.ok, true);
});

test('compareContentInventories still reports real text loss after CJK whitespace normalization', () => {
  const diff = compareContentInventories(
    inventoryWithText(['团队最终采用暖色清水 混凝土为立面主材料']),
    inventoryWithText(['团队最终采用暖色清水'])
  );

  assert.equal(diff.ok, false);
  assert.equal(diff.errors[0].code, 'CONTENT_TEXT_CHANGED');
});

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'inventory-fixture',
    title: 'Inventory Fixture',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function inventoryWithText(textDigest) {
  return {
    kind: 'AuthorContentInventory',
    pages: [{
      id: 'page-1',
      size: { width: 0, height: 0 },
      textDigest,
      resources: [],
      itemRoles: [],
      geometry: [],
    }],
    summary: { pages: 1, texts: textDigest.length, resources: 0, geometryItems: 0 },
  };
}

function htmlAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
