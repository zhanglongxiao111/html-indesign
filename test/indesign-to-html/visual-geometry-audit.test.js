const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVisualGeometry } = require('../../src/writers/html/audit/visual-geometry-audit');
const {
  enrichCaptureWithReverseModelSourceMetadata,
  loadReverseHtmlEvidence,
} = require('../../src/writers/html/audit/reverse-visual-evidence');

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

test('reverse visual evidence enriches reference source metadata from reverse model evidence', () => {
  const capture = {
    pages: [{ index: 0, width: 1000, height: 600 }],
    elements: [{
      key: '0:metrics',
      id: 'metrics',
      pageIndex: 0,
      tagName: 'table',
      tableStyle: 'area-table',
      dataIdAttrs: ['data-id-table-style'],
      x: 300,
      y: 100,
      width: 500,
      height: 301,
    }],
  };
  const model = {
    pages: [{
      items: [{
        id: 'metrics',
        sourceNode: {
          attributes: {
            'data-id-source-csv': '../smoke-assets/data/metrics.csv',
            'data-id-source-xml': '../smoke-assets/data/metrics.xml',
          },
        },
      }],
    }],
  };

  enrichCaptureWithReverseModelSourceMetadata(capture, model);

  assert.equal(capture.elements[0].sourceCsv, '../smoke-assets/data/metrics.csv');
  assert.equal(capture.elements[0].sourceXml, '../smoke-assets/data/metrics.xml');
  assert.deepEqual(capture.elements[0].dataIdAttrs, [
    'data-id-table-style',
    'data-id-source-csv',
    'data-id-source-xml',
  ]);
});

test('compareVisualGeometry reports text content drift even when geometry matches', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, tagName: 'p', textContent: '原始标题', x: 100, y: 80, width: 300, height: 40 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:title', id: 'title', pageIndex: 0, tagName: 'p', textContent: '错误标题', x: 100, y: 80, width: 300, height: 40 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_TEXT_CONTENT_MISMATCH' && issue.id === 'title'), true);
  assert.equal(report.stats.textMismatches, 1);
});

test('compareVisualGeometry does not report parent aggregate text when child text matches', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:figure', id: 'figure', pageIndex: 0, tagName: 'figure', textContent: '', ownTextContent: '', hasIdChildren: true, x: 100, y: 80, width: 300, height: 220 },
        { key: '0:caption', id: 'caption', pageIndex: 0, tagName: 'figcaption', textContent: '材料说明', x: 120, y: 260, width: 100, height: 24 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:figure', id: 'figure', pageIndex: 0, tagName: 'figure', textContent: '材料说明', ownTextContent: '', hasIdChildren: true, x: 100, y: 80, width: 300, height: 220 },
        { key: '0:caption', id: 'caption', pageIndex: 0, tagName: 'figcaption', textContent: '材料说明', x: 120, y: 260, width: 100, height: 24 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, true);
  assert.equal(report.stats.textCompared, 1);
  assert.equal(report.stats.textMismatches, 0);
});

