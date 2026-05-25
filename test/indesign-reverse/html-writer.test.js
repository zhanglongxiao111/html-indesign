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
