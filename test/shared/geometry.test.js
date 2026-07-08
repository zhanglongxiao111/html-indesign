const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCssLength,
  cssLengthToMm,
  cssLengthStringToMmOrZero,
  cssLengthStringToPx,
  cssLengthStringToVisualMm,
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

test('css length helpers preserve null zero and visual rounding semantics', () => {
  assert.equal(cssLengthToMm({ value: 96, unit: 'px' }), 25.4);
  assert.equal(cssLengthStringToMmOrZero('bad'), 0);
  assert.ok(Math.abs(cssLengthStringToPx('25.4mm') - 96) < 1e-9);
  assert.equal(cssLengthStringToPx('12pt'), 16);
  assert.equal(cssLengthStringToPx('bad'), null);
  assert.equal(cssLengthStringToVisualMm('95px'), 25);
  assert.equal(cssLengthStringToVisualMm('96px'), 25.4);
  assert.equal(cssLengthStringToVisualMm('12pt'), 4.23);
  assert.equal(cssLengthStringToVisualMm('bad'), null);
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
