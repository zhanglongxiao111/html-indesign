const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileInstructions, validateInstructions } = require('../../src/writers/indesign');

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

test('validateInstructions rejects missing table cell paragraph styles', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'page-1', width: 100, height: 100 }] },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: { area: { name: 'area' } },
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'area-table',
        type: 'TABLE',
        bounds: { x: 0, y: 0, width: 80, height: 40 },
        tableStyle: 'area',
        rows: [{
          cells: [{ text: 'Space', paragraphStyle: 'missing-table-heading' }],
        }],
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'TABLE_CELL_PARAGRAPH_STYLE_NOT_FOUND'), true);
});

test('validateInstructions rejects missing text frame object frame and table cell character styles', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'page-1', width: 100, height: 100 }] },
    styles: {
      paragraphStyles: { body: { name: 'body' } },
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: { area: { name: 'area' } },
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'badge',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 40, height: 10 },
        paragraphStyle: 'body',
        objectStyle: 'missing-object',
        frameStyle: 'missing-frame',
        runs: [],
      }, {
        id: 'area-table',
        type: 'TABLE',
        bounds: { x: 0, y: 20, width: 80, height: 40 },
        tableStyle: 'area',
        rows: [{
          cells: [{
            text: 'Net +12%',
            runs: [{ text: '+12%', characterStyle: 'missing-delta' }],
          }],
        }],
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'OBJECT_STYLE_NOT_FOUND' && error.itemId === 'badge'), true);
  assert.equal(result.errors.some((error) => error.code === 'FRAME_STYLE_NOT_FOUND' && error.itemId === 'badge'), true);
  assert.equal(result.errors.some((error) => error.code === 'TABLE_CELL_CHARACTER_STYLE_NOT_FOUND'), true);
});

test('validateInstructions rejects graphic instructions without a placed asset reference', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'page-1', width: 100, height: 100 }] },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'missing-graphic',
        type: 'GRAPHIC',
        bounds: { x: 0, y: 0, width: 40, height: 30 },
        placed: null,
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'GRAPHIC_ASSET_MISSING'), true);
});

test('validateInstructions rejects PDF placed assets without an explicit PDF page number', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'page-1', width: 100, height: 100 }] },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
    },
    assets: [{ id: 'asset-plan', src: './plan.pdf', kind: 'pdf' }],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'plan-frame',
        type: 'GRAPHIC',
        bounds: { x: 0, y: 0, width: 40, height: 30 },
        placed: { assetId: 'asset-plan', fit: 'contain' },
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'PDF_PAGE_NUMBER_MISSING'), true);
});

test('validateInstructions rejects mixed page sizes until executor supports per-page geometry', () => {
  const result = validateInstructions({
    metadata: {},
    document: {
      pages: [
        { id: 'page-1', width: 100, height: 60 },
        { id: 'page-2', width: 120, height: 60 },
      ],
    },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
    },
    assets: [],
    layers: [],
    pages: [
      { id: 'page-1', items: [] },
      { id: 'page-2', items: [] },
    ],
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'MIXED_PAGE_SIZE_UNSUPPORTED'), true);
});

test('validateInstructions rejects invalid text fit modes', () => {
  const result = validateInstructions({
    metadata: {},
    document: { pages: [{ id: 'page-1', width: 100, height: 100 }] },
    styles: {
      paragraphStyles: {},
      characterStyles: {},
      objectStyles: {},
      frameStyles: {},
      tableStyles: {},
    },
    assets: [],
    layers: [],
    pages: [{
      id: 'page-1',
      items: [{
        id: 'bad-text',
        type: 'TEXT',
        bounds: { x: 0, y: 0, width: 20, height: 80 },
        text: 'bad',
        runs: [],
        textFit: { mode: 'shrink-font' },
      }],
    }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'INVALID_TEXT_FIT_MODE'));
});

test('validateInstructions rejects missing required protocol labels in strict mode', () => {
  const instructions = {
    document: {
      unitMode: 'presentation',
      coordinateUnit: 'pt',
      pages: [{ id: 'p1', width: 100, height: 100, margins: {}, guides: [] }],
    },
    styles: {},
    assets: [],
    layers: [],
    pages: [{ id: 'p1', items: [{ id: 'i1', type: 'SHAPE', bounds: { x: 0, y: 0, width: 10, height: 10 } }] }],
  };
  const result = validateInstructions(instructions, { requireLabels: true });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'INSTRUCTION_LABEL_MISSING'), true);
});
