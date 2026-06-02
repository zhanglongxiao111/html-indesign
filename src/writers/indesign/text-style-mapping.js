function capitalizationFor(style) {
  const transform = String(style && style.textTransform || '').toLowerCase();
  if (transform === 'uppercase') return 'allCaps';
  return null;
}

function ensureFont(styles, fontFamily, options, text) {
  const family = selectFontFamily(fontFamily, text, options) || options.fontFallback || 'Arial';
  if (!family) return null;
  if (!styles.fonts[family]) {
    styles.fonts[family] = {
      family,
      fallback: options.fontFallback || 'Arial',
    };
  }
  return family;
}

function selectFontFamily(fontFamily, text, options) {
  const families = fontStack(fontFamily);
  if (containsCjk(text)) {
    return families.find(isCjkFontFamily)
      || options.cjkFontFallback
      || families[0]
      || null;
  }
  return families[0] || null;
}

function fontStack(fontFamily) {
  return String(fontFamily || '')
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part && !isGenericFontFamily(part));
}

function isGenericFontFamily(family) {
  return ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui'].includes(String(family || '').toLowerCase());
}

function containsCjk(text) {
  return /[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(String(text || ''));
}

function isCjkFontFamily(family) {
  return /(yahei|microsoft yahei|simsun|simhei|kaiti|fangsong|noto sans cjk|source han|pingfang|hiragino|heiti|微软雅黑|宋体|黑体|楷体|仿宋|思源)/i.test(String(family || ''));
}

function fontStyleNameFor(style) {
  const weight = Number(style.fontWeight || 400);
  const italic = /italic|oblique/i.test(String(style.fontStyle || ''));
  const bold = Number.isFinite(weight) ? weight >= 600 : /bold/i.test(String(style.fontWeight || ''));
  if (bold && italic) return 'Bold Italic';
  if (bold) return 'Bold';
  if (italic) return 'Italic';
  return 'Regular';
}

module.exports = {
  capitalizationFor,
  ensureFont,
  fontStyleNameFor,
};
