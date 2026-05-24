const { createReport, addMessage } = require('../shared/report');
const { parseCssLength, round } = require('../shared/geometry');
const {
  normalizeCssColor,
  normalizeCssColorFromBackgroundImage,
  parseCssLinearGradient,
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
    compiled.box = compileBoxModel(item, styles);
    compiled.effects = compileEffects(item);
  }

  if (item.role === 'shape' && shouldCompileObjectText(item)) {
    styleRefs.paragraphStyle = ensureParagraphStyle(styles, item, report, options);
    compiled.content.text = item.text.trim();
    compiled.content.runs = [{ text: item.text.trim(), characterStyle: null }];
  }

  if (item.role === 'table') {
    styleRefs.tableStyle = explicitName(item.attributes, ['data-id-table-style']) || firstClassName(item) || 'default-table';
    if (!styles.tableStyles[styleRefs.tableStyle]) {
      styles.tableStyles[styleRefs.tableStyle] = { name: styleRefs.tableStyle };
    }
    compiled.content.rows = compileTableRows(item, styles, report, options);
    compiled.content.columnCount = tableColumnCount(compiled.content.rows);
    compiled.content.columnWidths = compileTableColumnWidths(item, compiled.content.rows);
    compiled.content.rowHeights = compileTableRowHeights(compiled.content.rows);
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
  if (item.role === 'table') {
    return {
      rows: [],
      columnCount: 0,
      columnWidths: [],
      rowHeights: [],
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

function shouldCompileObjectText(item) {
  return Boolean(
    item
    && item.attributes
    && item.attributes['data-id-role'] === 'annotation'
    && String(item.text || '').trim()
  );
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
  const fontName = ensureFont(styles, style.fontFamily, options, item.text);
  const signature = {
    appliedFont: fontName,
    fontStyleName: fontStyleNameFor(style),
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
  const fontName = ensureFont(styles, style.fontFamily, options, run.text);
  const signature = {
    appliedFont: fontName,
    fontStyleName: fontStyleNameFor(style),
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
  const fill = ensureFillSwatch(styles, style);
  const fillColor = fill && fill.name;
  const strokeColor = ensureSwatch(styles, style.borderTopColor);
  const signature = {
    fillColor,
    fillOpacity: fill && fill.alpha != null ? fill.alpha : null,
    strokeColor,
    strokeWeight: cssLengthToPt(lengthStyleValue(item, 'borderTopWidth')),
    strokeStyle: style.borderTopStyle || 'none',
    strokeAlignment: visibleStroke(style, lengthStyleValue(item, 'borderTopWidth')) ? 'inside' : null,
    cornerRadius: lengthStyleValue(item, 'borderRadius') || style.borderRadius || '0px',
    opacity: effectiveObjectOpacity(item, fill),
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

function compileEffects(item) {
  const style = item.computedStyle || {};
  const gradient = parseCssLinearGradient(style.backgroundImage);
  if (!gradient) return null;
  return {
    gradientFeather: {
      type: 'linear',
      scope: 'fill',
      angle: cssGradientAngleToIndesign(gradient.angle),
      start: gradientStartForBounds(item.boundsMm, cssGradientAngleToIndesign(gradient.angle)),
      length: 0,
      stops: gradient.stops.map((stop) => ({
        location: stop.location,
        opacity: stop.opacity,
      })),
    },
  };
}

function cssGradientAngleToIndesign(angle) {
  const normalized = ((Number(angle) % 360) + 360) % 360;
  return (normalized + 270) % 360;
}

function gradientStartForBounds(bounds, angle) {
  const normalized = ((Number(angle) % 360) + 360) % 360;
  const x = Number(bounds && bounds.x || 0);
  const y = Number(bounds && bounds.y || 0);
  const width = Number(bounds && bounds.width || 0);
  const height = Number(bounds && bounds.height || 0);
  if (normalized === 0) return { x: round(x - width / 2, 2), y: round(y + height / 2, 2) };
  if (normalized === 180) return { x: round(x + width * 1.5, 2), y: round(y + height / 2, 2) };
  if (normalized === 90) return { x: round(x + width / 2, 2), y: round(y + height * 1.5, 2) };
  if (normalized === 270) return { x: round(x + width / 2, 2), y: round(y - height / 2, 2) };
  return { x: round(x - width / 2, 2), y: round(y + height / 2, 2) };
}

function compileBoxModel(item, styles) {
  const style = item.computedStyle || {};
  return {
    borders: {
      top: compileBorderEdge(styles, style.borderTopColor, lengthStyleValue(item, 'borderTopWidth'), style.borderTopStyle),
      right: compileBorderEdge(styles, style.borderRightColor, lengthStyleValue(item, 'borderRightWidth'), style.borderRightStyle),
      bottom: compileBorderEdge(styles, style.borderBottomColor, lengthStyleValue(item, 'borderBottomWidth'), style.borderBottomStyle),
      left: compileBorderEdge(styles, style.borderLeftColor, lengthStyleValue(item, 'borderLeftWidth'), style.borderLeftStyle),
    },
  };
}

function compileBorderEdge(styles, color, width, style) {
  return {
    color: ensureSwatch(styles, color),
    widthPt: cssLengthToPt(width),
    widthCss: width || '0px',
    style: style || 'none',
  };
}

function compileTableRows(item, styles, report, options) {
  return (item.table || []).map((row) => ({
    index: row.index,
    header: Boolean(row.header),
    cells: (row.cells || []).map((cell) => compileTableCell(cell, styles, report, options)),
  }));
}

function compileTableCell(cell, styles, report, options) {
  const style = cell.computedStyle || {};
  const fill = ensureFillSwatch(styles, style);
  const paragraphStyle = explicitName(cell.attributes, ['data-id-paragraph-style', 'data-id-style'])
    ? ensureParagraphStyle(styles, tableCellStyleItem(cell), report, options)
    : null;
  return {
    index: cell.index,
    text: cell.text || '',
    header: Boolean(cell.header),
    rowSpan: cell.rowSpan || 1,
    colSpan: cell.colSpan || 1,
    bounds: cell.boundsMm || null,
    paragraphStyle,
    fillColor: fill && fill.name,
    fillOpacity: fill && fill.alpha != null ? fill.alpha : null,
    textColor: ensureSwatch(styles, style.color),
    pointSize: cssLengthToPt(style.fontSize),
    leading: cssLengthToPt(style.lineHeight),
    textAlign: style.textAlign || 'left',
    borderColor: ensureSwatch(styles, style.borderTopColor),
    borderWeight: cssLengthToPt(lengthStyleValue(cell, 'borderTopWidth')),
    padding: {
      top: cssLengthToMm(style.paddingTop),
      right: cssLengthToMm(style.paddingRight),
      bottom: cssLengthToMm(style.paddingBottom),
      left: cssLengthToMm(style.paddingLeft),
    },
  };
}

function tableColumnCount(rows) {
  return (rows || []).reduce((max, row) => {
    const count = (row.cells || []).reduce((sum, cell) => sum + Number(cell.colSpan || 1), 0);
    return Math.max(max, count);
  }, 0);
}

function compileTableColumnWidths(item, rows) {
  const sourceRow = (rows || []).find((row) => (row.cells || []).every((cell) => cell.bounds && Number(cell.bounds.width) > 0));
  if (!sourceRow) return [];
  const widths = [];
  for (const cell of sourceRow.cells || []) {
    const span = Math.max(1, Number(cell.colSpan || 1));
    const width = Number(cell.bounds.width || 0) / span;
    for (let index = 0; index < span; index += 1) widths.push(round(width, 2));
  }
  return normalizeTableWidths(widths, item.boundsMm && item.boundsMm.width);
}

function normalizeTableWidths(widths, tableWidth) {
  if (!widths.length || !Number.isFinite(Number(tableWidth))) return widths;
  const total = widths.reduce((sum, width) => sum + width, 0);
  const delta = round(Number(tableWidth) - total, 2);
  if (Math.abs(delta) > 0 && Math.abs(delta) < 1) {
    widths[widths.length - 1] = round(widths[widths.length - 1] + delta, 2);
  }
  return widths;
}

function compileTableRowHeights(rows) {
  return (rows || []).map((row) => {
    const height = (row.cells || []).reduce((max, cell) => Math.max(max, Number(cell.bounds && cell.bounds.height || 0)), 0);
    return round(height, 2);
  });
}

function lengthStyleValue(item, prop) {
  const authored = item && item.authoredStyle && item.authoredStyle[prop];
  return authored || (item && item.computedStyle && item.computedStyle[prop]);
}

function tableCellStyleItem(cell) {
  return {
    id: `table-cell-${cell.index}`,
    tagName: cell.tagName,
    classList: cell.classList || [],
    attributes: cell.attributes || {},
    computedStyle: cell.computedStyle || {},
    authoredStyle: cell.authoredStyle || {},
    text: cell.text || '',
  };
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
  return ensureNormalizedSwatch(styles, normalized);
}

function ensureFillSwatch(styles, style) {
  const normalized = normalizeCssColor(style.backgroundColor)
    || normalizeCssColorFromBackgroundImage(style.backgroundImage);
  if (!normalized) return null;
  ensureNormalizedSwatch(styles, normalized);
  return normalized;
}

function ensureNormalizedSwatch(styles, normalized) {
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

function clampOpacity(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function effectiveObjectOpacity(item, fill) {
  const style = item.computedStyle || {};
  const cssOpacity = clampOpacity(Number(style.opacity || 1));
  if (parseCssLinearGradient(style.backgroundImage)) {
    return cssOpacity;
  }
  if (item.role === 'graphic' && item.attributes && item.attributes['data-id-asset-kind'] && cssOpacity === 0) {
    return 1;
  }
  return cssOpacity;
}

function visibleStroke(style, width) {
  const strokeStyle = String(style.borderTopStyle || '').toLowerCase();
  return strokeStyle
    && strokeStyle !== 'none'
    && strokeStyle !== 'hidden'
    && Number(cssLengthToPt(width) || 0) > 0;
}

function cssLengthToMm(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  let mm = null;
  if (parsed.unit === 'mm') mm = parsed.value;
  if (parsed.unit === 'pt') mm = parsed.value * 25.4 / 72;
  if (parsed.unit === 'px') mm = parsed.value * 25.4 / 96;
  if (mm == null) return null;
  const nearest = Math.round(mm);
  if (Math.abs(mm - nearest) < 0.15) return nearest;
  return round(mm, 2);
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
  createEmptyStyleModel,
  compileStyles,
};
