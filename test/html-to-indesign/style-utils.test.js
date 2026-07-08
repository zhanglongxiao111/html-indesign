const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCssColor,
  parseCssLinearGradient,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
} = require('../../src/shared/style-utils');

test('normalizeCssColor converts browser rgb colors to hex swatches', () => {
  assert.deepEqual(normalizeCssColor('rgb(18, 52, 86)'), { hex: '#123456', name: '颜色-18-52-86' });
  assert.deepEqual(normalizeCssColor('rgba(200, 16, 46, 1)'), { hex: '#c8102e', name: '颜色-200-16-46' });
  assert.equal(normalizeCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(normalizeCssColor('transparent'), null);
});

test('parseCssLinearGradient preserves color alpha stops', () => {
  const gradient = parseCssLinearGradient('linear-gradient(90deg, rgba(251, 250, 247, 0.94), rgba(251, 250, 247, 0.55) 45%, rgba(251, 250, 247, 0.08))');

  assert.equal(gradient.angle, 90);
  assert.deepEqual(gradient.stops.map((stop) => stop.location), [0, 45, 100]);
  assert.deepEqual(gradient.stops.map((stop) => stop.color.name), ['颜色-251-250-247', '颜色-251-250-247', '颜色-251-250-247']);
  assert.deepEqual(gradient.stops.map((stop) => stop.opacity), [94, 55, 8]);
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
  assert.match(a, /^自动段落-\d{8}$/);
});

test('firstClassName ignores empty class lists', () => {
  assert.equal(firstClassName({ classList: ['title', 'large'] }), 'title');
  assert.equal(firstClassName({ classList: [] }), null);
});
