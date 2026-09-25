const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');

// #34：observation 反向导出的作者包要把读回的颜色、描边、字符样式、大小写写回作者 HTML，
// 再次正向构建才能得到与原稿一致的外观。

function itemLabel(id, extra = {}) {
  return { protocol: 'html-indesign', version: 1, kind: 'item', id, source: 'html-to-indesign', ...extra };
}

function rect(bounds) {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
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

function textStyle(extra = {}) {
  return {
    appliedFont: 'Arial\tRegular',
    fontFamily: 'Arial',
    fontStyleName: 'Regular',
    fontWeight: null,
    fontStyle: null,
    pointSize: 13.3333,
    leading: 20,
    fillColor: '#31454b',
    tracking: 0,
    justification: 'left',
    ...extra,
  };
}

function paintSnapshot() {
  const cardBounds = { x: 100, y: 100, width: 300, height: 180 };
  return {
    metadata: { mode: 'observation' },
    document: {
      name: 'paint.indd',
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'document', id: 'paint-deck', source: 'html-to-indesign', unitMode: 'presentation', coordinateUnit: 'pt' }],
    },
    parentPages: [
      {
        name: 'A-汇报母版',
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'report-parent', source: 'html-to-indesign', displayName: '汇报母版' }],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        guides: [],
        items: [],
      },
      {
        name: '汇报母版-背景-251-250-247',
        labels: [{ protocol: 'html-indesign', version: 1, kind: 'parentPage', id: 'report-parent-251-250-247-800x450', source: 'html-to-indesign', semantic: 'page-background', name: '汇报母版-背景-251-250-247', generated: true }],
        bounds: { x: 0, y: 0, width: 800, height: 450 },
        guides: [],
        items: [{
          id: '900',
          type: 'Rectangle',
          bounds: { x: 0, y: 0, width: 800, height: 450 },
          visualStyle: visualStyle({ fillColor: '#fbfaf7' }),
          labels: [itemLabel('report-parent-251-250-247-800x450-fill', { role: 'background', generated: true })],
        }],
      },
    ],
    pages: [{
      id: '10',
      index: 0,
      appliedParentPageName: '汇报母版-背景-251-250-247',
      bounds: { width: 800, height: 450 },
      labels: [{ protocol: 'html-indesign', version: 1, kind: 'page', id: 'agenda-page', source: 'html-to-indesign', parentPage: { id: 'report-parent', name: '汇报母版' } }],
      items: [
        {
          id: '101',
          type: 'Rectangle',
          bounds: rect(cardBounds),
          visualStyle: visualStyle({ fillColor: '#ffffff', cornerRadius: 4 }),
          labels: [itemLabel('card', { role: 'shape' })],
        },
        {
          id: '102',
          type: 'Rectangle',
          bounds: { x: 100, y: 100, width: 11, height: 180 },
          visualStyle: visualStyle({ fillColor: '#c8102e' }),
          labels: [itemLabel('card-border-left', { role: 'decoration', generated: true })],
        },
        {
          id: '103',
          type: 'Rectangle',
          bounds: { x: 100, y: 100, width: 300, height: 1 },
          visualStyle: visualStyle({ fillColor: '#cfd6d2' }),
          labels: [itemLabel('card-border-top', { role: 'decoration', generated: true })],
        },
        {
          id: '104',
          type: 'Rectangle',
          bounds: { x: 450, y: 100, width: 200, height: 100 },
          visualStyle: visualStyle({ fillColor: '#fbfaf7', fillOpacity: 92, strokeColor: '#cfd6d2', strokeWeight: 1, strokeStyle: '虚线' }),
          labels: [itemLabel('metric', { role: 'shape' })],
        },
        {
          id: '105',
          type: 'TextFrame',
          bounds: { x: 100, y: 300, width: 300, height: 40 },
          text: '流线和 PDF 置入 校核。',
          textStyle: textStyle(),
          textRuns: [
            { characterStyle: null, textStyle: textStyle({ justification: null }), text: '流线和 ' },
            { characterStyle: '术语强调', textStyle: textStyle({ justification: null, fontWeight: '700', fontStyleName: 'Bold', fillColor: '#c8102e' }), text: 'PDF 置入' },
            { characterStyle: null, textStyle: textStyle({ justification: null }), text: ' 校核。' },
          ],
          labels: [itemLabel('agenda-copy', {
            role: 'text',
            htmlTag: 'p',
            sourceNode: { tagName: 'p', id: 'agenda-copy', classList: ['body-copy'], attributes: { id: 'agenda-copy', class: 'body-copy' } },
            sourceText: '流线和 PDF 置入 校核。',
            sourceHtml: '流线和 <span id="agenda-copy-accent" class="accent" data-id-character-style="term-accent">PDF 置入</span> 校核。',
            sourceRuns: [{ text: 'PDF 置入', tagName: 'span', classList: ['accent'], attributes: { id: 'agenda-copy-accent', class: 'accent', 'data-id-character-style': 'term-accent' } }],
          })],
        },
        {
          id: '106',
          type: 'TextFrame',
          bounds: { x: 100, y: 20, width: 200, height: 14 },
          text: 'Contents',
          textStyle: textStyle({ fillColor: '#c8102e', capitalization: 'allCaps' }),
          textRuns: [{ characterStyle: null, textStyle: textStyle({ fillColor: '#c8102e', capitalization: 'allCaps', justification: null }), text: 'Contents' }],
          labels: [],
        },
        {
          id: '107',
          type: 'TextFrame',
          bounds: { x: 450, y: 250, width: 200, height: 60 },
          text: '',
          textStyle: textStyle({ fillColor: '#000000', pointSize: 12, leading: null, justification: 'justify' }),
          table: {
            tableStyle: '[无表样式]',
            rowCount: 1,
            columnCount: 2,
            columnWidths: [100, 100],
            rowHeights: [20],
            rows: [{
              index: 0,
              cells: [
                {
                  index: 0,
                  text: 'A',
                  header: false,
                  rowSpan: 1,
                  colSpan: 1,
                  fillColor: '#ff0000',
                  textColor: '#000000',
                  pointSize: 12,
                  textAlign: 'justify',
                  textStyle: textStyle({ fillColor: '#000000', pointSize: 12, leading: null, justification: 'justify' }),
                  padding: { top: 1.4173, right: 1.4173, bottom: 1.4173, left: 1.4173 },
                  borders: {
                    top: { color: '#000000', borderWeight: 0.7087 },
                    right: { color: '#000000', borderWeight: 0.7087 },
                    bottom: { color: '#ff0000', borderWeight: 2 },
                    left: { color: '#000000', borderWeight: 0.7087 },
                  },
                  runs: [],
                },
                {
                  index: 1,
                  text: 'B',
                  header: false,
                  rowSpan: 1,
                  colSpan: 1,
                  fillColor: null,
                  textColor: '#ff0000',
                  pointSize: 12,
                  textAlign: 'justify',
                  textStyle: textStyle({ fillColor: '#ff0000', pointSize: 12, leading: null, justification: 'justify' }),
                  runs: [],
                },
              ],
            }],
          },
          labels: [],
        },
      ],
    }],
    styles: {},
    layers: [],
    assets: [],
  };
}

