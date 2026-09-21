// 回归：InDesign 逐字读回的特殊字符代号要翻译回字符本身，否则保真门禁会误报 FORWARD_TEXT_RUNS_CHANGED。
// 现场（2026-09-16，html-indesign 0.2.11）：QB 模板每页页脚 "SA Architects©" 被读成
// "SA ArchitectsCOPYRIGHT_SYMBOL"（32 处），SA 样式模板 "• 条件一：" 被读成
// "BULLET_CHARACTER 条件一："（5 处）。同事为了过门禁，把模板里的 © 和 • 全删了。
// 这张对照表以前是同事撞上一个就补一个（07-15 补了破折号、引号、度数）。现在的表按 InDesign
// 实测结果一次收全，本文件负责：表必须和实测一致，JSX 端和 Node 端必须一致。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  INDESIGN_SPECIAL_CHARACTER_CODES,
  decodeSpecialCharacterNames,
} = require('../../src/adapters/indesign/special-characters');

const PROBE = require('../fixtures/indesign-special-characters/probe-indesign-20.0.1.32.json');

// 排版标记：属于版面结构，不是文字。有意保留代号不翻译。
const MARKERS = [
  'AUTO_PAGE_NUMBER', 'NEXT_PAGE_NUMBER', 'PREVIOUS_PAGE_NUMBER', 'TEXT_VARIABLE', 'SECTION_MARKER',
  'COLUMN_BREAK', 'FRAME_BREAK', 'PAGE_BREAK', 'ODD_PAGE_BREAK', 'EVEN_PAGE_BREAK',
  'INDENT_HERE_TAB', 'RIGHT_INDENT_TAB', 'END_NESTED_STYLE',
];

