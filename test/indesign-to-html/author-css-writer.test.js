const test = require('node:test');
const assert = require('node:assert/strict');
const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');
const { chromium } = require('playwright');

test('synth rules follow declared style rules and win class conflicts in the browser', async () => {
  const css = writeAuthorCssFiles({
    styles: {
      paragraphStyles: {
        body: { safeName: 'body', css: 'font-size:18pt;color:#ff0000' },
      },
      synthesized: [{
        token: 'synth_text_001',
        displayName: '文字样式 01',
        kind: 'text',
        properties: { pointSize: 24, fillColor: '#0000ff' },
      }],
    },
    pages: [],
  })['styles/components.css'];

  assert.ok(css.indexOf('.pstyle-body') < css.indexOf('.synth-synth_text_001'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style><p id="target" class="pstyle-body synth-synth_text_001">正文</p>`);
    const computed = await page.$eval('#target', (element) => {
      const style = getComputedStyle(element);
      return { fontSize: style.fontSize, color: style.color };
    });
    assert.deepEqual(computed, { fontSize: '24px', color: 'rgb(0, 0, 255)' });
  } finally {
    await browser.close();
  }
});

test('writeAuthorCssFiles emits valid fallback selectors for numeric InDesign ids', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
        items: [
          {
            id: '1712',
            role: 'text',
            bounds: { x: 10, y: 20, width: 300, height: 40 },
          },
        ],
      },
    ],
  })['styles/reverse-overrides.css'];

  assert.match(css, /\[id="1712"\] \{ position:absolute;/);
  assert.doesNotMatch(css, /#1712\s*\{/);
});

test('writeAuthorCssFiles converts nested fallback geometry from page coordinates to positioned-parent coordinates', () => {
  const css = writeAuthorCssFiles({
    pages: [{
      id: 'page',
      items: [
        {
          id: 'figure-a',
          role: 'graphic',
          bounds: { x: 100, y: 80, width: 240, height: 160 },
          structure: { parentId: 'page', order: 1 },
        },
        {
          id: 'caption-a',
          role: 'text',
          bounds: { x: 130, y: 210, width: 180, height: 24 },
          structure: { parentId: 'figure-a', order: 1 },
        },
        {
          id: 'virtual-group',
          role: 'container',
          virtual: true,
          structure: { parentId: 'page', order: 2 },
        },
        {
          id: 'grouped-figure',
          role: 'graphic',
          bounds: { x: 500, y: 100, width: 240, height: 160 },
          structure: { parentId: 'virtual-group', order: 1 },
        },
      ],
    }],
  })['styles/reverse-overrides.css'];

  assert.match(css, /\[id="figure-a"\] \{[^}]*left:100px; top:80px/);
  assert.match(css, /\[id="caption-a"\] \{[^}]*left:30px; top:130px/);
  assert.match(css, /\[id="grouped-figure"\] \{[^}]*left:500px; top:100px/);
});

test('writeAuthorCssFiles omits degenerate invisible vector leftovers', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
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
          },
        ],
      },
    ],
  })['styles/reverse-overrides.css'];

  assert.doesNotMatch(css, /empty-vector/);
});

test('writeAuthorCssFiles keeps observed text frame bounds fixed while allowing overflow', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
        items: [
          {
            id: 'tiny-text-frame',
            role: 'text',
            bounds: { x: 10, y: 20, width: 120, height: 12 },
            textStyle: { pointSize: 15, leading: 24 },
            content: { text: '概念方案轴网 6x9m' },
          },
        ],
      },
    ],
  });

  assert.match(css['styles/layout.css'], /\.observed-text\.id-object \{ overflow: visible; \}/);
  assert.match(css['styles/reverse-overrides.css'], /\[id="tiny-text-frame"\] \{[^}]*height:12px/);
  assert.doesNotMatch(css['styles/reverse-overrides.css'], /\[id="tiny-text-frame"\] \{[^}]*min-height:/);
});

test('writeAuthorCssFiles resets browser margins for fixed-position page text tags', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
        width: 1496.693,
        height: 841.89,
        items: [
          {
            id: 'image-title',
            role: 'text',
            bounds: { x: 285.799, y: 169.835, width: 216.179, height: 37.094 },
            content: { text: '原方案' },
            textStyle: { pointSize: 24, leading: 24 },
          },
        ],
      },
    ],
  });

  assert.match(css['styles/layout.css'], /\.page :where\(p, h1, h2, h3, h4, h5, h6, figure, figcaption, ul, ol\) \{ margin: 0; \}/);
});

test('writeAuthorCssFiles isolates each page for blend modes', () => {
  const css = writeAuthorCssFiles({
    pages: [{ width: 1496.693, height: 841.89, items: [] }],
  });

  assert.match(css['styles/layout.css'], /\.page \{[^}]*isolation: isolate/);
});

test('writeAuthorCssFiles gives zero-height stroked vectors a visible box', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
        items: [
          {
            id: 'parent-rule',
            role: 'line',
            bounds: { x: 40, y: 420, width: 720, height: 0 },
            visualStyle: { strokeColor: '#c8102e', strokeWeight: 2 },
            vectorGeometry: {
              kind: 'line',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 40, y: 420 }, leftDirection: { x: 40, y: 420 }, rightDirection: { x: 40, y: 420 } },
                    { anchor: { x: 760, y: 420 }, leftDirection: { x: 760, y: 420 }, rightDirection: { x: 760, y: 420 } },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  })['styles/reverse-overrides.css'];

  assert.match(css, /\[id="parent-rule"\] \{[^}]*height:0px[^}]*min-height:2px/);
});

test('writeAuthorCssFiles gives marker-only zero-width vectors a capturable box', () => {
  const css = writeAuthorCssFiles({
    pages: [
      {
        items: [
          {
            id: 'marker-only-line',
            role: 'line',
            bounds: { x: 40, y: 120, width: 0, height: 90 },
            visualStyle: {
              strokeColor: null,
              strokeWeight: null,
              lineStartMarker: { type: 'circle', rawName: 'Circle' },
            },
            vectorGeometry: {
              kind: 'line',
              paths: [
                {
                  closed: false,
                  points: [
                    { anchor: { x: 40, y: 120 }, leftDirection: { x: 40, y: 120 }, rightDirection: { x: 40, y: 120 } },
                    { anchor: { x: 40, y: 210 }, leftDirection: { x: 40, y: 210 }, rightDirection: { x: 40, y: 210 } },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  })['styles/reverse-overrides.css'];

  assert.match(css, /\[id="marker-only-line"\] \{[^}]*width:0px[^}]*min-width:1px/);
});

function rotatedSourceLinePage() {
  // 正向构建的 div.line + transform:rotate(-22deg)：InDesign 读回的是已旋转的直线，
  // bounds 是旋转后的外框，矢量点是页面坐标的斜线端点。
  return {
    id: 'site-page',
    width: 800,
    height: 450,
    items: [{
      id: 'site-entry-line',
      role: 'annotation',
      bounds: { x: 300, y: 100, width: 161.2, height: 65.129 },
      structure: { parentId: 'site-page', order: 1 },
      sourceNode: {
        tagName: 'div',
        id: 'site-entry-line',
        classList: ['line'],
        attributes: {
          id: 'site-entry-line',
          class: 'line',
          style: 'left:269mm;top:102mm;width:46mm;transform:rotate(-22deg);transform-origin:left center;margin-top:2px;opacity:0.8',
          'data-id-object': '',
        },
      },
      visualStyle: { strokeColor: '#c8102e', strokeWeight: 1 },
      vectorGeometry: {
        kind: 'line',
        paths: [{
          closed: false,
          points: [
            { anchor: { x: 300, y: 165.129 } },
            { anchor: { x: 461.2, y: 100 } },
          ],
        }],
      },
    }],
  };
}

test('observation vector svg drops baked source transform and box geometry in favour of reverse bounds', () => {
  const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
  const page = rotatedSourceLinePage();
  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });
  const style = (html.match(/<svg[^>]+style="([^"]*)"/) || [])[1];

  assert.match(html, /<svg[^>]+id="site-entry-line"[^>]+viewBox="0 0 161\.2 65\.129"/);
  assert.match(html, /<path d="M0 65\.129 [^"]*161\.2 0"/);
  assert.ok(style, 'svg keeps a style attribute');
  assert.doesNotMatch(style, /transform|rotate|left:|top:|width:|margin/);
  assert.match(style, /opacity:0\.8/);

  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation' })['styles/reverse-overrides.css'];
  assert.match(css, /\[id="site-entry-line"\] \{ position:absolute; left:300px; top:100px; width:161\.2px; height:65\.129px; margin:0; transform:none; rotate:none; translate:none; scale:none; border:0; background:none; padding:0; box-shadow:none; \}/);
});

test('structured reverse export keeps sourced vectors on their source geometry', () => {
  const css = writeAuthorCssFiles({ pages: [rotatedSourceLinePage()] }, { mode: 'structured' })['styles/reverse-overrides.css'];
  assert.doesNotMatch(css, /site-entry-line/);
});

test('observation vector svg keeps grid placement but drops baked source transform', () => {
  const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
  const page = rotatedSourceLinePage();
  const item = page.items[0];
  item.layout = { grid: { col: 1, span: 4, row: 2, rowSpan: 1 }, cssVars: { '--grid-col': '1', '--grid-span': '4' } };
  item.sourceNode.classList = ['line', 'grid-item'];
  item.sourceNode.attributes.style = '--grid-col:1;--grid-span:4;transform:rotate(-22deg)';
  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });
  const style = (html.match(/<svg[^>]+style="([^"]*)"/) || [])[1];

  assert.match(style, /--grid-col:1;--grid-span:4/);
  assert.doesNotMatch(style, /transform/);
  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation' })['styles/reverse-overrides.css'];
  assert.doesNotMatch(css, /site-entry-line/);
});

test('observation rotated line renders once-rotated inside its reverse bounds in the browser', async () => {
  const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
  const page = rotatedSourceLinePage();
  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation' });
  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });
  const browser = await chromium.launch();
  try {
    const browserPage = await browser.newPage();
    await browserPage.setContent([
      `<style>${css['styles/layout.css']}</style>`,
      // 模拟带 sourceRoot 时拷回的源码组件样式：它们与读回外框冲突，兜底几何必须胜出。
      '<style>.line { position:absolute; height:0; transform:rotate(45deg); }</style>',
      `<style>${css['styles/reverse-overrides.css']}</style>`,
      `<section class="page" id="site-page">${html}</section>`,
    ].join('\n'));
    const measured = await browserPage.$eval('#site-entry-line', (svg) => {
      const pageRect = svg.closest('.page').getBoundingClientRect();
      const rect = svg.getBoundingClientRect();
      const path = svg.querySelector('path');
      const matrix = path.getScreenCTM();
      const ends = [path.getPointAtLength(0), path.getPointAtLength(path.getTotalLength())]
        .map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix))
        .map((point) => ({ x: point.x - pageRect.left, y: point.y - pageRect.top }));
      return {
        transform: getComputedStyle(svg).transform,
        rect: { x: rect.left - pageRect.left, y: rect.top - pageRect.top, width: rect.width, height: rect.height },
        ends,
      };
    });
    const close = (actual, expected) => Math.abs(actual - expected) < 0.05;

    assert.equal(measured.transform, 'none');
    assert.ok(close(measured.rect.x, 300) && close(measured.rect.y, 100), JSON.stringify(measured.rect));
    assert.ok(close(measured.rect.width, 161.2) && close(measured.rect.height, 65.129), JSON.stringify(measured.rect));
    assert.ok(close(measured.ends[0].x, 300) && close(measured.ends[0].y, 165.129), JSON.stringify(measured.ends));
    assert.ok(close(measured.ends[1].x, 461.2) && close(measured.ends[1].y, 100), JSON.stringify(measured.ends));
  } finally {
    await browser.close();
  }
});
