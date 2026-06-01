const test = require('node:test');
const assert = require('node:assert/strict');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');

test('author HTML tree exposes focused rendering helpers', () => {
  const assetRenderer = require('../../src/writers/html/author-asset-renderer');
  const pdfRenderer = require('../../src/writers/html/author-pdf-renderer');
  const vectorRenderer = require('../../src/writers/html/author-vector-renderer');
  const tableRenderer = require('../../src/writers/html/author-table-renderer');
  const richTextRenderer = require('../../src/writers/html/author-rich-text-renderer');

  assert.equal(typeof assetRenderer.renderPlacedAssetFrameNode, 'function');
  assert.equal(typeof pdfRenderer.renderPdfObjectNode, 'function');
  assert.equal(typeof vectorRenderer.renderVectorSvgNode, 'function');
  assert.equal(typeof tableRenderer.tableContent, 'function');
  assert.equal(typeof richTextRenderer.ownContent, 'function');
});

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

test('pageItemsToAuthorHtml restores original source inner html when text is unchanged', () => {
  const page = {
    id: 'cover-page',
    items: [
      {
        id: 'title',
        role: 'text',
        sourceNode: { tagName: 'h1', id: null, classList: ['cover-title'], attributes: { 'data-id-paragraph-style': 'cover-title' } },
        structure: { parentId: 'cover-page', order: 1 },
        content: {
          text: '冰球场首层平面排布汇报',
          sourceHtml: '冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报</span>',
          runs: [],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<h1 class="cover-title pstyle-cover-title" data-id-paragraph-style="cover-title">冰球场首层平面<br><span class="accent" data-id-character-style="cover-accent">排布汇报<\/span><\/h1>/);
});

test('pageItemsToAuthorHtml adds stable item ids when preserving trusted source nodes', () => {
  const page = {
    id: 'cover-page',
    items: [
      {
        id: 'p1-el2',
        role: 'text',
        sourceNode: { tagName: 'h1', id: null, classList: ['cover-title'], attributes: { 'data-id-paragraph-style': 'cover-title' } },
        structure: { parentId: 'cover-page', order: 1 },
        content: { text: '冰球场首层平面排布汇报', runs: [] },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'structured', preserveTrustedSource: true });

  assert.match(html, /<h1 id="p1-el2" class="cover-title" data-id-paragraph-style="cover-title">冰球场首层平面排布汇报<\/h1>/);
});

test('pageItemsToAuthorHtml merges observed text style into sourced text nodes', () => {
  const page = {
    id: 'cover-page',
    items: [
      {
        id: 'cover-title',
        role: 'text',
        semantic: 'page-title',
        sourceNode: {
          tagName: 'h1',
          id: 'cover-title',
          classList: ['cover-title'],
          attributes: { 'data-id-paragraph-style': 'page-title', style: '--grid-col:1;--grid-span:6' },
        },
        styleRefs: { paragraphStyle: 'page-title' },
        labelStatus: 'partial',
        observedLabel: { rejectionReasons: ['unknown-layout'] },
        structure: { parentId: 'cover-page', order: 1 },
        content: { text: '冰球场首层平面排布汇报' },
        textStyle: {
          fontFamily: 'Microsoft YaHei',
          fontWeight: '700',
          pointSize: 32,
          leading: 38,
          fillColor: '#123456',
          tracking: 20,
          justification: 'center',
        },
        textFrameStyle: {
          inset: { top: 4, right: 6, bottom: 4, left: 6 },
          columnCount: 1,
          columnGap: 0,
          verticalJustification: 'flex-start',
        },
        zIndex: 7,
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /class="[^"]*cover-title[^"]*pstyle-page-title/);
  assert.match(html, /style="[^"]*--grid-col:1/);
  assert.match(html, /style="[^"]*font-family:&quot;Microsoft YaHei&quot;, Arial, sans-serif/);
  assert.match(html, /style="[^"]*font-size:32px/);
  assert.match(html, /style="[^"]*line-height:38px/);
  assert.match(html, /style="[^"]*color:#123456/);
  assert.match(html, /style="[^"]*letter-spacing:0\.02em/);
  assert.match(html, /style="[^"]*text-align:center/);
  assert.match(html, /style="[^"]*padding:4px 6px 4px 6px/);
  assert.match(html, /style="[^"]*z-index:7/);
  assert.match(html, /data-id-observed-label-status="partial"/);
  assert.match(html, /data-id-observed-reasons="unknown-layout"/);
});

