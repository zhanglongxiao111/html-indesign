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
