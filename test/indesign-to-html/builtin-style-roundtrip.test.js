const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { reverseSnapshotToSemanticModel } = require('../../src/adapters/indesign');
const { writeReverseAuthorPackage } = require('../../src/writers/html');
const { renderSnapshot } = require('../../src/adapters/html');
const { compileDocument } = require('../../src/indesign-pipeline');
const { authorPackageCompileOptions, readAuthorPackage } = require('../../src/authoring');
const { auditAuthorSourceRoundtrip } = require('../../src/writers/html/audit/source-roundtrip-diff');
const { isIndesignBuiltinStyleName } = require('../../src/shared/style-utils');

// #21：人类做的 INDD 里表格/单元格/文字常挂着 InDesign 内置样式（中英文界面名字不同）。
// 内置名表示“沿用默认”，反向不能把它写进作者 HTML，正向也不能洗掉方括号后新建同名用户样式。
const BUILTIN_IN_HTML = /\[(?:基本段落|无段落样式|无|基本表|无表样式|基本文本框架|基本图形框架|Basic Paragraph|No Paragraph Style|None|Basic Table|No Table Style|Basic Text Frame|Basic Graphics Frame)\]/;
const CLONED_BUILTIN = /^(?:基本段落|无段落样式|无|基本表|无表样式|基本文本框架|基本图形框架|Basic-Paragraph|No-Paragraph-Style|None|Basic-Table|No-Table-Style|Basic-Text-Frame|Basic-Graphics-Frame)$/;

test('isIndesignBuiltinStyleName covers Chinese and English built-in names and nothing user-named', () => {
  for (const name of [
    '[基本段落]', '[Basic Paragraph]', '[无段落样式]', '[No Paragraph Style]',
    '[无]', '[None]', '[基本表]', '[Basic Table]', '[无表样式]', '[No Table Style]',
    '[基本文本框架]', '[Basic Text Frame]', '[基本图形框架]', '[Basic Graphics Frame]',
    '[基本网格]', '[Basic Grid]', '  [基本段落]  ',
  ]) {
    assert.equal(isIndesignBuiltinStyleName(name), true, name);
  }
  for (const name of ['基本段落', '表格正文', '[表格正文]', '', null, undefined]) {
    assert.equal(isIndesignBuiltinStyleName(name), false, String(name));
  }
});

test('reverse drops built-in table, cell, cell paragraph and run character styles from the model', () => {
  const model = reverseSnapshotToSemanticModel(builtinTableSnapshot(), { mode: 'observation' });
  const table = model.pages[0].items.find((item) => item.role === 'table');
  assert.ok(table, 'table item exists');

  assert.equal(table.table.tableStyle, null, '[基本表] is not a table style ref');
  assert.equal(table.styleRefs.tableStyle, null);
  const cells = table.table.rows.flatMap((row) => row.cells);
  assert.deepEqual(cells.map((cell) => cell.paragraphStyle), [null, null, null, '表格正文']);
  assert.deepEqual(cells.map((cell) => cell.cellStyle), [null, null, null, '强调单元格']);
  assert.equal(cells[1].runs[0].characterStyle, null, '[None] run character style is dropped');
  assert.equal(cells[3].runs[0].characterStyle, '强调', 'real run character style survives');

  const text = model.pages[0].items.find((item) => item.id === 'note');
  assert.equal(text.content.runs[0].characterStyle, null, '[无] text run character style is dropped');
});

test('built-in styles survive reverse -> forward without cloning user styles (#21)', async () => {
  const root = path.resolve('test/workspace/builtin-style-roundtrip');
  fs.rmSync(root, { recursive: true, force: true });

  // 反向：作者 HTML 里不出现任何内置样式名，也不出现由内置名洗出来的样式类。
  const model = reverseSnapshotToSemanticModel(builtinTableSnapshot(), { mode: 'observation' });
  const result = writeReverseAuthorPackage(model, { outDir: path.join(root, 'round1'), mode: 'observation' });
  const pageHtml = result.pages.map((page) => fs.readFileSync(path.join(result.outDir, page), 'utf8')).join('\n');
  assert.doesNotMatch(pageHtml, BUILTIN_IN_HTML);
  assert.doesNotMatch(pageHtml, /(?:tstyle|pstyle|cstyle|cellstyle)-(?:基本表|基本段落|无|None|Basic)/);
  assert.match(pageHtml, /data-id-paragraph-style="表格正文"/, 'real cell paragraph style is written');

  // 正向：内置名不新建用户样式，单元格段落样式置空沿用 InDesign 默认。
  const sourcePackage = readAuthorPackage(result.configPath);
  const snapshot = await renderSnapshot({ htmlPath: sourcePackage.entryPath });
  const { instructions } = compileDocument(snapshot, authorPackageCompileOptions(sourcePackage).document);
  for (const [kind, collection] of Object.entries(instructions.styles)) {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) continue;
    assert.deepEqual(Object.keys(collection).filter((name) => CLONED_BUILTIN.test(name)), [], `${kind} clones no built-in style`);
  }
  const table = instructions.pages.flatMap((page) => page.items).find((item) => item.type === 'TABLE');
  assert.ok(table, 'table is compiled');
  assert.deepEqual(table.rows.flatMap((row) => row.cells).map((cell) => cell.paragraphStyle), [null, null, null, '表格正文']);
});

