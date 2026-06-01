const { loadStandardSemanticPreset } = require('../semantic-preset');
const { validateReverseLabel } = require('./label-whitelist');

function reverseSnapshotToSemanticModel(snapshot, options = {}) {
  const documentLabel = firstLabel(snapshot.document && snapshot.document.labels, 'document') || {};
  const styleMaps = reverseStyleNameMaps(snapshot.styles || {});
  const semanticPreset = activeSemanticPreset(snapshot, documentLabel, options);
  const layerVisibility = reverseLayerVisibility(snapshot.layers || []);
  const reverseMode = options.mode || (snapshot.metadata && snapshot.metadata.mode) || 'structured';
  const context = {
    semanticPreset,
    layerVisibility,
    labelOptions: {
      mode: reverseMode,
      strictFields: options.strictFields === true,
      warnFields: options.warnFields === true,
    },
  };
  const pages = (snapshot.pages || []).map((page) => reversePage(page, styleMaps, context));
  return {
    kind: 'DocumentModel',
    id: documentLabel.id || 'indesign-document',
    title: documentLabel.title || (documentLabel.sourcePackage && documentLabel.sourcePackage.title) || (snapshot.document && snapshot.document.name) || documentLabel.id || 'indesign-document',
    profile: documentLabel.profile || (documentLabel.sourcePackage && documentLabel.sourcePackage.profile) || null,
    source: snapshot.metadata && snapshot.metadata.sourceDocument,
    unitMode: documentLabel.unitMode || 'presentation',
    coordinateUnit: documentLabel.coordinateUnit || 'pt',
    labels: (snapshot.document && snapshot.document.labels) || [],
    sourcePackage: documentLabel.sourcePackage || null,
    parentPages: (snapshot.parentPages || []).map((parentPage) => reverseParentPage(parentPage, styleMaps, context)),
    pages,
    layers: (snapshot.layers || []).map(reverseLayer),
    styles: reverseStyles(snapshot.styles || {}),
    assets: snapshot.assets || [],
    warnings: [],
    report: null,
    reverseMode,
  };
}

function reversePage(page, styleMaps, context = {}) {
  const label = firstLabel(page.labels, 'page') || {};
  const validation = validateReverseLabel(label, { preset: context.semanticPreset, kind: 'page', ...context.labelOptions });
  const effective = validation.effective;
  const observed = observedLabelWithReasons(validation);
  const parent = label.parentPage || {};
  return {
    id: label.id || page.id,
    index: page.index,
    semantic: effective.semantic || null,
    parentPageId: label.parentPageId || parent.id || null,
    parentPageName: label.parentPageName || parent.name || page.appliedParentPageName || null,
    layout: effective.layout || null,
    sourceFile: effective.sourceFile || null,
    sourceNode: effective.sourceNode || null,
    grid: label.grid || null,
    width: page.bounds && page.bounds.width,
    height: page.bounds && page.bounds.height,
    margins: label.margins || page.margins || null,
    guides: page.guides || [],
    labelStatus: validation.status,
    effectiveLabel: effective,
    observedLabel: observed,
    rejectedFields: validation.rejectedFields,
    rejectionReasons: validation.rejectionReasons,
    labels: page.labels || [],
    items: (page.items || []).filter((item) => shouldKeepReverseItem(item, context)).map((item) => reverseItem(item, styleMaps, context)),
  };
}

