const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileDocument } = require('../../src/indesign-pipeline');
const { authorPackageCompileOptions, readAuthorPackage } = require('../../src/authoring');
const { resolveLayout, itemBounds } = require('../../src/semantic-model/layout');
const { compileStyles } = require('../../src/style-synthesis');

// 09-27 真机验收：人工 INDD（gradient-sample）多代往返。第一代达标，但第二代起：
// 带构建标签的文本框把两段写成一段夹 <br>、字符样式定义吸进局部格式、表格多出「默认表格」、
// 字号 / 行距每代多 0.0001pt、页面尺寸被截短（595.276 -> 595.27）。

const A4_WIDTH = 595.275590551;
const A4_HEIGHT = 841.889763778;
const MM10 = 28.3464566929134;

function textStyle(extra = {}) {
  return {
    appliedFont: 'Arial\tRegular',
    fontFamily: 'Arial',
    fontStyleName: 'Regular',
    fontWeight: null,
    fontStyle: null,
    pointSize: 24,
    leading: null,
    fillColor: '#ff0000',
    tracking: 0,
    justification: 'justify',
    capitalization: null,
    ...extra,
  };
}

function visualStyle(extra = {}) {
  return {
    fillColor: null,
    strokeColor: null,
    strokeWeight: null,
    fillOpacity: 100,
    strokeOpacity: 100,
    strokeStyle: '实底',
    opacity: 100,
    cornerRadius: null,
    strokeAlignment: 'center',
    ...extra,
  };
}

function cell(index, text) {
  return {
    index,
    text,
    header: false,
    rowSpan: 1,
    colSpan: 1,
    cellStyle: '[无]',
    paragraphStyle: '[基本段落]',
    fillColor: null,
    textColor: '#000000',
    pointSize: 12,
    textAlign: 'justify',
    textStyle: textStyle({ pointSize: 12, fillColor: '#000000' }),
    padding: { top: 1.417, right: 1.417, bottom: 1.417, left: 1.417 },
    paddingUnit: 'pt',
    borders: {
      top: { color: '#000000', borderWeight: 0.709 },
      right: { color: '#000000', borderWeight: 0.709 },
      bottom: { color: '#000000', borderWeight: 0.709 },
      left: { color: '#000000', borderWeight: 0.709 },
    },
    runs: text ? [{ characterStyle: null, textStyle: textStyle({ pointSize: 12, fillColor: '#000000', justification: null }), text }] : [],
  };
}

function item(id, type, bounds, extra = {}) {
  return {
    id,
    type,
    bounds,
    layerName: '图层 1',
    visible: true,
    printable: true,
    paragraphStyleName: '',
    objectStyleName: '[基本图形框架]',
    visualStyle: visualStyle(),
    textStyle: null,
    textRuns: [],
    table: null,
    vectorGeometry: null,
    text: '',
    labels: [],
    ...extra,
  };
}

// 上一代正向构建写进文本框的构建标签：来源 HTML 是两个 <p>，run 没有 id（按 id 合并 style 做不到）。
function buildLabel() {
  const sourceHtml = '\n        <p>Gradient text</p>\n        <p><span data-id-character-style="渐变字符" style="font-size:12px">S</span><span style="font-size:12px">econd para</span></p>\n      ';
  return {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: '286',
    source: 'html-to-indesign',
    role: 'text',
    semantic: null,
    htmlTag: 'div',
    className: 'pstyle-渐变段落 observed-text id-object',
    sourceFile: 'pages/00-1.html',
    sourceNode: {
      tagName: 'div',
      id: '286',
      classList: ['pstyle-渐变段落', 'observed-text', 'id-object'],
      attributes: { id: '286', class: 'pstyle-渐变段落 observed-text id-object', 'data-id-paragraph-style': '渐变段落', 'data-id-role': 'text' },
      sourcePath: 'div:nth-of-type(1)',
      sourceHtml,
    },
    sourceText: 'Gradient text\rSecond para',
    sourceHtml,
    sourceRuns: [
      { text: 'S', tagName: 'span', classList: [], attributes: { 'data-id-character-style': '渐变字符', style: 'font-size:12px' } },
      { text: 'econd para', tagName: 'span', classList: [], attributes: { style: 'font-size:12px' } },
    ],
    sourceAncestorNodes: [],
    structure: { parentId: '1', order: 1, containerPolicy: 'group' },
    layout: null,
  };
}