const char = (code) => String.fromCharCode(code);
const hex = (code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;

function loadReverseTextContext() {
  const source = fs.readFileSync(path.resolve('_indesign_scripts/lib/hi_reverse_text.jsxinc'), 'utf8');
  const context = { HI: {} };
  vm.runInNewContext(source, context);
  return context;
}

// —— 表与 InDesign 实测一致 ——

test('对照表逐条等于 InDesign 实测：除排版标记外，每个会读成代号的枚举成员都收进来了', () => {
  const expected = {};
  for (const member of PROBE.members) {
    if (member.codes.length !== 1 || MARKERS.includes(member.name)) continue;
    // 只收逐字读回确实给出代号的成员；不给代号的本来就不会出问题。
    if (member.singleCharacterReadback !== member.name) continue;
    expected[member.name] = hex(parseInt(member.codes[0].slice(2), 16));
  }
  const actual = Object.fromEntries(
    Object.entries(INDESIGN_SPECIAL_CHARACTER_CODES).map(([name, code]) => [name, hex(code)]),
  );

  assert.deepEqual(actual, expected);
  assert.equal(Object.keys(actual).length, 50);
});

test('排版标记确实在实测里存在，且有意不翻译', () => {
  const probed = new Set(PROBE.members.map((member) => member.name));
  for (const name of MARKERS) {
    assert.ok(probed.has(name), `${name} 应是实测枚举成员`);
    assert.equal(name in INDESIGN_SPECIAL_CHARACTER_CODES, false, `${name} 是排版标记，不应翻译`);
  }
  // 64 = 50 个文字 + 13 个标记 + FOOTNOTE_SYMBOL（插不进普通文本框，实测无码位）
  assert.equal(PROBE.members.length, 64);
});

test('设计稿里的普通文字写进 InDesign 后读成的每个代号，都能被翻译或属于排版标记', () => {
  const uncovered = PROBE.asText
    .filter((row) => /^[A-Z][A-Z0-9_]+$/.test(String(row.singleCharacterReadback || '')))
    .map((row) => row.singleCharacterReadback)
    .filter((name) => !(name in INDESIGN_SPECIAL_CHARACTER_CODES) && !MARKERS.includes(name));

  assert.deepEqual(uncovered, []);
});

// —— JSX 端与 Node 端一致 ——

test('JSX 端 HI.SPECIAL_CHARACTER_CODES 与 Node 端表完全一致', () => {
  const context = loadReverseTextContext();
  // vm 里对象的原型链不同，按普通对象重新拷一份再比。
  const jsxTable = JSON.parse(JSON.stringify(context.HI.SPECIAL_CHARACTER_CODES));

  assert.deepEqual(jsxTable, { ...INDESIGN_SPECIAL_CHARACTER_CODES });
});

test('JSX 与 Node 对同一批输入的翻译结果逐条一致', () => {
  const context = loadReverseTextContext();
  const samples = [
    ...Object.keys(INDESIGN_SPECIAL_CHARACTER_CODES),
    ...MARKERS,
    'PARAGRAPH_BREAK',
    'SA ArchitectsCOPYRIGHT_SYMBOL',
    '人群EM_DASHEM_DASH一份',
    'aFIXED_WIDTH_NONBREAKING_SPACEb',
    '普通文字，没有代号',
    '',
  ];
  for (const sample of samples) {
    assert.equal(context.HI.reverseTextValue(sample), decodeSpecialCharacterNames(sample), `样本 ${sample}`);
  }
});

// —— 翻译行为 ——

test('现场两例：© 与 • 翻译回字符本身', () => {
  assert.equal(decodeSpecialCharacterNames('SA ArchitectsCOPYRIGHT_SYMBOL'), 'SA Architects©');
  assert.equal(decodeSpecialCharacterNames('BULLET_CHARACTER 条件一：'), '• 条件一：');
});

test('07-15 那批（大兴项目）：粘连的代号也能拆开翻译', () => {
  assert.equal(decodeSpecialCharacterNames('人群EM_DASHEM_DASH一份'), '人群——一份');
  assert.equal(decodeSpecialCharacterNames('P.19EN_DASH20'), 'P.19–20');
  assert.equal(decodeSpecialCharacterNames('旋转 8DEGREE_SYMBOL'), '旋转 8°');
  assert.equal(
    decodeSpecialCharacterNames('DOUBLE_STRAIGHT_QUOTE潮汐书房DOUBLE_STRAIGHT_QUOTE'),
    '"潮汐书房"',
  );
});

test('长名优先：FIXED_WIDTH_NONBREAKING_SPACE 不会被拆成 FIXED_WIDTH_ + NONBREAKING_SPACE', () => {
  const decoded = decodeSpecialCharacterNames('aFIXED_WIDTH_NONBREAKING_SPACEb');

  assert.deepEqual([...decoded].map((ch) => hex(ch.codePointAt(0))), ['U+0061', hex(0x202F), 'U+0062']);
});

test('每个代号单独出现时都翻译成实测码位', () => {
  for (const [name, code] of Object.entries(INDESIGN_SPECIAL_CHARACTER_CODES)) {
    assert.equal(decodeSpecialCharacterNames(name), char(code), name);
  }
});

test('排版标记保持原样；PARAGRAPH_BREAK 维持历史行为按换行处理', () => {
  for (const name of MARKERS) assert.equal(decodeSpecialCharacterNames(name), name);
  assert.equal(decodeSpecialCharacterNames('一PARAGRAPH_BREAK二'), '一\n二');
  assert.equal(decodeSpecialCharacterNames('一FORCED_LINE_BREAK二'), '一\n二');
});

test('没有代号的文字原样返回；空值不报错', () => {
  assert.equal(decodeSpecialCharacterNames('普通文字 plain text 123'), '普通文字 plain text 123');
  assert.equal(decodeSpecialCharacterNames(''), '');
  assert.equal(decodeSpecialCharacterNames(null), '');
  assert.equal(decodeSpecialCharacterNames(undefined), '');
});

// —— JSX 逐字读取路径：复现现场 ——

test('HI.reverseTextRuns 逐字读到代号时，拼出的 run 文字是字符本身', () => {
  const context = loadReverseTextContext();
  // InDesign 里特殊字符的 contents 是枚举对象，String() 之后是它的名字。
  const enumValue = (name) => ({ toString: () => name });
  const characters = [...'SA Architects'].map((ch) => ({ contents: ch }));
  characters.push({ contents: enumValue('COPYRIGHT_SYMBOL') });

  Object.assign(context.HI, {
    isTextFrame: () => true,
    collectionElements: (collection) => collection,
    reverseCharacterRun: () => ({ characterStyle: null }),
    reverseCharacterRunSignature: () => 'same-style',
  });

  const runs = context.HI.reverseTextRuns({ characters });

  assert.equal(runs.length, 1);
  assert.equal(runs[0].text, 'SA Architects©');
});
