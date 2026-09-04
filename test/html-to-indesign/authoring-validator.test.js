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
  // The folio is an auto-width text item, so only its left edge is grid-checked.
  assert.deepEqual(warning.edges, ['left']);
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

test('content inside a grid-placed block is not measured against the page grid', () => {
  const snapshot = snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2', 'data-id-column-gutter': '2mm', 'data-id-row-gutter': '2mm' },
    items: [{
      id: 'card-copy',
      role: 'text',
      tagName: 'p',
      classList: ['card-copy'],
      attributes: { 'data-id-paragraph-style': 'body-copy' },
      sourceAncestorNodes: [{
        tagName: 'div',
        id: 'card',
        classList: ['grid-item', 'card'],
        attributes: { style: '--grid-col:1;--grid-span:2;--grid-row:1;--grid-row-span:1' },
        gridPlaced: true,
      }],
      boundsMm: { x: 16.35, y: 16.35, width: 20, height: 6 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);
  assert.equal(result.gridIgnoredCount, 0);
  assert.equal(result.gridOffCount, 0);
});

test('an ancestor without gridPlaced is still recognised by its grid-item class or --grid-col style', () => {
  const base = {
    id: 'card-copy',
    role: 'text',
    tagName: 'p',
    classList: ['card-copy'],
    attributes: { 'data-id-paragraph-style': 'body-copy' },
    boundsMm: { x: 16.35, y: 16.35, width: 20, height: 6 },
  };
  const byClass = validateAuthoringRules(snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2' },
    items: [{ ...base, sourceAncestorNodes: [{ tagName: 'div', classList: ['grid-item'], attributes: {} }] }],
  }), { strict: true, gridTolerance: 1 });
  assert.equal(byClass.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);

  const byStyle = validateAuthoringRules(snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2' },
    items: [{ ...base, sourceAncestorNodes: [{ tagName: 'div', classList: ['band'], attributes: { style: '--grid-row: 2; --grid-row-span: 1' } }] }],
  }), { strict: true, gridTolerance: 1 });
  assert.equal(byStyle.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), false);

  const plainWrapper = validateAuthoringRules(snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2' },
    items: [{ ...base, sourceAncestorNodes: [{ tagName: 'div', classList: ['wrapper'], attributes: {} }] }],
  }), { strict: true, gridTolerance: 1 });
  assert.equal(plainWrapper.errors.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF'), true, 'a wrapper that is not on the grid does not shield its content');
});

