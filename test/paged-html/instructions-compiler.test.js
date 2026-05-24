const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions } = require('../../src/paged-html');

test('compileInstructions emits document styles pages and text items', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot, { mode: 'editable-first' });
  const page = instructions.pages[0];
  const title = page.items.find((item) => item.id.includes('el1'));

  assert.equal(instructions.metadata.mode, 'editable-first');
  assert.equal(instructions.document.pages[0].width, 528);
  assert.equal(instructions.styles.paragraphStyles['report-title'].pointSize, 30);
  assert.equal(title.type, 'TEXT');
  assert.equal(title.paragraphStyle, 'report-title');
  assert.equal(title.runs.some((run) => run.characterStyle === 'accent'), true);
  assert.deepEqual(title.bounds, { x: 15, y: 18, width: 260, height: 30 });
  assert.equal(title.layer, 'text');
});

test('compileInstructions emits graphic placed assets and layers', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/asset-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const graphicItems = instructions.pages[0].items.filter((item) => item.type === 'GRAPHIC');
  const pdf = graphicItems.find((item) => item.placed && item.placed.assetId === 'asset-site-plan-pdf');

  assert.equal(instructions.assets.length, 4);
  assert.equal(instructions.layers.some((layer) => layer.name === 'graphics'), true);
  assert.equal(pdf.frameStyle, 'drawing-frame');
  assert.equal(pdf.placed.pageNumber, 3);
  assert.equal(pdf.placed.crop, 'trim');
});
