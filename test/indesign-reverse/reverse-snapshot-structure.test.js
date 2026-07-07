const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  reverseSnapshotStructureSignature,
  compareReverseSnapshotStructures,
} = require('../../src/adapters/indesign/audit/reverse-snapshot-structure');

test('compareReverseSnapshotStructures detects vector paint marker and geometry drift', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'arrow-1',
      visualStyle: {
        strokeColor: '#c8102e',
        strokeWeight: 2,
        strokeStyle: 'Dashed',
        strokeLineCap: 'round',
        strokeLineJoin: 'miter',
        lineEndMarker: { type: 'arrow', rawName: 'Simple Arrow' },
      },
      vectorGeometry: lineGeometry(100, 120, 220, 120),
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'arrow-1',
      visualStyle: {
        strokeColor: '#111111',
        strokeWeight: 2,
        strokeStyle: 'Solid',
        strokeLineCap: 'butt',
        strokeLineJoin: 'miter',
        lineEndMarker: null,
      },
      vectorGeometry: lineGeometry(100, 120, 230, 120),
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual, { geometryTolerance: 0.1 });

  assert.equal(diff.ok, false);
  assert.deepEqual(Array.from(new Set(diff.errors.map((issue) => issue.code))).sort(), [
    'REVERSE_SNAPSHOT_VECTOR_GEOMETRY_CHANGED',
    'REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED',
  ].sort());
  assert.equal(diff.errors.some((issue) => issue.field === 'strokeColor'), true);
  assert.equal(diff.errors.some((issue) => issue.field === 'lineEndMarker'), true);
});

test('compareReverseSnapshotStructures ignores hidden stroke metadata on non-line frames', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'text-frame-with-hidden-line-style',
      type: 'TextFrame',
      visualStyle: {
        strokeColor: null,
        strokeWeight: null,
        strokeStyle: '虚线（3 和 2）',
        strokeLineCap: 'round',
        strokeLineJoin: 'miter',
        strokeMiterLimit: 4,
        lineEndMarker: { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
      },
      vectorGeometry: null,
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'text-frame-with-hidden-line-style',
      type: 'TextFrame',
      visualStyle: {
        strokeColor: null,
        strokeWeight: null,
        strokeStyle: '实底',
        strokeLineCap: 'butt',
        strokeLineJoin: 'round',
        strokeMiterLimit: 1,
        lineEndMarker: null,
      },
      vectorGeometry: null,
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures matches degenerate polygons to native graphic lines', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'polygon-line',
      type: 'Polygon',
      bounds: { x: 120, y: 80, width: 0, height: 220 },
      visualStyle: {
        fillColor: null,
        strokeColor: '#ff7832',
        strokeWeight: 5,
        strokeStyle: '垂直线',
        strokeAlignment: 'center',
      },
      vectorGeometry: {
        kind: 'polygon',
        paths: [{
          closed: false,
          points: [
            point(120, 80),
            point(120, 300),
          ],
        }],
      },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'generated-line',
      type: 'GraphicLine',
      bounds: { x: 120.01, y: 80.01, width: 0, height: 220.01 },
      visualStyle: {
        fillColor: null,
        strokeColor: '#ff7832',
        strokeWeight: 5,
        strokeStyle: '垂直线',
        strokeAlignment: null,
      },
      vectorGeometry: {
        kind: 'line',
        paths: [{
          closed: false,
          points: [
            point(120.01, 80.01),
            point(120.01, 300.02),
          ],
        }],
      },
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual, { geometryTolerance: 0.05 });

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures treats placed rectangles and graphic frames as asset frames', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([{
    id: 'pdf-frame',
    type: 'GraphicFrame',
    bounds: { x: 120, y: 80, width: 200, height: 120 },
    labels: [],
    visualStyle: {
      fillColor: null,
      strokeColor: null,
      strokeWeight: null,
    },
    placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 3 } },
  }]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([{
    id: 'pdf-frame',
    type: 'Rectangle',
    bounds: { x: 120, y: 80, width: 200, height: 120 },
    labels: [],
    visualStyle: {
      fillColor: null,
      strokeColor: null,
      strokeWeight: 0,
    },
    placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 3 } },
  }]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures ignores no-paint no-content page items', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'hidden-grid-line',
      type: 'GraphicLine',
      visualStyle: {
        fillColor: null,
        strokeColor: null,
        strokeWeight: null,
        strokeStyle: '虚线（3 和 2）',
        lineEndMarker: { type: 'arrow', rawName: 'SIMPLE_WIDE_ARROW_HEAD' },
      },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures still reports missing visible line items', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'visible-line',
      type: 'GraphicLine',
      visualStyle: {
        fillColor: null,
        strokeColor: '#111111',
        strokeWeight: 1,
        strokeStyle: '实底',
      },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ITEM_MISSING'), true);
});