test('GRID_ALIGNMENT_OFF entries carry per-edge offsets, the nearest line and a concrete fix', () => {
  const snapshot = snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2', 'data-id-column-gutter': '2mm', 'data-id-row-gutter': '2mm' },
    items: [{
      id: 'title',
      role: 'text',
      tagName: 'h2',
      classList: ['page-title'],
      attributes: { 'data-id-paragraph-style': 'page-title' },
      boundsMm: { x: 13, y: 14, width: 20, height: 6 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  const entry = result.errors.find((issue) => issue.code === 'GRID_ALIGNMENT_OFF' && issue.itemId === 'title');
  assert.ok(entry);
  assert.deepEqual(entry.edges, ['left', 'top']);
  assert.deepEqual(entry.edgeOffsets, [
    { edge: 'left', valueMm: 13, nearestLineMm: 10, offsetMm: 3 },
    { edge: 'top', valueMm: 14, nearestLineMm: 10, offsetMm: 4 },
  ]);
  assert.match(entry.message, /left at 13mm is 3mm right of the column line at 10mm/);
  assert.match(entry.message, /top at 14mm is 4mm below the row line at 10mm/);
  assert.match(entry.suggestedFix, /Move #title left edge to 10mm \(-3mm\), top edge to 10mm \(-4mm\)/);
  assert.match(entry.suggestedFix, /content inside a placed block is not checked/);
  assert.equal(result.gridOffCount, 1);
});

test('gridIgnoredCount counts mappable items exempted by data-id-grid-ignore, own or inherited', () => {
  const snapshot = snapshotWithPage({
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '4x2' },
    items: [{
      id: 'bleed',
      role: 'graphic',
      tagName: 'img',
      classList: ['hero'],
      attributes: { src: 'hero.png', 'data-id-grid-ignore': '' },
      boundsMm: { x: 3, y: 3, width: 50, height: 30 },
    }, {
      id: 'caption',
      role: 'text',
      tagName: 'p',
      classList: ['caption'],
      attributes: { 'data-id-paragraph-style': 'caption' },
      sourceAncestorNodes: [{ tagName: 'figure', classList: ['figure'], attributes: { 'data-id-grid-ignore': '' } }],
      boundsMm: { x: 3, y: 36, width: 20, height: 5 },
    }, {
      id: 'aligned',
      role: 'text',
      tagName: 'p',
      classList: ['body-copy'],
      attributes: { 'data-id-paragraph-style': 'body-copy' },
      boundsMm: { x: 10, y: 10, width: 20, height: 5 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.gridIgnoredCount, 2);
  assert.equal(result.gridOffCount, 0);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

const GRID_PAGE_ATTRIBUTES = {
  'data-id-margin': '10mm',
  'data-id-grid': '4x2',
  'data-id-column-gutter': '2mm',
  'data-id-row-gutter': '2mm',
};

// 120×80mm / 10mm 页边距 / 4x2 网格 / 2mm 间距 →
// 纵线 0/10/33.5/35.5/59/61/84.5/86.5/110/120，横线 0/10/39/41/70/80。
function cardCopyItem(overrides = {}) {
  return {
    id: 'card-copy',
    role: 'text',
    tagName: 'p',
    classList: ['card-copy'],
    attributes: { 'data-id-paragraph-style': 'body-copy' },
    boundsMm: { x: 16.35, y: 16.35, width: 20, height: 6 },
    ...overrides,
  };
}

function placedNode(overrides = {}) {
  return {
    tagName: 'div',
    id: 'card',
    sourcePath: 'div:nth-of-type(1)',
    classList: ['grid-item', 'card'],
    attributes: {},
    gridPlaced: true,
    ...overrides,
  };
}

test('a grid-placed block is measured itself when its content is not', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      sourceAncestorNodes: [placedNode({ boundsMm: { x: 13, y: 14, width: 47, height: 25 } })],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  const entries = result.errors.filter((issue) => issue.code === 'GRID_ALIGNMENT_OFF');
  assert.equal(entries.length, 1, JSON.stringify(result.errors));
  const [entry] = entries;
  assert.equal(entry.itemId, 'card');
  assert.equal(entry.block, true);
  // 右边缘 60mm 离 59/61 两根线各 1mm，在容差内；底边永远不查。
  assert.deepEqual(entry.edges, ['left', 'top']);
  assert.deepEqual(entry.blockOf, ['card-copy']);
  assert.equal(entry.blockOfCount, 1);
  assert.deepEqual(entry.edgeOffsets[0], {
    edge: 'left', valueMm: 13, nearestLineMm: 10, offsetMm: 3,
  });
  assert.match(entry.suggestedFix, /Move #card left edge to 10mm \(-3mm\)/);
  // 块级修法不能再叫作者"放到网格上"——它已经带着放置。成因只有两类：块自己的
  // margin / transform，或者声明的网格与它实际被放置的 CSS grid 不一致。
  // padding 推不动 border-box 的左/上边缘，不许再写进成因里。
  assert.match(entry.suggestedFix, /this block already carries a grid placement/);
  assert.match(entry.suggestedFix, /margin or transform/);
  assert.match(entry.suggestedFix, /not matching the CSS grid it is placed on/);
  assert.equal(entry.suggestedFix.includes('padding'), false, entry.suggestedFix);
  assert.equal(entry.suggestedFix.includes('content inside a placed block is not checked'), false);
  assert.equal(result.gridOffCount, 1);
  // 责任在块上，块内文本不能再被单独报一条。
  assert.equal(result.errors.some((issue) => issue.itemId === 'card-copy'), false);
});

test('a grid-placed block sitting on the grid lets its whole subtree pass', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      sourceAncestorNodes: [placedNode({ boundsMm: { x: 10, y: 10, width: 49, height: 29 } })],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.errors.some((issue) => issue.code === 'GRID_ALIGNMENT_OFF'), false, JSON.stringify(result.errors));
  assert.equal(result.gridOffCount, 0);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('one off-grid block is reported once no matter how many items it holds', () => {
  const offGrid = { x: 13, y: 14, width: 47, height: 25 };
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [
      cardCopyItem({ sourceAncestorNodes: [placedNode({ boundsMm: offGrid })] }),
      cardCopyItem({
        id: 'card-title',
        tagName: 'h3',
        boundsMm: { x: 16.35, y: 25, width: 30, height: 8 },
        sourceAncestorNodes: [placedNode({ boundsMm: offGrid })],
      }),
    ],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  const entries = result.errors.filter((issue) => issue.code === 'GRID_ALIGNMENT_OFF');
  assert.equal(entries.length, 1, JSON.stringify(entries));
  assert.deepEqual(entries[0].blockOf, ['card-copy', 'card-title']);
  assert.equal(result.gridOffCount, 1);
});

test('only the outermost placed block is responsible when placed blocks nest', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      sourceAncestorNodes: [
        placedNode({ id: 'column', sourcePath: 'div:nth-of-type(2)', boundsMm: { x: 10, y: 10, width: 49, height: 29 } }),
        placedNode({ id: 'inner-card', sourcePath: 'div:nth-of-type(2)>div:nth-of-type(1)', boundsMm: { x: 13, y: 14, width: 20, height: 12 } }),
      ],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.errors.some((issue) => issue.code === 'GRID_ALIGNMENT_OFF'), false, JSON.stringify(result.errors));
  assert.equal(result.gridOffCount, 0);
});

test('a grid-ignored subtree exempts the placed blocks inside it', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      sourceAncestorNodes: [
        {
          tagName: 'figure',
          id: 'bleed',
          sourcePath: 'figure:nth-of-type(1)',
          classList: ['bleed'],
          attributes: { 'data-id-grid-ignore': '' },
        },
        placedNode({ boundsMm: { x: 13, y: 14, width: 47, height: 25 } }),
      ],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.errors.some((issue) => issue.code === 'GRID_ALIGNMENT_OFF'), false, JSON.stringify(result.errors));
  assert.equal(result.gridIgnoredCount, 1);
  assert.equal(result.gridOffCount, 0);
});

test('a placed block from an older snapshot without bounds is skipped, not reported', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({ sourceAncestorNodes: [placedNode()] })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.errors.some((issue) => issue.code === 'GRID_ALIGNMENT_OFF'), false, JSON.stringify(result.errors));
  assert.equal(result.gridOffCount, 0);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.gridBlockSkippedCount, 1);
  assert.equal(result.gridBlockCheckedCount, 0);
});

// 决策：块内只有注解 / folio 时，块照样要量。免检的是条目自己的边缘，
// 而块是作者亲手放上网格的东西。
test('a placed block whose only content is an annotation is still measured itself', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      id: 'card-note',
      attributes: { 'data-id-role': 'annotation' },
      sourceAncestorNodes: [placedNode({ boundsMm: { x: 13, y: 14, width: 47, height: 25 } })],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  const entries = result.errors.filter((issue) => issue.code === 'GRID_ALIGNMENT_OFF');
  assert.equal(entries.length, 1, JSON.stringify(result.errors));
  assert.equal(entries[0].block, true);
  assert.equal(entries[0].itemId, 'card');
  // 注解条目自己不被点名，只作为块的归属内容出现。
  assert.equal(result.errors.some((issue) => issue.itemId === 'card-note'), false);
  assert.deepEqual(entries[0].blockOf, ['card-note']);
  assert.equal(result.gridBlockCheckedCount, 1);
});

test('a placed block with no id and no sourcePath falls back to a positional label', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [cardCopyItem({
      sourceAncestorNodes: [placedNode({
        id: undefined,
        sourcePath: undefined,
        boundsMm: { x: 13, y: 14, width: 47, height: 25 },
      })],
    })],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  const entries = result.errors.filter((issue) => issue.code === 'GRID_ALIGNMENT_OFF');
  assert.equal(entries.length, 1, JSON.stringify(result.errors));
  const [entry] = entries;
  assert.match(entry.itemId, /^div@/);
  assert.equal(entry.itemId, 'div@13,14mm');
  assert.equal(entry.message.includes('#undefined'), false, entry.message);
  assert.equal(entry.suggestedFix.includes('#undefined'), false, entry.suggestedFix);
  assert.match(entry.suggestedFix, /^Move div@13,14mm left edge to 10mm \(-3mm\)/);
});