function handmadeSnapshot({ labelled = false } = {}) {
  return {
    metadata: { sourceDocument: 'handmade.indd', mode: 'structured', coordinateUnit: 'pt' },
    document: { name: 'handmade.indd', labels: [] },
    parentPages: [],
    styles: {
      paragraphStyles: [
        { name: '[基本段落]', labels: [], css: 'font-size:12pt; text-align:justify; color:#000000' },
        { name: '渐变段落', labels: [], css: "font-family:'Arial',sans-serif; font-size:24pt; text-align:justify; color:#ff0000" },
      ],
      characterStyles: [{ name: '[无]', labels: [], css: '' }, { name: '渐变字符', labels: [], css: 'color:#ff0000' }],
      objectStyles: [{ name: '[无]', labels: [], css: '' }, { name: '[基本文本框架]', labels: [], css: '' }],
      tableStyles: [{ name: '[无表样式]', labels: [], css: '' }, { name: '[基本表]', labels: [], css: '' }],
      cellStyles: [{ name: '[无]', labels: [], css: '' }],
      compositeFonts: [],
    },
    layers: [{ name: '图层 1', index: 0, visible: true, printable: true, locked: false, labels: [] }],
    assets: [],
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT },
      margins: { top: 2 * MM10, right: 2 * MM10, bottom: 2 * MM10, left: 2 * MM10 },
      guides: [],
      items: [
        item('286', 'TextFrame', { x: 14 * MM10, y: 2 * MM10, width: 6 * MM10, height: 6 * MM10 }, {
          paragraphStyleName: '渐变段落',
          objectStyleName: '[基本文本框架]',
          textStyle: textStyle(),
          text: 'Gradient text\rSecond para',
          textRuns: [
            { characterStyle: null, textStyle: textStyle({ justification: null }), text: 'Gradient text\r' },
            { characterStyle: '渐变字符', textStyle: textStyle({ justification: null, pointSize: 12, strokeColor: '#ff0000', strokeWeight: 0.70866141732283 }), text: 'S' },
            { characterStyle: null, textStyle: textStyle({ justification: null, pointSize: 12, strokeColor: '#ff0000', strokeWeight: 0.70866141732283 }), text: 'econd para' },
          ],
          zIndex: 0,
          ...(labelled ? { label: 'html-indesign:id=286;role=text;type=TEXT', labels: [buildLabel()] } : {}),
        }),
        item('310', 'TextFrame', { x: 14 * MM10, y: 9 * MM10, width: 6 * MM10, height: 6 * MM10 }, {
          paragraphStyleName: '[基本段落]',
          objectStyleName: '[基本文本框架]',
          textStyle: textStyle({ pointSize: 12, fillColor: '#000000' }),
          text: '\u0016',
          table: {
            tableStyle: '[基本表]',
            rowCount: 1,
            columnCount: 2,
            columnWidths: [84.685, 84.685],
            rowHeights: [14.835],
            rows: [{ index: 0, cells: [cell(0, 'A'), cell(1, 'B')] }],
          },
          zIndex: 1,
        }),
      ],
    }],
  };
}

function writePackage(name, snapshot) {
  const root = path.resolve('test/workspace', name);
  fs.rmSync(root, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'observation' });
  const result = writeReverseAuthorPackage(model, { outDir: root, mode: 'observation' });
  const read = (file) => fs.readFileSync(path.join(result.outDir, file), 'utf8');
  return {
    result,
    pageHtml: result.pages.map((page) => read(page)).join('\n'),
    layoutCss: read('styles/layout.css'),
  };
}

function frameBody(pageHtml) {
  return /<div [^>]*\bid="286"[^>]*>([\s\S]*?)<\/div>/.exec(pageHtml)[1];
}

test('a text frame carrying a build label is written with one <p> per paragraph, same as an unlabelled frame', () => {
  const unlabelled = writePackage('reverse-gen-unlabelled', handmadeSnapshot());
  const labelled = writePackage('reverse-gen-labelled', handmadeSnapshot({ labelled: true }));
  const body = frameBody(labelled.pageHtml);
  assert.equal((body.match(/<p>[\s\S]*?<\/p>/g) || []).length, 2);
  assert.doesNotMatch(body, /<br>/);
  assert.match(labelled.pageHtml, /<div [^>]*\bid="286"[^>]*data-id-role="text"/);
  // 两代写法一致：带标签（第二代）与无标签（第一代）的文本框写出同样的段落内容。
  assert.equal(body, frameBody(unlabelled.pageHtml));
});