test('compareVisualGeometry accepts generated visual fragments only from structural evidence', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, id: 'cover', width: 1000, height: 600 }],
      elements: [
        { key: '0:cover-background', id: 'cover-background', pageIndex: 0, tagName: 'svg', role: 'background', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-vector'], x: 0, y: 0, width: 1000, height: 600 },
        { key: '0:card', id: 'card', pageIndex: 0, tagName: 'svg', role: 'shape', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-vector'], x: 20, y: 20, width: 200, height: 100 },
        { key: '0:card-border-left', id: 'card-border-left', pageIndex: 0, tagName: 'svg', role: 'decoration', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-vector'], x: 20, y: 20, width: 2, height: 100 },
        { key: '0:label', id: 'label', pageIndex: 0, tagName: 'svg', role: 'shape', objectStyle: 'annotation-label', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-object-style', 'data-id-vector'], x: 40, y: 40, width: 120, height: 32 },
        { key: '0:label-text', id: 'label-text', pageIndex: 0, tagName: 'span', role: 'text', dataIdAttrs: ['data-id-role'], x: 48, y: 48, width: 80, height: 20 },
      ],
    },
    candidate: {
      pages: [{ index: 0, id: 'cover', width: 1000, height: 600 }],
      elements: [
        { key: '0:card', id: 'card', pageIndex: 0, tagName: 'svg', role: 'shape', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-vector'], x: 20, y: 20, width: 200, height: 100 },
        { key: '0:label', id: 'label', pageIndex: 0, tagName: 'svg', role: 'shape', objectStyle: 'annotation-label', vector: 'rectangle', dataIdAttrs: ['data-id-role', 'data-id-object-style', 'data-id-vector'], x: 40, y: 40, width: 120, height: 32 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, true);
  assert.equal(report.errors.length, 0);
  assert.equal(report.warnings.length, 3);
  assert.deepEqual(report.warnings.map((issue) => issue.code), [
    'AUTHOR_VISUAL_GENERATED_BACKGROUND_ACCEPTED',
    'AUTHOR_VISUAL_GENERATED_BORDER_ACCEPTED',
    'AUTHOR_VISUAL_GENERATED_TEXT_ACCEPTED',
  ]);
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

test('compareVisualGeometry rejects unregistered generated hints on ordinary missing body text', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:body-generated-kind', id: 'body-generated-kind', pageIndex: 0, tagName: 'p', generatedKind: 'text', x: 120, y: 160, width: 400, height: 96 },
        { key: '0:body-visual-accept', id: 'body-visual-accept', pageIndex: 0, tagName: 'p', visualAccept: 'text', x: 120, y: 280, width: 400, height: 96 },
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
  assert.equal(report.errors.filter((issue) => issue.code === 'AUTHOR_VISUAL_ELEMENT_MISSING').length, 2);
  assert.equal(report.stats.missing, 2);
  assert.equal(report.stats.accepted, 0);
});

test('compareVisualGeometry accepts known text metrics and table height drift as warnings', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', paragraphStyle: 'folio', classList: ['page-number'], dataIdAttrs: ['data-id-paragraph-style'], x: 900, y: 560, width: 17.6, height: 12.8 },
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', paragraphStyle: 'folio', classList: ['page-number'], dataIdAttrs: ['data-id-paragraph-style'], x: 900.1, y: 560.1, width: 11.9, height: 12 },
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when source hint lacks registered attribute evidence', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when source metadata is candidate-only', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', dataIdAttrs: ['data-id-table-style'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when csv/xml source metadata partially differs', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/stale-metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when candidate has extra registered source metadata', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when raw source metadata separators differ', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: String.raw`..\data\metrics.csv`, sourceXml: String.raw`..\data\metrics.xml`, dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: '../data/metrics.csv', sourceXml: '../data/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry rejects table height drift when raw source metadata differs only by whitespace', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: ' assets/metrics.csv ', sourceXml: ' assets/metrics.xml ', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300.1, y: 100.1, width: 500, height: 284 },
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

test('compareVisualGeometry accepts table height drift when registered csv/xml source metadata sets match exactly', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300, y: 100, width: 500, height: 301 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:metrics', id: 'metrics', pageIndex: 0, tagName: 'table', tableStyle: 'area-table', sourceCsv: 'assets/metrics.csv', sourceXml: 'assets/metrics.xml', dataIdAttrs: ['data-id-table-style', 'data-id-source-csv', 'data-id-source-xml'], x: 300.1, y: 100.1, width: 500, height: 284 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.warnings.map((issue) => issue.code), ['AUTHOR_VISUAL_TABLE_HEIGHT_ACCEPTED']);
  assert.equal(report.stats.accepted, 1);
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

test('compareVisualGeometry rejects page-number class-only text metrics drift', () => {
  const report = compareVisualGeometry({
    reference: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', classList: ['page-number'], x: 900, y: 560, width: 17.6, height: 12.8 },
      ],
    },
    candidate: {
      pages: [{ index: 0, width: 1000, height: 600 }],
      elements: [
        { key: '0:folio', id: 'folio', pageIndex: 0, tagName: 'span', classList: ['page-number'], x: 900.1, y: 560.1, width: 11.9, height: 12 },
      ],
    },
    tolerance: 2,
  });

  assert.equal(report.ok, false);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.errors.some((issue) => issue.code === 'AUTHOR_VISUAL_GEOMETRY_MISMATCH' && issue.id === 'folio'), true);
  assert.equal(report.stats.mismatched, 1);
  assert.equal(report.stats.accepted, 0);
});

test('compareVisualGeometry invalid-input 必须 fail', () => {
  assert.throws(() => compareVisualGeometry(null, null));
});

test('loadReverseHtmlEvidence invalid-input 必须 fail', () => {
  assert.throws(() => loadReverseHtmlEvidence({}));
});
