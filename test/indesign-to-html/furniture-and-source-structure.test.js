const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
const { ownContent } = require('../../src/writers/html/author-rich-text-renderer');
const { tableSourceHtmlMatchesTable } = require('../../src/adapters/indesign/normalizer/table-source-html');
const { writeReverseAuthorPackage } = require('../../src/writers/html');

const TABLE_SOURCE_HTML = [
  '',
  '    <thead id="area-head">',
  '      <tr id="area-heading-row">',
  '        <th id="area-heading-space" data-id-paragraph-style="table-heading">Space</th>',
  '        <th id="area-heading-area" data-id-paragraph-style="table-heading">Area</th>',
  '      </tr>',
  '    </thead>',
  '    <tbody id="area-body">',
  '      <tr id="area-row-rink">',
  '        <td id="area-rink-space" data-id-paragraph-style="table-body">Ice rink</td>',
  '        <td id="area-rink-area" data-id-paragraph-style="table-body">7,600 sqm</td>',
  '      </tr>',
  '    </tbody>',
  '  ',
].join('\n');

function matchingTableStruct() {
  return {
    rows: [
      {
        cells: [
          { text: 'Space', header: true, rowSpan: 1, colSpan: 1, paragraphStyle: 'table-heading' },
          { text: 'Area', header: true, rowSpan: 1, colSpan: 1, paragraphStyle: 'table-heading' },
        ],
      },
      {
        cells: [
          { text: 'Ice rink', header: false, rowSpan: 1, colSpan: 1, paragraphStyle: 'table-body' },
          { text: '7,600 sqm', header: false, rowSpan: 1, colSpan: 1, paragraphStyle: 'table-body' },
        ],
      },
    ],
  };
}

test('tableSourceHtmlMatchesTable accepts an unedited table and rejects edited content', () => {
  assert.equal(tableSourceHtmlMatchesTable(TABLE_SOURCE_HTML, matchingTableStruct()), true);

  const editedText = matchingTableStruct();
  editedText.rows[1].cells[1].text = '9,999 sqm';
  assert.equal(tableSourceHtmlMatchesTable(TABLE_SOURCE_HTML, editedText), false);

  const editedStyle = matchingTableStruct();
  editedStyle.rows[1].cells[0].paragraphStyle = 'table-heading';
  assert.equal(tableSourceHtmlMatchesTable(TABLE_SOURCE_HTML, editedStyle), false);

  const editedShape = matchingTableStruct();
  editedShape.rows.push({ cells: [{ text: 'extra', header: false }] });
  assert.equal(tableSourceHtmlMatchesTable(TABLE_SOURCE_HTML, editedShape), false);
});

test('ownContent reuses verified table sourceHtml so table sub-node ids survive the roundtrip', () => {
  const item = {
    id: 'area-table',
    role: 'table',
    table: matchingTableStruct(),
    content: { text: '', sourceHtml: TABLE_SOURCE_HTML, runs: [] },
  };
  const html = ownContent(item, 2);
  assert.match(html, /<thead id="area-head">/);
  assert.match(html, /<tr id="area-row-rink">/);
  assert.match(html, /<td id="area-rink-area" data-id-paragraph-style="table-body">7,600 sqm<\/td>/);
});

test('ownContent re-indents reused table sourceHtml so repeated roundtrips stay byte-stable', () => {
  const shallow = {
    id: 'area-table',
    role: 'table',
    table: matchingTableStruct(),
    content: { text: '', sourceHtml: TABLE_SOURCE_HTML, runs: [] },
  };
  const deeperCapture = {
    ...shallow,
    content: {
      text: '',
      sourceHtml: TABLE_SOURCE_HTML.split('\n').map((line) => (line.trim() ? `      ${line}` : line)).join('\n'),
      runs: [],
    },
  };
  const first = ownContent(shallow, 2);
  const second = ownContent(deeperCapture, 2);
  assert.equal(first, second, 'capture depth must not leak into the rendered table indentation');
  assert.match(first, /\n    <thead id="area-head">\n/);
});

test('ownContent falls back to table struct rendering when sourceHtml was not verified', () => {
  const item = {
    id: 'area-table',
    role: 'table',
    table: matchingTableStruct(),
    content: { text: '', runs: [] },
  };
  const html = ownContent(item, 2);
  assert.match(html, /<thead>/);
  assert.match(html, /<td data-id-paragraph-style="table-body">Ice rink<\/td>/);
  assert.doesNotMatch(html, /id="area-head"/);
});

