const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCssLength,
  parsePhysicalSize,
  rectPxToMm,
  boundsToGeometricBounds,
} = require('../../src/shared/geometry');

test('parseCssLength parses mm, px, pt, and defaults to px', () => {
  assert.deepEqual(parseCssLength('528mm'), { value: 528, unit: 'mm' });
  assert.deepEqual(parseCssLength('1123px'), { value: 1123, unit: 'px' });
  assert.deepEqual(parseCssLength('12pt'), { value: 12, unit: 'pt' });
  assert.deepEqual(parseCssLength('42'), { value: 42, unit: 'px' });
});

test('parsePhysicalSize extracts width and height from CSS text', () => {
  const size = parsePhysicalSize('width: 528mm; height: 297mm; position: relative;');
  assert.equal(size.widthMm, 528);
  assert.equal(size.heightMm, 297);
});

test('rectPxToMm converts a child rect relative to page rect', () => {
  const rect = rectPxToMm({
    rectPx: { x: 100, y: 50, width: 200, height: 100 },
    pageRectPx: { x: 20, y: 10, width: 1000, height: 500 },
    pageWidthMm: 500,
    pageHeightMm: 250,
  });
  assert.deepEqual(rect, { x: 40, y: 20, width: 100, height: 50 });
});

test('boundsToGeometricBounds returns InDesign y1 x1 y2 x2 order', () => {
  assert.deepEqual(
    boundsToGeometricBounds({ x: 15, y: 20, width: 100, height: 50 }),
    [20, 15, 70, 115]
  );
});