test('reverse author package keeps page size, margins and table geometry at author length precision', () => {
  const { pageHtml, layoutCss } = writePackage('reverse-gen-lengths', handmadeSnapshot());
  assert.match(layoutCss, /\.page \{ width: 595\.276px; height: 841\.89px;/);
  assert.match(pageHtml, /--id-margin-top:56\.693px;--id-margin-right:56\.693px/);
  assert.doesNotMatch(pageHtml, /56\.6929/);
});

test('handmade package compiles back to the same lengths, a colour-only character style and the default table style', async () => {
  const { result } = writePackage('reverse-gen-roundtrip', handmadeSnapshot({ labelled: true }));
  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  const page = instructions.pages[0];
  const items = new Map(page.items.map((entry) => [entry.id, entry]));

  // 页面尺寸取作者声明值（Chromium 量出的外框是 595.265625），字号不因页面比例漂移。
  assert.equal(page.width, 595.276);
  assert.equal(page.height, 841.89);
  assert.deepEqual(page.margins, { top: 56.693, right: 56.693, bottom: 56.693, left: 56.693 });
  assert.equal(instructions.styles.paragraphStyles['渐变段落'].pointSize, 24);
  // 读回外框按作者长度精度照建；表格外框取包裹层的声明位置。
  assert.deepEqual(items.get('286').bounds, { x: 396.85, y: 56.693, width: 170.079, height: 170.079 });
  assert.deepEqual(items.get('310').bounds, { x: 396.85, y: 255.118, width: 170.079, height: 170.079 });
  assert.deepEqual(items.get('310').rowHeights, [14.835]);

  // 字符样式只定义 .cstyle-渐变字符 规则写的颜色；run 的字号、描边是局部覆盖。
  const characterStyle = instructions.styles.characterStyles['渐变字符'];
  assert.equal(instructions.styles.swatches[characterStyle.fillColor].value, '#ff0000');
  for (const key of ['appliedFont', 'fontStyleName', 'pointSize', 'fontWeight', 'fontStyle', 'tracking', 'strokeColor', 'strokeWeight']) {
    assert.equal(characterStyle[key] == null, true, `character style should not define ${key}`);
  }
  const styledRun = items.get('286').runs.find((run) => run.characterStyle === '渐变字符');
  assert.equal(styledRun.textOverride.pointSize, 12);
  assert.equal(styledRun.textOverride.strokeWeight, 0.709);
  assert.equal(styledRun.textOverride.fillColor, undefined);

  // 原件表格用内置表样式：观察页不新建「默认表格」。
  assert.equal(items.get('310').tableStyle, null);
  assert.deepEqual(Object.keys(instructions.styles.tableStyles), []);
});

test('a table on a normal author page keeps the 默认表格 fallback table style', () => {
  const table = {
    id: 'plain-table',
    role: 'table',
    tagName: 'table',
    attributes: {},
    classList: [],
    computedStyle: {},
    table: [],
  };
  const observedPage = { id: 'p1', attributes: { 'data-id-observed': 'true' }, items: [table] };
  const normalPage = { id: 'p2', attributes: {}, items: [{ ...table, id: 'plain-table-2' }] };
  const styled = compileStyles({ pages: [observedPage, normalPage] });
  assert.equal(styled.pages[0].items[0].styleRefs.tableStyle, null);
  assert.equal(styled.pages[1].items[0].styleRefs.tableStyle, '默认表格');
});

test('the presentation layout keeps a 1:1 scale and the authored page size under Chromium 1/64 px layout units', () => {
  const page = {
    rectPx: { x: 8, y: 8, width: 595.265625, height: 841.875 },
    authoredStyle: { width: '595.276px', height: '841.89px' },
    items: [],
  };
  const layout = resolveLayout({ pages: [page] }, { unitMode: 'presentation', targetSize: 'source' });
  assert.equal(layout.scale, 1);
  assert.deepEqual({ width: layout.targetSize.width, height: layout.targetSize.height }, { width: 595.276, height: 841.89 });
  // 贴着页面右 / 下边的满版对象延伸到页面边，不因排版截断留缝。
  const fullBleed = { rectPx: { x: 8, y: 8, width: 595.265625, height: 841.875 } };
  assert.deepEqual(itemBounds(fullBleed, page, layout), { x: 0, y: 0, width: 595.276, height: 841.89 });
  // 与声明值相差超过一个排版单位时（声明值不是这个外框）仍按量出的外框。
  const mismatch = resolveLayout({ pages: [{ ...page, authoredStyle: { width: '600px', height: '841.89px' } }] }, { unitMode: 'presentation' });
  assert.equal(mismatch.targetSize.width, 595.266);
});

test('authored lengths keep their digits past the CSSOM 6-significant-digit serialization', async () => {
  const dir = path.resolve('test/workspace/reverse-gen-cssom-digits');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, 'deck.html');
  fs.writeFileSync(htmlPath, [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    '* { box-sizing: border-box; } body { margin: 0; }',
    '.page { width: 1587.402px; height: 892.913px; position: relative; }',
    '[id="line"] { position:absolute; left:1016.693px; top:320.384px; width:161.198px; height:65.128px; }',
    '</style></head><body>',
    '<section class="page" id="p1" data-id-observed="true"><div id="line" data-id-object style="background:#c8102e"></div></section>',
    '</body></html>',
  ].join('\n'), 'utf8');
  const snapshot = await renderSnapshot({ htmlPath });
  const page = snapshot.pages[0];
  // CSSOM 把 1587.402px 序列化成 1587.4px、1016.693px 成 1016.69px；捕获取作者写的原数。
  assert.equal(page.authoredStyle.width, '1587.402px');
  const item = page.items.find((entry) => entry.id === 'line');
  assert.equal(item.authoredStyle.left, '1016.693px');
  const layout = resolveLayout(snapshot, { unitMode: 'presentation', targetSize: 'source' });
  assert.equal(layout.targetSize.width, 1587.402);
  assert.deepEqual(itemBounds(item, page, layout), { x: 1016.693, y: 320.384, width: 161.198, height: 65.128 });
});

