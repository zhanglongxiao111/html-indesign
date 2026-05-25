const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/paged-html');

test('renderSnapshot captures fixed-size paged HTML pages', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });

  assert.equal(snapshot.pages.length, 2);
  assert.equal(snapshot.pages[0].id, 'page-1');
  assert.equal(snapshot.pages[0].widthMm, 528);
  assert.equal(snapshot.pages[0].heightMm, 297);
  assert.equal(snapshot.pages[0].items.some((item) => item.role === 'text' && item.text.includes('项目标题')), true);
  assert.equal(snapshot.pages[1].items.some((item) => item.role === 'text' && item.text.includes('第二页')), true);
});

test('renderSnapshot computes element bounds in page millimeters', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/basic-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const title = snapshot.pages[0].items.find((item) => item.text.includes('项目标题'));

  assert.equal(title.boundsMm.x, 15);
  assert.equal(title.boundsMm.y, 20);
  assert.equal(title.boundsMm.width, 220);
  assert.equal(title.boundsMm.height, 24);
  assert.equal(title.zIndex, 10);
});

test('renderSnapshot captures standalone semantic span text objects', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const firstPage = snapshot.pages[0];
  const folio = firstPage.items.find((item) => item.attributes['data-id-paragraph-style'] === 'folio');

  assert.ok(folio);
  assert.equal(folio.role, 'text');
  assert.equal(folio.tagName, 'span');
  assert.equal(folio.text, '00');
});

test('renderSnapshot keeps table cell paragraph markers inside the table model only', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const allItems = snapshot.pages.flatMap((page) => page.items);
  const duplicateCellText = allItems.find((item) => item.role === 'text' && item.text === 'Ice rink + spectator edge');

  assert.equal(duplicateCellText, undefined);
});

test('renderSnapshot captures page background and table cell geometry', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages.find((candidate) => candidate.id === 'metrics-table-page');
  const table = page.items.find((item) => item.role === 'table' && item.attributes['data-id-table-style'] === 'area-table');
  const firstRow = table.table[0].cells;
  const totalWidth = Number(firstRow.reduce((sum, cell) => sum + cell.boundsMm.width, 0).toFixed(2));

  assert.equal(page.computedStyle.backgroundColor, 'rgb(251, 250, 247)');
  assert.equal(firstRow.length, 4);
  assert.equal(firstRow.every((cell) => cell.boundsMm && cell.boundsMm.width > 0), true);
  assert.equal(Math.abs(totalWidth - table.boundsMm.width) < 0.5, true);
  assert.notEqual(firstRow[0].boundsMm.width, firstRow[1].boundsMm.width);
});

test('renderSnapshot preserves authored border shorthand when a side override exists', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const chapter = snapshot.pages
    .flatMap((page) => page.items)
    .find((item) => item.attributes['data-id-object-style'] === 'chapter-card');

  assert.ok(chapter);
  assert.equal(chapter.authoredStyle.borderTopWidth, '1pt');
  assert.equal(chapter.authoredStyle.borderRightWidth, '1pt');
  assert.equal(chapter.authoredStyle.borderBottomWidth, '1pt');
  assert.equal(chapter.authoredStyle.borderLeftWidth, '3mm');
});

test('renderSnapshot captures paint-only legend swatches as shape items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/e2e/architecture-report/deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const swatches = snapshot.pages
    .flatMap((page) => page.items)
    .filter((item) => item.tagName === 'span' && item.classList.includes('swatch'));

  assert.equal(swatches.length, 3);
  assert.equal(swatches.every((item) => item.role === 'shape'), true);
  assert.equal(swatches.every((item) => item.computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)'), true);
});

test('renderSnapshot reports unsupported CSS effects and pseudo content', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/unsupported-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const codes = snapshot.report.messages.map((message) => message.code);

  assert.equal(codes.includes('CSS_EFFECT_UNSUPPORTED'), true);
  assert.equal(codes.includes('PSEUDO_CONTENT_UNSUPPORTED'), true);
  assert.equal(codes.includes('INLINE_SVG_UNSUPPORTED'), true);
  assert.equal(snapshot.warnings.some((warning) => warning.code === 'CSS_EFFECT_UNSUPPORTED'), true);
});

test('renderSnapshot reports list markers that are not yet compiled to native bullets', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/list-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });

  assert.equal(snapshot.pages[0].items.some((item) => item.tagName === 'li'), true);
  assert.equal(snapshot.report.messages.some((message) => message.code === 'LIST_MARKER_UNSUPPORTED'), true);
});

test('renderSnapshot captures inline character runs inside table cells', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/table-inline-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const table = snapshot.pages[0].items.find((item) => item.role === 'table');
  const cell = table.table[0].cells[0];

  assert.equal(cell.text, 'Net +12%2');
  assert.deepEqual(cell.runs.map((run) => run.text), ['+12%', '2']);
  assert.equal(cell.runs[0].attributes['data-id-character-style'], 'metric-delta');
  assert.equal(cell.runs[1].tagName, 'sup');
});

test('renderSnapshot captures page padding and grid semantics for InDesign guides', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/grid-guide-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages[0];

  assert.equal(page.attributes['data-id-grid'], '4x3');
  assert.equal(page.computedStyle.paddingTop.endsWith('px'), true);
  assert.equal(page.computedStyle.gridTemplateColumns.split(/\s+/).length, 4);
  assert.equal(page.computedStyle.gridTemplateRows.split(/\s+/).length, 3);
});
