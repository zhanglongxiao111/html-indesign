const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const { createReport, addMessage } = require('../shared/report');
const { round } = require('../shared/geometry');
const {
  normalizeCssColor,
  normalizeCssColorFromBackgroundImage,
  parseCssLinearGradient,
  stableAutoName,
} = require('../shared/style-utils');
const { normalizeBlendMode } = require('../shared/blend-mode');
const {
  styleLengthToPt,
  trackingValue,
  itemLengthToPt,
  cornerRadiusValue,
  tableCellPadding,
  lengthStyleValue,
} = require('./box-model');
const { compileEffects, gradientHasSingleColor } = require('./effect-style-mapping');
const {
  explicitFrameStyleName,
  styleNameForKind,
  classFrameStyleName,
  styleTokenForKind,
  styleIdentityForKind,
  styleProtocolLabel,
} = require('./style-identities');
const {
  capitalizationFor,
  ensureFont,
  fontStyleNameFor,
} = require('./text-style-mapping');

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
      styleRefs.frameStyle = ensureFrameStyle(styles, item, options, report);
    }
    compiled.content.runs = compileTextRuns(item, styles, styleRefs, report, options);
  }

  if (item.role === 'graphic' || item.role === 'shape') {
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    styleRefs.frameStyle = ensureFrameStyle(styles, item, options, report);
    compiled.box = compileBoxModel(item, styles, options);
    warnObjectBorderLimitations(item, compiled.box, report);
    compiled.effects = compileEffects(item, report, addMessage);
  }

  if (item.role === 'shape' && shouldCompileObjectText(item)) {
    styleRefs.paragraphStyle = ensureParagraphStyle(styles, item, report, options);
    compiled.content.text = item.text.trim();
    compiled.content.runs = [{ text: item.text.trim(), characterStyle: null }];
  }

  if (item.role === 'table') {
    const tableStyleName = styleNameForKind(item, 'tableStyles', null, options)
      || 'default-table';
    styleRefs.tableStyle = tableStyleName;
    if (!styles.tableStyles[styleRefs.tableStyle]) {
      const identity = styleIdentityForKind(item, 'tableStyles', tableStyleName, options);
      styles.tableStyles[styleRefs.tableStyle] = {
        name: styleRefs.tableStyle,
        token: identity.token,
        displayName: identity.displayName,
        labels: [styleProtocolLabel('tableStyles', identity)],
      };
    }
    styleRefs.objectStyle = ensureObjectStyle(styles, item, report, options);
    if (explicitFrameStyleName(item, options)) {
      styleRefs.frameStyle = ensureFrameStyle(styles, item, options, report);
    }
    compiled.content.rows = compileTableRows(item, styles, report, options);
    compiled.content.rowCount = compiled.content.rows.length;
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
    if (item.content && Array.isArray(item.content.rows)) {
      return {
        rows: item.content.rows,
        columnCount: item.content.columnCount || 0,
        columnWidths: Array.isArray(item.content.columnWidths) ? item.content.columnWidths : [],
        rowHeights: Array.isArray(item.content.rowHeights) ? item.content.rowHeights : [],
        tableStyle: item.content.tableStyle || null,
      };
    }
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
  if (run.attributes && run.attributes[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE]) return false;
  return String(run.text || '').trim() === String(item.text || '').trim()
    && String(run.tagName || '') === String(item.tagName || '');
}

function shouldCompileObjectText(item) {
  return Boolean(
    item
    && item.attributes
    && item.attributes[HTML_DATA_ID_ATTRIBUTES.ROLE] === 'annotation'
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
    composer: paragraphComposerFor(item),
  };
  const requestedName = styleNameForKind(item, 'paragraphStyles', signature, options)
    || stableAutoName('paragraph', signature);
  const name = ensureNamedStyle(styles, 'paragraphStyles', requestedName, 'paragraph', signature, item, report, options);
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text item has no computed font family', { itemId: item.id });
  }
  return name;
}