test('a vector svg on the page grid fills its grid area instead of following its viewBox ratio', async () => {
  const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');
  const { chromium } = require('playwright');
  const css = writeAuthorCssFiles({ pages: [{ id: 'p', width: 400, height: 200, grid: { columns: 4, rows: 2 } }] }, { mode: 'observation' });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent([
      `<style>${css['styles/layout.css']}</style>`,
      '<section class="page" style="--id-grid-columns:4;--id-grid-rows:2">',
      // 上一代读回的路径比网格区域窄一点（964.94 对 965.03）：外框仍取网格区域。
      '<svg id="panel" class="grid-item" style="--grid-col:1;--grid-span:4;--grid-row:2;--grid-row-span:1" viewBox="0 0 399.9 99.8" preserveAspectRatio="none"><path d="M0 0 L399.9 99.8"/></svg>',
      '</section>',
    ].join('\n'));
    const rect = await page.$eval('#panel', (el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; });
    assert.deepEqual(rect, { width: 400, height: 100 });
  } finally {
    await browser.close();
  }
});

test('read-back stroke weight, corner radius and placed content lengths are quantized to author precision', () => {
  const snapshot = handmadeSnapshot();
  snapshot.pages[0].items.push(item('257', 'Oval', { x: 56.693, y: 453.543, width: 113.386, height: 113.386 }, {
    visualStyle: visualStyle({ fillColor: '#f5b090', strokeColor: '#000000', strokeWeight: 0.28346456692913, cornerRadius: 37.5000000000001 }),
    zIndex: 2,
  }));
  const model = reverseSnapshotToSemanticModel(snapshot, { mode: 'observation' });
  const oval = model.pages[0].items.find((entry) => entry.id === '257');
  // 与作者 HTML 写出的 data-id-stroke-weight / border 宽同一个数：下一代读回 0.283 时合成样式指纹不变。
  assert.equal(oval.visualStyle.strokeWeight, 0.283);
  assert.equal(oval.visualStyle.cornerRadius, 37.5);
});
