const { createReport, addMessage } = require('../../shared/report');
const { parseCssLength, round } = require('../../shared/geometry');
const { normalizeCssColor } = require('../../shared/style-utils');
const {
  itemBounds,
  cssLengthToTarget,
  cssLengthToMm,
  normalizeVisualMm,
} = require('../../semantic-model/layout');
const {
  graphicContentBounds,
  paddingForItem,
  insetBounds,
  assetForItem,
  placementForItem,
} = require('./graphic-instructions');
const { guideInstructionsFor, ensureItemLabels } = require('./guide-instructions');
const { layerForModelItem, collectLayers, mappedLayerName } = require('./layer-instructions');
const {
  tableRowsForInstruction,
  tableColumnWidthsForInstruction,
  tableRowHeightsForInstruction,
  nativeTableBounds,
} = require('./table-instructions');
const {
  effectsForInstruction,
  runsForInstruction,
  textForInstruction,
  textFrameBounds,
  textFitPolicy,
} = require('./text-instructions');

function semanticModelToInstructions(model, options = {}) {
  const layout = model.layoutInfo || {
    unitMode: model.unitMode || 'print',
    targetUnit: model.coordinateUnit || 'mm',
    targetSize: model.pageSize || null,
    scale: 1,
  };
  const report = createReport();
  addMessage(report, 'info', 'INSTRUCTIONS_COMPILE_START', 'Build instructions compilation started', {
    pageCount: model.pages.length,
  });
  mergeReport(report, model.report);

  const pages = model.pages.map((page) => {
    const rawPage = page.raw || page;
    const dimensions = { width: page.width, height: page.height };
    const guides = guideInstructionsFor(page);
    const background = ensureItemLabels(pageBackgroundItemFor(rawPage, model.styles || {}, dimensions, options));
    const items = [
      background,
      ...page.items.flatMap((item) => instructionItemsFor(item, model.assets || [], rawPage, layout, options, model.styles || {})),
    ].filter(Boolean).sort((a, b) => a.zIndex - b.zIndex);
    return {
      id: page.id,
      index: page.index,
      parentPageId: page.parentPageId || null,
      parentPageName: page.parentPageName || null,
      layout: page.layout || null,
      width: dimensions.width,
      height: dimensions.height,
      margins: page.margins,
      guides,
      labels: page.labels || [],
      items,
    };
  });
  const layers = collectLayers(pages, options);

  return {
    metadata: {
      source: model.source,
      generatedAt: new Date().toISOString(),
      compiler: 'html-indesign/semantic-model-to-instructions',
      mode: options.mode || 'editable-first',
      protocolVersion: 1,
    },
    document: {
      id: model.id,
      unitMode: model.unitMode,
      coordinateUnit: model.coordinateUnit,
      labels: model.labels || [],
      parentPages: model.parentPages || [],
      pages: pages.map((page) => ({
        id: page.id,
        width: page.width,
        height: page.height,
        parentPageId: page.parentPageId || null,
        parentPageName: page.parentPageName || null,
        layout: page.layout || null,
        margins: page.margins,
        guides: page.guides,
        labels: page.labels || [],
      })),
    },
    styles: model.styles || {},
    assets: model.assets || [],
    layers,
    pages,
    warnings: model.warnings || [],
    report,
  };
}

function instructionItemsFor(modelItem, assets, page, layout, options, styles) {
  const item = modelItem.raw || modelItem;
  const baseItem = instructionItemFor(modelItem, assets, page, layout, options, styles);
  if (!baseItem) return [];
  return [
    baseItem,
    ...decorationItemsFor(item, baseItem, layout),
  ].map(ensureItemLabels);
}

