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

test('semanticModelToHtml renders observed shapes and placed image assets', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-reverse',
    title: 'visual-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'visual-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'card-frame',
            role: 'shape',
            semantic: '指标卡片',
            tagName: 'div',
            bounds: { x: 40, y: 50, width: 240, height: 120 },
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: '#c8102e',
              strokeWeight: 3,
              opacity: 72,
              cornerRadius: 8,
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              cropped: true,
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /id="card-frame"[^>]+background-color:#fbfaf7/);
  assert.match(html, /id="card-frame"[^>]+border:3px solid #c8102e/);
  assert.match(html, /id="card-frame"[^>]+opacity:0\.72/);
  assert.match(html, /id="card-frame"[^>]+border-radius:8px/);
  assert.match(html, /<figure[^>]+id="hero-image"[^>]+data-id-asset-path="D:\\assets\\hero\.png"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/hero\.png"/);
  assert.match(html, /data-id-image-cropped="true"/);
});
