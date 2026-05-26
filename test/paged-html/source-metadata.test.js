const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
} = require('../../src/paged-html/source-metadata');

test('sourcePackageFromDocument reads generated deck metadata', () => {
  const sourcePackage = sourcePackageFromDocument({
    attributes: {
      'data-id-source-package-config': 'deck.config.json',
      'data-id-source-package-schema': '1',
    },
    styleFiles: ['styles/tokens.css', 'styles/layout.css'],
    pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    assetRoot: 'assets',
  });

  assert.deepEqual(sourcePackage, {
    schemaVersion: 1,
    config: 'deck.config.json',
    entry: 'deck.html',
    styleFiles: ['styles/tokens.css', 'styles/layout.css'],
    pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    assetRoot: 'assets',
  });
});

test('sourceNodeForSnapshotItem keeps stable authoring attributes only', () => {
  const node = sourceNodeForSnapshotItem({
    tagName: 'div',
    id: 'agenda-card',
    classList: ['chapter-card', 'grid-item'],
    attributes: {
      id: 'agenda-card',
      class: 'chapter-card grid-item',
      style: '--grid-col:5',
      'data-id-object': '',
      'data-id-object-style': 'chapter-card',
      'data-id-ignore': 'true',
      'aria-label': 'agenda card',
    },
  });

  assert.deepEqual(node, {
    tagName: 'div',
    id: 'agenda-card',
    classList: ['chapter-card', 'grid-item'],
    attributes: {
      'data-id-object': '',
      'data-id-object-style': 'chapter-card',
      'aria-label': 'agenda card',
    },
  });
});

test('gridLayoutFromCssVars converts grid custom properties to numbers', () => {
  assert.deepEqual(gridLayoutFromCssVars({
    '--grid-col': '5',
    '--grid-span': '3',
    '--grid-row': '2',
    '--grid-row-span': '2',
  }), {
    grid: { col: 5, span: 3, row: 2, rowSpan: 2 },
    cssVars: {
      '--grid-col': '5',
      '--grid-span': '3',
      '--grid-row': '2',
      '--grid-row-span': '2',
    },
  });
});

test('sourceNodeForSnapshotItem preserves stable resource and data attributes', () => {
  const node = sourceNodeForSnapshotItem({
    tagName: 'object',
    id: 'pdf-source',
    classList: ['pdf-source'],
    attributes: {
      id: 'pdf-source',
      class: 'pdf-source',
      data: '../reference-pdfs/ice-rink-layout-reference.pdf',
      type: 'application/pdf',
      'data-asset-kind': 'pdf',
      'data-id-pdf-page': '1',
      loading: 'lazy',
      decoding: 'async',
      style: 'position:absolute',
    },
  });

  assert.deepEqual(node.attributes, {
    data: '../reference-pdfs/ice-rink-layout-reference.pdf',
    type: 'application/pdf',
    'data-asset-kind': 'pdf',
    'data-id-pdf-page': '1',
    loading: 'lazy',
    decoding: 'async',
  });
});
