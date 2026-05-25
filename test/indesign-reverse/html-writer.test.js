const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { readReverseSnapshot, reverseSnapshotToSemanticModel, semanticModelToHtml } = require('../../src/indesign-reverse');

test('semanticModelToHtml writes page, parent page, layout and text item tags', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  const html = semanticModelToHtml(model);

  assert.match(html, /<main class="deck"/);
  assert.match(html, /data-id-document="architecture-report"/);
  assert.match(html, /data-page="agenda-page"/);
  assert.match(html, /data-id-parent-page="report-parent"/);
  assert.match(html, /data-id-parent-page-name="汇报母版"/);
  assert.match(html, /data-id-layout="contents-grid"/);
  assert.match(html, /<h2[^>]+agenda-title/);
  assert.match(html, /汇报结构/);
});

test('semanticModelToHtml rejects pages without explicit geometry', () => {
  const snapshot = readReverseSnapshot(path.resolve(__dirname, '../fixtures/indesign-reverse/tagged-snapshot.json'));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'structured' });
  delete model.pages[0].width;

  assert.throws(
    () => semanticModelToHtml(model),
    /Page agenda-page is missing width/
  );
});

test('semanticModelToHtml renders observed shapes and placed image assets', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'visual-reverse',
    title: 'visual-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'visual-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'card-frame',
            role: 'shape',
            semantic: '指标卡片',
            tagName: 'div',
            bounds: { x: 40, y: 50, width: 240, height: 120 },
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: '#c8102e',
              strokeWeight: 3,
              opacity: 72,
              cornerRadius: 8,
            },
            styleRefs: {},
            content: { text: '' },
          },
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'hero.png',
              path: 'D:\\assets\\hero.png',
              cropped: true,
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /id="card-frame"[^>]+background-color:#fbfaf7/);
  assert.match(html, /id="card-frame"[^>]+border:3px solid #c8102e/);
  assert.match(html, /id="card-frame"[^>]+opacity:0\.72/);
  assert.match(html, /id="card-frame"[^>]+border-radius:8px/);
  assert.match(html, /<figure[^>]+id="hero-image"[^>]+data-id-asset-path="D:\\assets\\hero\.png"/);
  assert.match(html, /<img src="file:\/\/\/D:\/assets\/hero\.png"/);
  assert.match(html, /data-id-image-cropped="true"/);
});

test('semanticModelToHtml can write local asset URLs relative to the HTML output directory', () => {
  const outputDir = path.resolve('test/workspace/manual-reverse-html');
  const assetPath = path.resolve('test/fixtures/e2e/smoke-assets/photos/industrial-site.jpg');
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'relative-asset-reverse',
    title: 'relative-asset-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'relative-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'hero-image',
            role: 'graphic',
            semantic: 'hero-image',
            tagName: 'figure',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'industrial-site.jpg',
              path: assetPath,
              cropped: true,
            },
          },
        ],
      },
    ],
  }, { outputDir });

  const expectedUrl = path.relative(outputDir, assetPath).replace(/\\/g, '/');
  assert.match(html, new RegExp(`<img src="${escapeRegExp(expectedUrl)}"`));
  assert.doesNotMatch(html, /<img src="file:\/\//);
});

test('semanticModelToHtml renders placed PDFs through image previews when available', () => {
  const outputDir = path.resolve('test/workspace/manual-reverse-html');
  const pdfPath = path.resolve('test/fixtures/e2e/reference-pdfs/ice-rink-layout-reference.pdf');
  const previewPath = path.resolve('test/fixtures/e2e/reference-pdfs/ice-rink-layout-reference-page1.png');
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'pdf-preview-reverse',
    title: 'pdf-preview-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'pdf-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'placed-pdf',
            role: 'graphic',
            semantic: 'drawing-frame-object',
            tagName: 'figure',
            bounds: { x: 80, y: 40, width: 500, height: 300 },
            styleRefs: {},
            content: { text: '' },
            asset: {
              name: 'ice-rink-layout-reference.pdf',
              path: pdfPath,
              cropped: false,
              graphicType: 'PDF',
            },
          },
        ],
      },
    ],
  }, { outputDir });

  const expectedUrl = path.relative(outputDir, previewPath).replace(/\\/g, '/');
  assert.match(html, /<figure[^>]+data-id-asset-path="/);
  assert.match(html, new RegExp(`<img src="${escapeRegExp(expectedUrl)}"`));
  assert.match(html, /data-id-preview-asset-path=/);
  assert.doesNotMatch(html, /<object[^>]+type="application\/pdf"/);
});