function writePaintPackage(name) {
  const outDir = path.resolve('test/workspace', name);
  fs.rmSync(outDir, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel(paintSnapshot(), { mode: 'observation' });
  writeReverseAuthorPackage(model, { outDir, mode: 'observation' });
  const pageFile = fs.readdirSync(path.join(outDir, 'pages')).find((file) => file.endsWith('.html'));
  return {
    model,
    pageHtml: fs.readFileSync(path.join(outDir, 'pages', pageFile), 'utf8'),
    tokens: fs.readFileSync(path.join(outDir, 'styles/tokens.css'), 'utf8'),
    layout: fs.readFileSync(path.join(outDir, 'styles/layout.css'), 'utf8'),
    overrides: fs.readFileSync(path.join(outDir, 'styles/reverse-overrides.css'), 'utf8'),
    components: fs.readFileSync(path.join(outDir, 'styles/components.css'), 'utf8'),
  };
}

function openTag(html, id) {
  const match = new RegExp(`<[a-z0-9]+ [^>]*\\bid="${id}"[^>]*>`).exec(html);
  assert.ok(match, `element ${id} should be written`);
  return match[0];
}

test('reverse model reads page background from the generated page-background parent page (#34)', () => {
  const model = reverseSnapshotToSemanticModel(paintSnapshot(), { mode: 'observation' });
  const page = model.pages[0];
  assert.equal(page.parentPageId, 'report-parent');
  assert.deepEqual(page.visualStyle, { fillColor: '#fbfaf7' });
});

test('reverse model attaches read-back run appearance to label source runs (#34)', () => {
  const model = reverseSnapshotToSemanticModel(paintSnapshot(), { mode: 'observation' });
  const copy = model.pages[0].items.find((item) => item.id === 'agenda-copy');
  assert.equal(copy.content.runs.length, 1);
  assert.equal(copy.content.runs[0].attributes.id, 'agenda-copy-accent');
  assert.equal(copy.content.runs[0].textStyle.fillColor, '#c8102e');
  assert.equal(copy.content.runs[0].textStyle.fontWeight, '700');
});

test('observation author package folds border objects back into the container CSS border (#34)', () => {
  const { pageHtml, overrides } = writePaintPackage('reverse-paint-borders');
  const card = openTag(pageHtml, 'card');
  assert.match(card, /border-top:1px solid #cfd6d2;border-right:0 solid transparent;border-bottom:0 solid transparent;border-left:11px solid #c8102e/);
  assert.doesNotMatch(card, /border:0 solid transparent/);
  assert.doesNotMatch(pageHtml, /card-border-(left|top)/);
  assert.doesNotMatch(overrides, /card-border-(left|top)/);
});

test('observation author package writes page background, fill opacity and dashed strokes (#34)', () => {
  const { pageHtml, tokens, layout, components } = writePaintPackage('reverse-paint-page');
  assert.match(tokens, /--id-page-bg: #fbfaf7;/);
  assert.doesNotMatch(openTag(pageHtml, 'agenda-page'), /--id-page-bg/);
  // 填充不透明度和虚线描边随合成对象样式写进 class，内联不再重复。
  const metricClass = /synth-(synth_object_\d+)/.exec(openTag(pageHtml, 'metric'))[1];
  const rule = new RegExp(`\\.synth-${metricClass} \\{([^}]*)\\}`).exec(components)[1];
  assert.match(rule, /background-color:rgba\(251,250,247,0\.92\)/);
  assert.match(rule, /border:1px dashed #cfd6d2/);
  assert.match(layout, /border-collapse: collapse/);
});

test('observation author package writes character-level appearance and capitalization (#34)', () => {
  const { pageHtml, components } = writePaintPackage('reverse-paint-text');
  assert.match(pageHtml, /<span id="agenda-copy-accent" class="accent" data-id-character-style="term-accent" style="font-weight:700;color:#c8102e">PDF 置入<\/span>/);
  // 大小写进了合成文字样式：同样式对象共用 class，内联只留 class 覆盖不到的部分。
  const eyebrowClass = /synth-(synth_text_\d+)/.exec(openTag(pageHtml, '106'))[1];
  assert.match(components, new RegExp(`\\.synth-${eyebrowClass} \\{[^}]*text-transform:uppercase`));
});

test('observation author package writes table cell fill, text color and edges (#34)', () => {
  const { pageHtml } = writePaintPackage('reverse-paint-table');
  const cells = pageHtml.match(/<td[^>]*>/g) || [];
  assert.equal(cells.length, 2);
  assert.match(cells[0], /background-color:#ff0000/);
  assert.match(cells[0], /border-bottom:2px solid #ff0000/);
  assert.match(cells[0], /border-top:0\.709px solid #000000/);
  assert.doesNotMatch(cells[0], /color:#000000;/);
  assert.match(cells[1], /color:#ff0000/);
  assert.doesNotMatch(cells[1], /background-color/);
});

test('unlabelled runs whose appearance differs from the paragraph get an inline style (#34)', () => {
  const { ownContent } = require('../../src/writers/html/author-rich-text-renderer');
  const paragraph = textStyle({ pointSize: 24, fillColor: '#ff0000' });
  const item = {
    id: '286',
    role: 'text',
    textStyle: paragraph,
    content: {
      text: 'Gradient text\nSecond',
      runs: [
        { text: 'Gradient text\n', characterStyle: null, textStyle: textStyle({ pointSize: 24, fillColor: '#ff0000', justification: null }) },
        { text: 'S', characterStyle: '渐变字符', textStyle: textStyle({ pointSize: 12, fillColor: '#ff0000', justification: null }) },
        { text: 'econd', characterStyle: null, textStyle: textStyle({ pointSize: 12, fillColor: '#ff0000', justification: null }) },
      ],
    },
  };

  assert.equal(
    ownContent(item, 0, { writeRunStyles: true }),
    'Gradient text<br><span class="cstyle-渐变字符" data-id-character-style="渐变字符" style="font-size:12px">S</span><span style="font-size:12px">econd</span>',
  );
  // 保留可信源码时不写读回外观。
  assert.equal(
    ownContent(item, 0, { writeRunStyles: false }),
    'Gradient text<br><span class="cstyle-渐变字符" data-id-character-style="渐变字符">S</span>econd',
  );
});
