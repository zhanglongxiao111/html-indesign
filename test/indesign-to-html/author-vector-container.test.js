const test = require('node:test');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');

// #27：观察模式下读回带矢量路径、又挂着子对象的容器曾被写成 <svg>，子对象整片丢失。

function rectanglePath(bounds) {
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y],
  ];
  return {
    kind: 'rectangle',
    paths: [{
      closed: true,
      points: corners.map(([x, y]) => ({
        anchor: { x, y },
        leftDirection: { x, y },
        rightDirection: { x, y },
        pointType: 'PLAIN',
      })),
    }],
  };
}

function sourced(id, tagName, extra = {}) {
  return {
    tagName,
    id,
    classList: extra.classList || [],
    attributes: { id, ...(extra.attributes || {}) },
  };
}

function textItem(id, parentId, order, bounds, text) {
  return {
    id,
    role: 'text',
    tagName: 'p',
    bounds,
    zIndex: 40 + order,
    content: { text, runs: [] },
    labelStatus: 'accepted',
    sourceNode: sourced(id, 'p', { attributes: { 'data-id-paragraph-style': 'metric-value' } }),
    structure: { parentId, order },
  };
}

function containerPage() {
  const cardBounds = { x: 68, y: 668, width: 224, height: 186 };
  const boxBounds = { x: 400, y: 100, width: 300, height: 200 };
  const labelBounds = { x: 900, y: 300, width: 128, height: 30 };
  return {
    id: 'cover-page',
    width: 1600,
    height: 900,
    items: [
      {
        // 网格容器：外框来自作者网格。
        id: 'metric-card',
        role: 'shape',
        tagName: 'div',
        bounds: cardBounds,
        zIndex: 6,
        labelStatus: 'accepted',
        styleRefs: { objectStyle: 'metric-card', synthesizedToken: 'synth_object_001' },
        visualStyle: { fillColor: '#fbfaf7', strokeColor: '#cfd6d2', strokeWeight: 1, cornerRadius: 4, opacity: 100 },
        vectorGeometry: rectanglePath(cardBounds),
        sourceNode: sourced('metric-card', 'div', {
          classList: ['metric-card', 'grid-item'],
          attributes: { style: '--grid-col:1;--grid-span:2;--grid-row:7;--grid-row-span:2', 'data-id-object': '' },
        }),
        structure: { parentId: 'cover-page', order: 1, containerPolicy: 'group' },
        layout: { grid: { col: 1, span: 2, row: 7, rowSpan: 2 }, cssVars: { '--grid-col': '1', '--grid-span': '2', '--grid-row': '7', '--grid-row-span': '2' } },
      },
      textItem('metric-card-value', 'metric-card', 2, { x: 91.7, y: 692.4, width: 176.9, height: 37.3 }, '243.75m'),
      textItem('metric-card-label', 'metric-card', 3, { x: 91.7, y: 737.3, width: 176.9, height: 13.3 }, 'grid length'),
      {
        // 非网格容器：外框按读回 bounds 绝对定位，带 2px 描边。
        id: 'legend-box',
        role: 'shape',
        tagName: 'div',
        bounds: boxBounds,
        zIndex: 8,
        labelStatus: 'accepted',
        visualStyle: { fillColor: '#ffffff', strokeColor: '#c8102e', strokeWeight: 2, opacity: 100 },
        vectorGeometry: rectanglePath(boxBounds),
        sourceNode: sourced('legend-box', 'div', {
          classList: ['legend'],
          attributes: { style: 'left:10mm;top:20mm;transform:rotate(3deg)', 'data-id-object': '' },
        }),
        structure: { parentId: 'cover-page', order: 4, containerPolicy: 'group' },
      },
      {
        id: 'legend-swatch',
        role: 'shape',
        tagName: 'span',
        bounds: { x: 420, y: 120, width: 20, height: 20 },
        zIndex: 30,
        labelStatus: 'accepted',
        visualStyle: { fillColor: '#c8102e', strokeColor: null, strokeWeight: null },
        vectorGeometry: rectanglePath({ x: 420, y: 120, width: 20, height: 20 }),
        sourceNode: sourced('legend-swatch', 'span', { classList: ['swatch'], attributes: { style: 'background:red;margin-left:4px' } }),
        structure: { parentId: 'legend-box', order: 5 },
      },
      {
        ...textItem('legend-label', 'legend-box', 6, { x: 450, y: 122, width: 200, height: 16 }, 'Ice rink'),
        sourceNode: sourced('legend-label', 'span', { attributes: { style: 'margin-top:9px;left:3px' } }),
      },
      {
        // 伴生文字：正向构建从带文字的形状拆出 <id>-text，回读时折回形状自身。
        id: 'entry-label',
        role: 'annotation',
        tagName: 'div',
        bounds: labelBounds,
        zIndex: 16,
        labelStatus: 'accepted',
        visualStyle: { fillColor: '#ffffff', strokeColor: '#c8102e', strokeWeight: 1, cornerRadius: 3, opacity: 100 },
        vectorGeometry: rectanglePath(labelBounds),
        sourceNode: sourced('entry-label', 'div', { classList: ['annotation'], attributes: { 'data-id-object': '' } }),
        structure: { parentId: 'cover-page', order: 7, containerPolicy: 'group' },
      },
      {
        id: 'entry-label-text',
        role: 'text',
        tagName: 'p',
        bounds: { x: 911.34, y: 307.56, width: 105.32, height: 14.88 },
        content: { text: 'Public entry band', runs: [] },
        textStyle: { fontFamily: 'Arial', pointSize: 9.3333, leading: 12, fillColor: '#000000' },
        sourceNode: null,
        structure: { order: 8 },
      },
    ],
  };
}