function reverseItem(item, styleMaps = {}, context = {}) {
  const label = firstLabel(item.labels, 'item') || {};
  const validation = validateReverseLabel(label, { preset: context.semanticPreset, kind: 'item', ...context.labelOptions });
  const effective = validation.effective;
  const observed = observedLabelWithReasons(validation);
  const role = label.role || roleFromInDesignType(item.type, item);
  const table = reverseTable(item.table, styleMaps);
  const vectorGeometry = reverseVectorGeometry(item.vectorGeometry);
  return {
    id: label.id || item.id,
    role,
    sourceType: item.type || null,
    semantic: effective.semantic || 'unknown',
    tagName: effective.htmlTag || htmlTagForRole(role),
    htmlClass: effective.className || null,
    bounds: item.bounds,
    layerName: item.layerName || null,
    styleRefs: {
      paragraphStyle: mapStyleName(styleMaps, 'paragraphStyles', item.paragraphStyleName),
      objectStyle: mapStyleName(styleMaps, 'objectStyles', item.objectStyleName),
      frameStyle: mapStyleName(styleMaps, 'frameStyles', item.frameStyleName),
      tableStyle: table && table.tableStyle ? table.tableStyle : null,
    },
    content: contentForReverseItem(role, item, effective, styleMaps),
    table,
    vectorGeometry,
    visualStyle: item.visualStyle || null,
    effects: item.effects || null,
    textStyle: item.textStyle || null,
    textFrameStyle: item.textFrameStyle || null,
    inlineStyle: item.inlineStyle || item.inlineCSS || null,
    zIndex: numberOrNull(item.zIndex),
    firstLineFont: item.firstLineFont || null,
    sourceFile: effective.sourceFile || null,
    sourceNode: effective.sourceNode || null,
    sourceAncestorNodes: Array.isArray(effective.sourceAncestorNodes) ? effective.sourceAncestorNodes : [],
    structure: effective.structure || null,
    layout: effective.layout || null,
    labelStatus: validation.status,
    effectiveLabel: effective,
    observedLabel: observed,
    rejectedFields: validation.rejectedFields,
    rejectionReasons: validation.rejectionReasons,
    asset: item.placedAsset || null,
    labels: item.labels || [],
  };
}

function reverseParentPage(parentPage, styleMaps, context = {}) {
  const label = firstLabel(parentPage.labels, 'parentPage') || {};
  return {
    id: label.id || parentPage.name,
    name: label.name || label.displayName || parentPage.name,
    semantic: label.semantic || label.id || parentPage.name,
    provides: label.provides || [],
    bounds: parentPage.bounds || null,
    labels: parentPage.labels || [],
    items: (parentPage.items || []).filter((item) => shouldKeepReverseItem(item, context)).map((item) => reverseItem(item, styleMaps, context)),
  };
}

function reverseLayer(layer) {
  const label = firstLabel(layer.labels, 'layer') || {};
  return {
    token: label.token || layer.name,
    displayName: label.displayName || layer.name,
    name: layer.name,
    visible: typeof layer.visible === 'boolean' ? layer.visible : undefined,
    printable: typeof layer.printable === 'boolean' ? layer.printable : undefined,
    locked: typeof layer.locked === 'boolean' ? layer.locked : undefined,
    labels: layer.labels || [],
  };
}

function reverseLayerVisibility(layers = []) {
  const hidden = new Set();
  for (const layer of layers || []) {
    if (!layer || !layer.name) continue;
    if (layer.visible === false || layer.printable === false) hidden.add(String(layer.name));
  }
  return { hidden };
}

function shouldKeepReverseItem(item = {}, context = {}) {
  if (item.visible === false || item.printable === false || item.nonprinting === true) return false;
  const layerName = item.layerName || '';
  if (layerName && context.layerVisibility && context.layerVisibility.hidden.has(String(layerName))) return false;
  return true;
}

function reverseStyles(styles) {
  return {
    paragraphStyles: reverseStyleCollection(styles.paragraphStyles || []),
    characterStyles: reverseStyleCollection(styles.characterStyles || []),
    objectStyles: reverseStyleCollection(styles.objectStyles || []),
    frameStyles: reverseStyleCollection(styles.frameStyles || []),
    tableStyles: reverseStyleCollection(styles.tableStyles || []),
    cellStyles: reverseStyleCollection(styles.cellStyles || []),
    compositeFonts: reverseCompositeFonts(styles.compositeFonts || []),
  };
}