test('pageItemsToAuthorHtml can preserve trusted source markup without observation style noise', () => {
  const page = {
    id: 'cover-page',
    items: [
      {
        id: 'cover-title',
        role: 'text',
        semantic: 'page-title',
        sourceNode: {
          tagName: 'h1',
          id: 'cover-title',
          classList: ['cover-title'],
          attributes: { 'data-id-paragraph-style': 'page-title', style: '--grid-col:1;--grid-span:6' },
        },
        styleRefs: { paragraphStyle: 'page-title' },
        structure: { parentId: 'cover-page', order: 1 },
        content: { text: '冰球场首层平面排布汇报' },
        textStyle: { pointSize: 32, fillColor: '#123456' },
        visualStyle: { fillColor: '#fbfaf7' },
        zIndex: 7,
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring', preserveTrustedSource: true });

  assert.match(html, /<h1[^>]+id="cover-title"[^>]+class="cover-title"[^>]+style="--grid-col:1;--grid-span:6"[^>]+data-id-paragraph-style="page-title"/);
  assert.doesNotMatch(html, /pstyle-page-title/);
  assert.doesNotMatch(html, /font-size:32px/);
  assert.doesNotMatch(html, /background-color:#fbfaf7/);
  assert.doesNotMatch(html, /z-index:7/);
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

test('pageItemsToAuthorHtml adds style classes without inventing generic object classes', () => {
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

  assert.match(html, /<h3 id="chapter-1-title" class="pstyle-chapter-title" data-id-paragraph-style="chapter-title">01 轴网与场馆骨架<\/h3>/);
  assert.doesNotMatch(html, /chapter-1-title" class="id-object"/);
  assert.doesNotMatch(html, /chapter-1-title"[^>]+--grid-col/);
});

test('pageItemsToAuthorHtml restores missing nonvisual source ancestor wrappers', () => {
  const page = {
    id: 'analysis-page',
    items: [
      {
        id: 'legend-swatch',
        role: 'shape',
        sourceNode: { tagName: 'span', id: null, classList: ['swatch'], attributes: { style: 'background:var(--accent)' } },
        sourceAncestorNodes: [
          { sourcePath: 'section>div:nth-of-type(1)', tagName: 'div', id: null, classList: ['legend-item'], attributes: {} },
        ],
        structure: { parentId: 'analysis-page', order: 1 },
      },
      {
        id: 'legend-label',
        role: 'text',
        sourceNode: { tagName: 'span', id: null, classList: [], attributes: {} },
        sourceAncestorNodes: [
          { sourcePath: 'section>div:nth-of-type(1)', tagName: 'div', id: null, classList: ['legend-item'], attributes: {} },
        ],
        structure: { parentId: 'analysis-page', order: 2 },
        content: { text: 'Service rooms' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div class="legend-item">\n\s+<span class="swatch" style="background:var\(--accent\)"><\/span>\n\s+<span>Service rooms<\/span>\n<\/div>/);
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

  assert.match(html, /<span id="folio" class="page-number pstyle-folio" data-id-paragraph-style="folio">01<\/span>/);
  assert.doesNotMatch(html, /data-id-character-style="自动字符-/);
});

test('pageItemsToAuthorHtml preserves sourced inline style for absolute annotation objects', () => {
  const page = {
    id: 'agenda-page',
    items: [
      {
        id: 'timeline',
        role: 'shape',
        semantic: 'timeline-line',
        sourceNode: {
          tagName: 'div',
          id: 'timeline',
          classList: ['line'],
          attributes: {
            style: 'left:158mm;top:184mm;width:225mm;transform:rotate(0deg)',
            'data-id-object': '',
            'data-id-role': 'annotation',
          },
        },
        structure: { parentId: 'agenda-page', order: 1 },
      },
      {
        id: 'legend-swatch',
        role: 'shape',
        semantic: 'unknown',
        sourceNode: {
          tagName: 'span',
          id: 'legend-swatch',
          classList: ['swatch'],
          attributes: { style: 'background:var(--accent)' },
        },
        structure: { parentId: 'agenda-page', order: 2 },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<div id="timeline" class="line" style="left:158mm;top:184mm;width:225mm;transform:rotate\(0deg\)"/);
  assert.match(html, /<span id="legend-swatch" class="swatch" style="background:var\(--accent\)"/);
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
            'data-id-pdf-page': '1',
            'data-id-crop': 'media',
            'data-id-fit': 'contain',
          },
          previewNode: {
            tagName: 'img',
            classList: ['pdf-preview'],
            attributes: {
              src: '../reference-pdfs/ice-rink-layout-reference-page1.png',
              alt: 'ice rink layout preview',
              'data-id-ignore': '',
            },
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
  assert.match(html, /<img[^>]+class="pdf-preview"[^>]+src="\.\.\/reference-pdfs\/ice-rink-layout-reference-page1\.png"[^>]+alt="ice rink layout preview"[^>]+data-id-ignore/);
  assert.match(html, /<object[^>]+class="pdf-source"[^>]+data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"[^>]*><\/object>/);
  assert.doesNotMatch(html, /<div[^>]+data="\.\.\/reference-pdfs/);
});

test('pageItemsToAuthorHtml renders observed placed assets as real resource elements', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'nas-image',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 1 },
        asset: { path: '\\\\daga-nas5\\share\\效果图 A.jpg', graphicType: 'image' },
      },
      {
        id: 'nas-pdf',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 2 },
        asset: { path: '\\\\daga-nas5\\share\\图纸 A.pdf', graphicType: 'pdf' },
      },
    ],
  };
  const assetPathMap = new Map([
    ['//daga-nas5/share/效果图 a.jpg', '/nas/daga-nas5/share/%E6%95%88%E6%9E%9C%E5%9B%BE%20A.jpg'],
    ['//daga-nas5/share/图纸 a.pdf', '/nas/daga-nas5/share/%E5%9B%BE%E7%BA%B8%20A.pdf'],
  ]);

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', assetPathMap });

  assert.match(html, /<img id="nas-image"[^>]+src="\/nas\/daga-nas5\/share\/%E6%95%88%E6%9E%9C%E5%9B%BE%20A\.jpg"/);
  assert.match(html, /data-id-asset-path="\\\\daga-nas5\\share\\效果图 A\.jpg"/);
  assert.match(html, /<object[^>]+data="\/nas\/daga-nas5\/share\/%E5%9B%BE%E7%BA%B8%20A\.pdf"[^>]+type="application\/pdf"/);
  assert.match(html, /data-id-asset-path="\\\\daga-nas5\\share\\图纸 A\.pdf"/);
});

test('pageItemsToAuthorHtml preserves placed image frame and content geometry for manual crops', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'cropped-image',
        role: 'graphic',
        semantic: 'unknown',
        bounds: { x: 100, y: 80, width: 240, height: 160 },
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\效果图 A.jpg',
          graphicType: 'image',
          cropped: true,
          placement: {
            fit: 'manual',
            frameBounds: { x: 100, y: 80, width: 240, height: 160 },
            contentBounds: { x: 70, y: 60, width: 320, height: 210 },
            contentOffset: { x: -30, y: -20 },
            contentSize: { width: 320, height: 210 },
            contentScale: { x: 1.3333, y: 1.3125 },
          },
        },
      },
    ],
  };
  const assetPathMap = new Map([
    ['//daga-nas5/share/效果图 a.jpg', '/nas/daga-nas5/share/%E6%95%88%E6%9E%9C%E5%9B%BE%20A.jpg'],
  ]);

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', assetPathMap });

  assert.match(html, /<figure id="cropped-image"[^>]+data-id-object/);
  assert.match(html, /data-id-asset-path="\\\\daga-nas5\\share\\效果图 A\.jpg"/);
  assert.match(html, /data-id-fit="manual"/);
  assert.match(html, /data-id-content-x="-30px"/);
  assert.match(html, /data-id-content-y="-20px"/);
  assert.match(html, /data-id-content-width="320px"/);
  assert.match(html, /data-id-content-height="210px"/);
  assert.match(html, /data-id-content-scale-x="1\.3333"/);
  assert.match(html, /data-id-content-scale-y="1\.3125"/);
  assert.match(html, /<img[^>]+class="placed-asset-content"[^>]+src="\/nas\/daga-nas5\/share\/%E6%95%88%E6%9E%9C%E5%9B%BE%20A\.jpg"/);
  assert.match(html, /<img[^>]+data-id-ignore/);
  assert.match(html, /style="[^"]*position:absolute[^"]*left:-30px[^"]*top:-20px[^"]*width:320px[^"]*height:210px/);
});

test('pageItemsToAuthorHtml keeps generated placed asset frames addressable in structured mode', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'cropped-image',
        role: 'graphic',
        semantic: 'unknown',
        bounds: { x: 100, y: 80, width: 240, height: 160 },
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\效果图 A.jpg',
          graphicType: 'image',
          cropped: true,
          placement: {
            fit: 'manual',
            frameBounds: { x: 100, y: 80, width: 240, height: 160 },
            contentBounds: { x: 70, y: 60, width: 320, height: 210 },
            contentOffset: { x: -30, y: -20 },
            contentSize: { width: 320, height: 210 },
            contentScale: { x: 1.3333, y: 1.3125 },
          },
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'structured' });

  assert.match(html, /<figure id="cropped-image"[^>]+class="[^"]*id-object/);
  assert.match(html, /<figure id="cropped-image"[^>]+data-id-object/);
});

