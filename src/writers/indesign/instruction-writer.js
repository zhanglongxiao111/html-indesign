const { createReport, addMessage } = require('../../shared/report');
const { parseCssLength, round } = require('../../shared/geometry');
const { placementFromAttributes } = require('../../adapters/html/reader/asset-detector');
const { normalizeCssColor } = require('../../shared/style-utils');
const { assetSourceFromElementLike } = require('../../shared/assets');
const { createProtocolLabel } = require('../../shared/labels');
const {
  itemBounds,
  cssLengthToTarget,
  cssLengthToMm,
  normalizeVisualMm,
} = require('../../semantic-model/layout');

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
      ...page.items.flatMap((item) => instructionItemsFor(item, model.assets || [], rawPage, layout, options)),
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

function instructionItemsFor(modelItem, assets, page, layout, options) {
  const item = modelItem.raw || modelItem;
  const baseItem = instructionItemFor(modelItem, assets, page, layout, options);
  if (!baseItem) return [];
  return [
    baseItem,
    ...decorationItemsFor(item, baseItem, layout),
  ].map(ensureItemLabels);
}

function instructionItemFor(modelItem, assets, page, layout, options) {
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
    return {
      ...base,
      type: 'TEXT',
      bounds: textFrameBounds(item, base.bounds, layout),
      text: content.text,
      paragraphStyle: styleRefs.paragraphStyle,
      objectStyle: styleRefs.objectStyle,
      frameStyle: styleRefs.frameStyle,
      runs: content.runs || [],
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
  const line = nativeLineFor(item, base.bounds, layout);
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

function guideInstructionsFor(page) {
  return (page.guides || []).map((guide, index) => ({
    ...guide,
    labels: labelsFor(guide.labels, {
      kind: 'guide',
      id: `${page.id}-guide-${index + 1}`,
      source: 'html-to-indesign',
      pageId: page.id,
      orientation: guide.orientation,
      position: guide.position,
      guideSource: guide.source || null,
    }),
  }));
}

function ensureItemLabels(item) {
  if (!item) return item;
  return {
    ...item,
    labels: labelsFor(item.labels, {
      kind: 'item',
      id: item.id,
      source: 'html-to-indesign',
      role: item.role || String(item.type || '').toLowerCase(),
      generated: item.role === 'background' || item.role === 'decoration',
    }),
  };
}

function labelsFor(labels, fallback) {
  return Array.isArray(labels) && labels.length ? labels : [createProtocolLabel(fallback)];
}

function effectsForInstruction(effects, page, layout) {
  if (!effects || layout.unitMode !== 'presentation') return effects || null;
  const out = { ...effects };
  if (effects.gradientFeather) {
    out.gradientFeather = {
      ...effects.gradientFeather,
      start: pagePointToTarget(effects.gradientFeather.start, page, layout),
      length: pageLengthToTarget(effects.gradientFeather.length, page, layout),
    };
  }
  return out;
}

function pagePointToTarget(point, page, layout) {
  const scale = pageScaleFromMm(page, layout);
  return {
    x: roundEffectCoordinate(Number(point && point.x || 0) * scale.x),
    y: roundEffectCoordinate(Number(point && point.y || 0) * scale.y),
  };
}

function pageLengthToTarget(length, page, layout) {
  if (!Number.isFinite(Number(length))) return length;
  return roundEffectCoordinate(Number(length) * pageScaleFromMm(page, layout).x);
}

function pageScaleFromMm(page, layout) {
  return {
    x: Number(layout.targetSize && layout.targetSize.width || 0) / Number(page.widthMm || 1),
    y: Number(layout.targetSize && layout.targetSize.height || 0) / Number(page.heightMm || 1),
  };
}

function roundEffectCoordinate(value) {
  const rounded = round(value, 2);
  const nearestInteger = Math.round(rounded);
  return Math.abs(rounded - nearestInteger) < 0.05 ? nearestInteger : rounded;
}

function textFrameBounds(item, bounds, layout) {
  if (layout.unitMode !== 'presentation') return bounds;
  const minHeight = minimumTextFrameHeight(item, layout);
  const minWidth = minimumTextFrameWidth(item, layout);
  return {
    ...bounds,
    width: minWidth && Number(bounds.width || 0) < minWidth ? round(minWidth, 2) : bounds.width,
    height: minHeight && Number(bounds.height || 0) < minHeight ? round(minHeight, 2) : bounds.height,
  };
}

function minimumTextFrameHeight(item, layout) {
  const style = item.computedStyle || {};
  const lineHeight = cssLengthToTarget(style.lineHeight, layout)
    || round(cssLengthToTarget(style.fontSize, layout) * 1.2, 2);
  if (!lineHeight) return 0;
  return round(lineHeight * textLineCount(item), 2);
}

function textLineCount(item) {
  const text = item && item.content && item.content.text ? item.content.text : item && item.text;
  return Math.max(1, String(text || '').split(/\r\n|\r|\n/).length);
}

function minimumTextFrameWidth(item, layout) {
  if (!usesAutoInlineWidth(item)) return 0;
  const style = item.computedStyle || {};
  const fontSize = cssLengthToTarget(style.fontSize, layout);
  if (!fontSize) return 0;
  const text = String(item && item.content && item.content.text ? item.content.text : item && item.text || '');
  const longestLine = text.split(/\r\n|\r|\n/).reduce((max, line) => Math.max(max, line.length), 0);
  return round(longestLine * fontSize * 0.65 + fontSize * 0.35, 2);
}

function usesAutoInlineWidth(item) {
  const style = item.computedStyle || {};
  const authored = item.authoredStyle || {};
  return (String(item.tagName || '').toLowerCase() === 'span' && !authored.width)
    || String(style.display || '').toLowerCase() === 'inline'
    || String(style.width || '').toLowerCase() === 'auto';
}

function tableRowsForInstruction(item, page, layout) {
  const rows = item.content.rows || [];
  if (layout.unitMode !== 'presentation') return rows;
  return rows.map((row) => ({
    ...row,
    cells: (row.cells || []).map((cell) => {
      const raw = tableCellSnapshot(item, row.index, cell.index);
      return {
        ...cell,
        bounds: raw && raw.rectPx ? itemBounds({ rectPx: raw.rectPx, boundsMm: cell.bounds }, page, layout) : scaleBounds(cell.bounds, layout),
      };
    }),
  }));
}

function tableCellSnapshot(item, rowIndex, cellIndex) {
  const row = (item.table || []).find((candidate) => Number(candidate.index) === Number(rowIndex));
  if (!row) return null;
  return (row.cells || []).find((candidate) => Number(candidate.index) === Number(cellIndex)) || null;
}

function tableColumnWidthsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.columnWidths || [];
  const sourceRow = (rows || []).find((row) => (row.cells || []).every((cell) => cell.bounds && Number(cell.bounds.width) > 0));
  if (!sourceRow) return [];
  const widths = [];
  for (const cell of sourceRow.cells || []) {
    const span = Math.max(1, Number(cell.colSpan || 1));
    const width = Number(cell.bounds.width || 0) / span;
    for (let index = 0; index < span; index += 1) widths.push(round(width, 2));
  }
  return widths;
}

function tableRowHeightsForInstruction(item, rows, layout) {
  if (layout.unitMode !== 'presentation') return item.content.rowHeights || [];
  return (rows || []).map((row) => {
    const height = (row.cells || []).reduce((max, cell) => Math.max(max, Number(cell.bounds && cell.bounds.height || 0), minimumTableCellHeight(cell)), 0);
    return round(height, 2);
  });
}

function minimumTableCellHeight(cell) {
  const padding = cell.padding || {};
  const leading = Number(cell.leading || 0) || Number(cell.pointSize || 0) * 1.2;
  const stroke = Number(cell.borderWeight || 0);
  return Number(padding.top || 0) + Number(padding.bottom || 0) + leading + stroke * 2;
}

function scaleBounds(bounds, layout) {
  if (!bounds) return null;
  const scale = Number(layout.scale || 1);
  return {
    x: round(Number(bounds.x || 0) * scale, 2),
    y: round(Number(bounds.y || 0) * scale, 2),
    width: round(Number(bounds.width || 0) * scale, 2),
    height: round(Number(bounds.height || 0) * scale, 2),
  };
}

function nativeTableBounds(bounds, rowHeights, layout) {
  const rowTotal = (rowHeights || []).reduce((sum, height) => sum + Number(height || 0), 0);
  const slack = layout && layout.unitMode === 'presentation' ? 12 : 1;
  const requiredHeight = rowTotal > 0 ? rowTotal + slack : 0;
  if (requiredHeight <= Number(bounds.height || 0)) return bounds;
  return {
    ...bounds,
    height: round(requiredHeight, 2),
  };
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

function nativeLineFor(item, baseBounds, layout) {
  if (!item || item.role !== 'shape') return null;
  const classNames = item.classList || [];
  const objectStyle = item.styleRefs && item.styleRefs.objectStyle;
  const explicitLine = classNames.includes('line') || /(^|-)line($|-)/.test(String(objectStyle || ''));
  const edge = item.box && item.box.borders && item.box.borders.top;
  if (!explicitLine || !visibleBorder(edge)) return null;
  const bounds = layout.unitMode === 'presentation'
    ? {
      x: styleLengthTarget(item, 'left', baseBounds.x, layout),
      y: styleLengthTarget(item, 'top', baseBounds.y, layout),
      width: styleLengthTarget(item, 'width', baseBounds.width, layout),
      height: styleLengthTarget(item, 'height', 0, layout),
    }
    : {
      x: styleLengthMm(item, 'left', item.boundsMm.x),
      y: styleLengthMm(item, 'top', item.boundsMm.y),
      width: styleLengthMm(item, 'width', item.boundsMm.width),
      height: styleLengthMm(item, 'height', 0),
    };
  return {
    bounds,
    rotationAngle: rotationAngleFor(item),
    strokeColor: edge.color,
    strokeWeight: edge.widthPt,
  };
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

function paddingForItem(item, layout) {
  if (layout.unitMode === 'presentation') {
    const style = item.computedStyle || {};
    return {
      top: cssLengthToTarget(style.paddingTop, layout),
      right: cssLengthToTarget(style.paddingRight, layout),
      bottom: cssLengthToTarget(style.paddingBottom, layout),
      left: cssLengthToTarget(style.paddingLeft, layout),
    };
  }
  const style = item.computedStyle || {};
  return {
    top: normalizeVisualMm(cssLengthToMm(style.paddingTop)),
    right: normalizeVisualMm(cssLengthToMm(style.paddingRight)),
    bottom: normalizeVisualMm(cssLengthToMm(style.paddingBottom)),
    left: normalizeVisualMm(cssLengthToMm(style.paddingLeft)),
  };
}

function graphicContentBounds(item, bounds, layout, placement = null) {
  const explicit = explicitGraphicContentBounds(bounds, placement, layout);
  if (explicit) return explicit;
  const padding = paddingForItem(item, layout);
  if (!padding.top && !padding.right && !padding.bottom && !padding.left) return null;
  return insetBounds(bounds, padding);
}

function explicitGraphicContentBounds(bounds, placement, layout) {
  if (!placement) return null;
  if (placement.contentBox) {
    const box = placement.contentBox;
    return {
      x: round(bounds.x + cssLengthToTarget(box.x, layout), 2),
      y: round(bounds.y + cssLengthToTarget(box.y, layout), 2),
      width: round(cssLengthToTarget(box.width, layout), 2),
      height: round(cssLengthToTarget(box.height, layout), 2),
    };
  }
  if (placement.contentBounds) {
    const box = placement.contentBounds;
    return {
      x: round(numberOrCssLength(box.x, layout), 2),
      y: round(numberOrCssLength(box.y, layout), 2),
      width: round(numberOrCssLength(box.width, layout), 2),
      height: round(numberOrCssLength(box.height, layout), 2),
    };
  }
  return null;
}

function numberOrCssLength(value, layout) {
  return typeof value === 'number' ? value : cssLengthToTarget(value, layout);
}

function insetBounds(bounds, padding) {
  const width = Math.max(0, bounds.width - padding.left - padding.right);
  const height = Math.max(0, bounds.height - padding.top - padding.bottom);
  return {
    x: round(bounds.x + padding.left, 2),
    y: round(bounds.y + padding.top, 2),
    width: round(width, 2),
    height: round(height, 2),
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

function assetForItem(item, assets) {
  const source = assetSourceFromElementLike({
    tagName: item.tagName,
    attributes: item.attributes,
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle,
  }).src;
  return assets.find((asset) => source && asset.src === source)
    || assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || null;
}

function placementForItem(item, asset) {
  const itemPlacement = placementFromAttributes(item.attributes || {}, item.computedStyle || {});
  const assetPlacement = asset.placement || {};
  const sameSource = asset.sourceSelector && item.sourceSelector && asset.sourceSelector === item.sourceSelector;
  return {
    fit: itemPlacement.fit || assetPlacement.fit || 'fill',
    position: itemPlacement.position || assetPlacement.position || '50% 50%',
    pageNumber: itemPlacement.pageNumber || (sameSource ? assetPlacement.pageNumber : undefined),
    crop: itemPlacement.crop || (sameSource ? assetPlacement.crop : undefined),
    artboard: itemPlacement.artboard || (sameSource ? assetPlacement.artboard : undefined),
    layerComp: itemPlacement.layerComp || (sameSource ? assetPlacement.layerComp : undefined),
    visibleLayers: itemPlacement.visibleLayers || (sameSource ? assetPlacement.visibleLayers : undefined),
    hiddenLayers: itemPlacement.hiddenLayers || (sameSource ? assetPlacement.hiddenLayers : undefined),
    preserveVector: itemPlacement.preserveVector || (sameSource ? assetPlacement.preserveVector : undefined),
    contentBox: itemPlacement.contentBox || (sameSource ? assetPlacement.contentBox : undefined),
    contentBounds: itemPlacement.contentBounds || (sameSource ? assetPlacement.contentBounds : undefined),
  };
}

function layerForModelItem(modelItem, options) {
  if (modelItem.layer) return mappedLayerName(modelItem.layer, options);
  return layerForItem(modelItem.raw || modelItem, options);
}

function layerForItem(item, options) {
  let token = 'content';
  if (item.attributes && item.attributes['data-id-layer']) token = item.attributes['data-id-layer'];
  else if (item.role === 'text') token = 'text';
  else if (item.role === 'graphic') token = 'graphics';
  else if (item.role === 'table') token = 'tables';
  return mappedLayerName(token, options);
}

function collectLayers(pages, options) {
  const names = new Map();
  for (const token of ['background', 'image', 'drawing', 'graphics', 'content', 'overlay', 'tables', 'text', 'annotation', 'annotations']) {
    names.set(mappedLayerName(token, options), names.size);
  }
  for (const page of pages) {
    for (const item of page.items) {
      if (!names.has(item.layer)) names.set(item.layer, names.size);
    }
  }
  return Array.from(names.keys()).sort((a, b) => {
    const rankA = layerRank(a);
    const rankB = layerRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return names.get(a) - names.get(b);
  }).map((name, index) => layerInstruction(name, name, index));
}

function layerInstruction(token, displayName, order) {
  return {
    token,
    name: displayName || token,
    order,
    labels: [createProtocolLabel({
      kind: 'layer',
      id: `layer-${token}`,
      source: 'html-to-indesign',
      token,
      displayName: displayName || token,
    })],
  };
}

function layerRank(name) {
  const ranks = {
    background: 0,
    '背景': 0,
    image: 10,
    '图片': 10,
    drawing: 20,
    '图纸': 20,
    graphics: 30,
    '图形': 30,
    content: 40,
    '内容': 40,
    overlay: 50,
    '遮罩': 50,
    tables: 60,
    '表格': 60,
    text: 70,
    '文字': 70,
    annotation: 80,
    '标注': 80,
    annotations: 80,
    '标注组': 80,
  };
  return ranks[name] == null ? 45 : ranks[name];
}

function mappedLayerName(token, options) {
  const map = (options && options.layerNameMap)
    || (options && options.styleNameMap && options.styleNameMap.layers)
    || null;
  return map && map[token] ? map[token] : token;
}

module.exports = {
  semanticModelToInstructions,
};