function furnitureModel({ withPageInstance }) {
  const folioMasterItem = {
    id: 'report-folio',
    role: 'text',
    tagName: 'span',
    content: { text: '00', runs: [] },
    bounds: { x: 1515, y: 843, width: 18, height: 13 },
    labelStatus: 'accepted',
    labels: [{
      protocol: 'html-indesign',
      version: 1,
      kind: 'item',
      id: 'report-folio',
      source: 'html-to-indesign',
      role: 'text',
      htmlTag: 'span',
      className: 'page-number',
    }],
  };
  const pageItems = [];
  if (withPageInstance) {
    pageItems.push({
      id: 'agenda-folio',
      role: 'text',
      tagName: 'span',
      sourceFile: 'pages/01-agenda.html',
      sourceNode: {
        tagName: 'span',
        id: 'agenda-folio',
        classList: ['page-number'],
        attributes: {
          id: 'agenda-folio',
          class: 'page-number',
          'data-id-object': '',
          'data-id-role': 'text',
          'data-id-placement': 'parent-page-furniture',
          'data-id-parent-page-item': 'report-parent',
          'data-id-parent-page-source-id': 'report-folio',
          'data-id-paragraph-style': 'folio',
        },
      },
      structure: { parentId: 'agenda-page', order: 2, containerPolicy: 'group' },
      bounds: { x: 1515, y: 843, width: 18, height: 13 },
      content: { text: '03', runs: [] },
      labelStatus: 'accepted',
    });
  }
  return {
    kind: 'DocumentModel',
    id: 'furniture-report',
    title: '家具回环',
    profile: 'architecture-report',
    reverseMode: 'structured',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    sourcePackage: {
      schemaVersion: 1,
      config: 'deck.config.json',
      entry: 'deck.html',
      profile: 'architecture-report',
      styleFiles: [],
      pageFiles: [{ id: 'agenda', file: 'pages/01-agenda.html' }],
      assetRoot: 'assets',
    },
    styles: { paragraphStyles: {}, characterStyles: {}, objectStyles: {} },
    parentPages: [{
      id: 'report-parent',
      name: '汇报母版',
      semantic: 'report-parent',
      items: [folioMasterItem],
    }],
    pages: [{
      id: 'agenda-page',
      semantic: 'agenda',
      sourceFile: 'pages/01-agenda.html',
      parentPageId: 'report-parent',
      parentPageName: '汇报母版',
      sourceNode: {
        tagName: 'section',
        id: 'agenda-page',
        classList: ['page'],
        attributes: { 'data-page': 'agenda', 'data-id-parent-page': 'report-parent' },
      },
      width: 1587.39,
      height: 892.91,
      items: [
        {
          id: 'agenda-title',
          role: 'text',
          tagName: 'h2',
          sourceFile: 'pages/01-agenda.html',
          sourceNode: {
            tagName: 'h2',
            id: 'agenda-title',
            classList: ['page-title'],
            attributes: { id: 'agenda-title', class: 'page-title' },
          },
          structure: { parentId: 'agenda-page', order: 1, containerPolicy: 'group' },
          bounds: { x: 120, y: 140, width: 460, height: 80 },
          content: { text: '汇报结构', runs: [] },
        },
        ...pageItems,
      ],
    }],
  };
}

test('writeReverseAuthorPackage writes labeled parent-page furniture back into pages', () => {
  const outDir = path.resolve('test/workspace/reverse-furniture-writeback-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(furnitureModel({ withPageInstance: false }), { outDir, mode: 'authoring' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.match(pageHtml, /<span[^>]+data-id-parent-page-item="report-parent"[^>]*>00<\/span>/);
  assert.match(pageHtml, /data-id-parent-page-source-id="report-folio"/);
});

test('writeReverseAuthorPackage keeps per-page furniture instances without duplicating the parent item', () => {
  const outDir = path.resolve('test/workspace/reverse-furniture-instance-test');
  fs.rmSync(outDir, { recursive: true, force: true });

  writeReverseAuthorPackage(furnitureModel({ withPageInstance: true }), { outDir, mode: 'authoring' });

  const pageHtml = fs.readFileSync(path.join(outDir, 'pages/01-agenda.html'), 'utf8');
  assert.match(pageHtml, /<span id="agenda-folio"[^>]*>03<\/span>/);
  const furnitureSpans = pageHtml.match(/data-id-parent-page-source-id="report-folio"/g) || [];
  assert.equal(furnitureSpans.length, 1, 'furniture must not be written twice per page');
  assert.doesNotMatch(pageHtml, />00<\/span>/);
});

test('pageItemsToAuthorHtml materializes a self-named source ancestor wrapper for pdf frames', () => {
  const page = {
    id: 'drawing-sheet-page',
    items: [{
      id: 'drawing-pdf-frame',
      role: 'graphic',
      asset: { kind: 'pdf', path: 'assets/plan.pdf' },
      sourceNode: {
        tagName: 'object',
        id: 'drawing-pdf-source',
        classList: ['pdf-source'],
        attributes: {
          id: 'drawing-pdf-source',
          class: 'pdf-source',
          data: 'assets/plan.pdf',
          type: 'application/pdf',
          'data-id-object': '',
          'data-id-pdf-page': '1',
        },
        previewNode: {
          tagName: 'img',
          id: 'drawing-pdf-preview',
          classList: ['pdf-preview'],
          attributes: {
            id: 'drawing-pdf-preview',
            class: 'pdf-preview',
            src: 'assets/plan-page1.png',
            alt: 'plan preview',
            'data-id-ignore': '',
          },
        },
      },
      sourceAncestorNodes: [{
        tagName: 'div',
        id: 'drawing-pdf-frame',
        classList: ['drawing-frame', 'grid-item', 'grid-frame'],
        attributes: {
          id: 'drawing-pdf-frame',
          class: 'drawing-frame grid-item grid-frame',
          style: '--grid-col:5;--grid-span:8',
          'data-id-ignore': '',
        },
        sourcePath: 'div:nth-of-type(1)',
      }],
      structure: { parentId: 'drawing-sheet-page', order: 3 },
    }],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div[^>]+id="drawing-pdf-frame"[^>]*data-id-ignore/);
  assert.match(html, /<img[^>]+id="drawing-pdf-preview"/);
  assert.match(html, /<object[^>]+id="drawing-pdf-source"/);
  assert.match(html, /<div[^>]+id="drawing-pdf-frame"[\s\S]*<object[\s\S]*<\/div>/);
});