test('pageItemsToAuthorHtml keeps generated placed-asset previews from being stretched by source content geometry', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'cropped-pdf',
        role: 'graphic',
        semantic: 'unknown',
        bounds: { x: 100, y: 80, width: 240, height: 160 },
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\图纸 A.pdf',
          graphicType: 'PDF',
          preview: {
            path: 'D:\\reverse\\previews\\cropped-pdf.png',
            relativePath: 'previews/cropped-pdf.png',
            source: 'indesign-frame-export',
            format: 'png',
          },
          placement: {
            fit: 'manual',
            frameBounds: { x: 100, y: 80, width: 240, height: 160 },
            contentBounds: { x: 70, y: 60, width: 420, height: 210 },
            contentOffset: { x: -30, y: -20 },
            contentSize: { width: 420, height: 210 },
            contentScale: { x: 1.75, y: 1.3125 },
          },
        },
      },
    ],
  };
  const assetPathMap = new Map([
    ['d:/reverse/previews/cropped-pdf.png', 'previews/cropped-pdf.png'],
  ]);

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', assetPathMap });

  assert.match(html, /<figure id="cropped-pdf"[^>]+data-id-content-width="420px"/);
  assert.match(html, /<figure id="cropped-pdf"[^>]+data-id-content-height="210px"/);
  assert.match(html, /<img[^>]+class="placed-asset-preview"[^>]+src="previews\/cropped-pdf\.png"/);
  assert.match(html, /style="[^"]*position:absolute[^"]*left:0px[^"]*top:0px[^"]*width:100%[^"]*height:100%/);
  assert.doesNotMatch(html, /class="placed-asset-preview"[^>]+width:420px/);
});

