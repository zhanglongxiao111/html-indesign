const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { renderSnapshot, validateAuthoringRules } = require('../../src/adapters/html');
const { compileInstructions } = require('../../src/indesign-pipeline');

const htmlPath = path.resolve(__dirname, '../fixtures/fixed-html/natural-text-div-deck.html');

test('normal leaf div text is captured as native text without author-only protocol markup', async () => {
  const snapshot = await renderSnapshot({ htmlPath });
  const sourceItem = snapshot.pages[0].items.find((item) => item.id === 'axis-label');

  assert.ok(sourceItem, 'a normal leaf div with visible text must not disappear from the snapshot');
  assert.equal(sourceItem.role, 'text');
  assert.equal(sourceItem.text, '46 KM · 区域公路强联系轴');
  assert.equal(sourceItem.sourceNode.tagName, 'div');

  const instructions = compileInstructions(snapshot, { unitMode: 'presentation', targetSize: 'same' });
  const instruction = instructions.pages[0].items.find((item) => item.id === 'axis-label');
  assert.ok(instruction);
  assert.equal(instruction.type, 'TEXT');
  assert.equal(instruction.text, '46 KM · 区域公路强联系轴');
});

test('authoring validation blocks visible text that the translation layer cannot assign safely', async () => {
  const snapshot = await renderSnapshot({ htmlPath });
  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => (
    entry.code === 'HTML_TEXT_NOT_CONVERTIBLE'
      && entry.itemId === 'ambiguous-copy'
  )));
});
