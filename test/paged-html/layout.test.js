const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveLayout,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../../src/paged-html/layout');

test('resolveLayout maps presentation source pixels to pt target size', () => {
  const layout = resolveLayout({
    pages: [{ rectPx: { width: 1920, height: 1080 }, widthMm: 508, heightMm: 285.75 }],
  }, { unitMode: 'presentation', targetSize: 'qhd' });
  assert.equal(layout.unitMode, 'presentation');
  assert.equal(layout.targetUnit, 'pt');
  assert.deepEqual(layout.targetSize, { width: 2560, height: 1440, name: 'qhd' });
  assert.equal(layout.scale, 2560 / 1920);
});

test('pageMargins reads data-id-margin before CSS padding', () => {
  const layout = { unitMode: 'print', targetUnit: 'mm', scale: 1 };
  const margins = pageMargins({
    attributes: { 'data-id-margin': '14mm 16mm 10mm 18mm' },
    computedStyle: { paddingTop: '1mm', paddingRight: '1mm', paddingBottom: '1mm', paddingLeft: '1mm' },
  }, layout);
  assert.deepEqual(margins, { top: 14, right: 16, bottom: 10, left: 18 });
});

test('pageGuides creates gutter-aware grid guides', () => {
  const layout = { unitMode: 'print', targetUnit: 'mm', scale: 1 };
  const guides = pageGuides({
    attributes: {
      'data-id-grid': '4x2',
      'data-id-column-gutter': '4mm',
      'data-id-row-gutter': '6mm',
    },
    computedStyle: {},
    items: [],
  }, { width: 100, height: 60 }, { top: 10, right: 10, bottom: 10, left: 10 }, layout);
  assert.deepEqual(guides.filter((guide) => guide.orientation === 'vertical').map((guide) => guide.position), [27, 31, 48, 52, 69, 73]);
  assert.deepEqual(guides.filter((guide) => guide.orientation === 'horizontal').map((guide) => guide.position), [27, 33]);
});

test('itemBounds converts browser pixels in presentation mode', () => {
  const bounds = itemBounds({
    rectPx: { x: 110, y: 70, width: 200, height: 80 },
    boundsMm: { x: 10, y: 10, width: 20, height: 20 },
  }, {
    rectPx: { x: 100, y: 50, width: 1000, height: 500 },
  }, {
    unitMode: 'presentation',
    scale: 2,
  });
  assert.deepEqual(bounds, { x: 20, y: 40, width: 400, height: 160 });
});
