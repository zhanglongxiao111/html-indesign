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
