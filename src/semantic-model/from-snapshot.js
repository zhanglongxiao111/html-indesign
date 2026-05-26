const { compileStyles } = require('../paged-html/style-compiler');
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../paged-html/layout');
const { createProtocolLabel } = require('../shared/labels');
const {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
} = require('../paged-html/source-metadata');

function snapshotToSemanticModel(snapshot, options = {}) {
  const layout = resolveLayout(snapshot, options);
  const styled = styledSnapshotForLayout(snapshot, options, layout);
  const sourcePackage = sourcePackageFromDocument(styled.sourcePackageInput || {});
  const semanticPreset = sourcePackage && sourcePackage.semanticPreset ? sourcePackage.semanticPreset : null;
  const documentId = documentIdFor(styled, options, sourcePackage);
  const pages = (styled.pages || []).map((page) => pageModelFor(page, layout));
  return {
    kind: 'DocumentModel',
    id: documentId,
    title: options.title || sourcePackage && sourcePackage.title || documentId,
    source: styled.metadata && styled.metadata.source,
    unitMode: layout.unitMode,
    coordinateUnit: layout.targetUnit,
    layoutInfo: layout,
    pageSize: pages[0] ? { width: pages[0].width, height: pages[0].height, unit: layout.targetUnit } : null,
    sourcePackage,
    semanticPreset,
    labels: [createProtocolLabel({
      kind: 'document',
      id: documentId,
      source: 'html-to-indesign',
      title: options.title || sourcePackage && sourcePackage.title || documentId,
      unitMode: layout.unitMode,
      coordinateUnit: layout.targetUnit,
      profile: options.profile || sourcePackage && sourcePackage.profile || null,
      sourcePackage,
      semanticPreset,
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

function documentIdFor(snapshot, options, sourcePackage = null) {
  if (options.documentId) return options.documentId;
  if (sourcePackage && sourcePackage.id) return sourcePackage.id;
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
  const sourceFile = attrs['data-id-source-file'] || page.sourceFile || null;
  const sourceNode = page.sourceNode || sourceNodeForSnapshotItem(Object.assign({}, page, { tagName: 'section' }));
  const grid = pageGridFromAttributes(attrs);
  return {
    id: pageId,
    raw: page,
    index: page.index,
    pageToken: attrs['data-page'] || null,
    semantic,
    parentPageId,
    parentPageName,
    layout: layoutToken,
    sourceFile,
    sourceNode,
    grid,
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
      sourceFile,
      sourceNode,
      grid,
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
  const sourceFile = attrs['data-id-source-file']
    || page.sourceFile
    || (page.attributes && page.attributes['data-id-source-file'])
    || null;
  const sourceNode = item.sourceNode || sourceNodeForSnapshotItem(item);
  const sourceAncestorNodes = sourceAncestorNodesForItem(item);
  const sourceText = sourceTextForItem(item);
  const sourceRuns = sourceRunsForItem(item);
  const sourceHtml = sourceHtmlForItem(item);
  const itemLayout = gridLayoutFromCssVars(item.cssVars || {});
  const parentId = nearestSourceParentId(item, page);
  const structure = { parentId, order: item.documentOrder || 0, containerPolicy: parentId === page.id ? 'group' : 'child' };
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
    sourceFile,
    sourceNode,
    sourceAncestorNodes,
    structure,
    layout: itemLayout,
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
      htmlTag: item.tagName || null,
      className: (item.classList || []).join(' '),
      sourceFile,
      sourceNode,
      sourceText,
      sourceHtml,
      sourceRuns,
      sourceAncestorNodes,
      structure,
      layout: itemLayout,
    })],
  };
}

function nearestSourceParentId(item, page) {
  const ids = item.ancestorCandidateIds || [];
  for (const id of ids) {
    if ((page.items || []).some((candidate) => candidate.id === id)) return id;
  }
  return page.id;
}

function pageGridFromAttributes(attrs = {}) {
  const grid = String(attrs['data-id-grid'] || '').match(/^(\d+)x(\d+)$/);
  if (!grid) return null;
  return {
    columns: Number(grid[1]),
    rows: Number(grid[2]),
    columnGutter: lengthNumber(attrs['data-id-column-gutter']),
    rowGutter: lengthNumber(attrs['data-id-row-gutter']),
    baseline: lengthNumber(attrs['data-id-baseline']),
  };
}

function lengthNumber(value) {
  const match = String(value || '').match(/^([+-]?(?:\d+|\d*\.\d+))/);
  return match ? Number(match[1]) : null;
}

function contentForItem(item) {
  if (item.content) return item.content;
  if (item.text != null) return { text: item.text, runs: item.runs || [] };
  return null;
}

function sourceTextForItem(item) {
  if (typeof item.text === 'string') return item.text;
  if (item.content && typeof item.content.text === 'string') return item.content.text;
  return null;
}

function sourceRunsForItem(item) {
  const runs = item.runs || (item.content && item.content.runs) || [];
  if (!Array.isArray(runs) || !runs.length) return [];
  if (isWholeItemSourceRun(item, runs)) return [];
  return runs
    .filter((run) => run && String(run.text || '') !== '')
    .map((run) => ({
      text: String(run.text || ''),
      tagName: run.tagName || null,
      classList: Array.isArray(run.classList) ? run.classList.slice() : [],
      attributes: { ...(run.attributes || {}) },
    }));
}

function isWholeItemSourceRun(item, runs) {
  if (!Array.isArray(runs) || runs.length !== 1) return false;
  const run = runs[0] || {};
  return String(run.text || '') === String(sourceTextForItem(item) || '')
    && String(run.tagName || '').toLowerCase() === String(item.tagName || '').toLowerCase();
}

function sourceHtmlForItem(item) {
  if (item.sourceNode && typeof item.sourceNode.sourceHtml === 'string') return item.sourceNode.sourceHtml;
  if (typeof item.sourceHtml === 'string') return item.sourceHtml;
  return null;
}

function sourceAncestorNodesForItem(item) {
  if (!Array.isArray(item.sourceAncestorNodes)) return [];
  return item.sourceAncestorNodes
    .filter((node) => node && node.tagName)
    .map((node) => ({
      tagName: node.tagName,
      id: node.id || null,
      classList: Array.isArray(node.classList) ? node.classList.slice() : [],
      attributes: { ...(node.attributes || {}) },
      sourcePath: node.sourcePath || null,
    }));
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
