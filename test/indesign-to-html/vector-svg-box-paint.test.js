const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
const {
  VECTOR_SVG_BOX_PAINT_RESET,
  isVectorSvgBoxPaintProperty,
} = require('../../src/shared/vector-svg-box-paint');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileDocument } = require('../../src/indesign-pipeline');
const { authorPackageCompileOptions, readAuthorPackage } = require('../../src/authoring');

const RED = '#c8102e';
const WHITE = '#ffffff';

test('vector svg box paint predicate covers frame, fill and inset but keeps corner radius', () => {
  for (const property of [
    'border', 'border-top', 'border-left-width', 'border-color', 'border-style', 'border-image',
    'background', 'background-color', 'background-image', 'padding', 'padding-top', 'box-shadow',
  ]) {
    assert.equal(isVectorSvgBoxPaintProperty(property), true, property);
  }
  for (const property of [
    'border-radius', 'border-top-left-radius', 'opacity', 'mix-blend-mode', 'overflow', 'z-index', 'fill', 'stroke',
  ]) {
    assert.equal(isVectorSvgBoxPaintProperty(property), false, property);
  }
  assert.deepEqual(VECTOR_SVG_BOX_PAINT_RESET, ['border:0', 'background:none', 'padding:0', 'box-shadow:none']);
});

test('reverse overrides reset box paint on every generated vector svg and on sourced baked vectors', () => {
  const page = sourcedLinePage();
  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation' })['styles/reverse-overrides.css'];
  assert.match(css, /svg\.id-object\[data-id-vector\] \{ border:0; background:none; padding:0; box-shadow:none; \}/);
  assert.match(css, /\[id="site-entry-line"\] \{[^}]*scale:none; border:0; background:none; padding:0; box-shadow:none; \}/);
});

test('visual reference page resets object style box paint on vector svg with the same rule', () => {
  const { semanticModelToHtml } = require('../../src/writers/html');
  const model = boxPaintModel();
  model.styles.objectStyles = {
    'annotation-label': { name: 'annotation-label', css: `background-color:${WHITE}; border:1px solid ${RED}` },
  };
  const html = semanticModelToHtml(model);
  assert.match(html, /svg\.id-object\[data-id-vector\] \{ border:0; background:none; padding:0; box-shadow:none; \}/);
  assert.match(html, /<svg id="label-box" class="[^"]*id-object[^"]*"[^>]*data-id-vector="rectangle"/);
});

test('observation vector svg drops source box paint from its inline style and keeps paint on the path', () => {
  const html = pageItemsToAuthorHtml(sourcedLinePage(), { mode: 'observation' });
  const style = (html.match(/<svg[^>]+style="([^"]*)"/) || [])[1];
  assert.ok(style, 'svg keeps a style attribute');
  assert.doesNotMatch(style, /border(?!-radius)|background|padding|box-shadow/);
  assert.match(style, /border-radius:3px/);
  assert.match(style, /opacity:0\.8/);
  assert.match(html, new RegExp(`<path [^>]*fill="none"[^>]*stroke="${RED}"[^>]*stroke-width="1"`));
});

