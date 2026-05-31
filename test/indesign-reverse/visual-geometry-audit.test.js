const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVisualGeometry } = require('../../src/indesign-reverse/visual-geometry-audit');

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