test('reverseSnapshotStructureSignature records filled-vector coverage candidates', () => {
  const signature = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'filled-shape',
      bounds: { x: 20, y: 20, width: 200, height: 120 },
      zIndex: 1,
      visualStyle: { fillColor: '#f5c850', fillOpacity: 100 },
      vectorGeometry: rectangleGeometry(20, 20, 200, 120),
    }),
    {
      id: 'image-1',
      type: 'Rectangle',
      bounds: { x: 10, y: 10, width: 220, height: 140 },
      zIndex: 5,
      labels: [{ kind: 'item', id: 'image-1' }],
      placedAsset: { path: '\\\\nas\\share\\plan.pdf', placement: { pageNumber: 1 } },
    },
  ]));

  assert.equal(signature.summary.vectorPaint.filled, 1);
  assert.equal(signature.summary.vectorPaint.nonBackgroundFilled, 1);
  assert.equal(signature.summary.vectorPaint.coveredByAssets, 1);
  assert.equal(signature.summary.vectorPaint.nonBackgroundCoveredByAssets, 1);
  assert.deepEqual(signature.pages[0].occlusionCandidates[0].vectorId, 'filled-shape');
  assert.equal(signature.pages[0].occlusionCandidates[0].backgroundLike, false);
});

test('compareReverseSnapshotStructures detects missing filled vector and extra page', () => {
  const expected = reverseSnapshotStructureSignature({
    pages: [
      page('1', [vectorItem({ id: 'filled-shape', visualStyle: { fillColor: '#8ca064' } })]),
    ],
  });
  const actual = reverseSnapshotStructureSignature({
    pages: [
      page('1', []),
      page('2', []),
    ],
  });

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ITEM_MISSING' && issue.itemId === 'filled-shape'), true);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_PAGE_EXTRA' && issue.pageId === '2'), true);
});

test('compareReverseSnapshotStructures compares guide positions from reverse snapshots', () => {
  const expected = reverseSnapshotStructureSignature({
    pages: [
      page('1', [], [{ orientation: 'horizontal', position: 220.472 }]),
    ],
  });
  const actual = reverseSnapshotStructureSignature({
    pages: [
      page('1', [], [{ orientation: 'horizontal', position: 260 }]),
    ],
  });

  const diff = compareReverseSnapshotStructures(expected, actual, { guideTolerance: 0.1 });

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.length, 1);
  assert.equal(diff.errors[0].code, 'REVERSE_SNAPSHOT_PAGE_GUIDES_CHANGED');
  assert.deepEqual(diff.errors[0].expected, [{ orientation: 'horizontal', location: 220.472 }]);
  assert.deepEqual(diff.errors[0].actual, [{ orientation: 'horizontal', location: 260 }]);
});

test('reverseSnapshotStructureSignature uses auditItems when a deep InDesign audit surface is present', () => {
  const signature = reverseSnapshotStructureSignature({
    pages: [{
      ...page('1', [
        vectorItem({ id: 'top-level-rule', visualStyle: { strokeColor: '#999999', strokeWeight: 1 } }),
      ]),
      auditItems: [
        vectorItem({ id: 'top-level-rule', visualStyle: { strokeColor: '#999999', strokeWeight: 1 } }),
        vectorItem({
          id: 'group-fill',
          type: 'Polygon',
          bounds: { x: 100, y: 100, width: 20, height: 20 },
          visualStyle: { fillColor: '#cf53b3' },
          parent: { id: 'group-1', type: 'Group' },
          vectorGeometry: rectangleGeometry(100, 100, 20, 20),
        }),
      ],
    }],
  });

  assert.equal(signature.summary.items, 2);
  assert.equal(signature.summary.vectorPaint.nonBackgroundFilled, 1);
  assert.equal(signature.pages[0].items.some((item) => item.id === 'group-fill' && item.parent.type === 'Group'), true);
});