test('semanticModelToHtml renders reverse gradient feather effects over observed fill', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'effect-reverse',
    title: 'effect-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'effect-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cover-veil',
            role: 'shape',
            semantic: 'cover-veil',
            tagName: 'div',
            bounds: { x: 0, y: 0, width: 800, height: 450 },
            visualStyle: {
              fillColor: '#fbfaf7',
              strokeColor: null,
              strokeWeight: null,
              opacity: 100,
              cornerRadius: null,
            },
            effects: {
              gradientFeather: {
                type: 'linear',
                scope: 'fill',
                angle: 0,
                stops: [
                  { location: 0, opacity: 94 },
                  { location: 45, opacity: 55 },
                  { location: 100, opacity: 8 },
                ],
              },
            },
            styleRefs: {},
            content: { text: '' },
          },
        ],
      },
    ],
  });

  assert.match(html, /id="cover-veil"[^>]+background:linear-gradient/);
  assert.match(html, /rgba\(251, 250, 247, 0\.94\) 0%/);
  assert.match(html, /rgba\(251, 250, 247, 0\.55\) 45%/);
  assert.match(html, /rgba\(251, 250, 247, 0\.08\) 100%/);
});

test('semanticModelToHtml renders observed text style', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'type-reverse',
    title: 'type-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'type-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'title',
            role: 'text',
            semantic: 'page-title',
            tagName: 'h1',
            bounds: { x: 40, y: 50, width: 360, height: 72 },
            textStyle: {
              fontFamily: 'Microsoft YaHei',
              fontWeight: '700',
              fontStyle: null,
              pointSize: 32,
              leading: 38,
              fillColor: '#123456',
              tracking: 20,
              justification: 'center',
            },
            styleRefs: {},
            content: { text: '标题文字' },
          },
        ],
      },
    ],
  });

  assert.match(html, /\.id-object\[data-id-role="text"\] \{ overflow: visible; \}/);
  assert.match(html, /id="title"[^>]+font-family:&quot;Microsoft YaHei&quot;, Arial, sans-serif/);
  assert.match(html, /id="title"[^>]+font-weight:700/);
  assert.match(html, /id="title"[^>]+font-size:32px/);
  assert.match(html, /id="title"[^>]+line-height:38px/);
  assert.match(html, /id="title"[^>]+color:#123456/);
  assert.match(html, /id="title"[^>]+letter-spacing:0\.02em/);
  assert.match(html, /id="title"[^>]+text-align:center/);
});

