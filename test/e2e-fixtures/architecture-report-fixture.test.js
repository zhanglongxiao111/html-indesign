const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const fixtureDir = path.resolve(__dirname, '../fixtures/e2e/architecture-report');
const deckPath = path.join(fixtureDir, 'deck.html');

test('architecture report visual fixture covers core presentation page types and mapping semantics', () => {
  assert.equal(fs.existsSync(deckPath), true);

  const html = fs.readFileSync(deckPath, 'utf8');
  const $ = cheerio.load(html);
  const pages = $('[data-page]');

  assert.ok(pages.length >= 7);
  assert.equal($('[data-page="cover"]').length, 1);
  assert.equal($('[data-page="agenda"]').length, 1);
  assert.equal($('[data-page="site-analysis"]').length, 1);
  assert.equal($('[data-page="design-strategy"]').length, 1);
  assert.equal($('[data-page="drawing-sheet"]').length, 1);
  assert.equal($('[data-page="material-system"]').length, 1);
  assert.equal($('[data-page="metrics-table"]').length, 1);

  assert.ok($('[data-id-paragraph-style]').length >= 12);
  assert.ok($('[data-id-character-style]').length >= 4);
  assert.ok($('[data-id-object-style]').length >= 12);
  assert.ok($('[data-id-frame-style]').length >= 8);
  assert.ok($('[data-id-layer]').length >= 8);
  assert.ok($('[data-id-asset-kind="pdf"]').length >= 1);
  assert.ok($('[data-id-asset-kind="svg"]').length >= 4);
  assert.ok($('table[data-id-table-style]').length >= 1);
  assert.ok($('[data-id-object][data-id-role="annotation"]').length >= 6);

  for (const element of $('img[src], object[data]').toArray()) {
    const source = $(element).attr('src') || $(element).attr('data');
    if (!source || /^https?:\/\//.test(source)) continue;
    assert.equal(fs.existsSync(path.resolve(fixtureDir, source)), true, `${source} should exist`);
  }
});
