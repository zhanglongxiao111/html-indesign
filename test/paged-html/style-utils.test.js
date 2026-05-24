const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCssColor,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
} = require('../../src/paged-html/style-utils');

test('normalizeCssColor converts browser rgb colors to hex swatches', () => {
  assert.deepEqual(normalizeCssColor('rgb(18, 52, 86)'), { hex: '#123456', name: 'color-123456' });
  assert.deepEqual(normalizeCssColor('rgba(200, 16, 46, 1)'), { hex: '#c8102e', name: 'color-c8102e' });
  assert.equal(normalizeCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(normalizeCssColor('transparent'), null);
});

test('cssLengthToPt converts px pt and mm to InDesign points', () => {
  assert.equal(cssLengthToPt('40px'), 30);
  assert.equal(cssLengthToPt('30pt'), 30);
  assert.equal(cssLengthToPt('25.4mm'), 72);
  assert.equal(cssLengthToPt('normal'), null);
});

test('sanitizeStyleName keeps stable human-readable style names', () => {
  assert.equal(sanitizeStyleName('report-title'), 'report-title');
  assert.equal(sanitizeStyleName('Metric Card'), 'Metric-Card');
  assert.equal(sanitizeStyleName('  重点 标题  '), '重点-标题');
});

test('stableAutoName generates deterministic auto names from signatures', () => {
  const a = stableAutoName('paragraph', { fontSize: 30, fillColor: 'color-123456' });
  const b = stableAutoName('paragraph', { fontSize: 30, fillColor: 'color-123456' });
  assert.equal(a, b);
  assert.match(a, /^auto-paragraph-[a-f0-9]{8}$/);
});

test('firstClassName ignores empty class lists', () => {
  assert.equal(firstClassName({ classList: ['title', 'large'] }), 'title');
  assert.equal(firstClassName({ classList: [] }), null);
});
