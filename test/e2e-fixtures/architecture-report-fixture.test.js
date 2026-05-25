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
  assert.equal(pages.filter('[data-id-margin]').length, pages.length);
  assert.equal(pages.filter('[data-id-grid="12x8"]').length, pages.length);
  assert.equal(pages.filter('[data-id-column-gutter="6mm"]').length, pages.length);
  assert.equal(pages.filter('[data-id-row-gutter="5mm"]').length, pages.length);
  assert.equal(pages.filter('[data-id-baseline="4mm"]').length, pages.length);
  assert.equal(pages.filter('[data-id-guide-mode="used-snap"]').length, 0);
  assert.ok($('.grid-item').length >= 24);
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

test('architecture report fixture uses coarse grid-first page modules', () => {
  const html = fs.readFileSync(deckPath, 'utf8');
  const $ = cheerio.load(html);
  const pages = $('[data-page]');

  assert.ok(pages.length >= 7);
  assert.equal(pages.filter('[data-id-grid="12x8"]').length, pages.length);
  assert.equal(pages.filter('[data-id-row-gutter="5mm"]').length, pages.length);
  assert.match(html, /grid-template-rows:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
  assert.doesNotMatch(html, /grid-auto-rows:\s*4mm/);

  for (const element of $('.page > .grid-item').toArray()) {
    const style = $(element).attr('style') || '';
    const row = Number((style.match(/--grid-row\s*:\s*(\d+)/) || [])[1]);
    const span = Number((style.match(/--grid-row-span\s*:\s*(\d+)/) || [])[1]);
    assert.ok(Number.isInteger(row) && row >= 1, `${element.tagName} should declare a coarse grid row`);
    assert.ok(Number.isInteger(span) && span >= 1, `${element.tagName} should declare a coarse grid row span`);
    assert.ok(row + span - 1 <= 8, `${element.tagName} should stay inside the 8-row page grid`);
  }
});

test('architecture report fixture declares stable parent page and layout tokens', () => {
  const html = fs.readFileSync(deckPath, 'utf8');
  const $ = cheerio.load(html);
  const pages = $('[data-page]');
  const expectedLayouts = [
    'cover-hero-metrics',
    'contents-grid',
    'analysis-map-annotations',
    'strategy-media-cards',
    'drawing-reference-sheet',
    'asset-grid-notes',
    'metrics-table-summary',
  ];

  assert.equal(pages.length, expectedLayouts.length);
  assert.equal(pages.filter('[data-id-parent-page="report-parent"]').length, pages.length);
  assert.equal(pages.filter('[data-id-parent-page-name="汇报母版"]').length, pages.length);
  assert.deepEqual(pages.toArray().map((element) => $(element).attr('data-id-layout')), expectedLayouts);
});

test('agenda timeline annotation stays clear of lower chapter cards', () => {
  const html = fs.readFileSync(deckPath, 'utf8');
  const $ = cheerio.load(html);
  const agenda = $('[data-page="agenda"]');
  const lowerCards = agenda.find('[data-id-object-style="chapter-card"]').toArray()
    .map((element) => gridBounds($(element).attr('style') || ''))
    .filter((bounds) => bounds.row >= 5);
  const cardBottom = Math.max(...lowerCards.map((bounds) => bounds.bottom));
  const timelineTop = mmFromStyle(agenda.find('[data-id-object-style="timeline-line"]').attr('style') || '', 'top');
  const dotTop = Math.min(...agenda.find('[data-id-object-style="annotation-dot"]').toArray()
    .map((element) => mmFromStyle($(element).attr('style') || '', 'top')));

  assert.ok(timelineTop >= cardBottom + 8, `timeline top ${timelineTop}mm should clear lower cards ending at ${cardBottom}mm`);
  assert.ok(dotTop >= cardBottom + 4, `timeline dots at ${dotTop}mm should clear lower cards ending at ${cardBottom}mm`);
});

function gridBounds(style) {
  const pageHeight = 236.25;
  const marginTop = 14;
  const marginBottom = 10;
  const rows = 8;
  const rowGutter = 5;
  const rowHeight = (pageHeight - marginTop - marginBottom - rowGutter * (rows - 1)) / rows;
  const row = numberFromCssVar(style, 'grid-row');
  const span = numberFromCssVar(style, 'grid-row-span');
  const top = marginTop + (row - 1) * (rowHeight + rowGutter);
  const height = span * rowHeight + (span - 1) * rowGutter;
  return { row, span, top, bottom: top + height };
}

function numberFromCssVar(style, name) {
  const match = style.match(new RegExp(`--${name}\\s*:\\s*(\\d+)`));
  return match ? Number(match[1]) : 0;
}

function mmFromStyle(style, property) {
  const match = style.match(new RegExp(`${property}\\s*:\\s*([\\d.]+)mm`));
  return match ? Number(match[1]) : 0;
}
