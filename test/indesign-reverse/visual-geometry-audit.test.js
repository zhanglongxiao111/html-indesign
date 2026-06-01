const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVisualGeometry } = require('../../src/writers/html/audit/visual-geometry-audit');

test('compareVisualGeometry reports missing and shifted author elements', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, x: 100, y: 80, width: 300, height: 40 },
        { key: '0:image', id: 'image', pageIndex: 0, x: 120, y: 180, width: 500, height: 260 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, x: 160, y: 80, width: 300, height: 40 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_GEOMETRY_MISMATCH'), true);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_ELEMENT_MISSING'), true);
  assert.equal(report.stats.compared, 1);
  assert.equal(report.stats.missing, 1);
  assert.equal(report.stats.mismatched, 1);
});

test('compareVisualGeometry accepts matching elements within tolerance', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, x: 100, y: 80, width: 300, height: 40 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000.5, height: 600.4 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, x: 100.5, y: 79.8, width: 299.7, height: 40.3 },
      ],
    },
    tolerance: 1,
  });

  assert.equal(report.ok, true);
  assert.equal(report.stats.compared, 1);
  assert.equal(report.errors.length, 0);
});

test('compareVisualGeometry reports accepted generated author differences as warnings', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:cover-background', id: 'cover-background', pageIndex: 0, tagName: 'svg', generated: true, generatedKind: 'background', x: 0, y: 0, width: 1000, height: 600 },
        { key: '0:card-border-left', id: 'card-border-left', pageIndex: 0, tagName: 'svg', generated: true, generatedKind: 'border', x: 20, y: 20, width: 2, height: 100 },
        { key: '0:label-text', id: 'label-text', pageIndex: 0, tagName: 'span', generated: true, generatedKind: 'text', x: 40, y: 40, width: 80, height: 20 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.warnings.length, 3);
  assert.equal(report.stats.accepted, 3);
});

test('compareVisualGeometry reports ordinary body text missing as an error', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:body-text', id: 'body-text', pageIndex: 0, tagName: 'p', x: 120, y: 160, width: 400, height: 96 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_ELEMENT_MISSING' && issue.id === 'body-text'), true);
  assert.equal(report.stats.missing, 1);
  assert.equal(report.stats.accepted, 0);
});

test('compareVisualGeometry accepts known text metrics and table height drift as warnings', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', paragraphStyle: 'folio', classList: ['page-number'], x: 900, y: 560, width: 17.6, height: 12.8 },
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', paragraphStyle: 'folio', classList: ['page-number'], x: 900.1, y: 560.1, width: 11.9, height: 12 },
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', x: 300.1, y: 100.1, width: 500, height: 284 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
  assert.deepEqual(report.warnings.map((issue) => issue.code), [
    'AUTHOR_VISUAL_TEXT_METRICS_ACCEPTED',
    'AUTHOR_VISUAL_TABLE_HEIGHT_ACCEPTED',
  ]);
  assert.equal(report.stats.accepted, 2);
});

test('compareVisualGeometry reports ordinary table height shrink as an error', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', x: 300.1, y: 100.1, width: 500, height: 284 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_GEOMETRY_MISMATCH' && issue.id === 'metrics'), true);
  assert.equal(report.stats.mismatched, 1);
  assert.equal(report.stats.accepted, 0);
});

test('compareVisualGeometry reports ordinary inline text clipping as an error', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:caption', id: 'caption', pageIndex: 0, tagName: 'span', x: 160, y: 420, width: 88, height: 18 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:caption', id: 'caption', pageIndex: 0, tagName: 'span', x: 160.2, y: 420.1, width: 82.5, height: 17.4 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_GEOMETRY_MISMATCH' && issue.id === 'caption'), true);
  assert.equal(report.stats.mismatched, 1);
  assert.equal(report.stats.accepted, 0);
});
