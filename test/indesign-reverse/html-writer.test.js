const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel, semanticModelToHtml } = require('../../src/indesign-reverse');

test('semanticModelToHtml writes page, parent page, layout and text item tags', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  const html = semanticModelToHtml(model);

  assert.match(html, /<main class="deck"/);
  assert.match(html, /data-id-document="architecture-report"/);
  assert.match(html, /data-page="agenda-page"/);
  assert.match(html, /data-id-parent-page="report-parent"/);
  assert.match(html, /data-id-parent-page-name="汇报母版"/);
  assert.match(html, /data-id-layout="contents-grid"/);
  assert.match(html, /<h2[^>]+agenda-title/);
  assert.match(html, /汇报结构/);
});

test('semanticModelToHtml rejects pages without explicit geometry', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  delete model.pages[0].width;

  assert.throws(
    () => semanticModelToHtml(model),
    /Page agenda-page is missing width/
  );
});