function paragraphComposerFor(item) {
  const attributes = item && item.attributes || {};
  return attributes[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_COMPOSER] || item && item.textStyle && item.textStyle.composer || null;
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
  const requestedName = styleNameForKind(run, 'characterStyles', signature, options)
    || stableAutoName('character', signature);
  const name = ensureNamedStyle(styles, 'characterStyles', requestedName, 'character', signature, run, report, options);
  if (!fontName) {
    addMessage(report, 'warning', 'FONT_MISSING', 'Text run has no computed font family', { text: run.text });
  }
  return name;
}

function ensureObjectStyle(styles, item, report, options) {
  const style = item.computedStyle || {};
  const fill = ensureFillSwatch(styles, style);
  const fillColor = fill && fill.name;
  const uniformBorder = protocolStrokeForObject(item, styles, options) || uniformBorderForObject(item, options);
  const strokeColor = uniformBorder ? uniformBorder.color : null;
  const blendMode = normalizeBlendMode(style.mixBlendMode);
  const signature = {
    fillColor,
    fillOpacity: fill && fill.alpha != null ? fill.alpha : null,
    strokeColor,
    strokeWeight: uniformBorder ? uniformBorder.widthPt : 0,
    strokeStyle: uniformBorder ? uniformBorder.style : 'none',
    strokeAlignment: uniformBorder && uniformBorder.widthPt > 0 ? (uniformBorder.alignment || 'inside') : null,
    cornerRadius: cornerRadiusValue(item, options),
    opacity: effectiveObjectOpacity(item, fill),
    ...(blendMode ? { blendMode } : {}),
  };
  const requestedName = styleNameForKind(item, 'objectStyles', signature, options)
    || stableAutoName('object', signature);
  const name = ensureNamedStyle(styles, 'objectStyles', requestedName, 'object', signature, item, report, options);
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
  if (attributes[HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE] || attributes[HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE]) return true;
  const style = item.computedStyle || {};
  return Boolean(
    ensureFillPreview(style)
    || visibleStroke(item, 'borderTopWidth', {})
    || visibleStroke(item, 'borderRightWidth', {})
    || visibleStroke(item, 'borderBottomWidth', {})
    || visibleStroke(item, 'borderLeftWidth', {})
    || Number(style.opacity || 1) < 1
    || normalizeBlendMode(style.mixBlendMode)
    || (style.borderRadius && style.borderRadius !== '0px')
  );
}

function ensureFillPreview(style) {
  return normalizeCssColor(style.backgroundColor) || singleColorGradientSwatch(style.backgroundImage);
}

function isNativeLineCandidate(item) {
  const classNames = item.classList || [];
  const objectStyle = item.attributes && item.attributes[HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE];
  return item.role === 'shape'
    && (classNames.includes('line') || /(^|-)line($|-)/.test(String(objectStyle || '')));
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

function ensureFrameStyle(styles, item, options, report) {
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
  const requestedName = styleNameForKind(item, 'frameStyles', signature, options)
    || classFrameStyleName(item, options)
    || stableAutoName('frame', signature);
  return ensureNamedStyle(styles, 'frameStyles', requestedName, 'frame', signature, item, report, options);
}

function ensureNamedStyle(styles, kind, requestedName, prefix, signature, item, report, options) {
  const collection = styles[kind];
  const baseName = requestedName || stableAutoName(prefix, signature);
  const name = compatibleStyleName(collection, baseName, prefix, signature, item, report);
  if (!collection[name]) {
    const identity = identityForRegisteredStyle(item, kind, name, baseName, options);
    collection[name] = {
      name,
      token: identity.token,
      displayName: identity.displayName,
      labels: [styleProtocolLabel(kind, identity)],
      ...signature,
    };
  }
  return name;
}

function compatibleStyleName(collection, baseName, prefix, signature, item, report) {
  if (!collection[baseName] || styleSignatureMatches(collection[baseName], signature)) return baseName;
  const variantName = `${baseName}-${styleVariantSuffix(prefix, signature)}`;
  if (!collection[variantName]) {
    addMessage(report, 'warning', 'STYLE_NAME_CONFLICT', 'Style name reused with different compiled attributes; generated a variant style', {
      itemId: item && item.id || null,
      baseName,
      variantName,
    });
    return variantName;
  }
  if (styleSignatureMatches(collection[variantName], signature)) return variantName;

  let index = 2;
  while (collection[`${variantName}-${index}`] && !styleSignatureMatches(collection[`${variantName}-${index}`], signature)) {
    index += 1;
  }
  return `${variantName}-${index}`;
}

function styleVariantSuffix(prefix, signature) {
  return stableAutoName(prefix, signature).split('-').pop();
}

function styleSignatureMatches(style, signature) {
  const existing = {};
  for (const key of Object.keys(signature)) {
    existing[key] = style ? style[key] : undefined;
  }
  return stableSignatureKey(existing) === stableSignatureKey(signature);
}

function stableSignatureKey(value) {
  return JSON.stringify(sortSignature(value));
}

function sortSignature(value) {
  if (Array.isArray(value)) return value.map(sortSignature);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = sortSignature(value[key]);
    return out;
  }, {});
}