test('compareReverseSnapshotStructures matches unlabeled items by structural fingerprint instead of raw InDesign id', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: '100',
      type: 'GraphicLine',
      bounds: { x: 10, y: 20, width: 0, height: 80 },
      visualStyle: { strokeColor: '#000000', strokeWeight: 2 },
      vectorGeometry: lineGeometry(10, 20, 10, 100),
    },
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: '200',
      type: 'GraphicLine',
      bounds: { x: 10, y: 20, width: 0, height: 80 },
      visualStyle: { strokeColor: '#c8102e', strokeWeight: 2 },
      vectorGeometry: lineGeometry(10, 20, 10, 100),
    },
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.length, 1);
  assert.equal(diff.errors[0].code, 'REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED');
  assert.equal(diff.errors[0].field, 'strokeColor');
});

test('compareReverseSnapshotStructures matches unlabeled text by content and position when frame height drifts', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: '100',
      type: 'TextFrame',
      bounds: { x: 234.1, y: 610.1, width: 127.9, height: 50.3 },
      text: '2026年3月27日 线上会议',
      visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    },
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: '200',
      type: 'TextFrame',
      bounds: { x: 234.1, y: 610.1, width: 127.9, height: 62 },
      text: '2026年3月27日 线上会议',
      visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    },
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.length, 1);
  assert.equal(diff.errors[0].code, 'REVERSE_SNAPSHOT_BOUNDS_CHANGED');
  assert.equal(diff.errors[0].itemId, expected.pages[0].items[0].id);
});

test('compareReverseSnapshotStructures matches text frames by effective text before reporting text drift', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: 'source-copy',
      type: 'TextFrame',
      bounds: { x: 42.52, y: 226.35, width: 333.07, height: 301.27 },
      text: '团队最终采用暖色清水\n      混凝土为立面主材料，\n      ',
      visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    },
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: 'roundtrip-copy',
      type: 'TextFrame',
      bounds: { x: 42.52, y: 226.35, width: 333.07, height: 301.27 },
      text: '团队最终采用暖色清水\n混凝土为立面主材料，',
      visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    },
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ITEM_MISSING'), false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ITEM_EXTRA'), false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_TEXT_CHANGED'), true);
});

test('compareReverseSnapshotStructures can match an unlabeled source item to a labeled roundtrip item by fingerprint', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: '100',
      type: 'Rectangle',
      bounds: { x: 10, y: 20, width: 40, height: 30 },
      visualStyle: { fillColor: '#8ca064' },
      vectorGeometry: rectangleGeometry(10, 20, 40, 30),
    },
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    {
      id: 'generated-1',
      type: 'Rectangle',
      bounds: { x: 10, y: 20, width: 40, height: 30 },
      labels: [{ kind: 'item', id: 'semantic-shape-1' }],
      visualStyle: { fillColor: '#8ca064' },
      vectorGeometry: rectangleGeometry(10, 20, 40, 30),
    },
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures ignores absolute zIndex drift when relative stacking is stable', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({ id: 'bottom-rule', zIndex: 10 }),
    vectorItem({ id: 'top-rule', zIndex: 20 }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({ id: 'bottom-rule', zIndex: 110 }),
    vectorItem({ id: 'top-rule', zIndex: 120 }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures reports relative z-order inversions', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({ id: 'bottom-rule', zIndex: 10 }),
    vectorItem({ id: 'top-rule', zIndex: 20 }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({ id: 'bottom-rule', zIndex: 120 }),
    vectorItem({ id: 'top-rule', zIndex: 110 }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.length, 1);
  assert.equal(diff.errors[0].code, 'REVERSE_SNAPSHOT_Z_ORDER_CHANGED');
  assert.equal(diff.errors[0].pageId, '1');
  assert.deepEqual(diff.errors[0].items, {
    behind: 'bottom-rule',
    inFront: 'top-rule',
  });
});

test('compareReverseSnapshotStructures reports placed asset placement drift by field', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    placedAssetItem({
      id: 'pdf-1',
      placement: {
        crop: 'content',
        pdfCrop: 'CROP_CONTENT_VISIBLE_LAYERS',
        fit: 'manual',
        frameBounds: { x: 10, y: 20, width: 300, height: 160 },
        contentBounds: { x: -15, y: -25, width: 360, height: 220 },
        contentOffset: { x: -25, y: -45 },
        contentSize: { width: 360, height: 220 },
        contentScale: { x: 1.2, y: 1.35 },
        visibleLayers: ['linework'],
        hiddenLayers: ['hatch'],
      },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    placedAssetItem({
      id: 'pdf-1',
      placement: {
        crop: 'media',
        pdfCrop: 'CROP_MEDIA',
        fit: 'manual',
        frameBounds: { x: 10, y: 20, width: 300, height: 160 },
        contentBounds: { x: -15, y: -30, width: 360, height: 180 },
        contentOffset: { x: -25, y: -50 },
        contentSize: { width: 360, height: 180 },
        contentScale: { x: 1.2, y: 0.9 },
        visibleLayers: ['linework'],
        hiddenLayers: ['hatch'],
      },
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual, { numberTolerance: 0.01 });

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ASSET_CHANGED'), false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED' && issue.field === 'placement.crop'), true);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED' && issue.field === 'placement.pdfCrop'), true);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED' && issue.field === 'placement.contentScale'), true);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_ASSET_PLACEMENT_CHANGED' && issue.field === 'placement.contentOffset'), true);
});