test('pageItemsToAuthorHtml renders observed PDF AI and PSD through clean generated preview images', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'layered-pdf',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\图纸 A.pdf',
          graphicType: 'PDF',
          preview: { path: 'D:\\reverse\\previews\\layered-pdf.png', relativePath: 'previews/layered-pdf.png' },
          placement: {
            pageNumber: 3,
            crop: 'CROP_CONTENT_VISIBLE_LAYERS',
            visibleLayers: ['结构', '标注'],
            hiddenLayers: ['家具'],
          },
        },
      },
      {
        id: 'layered-ai',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 2 },
        asset: {
          path: '\\\\daga-nas5\\share\\总图.ai',
          graphicType: 'PDF',
          imageTypeName: 'Adobe PDF',
          preview: { path: 'D:\\reverse\\previews\\layered-ai.png', relativePath: 'previews/layered-ai.png' },
          placement: { pageNumber: 2, visibleLayers: ['道路'] },
        },
      },
      {
        id: 'layered-psd',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 3 },
        asset: {
          path: '\\\\daga-nas5\\share\\效果图.psd',
          graphicType: 'Image',
          imageTypeName: 'Photoshop',
          preview: { path: 'D:\\reverse\\previews\\layered-psd.png', relativePath: 'previews/layered-psd.png' },
          placement: { visibleLayers: ['人物'] },
        },
      },
    ],
  };
  const assetPathMap = new Map([
    ['d:/reverse/previews/layered-pdf.png', 'previews/layered-pdf.png'],
    ['d:/reverse/previews/layered-ai.png', 'previews/layered-ai.png'],
    ['d:/reverse/previews/layered-psd.png', 'previews/layered-psd.png'],
  ]);

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', assetPathMap });

  assert.match(html, /<img id="layered-pdf"[^>]+src="previews\/layered-pdf\.png"/);
  assert.match(html, /data-id-asset-path="\\\\daga-nas5\\share\\图纸 A\.pdf"/);
  assert.match(html, /data-id-asset-kind="pdf"/);
  assert.match(html, /data-id-pdf-page="3"/);
  assert.match(html, /data-id-crop="content"/);
  assert.match(html, /data-id-visible-layers="结构\|标注"/);
  assert.match(html, /data-id-hidden-layers="家具"/);
  assert.match(html, /<img id="layered-ai"[^>]+src="previews\/layered-ai\.png"/);
  assert.match(html, /data-id-asset-kind="ai"/);
  assert.match(html, /data-id-artboard="2"/);
  assert.match(html, /<img id="layered-psd"[^>]+src="previews\/layered-psd\.png"/);
  assert.match(html, /data-id-asset-kind="psd"/);
  assert.doesNotMatch(html, /<object/);
});