function identityForRegisteredStyle(item, kind, name, baseName, options) {
  const identity = styleIdentityForKind(item, kind, name, options);
  if (name === baseName) return identity;
  return {
    token: name,
    displayName: name,
  };
}

function ensureSwatch(styles, cssColor) {
  const normalized = normalizeCssColor(cssColor) || normalizeHexColor(cssColor);
  return ensureNormalizedSwatch(styles, normalized);
}

function normalizeHexColor(value) {
  const text = String(value || '').trim().toLowerCase();
  const short = text.match(/^#([0-9a-f]{3})$/i);
  const full = text.match(/^#([0-9a-f]{6})$/i);
  const hex = short
    ? short[1].split('').map((char) => `${char}${char}`).join('')
    : full && full[1];
  if (!hex) return null;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return {
    hex: `#${hex}`,
    name: `颜色-${r}-${g}-${b}`,
  };
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
  if (item.role === 'graphic' && item.attributes && item.attributes[HTML_DATA_ID_ATTRIBUTES.ASSET_KIND] && cssOpacity === 0) {
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

function protocolStrokeForObject(item, styles, options) {
  const attrs = item && item.attributes || {};
  if (!hasProtocolStrokeFact(attrs)) return null;
  const widthPt = protocolStrokeWeight(attrs, options);
  const color = widthPt > 0 ? ensureSwatch(styles, attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_COLOR]) : null;
  const style = widthPt > 0
    ? (attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE] || cssBorderStyle(item) || 'solid')
    : 'none';
  return {
    color,
    widthPt,
    style,
    alignment: normalizedStrokeAlignment(attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_ALIGNMENT]),
  };
}

function hasProtocolStrokeFact(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_WEIGHT)
    || Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_COLOR)
    || Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE)
    || Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_ALIGNMENT);
}

function protocolStrokeWeight(attrs, options) {
  if (!Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_WEIGHT)) return 0;
  const value = attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_WEIGHT];
  const text = String(value == null ? '' : value).trim();
  if (!text) return 0;
  if (/[a-z%]/i.test(text)) {
    const converted = options && options.layout && options.layout.unitMode === 'presentation'
      ? styleLengthToPt({ strokeWeight: text }, 'strokeWeight', options)
      : styleLengthToPt({ strokeWeight: text }, 'strokeWeight', {});
    return Number.isFinite(Number(converted)) ? Number(converted) : 0;
  }
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? round(number, 4) : 0;
}

function cssBorderStyle(item) {
  const style = item && item.computedStyle || {};
  return style.borderTopStyle || style.borderRightStyle || style.borderBottomStyle || style.borderLeftStyle || null;
}

function normalizedStrokeAlignment(value) {
  const key = String(value || '').trim().toLowerCase();
  return ['inside', 'outside', 'center'].includes(key) ? key : null;
}

function uniformBorderForObject(item, options) {
  const box = compileBoxModel(item, createEmptyStyleModel(), options);
  const edges = [box.borders.top, box.borders.right, box.borders.bottom, box.borders.left];
  if (!edges.every((edge) => visibleCompiledBorder(edge))) return null;
  const first = edges[0];
  const uniform = edges.every((edge) => edge.color === first.color
    && edge.style === first.style
    && Math.abs(Number(edge.widthPt || 0) - Number(first.widthPt || 0)) < 0.01);
  return uniform ? { ...first, alignment: null } : null;
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

module.exports = {
  createEmptyStyleModel,
  compileStyles,
};