test('compareReverseSnapshotStructures ignores generated preview package path drift', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    placedAssetItem({
      id: 'embedded-preview',
      path: 'D:\\runs\\first\\author\\previews\\embedded-image.png',
      name: 'embedded-image.png',
      graphicType: 'Image',
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    placedAssetItem({
      id: 'embedded-preview',
      path: 'D:\\runs\\second\\author\\previews\\embedded-image.png',
      name: 'embedded-image.png',
      graphicType: 'Image',
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures matches pathless embedded images to generated asset previews', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([{
    id: 'embedded-source',
    type: 'Rectangle',
    bounds: { x: 22.68, y: 214.02, width: 272.19, height: 337.32 },
    visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    placedAsset: {
      name: null,
      path: null,
      status: null,
      graphicType: 'Image',
      imageTypeName: null,
      bounds: { x: -74.83, y: 209.3, width: 470.55, height: 356.45 },
      cropped: true,
      placement: {
        contentOffset: { x: -97.51, y: -4.72 },
        contentScale: { x: 1.73, y: 1.06 },
        frameBounds: { x: 22.68, y: 214.02, width: 272.19, height: 337.32 },
      },
    },
  }]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([{
    id: 'embedded-roundtrip',
    type: 'Rectangle',
    bounds: { x: 22.68, y: 214.02, width: 272.19, height: 337.32 },
    visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
    placedAsset: {
      name: 'embedded-roundtrip-asset.png',
      path: 'D:\\runs\\second\\author\\previews\\embedded-roundtrip-asset.png',
      status: 'NORMAL',
      graphicType: 'Image',
      imageTypeName: 'PNG',
      bounds: { x: 22.68, y: 214.02, width: 272.19, height: 337.32 },
      cropped: false,
      placement: null,
    },
  }]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures ignores stroke alignment when stroke is not visible', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'fill-only-shape',
      type: 'Rectangle',
      visualStyle: { fillColor: '#eeeeee', strokeColor: null, strokeWeight: null, strokeAlignment: 'center' },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'fill-only-shape',
      type: 'Rectangle',
      visualStyle: { fillColor: '#eeeeee', strokeColor: null, strokeWeight: null, strokeAlignment: 'inside' },
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures ignores stroke alignment for native graphic lines', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'native-line',
      type: 'GraphicLine',
      visualStyle: { fillColor: null, strokeColor: '#111111', strokeWeight: 1, strokeAlignment: 'center' },
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'native-line',
      type: 'GraphicLine',
      visualStyle: { fillColor: null, strokeColor: '#111111', strokeWeight: 1, strokeAlignment: 'inside' },
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, true);
  assert.deepEqual(diff.errors, []);
});

test('compareReverseSnapshotStructures still reports stroke alignment when stroke is visible', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'stroked-shape',
      type: 'Rectangle',
      bounds: { x: 100, y: 120, width: 120, height: 80 },
      visualStyle: { fillColor: null, strokeColor: '#111111', strokeWeight: 1, strokeAlignment: 'center' },
      vectorGeometry: rectangleGeometry(100, 120, 120, 80),
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'stroked-shape',
      type: 'Rectangle',
      bounds: { x: 100, y: 120, width: 120, height: 80 },
      visualStyle: { fillColor: null, strokeColor: '#111111', strokeWeight: 1, strokeAlignment: 'inside' },
      vectorGeometry: rectangleGeometry(100, 120, 120, 80),
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_VISUAL_STYLE_CHANGED' && issue.field === 'strokeAlignment'), true);
});

