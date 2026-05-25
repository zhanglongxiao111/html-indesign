const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');
const { snapshotToSemanticModel } = require('../../src/semantic-model');

test('snapshotToSemanticModel builds document pages, styles, assets, and items', async () => {
  const snapshot = await renderSnapshot({
    htmlPath: path.resolve(__dirname, '../fixtures/paged-html/semantic-deck.html'),
  });
  const model = snapshotToSemanticModel(snapshot, {
    unitMode: 'presentation',
    targetSize: 'same',
  });

  assert.equal(model.kind, 'DocumentModel');
  assert.equal(model.unitMode, 'presentation');
  assert.equal(model.coordinateUnit, 'pt');
  assert.equal(model.pages.length, 1);
  assert.equal(model.pages[0].items.length > 0, true);
  assert.equal(model.pages[0].labels[0].kind, 'page');
  assert.equal(model.styles.paragraphStyles && typeof model.styles.paragraphStyles, 'object');
  assert.equal(Array.isArray(model.assets), true);
});

test('snapshotToSemanticModel preserves page layout and parent page metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'agenda-page',
      index: 0,
      widthMm: 508,
      heightMm: 285.75,
      rectPx: { x: 0, y: 0, width: 1920, height: 1080 },
      classList: ['page'],
      attributes: {
        'data-page': 'agenda',
        'data-id-semantic': 'agenda',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-name': '汇报母版',
        'data-id-layout': 'contents-grid',
        'data-id-margin': '14mm',
        'data-id-grid': '12x6',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].semantic, 'agenda');
  assert.equal(model.pages[0].parentPageId, 'report-parent');
  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.pages[0].layout, 'contents-grid');
  assert.deepEqual(model.pages[0].margins, { top: 14, right: 14, bottom: 14, left: 14 });
});

test('snapshotToSemanticModel accepts alternate parent page display-name metadata', () => {
  const model = snapshotToSemanticModel({
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'p1',
      index: 0,
      widthMm: 100,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 100, height: 80 },
      attributes: {
        'data-page': 'p1',
        'data-id-parent-page': 'report-parent',
        'data-id-parent-page-display-name': '汇报母版',
      },
      computedStyle: {},
      items: [],
    }],
    assets: [],
  }, { unitMode: 'print' });

  assert.equal(model.pages[0].parentPageName, '汇报母版');
  assert.equal(model.parentPages[0].name, '汇报母版');
});
