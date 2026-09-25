const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileDocument } = require('../../src/indesign-pipeline');
const { authorPackageCompileOptions, readAuthorPackage } = require('../../src/authoring');

// 09-26 真机验收：人工 INDD（gradient-sample）反向 -> 作者包 -> 正向。
// 多段文本框不能并成一段、左对齐两端不能变成全部两端对齐、读回列宽要照建、
// 重建文档不多出空图层和凭空合成的命名样式、作者 CSS 不留内置样式规则、淡色与文字描边要带回去。

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

function cell(index, text, extra = {}) {
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
    ...extra,
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

function handmadeSnapshot() {
  return {
    metadata: { sourceDocument: 'handmade.indd', mode: 'structured', coordinateUnit: 'pt' },
    document: { name: 'handmade.indd', labels: [] },
    parentPages: [],
    styles: {
      paragraphStyles: [
        { name: '[无段落样式]', labels: [], css: "font-size:12pt; text-align:justify; color:#000000" },
        { name: '[基本段落]', labels: [], css: "font-size:12pt; text-align:justify; color:#000000" },
        { name: '渐变段落', labels: [], css: "font-family:'Arial',sans-serif; font-size:24pt; text-align:justify; color:#ff0000" },
      ],
      characterStyles: [{ name: '[无]', labels: [], css: '' }, { name: '渐变字符', labels: [], css: 'color:#ff0000' }],
      objectStyles: [
        { name: '[无]', labels: [], css: '' },
        { name: '[基本图形框架]', labels: [], css: 'border:0.283pt solid #000000' },
        { name: '[基本文本框架]', labels: [], css: '' },
        { name: '渐变对象', labels: [], css: 'background-color:#ff0000' },
      ],
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
      bounds: { x: 0, y: 0, width: 595, height: 842 },
      margins: { top: 56, right: 56, bottom: 56, left: 56 },
      guides: [],
      items: [
        item('255', 'Rectangle', { x: 56, y: 56, width: 280, height: 170 }, { visualStyle: visualStyle({ fillColor: '#ff0000' }), zIndex: 0 }),
        // 淡色色板 G-Red 40%：读回 JSX 已折算成等效颜色。
        item('257', 'Oval', { x: 56, y: 450, width: 113, height: 113 }, { visualStyle: visualStyle({ fillColor: '#ff9999', strokeColor: '#000000', strokeWeight: 0.283 }), zIndex: 1 }),
        item('290', 'Rectangle', { x: 396, y: 450, width: 170, height: 113 }, { objectStyleName: '渐变对象', visualStyle: visualStyle({ fillColor: '#ff0000' }), zIndex: 2 }),
        item('286', 'TextFrame', { x: 396, y: 56, width: 170, height: 170 }, {
          paragraphStyleName: '渐变段落',
          objectStyleName: '[基本文本框架]',
          textStyle: textStyle(),
          text: 'Gradient text\rSecond para',
          textRuns: [
            { characterStyle: null, textStyle: textStyle({ justification: null }), text: 'Gradient text\r' },
            { characterStyle: '渐变字符', textStyle: textStyle({ justification: null, pointSize: 12 }), text: 'S' },
            { characterStyle: null, textStyle: textStyle({ justification: null, pointSize: 12, strokeColor: '#000000', strokeWeight: 1 }), text: 'econd para' },
          ],
          zIndex: 3,
        }),
        item('300', 'TextFrame', { x: 56, y: 620, width: 280, height: 60 }, {
          paragraphStyleName: '[基本段落]',
          objectStyleName: '[基本文本框架]',
          textStyle: textStyle({ pointSize: 12, fillColor: '#000000', justification: 'justify-all' }),
          text: 'Full justified line',
          textRuns: [{ characterStyle: null, textStyle: textStyle({ pointSize: 12, fillColor: '#000000', justification: null }), text: 'Full justified line' }],
          zIndex: 4,
        }),
        item('310', 'TextFrame', { x: 396, y: 255, width: 170, height: 170 }, {
          paragraphStyleName: '[基本段落]',
          objectStyleName: '[基本文本框架]',
          textStyle: textStyle({ pointSize: 12, fillColor: '#000000' }),
          text: '\u0016',
          table: {
            tableStyle: '[无表样式]',
            rowCount: 2,
            columnCount: 2,
            columnWidths: [84.685, 84.685],
            rowHeights: [14.835, 14.835],
            rows: [
              { index: 0, cells: [cell(0, 'A', { fillColor: '#ff0000' }), cell(1, 'B')] },
              { index: 1, cells: [cell(0, 'C'), cell(1, '', { paragraphStyle: '' })] },
            ],
          },
          zIndex: 5,
        }),
      ],
    }],
  };
}