function instructionItemFor(modelItem, assets, page, layout, options, styles) {
  const item = modelItem.raw || modelItem;
  const styleRefs = modelItem.styleRefs || item.styleRefs || {};
  const content = modelItem.content || item.content || { text: item.text || '', runs: item.runs || [] };
  const base = {
    id: modelItem.id,
    role: modelItem.role || item.role,
    bounds: modelItem.bounds || itemBounds(item, page, layout),
    zIndex: modelItem.zIndex || item.zIndex || 0,
    layer: layerForModelItem(modelItem, options),
    sourceSelector: modelItem.sourceSelector || item.sourceSelector,
    styleRefs,
    labels: modelItem.labels || [],
    effects: effectsForInstruction(modelItem.effects || item.effects || null, page, layout),
  };
  if (base.role === 'text') {
    const textFit = textFitPolicy(modelItem, options);
    const text = textForInstruction(modelItem, content);
    return {
      ...base,
      type: 'TEXT',
      bounds: textFrameBounds(item, base.bounds, layout),
      text,
      paragraphStyle: styleRefs.paragraphStyle,
      objectStyle: styleRefs.objectStyle,
      frameStyle: styleRefs.frameStyle,
      runs: runsForInstruction(modelItem, content, text),
      ...(textFit ? { textFit } : {}),
    };
  }
  if (base.role === 'graphic') {
    const asset = assetForItem(item, assets);
    const placement = asset ? placementForItem(item, asset) : null;
    const contentBounds = graphicContentBounds(item, base.bounds, layout, placement);
    return {
      ...base,
      type: 'GRAPHIC',
      objectStyle: styleRefs.objectStyle,
      frameStyle: styleRefs.frameStyle,
      contentBounds,
      placed: asset ? {
        assetId: asset.id,
        fit: placement.fit,
        position: placement.position,
        pageNumber: placement.pageNumber,
        crop: placement.crop,
        artboard: placement.artboard,
        layerComp: placement.layerComp,
        visibleLayers: placement.visibleLayers,
        hiddenLayers: placement.hiddenLayers,
        preserveVector: placement.preserveVector,
        contentBounds,
      } : null,
    };
  }
  if (base.role === 'table') {
    const rows = tableRowsForInstruction(item, page, layout);
    const rowHeights = tableRowHeightsForInstruction(item, rows, layout);
    const columnWidths = tableColumnWidthsForInstruction(item, rows, layout);
    return {
      ...base,
      type: 'TABLE',
      bounds: nativeTableBounds(base.bounds, rowHeights || [], layout),
      tableStyle: styleRefs.tableStyle,
      objectStyle: styleRefs.objectStyle,
      frameStyle: styleRefs.frameStyle,
      text: item.text,
      rows,
      columnCount: item.content.columnCount || 0,
      columnWidths,
      rowHeights,
    };
  }
  const line = nativeLineFor(modelItem, item, base.bounds, layout, styles);
  if (line) {
    return {
      ...base,
      ...line,
      type: 'LINE',
      objectStyle: styleRefs.objectStyle,
      frameStyle: null,
    };
  }
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: styleRefs.objectStyle,
    frameStyle: styleRefs.frameStyle,
    shapeKind: shapeKindFor(item),
  };
}

function mergeReport(target, source) {
  if (!source || !Array.isArray(source.messages)) return;
  for (const message of source.messages) {
    target.messages.push(message);
    if (message.level === 'error') target.errorCount += 1;
    if (message.level === 'warning') target.warningCount += 1;
  }
}

function pageBackgroundItemFor(page, styles, dimensions, options) {
  const style = page.computedStyle || {};
  const fill = normalizeCssColor(style.backgroundColor);
  if (!fill) return null;
  ensureInstructionSwatch(styles, fill);
  return {
    id: `${page.id}-background`,
    role: 'background',
    type: 'SHAPE',
    bounds: { x: 0, y: 0, width: dimensions.width, height: dimensions.height },
    zIndex: -1000,
    layer: mappedLayerName('background', options),
    sourceSelector: `#${page.id}`,
    styleRefs: {},
    objectStyle: null,
    frameStyle: null,
    styleOverride: {
      fillColor: fill.name,
      fillOpacity: fill.alpha == null ? null : fill.alpha,
      strokeWeight: 0,
    },
  };
}

function ensureInstructionSwatch(styles, normalized) {
  if (!styles || !normalized || !normalized.name) return;
  styles.swatches = styles.swatches || {};
  if (!styles.swatches[normalized.name]) {
    styles.swatches[normalized.name] = {
      name: normalized.name,
      model: 'process',
      space: 'RGB',
      value: normalized.hex,
    };
  }
}