// 计数分开的意义就在这一条：0 偏移可以是"都压住线"，也可以是"一个都没量"。
// 而且这本账必须闭合：每个可映射条目恰好落进 ignored / shielded / checked / skipped
// 之一，缺一类就等于有条目被悄悄挡掉而报告里看不出来。
test('grid counters separate what was measured, what a block shielded and what could not be measured', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [
      // 压住线的块里的内容：块量、内容不量。
      cardCopyItem({
        id: 'shielded-copy',
        sourceAncestorNodes: [placedNode({ boundsMm: { x: 10, y: 10, width: 49, height: 29 } })],
      }),
      // 没有祖先块，自己直接被量，而且压住了线。
      cardCopyItem({ id: 'measured-copy', boundsMm: { x: 10, y: 10, width: 23.5, height: 6 } }),
      // 整体豁免。
      cardCopyItem({
        id: 'ignored-copy',
        attributes: { 'data-id-paragraph-style': 'body-copy', 'data-id-grid-ignore': '' },
        boundsMm: { x: 13, y: 14, width: 20, height: 6 },
      }),
      // 承担放置但没有几何的块：量不出来，只能留痕。
      cardCopyItem({
        id: 'boundless-copy',
        sourceAncestorNodes: [placedNode({ id: 'boundless-card', sourcePath: 'div:nth-of-type(9)' })],
      }),
    ],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.gridCheckedCount, 1);
  // 块挡住的条目按条目计数：让 boundless-card 被指认出来的那个条目同样被挡住。
  assert.equal(result.gridShieldedCount, 2);
  assert.equal(result.gridBlockCheckedCount, 1);
  assert.equal(result.gridBlockSkippedCount, 1);
  assert.equal(result.gridIgnoredCount, 1);
  assert.equal(result.gridOffCount, 0);
  assert.equal(result.gridBlockOffCount, 0);
  // 这个夹具里没有条目被 shouldCheckGrid 的其他规则挡掉（没有 annotation / folio /
  // flex 自适应文本 / 整页 / 无几何条目），所以 skipped 是 0。
  assert.equal(result.gridSkippedCount, 0);
  // 账要平：四类相加等于本页可映射条目总数（这个夹具四个条目都是可映射的）。
  const mappableItems = snapshot.pages[0].items.length;
  assert.equal(mappableItems, 4);
  assert.equal(
    result.gridCheckedCount + result.gridShieldedCount + result.gridIgnoredCount + result.gridSkippedCount,
    mappableItems,
    JSON.stringify({
      checked: result.gridCheckedCount,
      shielded: result.gridShieldedCount,
      ignored: result.gridIgnoredCount,
      skipped: result.gridSkippedCount,
    }),
  );
});

