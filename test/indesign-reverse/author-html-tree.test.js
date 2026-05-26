const test = require('node:test');
const assert = require('node:assert/strict');
const { pageItemsToAuthorHtml } = require('../../src/indesign-reverse/author-html-tree');

test('pageItemsToAuthorHtml nests children under source parent items', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'card-1',
        role: 'shape',
        sourceNode: { tagName: 'div', id: 'card-1', classList: ['metric-card', 'grid-item'], attributes: { 'data-id-object': '' } },
        structure: { parentId: 'agenda-page', order: 1 },
        layout: { cssVars: { '--grid-col': '1', '--grid-span': '3', '--grid-row': '6', '--grid-row-span': '1' } },
      },
      {
        id: 'card-1-value',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'card-1-value', classList: ['metric-value'], attributes: { 'data-id-paragraph-style': 'metric-value' } },
        structure: { parentId: 'card-1', order: 1 },
        content: { text: '243.75m' },
      },
      {
        id: 'card-1-label',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'card-1-label', classList: ['metric-label'], attributes: { 'data-id-paragraph-style': 'metric-label' } },
        structure: { parentId: 'card-1', order: 2 },
        content: { text: 'grid length' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div[^>]+id="card-1"[^>]*>/);
  assert.match(html, /<div[^>]+id="card-1"[\s\S]*<p[^>]+id="card-1-value"[\s\S]*243\.75m[\s\S]*<\/p>[\s\S]*<p[^>]+id="card-1-label"[\s\S]*grid length[\s\S]*<\/p>[\s\S]*<\/div>/);
});

test('pageItemsToAuthorHtml omits generated paint fragments from editable author source', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'chapter-1',
        role: 'shape',
        semantic: 'chapter-card',
        sourceNode: { tagName: 'div', id: 'chapter-1', classList: ['chapter', 'grid-item'], attributes: { 'data-id-object': '' } },
        structure: { parentId: 'agenda-page', order: 1 },
        layout: { cssVars: { '--grid-col': '5', '--grid-span': '3' } },
      },
      {
        id: 'chapter-1-background',
        role: 'shape',
        semantic: 'unknown',
        sourceNode: { tagName: 'div', id: 'chapter-1-background', classList: ['id-object'], attributes: {} },
        structure: { parentId: 'agenda-page', order: 2 },
        labels: [{ namespace: 'html_indesign', generated: true }],
      },
      {
        id: 'chapter-1-border-left',
        role: 'shape',
        semantic: 'unknown',
        sourceNode: { tagName: 'div', id: 'chapter-1-border-left', classList: ['id-object'], attributes: {} },
        structure: { parentId: 'agenda-page', order: 3 },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /id="chapter-1"/);
  assert.doesNotMatch(html, /chapter-1-background/);
  assert.doesNotMatch(html, /chapter-1-border-left/);
});

test('pageItemsToAuthorHtml restores inline character runs as editable inline tags', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'agenda-copy',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'agenda-copy', classList: ['body-copy', 'grid-item'], attributes: { 'data-id-paragraph-style': 'body-copy' } },
        structure: { parentId: 'agenda-page', order: 1 },
        content: {
          text: '本页用 PDF 置入 校核。',
          runs: [
            {
              text: 'PDF 置入',
              tagName: 'span',
              classList: ['accent'],
              attributes: { 'data-id-character-style': 'term-accent' },
            },
          ],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /本页用 <span class="accent" data-id-character-style="term-accent">PDF 置入<\/span> 校核。/);
});

test('pageItemsToAuthorHtml restores InDesign character styles as inline character tags', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'agenda-copy',
        role: 'text',
        sourceNode: { tagName: 'p', id: 'agenda-copy', classList: ['body-copy'], attributes: { 'data-id-paragraph-style': 'body-copy' } },
        structure: { parentId: 'agenda-page', order: 1 },
        content: {
          text: '流线和 PDF 置入 校核。',
          runs: [
            { text: '流线和 ', characterStyle: null },
            { text: 'PDF 置入', characterStyle: '术语强调' },
            { text: ' 校核。', characterStyle: null },
          ],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /流线和 <span data-id-character-style="术语强调">PDF 置入<\/span> 校核。/);
});

