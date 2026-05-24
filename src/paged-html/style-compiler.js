const { createReport, addMessage } = require('../shared/report');
const {
  normalizeCssColor,
  cssLengthToPt,
  stableAutoName,
  firstClassName,
  explicitName,
} = require('./style-utils');

function createEmptyStyleModel() {
  return {
    swatches: {},
    fonts: {},
    compositeFonts: {},
    paragraphStyles: {},
    characterStyles: {},
    objectStyles: {},
    frameStyles: {},
    tableStyles: {},
    cellStyles: {},
  };
}

function compileStyles(snapshot, options = {}) {
  const styles = createEmptyStyleModel();
  const report = createReport();
  addMessage(report, 'info', 'STYLE_COMPILE_START', 'Style resource compilation started', {
    pageCount: snapshot.pages.length,
  });

  const pages = snapshot.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => compileItemStyles(item, styles, report, options)),
  }));

  return {
    metadata: snapshot.metadata,
    pages,
    assets: snapshot.assets || [],
    warnings: snapshot.warnings || [],
    styles,
    report,
  };
}

function compileItemStyles(item, styles, report, options) {
  const styleRefs = {
    swatch: null,
    paragraphStyle: null,
    characterStyles: [],
    objectStyle: null,
    frameStyle: null,
    tableStyle: null,
    cellStyle: null,
  };
  const compiled = {
    ...item,
    styleRefs,
    content: contentForItem(item),
  };

  if (item.role === 'text') {
    styleRefs.paragraphStyle = ensureParagraphStyle(styles, item, report, options);
    compiled.content.runs = compileTextRuns(item, styles, styleRefs, report, options);
  }

  if (item.role === 'graphic' || item.role === 'shape') {
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    styleRefs.frameStyle = ensureFrameStyle(styles, item, options);
  }

  if (item.role === 'table') {
    styleRefs.tableStyle = explicitName(item.attributes, ['data-id-table-style']) || firstClassName(item) || 'default-table';
    if (!styles.tableStyles[styleRefs.tableStyle]) {
      styles.tableStyles[styleRefs.tableStyle] = { name: styleRefs.tableStyle };
    }
  }

  return compiled;
}

function contentForItem(item) {
  if (item.role === 'text') {
    return {
      text: item.text || '',
      runs: [],
    };
  }
  if (item.role === 'graphic') {
    return {
      alt: item.attributes.alt || '',
      src: item.attributes.src || item.attributes.data || '',
    };
  }
  return {};
}

function compileTextRuns(item, styles, styleRefs, report, options) {
  const runs = item.runs && item.runs.length > 0
    ? expandTextRunsWithPlainSegments(item)
    : [{ text: item.text || '', attributes: {}, classList: [], computedStyle: item.computedStyle, tagName: item.tagName }];
  return runs.map((run) => {
    if (run.plain) {
      return {
        text: run.text,
        characterStyle: null,
      };
    }
    const characterStyle = ensureCharacterStyle(styles, run, report, options);
    if (characterStyle && !styleRefs.characterStyles.includes(characterStyle)) {
      styleRefs.characterStyles.push(characterStyle);
    }
    return {
      text: run.text,
      characterStyle,
    };
  });
}

function expandTextRunsWithPlainSegments(item) {
  const fullText = item.text || '';
  const inlineRuns = (item.runs || []).filter((run) => run.text);
  if (!fullText || inlineRuns.length === 0) return inlineRuns;

  const out = [];
  let cursor = 0;
  for (const run of inlineRuns) {
    const index = fullText.indexOf(run.text, cursor);
    if (index === -1) return inlineRuns;
    if (index > cursor) {
      out.push({ text: fullText.slice(cursor, index), plain: true });
    }
    out.push(run);
    cursor = index + run.text.length;
  }
  if (cursor < fullText.length) {
    out.push({ text: fullText.slice(cursor), plain: true });
  }
  return out.filter((run) => run.text);
}

function ensureParagraphStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.color);
  const fontName = ensureFont(styles, style.fontFamily, options);
  const signature = {
    appliedFont: fontName,
    pointSize: cssLengthToPt(style.fontSize),
    leading: cssLengthToPt(style.lineHeight),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    justification: style.textAlign || 'left',
    tracking: cssLengthToPt(style.letterSpacing),
    spaceBefore: cssLengthToPt(style.marginTop),
    spaceAfter: cssLengthToPt(style.marginBottom),
  };
  const name = explicitName(item.attributes, ['data-id-paragraph-style', 'data-id-style'])
    || firstClassName(item)
    || stableAutoName('paragraph', signature);
  if (!styles.paragraphStyles[name]) {
    styles.paragraphStyles[name] = {
      name,
      ...signature,
    };
  }
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text item has no computed font family', { itemId: item.id });
  }
  return name;
}

function ensureCharacterStyle(styles, run, report, options) {
  const style = run.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.color);
  const fontName = ensureFont(styles, style.fontFamily, options);
  const signature = {
    appliedFont: fontName,
    pointSize: cssLengthToPt(style.fontSize),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    tracking: cssLengthToPt(style.letterSpacing),
    verticalPosition: style.verticalAlign || 'baseline',
    textDecoration: style.textDecorationLine || 'none',
  };
  const name = explicitName(run.attributes, ['data-id-character-style', 'data-id-style'])
    || firstClassName(run)
    || stableAutoName('character', signature);
  if (!styles.characterStyles[name]) {
    styles.characterStyles[name] = {
      name,
      ...signature,
    };
  }
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text run has no computed font family', { text: run.text });
  }
  return name;
}

function ensureObjectStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.backgroundColor);
  const strokeColor = ensureSwatch(styles, style.borderTopColor);
  const signature = {
    fillColor,
    strokeColor,
    strokeWeight: cssLengthToPt(style.borderTopWidth),
    strokeStyle: style.borderTopStyle || 'none',
    cornerRadius: style.borderRadius || '0px',
    opacity: Number(style.opacity || 1),
    overflow: style.overflow || 'visible',
  };
  const name = explicitName(item.attributes, ['data-id-object-style', 'data-id-style'])
    || firstClassName(item)
    || stableAutoName('object', signature);
  if (!styles.objectStyles[name]) {
    styles.objectStyles[name] = {
      name,
      ...signature,
    };
  }
  if (style.transform && style.transform !== 'none') {
    addMessage(report, 'warning', 'TRANSFORM_NOT_NATIVE', 'CSS transform captured but not compiled to native InDesign transform in this plan', {
      itemId: item.id,
      transform: style.transform,
    });
  }
  return name;
}

function ensureFrameStyle(styles, item, options) {
  const style = item.computedStyle || {};
  const signature = {
    fit: style.objectFit || 'fill',
    position: style.objectPosition || '50% 50%',
    inset: {
      top: cssLengthToPt(style.paddingTop),
      right: cssLengthToPt(style.paddingRight),
      bottom: cssLengthToPt(style.paddingBottom),
      left: cssLengthToPt(style.paddingLeft),
    },
    overflow: style.overflow || 'visible',
  };
  const name = explicitName(item.attributes, ['data-id-frame-style'])
    || (firstClassName(item) ? `${firstClassName(item)}-frame` : null)
    || stableAutoName('frame', signature);
  if (!styles.frameStyles[name]) {
    styles.frameStyles[name] = {
      name,
      ...signature,
    };
  }
  return name;
}

function ensureSwatch(styles, cssColor) {
  const normalized = normalizeCssColor(cssColor);
  if (!normalized) return null;
  if (!styles.swatches[normalized.name]) {
    styles.swatches[normalized.name] = {
      name: normalized.name,
      model: 'process',
      space: 'RGB',
      value: normalized.hex,
    };
  }
  return normalized.name;
}

function ensureFont(styles, fontFamily, options) {
  const family = firstFontFamily(fontFamily) || options.fontFallback || 'Arial';
  if (!family) return null;
  if (!styles.fonts[family]) {
    styles.fonts[family] = {
      family,
      fallback: options.fontFallback || 'Arial',
    };
  }
  return family;
}

function firstFontFamily(fontFamily) {
  const first = String(fontFamily || '')
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .find(Boolean);
  return first || null;
}

module.exports = {
  createEmptyStyleModel,
  compileStyles,
};