test('pageItemsToAuthorHtml renders observed InDesign vector paths as editable svg', () => {
  const html = pageItemsToAuthorHtml({
    id: 'page-1',
    items: [
      {
        id: 'vector-1',
        role: 'shape',
        semantic: 'unknown',
        bounds: { x: 100, y: 120, width: 200, height: 80 },
        visualStyle: {
          fillColor: '#8ca064',
          fillOpacity: 45,
          strokeColor: '#c8102e',
          strokeWeight: 2,
          strokeOpacity: 70,
          strokeStyle: 'Dashed',
          opacity: 90,
        },
        vectorGeometry: {
          kind: 'polygon',
          paths: [
            {
              closed: true,
              points: [
                { anchor: { x: 100, y: 120 }, leftDirection: { x: 100, y: 120 }, rightDirection: { x: 100, y: 120 } },
                { anchor: { x: 300, y: 120 }, leftDirection: { x: 300, y: 120 }, rightDirection: { x: 300, y: 120 } },
                { anchor: { x: 300, y: 200 }, leftDirection: { x: 300, y: 200 }, rightDirection: { x: 300, y: 200 } },
              ],
            },
          ],
        },
        labels: [],
      },
    ],
  }, { mode: 'observation' });

  assert.match(html, /<svg[^>]+id="vector-1"[^>]+data-id-vector="polygon"/);
  assert.match(html, /viewBox="0 0 200 80"/);
  assert.match(html, /<path[^>]+d="M0 0 L200 0 L200 80 Z"/);
  assert.match(html, /fill="#8ca064"/);
  assert.match(html, /fill-opacity="0.45"/);
  assert.match(html, /stroke="#c8102e"/);
  assert.match(html, /stroke-width="2"/);
  assert.match(html, /stroke-opacity="0.7"/);
  assert.match(html, /stroke-dasharray=/);
  assert.doesNotMatch(html, /background-color:#8ca064/);
});

test('pageItemsToAuthorHtml maps InDesign multiply blend mode to SVG mix-blend-mode', () => {
  const html = pageItemsToAuthorHtml({
    id: 'page-1',
    items: [
      {
        id: 'program-fill',
        role: 'shape',
        semantic: 'unknown',
        bounds: { x: 100, y: 120, width: 200, height: 80 },
        visualStyle: {
          fillColor: '#ff9339',
          opacity: 100,
          blendMode: 'multiply',
        },
        vectorGeometry: {
          kind: 'polygon',
          paths: [
            {
              closed: true,
              points: [
                { anchor: { x: 100, y: 120 }, leftDirection: { x: 100, y: 120 }, rightDirection: { x: 100, y: 120 } },
                { anchor: { x: 300, y: 120 }, leftDirection: { x: 300, y: 120 }, rightDirection: { x: 300, y: 120 } },
                { anchor: { x: 300, y: 200 }, leftDirection: { x: 300, y: 200 }, rightDirection: { x: 300, y: 200 } },
              ],
            },
          ],
        },
        labels: [],
      },
    ],
  }, { mode: 'observation' });

  assert.match(html, /<svg[^>]+id="program-fill"[^>]+style="[^"]*mix-blend-mode:multiply/);
  assert.match(html, /<path[^>]+fill="#ff9339"/);
  assert.doesNotMatch(html, /opacity:0\./);
});

