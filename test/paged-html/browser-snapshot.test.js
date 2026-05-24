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