test('audit-reverse-snapshot-structure invalid-input 必须 fail', () => {
  const diff = compareReverseSnapshotStructures({ pages: [] }, { pages: [] });

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_INPUT_INVALID'), true);

  const root = path.resolve('test/workspace/reverse-snapshot-structure-invalid-input');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const expectedPath = path.join(root, 'expected.json');
  const actualPath = path.join(root, 'actual.json');
  fs.writeFileSync(expectedPath, JSON.stringify({ pages: [] }), 'utf8');
  fs.writeFileSync(actualPath, JSON.stringify({ pages: [] }), 'utf8');

  const result = spawnSync(process.execPath, [
    path.resolve('scripts/audit-reverse-snapshot-structure.js'),
    '--expected', expectedPath,
    '--actual', actualPath,
  ], { encoding: 'utf8' });

  assert.notEqual(result.status, 0, result.stdout);
});

test('compareReverseSnapshotStructures fails when vector geometry is missing on both sides', () => {
  const expected = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'filled-vector',
      type: 'Rectangle',
      bounds: { x: 100, y: 120, width: 120, height: 80 },
      visualStyle: { fillColor: '#eeeeee', strokeColor: null, strokeWeight: null },
      vectorGeometry: null,
    }),
  ]));
  const actual = reverseSnapshotStructureSignature(snapshotWithItems([
    vectorItem({
      id: 'filled-vector',
      type: 'Rectangle',
      bounds: { x: 100, y: 120, width: 120, height: 80 },
      visualStyle: { fillColor: '#eeeeee', strokeColor: null, strokeWeight: null },
      vectorGeometry: null,
    }),
  ]));

  const diff = compareReverseSnapshotStructures(expected, actual);

  assert.equal(diff.ok, false);
  assert.equal(diff.errors.some((issue) => issue.code === 'REVERSE_SNAPSHOT_VECTOR_GEOMETRY_MISSING'), true);
});

function snapshotWithItems(items) {
  return { pages: [page('1', items)] };
}

function page(id, items, guides = []) {
  return {
    id,
    index: Number(id) - 1,
    bounds: { x: 0, y: 0, width: 1000, height: 600 },
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    guides,
    items,
  };
}

function vectorItem(overrides = {}) {
  return {
    id: overrides.id || 'vector-1',
    type: overrides.type || 'GraphicLine',
    bounds: overrides.bounds || { x: 100, y: 120, width: 120, height: 0 },
    layerName: '内容',
    objectStyleName: '箭头',
    parent: overrides.parent || null,
    zIndex: overrides.zIndex || 1,
    labels: [{ kind: 'item', id: overrides.id || 'vector-1' }],
    visualStyle: overrides.visualStyle || { strokeColor: '#c8102e', strokeWeight: 2 },
    vectorGeometry: Object.prototype.hasOwnProperty.call(overrides, 'vectorGeometry')
      ? overrides.vectorGeometry
      : lineGeometry(100, 120, 220, 120),
  };
}

function placedAssetItem(overrides = {}) {
  return {
    id: overrides.id || 'asset-1',
    type: 'Rectangle',
    bounds: overrides.bounds || { x: 10, y: 20, width: 300, height: 160 },
    layerName: 'content',
    objectStyleName: 'asset-frame',
    zIndex: 1,
    labels: [{ kind: 'item', id: overrides.id || 'asset-1' }],
    placedAsset: {
      name: overrides.name || 'drawing.pdf',
      path: overrides.path || '\\\\nas\\share\\drawing.pdf',
      status: 'NORMAL',
      graphicType: overrides.graphicType || 'PDF',
      imageTypeName: overrides.imageTypeName || 'Adobe PDF',
      bounds: overrides.assetBounds || { x: -15, y: -25, width: 360, height: 220 },
      cropped: true,
      placement: overrides.placement || {},
    },
  };
}

function lineGeometry(x1, y1, x2, y2) {
  return {
    kind: 'line',
    paths: [{
      closed: false,
      points: [
        point(x1, y1),
        point(x2, y2),
      ],
    }],
  };
}

function rectangleGeometry(x, y, width, height) {
  return {
    kind: 'rectangle',
    paths: [{
      closed: true,
      points: [
        point(x, y),
        point(x + width, y),
        point(x + width, y + height),
        point(x, y + height),
      ],
    }],
  };
}

function point(x, y) {
  return {
    anchor: { x, y },
    leftDirection: { x, y },
    rightDirection: { x, y },
    pointType: null,
  };
}
