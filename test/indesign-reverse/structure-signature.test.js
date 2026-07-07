const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  authorPackageStructureSignature,
  compareStructureSignatures,
} = require('../../src/writers/html/audit/structure-signature');

test('compareStructureSignatures detects parent order and tag drift without requiring exact source text equality', () => {
  const root = path.resolve('test/workspace/structure-signature-drift');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(first, '<section class="page"><section id="block" class="text-block"><p id="a">第一段</p><p id="b">第二段</p></section></section>');
  writeAuthorPackage(second, '<section class="page">\n  <p id="a">第一段</p>\n  <section id="block" class="text-block"><p id="b">第二段</p></section>\n</section>');

  const diff = compareStructureSignatures(
    authorPackageStructureSignature(first),
    authorPackageStructureSignature(second),
  );

  assert.equal(diff.ok, false);
  assert.deepEqual(Array.from(new Set(diff.errors.map((issue) => issue.code))).sort(), [
    'STRUCTURE_NODE_PARENT_CHANGED',
    'STRUCTURE_NODE_ORDER_CHANGED',
  ].sort());
});

test('compareStructureSignatures accepts formatting-only source changes', () => {
  const root = path.resolve('test/workspace/structure-signature-stable');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(first, '<section class="page"><figure id="fig"><img id="img" src="a.png"><figcaption id="cap">图注</figcaption></figure></section>');
  writeAuthorPackage(second, '<section class="page">\n  <figure id="fig">\n    <img id="img" src="a.png">\n    <figcaption id="cap">图注</figcaption>\n  </figure>\n</section>');

  const diff = compareStructureSignatures(
    authorPackageStructureSignature(first),
    authorPackageStructureSignature(second),
  );

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareStructureSignatures ignores preview-only data-id-ignore nodes and wrapper drift', () => {
  const root = path.resolve('test/workspace/structure-signature-ignore-preview');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.rmSync(root, { recursive: true, force: true });
  writeAuthorPackage(first, '<section class="page"><p id="lead">图纸</p><img class="pdf-preview" src="preview.png" data-id-ignore><object id="pdf" data="drawing.pdf"></object><p id="note">说明</p></section>');
  writeAuthorPackage(second, '<section class="page"><p id="lead">图纸</p><div class="drawing-frame" data-id-ignore><img class="pdf-preview" src="preview.png" data-id-ignore><object id="pdf" data="drawing.pdf"></object></div><p id="note">说明</p></section>');

  const diff = compareStructureSignatures(
    authorPackageStructureSignature(first),
    authorPackageStructureSignature(second),
  );

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareStructureSignatures invalid-input 必须 fail for empty or missing pages', () => {
  const empty = { kind: 'AuthorStructureSignature', pages: [], summary: { pages: 0 } };
  const missing = { kind: 'AuthorStructureSignature', summary: { pages: 0 } };

  const diff = compareStructureSignatures(empty, missing);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'STRUCTURE_SIGNATURE_INPUT_INVALID'), true);
});

function writeAuthorPackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'structure-fixture',
    title: 'Structure Fixture',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}