function reverseStyleNameMaps(styles) {
  return {
    paragraphStyles: reverseStyleNameMap(styles.paragraphStyles || []),
    characterStyles: reverseStyleNameMap(styles.characterStyles || []),
    objectStyles: reverseStyleNameMap(styles.objectStyles || []),
    frameStyles: reverseStyleNameMap(styles.frameStyles || []),
    tableStyles: reverseStyleNameMap(styles.tableStyles || []),
    cellStyles: reverseStyleNameMap(styles.cellStyles || []),
  };
}

function reverseStyleNameMap(items) {
  const map = new Map();
  for (const item of styleItems(items)) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || label.id || null;
    if (!token) continue;
    for (const name of [item.name, item.safeName, label.displayName, label.safeName]) {
      if (name) map.set(String(name), token);
    }
  }
  return map;
}

function styleItems(items) {
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return Object.values(items);
  return [];
}

function mapStyleName(styleMaps, kind, value) {
  if (!value) return null;
  const map = styleMaps && styleMaps[kind];
  return map && map.get(String(value)) || value;
}

function contentForReverseItem(role, item, label, styleMaps) {
  const rawText = role === 'table' && item.table ? '' : normalizeReverseText(item.text || '');
  const sourceText = typeof label.sourceText === 'string' ? label.sourceText : null;
  if (sourceText != null && sourceTextMatchesCurrentText(sourceText, rawText)) {
    return {
      text: sourceText,
      sourceHtml: typeof label.sourceHtml === 'string' ? label.sourceHtml : null,
      runs: sourceRunsFromLabel(label, styleMaps),
    };
  }
  return {
    text: rawText,
    runs: reverseTextRuns(item.textRuns || item.runs || [], styleMaps),
  };
}

function sourceTextMatchesCurrentText(sourceText, currentText) {
  return normalizeLineEndings(sourceText) === normalizeLineEndings(currentText);
}

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n|\r/g, '\n');
}

function sourceRunsFromLabel(label, styleMaps) {
  const runs = Array.isArray(label.sourceRuns) ? label.sourceRuns : [];
  return runs.map((run) => {
    const attributes = { ...(run.attributes || {}) };
    const characterStyle = mapStyleName(styleMaps, 'characterStyles', run.characterStyle || attributes['data-id-character-style']);
    if (characterStyle && !attributes['data-id-character-style']) {
      attributes['data-id-character-style'] = characterStyle;
    }
    return {
      text: String(run.text || ''),
      tagName: run.tagName || null,
      classList: Array.isArray(run.classList) ? run.classList.slice() : [],
      attributes,
      characterStyle,
    };
  });
}

function reverseTextRuns(runs, styleMaps) {
  return (runs || []).map((run) => ({
    ...run,
    text: normalizeReverseText(run.text || ''),
    characterStyle: mapStyleName(styleMaps, 'characterStyles', run.characterStyle),
  }));
}

function reverseTable(table, styleMaps) {
  if (!table) return null;
  return {
    ...table,
    tableStyle: mapStyleName(styleMaps, 'tableStyles', table.tableStyle),
    rows: (table.rows || []).map((row) => ({
      ...row,
      cells: (row.cells || []).map((cell) => ({
        ...cell,
        text: normalizeReverseText(cell.text || ''),
        paragraphStyle: mapStyleName(styleMaps, 'paragraphStyles', cell.paragraphStyle),
        cellStyle: mapStyleName(styleMaps, 'cellStyles', cell.cellStyle),
        runs: reverseTextRuns(cell.runs || [], styleMaps),
      })),
    })),
  };
}

function normalizeReverseText(value) {
  return String(value || '')
    .replace(/DOUBLE_LEFT_QUOTE/g, '“')
    .replace(/DOUBLE_RIGHT_QUOTE/g, '”')
    .replace(/SINGLE_LEFT_QUOTE/g, '‘')
    .replace(/SINGLE_RIGHT_QUOTE/g, '’')
    .replace(/FORCED_LINE_BREAK|PARAGRAPH_BREAK/g, '\n');
}

function reverseStyleCollection(items) {
  const out = {};
  for (const item of styleItems(items)) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || item.name;
    out[token] = {
      name: label.displayName || item.name,
      token,
      displayName: label.displayName || item.name,
      safeName: item.safeName || label.safeName || null,
      css: item.css || '',
      source: item.source || null,
      indesignFeatures: reverseStyleIndesignFeatures(item),
      labels: item.labels || [],
    };
  }
  return out;
}

