const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { justificationFor } = require('../../src/style-synthesis/text-style-mapping');
const { justificationCss, textStrokeCss } = require('../../src/writers/html/css-values');
const { textForInstruction } = require('../../src/writers/indesign/text-instructions');
const { tableColumnWidthsForInstruction } = require('../../src/writers/indesign/table-instructions');

// 09-26 人工 INDD 往返：左对齐两端（LEFT_JUSTIFIED）就是 CSS text-align:justify（末行靠起始边），
// 全部两端对齐要带 text-align-last:justify；两端互逆，正向不再把 justify 建成 FULLY_JUSTIFIED。

test('CSS alignment maps to canonical justification including text-align-last variants', () => {
  assert.equal(justificationFor({ textAlign: 'justify', textAlignLast: 'auto' }), 'justify');
  assert.equal(justificationFor({ textAlign: 'justify', textAlignLast: 'start' }), 'justify');
  assert.equal(justificationFor({ textAlign: 'justify', textAlignLast: 'justify' }), 'justify-all');
  assert.equal(justificationFor({ textAlign: 'justify', textAlignLast: 'center' }), 'justify-center');
  assert.equal(justificationFor({ textAlign: 'justify', textAlignLast: 'end' }), 'justify-right');
  assert.equal(justificationFor({ textAlign: 'center', textAlignLast: 'justify' }), 'center');
  assert.equal(justificationFor({}), 'left');
});

test('canonical justification writes back to the same CSS pair', () => {
  for (const [value, css] of [
    ['justify', 'text-align:justify'],
    ['justify-all', 'text-align:justify;text-align-last:justify'],
    ['justify-center', 'text-align:justify;text-align-last:center'],
    ['justify-right', 'text-align:justify;text-align-last:right'],
    ['center', 'text-align:center'],
  ]) {
    assert.equal(justificationCss(value), css);
    const [, align] = /text-align:([a-z]+)/.exec(css);
    const last = (/text-align-last:([a-z]+)/.exec(css) || [])[1];
    assert.equal(justificationFor({ textAlign: align, textAlignLast: last }), value);
  }
  assert.equal(textStrokeCss({ strokeColor: '#000000', strokeWeight: 0.5 }), '-webkit-text-stroke:0.5px #000000');
  assert.equal(textStrokeCss({ strokeColor: '#000000', strokeWeight: 0 }), '');
});

test('InDesign executor maps justify to LEFT_JUSTIFIED and the text-align-last variants to the justified enums', () => {
  const context = {
    HI: {},
    Justification: {
      LEFT_ALIGN: 'LEFT_ALIGN', CENTER_ALIGN: 'CENTER_ALIGN', RIGHT_ALIGN: 'RIGHT_ALIGN', LEFT_JUSTIFIED: 'LEFT_JUSTIFIED',
      FULLY_JUSTIFIED: 'FULLY_JUSTIFIED', CENTER_JUSTIFIED: 'CENTER_JUSTIFIED', RIGHT_JUSTIFIED: 'RIGHT_JUSTIFIED',
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_styles.jsxinc'), 'utf8'), context);
  const { HI } = context;
  assert.equal(HI.justificationFor('justify'), 'LEFT_JUSTIFIED');
  assert.equal(HI.justificationFor('justify-all'), 'FULLY_JUSTIFIED');
  assert.equal(HI.justificationFor('justify-center'), 'CENTER_JUSTIFIED');
  assert.equal(HI.justificationFor('justify-right'), 'RIGHT_JUSTIFIED');
  assert.equal(HI.justificationFor('left'), 'LEFT_ALIGN');
});

test('observed paragraph-frame source HTML compiles paragraph boundaries to InDesign paragraph returns', () => {
  const item = {
    sourceNode: { attributes: { class: 'observed-text' }, classList: ['observed-text'] },
    sourceHtml: '\n  <p>First<br>line two</p>\n  <p><span>Second</span> para</p>\n',
  };
  assert.equal(textForInstruction(item, { text: 'ignored' }), 'First\nline two\rSecond para');
});

test('declared <col> widths drive the InDesign column widths instead of browser cell geometry', () => {
  const rows = [{ index: 0, cells: [
    { index: 0, colSpan: 1, bounds: { width: 86.82 } },
    { index: 1, colSpan: 1, bounds: { width: 83.26 } },
  ] }];
  const layout = { unitMode: 'presentation', scale: 1 };
  const item = { bounds: { width: 170.08 }, table: { rows, sourceColumnWidths: ['84.685px', '84.685px'] } };
  // 声明列宽按作者长度精度保留（84.685，不再舍成 84.69）：读回写出的列宽往返不变。
  assert.deepEqual(tableColumnWidthsForInstruction(item, rows, layout), [84.685, 84.685]);
  const mismatched = { bounds: { width: 170.08 }, table: { rows, sourceColumnWidths: ['84.685px'] } };
  assert.deepEqual(tableColumnWidthsForInstruction(mismatched, rows, layout), [86.82, 83.26]);
});
