function reverseSnapshotToSemanticModel(snapshot, options = {}) {
  const documentLabel = firstLabel(snapshot.document && snapshot.document.labels, 'document') || {};
  const pages = (snapshot.pages || []).map(reversePage);
  return {
    kind: 'DocumentModel',
    id: documentLabel.id || 'indesign-document',
    title: (snapshot.document && snapshot.document.name) || documentLabel.id || 'indesign-document',
    source: snapshot.metadata && snapshot.metadata.sourceDocument,
    unitMode: documentLabel.unitMode || 'presentation',
    coordinateUnit: documentLabel.coordinateUnit || 'pt',
    labels: (snapshot.document && snapshot.document.labels) || [],
    parentPages: (snapshot.parentPages || []).map(reverseParentPage),
    pages,
    layers: (snapshot.layers || []).map(reverseLayer),
    styles: reverseStyles(snapshot.styles || {}),
    assets: snapshot.assets || [],
    warnings: [],
    report: null,
    reverseMode: options.mode || (snapshot.metadata && snapshot.metadata.mode) || 'structured',
  };
}

function reversePage(page) {
  const label = firstLabel(page.labels, 'page') || {};
  const parent = label.parentPage || {};
  return {
    id: label.id || page.id,
    index: page.index,
    semantic: label.semantic || null,
    parentPageId: label.parentPageId || parent.id || null,
    parentPageName: label.parentPageName || parent.name || page.appliedParentPageName || null,
    layout: label.layout || null,
    width: page.bounds && page.bounds.width,
    height: page.bounds && page.bounds.height,
    margins: label.margins || page.margins || null,
    guides: page.guides || [],
    labels: page.labels || [],
    items: (page.items || []).map(reverseItem),
  };
}

function reverseItem(item) {
  const label = firstLabel(item.labels, 'item') || {};
  const role = label.role || roleFromInDesignType(item.type, item);
  return {
    id: label.id || item.id,
    role,
    semantic: label.semantic || 'unknown',
    tagName: label.htmlTag || htmlTagForRole(role),
    htmlClass: label.className || null,
    bounds: item.bounds,
    layerName: item.layerName || null,
    styleRefs: {
      paragraphStyle: item.paragraphStyleName || null,
      objectStyle: item.objectStyleName || null,
      frameStyle: item.frameStyleName || null,
    },
    content: { text: item.text || '' },
    visualStyle: item.visualStyle || null,
    textStyle: item.textStyle || null,
    textFrameStyle: item.textFrameStyle || null,
    inlineStyle: item.inlineStyle || item.inlineCSS || null,
    zIndex: numberOrNull(item.zIndex),
    firstLineFont: item.firstLineFont || null,
    asset: item.placedAsset || null,
    labels: item.labels || [],
  };
}

function reverseParentPage(parentPage) {
  const label = firstLabel(parentPage.labels, 'parentPage') || {};
  return {
    id: label.id || parentPage.name,
    name: label.name || label.displayName || parentPage.name,
    semantic: label.semantic || label.id || parentPage.name,
    provides: label.provides || [],
    labels: parentPage.labels || [],
    items: (parentPage.items || []).map(reverseItem),
  };
}

function reverseLayer(layer) {
  const label = firstLabel(layer.labels, 'layer') || {};
  return {
    token: label.token || layer.name,
    displayName: label.displayName || layer.name,
    name: layer.name,
    labels: layer.labels || [],
  };
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

function reverseStyleCollection(items) {
  const out = {};
  for (const item of items || []) {
    const label = firstLabel(item.labels, 'style') || {};
    const token = label.token || item.name;
    out[token] = {
      name: label.displayName || item.name,
      token,
      displayName: label.displayName || item.name,
      safeName: item.safeName || label.safeName || null,
      css: item.css || '',
      source: item.source || null,
      legacy: reverseStyleLegacy(item),
      labels: item.labels || [],
    };
  }
  return out;
}

function reverseStyleLegacy(item) {
  const legacy = {};
  for (const key of ['compositeFont', 'dropCap', 'list', 'grepStyles', 'nestedStyles']) {
    if (item[key] != null) legacy[key] = item[key];
  }
  return Object.keys(legacy).length ? legacy : null;
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

function firstLabel(labels, kind) {
  return (labels || []).find((label) => label && label.kind === kind) || null;
}

function roleFromInDesignType(type, item = {}) {
  if (item.placedAsset) return 'graphic';
  const raw = String(type || '').toLowerCase();
  if (raw.includes('text')) return 'text';
  if (raw.includes('table')) return 'table';
  if (raw.includes('line')) return 'line';
  if (raw.includes('rectangle') || raw.includes('oval') || raw.includes('polygon')) return 'shape';
  return 'graphic';
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
