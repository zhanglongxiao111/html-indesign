const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { writeAuthorCssFiles } = require('../../src/writers/html/author-css-writer');
const { pageItemsToAuthorHtml } = require('../../src/writers/html/author-html-tree');
const {
  authorPageGridGeometry,
  gridArea,
  reverseGeometryPlanForPage,
} = require('../../src/writers/html/author-reverse-geometry');
const { tableBoxHeight, tableFrameOverflow } = require('../../src/writers/html/table-html');
const { semanticModelToHtml } = require('../../src/writers/html/visual-html-writer');
const {
  nativeTableBounds,
  tableFrameRowHeightsForInstruction,
  tableRowHeightsForInstruction,
} = require('../../src/writers/indesign/table-instructions');

// #34：observation 反向导出、不带 sourceRoot 的作者包，满版图缩进网格格子、页码跑到左上、
// 文字框被网格行拉高、标题被主图盖住。外框一律以读回 bounds 为准，层级以读回 z 序为准。

const PAGE_WIDTH = 1587.39;
const PAGE_HEIGHT = 892.91;

function coverPage() {
  return {
    id: 'cover-page',
    semantic: 'cover',
    sourceFile: 'pages/00-cover.html',
    sourceNode: {
      tagName: 'section',
      id: 'cover-page',
      classList: ['page', 'cover'],
      attributes: {
        'data-page': 'cover',
        'data-id-column-gutter': '6mm',
        'data-id-row-gutter': '5mm',
        'data-id-margin': '14mm 16mm 10mm 18mm',
      },
    },
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    grid: { columns: 12, rows: 8, columnGutter: 6, rowGutter: 5, baseline: 4 },
    margins: { top: 52.91, right: 60.47, bottom: 37.8, left: 68.03 },
    items: [
      {
        id: 'cover-hero-image',
        role: 'graphic',
        labelStatus: 'accepted',
        sourceNode: { tagName: 'div', id: 'cover-hero-image', classList: ['hero-media'], attributes: {} },
        structure: { parentId: 'cover-page', order: 1 },
        bounds: { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
        zIndex: 32,
      },
      {
        id: 'cover-title',
        role: 'text',
        labelStatus: 'accepted',
        tagName: 'h1',
        sourceNode: {
          tagName: 'h1',
          id: 'cover-title',
          classList: ['cover-title', 'grid-item'],
          attributes: { style: '--grid-col:1;--grid-span:5;--grid-row:2;--grid-row-span:2' },
        },
        structure: { parentId: 'cover-page', order: 2 },
        layout: {
          grid: { col: 1, span: 5, row: 2, rowSpan: 2 },
          cssVars: { '--grid-col': '1', '--grid-span': '5', '--grid-row': '2', '--grid-row-span': '2' },
        },
        // 网格区域的左、上、宽，高度是两行标题（网格区域高 186.39）。
        bounds: { x: 68.03, y: 155.53, width: 594.64, height: 104 },
        content: { text: '冰球场首层平面', runs: [] },
        zIndex: 120,
      },
      {
        id: 'cover-note',
        role: 'text',
        labelStatus: 'accepted',
        tagName: 'p',
        sourceNode: {
          tagName: 'p',
          id: 'cover-note',
          classList: ['note', 'grid-item'],
          attributes: { style: '--grid-col:1;--grid-span:4;--grid-row:5;--grid-row-span:1;height:40mm' },
        },
        structure: { parentId: 'cover-page', order: 3 },
        layout: {
          grid: { col: 1, span: 4, row: 5, rowSpan: 1 },
          cssVars: { '--grid-col': '1', '--grid-span': '4', '--grid-row': '5', '--grid-row-span': '1' },
        },
        // 人在 InDesign 里把框往右挪了：网格区域对不上读回 bounds，退出网格。
        bounds: { x: 300, y: 480, width: 400, height: 30 },
        content: { text: '挪过的说明', runs: [] },
        zIndex: 118,
      },
      {
        id: 'cover-folio',
        role: 'text',
        labelStatus: 'accepted',
        tagName: 'span',
        sourceNode: { tagName: 'span', id: 'cover-folio', classList: ['page-number'], attributes: {} },
        structure: { parentId: 'cover-page', order: 4 },
        bounds: { x: 1515.06, y: 843.12, width: 17.61, height: 12.8 },
        content: { text: '00', runs: [] },
        zIndex: 119,
      },
    ],
  };
}

function coverModel() {
  return {
    kind: 'DocumentModel',
    id: 'geometry-report',
    title: 'Geometry',
    unitMode: 'presentation',
    reverseMode: 'observation',
    sourcePackage: {
      entry: 'deck.html',
      styleFiles: ['styles/layout.css'],
      pageFiles: [{ id: 'cover', file: 'pages/00-cover.html' }],
    },
    styles: {},
    pages: [coverPage()],
  };
}

test('page grid geometry mirrors the author .page grid rule', () => {
  const grid = authorPageGridGeometry(coverPage());
  const title = gridArea(grid, { col: 1, span: 5, row: 2, rowSpan: 2 });
  assert.ok(Math.abs(title.x - 68.03) < 0.05);
  assert.ok(Math.abs(title.y - 155.53) < 0.05);
  assert.ok(Math.abs(title.width - 594.64) < 0.05);
  assert.ok(Math.abs(title.height - 186.39) < 0.05);
});

test('geometry plan keeps fitting grid items, pins their read-back height, and moves the rest to fallback boxes', () => {
  const { boxes } = reverseGeometryPlanForPage(coverPage(), { mode: 'observation' });
  assert.deepEqual(boxes.get('cover-title'), { keepsGrid: true, exitsGrid: false });
  assert.deepEqual(boxes.get('cover-note'), { keepsGrid: false, exitsGrid: true });
  assert.deepEqual(boxes.get('cover-hero-image'), { keepsGrid: false, exitsGrid: false });
  assert.deepEqual(boxes.get('cover-folio'), { keepsGrid: false, exitsGrid: false });

  // 源码样式随包时，有源码节点的对象沿用源码 class 定位，不写兜底。
  const carried = reverseGeometryPlanForPage(coverPage(), { mode: 'observation', sourceLayoutCarried: true });
  assert.equal(carried.boxes.size, 0);
});

test('reverse overrides pin grid text height and give class-positioned objects read-back boxes', () => {
  const css = writeAuthorCssFiles({ pages: [coverPage()] }, { mode: 'observation' })['styles/reverse-overrides.css'];
  assert.ok(css.includes('[id="cover-title"] { align-self:start; height:104px; }'));
  assert.ok(css.includes('[id="cover-hero-image"] { position:absolute; left:0px; top:0px; width:1587.39px; height:892.91px; margin:0; }'));
  assert.ok(css.includes('[id="cover-folio"] { position:absolute; left:1515.06px; top:843.12px; width:17.61px; height:12.8px; margin:0; }'));
  assert.ok(css.includes('[id="cover-note"] { position:absolute; left:300px; top:480px; width:400px; height:30px; margin:0; }'));
});

test('author html drops grid placement from objects that leave the grid and writes read-back z order', () => {
  const html = pageItemsToAuthorHtml(coverPage(), { mode: 'observation' });
  const note = html.match(/<p id="cover-note"[^>]*>/)[0];
  assert.doesNotMatch(note, /grid-item/);
  assert.doesNotMatch(note, /--grid-|height:40mm/);
  assert.match(note, /style="z-index:118"/);
  const title = html.match(/<h1 id="cover-title"[^>]*>/)[0];
  assert.match(title, /class="cover-title grid-item/);
  assert.match(title, /style="--grid-col:1;--grid-span:5;--grid-row:2;--grid-row-span:2;z-index:120"/);

  // 源码样式随包时 class 上已有 z-index，保留源码内联样式原样。
  const carried = pageItemsToAuthorHtml(coverPage(), { mode: 'observation', sourceLayoutCarried: true });
  assert.match(carried, /<h1 id="cover-title"[^>]+style="--grid-col:1;--grid-span:5;--grid-row:2;--grid-row-span:2"/);
});

test('a same-id grid wrapper carries the grid placement of the read-back frame', () => {
  const page = coverPage();
  page.items = [{
    id: 'drawing-pdf-frame',
    role: 'graphic',
    sourceNode: { tagName: 'object', id: 'drawing-pdf-source', classList: ['pdf-source'], attributes: {} },
    sourceAncestorNodes: [{
      tagName: 'div',
      id: 'drawing-pdf-frame',
      classList: ['drawing-frame', 'grid-item', 'grid-frame'],
      attributes: { style: '--grid-col:5;--grid-span:8;--grid-row:1;--grid-row-span:7' },
    }],
    structure: { parentId: 'cover-page', order: 1 },
    bounds: { x: 561.87, y: 52.91, width: 965.05, height: 699.58 },
  }];
  const { boxes } = reverseGeometryPlanForPage(page, { mode: 'observation' });
  assert.equal(boxes.has('drawing-pdf-frame'), false, 'wrapper fits its grid area, stays grid-placed');
});

test('table boxes hold only the read-back rows; a taller text frame is reported as overflow', () => {
  const rows = [{ cells: [] }, { cells: [] }, { cells: [] }];
  const forward = { bounds: { height: 174.72 }, table: { rowHeights: [50.24, 50.24, 50.24], rows } };
  assert.equal(tableBoxHeight(forward), 150.72);
  assert.equal(tableFrameOverflow(forward, 'presentation'), 0);
  // 与正向构建的外框算法互逆。
  assert.equal(nativeTableBounds({ height: tableBoxHeight(forward) }, [50.24, 50.24, 50.24], { unitMode: 'presentation' }).height, 174.72);
  // 人工文本框比表格高：表格仍只按行高排，多出的高度记为文本框溢出，不分摊到行上。
  const human = { bounds: { height: 170.08 }, table: { rowHeights: [14.83, 14.83], rows: rows.slice(0, 2) } };
  assert.equal(tableBoxHeight(human), 29.66);
  assert.equal(tableFrameOverflow(human, 'presentation'), 116.42);
});

function humanTablePage() {
  return {
    id: 'page-1',
    width: 595.28,
    height: 841.89,
    items: [{
      id: '310',
      role: 'table',
      bounds: { x: 396.85, y: 255.12, width: 170.08, height: 170.08 },
      structure: { parentId: 'page-1', order: 1 },
      table: {
        rowHeights: [14.83, 14.83],
        rows: [
          { index: 0, cells: [{ index: 0, text: 'A', padding: { top: 1.417, right: 1.417, bottom: 1.417, left: 1.417 } }] },
          { index: 1, cells: [{ index: 0, text: 'C', padding: { top: 1.417, right: 1.417, bottom: 1.417, left: 1.417 } }] },
        ],
      },
      zIndex: 5,
    }],
  };
}

test('a table in a taller text frame is written inside a frame wrapper that carries the read-back bounds', () => {
  const page = humanTablePage();
  const { boxes } = reverseGeometryPlanForPage(page, { mode: 'observation', unitMode: 'presentation' });
  assert.deepEqual(boxes.get('310'), { keepsGrid: false, exitsGrid: false, tableFrame: true });

  const html = pageItemsToAuthorHtml(page, { mode: 'observation', unitMode: 'presentation' });
  assert.match(html, /^<div id="310" style="z-index:5" data-id-ignore>\n {2}<table /);
  assert.doesNotMatch(html.match(/<table[^>]*>/)[0], /\bid=/, 'the object id sits on the frame wrapper only');
  assert.equal((html.match(/<tr style="height:14\.83px">/g) || []).length, 2);

  const css = writeAuthorCssFiles({ pages: [page] }, { mode: 'observation', unitMode: 'presentation' })['styles/reverse-overrides.css'];
  assert.ok(css.includes('[id="310"] { position:absolute; left:396.85px; top:255.12px; width:170.08px; height:170.08px; margin:0; }'));
  assert.ok(css.includes('.page [data-id-ignore] > table { width: 100%; }'));
});

test('a table already wrapped by its read-back frame is not wrapped twice', () => {
  const page = humanTablePage();
  const item = page.items[0];
  item.sourceNode = { tagName: 'table', id: null, classList: ['id-object'], attributes: {} };
  item.sourceAncestorNodes = [{ tagName: 'div', id: '310', classList: [], attributes: { id: '310', 'data-id-ignore': '', style: 'z-index:5' }, sourcePath: 'div:nth-of-type(1)' }];
  item.sourceNode.sourcePath = 'div:nth-of-type(1)>table:nth-of-type(1)';
  const html = pageItemsToAuthorHtml(page, { mode: 'observation', unitMode: 'presentation' });
  assert.equal((html.match(/<div /g) || []).length, 1);
  assert.equal((html.match(/id="310"/g) || []).length, 1);
  assert.match(html, /<div[^>]+id="310"[^>]*data-id-ignore/);
});

test('forward compile uses declared row heights and keeps the frame big enough for the estimated rows', () => {
  const item = {
    table: {
      rows: [{ index: 0, cells: [{ index: 0 }] }],
      sourceRows: [{ index: 0, authoredHeight: '14.83px', cells: [] }],
    },
  };
  const layout = { unitMode: 'presentation', scale: 1 };
  const rows = [{ index: 0, cells: [{ bounds: { height: 18.31 }, padding: { top: 1.417, bottom: 1.417 }, pointSize: 12 }] }];
  assert.deepEqual(tableRowHeightsForInstruction(item, rows, layout), [14.83]);
  // 保底估算：内边距 + 1.2 倍字号 + 原生行余量。
  assert.deepEqual(tableFrameRowHeightsForInstruction(item, rows, layout), [19.23]);
  const undeclared = { table: { rows: item.table.rows, sourceRows: [{ index: 0, cells: [] }] } };
  assert.deepEqual(tableRowHeightsForInstruction(undeclared, rows, layout), [19.23]);
});

test('reference page keeps paragraph space-before from moving an object frame off its bounds', async () => {
  const html = semanticModelToHtml({
    kind: 'DocumentModel',
    id: 'space-before',
    pages: [{
      id: 'page-1',
      width: 400,
      height: 300,
      items: [{
        id: 'label',
        role: 'text',
        bounds: { x: 20, y: 100, width: 200, height: 14 },
        styleRefs: { paragraphStyle: 'metric-label' },
        content: { text: 'grid length', runs: [] },
      }],
    }],
    styles: {
      paragraphStyles: {
        'metric-label': { name: 'metric-label', safeName: 'metric-label', css: 'font-size:10pt; margin-top:7.56pt' },
      },
    },
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    const top = await page.$eval('#label', (el) => el.getBoundingClientRect().top - el.closest('.page').getBoundingClientRect().top);
    assert.equal(Math.round(top * 100) / 100, 100);
  } finally {
    await browser.close();
  }
});

test('observation author package renders every object on its read-back bounds and z order', async () => {
  const outDir = path.resolve('test/workspace/reverse-author-geometry-test');
  fs.rmSync(outDir, { recursive: true, force: true });
  writeReverseAuthorPackage(coverModel(), { outDir, mode: 'observation' });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    await page.goto(pathToFileURL(path.join(outDir, 'deck.html')).href);
    const rects = await page.evaluate(() => {
      const pageEl = document.querySelector('.page');
      const origin = pageEl.getBoundingClientRect();
      const out = {};
      for (const id of ['cover-hero-image', 'cover-title', 'cover-note', 'cover-folio']) {
        const rect = document.getElementById(id).getBoundingClientRect();
        out[id] = [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100);
      }
      const hit = document.elementFromPoint(origin.x + 100, origin.y + 180);
      out.topAtTitle = hit && hit.closest('[id]') && hit.closest('[id]').id;
      return out;
    });
    assertRect(rects['cover-hero-image'], [0, 0, 1587.39, 892.91]);
    assertRect(rects['cover-title'], [68.03, 155.53, 594.64, 104]);
    assertRect(rects['cover-note'], [300, 480, 400, 30]);
    assertRect(rects['cover-folio'], [1515.06, 843.12, 17.61, 12.8]);
    assert.equal(rects.topAtTitle, 'cover-title', 'title paints above the full-bleed image');
  } finally {
    await browser.close();
  }
});

// 浏览器布局按 1/64px 取整，读回 bounds 两位小数。
function assertRect(actual, expected) {
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= 0.05, `rect ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  });
}