// skipped 这一类不是摆设：一个 annotation 条目、一个整页条目都会走 shouldCheckGrid 的
// 其他规则被挡掉，缺了这个计数它们就凭空消失，账也就永远差两条。
test('gridSkippedCount catches mappable items dropped by the other shouldCheckGrid rules', () => {
  const snapshot = snapshotWithPage({
    attributes: GRID_PAGE_ATTRIBUTES,
    items: [
      // annotation 角色：条目自己的边缘免检。
      cardCopyItem({
        id: 'note',
        attributes: { 'data-id-paragraph-style': 'body-copy', 'data-id-role': 'annotation' },
        boundsMm: { x: 13, y: 14, width: 20, height: 6 },
      }),
      // folio 段落样式：页码位置由排版惯例决定。
      cardCopyItem({
        id: 'folio',
        attributes: { 'data-id-paragraph-style': 'folio' },
        boundsMm: { x: 13, y: 14, width: 20, height: 6 },
      }),
      // 压住线、正常被量的条目：证明 skipped 不是把所有条目都算进去。
      cardCopyItem({ id: 'measured-copy', boundsMm: { x: 10, y: 10, width: 23.5, height: 6 } }),
    ],
  });

  const result = validateAuthoringRules(snapshot, { strict: true, gridTolerance: 1 });

  assert.equal(result.gridSkippedCount, 2);
  assert.equal(result.gridCheckedCount, 1);
  assert.equal(result.gridShieldedCount, 0);
  assert.equal(result.gridIgnoredCount, 0);
  assert.equal(
    result.gridCheckedCount + result.gridShieldedCount + result.gridIgnoredCount + result.gridSkippedCount,
    snapshot.pages[0].items.length,
  );
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

test('validateAuthoringRules accepts native semantic text without project-only tokens', () => {
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

  assert.equal(result.valid, true);
  assert.equal(result.messages.some((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING'), false);
});

test('validateAuthoringRules keeps safe neutral-element role inference visible but non-blocking in strict mode', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'anonymous-text',
      role: 'text',
      tagName: 'div',
      classList: [],
      attributes: {},
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot, { strict: true });

  assert.equal(result.valid, true);
  assert.equal(result.errors.some((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING'), false);
  const warning = result.warnings.find((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING');
  assert.ok(warning);
  assert.equal(warning.action, 'normalized');
  assert.equal(warning.ruleRef, 'semantics/inferred-role');
  assert.match(warning.suggestedFix, /data-id-role="text"/);
});

test('validateAuthoringRules does not ask authors to name tool-materialized pseudo spans', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'gen1',
      role: 'text',
      tagName: 'span',
      classList: [],
      attributes: { 'data-pseudo-generated': 'before' },
      boundsMm: { x: 10, y: 10, width: 25, height: 30 },
    }],
  });

  const result = validateAuthoringRules(snapshot, {});

  assert.equal(
    result.warnings.some((entry) => entry.code === 'SEMANTIC_TOKEN_MISSING' && entry.itemId === 'gen1'),
    false,
  );
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

test('validateAuthoringRules accepts PDF and AI protocol fields on an object with its own data source', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'site-plan-ai',
      role: ITEM_ROLE.GRAPHIC,
      tagName: 'object',
      classList: ['site-plan'],
      attributes: {
        'data-id-role': ITEM_ROLE.GRAPHIC,
        'data-id-asset-kind': 'ai',
        'data-id-artboard': '1',
        data: './assets/site-plan.ai',
      },
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
  const issue = result.errors.find((entry) => entry.code === 'TEXT_CONTAINER_HAS_CHILD_OBJECTS'
    && entry.itemId === 'metric-card');
  assert.ok(issue);
  assert.match(issue.suggestedFix, /metric-card/);
  assert.match(issue.suggestedFix, /data-id-role="container"/);
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

test('validateAuthoringRules rejects a text box whose first line cannot compose inside its padding', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 're-title-8',
      role: 'text',
      tagName: 'p',
      classList: ['re-layout-title', 'id-object'],
      attributes: { 'data-id-role': 'text', 'data-id-grid-ignore': '' },
      text: '鸟瞰总览 / Aerial Overview',
      boundsMm: { x: 20, y: 11, width: 190, height: 11 },
      rectPx: { x: 78, y: 42, width: 720, height: 42 },
      computedStyle: {
        overflow: 'hidden',
        fontSize: '24px',
        lineHeight: '26.4px',
        paddingTop: '10px',
        paddingBottom: '10px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
      },
    }],
  });

  const result = validateAuthoringRules(snapshot);

  assert.equal(result.valid, false);
  const issue = result.errors.find((entry) => entry.code === 'TEXT_FIRST_LINE_CANNOT_FIT');
  assert.ok(issue, JSON.stringify(result.errors));
  assert.equal(issue.itemId, 're-title-8');
  assert.match(issue.suggestedFix || '', /height|padding|line-height/);
});

test('validateAuthoringRules keeps single-line overflow visible text for the frame auto-fit rescue', () => {
  const base = {
    id: 'rescued-title',
    role: 'text',
    tagName: 'p',
    classList: ['title'],
    attributes: { 'data-id-role': 'text' },
    text: '单行标题',
    boundsMm: { x: 20, y: 11, width: 190, height: 11 },
    rectPx: { x: 78, y: 42, width: 720, height: 42 },
    computedStyle: {
      overflow: 'visible',
      fontSize: '24px',
      lineHeight: '26.4px',
      paddingTop: '10px',
      paddingBottom: '10px',
      borderTopWidth: '0px',
      borderBottomWidth: '0px',
    },
  };
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [base],
  });

  const result = validateAuthoringRules(snapshot);
  assert.equal(result.errors.some((entry) => entry.code === 'TEXT_FIRST_LINE_CANNOT_FIT'), false);
});