test('pageItemsToAuthorHtml gives zero-height vector lines a non-zero viewBox', () => {
  const html = pageItemsToAuthorHtml({
    id: 'page-1',
    items: [
      {
        id: 'axis-line',
        role: 'line',
        semantic: 'unknown',
        bounds: { x: 10, y: 20, width: 180, height: 0 },
        visualStyle: {
          fillColor: null,
          strokeColor: '#c8102e',
          strokeWeight: 2,
        },
        vectorGeometry: {
          kind: 'line',
          paths: [
            {
              closed: false,
              points: [
                { anchor: { x: 10, y: 20 }, leftDirection: { x: 10, y: 20 }, rightDirection: { x: 10, y: 20 } },
                { anchor: { x: 190, y: 20 }, leftDirection: { x: 190, y: 20 }, rightDirection: { x: 190, y: 20 } },
              ],
            },
          ],
        },
        labels: [],
      },
    ],
  }, { mode: 'observation' });

  assert.match(html, /viewBox="0 0 180 2"/);
  assert.match(html, /<path[^>]+d="M0 1 L180 1"/);
});

test('pageItemsToAuthorHtml omits degenerate invisible vector leftovers', () => {
  const html = pageItemsToAuthorHtml({
    id: 'page-1',
    items: [
      {
        id: 'empty-vector',
        role: 'shape',
        bounds: { x: 10, y: 20, width: 0, height: 0 },
        visualStyle: { fillColor: null, strokeColor: null, strokeWeight: null },
        vectorGeometry: {
          kind: 'path',
          paths: [
            { closed: false, points: [{ anchor: { x: 10, y: 20 } }] },
          ],
        },
        labels: [],
      },
    ],
  }, { mode: 'observation' });

  assert.equal(html, '');
});

test('pageItemsToAuthorHtml reuses existing source PDF wrapper instead of nesting a new one', () => {
  const page = {
    id: 'drawing-page',
    items: [
      {
        id: 'pdf-source',
        role: 'graphic',
        semantic: 'drawing-pdf',
        sourceNode: {
          tagName: 'object',
          id: null,
          classList: ['pdf-source'],
          attributes: {
            data: '../reference-pdfs/ice-rink-layout-reference.pdf',
            type: 'application/pdf',
            'data-id-object': '',
            'data-id-pdf-page': '1',
          },
          previewNode: {
            tagName: 'img',
            classList: ['pdf-preview'],
            attributes: {
              src: '../reference-pdfs/ice-rink-layout-reference-page1.png',
              alt: 'ice rink layout preview',
              'data-id-ignore': '',
            },
          },
        },
        sourceAncestorNodes: [
          {
            tagName: 'div',
            id: null,
            classList: ['drawing-frame', 'grid-item', 'grid-frame'],
            attributes: { style: '--grid-col:5;--grid-span:8', 'data-id-ignore': '' },
            sourcePath: 'section>div:nth-of-type(1)',
          },
        ],
        structure: { parentId: 'drawing-page', order: 1 },
        asset: { path: '../reference-pdfs/ice-rink-layout-reference.pdf', graphicType: 'pdf' },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.equal((html.match(/class="drawing-frame grid-item grid-frame"/g) || []).length, 1);
  assert.match(html, /<div class="drawing-frame grid-item grid-frame" style="--grid-col:5;--grid-span:8" data-id-ignore>\n\s+<img class="pdf-preview"/);
  assert.match(html, /<object class="pdf-source" data="\.\.\/reference-pdfs\/ice-rink-layout-reference\.pdf"/);
});

test('pageItemsToAuthorHtml writes PDF page numbers only through data-id-pdf-page', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'layered-pdf',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\图纸 A.pdf',
          graphicType: 'PDF',
          preview: { path: 'D:\\reverse\\previews\\layered-pdf.png', relativePath: 'previews/layered-pdf.png' },
          placement: { pageNumber: 3 },
        },
      },
    ],
  };
  const assetPathMap = new Map([
    ['d:/reverse/previews/layered-pdf.png', 'previews/layered-pdf.png'],
  ]);

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', assetPathMap });

  assert.match(html, /data-id-pdf-page="3"/);
  assert.doesNotMatch(html, /data-id-page=/);
});

