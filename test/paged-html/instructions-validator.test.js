const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot, compileInstructions, validateInstructions } = require('../../src/paged-html');

test('validateInstructions accepts compiler output', async () => {
  const htmlPath = path.resolve(__dirname, '../fixtures/paged-html/style-deck.html');
  const snapshot = await renderSnapshot({ htmlPath });
  const instructions = compileInstructions(snapshot);
  const result = validateInstructions(instructions);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateInstructions rejects missing page and style references', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [] },
    styles: {
      swatches: {},
      fonts: {},
      compositeFonts: {},
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
      cellStyles: {},
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'bad-title',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        paragraphStyle: 'missing-style',
        runs: [],
        zIndex: 1,
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'DOCUMENT_PAGE_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PARAGRAPH_STYLE_NOT_FOUND'), true);
});