test('validateAuthoringRules accepts a text box whose line fits its inner height', () => {
  const snapshot = snapshotWithPage({
    attributes: {
      'data-id-margin': '10mm',
      'data-id-grid': '4x2',
    },
    items: [{
      id: 'fitting-title',
      role: 'text',
      tagName: 'p',
      classList: ['title', 'id-object'],
      attributes: { 'data-id-role': 'text' },
      text: '案例拆解 / Case Study',
      boundsMm: { x: 20, y: 14, width: 190, height: 11 },
      rectPx: { x: 78, y: 54, width: 820, height: 42 },
      computedStyle: {
        overflow: 'hidden',
        fontSize: '26px',
        lineHeight: '28.6px',
        paddingTop: '0px',
        paddingBottom: '0px',
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
      },
    }],
  });

  const result = validateAuthoringRules(snapshot);
  assert.equal(result.errors.some((entry) => entry.code === 'TEXT_FIRST_LINE_CANNOT_FIT'), false);
});

test('HTML_TEXT_NOT_CONVERTIBLE carries a text preview for location', () => {
  const snapshot = {
    pages: [{
      id: 'page-1',
      uncapturedText: [{ sourcePath: 'div:nth-of-type(1)>span:nth-of-type(1)', text: '这是一段超过二十个字符的不可转换文本示例内容' }],
      items: [],
    }],
  };
  const result = validateAuthoringRules(snapshot, {});
  const error = result.errors.find((entry) => entry.code === 'HTML_TEXT_NOT_CONVERTIBLE');
  assert.ok(error);
  assert.equal(error.textPreview, '这是一段超过二十个字符的不可转换文本示例');
  assert.match(error.message, /Text starts with: "这是一段超过二十个字符的不可转换文本示例"/);
});