function nativeLineFor(modelItem, rawItem, baseBounds, layout, styles) {
  const item = modelItem || rawItem;
  const raw = rawItem || modelItem || {};
  if (!item) return null;
  const classNames = item.classList || raw.classList || [];
  const styleRefs = item.styleRefs || raw.styleRefs || {};
  const objectStyle = styleRefs.objectStyle;
  const sourceLine = sourceLineStroke(item) || sourceLineStroke(raw);
  const objectStyleStroke = objectStyleLineStroke(styles, objectStyle, baseBounds);
  const explicitLine = (item.role || raw.role) === 'line'
    || classNames.includes('line')
    || /(^|-)line($|-)/.test(String(objectStyle || ''))
    || sourceNodeAttribute(item, 'data-id-vector') === 'line'
    || sourceNodeAttribute(raw, 'data-id-vector') === 'line';
  const thinVectorLine = (sourceLine || objectStyleStroke) && lineLikeBounds(baseBounds);
  const edge = raw.box && raw.box.borders && raw.box.borders.top;
  const stroke = visibleBorder(edge)
    ? { color: edge.color, weight: edge.widthPt }
    : sourceLine || objectStyleStroke;
  const styleItem = raw || item;
  const rawBoundsMm = styleItem.boundsMm || baseBounds || {};
  if ((!explicitLine && !thinVectorLine) || !stroke || !stroke.weight) return null;
  const bounds = layout.unitMode === 'presentation'
    ? {
      x: styleLengthTarget(styleItem, 'left', baseBounds.x, layout),
      y: styleLengthTarget(styleItem, 'top', baseBounds.y, layout),
      width: styleLengthTarget(styleItem, 'width', baseBounds.width, layout),
      height: styleLengthTarget(styleItem, 'height', baseBounds.height, layout),
    }
    : {
      x: styleLengthMm(styleItem, 'left', rawBoundsMm.x),
      y: styleLengthMm(styleItem, 'top', rawBoundsMm.y),
      width: styleLengthMm(styleItem, 'width', rawBoundsMm.width),
      height: styleLengthMm(styleItem, 'height', rawBoundsMm.height),
    };
  return {
    bounds,
    rotationAngle: rotationAngleFor(styleItem),
    strokeColor: stroke.color,
    strokeWeight: stroke.weight,
  };
}

function objectStyleLineStroke(styles, objectStyleName, bounds) {
  if (!lineLikeBounds(bounds) || !objectStyleName) return null;
  const def = styles && styles.objectStyles && styles.objectStyles[objectStyleName];
  if (!def || def.fillColor || !def.strokeColor) return null;
  const weight = Number(def.strokeWeight || 0);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return { color: def.strokeColor, weight };
}

function lineLikeBounds(bounds) {
  return Math.abs(Number(bounds && bounds.width || 0)) < 0.01
    || Math.abs(Number(bounds && bounds.height || 0)) < 0.01;
}

function sourceLineStroke(item) {
  const html = sourceHtmlForItem(item);
  if (!html || !/<path\b/i.test(html)) return null;
  const stroke = attrValue(html, 'stroke');
  const width = attrValue(html, 'stroke-width');
  if (!stroke || stroke === 'none' || !width) return null;
  const color = normalizeLineStrokeColor(stroke);
  const weight = Number.parseFloat(width);
  if (!color || !Number.isFinite(weight) || weight <= 0) return null;
  return { color, weight };
}

function sourceHtmlForItem(item) {
  if (item && item.sourceHtml) return item.sourceHtml;
  for (const label of item && item.labels || []) {
    if (label && label.sourceHtml) return label.sourceHtml;
    if (label && label.sourceNode && label.sourceNode.sourceHtml) return label.sourceNode.sourceHtml;
  }
  return '';
}

function sourceNodeAttribute(item, name) {
  const direct = item && item.sourceNode && item.sourceNode.attributes;
  if (direct && direct[name] != null) return direct[name];
  for (const label of item && item.labels || []) {
    const attrs = label && label.sourceNode && label.sourceNode.attributes;
    if (attrs && attrs[name] != null) return attrs[name];
  }
  return null;
}

function attrValue(html, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i');
  const match = pattern.exec(String(html || ''));
  return match ? String(match[2] || '').trim().toLowerCase() : null;
}

function normalizeLineStrokeColor(value) {
  const text = String(value || '').trim().toLowerCase();
  const rgb = normalizeCssColor(text);
  if (rgb) return rgb.name;
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  const full = hex[1].length === 3
    ? hex[1].split('').map((char) => `${char}${char}`).join('')
    : hex[1];
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `颜色-${r}-${g}-${b}`;
}

function shapeKindFor(item) {
  if (!item || item.role !== 'shape') return 'rectangle';
  const radius = styleValue(item, 'borderRadius');
  const bounds = item.boundsMm || {};
  if (String(radius || '').trim() === '50%' && Math.abs(Number(bounds.width || 0) - Number(bounds.height || 0)) < 0.5) {
    return 'oval';
  }
  return 'rectangle';
}