function writeHandmadePackage(name) {
  const root = path.resolve('test/workspace', name);
  fs.rmSync(root, { recursive: true, force: true });
  const model = reverseSnapshotToSemanticModel(handmadeSnapshot(), { mode: 'observation' });
  const result = writeReverseAuthorPackage(model, { outDir: root, mode: 'observation' });
  const read = (file) => fs.readFileSync(path.join(result.outDir, file), 'utf8');
  return {
    result,
    pageHtml: result.pages.map((page) => read(page)).join('\n'),
    components: read('styles/components.css'),
  };
}

function openTag(html, id) {
  const match = new RegExp(`<[a-z0-9]+ [^>]*\\bid="${id}"[^>]*>`).exec(html);
  assert.ok(match, `element ${id} should be written`);
  return match[0];
}

test('multi-paragraph text frames are written as a text-role container with one <p> per paragraph', () => {
  const { pageHtml } = writeHandmadePackage('reverse-handmade-paragraphs');
  const frame = openTag(pageHtml, '286');
  assert.match(frame, /^<div /);
  assert.match(frame, /data-id-role="text"/);
  assert.match(frame, /data-id-paragraph-style="渐变段落"/);
  const body = /<div [^>]*\bid="286"[^>]*>([\s\S]*?)<\/div>/.exec(pageHtml)[1];
  const paragraphs = body.match(/<p>[\s\S]*?<\/p>/g) || [];
  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0], '<p>Gradient text</p>');
  assert.match(paragraphs[1], /<span data-id-character-style="渐变字符"[^>]*>S<\/span>/);
  assert.match(paragraphs[1], /-webkit-text-stroke:1px #000000[^>]*>econd para<\/span>/);
  assert.doesNotMatch(body, /<br>/);
});

test('reverse author package writes read-back column widths, text-align-last and no built-in style rules', () => {
  const { pageHtml, components } = writeHandmadePackage('reverse-handmade-css');
  assert.match(pageHtml, /<colgroup>\s*<col style="width:84\.685px">\s*<col style="width:84\.685px">\s*<\/colgroup>/);
  assert.match(pageHtml + components, /text-align:justify;?\s*text-align-last:justify/);
  assert.doesNotMatch(components, /\.(?:pstyle|cstyle|ostyle)-(?:基本段落|无段落样式|无|基本图形框架|基本文本框架|基本网格)\b/);
  assert.match(components, /\.pstyle-渐变段落 \{/);
});

test('handmade INDD roundtrip keeps paragraphs, alignment, column widths, tint and the original style and layer lists', async () => {
  const { result } = writeHandmadePackage('reverse-handmade-roundtrip');
  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  const items = new Map(instructions.pages.flatMap((page) => page.items).map((entry) => [entry.id, entry]));
  const swatch = (name) => instructions.styles.swatches[name] && instructions.styles.swatches[name].value;

  // 段落边界：两段仍是一个文本框，段间是 InDesign 段落结束符。
  const text = items.get('286');
  assert.equal(text.type, 'TEXT');
  assert.equal(text.runs.map((run) => run.text).join(''), 'Gradient text\rSecond para');
  // 对齐：左对齐两端 / 全部两端对齐分开映射。
  assert.equal(instructions.styles.paragraphStyles['渐变段落'].justification, 'justify');
  assert.equal(items.get('300').paragraphStyle, null);
  assert.equal(items.get('300').textOverride.justification, 'justify-all');
  // 列宽按读回声明建。
  assert.deepEqual(items.get('310').columnWidths, [84.69, 84.69]);
  // 淡色等效颜色原样进色板。
  assert.equal(swatch(items.get('257').styleOverride.fillColor), '#ff9999');
  // 图层：只建原件图层，不补预设标准图层。
  assert.deepEqual(instructions.layers.map((layer) => layer.name), ['图层 1']);
  // 样式：原件有的同名保留；原件没样式的对象不凭空建命名样式，外观走局部覆盖。
  assert.deepEqual(Object.keys(instructions.styles.objectStyles), ['渐变对象']);
  assert.deepEqual(Object.keys(instructions.styles.characterStyles), ['渐变字符']);
  assert.deepEqual(Object.keys(instructions.styles.paragraphStyles), ['渐变段落']);
  for (const id of ['255', '257', '310']) assert.equal(items.get(id).objectStyle, null, `${id} keeps no named object style`);
  assert.equal(items.get('290').objectStyle, '渐变对象');
  assert.equal(swatch(items.get('255').styleOverride.fillColor), '#ff0000');
  // 没有字符样式的 run：字号与文字描边写成 run 级局部覆盖。
  const plainRun = text.runs.find((run) => run.text === 'econd para');
  assert.equal(plainRun.characterStyle, null);
  assert.equal(Math.round(plainRun.textOverride.pointSize), 12);
  assert.equal(swatch(plainRun.textOverride.strokeColor), '#000000');
  assert.equal(plainRun.textOverride.strokeWeight, 1);
});
