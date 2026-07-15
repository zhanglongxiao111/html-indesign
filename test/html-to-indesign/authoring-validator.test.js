const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAuthoringRules } = require('../../src/adapters/html');
const {
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  ITEM_ROLE,
  ITEM_ROLE_VALUES,
} = require('../../src/protocol');

test('authoring mappable role subset is explicitly derived from registry role values', () => {
  assert.deepEqual(AUTHORING_MAPPABLE_ITEM_ROLE_VALUES, [
    ITEM_ROLE.TEXT,
    ITEM_ROLE.GRAPHIC,
    ITEM_ROLE.SHAPE,
    ITEM_ROLE.TABLE,
  ]);
  for (const role of AUTHORING_MAPPABLE_ITEM_ROLE_VALUES) {
    assert.equal(ITEM_ROLE_VALUES.includes(role), true, `${role} must be a registered item role`);
  }
  assert.equal(AUTHORING_MAPPABLE_ITEM_ROLE_VALUES.includes(ITEM_ROLE.ANNOTATION), false);
});

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

test('validateAuthoringRules warns for class-only page-number items that are off grid', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'class-only-folio',
      role: 'text',
      tagName: 'span',
      classList: ['page-number'],
      attributes: {},
      boundsMm: { x: 13, y: 10, width: 20, height: 9 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { gridTolerance: 0.5 });
  const warning = result.warnings.find((entry) => entry.code === 'GRID_ALIGNMENT_OFF');

  assert.ok(warning);
  assert.equal(warning.itemId, 'class-only-folio');
  assert.deepEqual(warning.edges, ['left', 'right']);
});

test('validateAuthoringRules skips grid checks for registered folio paragraph style', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'registered-folio',
      role: 'text',
      tagName: 'span',
      classList: ['page-number'],
      attributes: { 'data-id-paragraph-style': 'folio' },
      boundsMm: { x: 13, y: 10, width: 20, height: 9 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
});

test('validateAuthoringRules skips grid checks for annotation roles', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'annotation-note',
      role: 'shape',
      tagName: 'div',
      classList: ['annotation'],
      attributes: { 'data-id-role': ITEM_ROLE.ANNOTATION },
      boundsMm: { x: 13, y: 10, width: 20, height: 9 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.warnings.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
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

test('validateAuthoringRules inherits grid-ignore from a non-mappable authoring container', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'material-label',
      role: 'text',
      tagName: 'p',
      classList: ['material-name'],
      attributes: { 'data-id-paragraph-style': 'material-name' },
      sourceAncestorNodes: [{
        tagName: 'figcaption',
        attributes: { 'data-id-grid-ignore': '' },
      }],
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

test('validateAuthoringRules rejects graphic protocol fields on a container without its own resource', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'graphic-container',
      role: ITEM_ROLE.GRAPHIC,
      tagName: 'figure',
      classList: ['hero-figure'],
      attributes: { 'data-id-role': ITEM_ROLE.GRAPHIC },
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((entry) => entry.code === 'GRAPHIC_ASSET_REFERENCE_MISSING'
    && entry.itemId === 'graphic-container'), true);
});

test('validateAuthoringRules accepts graphic protocol fields on an image with its own source', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'hero-image',
      role: ITEM_ROLE.GRAPHIC,
      tagName: 'img',
      classList: ['hero-image'],
      attributes: { 'data-id-role': ITEM_ROLE.GRAPHIC, src: './assets/hero.jpg' },
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRAPHIC_ASSET_REFERENCE_MISSING'), false);
});

test('validateAuthoringRules rejects composite layout containers declared as text objects', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'metric-card',
      role: ITEM_ROLE.TEXT,
      tagName: 'div',
      candidateIndex: 0,
      classList: ['metric-card'],
      attributes: { 'data-id-role': ITEM_ROLE.TEXT },
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }, {
      id: 'metric-value',
      role: ITEM_ROLE.TEXT,
      tagName: 'p',
      candidateIndex: 1,
      ancestorCandidateIndexes: [0],
      classList: ['metric-value'],
      attributes: { 'data-id-paragraph-style': 'metric-value' },
      boundsMm: { x: 12, y: 12, width: 20, height: 8 },
    }],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  assert.equal(result.errors.some((entry) => entry.code === 'TEXT_CONTAINER_HAS_CHILD_OBJECTS'
    && entry.itemId === 'metric-card'), true);
});

test('validateAuthoringRules allows a semantic container to follow its child content height', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'content-block',
      role: ITEM_ROLE.SHAPE,
      tagName: 'div',
      candidateIndex: 0,
      classList: ['content-block'],
      attributes: { 'data-id-role': ITEM_ROLE.CONTAINER },
      boundsMm: { x: 10, y: 10, width: 25, height: 25 },
    }, {
      id: 'content-copy',
      role: ITEM_ROLE.TEXT,
      tagName: 'p',
      candidateIndex: 1,
      ancestorCandidateIndexes: [0],
      classList: ['body-copy'],
      attributes: { 'data-id-paragraph-style': 'body-copy' },
      boundsMm: { x: 12, y: 12, width: 20, height: 8 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 0.5 });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'
    && entry.itemId === 'content-block'), false);
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