function reverseStyleIndesignFeatures(item) {
  const features = {};
  for (const key of ['compositeFont', 'dropCap', 'list', 'grepStyles', 'nestedStyles']) {
    if (item[key] != null) features[key] = item[key];
  }
  return Object.keys(features).length ? features : null;
}

function reverseCompositeFonts(items) {
  const out = {};
  for (const item of items || []) {
    if (!item || !item.name) continue;
    out[item.name] = {
      name: item.name,
      safeName: item.safeName || null,
      hasBoldCJK: Boolean(item.hasBoldCJK),
      cjkWeight: item.cjkWeight || null,
      romanWeight: item.romanWeight || null,
      entries: item.entries || [],
    };
  }
  return out;
}

function activeSemanticPreset(snapshot, documentLabel, options = {}) {
  if (options.semanticPreset) return options.semanticPreset;
  const sourcePackage = documentLabel && documentLabel.sourcePackage || {};
  const profile = documentLabel && documentLabel.profile
    || sourcePackage.profile
    || snapshot && snapshot.metadata && snapshot.metadata.profile
    || 'architecture-report';
  try {
    return loadStandardSemanticPreset(profile).preset;
  } catch (error) {
    if (profile !== 'architecture-report') {
      return loadStandardSemanticPreset('architecture-report').preset;
    }
    throw error;
  }
}

function observedLabelWithReasons(validation) {
  const observed = validation.observed || {};
  if (!validation.rejectionReasons || !validation.rejectionReasons.length) return observed;
  return {
    ...observed,
    rejectionReasons: validation.rejectionReasons.slice(),
  };
}

function firstLabel(labels, kind) {
  return (labels || []).find((label) => label && label.kind === kind) || null;
}

function roleFromInDesignType(type, item = {}) {
  if (item.table) return 'table';
  if (item.placedAsset) return 'graphic';
  if (hasTextFacts(item)) return 'text';
  if (item.vectorGeometry && String(item.vectorGeometry.kind || '').toLowerCase() === 'line') return 'line';
  const raw = String(type || '').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('table')) return 'table';
  if (raw.includes('line')) return 'line';
  if (raw.includes('rectangle') || raw.includes('oval') || raw.includes('polygon')) return 'shape';
  return 'shape';
}

function reverseVectorGeometry(vectorGeometry) {
  if (!vectorGeometry || !Array.isArray(vectorGeometry.paths)) return null;
  return {
    kind: vectorGeometry.kind || 'path',
    paths: vectorGeometry.paths.map((path) => ({
      closed: Boolean(path && path.closed),
      points: (path && Array.isArray(path.points) ? path.points : []).map(reverseVectorPoint),
    })).filter((path) => path.points.length),
  };
}

function reverseVectorPoint(point = {}) {
  return {
    anchor: reverseVectorCoordinate(point.anchor),
    leftDirection: reverseVectorCoordinate(point.leftDirection || point.anchor),
    rightDirection: reverseVectorCoordinate(point.rightDirection || point.anchor),
    pointType: point.pointType || null,
  };
}

function reverseVectorCoordinate(value = {}) {
  return {
    x: numberOrNull(value.x) || 0,
    y: numberOrNull(value.y) || 0,
  };
}

function hasTextFacts(item = {}) {
  if (typeof item.text === 'string' && item.text.length > 0) return true;
  if (Array.isArray(item.textRuns) && item.textRuns.length > 0) return true;
  if (item.textStyle && Object.keys(item.textStyle).length > 0) return true;
  if (item.textFrameStyle && Object.keys(item.textFrameStyle).length > 0) return true;
  if (item.paragraphStyleName) return true;
  if (item.firstLineFont) return true;
  return false;
}

function htmlTagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'graphic') return 'figure';
  if (role === 'table') return 'table';
  return 'div';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  reverseSnapshotToSemanticModel,
};
