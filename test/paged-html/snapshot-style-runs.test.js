const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot captures style properties needed by InDesign style compilation', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages[0];
  const title = page.items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const card = page.items.find((item) => item.attributes['data-id-object-style'] === 'metric-card');
  const image = page.items.find((item) => item.attributes['data-id-frame-style'] === 'hero-image-frame');

  assert.equal(title.computedStyle.textAlign, 'center');
  assert.equal(title.computedStyle.fontWeight, '700');
  assert.ok(parseFloat(title.computedStyle.marginBottom) > 20);
  assert.equal(card.computedStyle.paddingLeft.endsWith('px'), true);
  assert.equal(card.computedStyle.borderTopStyle, 'solid');
  assert.equal(image.computedStyle.objectFit, 'cover');
  assert.equal(image.computedStyle.objectPosition, '0% 0%');
});

test('renderSnapshot captures inline character runs for text items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const title = snapshot.pages[0].items.find((item) => item.attributes['data-id-paragraph-style'] === 'report-title');
  const accentRun = title.runs.find((run) => run.attributes['data-id-character-style'] === 'accent');

  assert.equal(Array.isArray(title.runs), true);
  assert.equal(accentRun.text, '重点');
  assert.equal(accentRun.tagName, 'span');
  assert.equal(accentRun.computedStyle.fontStyle, 'italic');
  assert.match(accentRun.computedStyle.color, /rgb\(200,\s*16,\s*46\)/);
});