test('pageItemsToAuthorHtml keeps classless sourced child text classless in author mode', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'chapter-1',
        role: 'shape',
        sourceNode: { tagName: 'div', id: 'chapter-1', classList: ['chapter'], attributes: { 'data-id-object': '' } },
        structure: { parentId: 'agenda-page', order: 1 },
      },
      {
        id: 'chapter-1-title',
        role: 'text',
        sourceNode: { tagName: 'h3', id: 'chapter-1-title', classList: [], attributes: { 'data-id-paragraph-style': 'chapter-title' } },
        structure: { parentId: 'chapter-1', order: 1 },
        layout: { cssVars: { '--grid-col': '5', '--grid-span': '3' } },
        content: { text: '01 轴网与场馆骨架' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<h3 id="chapter-1-title" data-id-paragraph-style="chapter-title">01 轴网与场馆骨架<\/h3>/);
  assert.doesNotMatch(html, /chapter-1-title" class="id-object"/);
  assert.doesNotMatch(html, /chapter-1-title"[^>]+--grid-col/);
});

test('pageItemsToAuthorHtml does not emit non-semantic automatic character spans', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'folio',
        role: 'text',
        sourceNode: { tagName: 'span', id: 'folio', classList: ['page-number'], attributes: { 'data-id-paragraph-style': 'folio' } },
        structure: { parentId: 'agenda-page', order: 1 },
        content: {
          text: '01',
          runs: [{ text: '01', characterStyle: '自动字符-88166000' }],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<span id="folio" class="page-number" data-id-paragraph-style="folio">01<\/span>/);
  assert.doesNotMatch(html, /data-id-character-style="自动字符-/);
});

test('pageItemsToAuthorHtml restores PDF source inside an editable preview wrapper', () => {
  const page = {
    id: 'drawing-page',
    items: [
      {
        id: 'pdf-source',
        role: 'graphic',
        semantic: 'drawing-pdf',
        sourceNode: {
          tagName: 'object',
          id: 'pdf-source',
          classList: ['pdf-source', 'drawing-frame', 'grid-item', 'grid-frame'],
          attributes: {
            data: '../reference-pdfs/ice-rink-layout-reference.pdf',
            type: 'application/pdf',
            'data-id-object': '',
            'data-id-page': '1',
            'data-id-crop': 'media',
            'data-id-fit': 'contain',
          },
        },
        structure: { parentId: 'drawing-page', order: 1 },
        layout: { cssVars: { '--grid-col': '5', '--grid-span': '8', '--grid-row': '2', '--grid-row-span': '5' } },
        asset: { path: '../reference-pdfs/ice-rink-layout-reference.pdf', graphicType: 'pdf' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div[^>]+class="drawing-frame grid-item grid-frame"[^>]+data-id-ignore/);
  assert.match(html, /<img[^>]+class="pdf-preview"[^>]+src="\.\.\/reference-pdfs\/ice-rink-layout-reference-page1\.png"[^>]+data-id-ignore/);
  assert.match(html, /<object[^>]+class="pdf-source"[^>]+data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"[^>]*><\/object>/);
  assert.doesNotMatch(html, /<div[^>]+data="\.\.\/reference-pdfs/);
});

test('pageItemsToAuthorHtml formats tables with editable thead and tbody', () => {
  const page = {
    id: 'table-page',
    items: [
      {
        id: 'metrics-table',
        role: 'table',
        sourceNode: { tagName: 'table', id: 'metrics-table', classList: ['metrics-table', 'grid-item'], attributes: { 'data-id-table': 'metrics' } },
        structure: { parentId: 'table-page', order: 1 },
        table: {
          rows: [
            { header: true, cells: [{ header: true, text: '指标' }, { header: true, text: '数值' }] },
            { header: false, cells: [{ text: '结构跨度' }, { text: '243.75m' }] },
          ],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<table[^>]+id="metrics-table"[\s\S]*\n\s+<thead>\n\s+<tr>/);
  assert.match(html, /<th>指标<\/th>/);
  assert.match(html, /<tbody>\n\s+<tr>/);
  assert.match(html, /<td>243\.75m<\/td>/);
});

test('pageItemsToAuthorHtml folds generated text companions back into sourced annotation objects', () => {
  const page = {
    id: 'drawing-page',
    items: [
      {
        id: 'annotation-1',
        role: 'shape',
        semantic: 'annotation-label',
        sourceNode: { tagName: 'div', id: 'annotation-1', classList: ['annotation'], attributes: { 'data-id-object': '', 'data-id-role': 'annotation' } },
        structure: { parentId: 'drawing-page', order: 1 },
        content: { text: '' },
      },
      {
        id: 'annotation-1-text',
        role: 'text',
        semantic: 'unknown',
        sourceNode: null,
        labels: [{ protocol: 'html-indesign', kind: 'item', generated: false }],
        structure: null,
        content: { text: 'Media crop', runs: [] },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div id="annotation-1" class="annotation"[^>]*>Media crop<\/div>/);
  assert.doesNotMatch(html, /annotation-1-text/);
});