test('roundtrip audit treats a leftover built-in cell paragraph style as equal to none', () => {
  const root = path.resolve('test/workspace/builtin-style-roundtrip-audit');
  const sourceRoot = path.join(root, 'source');
  const reverseRoot = path.join(root, 'reverse');
  fs.rmSync(root, { recursive: true, force: true });
  // 旧版反向包（或手写源码）里单元格仍带 [基本段落]，新一轮回读已不再写出。
  writePackage(sourceRoot, tablePage('data-id-paragraph-style="[基本段落]"', 'data-id-paragraph-style="[Basic Paragraph]"'));
  writePackage(reverseRoot, tablePage('', ''));

  const audit = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });
  assert.deepEqual(audit.errors.map((issue) => issue.code), []);
  assert.equal(audit.ok, true);

  // 真实的用户样式变化仍然要报。
  writePackage(reverseRoot, tablePage('data-id-paragraph-style="基本段落"', ''));
  const changed = auditAuthorSourceRoundtrip({ sourceRoot, reverseRoot });
  assert.deepEqual(changed.errors.map((issue) => issue.code), ['ROUNDTRIP_TABLE_CELL_STYLE_CHANGED']);
});

function builtinTableSnapshot() {
  const cell = (index, text, paragraphStyle, cellStyle, characterStyle = null) => ({
    index,
    text,
    header: false,
    rowSpan: 1,
    colSpan: 1,
    paragraphStyle,
    cellStyle,
    pointSize: 10,
    leading: 14,
    textColor: '#000000',
    runs: [{ text, characterStyle, textStyle: { pointSize: 10 } }],
  });
  return {
    metadata: { sourceDocument: 'builtin-styles.indd', mode: 'observation' },
    document: { name: 'builtin-styles.indd', labels: [] },
    styles: {
      paragraphStyles: [
        { name: '[No Paragraph Style]', labels: [], css: '' },
        { name: '[基本段落]', labels: [], css: 'font-size:12pt' },
        { name: '表格正文', labels: [], css: 'font-size:10pt' },
      ],
      characterStyles: [{ name: '[无]', labels: [], css: '' }, { name: '强调', labels: [], css: 'font-weight:bold' }],
      tableStyles: [{ name: '[基本表]', labels: [] }],
      cellStyles: [{ name: '[无]', labels: [] }, { name: '强调单元格', labels: [] }],
    },
    pages: [{
      id: '1',
      index: 0,
      labels: [],
      bounds: { x: 0, y: 0, width: 800, height: 450 },
      items: [
        {
          id: 'metrics',
          type: 'TextFrame',
          bounds: { x: 80, y: 100, width: 400, height: 40 },
          text: '\u0016',
          labels: [],
          paragraphStyleName: '[基本段落]',
          objectStyleName: '[基本文本框架]',
          table: {
            tableStyle: '[基本表]',
            rowCount: 1,
            columnCount: 4,
            columnWidths: [100, 100, 100, 100],
            rowHeights: [40],
            rows: [{
              index: 0,
              cells: [
                cell(0, 'Area', '[基本段落]', '[无]'),
                cell(1, 'Ratio', '[Basic Paragraph]', '[None]', '[None]'),
                cell(2, 'Rink', '[No Paragraph Style]', '[无]'),
                cell(3, '32%', '表格正文', '强调单元格', '强调'),
              ],
            }],
          },
        },
        {
          id: 'note',
          type: 'TextFrame',
          bounds: { x: 80, y: 200, width: 400, height: 40 },
          text: 'Observed note',
          labels: [],
          paragraphStyleName: '[基本段落]',
          objectStyleName: '[无]',
          textRuns: [{ text: 'Observed note', characterStyle: '[无]', textStyle: { pointSize: 12 } }],
        },
      ],
    }],
  };
}

function tablePage(firstAttr, secondAttr) {
  const attr = (value) => (value ? ` ${value}` : '');
  return `<section class="page"><table><tbody><tr><td${attr(firstAttr)}>Area</td><td${attr(secondAttr)}>Ratio</td></tr></tbody></table></section>`;
}

function writePackage(root, pageHtml) {
  fs.mkdirSync(path.join(root, 'pages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'deck.config.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'builtin-roundtrip',
    title: 'Builtin Roundtrip',
    profile: 'roundtrip',
    entry: 'deck.html',
    styles: [],
    pages: [{ id: 'page-1', file: 'pages/01-page.html' }],
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(root, 'pages/01-page.html'), pageHtml, 'utf8');
}
