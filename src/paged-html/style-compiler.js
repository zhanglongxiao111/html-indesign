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
    sourcePackageInput: snapshot.sourcePackageInput || null,
    pages,
    assets: snapshot.assets || [],
    warnings: snapshot.warnings || [],
    styles,
    styleLayout: styleLayoutSignature(options.layout),
    report,
  };
}

function styleLayoutSignature(layout) {
  if (!layout || layout.unitMode !== 'presentation') {
    return {
      unitMode: 'print',
      targetUnit: 'mm',
      scale: 1,
      targetSize: null,
    };
  }
  return {
    unitMode: 'presentation',
    targetUnit: layout.targetUnit || 'pt',
    scale: Number(layout.scale || 1),
    targetSize: layout.targetSize ? {
      width: Number(layout.targetSize.width || 0),
      height: Number(layout.targetSize.height || 0),
      name: layout.targetSize.name || null,
    } : null,
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
    if (shouldCompileTextFrameObjectStyle(item)) {
      styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
      styleRefs.frameStyle = ensureFrameStyle(styles, item, options);
    }
    compiled.content.runs = compileTextRuns(item, styles, styleRefs, report, options);
  }

  if (item.role === 'graphic' || item.role === 'shape') {
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    styleRefs.frameStyle = ensureFrameStyle(styles, item, options);
    compiled.box = compileBoxModel(item, styles, options);
    warnObjectBorderLimitations(item, compiled.box, report);
    compiled.effects = compileEffects(item, report);
  }

  if (item.role === 'shape' && shouldCompileObjectText(item)) {
    styleRefs.paragraphStyle = ensureParagraphStyle(styles, item, report, options);
    compiled.content.text = item.text.trim();
    compiled.content.runs = [{ text: item.text.trim(), characterStyle: null }];
  }

  if (item.role === 'table') {
    styleRefs.tableStyle = styleNameForKind(item, 'tableStyles', null, options)
      || firstClassName(item)
      || 'default-table';
    if (!styles.tableStyles[styleRefs.tableStyle]) {
      styles.tableStyles[styleRefs.tableStyle] = { name: styleRefs.tableStyle };
    }
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    if (explicitFrameStyleName(item, options)) {
      styleRefs.frameStyle = ensureFrameStyle(styles, item, options);
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
  if (isWholeItemTextRun(item)) {
    return [{ text: item.text || '', characterStyle: null }];
  }
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

function isWholeItemTextRun(item) {
  const runs = item.runs || [];
  if (runs.length !== 1) return false;
  const run = runs[0];
  if (run.attributes && run.attributes['data-id-character-style']) return false;
  return String(run.text || '').trim() === String(item.text || '').trim()
    && String(run.tagName || '') === String(item.tagName || '');
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
  return expandRunsWithPlainSegments(item.text || '', item.runs || []);
}

function expandRunsWithPlainSegments(fullText, runs) {
  const inlineRuns = (runs || []).filter((run) => run.text);
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

function capitalizationFor(style) {
  const transform = String(style && style.textTransform || '').toLowerCase();
  if (transform === 'uppercase') return 'allCaps';
  return null;
}

function ensureParagraphStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fillColor = ensureSwatch(styles, style.color);
  const fontName = ensureFont(styles, style.fontFamily, options, item.text);
  const signature = {
    appliedFont: fontName,
    fontStyleName: fontStyleNameFor(style),
    pointSize: styleLengthToPt(style, 'fontSize', options),
    leading: styleLengthToPt(style, 'lineHeight', options),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    justification: style.textAlign || 'left',
    tracking: trackingValue(style, options),
    capitalization: capitalizationFor(style),
    spaceBefore: styleLengthToPt(style, 'marginTop', options),
    spaceAfter: styleLengthToPt(style, 'marginBottom', options),
  };
  const name = styleNameForKind(item, 'paragraphStyles', signature, options)
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
    pointSize: styleLengthToPt(style, 'fontSize', options),
    fontWeight: style.fontWeight || '400',
    fontStyle: style.fontStyle || 'normal',
    fillColor,
    tracking: trackingValue(style, options),
    verticalPosition: style.verticalAlign || 'baseline',
    textDecoration: style.textDecorationLine || 'none',
    capitalization: capitalizationFor(style),
  };
  const name = styleNameForKind(run, 'characterStyles', signature, options)
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
  const uniformBorder = uniformBorderForObject(item, options);
  const strokeColor = uniformBorder ? uniformBorder.color : null;
  const signature = {
    fillColor,
    fillOpacity: fill && fill.alpha != null ? fill.alpha : null,
    strokeColor,
    strokeWeight: uniformBorder ? uniformBorder.widthPt : 0,
    strokeStyle: uniformBorder ? uniformBorder.style : 'none',
    strokeAlignment: uniformBorder ? 'inside' : null,
    cornerRadius: cornerRadiusValue(item, options),
    opacity: effectiveObjectOpacity(item, fill),
    overflow: style.overflow || 'visible',
  };
  const name = styleNameForKind(item, 'objectStyles', signature, options)
    || firstClassName(item)
    || stableAutoName('object', signature);
  if (!styles.objectStyles[name]) {
    styles.objectStyles[name] = {
      name,
      ...signature,
    };
  }
  if (style.transform && style.transform !== 'none' && !isNativeLineCandidate(item)) {
    addMessage(report, 'warning', 'TRANSFORM_NOT_NATIVE', 'CSS transform captured but not compiled to native InDesign transform in this plan', {
      itemId: item.id,
      transform: style.transform,
    });
  }
  return name;
}

function shouldCompileTextFrameObjectStyle(item) {
  const attributes = item.attributes || {};
  if (attributes['data-id-object-style'] || attributes['data-id-frame-style']) return true;
  const style = item.computedStyle || {};
  return Boolean(
    ensureFillPreview(style)
    || visibleStroke(item, 'borderTopWidth', {})
    || visibleStroke(item, 'borderRightWidth', {})
    || visibleStroke(item, 'borderBottomWidth', {})
    || visibleStroke(item, 'borderLeftWidth', {})
    || Number(style.opacity || 1) < 1
    || (style.borderRadius && style.borderRadius !== '0px')
  );
}

function ensureFillPreview(style) {
  return normalizeCssColor(style.backgroundColor) || singleColorGradientSwatch(style.backgroundImage);
}

function isNativeLineCandidate(item) {
  const classNames = item.classList || [];
  const objectStyle = item.attributes && item.attributes['data-id-object-style'];
  return item.role === 'shape'
    && (classNames.includes('line') || /(^|-)line($|-)/.test(String(objectStyle || '')));
}

function compileEffects(item, report) {
  const style = item.computedStyle || {};
  const gradient = parseCssLinearGradient(style.backgroundImage);
  if (!gradient) return null;
  if (!gradientHasSingleColor(gradient)) {
    addMessage(report, 'warning', 'GRADIENT_COLOR_UNSUPPORTED', 'Multi-color CSS gradients are not mapped to InDesign gradient feather effects', {
      itemId: item.id,
      backgroundImage: style.backgroundImage,
    });
    return null;
  }
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

function gradientHasSingleColor(gradient) {
  const names = new Set((gradient.stops || []).map((stop) => stop.color && stop.color.name).filter(Boolean));
  return names.size <= 1;
}

function compileBoxModel(item, styles, options) {
  const style = item.computedStyle || {};
  return {
    borders: {
      top: compileBorderEdge(styles, style.borderTopColor, lengthStyleValue(item, 'borderTopWidth'), style.borderTopStyle, itemLengthToPt(item, 'borderTopWidth', options)),
      right: compileBorderEdge(styles, style.borderRightColor, lengthStyleValue(item, 'borderRightWidth'), style.borderRightStyle, itemLengthToPt(item, 'borderRightWidth', options)),
      bottom: compileBorderEdge(styles, style.borderBottomColor, lengthStyleValue(item, 'borderBottomWidth'), style.borderBottomStyle, itemLengthToPt(item, 'borderBottomWidth', options)),
      left: compileBorderEdge(styles, style.borderLeftColor, lengthStyleValue(item, 'borderLeftWidth'), style.borderLeftStyle, itemLengthToPt(item, 'borderLeftWidth', options)),
    },
  };
}

function compileBorderEdge(styles, color, width, style, widthPt) {
  return {
    color: ensureSwatch(styles, color),
    widthPt,
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
  const paragraphStyle = styleTokenForKind(cell.attributes, 'paragraphStyles')
    ? ensureParagraphStyle(styles, tableCellStyleItem(cell), report, options)
    : null;
  const padding = tableCellPadding(style, options);
  const borders = compileTableCellBorders(cell, styles, options);
  warnTableCellBorderLimitations(cell, borders, report);
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
    pointSize: styleLengthToPt(style, 'fontSize', options),
    leading: styleLengthToPt(style, 'lineHeight', options),
    textAlign: style.textAlign || 'left',
    borderColor: ensureSwatch(styles, style.borderTopColor),
    borderWeight: itemLengthToPt(cell, 'borderTopWidth', options),
    borders,
    runs: compileTableCellRuns(cell, styles, report, options),
    padding: padding.values,
    paddingUnit: padding.unit,
  };
}

function compileTableCellRuns(cell, styles, report, options) {
  const runs = expandRunsWithPlainSegments(cell.text || '', cell.runs || []);
  return runs.map((run) => {
    if (run.plain) return { text: run.text, characterStyle: null };
    return {
      text: run.text,
      characterStyle: ensureCharacterStyle(styles, run, report, options),
    };
  });
}

function warnObjectBorderLimitations(item, box, report) {
  const borders = box && box.borders;
  if (!borders || bordersAreUniform(borders)) return;
  const edges = [borders.top, borders.right, borders.bottom, borders.left].filter(visibleCompiledBorder);
  const hasStyledEdge = edges.some((edge) => !['solid', 'none', 'hidden', ''].includes(String(edge.style || '').toLowerCase()));
  const hasRadius = String(item.computedStyle && item.computedStyle.borderRadius || '').trim();
  if (!hasStyledEdge && (!hasRadius || hasRadius === '0px')) return;
  addMessage(report, 'warning', 'BORDER_DECORATION_LIMITED', 'Asymmetric CSS borders are translated as solid decoration strips; dashed/dotted styles and rounded clipping are not preserved exactly.', {
    itemId: item.id,
  });
}

function warnTableCellBorderLimitations(cell, borders, report) {
  const edges = [borders.top, borders.right, borders.bottom, borders.left].filter(visibleCompiledCellBorder);
  const unsupported = edges.some((edge) => !['solid', 'none', 'hidden', ''].includes(String(edge.style || '').toLowerCase()));
  if (!unsupported) return;
  addMessage(report, 'warning', 'TABLE_CELL_BORDER_STYLE_UNSUPPORTED', 'Table cell dashed/dotted border styles are not applied by the current executor.', {
    cellIndex: cell.index,
  });
}

function compileTableCellBorders(cell, styles, options) {
  const style = cell.computedStyle || {};
  return {
    top: compileCellBorderEdge(styles, style.borderTopColor, lengthStyleValue(cell, 'borderTopWidth'), style.borderTopStyle, itemLengthToPt(cell, 'borderTopWidth', options)),
    right: compileCellBorderEdge(styles, style.borderRightColor, lengthStyleValue(cell, 'borderRightWidth'), style.borderRightStyle, itemLengthToPt(cell, 'borderRightWidth', options)),
    bottom: compileCellBorderEdge(styles, style.borderBottomColor, lengthStyleValue(cell, 'borderBottomWidth'), style.borderBottomStyle, itemLengthToPt(cell, 'borderBottomWidth', options)),
    left: compileCellBorderEdge(styles, style.borderLeftColor, lengthStyleValue(cell, 'borderLeftWidth'), style.borderLeftStyle, itemLengthToPt(cell, 'borderLeftWidth', options)),
  };
}

function compileCellBorderEdge(styles, color, widthCss, style, borderWeight) {
  return {
    color: ensureSwatch(styles, color),
    widthCss: widthCss || '0px',
    style: style || 'none',
    borderWeight,
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
      top: styleLengthToPt(style, 'paddingTop', options),
      right: styleLengthToPt(style, 'paddingRight', options),
      bottom: styleLengthToPt(style, 'paddingBottom', options),
      left: styleLengthToPt(style, 'paddingLeft', options),
    },
    overflow: style.overflow || 'visible',
  };
  const name = styleNameForKind(item, 'frameStyles', signature, options)
    || classFrameStyleName(item, options)
    || stableAutoName('frame', signature);
  if (!styles.frameStyles[name]) {
    styles.frameStyles[name] = {
      name,
      ...signature,
    };
  }
  return name;
}

function explicitFrameStyleName(item, options) {
  const attributes = item.attributes || {};
  const explicitDisplay = explicitName(attributes, styleDisplayAttributes('frameStyles'));
  if (explicitDisplay) return explicitDisplay;
  const token = styleTokenForKind(attributes, 'frameStyles');
  return mappedStyleName(token, 'frameStyles', options) || token || null;
}

function styleNameForKind(item, kind, signature, options) {
  const attributes = item.attributes || {};
  const explicitDisplay = explicitName(attributes, styleDisplayAttributes(kind));
  if (explicitDisplay) return explicitDisplay;
  const token = styleTokenForKind(attributes, kind);
  const mapped = mappedStyleName(token, kind, options);
  if (mapped) return mapped;
  if (token) return token;
  const className = firstClassName(item);
  const mappedClass = mappedStyleName(className, kind, options);
  if (mappedClass) return mappedClass;
  return signature ? null : firstClassName(item);
}

function classFrameStyleName(item, options) {
  const className = firstClassName(item);
  if (!className) return null;
  return mappedStyleName(`${className}-frame`, 'frameStyles', options)
    || mappedStyleName(className, 'frameStyles', options)
    || `${className}-frame`;
}

function styleTokenForKind(attributes, kind) {
  return explicitName(attributes || {}, styleTokenAttributes(kind));
}

function mappedStyleName(token, kind, options) {
  if (!token || !options || !options.styleNameMap) return null;
  const map = options.styleNameMap;
  return (map[kind] && map[kind][token]) || map[token] || null;
}

function styleDisplayAttributes(kind) {
  const byKind = {
    paragraphStyles: ['data-id-paragraph-style-name', 'data-id-style-name'],
    characterStyles: ['data-id-character-style-name', 'data-id-style-name'],
    objectStyles: ['data-id-object-style-name', 'data-id-style-name'],
    frameStyles: ['data-id-frame-style-name', 'data-id-style-name'],
    tableStyles: ['data-id-table-style-name', 'data-id-style-name'],
  };
  return byKind[kind] || ['data-id-style-name'];
}

function styleTokenAttributes(kind) {
  const byKind = {
    paragraphStyles: ['data-id-paragraph-style', 'data-id-style'],
    characterStyles: ['data-id-character-style', 'data-id-style'],
    objectStyles: ['data-id-object-style', 'data-id-style'],
    frameStyles: ['data-id-frame-style'],
    tableStyles: ['data-id-table-style'],
  };
  return byKind[kind] || ['data-id-style'];
}

function styleLengthToPt(style, prop, options) {
  const value = style && style[prop];
  if (isPresentationLayout(options)) return cssLengthToPresentationPt(value, options);
  return cssLengthToPt(value);
}

function trackingValue(style, options) {
  const letterSpacing = styleLengthToPt(style, 'letterSpacing', options);
  const fontSize = styleLengthToPt(style, 'fontSize', options);
  if (!letterSpacing || !fontSize) return null;
  return round(letterSpacing / fontSize * 1000, 4);
}

function itemLengthToPt(item, prop, options) {
  if (isPresentationLayout(options)) {
    return cssLengthToPresentationPt(item && item.computedStyle && item.computedStyle[prop], options);
  }
  return cssLengthToPt(lengthStyleValue(item, prop));
}

function cssLengthToPresentationPt(value, options) {
  const px = cssLengthToPx(value);
  if (px == null) return null;
  return round(px * presentationScale(options), 4);
}

function cornerRadiusValue(item, options) {
  const computed = item && item.computedStyle && item.computedStyle.borderRadius;
  if (isPresentationLayout(options)) {
    if (String(computed || '').trim().endsWith('%')) return computed;
    const pt = cssLengthToPresentationPt(computed, options);
    return pt == null ? '0pt' : `${pt}pt`;
  }
  return lengthStyleValue(item, 'borderRadius') || computed || '0px';
}

function tableCellPadding(style, options) {
  if (isPresentationLayout(options)) {
    return {
      unit: 'pt',
      values: {
        top: styleLengthToPt(style, 'paddingTop', options),
        right: styleLengthToPt(style, 'paddingRight', options),
        bottom: styleLengthToPt(style, 'paddingBottom', options),
        left: styleLengthToPt(style, 'paddingLeft', options),
      },
    };
  }
  return {
    unit: 'mm',
    values: {
      top: cssLengthToMm(style.paddingTop),
      right: cssLengthToMm(style.paddingRight),
      bottom: cssLengthToMm(style.paddingBottom),
      left: cssLengthToMm(style.paddingLeft),
    },
  };
}

function isPresentationLayout(options) {
  return options && options.layout && options.layout.unitMode === 'presentation';
}

function presentationScale(options) {
  return Number(options && options.layout && options.layout.scale || 1);
}

function cssLengthToPx(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  if (parsed.unit === 'px') return parsed.value;
  if (parsed.unit === 'pt') return parsed.value * 96 / 72;
  if (parsed.unit === 'mm') return parsed.value * 96 / 25.4;
  return null;
}

function ensureSwatch(styles, cssColor) {
  const normalized = normalizeCssColor(cssColor);
  return ensureNormalizedSwatch(styles, normalized);
}

function ensureFillSwatch(styles, style) {
  const normalized = normalizeCssColor(style.backgroundColor)
    || singleColorGradientSwatch(style.backgroundImage);
  if (!normalized) return null;
  ensureNormalizedSwatch(styles, normalized);
  return normalized;
}

function singleColorGradientSwatch(backgroundImage) {
  const gradient = parseCssLinearGradient(backgroundImage);
  if (!gradient || !gradientHasSingleColor(gradient)) return null;
  return normalizeCssColorFromBackgroundImage(backgroundImage);
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

function visibleStroke(item, prop, options) {
  const style = item.computedStyle || {};
  const side = prop.match(/^border(Top|Right|Bottom|Left)Width$/);
  const styleProp = side ? `border${side[1]}Style` : 'borderTopStyle';
  const strokeStyle = String(style[styleProp] || '').toLowerCase();
  return strokeStyle
    && strokeStyle !== 'none'
    && strokeStyle !== 'hidden'
    && Number(itemLengthToPt(item, prop, options) || 0) > 0;
}

function uniformBorderForObject(item, options) {
  const box = compileBoxModel(item, createEmptyStyleModel(), options);
  const edges = [box.borders.top, box.borders.right, box.borders.bottom, box.borders.left];
  if (!edges.every((edge) => visibleCompiledBorder(edge))) return null;
  const first = edges[0];
  const uniform = edges.every((edge) => edge.color === first.color
    && edge.style === first.style
    && Math.abs(Number(edge.widthPt || 0) - Number(first.widthPt || 0)) < 0.01);
  return uniform ? first : null;
}

function visibleCompiledBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.widthPt || 0) > 0;
}

function visibleCompiledCellBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.borderWeight || 0) > 0;
}

function bordersAreUniform(borders) {
  return sameCompiledBorder(borders.top, borders.right)
    && sameCompiledBorder(borders.top, borders.bottom)
    && sameCompiledBorder(borders.top, borders.left);
}

function sameCompiledBorder(a, b) {
  if (!visibleCompiledBorder(a) && !visibleCompiledBorder(b)) return true;
  if (!visibleCompiledBorder(a) || !visibleCompiledBorder(b)) return false;
  return a.color === b.color
    && a.style === b.style
    && Math.abs(Number(a.widthPt || 0) - Number(b.widthPt || 0)) < 0.01;
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
