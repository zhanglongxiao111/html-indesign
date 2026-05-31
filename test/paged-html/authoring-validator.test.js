const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAuthoringRules } = require('../../src/paged-html');

test('validateAuthoringRules accepts aligned semantic grid authored pages', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
      'data-id-column-gutter': '2mm',
      'data-id-row-gutter': '2mm',
    },
    items: [{
      id: 'title',
      role: 'text',
      tagName: 'h1',
      classList: ['page-title'],
      attributes: { 'data-id-paragraph-style': 'page-title' },
      boundsMm: { x: 10, y: 10, width: 23.5, height: 29 },
    }],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.some((warning) => warning.code === 'GRID_ALIGNMENT_OFF'), false);
});

test('validateAuthoringRules rejects retired grid alias fields as active page grid rules', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-guides': '4x2',
      'data-id-gutter': '2mm',
      'data-id-baseline-grid': '5mm',
    },
    items: [],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((entry) => entry.code === 'PAGE_GRID_RULE_MISSING'), true);
});

test('validateAuthoringRules treats baseline as text rhythm when a row grid is declared', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x3',
      'data-id-column-gutter': '2mm',
      'data-id-row-gutter': '2mm',
      'data-id-baseline': '5mm',
    },
    items: [{
      id: 'row-module-card',
      role: 'shape',
      tagName: 'div',
      classList: ['feature-card'],
      attributes: { 'data-id-object-style': 'feature-card' },
      boundsMm: { x: 10, y: 30.67, width: 23.5, height: 18.67 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
});

test('validateAuthoringRules reports pages missing authoring margin and grid rules', () => {
  const snapshot = snapshotWithPage({
    attributes: {},
    authoredStyle: {},
    computedStyle: {},
    items: [],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => error.code === 'PAGE_MARGIN_RULE_MISSING'), true);
  assert.equal(result.errors.some((error) => error.code === 'PAGE_GRID_RULE_MISSING'), true);
});

test('validateAuthoringRules warns when item edges do not align to the declared grid', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'off-grid-card',
      role: 'shape',
      tagName: 'div',
      classList: ['metric-card'],
      attributes: { 'data-id-object-style': 'metric-card' },
      boundsMm: { x: 13, y: 10, width: 20, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { gridTolerance: 0.5 });
  const warning = result.warnings.find((entry) => entry.code === 'GRID_ALIGNMENT_OFF');

  assert.ok(warning);
  assert.equal(warning.pageId, 'page-1');
  assert.equal(warning.itemId, 'off-grid-card');
  assert.deepEqual(warning.edges, ['left', 'right']);
});

test('validateAuthoringRules does not treat snap grid as the page layout grid', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-snap-grid': '2mm',
    },
    items: [{
      id: 'snap-grid-title',
      role: 'text',
      tagName: 'h1',
      classList: ['page-title'],
      attributes: { 'data-id-paragraph-style': 'page-title' },
      boundsMm: { x: 14, y: 12, width: 42, height: 10 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((entry) => entry.code === 'PAGE_GRID_RULE_MISSING'), true);
});

test('validateAuthoringRules prefers the main layout grid over secondary snap grid', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
      'data-id-snap-grid': '2mm',
    },
    items: [{
      id: 'snap-aligned-main-off-grid',
      role: 'shape',
      tagName: 'div',
      classList: ['metric-card'],
      attributes: { 'data-id-object-style': 'metric-card' },
      boundsMm: { x: 14, y: 12, width: 42, height: 10 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { gridTolerance: 0.5 });
  const warning = result.warnings.find((entry) => entry.code === 'GRID_ALIGNMENT_OFF');

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'PAGE_GRID_RULE_MISSING'), false);
  assert.ok(warning);
  assert.equal(warning.itemId, 'snap-aligned-main-off-grid');
});

test('validateAuthoringRules allows nested text to use local card rhythm instead of page grid', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'grid-card',
      role: 'shape',
      tagName: 'div',
      classList: ['metric-card'],
      attributes: { 'data-id-object-style': 'metric-card' },
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }, {
      id: 'nested-title',
      role: 'text',
      tagName: 'h3',
      classList: [],
      attributes: { 'data-id-paragraph-style': 'card-title' },
      ancestorCandidateIndexes: [0],
      boundsMm: { x: 13, y: 14, width: 18, height: 5 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
});

test('validateAuthoringRules checks text placement by left right and top edges', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'text-frame',
      role: 'text',
      tagName: 'p',
      classList: ['body-copy'],
      attributes: { 'data-id-paragraph-style': 'body-copy' },
      boundsMm: { x: 10, y: 10, width: 25, height: 9.3 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
});

test('validateAuthoringRules warns for mappable items without stable semantic tokens', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'anonymous-text',
      role: 'text',
      tagName: 'p',
      classList: [],
      attributes: {},
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.warnings.some((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING' && entry.itemId === 'anonymous-text'), true);
});

test('validateAuthoringRules can promote warnings to errors in strict mode', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'anonymous-text',
      role: 'text',
      tagName: 'p',
      classList: [],
      attributes: {},
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true });

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING'), true);
});

function snapshotWithPage(overrides = {}) {
  return {
    metadata: { source: 'inline.html' },
    pages: [{
      id: 'page-1',
      index: 0,
      widthMm: 120,
      heightMm: 80,
      rectPx: { x: 0, y: 0, width: 1200, height: 800 },
      attributes: overrides.attributes || {},
      classList: ['page'],
      authoredStyle: overrides.authoredStyle || {},
      computedStyle: overrides.computedStyle || {},
      items: overrides.items || [],
    }],
  };
}