test('reverse author package draws vector svg only through paths and round-trips stroke and fill', async () => {
  const outDir = path.resolve('test/workspace/vector-svg-box-paint');
  fs.rmSync(outDir, { recursive: true, force: true });
  const result = writeReverseAuthorPackage(boxPaintModel(), { outDir, mode: 'observation' });

  const components = fs.readFileSync(path.join(outDir, 'styles/components.css'), 'utf8');
  // 合成样式本身仍描述对象样式（其他非 svg 对象可能共用），只是不再作用到矢量 svg 盒子上。
  assert.match(components, new RegExp(`\\.synth-synth_object_line \\{ border:1px solid ${RED} \\}`));
  assert.match(components, new RegExp(`\\.synth-synth_object_label \\{ background-color:${WHITE}; border:1px solid ${RED}; border-radius:3px \\}`));

  const browser = await chromium.launch();
  let measured;
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.goto(pathToFileURL(result.entryPath).href);
    measured = await page.evaluate(() => ['diag-line', 'label-box'].map((id) => {
      const svg = document.getElementById(id);
      const pageRect = svg.closest('.page').getBoundingClientRect();
      const cs = getComputedStyle(svg);
      const path = svg.querySelector('path');
      const matrix = path.getScreenCTM();
      const ends = [path.getPointAtLength(0), path.getPointAtLength(path.getTotalLength())]
        .map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix))
        .map((point) => ({ x: point.x - pageRect.left, y: point.y - pageRect.top }));
      return {
        id,
        borderWidth: cs.borderTopWidth,
        background: cs.backgroundColor,
        padding: cs.paddingTop,
        ends,
      };
    }));
  } finally {
    await browser.close();
  }
  for (const entry of measured) {
    assert.equal(entry.borderWidth, '0px', `${entry.id} has no box border`);
    assert.equal(entry.background, 'rgba(0, 0, 0, 0)', `${entry.id} has no box background`);
    assert.equal(entry.padding, '0px', `${entry.id} has no inset`);
  }
  const line = measured.find((entry) => entry.id === 'diag-line');
  assertClose(line.ends[0], { x: 100, y: 165.129 });
  assertClose(line.ends[1], { x: 261.2, y: 100 });
  const angle = Math.atan2(line.ends[1].y - line.ends[0].y, line.ends[1].x - line.ends[0].x) * 180 / Math.PI;
  assert.ok(Math.abs(angle - (-22)) < 0.01, `line angle ${angle}`);

  // 正向回编：svg 盒子不再画框/底色后，描边和填充仍从 path 与协议属性读回。
  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  const items = new Map(instructions.pages.flatMap((page) => page.items).map((item) => [item.id, item]));

  const lineItem = items.get('diag-line');
  assert.equal(lineItem.visualStyle.strokeColor, RED);
  assert.equal(lineItem.visualStyle.strokeWeight, 1);
  assert.equal(lineItem.visualStyle.fillColor, null);
  assert.deepEqual(lineItem.vectorGeometry.paths.map((entry) => [entry.visualStyle.strokeColor, entry.visualStyle.strokeWeight]), [[RED, 1]]);

  const labelItem = items.get('label-box');
  assert.equal(labelItem.visualStyle.fillColor, WHITE);
  assert.equal(labelItem.visualStyle.strokeColor, RED);
  assert.equal(labelItem.visualStyle.strokeWeight, 1);

  const swatchHex = (name) => name && instructions.styles.swatches[name] && instructions.styles.swatches[name].value;
  const labelStyle = instructions.styles.objectStyles[labelItem.styleRefs.objectStyle];
  assert.ok(labelStyle, 'label keeps an object style');
  assert.equal(swatchHex(labelStyle.fillColor), WHITE, 'object style fill is read back from the path');
  assert.equal(swatchHex(labelStyle.strokeColor), RED);
  assert.equal(labelStyle.strokeWeight, 1);
  const lineStyle = instructions.styles.objectStyles[lineItem.styleRefs.objectStyle];
  assert.ok(lineStyle, 'line keeps an object style');
  assert.equal(lineStyle.fillColor, null);
  assert.equal(swatchHex(lineStyle.strokeColor), RED);
  assert.equal(lineStyle.strokeWeight, 1);
});

function assertClose(actual, expected, tolerance = 0.05) {
  assert.ok(Math.abs(actual.x - expected.x) < tolerance && Math.abs(actual.y - expected.y) < tolerance,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function sourcedLinePage() {
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
          style: 'border-top:1px solid #c8102e;background:#fff;padding:2px;box-shadow:0 0 2px #000;border-radius:3px;transform:rotate(-22deg);opacity:0.8',
          'data-id-object': '',
        },
      },
      visualStyle: { strokeColor: RED, strokeWeight: 1 },
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

function boxPaintModel() {
  return {
    kind: 'DocumentModel',
    id: 'vector-box-paint-doc',
    title: '矢量盒子装饰',
    reverseMode: 'observation',
    unitMode: 'presentation',
    coordinateUnit: 'pt',
    styles: {
      synthesized: [
        {
          token: 'synth_object_line',
          displayName: '对象样式 线',
          kind: 'object',
          fingerprint: 'object:line',
          source: 'observed-style-atom',
          properties: { strokeColor: RED, strokeWeight: 1 },
        },
        {
          token: 'synth_object_label',
          displayName: '对象样式 标签',
          kind: 'object',
          fingerprint: 'object:label',
          source: 'observed-style-atom',
          properties: { fillColor: WHITE, strokeColor: RED, strokeWeight: 1, cornerRadius: 3 },
        },
      ],
    },
    pages: [{
      id: 'p1',
      index: 0,
      width: 800,
      height: 450,
      labels: [],
      items: [
        {
          id: 'diag-line',
          role: 'line',
          sourceType: 'GraphicLine',
          bounds: { x: 100, y: 100, width: 161.2, height: 65.129 },
          styleRefs: { objectStyle: 'annotation-line', synthesizedToken: 'synth_object_line', synthesizedName: '对象样式 线' },
          visualStyle: { fillColor: null, strokeColor: RED, strokeWeight: 1, strokeAlignment: 'center' },
          vectorGeometry: {
            kind: 'line',
            paths: [{
              closed: false,
              points: [
                { anchor: { x: 100, y: 165.129 } },
                { anchor: { x: 261.2, y: 100 } },
              ],
            }],
          },
        },
        {
          id: 'label-box',
          role: 'shape',
          sourceType: 'Rectangle',
          bounds: { x: 400, y: 200, width: 128.5, height: 29.09 },
          styleRefs: { objectStyle: 'annotation-label', synthesizedToken: 'synth_object_label', synthesizedName: '对象样式 标签' },
          visualStyle: { fillColor: WHITE, strokeColor: RED, strokeWeight: 1, strokeAlignment: 'inside', cornerRadius: 3 },
          vectorGeometry: {
            kind: 'rectangle',
            paths: [{
              closed: true,
              points: [
                { anchor: { x: 400, y: 200 } },
                { anchor: { x: 400, y: 229.09 } },
                { anchor: { x: 528.5, y: 229.09 } },
                { anchor: { x: 528.5, y: 200 } },
              ],
            }],
          },
        },
      ],
    }],
  };
}