function gridPage(items) {
  return {
    id: 'page-1',
    widthMm: 297,
    heightMm: 210,
    rectPx: { x: 0, y: 0, width: 1122.5, height: 793.7 },
    attributes: { 'data-id-margin': '10mm', 'data-id-grid': '12' },
    computedStyle: {},
    authoredStyle: {},
    uncapturedText: [],
    items,
  };
}

function gridTextItem(overrides) {
  return {
    id: 't1',
    tagName: 'h2',
    role: 'text',
    boundsMm: { x: 10, y: 10, width: 50, height: 8 },
    attributes: {},
    classList: [],
    computedStyle: {},
    authoredStyle: {},
    cssVars: {},
    ...overrides,
  };
}

test('auto-width text items skip the right grid edge', () => {
  const result = validateAuthoringRules({ pages: [gridPage([gridTextItem({})])] }, { gridTolerance: 1 });
  assert.equal(result.warnings.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 't1'), false);
});

test('text items with a declared width still check the right grid edge', () => {
  const result = validateAuthoringRules({
    pages: [gridPage([gridTextItem({ authoredStyle: { width: '50mm' } })])],
  }, { gridTolerance: 1 });
  const warning = result.warnings.find((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 't1');
  assert.ok(warning);
  assert.deepEqual(warning.edges, ['right']);
});

test('auto-width text laid out by a flex parent skips grid alignment entirely', () => {
  const result = validateAuthoringRules({
    pages: [gridPage([gridTextItem({
      inFlexFlow: true,
      boundsMm: { x: 118, y: 22, width: 50, height: 8 },
    })])],
  }, { gridTolerance: 1 });
  assert.equal(result.warnings.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 't1'), false);
});

test('flex-flow text with a declared width still checks the grid', () => {
  const result = validateAuthoringRules({
    pages: [gridPage([gridTextItem({
      inFlexFlow: true,
      boundsMm: { x: 118, y: 22, width: 50, height: 8 },
      authoredStyle: { width: '50mm' },
    })])],
  }, { gridTolerance: 1 });
  assert.ok(result.warnings.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 't1'));
});

test('text items with a grid span css var still check the right grid edge', () => {
  const result = validateAuthoringRules({
    pages: [gridPage([gridTextItem({ cssVars: { '--grid-span': '3' } })])],
  }, { gridTolerance: 1 });
  assert.ok(result.warnings.some((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 't1'));
});

test('non-text items keep full edge checking', () => {
  const result = validateAuthoringRules({
    pages: [gridPage([gridTextItem({ id: 's1', tagName: 'div', role: 'shape' })])],
  }, { gridTolerance: 1 });
  const warning = result.warnings.find((entry) => entry.code === 'GRID_ALIGNMENT_OFF' && entry.itemId === 's1');
  assert.ok(warning);
  assert.equal(warning.edges.includes('right'), true);
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
