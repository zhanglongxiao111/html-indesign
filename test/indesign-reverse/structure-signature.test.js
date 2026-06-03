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