function rotationAngleFor(item) {
  const raw = styleValue(item, 'transform');
  const rotate = String(raw || '').match(/rotate\(\s*([+-]?(?:\d+|\d*\.\d+))deg\s*\)/i);
  if (rotate) return round(Number(rotate[1]), 2);
  const matrix = String(raw || '').match(/^matrix\(\s*([+-]?(?:\d+|\d*\.\d+)),\s*([+-]?(?:\d+|\d*\.\d+)),/i);
  if (matrix) return round(Math.atan2(Number(matrix[2]), Number(matrix[1])) * 180 / Math.PI, 2);
  return 0;
}

function styleLengthMm(item, prop, fallback) {
  const raw = styleValue(item, prop);
  const parsed = parseCssLength(raw);
  if (!parsed) return normalizeVisualMm(Number(fallback || 0));
  return normalizeVisualMm(cssLengthToMm(raw));
}

function styleLengthTarget(item, prop, fallback, layout) {
  const raw = styleValue(item, prop);
  const parsed = parseCssLength(raw);
  if (!parsed) return round(Number(fallback || 0), 2);
  return cssLengthToTarget(raw, layout);
}

function styleValue(item, prop) {
  return (item.authoredStyle && item.authoredStyle[prop])
    || (item.computedStyle && item.computedStyle[prop])
    || '';
}

function decorationItemsFor(item, baseItem, layout) {
  if (baseItem.type !== 'SHAPE' && baseItem.type !== 'GRAPHIC') return [];
  const decorations = borderDecorationItemsFor(item, baseItem, layout);
  const objectText = objectTextItemFor(item, baseItem, layout);
  if (objectText) decorations.push(objectText);
  return decorations;
}

function borderDecorationItemsFor(item, baseItem, layout) {
  const borders = item.box && item.box.borders;
  if (!borders || bordersAreUniform(borders)) return [];
  const decorations = [];
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const edge = borders[side];
    if (!visibleBorder(edge)) continue;
    const width = borderEdgeWidth(edge, layout);
    if (!width) continue;
    decorations.push({
      id: `${item.id}-border-${side}`,
      role: 'decoration',
      type: 'SHAPE',
      bounds: borderDecorationBounds(baseItem.bounds, side, width),
      zIndex: round((baseItem.zIndex || 0) + 0.02, 2),
      layer: baseItem.layer,
      sourceSelector: baseItem.sourceSelector,
      styleRefs: {},
      objectStyle: null,
      frameStyle: null,
      styleOverride: {
        fillColor: edge.color,
        strokeWeight: 0,
      },
    });
  }
  return decorations;
}

function borderEdgeWidth(edge, layout) {
  const raw = layout.unitMode === 'presentation'
    ? Number(edge.widthPt || 0)
    : cssLengthToMm(edge.widthCss);
  return normalizeVisualMm(raw);
}

function borderDecorationBounds(bounds, side, width) {
  const safeWidth = Math.min(width, bounds.width);
  const safeHeight = Math.min(width, bounds.height);
  if (side === 'top') {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: safeHeight };
  }
  if (side === 'right') {
    return { x: round(bounds.x + bounds.width - safeWidth, 2), y: bounds.y, width: safeWidth, height: bounds.height };
  }
  if (side === 'bottom') {
    return { x: bounds.x, y: round(bounds.y + bounds.height - safeHeight, 2), width: bounds.width, height: safeHeight };
  }
  return { x: bounds.x, y: bounds.y, width: safeWidth, height: bounds.height };
}

function objectTextItemFor(item, baseItem, layout) {
  if (baseItem.type !== 'SHAPE') return null;
  if (!item.content || !item.content.text) return null;
  const padding = paddingForItem(item, layout);
  return {
    id: `${item.id}-text`,
    role: 'text',
    type: 'TEXT',
    bounds: insetBounds(baseItem.bounds, padding),
    zIndex: round((baseItem.zIndex || 0) + 0.03, 2),
    layer: baseItem.layer,
    sourceSelector: baseItem.sourceSelector,
    styleRefs: item.styleRefs,
    text: item.content.text,
    paragraphStyle: item.styleRefs.paragraphStyle,
    runs: item.content.runs || [{ text: item.content.text, characterStyle: null }],
  };
}

function visibleBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.widthPt || 0) > 0;
}

function bordersAreUniform(borders) {
  return sameBorder(borders.top, borders.right)
    && sameBorder(borders.top, borders.bottom)
    && sameBorder(borders.top, borders.left);
}

function sameBorder(a, b) {
  if (!visibleBorder(a) && !visibleBorder(b)) return true;
  if (!visibleBorder(a) || !visibleBorder(b)) return false;
  return a.color === b.color
    && a.style === b.style
    && Math.abs(Number(a.widthPt || 0) - Number(b.widthPt || 0)) < 0.01;
}

module.exports = {
  semanticModelToInstructions,
};
