// InDesign 按单个字符读取（character.contents）时，特殊字符拿到的不是字符本身，而是
// SpecialCharacters 枚举名，比如 "COPYRIGHT_SYMBOL"；按整段读取拿到的才是真实字符。
// 这张表把枚举名翻译回字符，让逐字读回和整段读回的结果一致。
//
// 出处：2026-09-21 在 InDesign 20.0.1.32 上用 scripts/probe-indesign-special-characters.jsx
// 实测，原始结果在 test/fixtures/indesign-special-characters/probe-indesign-20.0.1.32.json。
// 64 个枚举成员里，63 个逐字读回时给的是枚举名（FOOTNOTE_SYMBOL 插不进普通文本框）。
// 设计稿里的普通文字写进 InDesign 后，55/56 个字符逐字读回也会变成枚举名。
// 这张表以前只有十来条，都是同事撞上一个才补一个：07-15 补了破折号、引号、度数，
// 09-16 又撞上 © 和 •。对不上的逐字读回会让保真门禁误报 FORWARD_TEXT_RUNS_CHANGED，
// 同事为了过门禁只好删掉模板里的 © 和 •。
//
// 只收文字：设计稿里能打出来的符号、空格、连字符和零宽字符，共 50 个。
// 自动页码、章节标记、分页/分栏符、"在此缩进"等 13 个排版标记保留枚举名不翻译。它们
// 属于版面结构而不是文字，HTML 正向构建不会产生；反向导出时，保留枚举名也比塞进一个
// 控制字符好读。
//
// 表里写码位数字，不写 \u 转义也不写字符本身：零宽字符和方向控制符在源码里肉眼看不见，
// 用码位写就不会混进源码；也方便和探针结果里的 U+XXXX 逐条核对。
//
// 必须和 _indesign_scripts/lib/hi_reverse_text.jsxinc 里的 HI.SPECIAL_CHARACTER_CODES 一致，
// 由 test/indesign-executor/special-characters.test.js 检查。
const INDESIGN_SPECIAL_CHARACTER_CODES = Object.freeze({
  BULLET_CHARACTER: 0x2022,
  COPYRIGHT_SYMBOL: 0x00A9,
  DEGREE_SYMBOL: 0x00B0,
  ELLIPSIS_CHARACTER: 0x2026,
  FORCED_LINE_BREAK: 0x000A,
  PARAGRAPH_SYMBOL: 0x00B6,
  REGISTERED_TRADEMARK: 0x00AE,
  SECTION_SYMBOL: 0x00A7,
  TRADEMARK_SYMBOL: 0x2122,
  EM_DASH: 0x2014,
  EN_DASH: 0x2013,
  DISCRETIONARY_HYPHEN: 0x00AD,
  NONBREAKING_HYPHEN: 0x2011,
  DOUBLE_LEFT_QUOTE: 0x201C,
  DOUBLE_RIGHT_QUOTE: 0x201D,
  SINGLE_LEFT_QUOTE: 0x2018,
  SINGLE_RIGHT_QUOTE: 0x2019,
  EM_SPACE: 0x2003,
  EN_SPACE: 0x2002,
  FLUSH_SPACE: 0x2001,
  HAIR_SPACE: 0x200A,
  NONBREAKING_SPACE: 0x00A0,
  THIN_SPACE: 0x2009,
  FIGURE_SPACE: 0x2007,
  PUNCTUATION_SPACE: 0x2008,
  LEFT_TO_RIGHT_EMBEDDING: 0x202A,
  RIGHT_TO_LEFT_EMBEDDING: 0x202B,
  POP_DIRECTIONAL_FORMATTING: 0x202C,
  LEFT_TO_RIGHT_OVERRIDE: 0x202D,
  RIGHT_TO_LEFT_OVERRIDE: 0x202E,
  DOTTED_CIRCLE: 0x25CC,
  ZERO_WIDTH_JOINER: 0x200D,
  SINGLE_STRAIGHT_QUOTE: 0x0027,
  DOUBLE_STRAIGHT_QUOTE: 0x0022,
  DISCRETIONARY_LINE_BREAK: 0x200B,
  ZERO_WIDTH_NONJOINER: 0x200C,
  THIRD_SPACE: 0x2004,
  QUARTER_SPACE: 0x2005,
  SIXTH_SPACE: 0x2006,
  FIXED_WIDTH_NONBREAKING_SPACE: 0x202F,
  HEBREW_MAQAF: 0x05BE,
  HEBREW_GERESH: 0x05F3,
  HEBREW_GERSHAYIM: 0x05F4,
  ARABIC_KASHIDA: 0x0640,
  ARABIC_COMMA: 0x060C,
  ARABIC_SEMICOLON: 0x061B,
  ARABIC_QUESTION_MARK: 0x061F,
  LEFT_TO_RIGHT_MARK: 0x200E,
  RIGHT_TO_LEFT_MARK: 0x200F,
  HEBREW_SOF_PASUK: 0x05C3,
});

// 不在枚举里，但一直按换行处理，保留原有行为。
const NON_ENUM_NAME_CODES = Object.freeze({ PARAGRAPH_BREAK: 0x000A });

const DECODE_TABLE = Object.freeze(Object.fromEntries(
  Object.entries({ ...INDESIGN_SPECIAL_CHARACTER_CODES, ...NON_ENUM_NAME_CODES })
    .map(([name, code]) => [name, String.fromCharCode(code)]),
));

// 长名优先：FIXED_WIDTH_NONBREAKING_SPACE 里包含 NONBREAKING_SPACE，短名先匹配会拆错。
// 不加词边界：枚举名会和前后文字粘在一起，比如 "SA ArchitectsCOPYRIGHT_SYMBOL"、"EM_DASHEM_DASH"。
const NAME_PATTERN = new RegExp(
  Object.keys(DECODE_TABLE).sort((a, b) => b.length - a.length).join('|'),
  'g',
);

function decodeSpecialCharacterNames(value) {
  return String(value == null ? '' : value).replace(NAME_PATTERN, (name) => DECODE_TABLE[name]);
}

module.exports = {
  INDESIGN_SPECIAL_CHARACTER_CODES,
  decodeSpecialCharacterNames,
};
