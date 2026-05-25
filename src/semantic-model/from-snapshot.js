const { compileStyles } = require('../paged-html/style-compiler');
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../paged-html/layout');
const { createProtocolLabel } = require('../shared/labels');

function snapshotToSemanticModel(snapshot, options = {}) {
  const layout = resolveLayout(snapshot, options);
  const styled = styledSnapshotForLayout(snapshot, options, layout);
  const documentId = documentIdFor(styled, options);
  const pages = (styled.pages || []).map((page) => pageModelFor(page, layout));
  return {
    kind: 'DocumentModel',
    id: documentId,
    title: options.title || documentId,
    source: styled.metadata && styled.metadata.source,
    unitMode: layout.unitMode,
    coordinateUnit: layout.targetUnit,
    layoutInfo: layout,
    pageSize: pages[0] ? { width: pages[0].width, height: pages[0].height, unit: layout.targetUnit } : null,
    labels: [createProtocolLabel({
      kind: 'document',
      id: documentId,
      source: 'html-to-indesign',
      unitMode: layout.unitMode,
      coordinateUnit: layout.targetUnit,
      profile: options.profile || null,
    })],
    parentPages: parentPagesFor(pages),
    pages,
    layers: [],
    styles: styled.styles || {},
    assets: styled.assets || [],
    warnings: styled.warnings || [],
    report: styled.report || null,
  };
}

function documentIdFor(snapshot, options) {
  if (options.documentId) return options.documentId;
  const source = snapshot.metadata && snapshot.metadata.source;
  if (!source) return 'html-document';
  return String(source).split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || 'html-document';
}

function pageModelFor(page, layout) {
  const dimensions = pageDimensions(page, layout);
  const margins = pageMargins(page, layout);
  const attrs = page.attributes || {};
  const pageId = page.id || attrs['data-page'] || `page-${Number(page.index || 0) + 1}`;
  const semantic = attrs['data-id-semantic'] || attrs['data-page'] || null;
  const parentPageId = attrs['data-id-parent-page'] || null;
  const parentPageName = attrs['data-id-parent-page-name'] || attrs['data-id-parent-page-display-name'] || null;
  const layoutToken = attrs['data-id-layout'] || null;
  return {
    id: pageId,
    raw: page,
    index: page.index,
    pageToken: attrs['data-page'] || null,
    semantic,
    parentPageId,
    parentPageName,
    layout: layoutToken,
    width: dimensions.width,
    height: dimensions.height,
    margins,
    guides: pageGuides(page, dimensions, margins, layout),
    labels: [createProtocolLabel({
      kind: 'page',
      id: pageId,
      source: 'html-to-indesign',
      semantic,
      parentPage: parentPageId ? { id: parentPageId, name: parentPageName } : null,
      layout: layoutToken,
    })],
    items: (page.items || []).map((item) => itemModelFor(item, page, layout)),
  };
}

function parentPagesFor(pages) {
  const parentPages = [];
  const seen = new Set();
  for (const page of pages) {
    if (!page.parentPageId || seen.has(page.parentPageId)) continue;
    seen.add(page.parentPageId);
    parentPages.push({
      id: page.parentPageId,
      name: page.parentPageName || page.parentPageId,
      labels: [createProtocolLabel({
        kind: 'parentPage',
        id: page.parentPageId,
        source: 'html-to-indesign',
        displayName: page.parentPageName || page.parentPageId,
      })],
    });
  }
  return parentPages;
}

function itemModelFor(item, page, layout) {
  const attrs = item.attributes || {};
  const semantic = attrs['data-id-semantic'] || attrs['data-id-object-style'] || attrs['data-id-paragraph-style'] || null;
  return {
    id: item.id,
    raw: item,
    role: item.role,
    type: item.role,
    tagName: item.tagName || null,
    semantic,
    sourceSelector: item.sourceSelector || null,
    bounds: itemBounds(item, page, layout),
    zIndex: item.zIndex || 0,
    layer: attrs['data-id-layer'] || null,
    classList: item.classList || [],
    attributes: attrs,
    styleRefs: item.styleRefs || {},
    content: contentForItem(item),
    table: item.table || null,
    effects: item.effects || null,
    labels: [createProtocolLabel({
      kind: 'item',
      id: item.id,
      source: 'html-to-indesign',
      role: item.role,
      semantic,
    })],
  };
}

function contentForItem(item) {
  if (item.content) return item.content;
  if (item.text != null) return { text: item.text, runs: item.runs || [] };
  return null;
}

function styledSnapshotForLayout(snapshot, options, layout) {
  if (snapshot.styles && stylesCompatibleWithLayout(snapshot.styleLayout, layout)) return snapshot;
  return compileStyles(snapshot, { ...options, layout });
}

function stylesCompatibleWithLayout(styleLayout, layout) {
  if (!styleLayout) return layout.unitMode !== 'presentation';
  if (styleLayout.unitMode !== layout.unitMode) return false;
  if (layout.unitMode !== 'presentation') return true;
  if ((styleLayout.targetUnit || 'pt') !== (layout.targetUnit || 'pt')) return false;
  if (Math.abs(Number(styleLayout.scale || 1) - Number(layout.scale || 1)) > 0.0001) return false;
  const expected = layout.targetSize || {};
  const actual = styleLayout.targetSize || {};
  return Math.abs(Number(actual.width || 0) - Number(expected.width || 0)) < 0.01
    && Math.abs(Number(actual.height || 0) - Number(expected.height || 0)) < 0.01;
}

module.exports = {
  snapshotToSemanticModel,
};