test('observation vector containers keep their children as an HTML container instead of an <svg>', () => {
  const page = containerPage();
  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });
  const $ = cheerio.load(`<section id="cover-page">${html}</section>`);

  assert.equal($('svg#metric-card').length, 0, 'container must not collapse into an svg');
  const card = $('div#metric-card');
  assert.equal(card.length, 1);
  assert.deepEqual(card.children().map((_, el) => $(el).attr('id')).get(), ['metric-card-value', 'metric-card-label']);
  assert.equal(card.find('#metric-card-value').text(), '243.75m');
  assert.equal(card.find('#metric-card-label').text(), 'grid length');
  // 观察态标记、对象样式和读回外观都落在容器本身。
  assert.equal(card.attr('data-id-object'), '');
  assert.equal(card.attr('data-id-object-style'), 'metric-card');
  assert.equal(card.attr('data-id-vector'), undefined);
  assert.match(card.attr('class'), /\bmetric-card\b.*\bgrid-item\b.*\bid-object\b/);
  const cardStyle = card.attr('style');
  assert.match(cardStyle, /--grid-col:1;--grid-span:2/);
  assert.match(cardStyle, /background-color:#fbfaf7/);
  assert.match(cardStyle, /border:1px solid #cfd6d2/);
  assert.match(cardStyle, /border-radius:4px/);
  assert.match(cardStyle, /overflow:visible/);
  assert.match(cardStyle, /z-index:6/);

  const box = $('div#legend-box');
  assert.deepEqual(box.children().map((_, el) => $(el).attr('id')).get(), ['legend-swatch', 'legend-label']);
  assert.equal($('svg#legend-swatch').length, 1, 'childless vector children stay svg');
  assert.doesNotMatch(box.attr('style'), /left:|top:|transform/, 'baked source box and transform are stripped');
  // 容器子对象的源码定位、外边距会压过兜底几何，一并剥掉。
  // 源码样式不随包时，读回 z 序仍要写上（否则会被兜底定位的对象压住）。
  assert.equal($('#legend-label').attr('style'), 'z-index:46');
  assert.doesNotMatch($('svg#legend-swatch').attr('style'), /margin/);

  const label = $('div#entry-label');
  assert.equal(label.text().trim(), 'Public entry band');
  assert.equal($('#entry-label-text').length, 0, 'companion text folds into its shape');
  assert.match(label.attr('style'), /font-size:9\.333px/);
  assert.match(label.attr('style'), /padding:7\.56px 11\.34px 7\.56px 11\.34px/);
});

