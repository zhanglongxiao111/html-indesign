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
