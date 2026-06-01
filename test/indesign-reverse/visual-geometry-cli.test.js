const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  parseArgs,
  resolveInputs,
  enrichCaptureWithReverseModelSourceMetadata,
  canonicalizeCaptureSourceMetadata,
} = require('../../scripts/audit-reverse-visual');
const { compareVisualGeometry } = require('../../src/writers/html/audit/visual-geometry-audit');

test('audit-reverse-visual cli resolves reverse-html directory defaults', () => {
  const root = path.resolve('test/workspace/reverse-html');
  const options = parseArgs(['--reverse-html', root, '--tolerance', '3', '--json']);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.join(root, 'deck.visual.html'));
  assert.equal(inputs.candidateHtml, path.join(root, 'author/deck.html'));
  assert.equal(inputs.reverseHtmlDir, root);
  assert.equal(inputs.tolerance, 3);
  assert.equal(inputs.json, true);
});

test('audit-reverse-visual cli accepts explicit reference and candidate files', () => {
  const options = parseArgs([
    '--reference',
    'visual.html',
    '--candidate',
    'author.html',
    '--out',
    'report.json',
  ]);

  const inputs = resolveInputs(options);

  assert.equal(inputs.referenceHtml, path.resolve('visual.html'));
  assert.equal(inputs.candidateHtml, path.resolve('author.html'));
  assert.equal(inputs.outFile, path.resolve('report.json'));
});

test('audit-reverse-visual enriches reference source metadata from reverse model evidence', () => {
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

test('audit-reverse-visual canonicalizes author package copied source paths before table normalization', () => {
  const reference = {
    pages: [{ index: 0, width: 1000, height: 600 }],
    elements: [{
      key: '0:metrics',
      id: 'metrics',
      pageIndex: 0,
      tagName: 'table',
      tableStyle: 'area-table',
      sourceCsv: '../smoke-assets/data/metrics.csv',
      dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'],
      x: 300,
      y: 100,
      width: 500,
      height: 301,
    }],
  };
  const candidate = {
    pages: [{ index: 0, width: 1000, height: 600 }],
    elements: [{
      key: '0:metrics',
      id: 'metrics',
      pageIndex: 0,
      tagName: 'table',
      tableStyle: 'area-table',
      sourceCsv: 'assets/smoke-assets/data/metrics.csv',
      dataIdAttrs: ['data-id-table-style', 'data-id-source-csv'],
      x: 300.1,
      y: 100.1,
      width: 500,
      height: 284,
    }],
  };
  const authoringReport = {
    assets: {
      entries: [{
        originalPath: '../smoke-assets/data/metrics.csv',
        htmlPath: 'assets/smoke-assets/data/metrics.csv',
      }],
    },
  };

  canonicalizeCaptureSourceMetadata(candidate, authoringReport);
  const report = compareVisualGeometry({ reference, candidate, tolerance: 2 });

  assert.equal(candidate.elements[0].sourceCsv, '../smoke-assets/data/metrics.csv');
  assert.equal(report.ok, true);
  assert.deepEqual(report.warnings.map((issue) => issue.code), ['AUTHOR_VISUAL_TABLE_HEIGHT_ACCEPTED']);
  assert.equal(report.stats.accepted, 1);
});