test('pageItemsToAuthorHtml does not invent first-page PDF previews without explicit page facts', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'untagged-pdf',
        role: 'graphic',
        semantic: 'unknown',
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '\\\\daga-nas5\\share\\多页图纸.pdf',
          graphicType: 'PDF',
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });

  assert.match(html, /<object[^>]+id="untagged-pdf"/);
  assert.doesNotMatch(html, /多页图纸-page1\.png/);
  assert.doesNotMatch(html, /class="pdf-preview"/);
  assert.doesNotMatch(html, /data-id-pdf-page=/);
});

test('pageItemsToAuthorHtml ignores invalid PDF page facts when deriving previews', () => {
  const page = {
    id: 'observed-page',
    items: [
      {
        id: 'invalid-page-pdf',
        role: 'graphic',
        semantic: 'unknown',
        sourceNode: {
          tagName: 'object',
          id: 'invalid-page-pdf',
          classList: ['pdf-source'],
          attributes: {
            data: '../reference-pdfs/multi-page.pdf',
            type: 'application/pdf',
            'data-id-pdf-page': 'abc',
          },
        },
        structure: { parentId: 'observed-page', order: 1 },
        asset: {
          path: '../reference-pdfs/multi-page.pdf',
          graphicType: 'PDF',
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });

  assert.doesNotMatch(html, /multi-page-pageabc\.png/);
  assert.doesNotMatch(html, /class="pdf-preview"/);
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
            { header: true, cells: [{ header: true, text: '指标', paragraphStyle: '表头文字' }, { header: true, text: '数值', paragraphStyle: '表头文字' }] },
            { header: false, cells: [{ text: '结构跨度', paragraphStyle: '表格正文' }, { text: '243.75m', paragraphStyle: '表格正文' }] },
          ],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<table[^>]+id="metrics-table"[\s\S]*\n\s+<thead>\n\s+<tr>/);
  assert.match(html, /<th data-id-paragraph-style="表头文字">指标<\/th>/);
  assert.match(html, /<tbody>\n\s+<tr>/);
  assert.match(html, /<td data-id-paragraph-style="表格正文">243\.75m<\/td>/);
});

test('pageItemsToAuthorHtml preserves merged table cells and inline cell markup', () => {
  const page = {
    id: 'table-page',
    items: [
      {
        id: 'metrics-table',
        role: 'table',
        sourceNode: { tagName: 'table', id: 'metrics-table', classList: ['metrics-table'], attributes: {} },
        structure: { parentId: 'table-page', order: 1 },
        table: {
          rows: [
            {
              cells: [
                {
                  text: 'Merged Cells',
                  paragraphStyle: 'body',
                  rowSpan: 2,
                  colSpan: 3,
                  runs: [
                    { text: 'Merged', characterStyle: 'cell-emphasis' },
                    { text: 'Cells', tagName: 'strong', classList: ['value'], attributes: { 'data-id-character-style': 'value' } },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const html = pageItemsToAuthorHtml(page, { mode: 'authoring' });

  assert.match(html, /<td[^>]*rowspan="2"[^>]*>/);
  assert.match(html, /<td[^>]*colspan="3"[^>]*>/);
  assert.match(html, /<td[^>]*data-id-paragraph-style="body"[^>]*>/);
  assert.match(html, /<span data-id-character-style="cell-emphasis">Merged<\/span> <strong class="value" data-id-character-style="value">Cells<\/strong>/);
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