test('semanticModelToHtml preserves hard line breaks and character runs in text objects', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'run-reverse',
    title: 'run-reverse',
    reverseMode: 'structured',
    styles: {
      characterStyles: {
        封面强调: {
          name: '封面强调',
          token: '封面强调',
          safeName: '封面强调',
          css: 'color:#c8102e; font-style:italic',
        },
      },
    },
    pages: [
      {
        id: 'run-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'cover-title',
            role: 'text',
            semantic: 'cover-title',
            tagName: 'h1',
            bounds: { x: 40, y: 50, width: 500, height: 120 },
            styleRefs: { paragraphStyle: '封面标题' },
            content: {
              text: '冰球场首层平面\n排布汇报',
              runs: [
                {
                  text: '冰球场首层平面\n',
                  textStyle: { fillColor: '#123456' },
                },
                {
                  text: '排布汇报',
                  characterStyle: '封面强调',
                  textStyle: { fillColor: '#c8102e', fontStyle: 'italic' },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /冰球场首层平面<br><\/span><span[\s\S]+排布汇报<\/span>/);
  assert.match(html, /class="cstyle-封面强调"/);
  assert.match(html, /style="[^"]*color:#c8102e/);
  assert.match(html, /style="[^"]*font-style:italic/);
});

test('semanticModelToHtml renders native table rows cells and cell styles', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'table-reverse',
    title: 'table-reverse',
    reverseMode: 'structured',
    pages: [
      {
        id: 'table-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'area-table',
            role: 'table',
            semantic: 'metrics-table',
            tagName: 'table',
            bounds: { x: 80, y: 100, width: 420, height: 120 },
            styleRefs: { tableStyle: '面积指标表', objectStyle: '表格框' },
            content: { text: '\u0016' },
            table: {
              tableStyle: '面积指标表',
              rowCount: 2,
              columnCount: 2,
              columnWidths: [260, 160],
              rowHeights: [32, 28],
              rows: [
                {
                  index: 0,
                  cells: [
                    {
                      index: 0,
                      text: 'Space',
                      header: true,
                      rowSpan: 1,
                      colSpan: 1,
                      fillColor: '#123456',
                      textColor: '#ffffff',
                      pointSize: 18,
                      leading: 24,
                      textAlign: 'center',
                      paragraphStyle: '表头文字',
                      padding: { top: 8, right: 10, bottom: 8, left: 10 },
                      borders: {
                        top: { color: '#cfd6d2', borderWeight: 1 },
                        right: { color: '#cfd6d2', borderWeight: 1 },
                        bottom: { color: '#cfd6d2', borderWeight: 1 },
                        left: { color: '#cfd6d2', borderWeight: 1 },
                      },
                    },
                    { index: 1, text: 'Area', header: true, rowSpan: 1, colSpan: 1 },
                  ],
                },
                {
                  index: 1,
                  cells: [
                    { index: 0, text: 'Ice rink', rowSpan: 1, colSpan: 1 },
                    { index: 1, text: '7,600 sqm', rowSpan: 1, colSpan: 1 },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.match(html, /<table[^>]+id="area-table"/);
  assert.match(html, /data-id-table-style="面积指标表"/);
  assert.match(html, /<col style="width:260px">/);
  assert.match(html, /<tr[^>]*>\s*<th[^>]+data-id-paragraph-style="表头文字"[^>]+>Space<\/th>/);
  assert.match(html, /<td[^>]*>Ice rink<\/td>/);
  assert.match(html, /background-color:#123456/);
  assert.match(html, /color:#ffffff/);
  assert.match(html, /font-size:18px/);
  assert.match(html, /line-height:24px/);
  assert.match(html, /text-align:center/);
  assert.match(html, /padding:8px 10px 8px 10px/);
  assert.match(html, /border-left:1px solid #cfd6d2/);
  assert.doesNotMatch(html, /\u0016/);
});

test('semanticModelToHtml renders reverse style classes composite text features and z order', () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'rich-type-reverse',
    title: 'rich-type-reverse',
    reverseMode: 'structured',
    styles: {
      compositeFonts: {
        '建筑复合字体': {
          name: '建筑复合字体',
          romanWeight: '400',
          cjkWeight: '700',
          entries: [{ name: '罗马字', size: 82, weight: '400' }],
        },
      },
      paragraphStyles: {
        '正文列表': {
          name: '正文列表',
          token: '正文列表',
          safeName: 'body-list',
          css: "font-family:'建筑复合字体',sans-serif; font-size:12pt; color:#123456",
          legacy: {
            list: { type: 'numbered', isCircle: true, charStyleCSS: 'color:#c8102e' },
          },
        },
        首字下沉: {
          name: '首字下沉',
          token: '首字下沉',
          safeName: 'drop-cap',
          css: 'font-size:14pt',
          legacy: {
            dropCap: { chars: 1, lines: 2, styleCSS: 'color:#c8102e' },
          },
        },
        首行强调: {
          name: '首行强调',
          token: '首行强调',
          safeName: 'first-line',
          css: 'font-size:12pt',
          legacy: {
            grepStyles: [{ pattern: '^.+?(?=\\n|\\r)', charStyleCSS: 'font-weight:bold; color:#c8102e' }],
          },
        },
      },
      objectStyles: {
        图片框: {
          name: '图片框',
          token: '图片框',
          safeName: 'image-frame',
          css: 'border:1pt solid #aeb8b8',
        },
      },
    },
    pages: [
      {
        id: 'rich-page',
        width: 800,
        height: 450,
        items: [
          {
            id: 'numbered',
            role: 'text',
            semantic: 'body-list',
            tagName: 'div',
            bounds: { x: 40, y: 50, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '正文列表' },
            content: { text: '第一条\nSecond item' },
            zIndex: 9,
          },
          {
            id: 'drop',
            role: 'text',
            semantic: 'drop',
            tagName: 'div',
            bounds: { x: 40, y: 150, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '首字下沉' },
            content: { text: '首段Text' },
          },
          {
            id: 'grep',
            role: 'text',
            semantic: 'grep',
            tagName: 'div',
            bounds: { x: 40, y: 250, width: 300, height: 80 },
            styleRefs: { paragraphStyle: '首行强调' },
            content: { text: '标题行\n正文行' },
          },
        ],
      },
    ],
  });

  assert.match(html, /\.pstyle-body-list \{ font-family:'建筑复合字体',sans-serif; font-size:12px; color:#123456 \}/);
  assert.match(html, /\.ostyle-image-frame \{ border:1px solid #aeb8b8 \}/);
  assert.doesNotMatch(html, /font-size:12pt/);
  assert.match(html, /id="numbered"[^>]+class="[^"]*pstyle-body-list/);
  assert.match(html, /id="numbered"[^>]+style="[^"]*z-index:9/);
  assert.match(html, /class="list-item has-number" data-number="1" data-circle="①"/);
  assert.match(html, /<span class="en-text">Second item<\/span>/);
  assert.match(html, /id="drop"[\s\S]*<span class="dropcap-chars">首<\/span>/);
  assert.match(html, /id="grep"[\s\S]*<span class="grep-first-line" style="font-weight:bold; color:#c8102e">标题行<\/span>/);
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