test('reverse overrides place vector container children from reverse bounds', () => {
  const css = writeAuthorCssFiles({ pages: [containerPage()] }, { mode: 'observation' })['styles/reverse-overrides.css'];
  // 网格容器不是定位参照：子对象按页面坐标定位。
  assert.match(css, /\[id="metric-card-value"\] \{ position:absolute; left:91\.7px; top:692\.4px; width:176\.9px; height:37\.3px; margin:0; \}/);
  assert.doesNotMatch(css, /\[id="metric-card"\]/);
  // 非网格容器按读回 bounds 绝对定位，子对象相对容器内边距盒（扣掉 2px 描边）。
  assert.match(css, /\[id="legend-box"\] \{ position:absolute; left:400px; top:100px; width:300px; height:200px; margin:0; transform:none;/);
  assert.match(css, /\[id="legend-label"\] \{ position:absolute; left:48px; top:20px; width:200px; height:16px; margin:0; \}/);
  assert.match(css, /\[id="legend-swatch"\] \{ position:absolute; left:18px; top:18px; width:20px; height:20px; margin:0;/);
  assert.doesNotMatch(css, /entry-label-text/);
});

test('vector container children render at their reverse bounds above the container paint', async () => {
  const page = containerPage();
  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation' });
  const html = pageItemsToAuthorHtml(page, { mode: 'observation' });
  const browser = await chromium.launch();
  try {
    const browserPage = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    await browserPage.setContent([
      `<style>${css['styles/layout.css']}</style>`,
      '<style>.page { --id-grid-columns: 12; --id-grid-rows: 8; width:1600px; height:900px; padding:0; }</style>',
      // 模拟带 sourceRoot 拷回的源码组件样式：外边距与定位不能把子对象挤离读回 bounds。
      '<style>.legend { position:absolute; left:0; top:0; padding:30px; } .swatch { margin:6px; }</style>',
      `<style>${css['styles/reverse-overrides.css']}</style>`,
      `<section class="page" id="cover-page">${html}</section>`,
    ].join('\n'));
    const measured = await browserPage.evaluate(() => {
      const pageRect = document.getElementById('cover-page').getBoundingClientRect();
      const out = {};
      for (const id of ['legend-box', 'legend-swatch', 'legend-label']) {
        const element = document.getElementById(id);
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        out[id] = {
          box: [rect.left - pageRect.left, rect.top - pageRect.top, rect.width, rect.height].map((value) => Math.round(value * 100) / 100),
          topmost: Boolean(hit && (hit === element || element.contains(hit) || hit.closest('svg') === element)),
        };
      }
      return out;
    });
    assert.deepEqual(measured['legend-box'].box, [400, 100, 300, 200]);
    assert.deepEqual(measured['legend-swatch'].box, [420, 120, 20, 20]);
    assert.deepEqual(measured['legend-label'].box, [450, 122, 200, 16]);
    assert.equal(measured['legend-swatch'].topmost, true, 'child paints above the container fill');
    assert.equal(measured['legend-label'].topmost, true, 'child paints above the container fill');
  } finally {
    await browser.close();
  }
});

test('non-rectangular vector containers warn that the CSS box approximates their path', () => {
  const page = containerPage();
  const card = page.items.find((item) => item.id === 'metric-card');
  card.vectorGeometry = {
    kind: 'oval',
    paths: [{
      closed: true,
      points: [
        { anchor: { x: 180, y: 668 }, leftDirection: { x: 120, y: 668 }, rightDirection: { x: 240, y: 668 } },
        { anchor: { x: 292, y: 761 }, leftDirection: { x: 292, y: 700 }, rightDirection: { x: 292, y: 820 } },
        { anchor: { x: 180, y: 854 }, leftDirection: { x: 240, y: 854 }, rightDirection: { x: 120, y: 854 } },
        { anchor: { x: 68, y: 761 }, leftDirection: { x: 68, y: 820 }, rightDirection: { x: 68, y: 700 } },
      ],
    }],
  };
  const authorWarnings = [];
  const html = pageItemsToAuthorHtml(page, { mode: 'observation', authorWarnings });

  assert.match(html, /<div id="metric-card"/);
  assert.deepEqual(authorWarnings.map((warning) => warning.code), ['REVERSE_VECTOR_CONTAINER_SHAPE_APPROXIMATED']);
  assert.deepEqual(authorWarnings[0].details, { pageId: 'cover-page', itemId: 'metric-card', vectorKind: 'oval' });
  assert.equal(authorWarnings[0].source, 'author-writer');
});

test('author items that no write path can hold are reported instead of silently dropped', () => {
  const authorWarnings = [];
  const html = pageItemsToAuthorHtml({
    id: 'rule-page',
    items: [
      {
        id: 'rule',
        role: 'shape',
        tagName: 'hr',
        bounds: { x: 0, y: 0, width: 100, height: 2 },
        labelStatus: 'accepted',
        sourceNode: sourced('rule', 'hr'),
        structure: { parentId: 'rule-page', order: 1 },
      },
      textItem('rule-caption', 'rule', 2, { x: 0, y: 4, width: 100, height: 12 }, 'Section break'),
    ],
  }, { mode: 'structured', authorWarnings });

  assert.doesNotMatch(html, /Section break/);
  assert.deepEqual(authorWarnings, [{
    code: 'REVERSE_AUTHOR_ITEM_DROPPED',
    message: 'Item rule-caption was not written to author HTML (its parent rule cannot hold child content).',
    source: 'author-writer',
    details: { pageId: 'rule-page', itemId: 'rule-caption', parentId: 'rule', role: 'text', text: 'Section break' },
  }]);
});

test('fully written author pages report no author warnings', () => {
  const authorWarnings = [];
  pageItemsToAuthorHtml(containerPage(), { mode: 'observation', authorWarnings });
  assert.deepEqual(authorWarnings, []);
});
