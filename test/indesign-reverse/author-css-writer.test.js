const test = require('node:test');
const assert = require('node:assert/strict');
const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');

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

test('writeAuthorCssFiles keeps observed text glyphs from being clipped by reverse text frames', () => {
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
  assert.match(css['styles/reverse-overrides.css'], /\[id="tiny-text-frame"\] \{[^}]*min-height:24px/);
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
