const { HTML_DATA_ID_ATTRIBUTES, ITEM_ROLE } = require('../../protocol');
const { createReport, addMessage } = require('../../shared/report');
const { parseCssLength, round } = require('../../shared/geometry');
const { normalizeCssColor } = require('../../shared/style-utils');
const { normalizeBlendMode } = require('../../shared/blend-mode');
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
const { layerForModelItem, collectLayers } = require('./layer-instructions');
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
const { applyBackgroundParentPages } = require('./background-instructions');
const {
  effectiveParentPageRefForPage,
  filterEffectiveParentPages,
  isParentPagePasteboardItem,
  parentPageKeySet,
  parentPageWritebackItemId,
} = require('../../semantic-model/parent-pages');
const { applySynthesizedStyleInstructions } = require('./synthesized-style-instructions');
const { bordersAreUniform, visibleBorder } = require('../../style-synthesis/box-model');
const { normalizeInstructionText } = require('../../shared/text');

function semanticModelToInstructions(model, options = {}) {
  model = applySynthesizedStyleInstructions(model);
  const layout = model.styleLayout || model.layoutInfo || {
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

  const effectiveSourceParentPages = filterEffectiveParentPages(
    model.parentPages || [],
    model.pages || [],
    hasEffectiveInstructionParentPageContent,
  );
  const effectiveParentPageKeys = parentPageKeySet(effectiveSourceParentPages);
  const pages = model.pages.map((page) => {
    const rawPage = page.raw || page;
    const dimensions = { width: page.width, height: page.height };
    const guides = guideInstructionsFor(page);
    const parentPageRef = effectiveParentPageRefForPage(page, effectiveParentPageKeys);
    const items = [
      ...page.items.flatMap((item) => instructionItemsFor(item, model.assets || [], rawPage, layout, options, model.styles || {}, report, page.items)),
    ].filter(Boolean).sort((a, b) => a.zIndex - b.zIndex);
    const parentPageItemOverrides = parentPageItemOverridesFor(page, parentPageRef, effectiveSourceParentPages, layout, report);
    return {
      id: page.id,
      index: page.index,
      parentPageId: parentPageRef.id,
      parentPageName: parentPageRef.name,
      layout: page.layout || null,
      width: dimensions.width,
      height: dimensions.height,
      margins: page.margins,
      guides,
      labels: page.labels || [],
      items,
      ...(parentPageItemOverrides.length ? { parentPageItemOverrides } : {}),
    };
  });
  const parentPages = effectiveSourceParentPages.map((parentPage) => (
    parentPageInstructionFor(parentPage, model, layout, options, report)
  ));
  applyBackgroundParentPages({
    modelPages: model.pages,
    instructionPages: pages,
    parentPages,
    styles: model.styles || {},
    options,
    ensureSwatch: ensureInstructionSwatch,
  });
  const layers = collectLayers([...pages, ...parentPages], options, model.layers || []);

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
      parentPages,
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

function parentPageItemOverridesFor(page, parentPageRef, parentPages, layout, report) {
  const instances = Array.isArray(page.parentPageItems) ? page.parentPageItems : [];
  if (!instances.length) return [];
  if (!parentPageRef || !parentPageRef.id) {
    addMessage(report, 'warning', 'PARENT_PAGE_ITEM_OVERRIDE_SKIPPED', 'Page declares parent-page furniture but no effective parent page; furniture instances stay page-local facts only.', {
      pageId: page.id,
      itemIds: instances.map((item) => item.id),
    });
    return [];
  }
  const parentItems = parentPageItemsForRef(parentPages, parentPageRef);
  const overrides = [];
  for (const item of instances) {
    if (isParentPagePasteboardItem(item)) continue;
    if (isParentPageWritebackEcho(item, page, parentItems)) continue;
    if (item.role !== 'text') {
      addMessage(report, 'warning', 'PARENT_PAGE_ITEM_OVERRIDE_UNSUPPORTED', 'Only text parent-page furniture supports per-page overrides; non-text furniture keeps the parent page content.', {
        pageId: page.id,
        itemId: item.id,
        role: item.role,
      });
      continue;
    }
    const content = item.content || { text: '', runs: [] };
    const text = textForInstruction(item, content);
    overrides.push({
      id: item.id,
      parentPageSourceId: item.parentPageSourceId || item.id,
      role: 'text',
      type: 'TEXT',
      text,
      runs: runsForInstruction(item, content, text),
      bounds: textFrameBounds(item, item.bounds, layout),
      ...(item.styleRefs && item.styleRefs.paragraphStyle ? { paragraphStyle: item.styleRefs.paragraphStyle } : {}),
      labels: item.labels || [],
    });
  }
  return overrides;
}

function parentPageItemsForRef(parentPages, parentPageRef) {
  const keys = new Set([parentPageRef.id, parentPageRef.name].filter(Boolean).map(String));
  const parentPage = (parentPages || []).find((candidate) => candidate
    && [candidate.id, candidate.name, candidate.semantic].some((key) => key != null && keys.has(String(key))));
  return parentPage && Array.isArray(parentPage.items) ? parentPage.items : [];
}

function isParentPageWritebackEcho(item, page, parentItems) {
  const sourceId = String(item.parentPageSourceId || '');
  if (!sourceId) return false;
  const pageKeys = [page.id, page.semantic].filter(Boolean);
  if (!pageKeys.some((key) => String(item.id) === parentPageWritebackItemId(key, sourceId))) return false;
  const parentItem = parentItems.find((candidate) => candidate && String(candidate.id) === sourceId);
  if (!parentItem) return false;
  if (collapsedInstanceText(item) !== collapsedInstanceText(parentItem)) return false;
  if (!writebackBoundsMatch(item.bounds, parentItem.bounds)) return false;
  const itemParagraphStyle = item.styleRefs && item.styleRefs.paragraphStyle || null;
  const parentParagraphStyle = parentItem.styleRefs && parentItem.styleRefs.paragraphStyle || null;
  return String(itemParagraphStyle || '') === String(parentParagraphStyle || '');
}

function collapsedInstanceText(item) {
  const text = item && item.content && item.content.text || '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function writebackBoundsMatch(a, b) {
  if (!a || !b) return !a === !b;
  return ['x', 'y', 'width', 'height'].every((key) => Math.abs(Number(a[key] || 0) - Number(b[key] || 0)) <= 0.5);
}

function parentPageInstructionFor(parentPage, model, layout, options, report) {
  const bounds = parentPageBounds(parentPage, model);
  const pageContext = {
    id: parentPage.id || parentPage.name,
    width: bounds.width,
    height: bounds.height,
    bounds,
    computedStyle: {},
  };
  const items = (parentPage.items || [])
    .flatMap((item) => instructionItemsFor(item, model.assets || [], pageContext, layout, options, model.styles || {}, report, parentPage.items || []))
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex);
  const guides = guideInstructionsFor({
    ...parentPage,
    id: parentPage.id || parentPage.name,
    guides: parentPage.guides || [],
  });
  return {
    ...parentPage,
    bounds,
    width: bounds.width,
    height: bounds.height,
    guides,
    items,
  };
}

function hasEffectiveInstructionParentPageContent(parentPage) {
  return parentPageHasValidGuides(parentPage) || Boolean(parentPage && parentPage.items && parentPage.items.length);
}

function parentPageHasValidGuides(parentPage) {
  return (parentPage && parentPage.guides || []).some((guide) => {
    const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
    const position = Number(guide && guide.position);
    return ['vertical', 'horizontal'].includes(orientation) && Number.isFinite(position);
  });
}

function parentPageBounds(parentPage, model) {
  if (parentPage.bounds && parentPage.bounds.width != null && parentPage.bounds.height != null) {
    return {
      x: Number(parentPage.bounds.x || 0),
      y: Number(parentPage.bounds.y || 0),
      width: Number(parentPage.bounds.width || 0),
      height: Number(parentPage.bounds.height || 0),
    };
  }
  const page = model.pages && model.pages[0] || {};
  return {
    x: 0,
    y: 0,
    width: Number(page.width || model.pageSize && model.pageSize.width || 0),
    height: Number(page.height || model.pageSize && model.pageSize.height || 0),
  };
}

function instructionItemsFor(modelItem, assets, page, layout, options, styles, report, siblingItems = []) {
  const baseItem = instructionItemFor(modelItem, assets, page, layout, options, styles, report);
  if (!baseItem) return [];
  return [
    baseItem,
    ...decorationItemsFor(modelItem, baseItem, layout, siblingItems),
  ].map(ensureItemLabels);
}

function instructionItemFor(modelItem, assets, page, layout, options, styles, report) {
  const context = instructionItemContextFor(modelItem, assets, page, layout, options, styles, report);
  if (context.base.role === 'text') return textInstructionItemFor(context);
  if (context.base.role === 'graphic') return graphicInstructionItemFor(context);
  if (context.base.role === 'table') return tableInstructionItemFor(context);
  return lineInstructionItemFor(context) || shapeInstructionItemFor(context);
}

function instructionItemContextFor(modelItem, assets, page, layout, options, styles, report) {
  const styleRefs = modelItem.styleRefs || {};
  const content = modelItem.content || { text: '', runs: [] };
  const vectorGeometry = vectorGeometryFor(modelItem);
  const visualStyle = modelItem.visualStyle || null;
  const indesignEffects = modelItem.extensions?.indesign?.effects ?? null;
  return {
    modelItem,
    assets,
    page,
    layout,
    options,
    styles,
    report,
    styleRefs,
    content,
    vectorGeometry,
    visualStyle,
    base: baseInstructionItemFor(modelItem, page, layout, options, styleRefs, indesignEffects),
  };
}

function baseInstructionItemFor(modelItem, page, layout, options, styleRefs, indesignEffects) {
  return {
    id: modelItem.id,
    role: modelItem.role,
    bounds: modelItem.bounds || itemBounds(modelItem, page, layout),
    zIndex: modelItem.zIndex || 0,
    layer: layerForModelItem(modelItem, options),
    sourceSelector: modelItem.sourceSelector,
    styleRefs,
    labels: modelItem.labels || [],
    effects: effectsForInstruction(indesignEffects, page, layout),
  };
}

function textInstructionItemFor({
  modelItem,
  layout,
  options,
  styles,
  report,
  styleRefs,
  content,
  visualStyle,
  base,
}) {
  const textFit = textFitPolicy(modelItem, options, layout);
  const text = textForInstruction(modelItem, content);
  const styleOverride = vectorStyleOverride(visualStyle, styles, report, modelItem);
  const textFrameStyle = textFrameStyleForInstruction(modelItem);
  return {
    ...base,
    type: 'TEXT',
    bounds: textFrameBounds(modelItem, base.bounds, layout),
    text,
    paragraphStyle: styleRefs.paragraphStyle,
    objectStyle: styleRefs.objectStyle,
    frameStyle: styleRefs.frameStyle,
    runs: runsForInstruction(modelItem, content, text),
    ...(modelItem.textOverride ? { textOverride: modelItem.textOverride } : {}),
    ...(textFrameStyle ? { textFrameStyle } : {}),
    ...(textFit ? { textFit } : {}),
    ...(visualStyle ? { visualStyle } : {}),
    ...(styleOverride ? { styleOverride } : {}),
  };
}

function textFrameStyleForInstruction(modelItem) {
  const style = modelItem.extensions?.indesign?.textFrameStyle;
  const vertical = style && style.verticalJustification;
  if (!vertical || vertical === 'flex-start') return null;
  return { verticalJustification: vertical };
}

function graphicInstructionItemFor({
  modelItem,
  assets,
  layout,
  styles,
  report,
  styleRefs,
  visualStyle,
  base,
}) {
  const asset = assetForItem(modelItem, assets);
  const placement = asset ? placementForItem(modelItem, asset) : null;
  const contentBounds = graphicContentBounds(modelItem, base.bounds, layout, placement);
  const styleOverride = vectorStyleOverride(visualStyle, styles, report, modelItem);
  return {
    ...base,
    type: 'GRAPHIC',
    objectStyle: styleRefs.objectStyle,
    frameStyle: styleRefs.frameStyle,
    ...(visualStyle ? { visualStyle } : {}),
    ...(styleOverride ? { styleOverride } : {}),
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

function tableInstructionItemFor({
  modelItem,
  page,
  layout,
  styleRefs,
  base,
}) {
  const table = modelItem.table && !Array.isArray(modelItem.table) ? modelItem.table : modelItem.content || {};
  const rows = tableRowsForInstruction(modelItem, page, layout);
  const rowHeights = tableRowHeightsForInstruction(modelItem, rows, layout);
  const columnWidths = tableColumnWidthsForInstruction(modelItem, rows, layout);
  return {
    ...base,
    type: 'TABLE',
    bounds: nativeTableBounds(base.bounds, rowHeights || [], layout),
    tableStyle: styleRefs.tableStyle,
    objectStyle: styleRefs.objectStyle,
    frameStyle: styleRefs.frameStyle,
    text: modelItem.text,
    rows,
    columnCount: table.columnCount || 0,
    columnWidths,
    rowHeights,
  };
}

function lineInstructionItemFor({
  modelItem,
  layout,
  styles,
  report,
  styleRefs,
  vectorGeometry,
  visualStyle,
  base,
}) {
  const line = nativeLineFor(modelItem, base.bounds, layout, styles, vectorGeometry, visualStyle);
  if (!line) return null;
  const styleOverride = vectorStyleOverride(visualStyle, styles, report, modelItem);
  return {
    ...base,
    ...line,
    type: 'LINE',
    objectStyle: styleRefs.objectStyle,
    frameStyle: null,
    ...(vectorGeometry ? { vectorGeometry } : {}),
    ...(visualStyle ? { visualStyle } : {}),
    ...(styleOverride ? { styleOverride } : {}),
  };
}

function shapeInstructionItemFor({
  modelItem,
  styles,
  report,
  styleRefs,
  vectorGeometry,
  visualStyle,
  base,
}) {
  const styleOverride = vectorStyleOverride(visualStyle, styles, report, modelItem);
  return {
    ...base,
    type: 'SHAPE',
    objectStyle: styleRefs.objectStyle,
    frameStyle: styleRefs.frameStyle,
    shapeKind: shapeKindFor(modelItem, vectorGeometry),
    ...(vectorGeometry ? { vectorGeometry } : {}),
    ...(visualStyle ? { visualStyle } : {}),
    ...(styleOverride ? { styleOverride } : {}),
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

function nativeLineFor(item, baseBounds, layout, styles, vectorGeometry = null, visualStyle = null) {
  if (!item) return null;
  const classNames = item.classList || [];
  const styleRefs = item.styleRefs || {};
  const objectStyle = styleRefs.objectStyle;
  const sourceLine = sourceLineStroke(item);
  const objectStyleStroke = objectStyleLineStroke(styles, objectStyle, baseBounds);
  const explicitLine = item.role === 'line'
    || classNames.includes('line')
    || /(^|-)line($|-)/.test(String(objectStyle || ''))
    || sourceNodeAttribute(item, HTML_DATA_ID_ATTRIBUTES.VECTOR) === 'line'
    || vectorLineCandidate(vectorGeometry, baseBounds);
  const thinVectorLine = (sourceLine || objectStyleStroke) && lineLikeBounds(baseBounds);
  const edge = item.box && item.box.borders && item.box.borders.top;
  const stroke = visibleBorder(edge)
    ? { color: edge.color, weight: edge.widthPt }
    : visualLineStroke(visualStyle, styles) || sourceLine || objectStyleStroke;
  const hasMarker = visualLineMarker(visualStyle);
  const rawBoundsMm = item.boundsMm || baseBounds || {};
  if ((!explicitLine && !thinVectorLine) || (!stroke && !hasMarker)) return null;
  const bounds = layout.unitMode === 'presentation'
    ? {
      x: styleLengthTarget(item, 'left', baseBounds.x, layout),
      y: styleLengthTarget(item, 'top', baseBounds.y, layout),
      width: styleLengthTarget(item, 'width', baseBounds.width, layout),
      height: styleLengthTarget(item, 'height', baseBounds.height, layout),
    }
    : {
      x: styleLengthMm(item, 'left', rawBoundsMm.x),
      y: styleLengthMm(item, 'top', rawBoundsMm.y),
      width: styleLengthMm(item, 'width', rawBoundsMm.width),
      height: styleLengthMm(item, 'height', rawBoundsMm.height),
    };
  const out = {
    bounds,
    rotationAngle: rotationAngleFor(item),
  };
  if (stroke && stroke.weight) {
    out.strokeColor = stroke.color;
    out.strokeWeight = stroke.weight;
  }
  return out;
}

function vectorGeometryFor(modelItem) {
  const vector = modelItem && modelItem.vectorGeometry || null;
  if (!vector || !Array.isArray(vector.paths)) return null;
  const paths = vector.paths
    .map((path) => ({
      closed: Boolean(path && path.closed),
      points: (path && Array.isArray(path.points) ? path.points : []).map(vectorPointForInstruction).filter(Boolean),
    }))
    .filter((path) => path.points.length >= 2);
  return paths.length ? { kind: vector.kind || 'path', paths } : null;
}

function vectorPointForInstruction(point = {}) {
  const anchor = vectorCoordinateForInstruction(point.anchor);
  if (!anchor) return null;
  const out = {
    anchor,
    leftDirection: vectorCoordinateForInstruction(point.leftDirection) || anchor,
    rightDirection: vectorCoordinateForInstruction(point.rightDirection) || anchor,
  };
  if (point.pointType != null) out.pointType = point.pointType;
  return out;
}

function vectorCoordinateForInstruction(value = {}) {
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: round(x, 3), y: round(y, 3) };
}

function vectorLineCandidate(vectorGeometry, bounds = null) {
  if (!vectorGeometry) return false;
  const kind = String(vectorGeometry.kind || '').toLowerCase();
  if (kind === 'line') return true;
  if ((kind !== 'polygon' && kind !== 'path') || !lineLikeBounds(bounds)) return false;
  const paths = Array.isArray(vectorGeometry.paths) ? vectorGeometry.paths : [];
  if (paths.length !== 1) return false;
  const path = paths[0];
  if (!path || path.closed) return false;
  const points = Array.isArray(path.points) ? path.points : [];
  if (points.length !== 2) return false;
  return distinctVectorAnchors(points[0], points[1]);
}

function distinctVectorAnchors(a, b) {
  const first = a && a.anchor || {};
  const second = b && b.anchor || {};
  const dx = Number(second.x) - Number(first.x);
  const dy = Number(second.y) - Number(first.y);
  return Number.isFinite(dx)
    && Number.isFinite(dy)
    && (Math.abs(dx) >= 0.01 || Math.abs(dy) >= 0.01);
}

function visualLineStroke(visualStyle, styles) {
  if (!visualStyle) return null;
  const weight = Number(visualStyle.strokeWeight || 0);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const color = ensureInstructionColor(styles, visualStyle.strokeColor);
  if (!color) return null;
  return { color, weight };
}

function visualLineMarker(visualStyle) {
  if (!visualStyle) return false;
  const start = normalizeLineMarker(visualStyle.lineStartMarker);
  const end = normalizeLineMarker(visualStyle.lineEndMarker);
  return Boolean((start && (start.type || start.rawName)) || (end && (end.type || end.rawName)));
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

function shapeKindFor(item, vectorGeometry = null) {
  if (vectorGeometry) {
    const kind = String(vectorGeometry.kind || '').toLowerCase();
    if (kind === 'polygon' || kind === 'path') return 'polygon';
  }
  if (!item || item.role !== 'shape') return 'rectangle';
  const radius = styleValue(item, 'borderRadius');
  const bounds = item.boundsMm || {};
  if (String(radius || '').trim() === '50%' && Math.abs(Number(bounds.width || 0) - Number(bounds.height || 0)) < 0.5) {
    return 'oval';
  }
  return 'rectangle';
}

function vectorStyleOverride(visualStyle, styles, report, item) {
  if (!visualStyle) return null;
  const out = {};
  const fillColor = ensureInstructionColor(styles, visualStyle.fillColor);
  if (fillColor) out.fillColor = fillColor;
  if (visualStyle.fillOpacity !== null && typeof visualStyle.fillOpacity !== 'undefined') {
    out.fillOpacity = Number(visualStyle.fillOpacity);
  }
  const strokeColor = ensureInstructionColor(styles, visualStyle.strokeColor);
  const strokeWeight = Number(visualStyle.strokeWeight);
  if (strokeColor) out.strokeColor = strokeColor;
  if (Number.isFinite(strokeWeight)) out.strokeWeight = strokeWeight > 0 ? strokeWeight : 0;
  else if (!strokeColor) out.strokeWeight = 0;
  if (visualStyle.strokeOpacity !== null && typeof visualStyle.strokeOpacity !== 'undefined') {
    out.strokeOpacity = Number(visualStyle.strokeOpacity);
  }
  if (visualStyle.opacity !== null && typeof visualStyle.opacity !== 'undefined') out.opacity = Number(visualStyle.opacity);
  const blendMode = normalizeBlendMode(visualStyle.blendMode);
  if (blendMode) out.blendMode = blendMode;
  if (visualStyle.strokeStyle !== null && typeof visualStyle.strokeStyle !== 'undefined') {
    const strokeStyle = executableStrokeStyle(visualStyle.strokeStyle);
    if (strokeStyle) out.strokeStyle = strokeStyle;
    else addMessage(report, 'warning', 'STROKE_STYLE_UNSUPPORTED', 'Observed stroke style is not executable as a native InDesign stroke type.', {
      itemId: item && item.id,
      strokeStyle: visualStyle.strokeStyle,
    });
  }
  for (const key of ['strokeLineCap', 'strokeLineJoin', 'strokeMiterLimit', 'strokeAlignment']) {
    if (visualStyle[key] !== null && typeof visualStyle[key] !== 'undefined') out[key] = visualStyle[key];
  }
  if (visualStyle.lineStartMarker) out.lineStartMarker = normalizeLineMarker(visualStyle.lineStartMarker);
  if (visualStyle.lineEndMarker) out.lineEndMarker = normalizeLineMarker(visualStyle.lineEndMarker);
  return Object.keys(out).length ? out : null;
}

function executableStrokeStyle(value) {
  const text = String(value == null ? '' : value).trim();
  const key = text.toLowerCase();
  if (!text) return null;
  if (key === 'solid' || key === 'none' || key === '$id/solid' || text === '实底') return text;
  if (key === 'dashed' || key === '$id/dashed' || key.includes('dash') || text.includes('虚') || /^\d+(\.\d+)?\s+\d+/.test(text)) return text;
  if (key === 'dotted' || key === '$id/dotted' || key.includes('dot') || text.includes('点')) return text;
  return null;
}

function normalizeLineMarker(marker) {
  if (typeof marker === 'string') return { type: marker, rawName: null };
  if (!marker || typeof marker !== 'object') return null;
  return {
    type: marker.type || null,
    rawName: marker.rawName || null,
  };
}

function ensureInstructionColor(styles, value) {
  const normalized = normalizeInstructionColor(value);
  if (!normalized) return null;
  if (normalized.hex) ensureInstructionSwatch(styles, normalized);
  return normalized.name;
}

function normalizeInstructionColor(value) {
  const text = String(value || '').trim();
  if (!text || /^\[?(none|无)\]?$/i.test(text) || text.toLowerCase() === 'transparent') return null;
  const css = normalizeCssColor(text);
  if (css) return css;
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return { name: text };
  const full = hex[1].length === 3
    ? hex[1].split('').map((char) => `${char}${char}`).join('')
    : hex[1];
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return {
    hex: `#${full.toLowerCase()}`,
    name: `颜色-${r}-${g}-${b}`,
  };
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

function decorationItemsFor(item, baseItem, layout, siblingItems = []) {
  if (baseItem.type !== 'SHAPE' && baseItem.type !== 'GRAPHIC') return [];
  const decorations = borderDecorationItemsFor(item, baseItem, layout);
  const objectText = objectTextItemFor(item, baseItem, layout, siblingItems);
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

function objectTextItemFor(item, baseItem, layout, siblingItems = []) {
  if (baseItem.type !== 'SHAPE') return null;
  if (!item.content || !item.content.text) return null;
  if (hasStructuredTextChildCarryingItemText(item, siblingItems)) return null;
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

function hasStructuredTextChildCarryingItemText(item, siblingItems = []) {
  if (!item || !item.id || !Array.isArray(siblingItems)) return false;
  const parentText = normalizeInstructionText(item.content && item.content.text);
  if (!parentText) return false;
  if (authoredItemRole(item) === ITEM_ROLE.CONTAINER && hasStructuredTextDescendant(item, siblingItems)) return true;
  const childTexts = siblingItems
    .filter((candidate) => (
      candidate
      && candidate !== item
      && candidate.role === 'text'
      && candidate.structure
      && candidate.structure.parentId === item.id
    ))
    .sort((a, b) => Number(a.structure.order || 0) - Number(b.structure.order || 0))
    .map((candidate) => normalizeInstructionText(candidate.content && candidate.content.text))
    .filter(Boolean);
  if (childTexts.length === 0) return false;
  if (childTexts.some((text) => text === parentText)) return true;
  const combined = normalizeInstructionText(childTexts.join(' '));
  return combined === parentText || withoutWhitespace(combined) === withoutWhitespace(parentText);
}

function authoredItemRole(item) {
  const sourceNode = item && item.sourceNode || {};
  const attrs = sourceNode.attributes || item && item.attributes || {};
  return String(attrs[HTML_DATA_ID_ATTRIBUTES.ROLE] || '').trim().toLowerCase();
}

function hasStructuredTextDescendant(item, siblingItems) {
  const byId = new Map(siblingItems.filter(Boolean).map((candidate) => [candidate.id, candidate]));
  return siblingItems.some((candidate) => {
    if (!candidate || candidate === item || candidate.role !== ITEM_ROLE.TEXT) return false;
    let parentId = candidate.structure && candidate.structure.parentId;
    const visited = new Set();
    while (parentId && !visited.has(parentId)) {
      if (parentId === item.id) return true;
      visited.add(parentId);
      const parent = byId.get(parentId);
      parentId = parent && parent.structure && parent.structure.parentId;
    }
    return false;
  });
}

function withoutWhitespace(value) {
  return String(value || '').replace(/\s+/g, '');
}

module.exports = {
  semanticModelToInstructions,
};
