const { compileStyles } = require('../../../writers/indesign/style-compiler');
const {
  resolveLayout,
  pageDimensions,
  pageMargins,
  pageGuides,
  itemBounds,
} = require('../../../semantic-model/layout');
const { createProtocolLabel } = require('../../../shared/labels');
const { fieldRegistry } = require('../../../protocol');
const {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
} = require('../reader/source-metadata');
const { vectorFactsFromSvgItem } = require('./svg-vector-geometry');

const ITEM_STYLE_REFS_FIELD = fieldRegistry.getByPath('items[].styleRefs');
if (!ITEM_STYLE_REFS_FIELD || !Array.isArray(ITEM_STYLE_REFS_FIELD.allowedKeys)) {
  throw new Error('ITEM_STYLE_REFS_ALLOWED_KEYS_UNREGISTERED');
}
const ITEM_STYLE_REF_ALLOWED_KEYS = new Set(ITEM_STYLE_REFS_FIELD.allowedKeys);

function snapshotToSemanticModel(snapshot, options = {}) {
  const layout = resolveLayout(snapshot, options);
  const styled = styledSnapshotForLayout(snapshot, options, layout);
  const sourcePackage = sourcePackageFromDocument(styled.sourcePackageInput || {});
  const semanticPreset = sourcePackage && sourcePackage.semanticPreset ? sourcePackage.semanticPreset : null;
  const documentId = documentIdFor(styled, options, sourcePackage);
  const pageModels = (styled.pages || []).map((page) => pageModelFor(page, layout));
  const parentPages = parentPagesFor(pageModels, sourcePackage && sourcePackage.parentPages);
  const pages = pageModels.map(stripParentPageItems);
  const styles = {
    ...(styled.styles || {}),
  };
  if (sourcePackage && Array.isArray(sourcePackage.synthesizedStyles)) {
    styles.synthesized = sourcePackage.synthesizedStyles;
  }
  const synthesizedWarnings = synthesizedStyleReferenceWarnings(pages, parentPages, styles.synthesized);
  if (options.strictSynthesizedStyles && synthesizedWarnings.length > 0) {
    const firstWarning = synthesizedWarnings[0];
    const error = new Error(
      `${firstWarning.code}: ${synthesizedWarnings.map((warning) => warning.token).join(', ')}`,
    );
    error.code = firstWarning.code;
    error.warnings = synthesizedWarnings;
    throw error;
  }
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
    parentPages,
    pages,
    layers: [],
    styles,
    assets: styled.assets || [],
    warnings: (styled.warnings || []).concat(synthesizedWarnings),
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
  const semantic = attrs['data-id-semantic'] || null;
  const parentPageId = attrs['data-id-parent-page'] || null;
  const parentPageName = attrs['data-id-parent-page-name'] || null;
  const layoutToken = attrs['data-id-layout'] || null;
  const sourceFile = attrs['data-id-source-file'] || page.sourceFile || null;
  const sourceNode = page.sourceNode || sourceNodeForSnapshotItem(Object.assign({}, page, { tagName: 'section' }));
  const grid = pageGridFromAttributes(attrs);
  const allItems = (page.items || []).map((item) => itemModelFor(item, page, layout));
  const parentPageItems = parentPageItemsFor(allItems);
  const inferredParentPage = parentPageItems[0] || null;
  const effectiveParentPageId = parentPageId || inferredParentPage && inferredParentPage.parentPageId || null;
  const effectiveParentPageName = parentPageName || inferredParentPage && inferredParentPage.parentPageName || null;
  return {
    id: pageId,
    raw: page,
    index: page.index,
    pageToken: attrs['data-page'] || null,
    semantic,
    parentPageId: effectiveParentPageId,
    parentPageName: effectiveParentPageName,
    layout: layoutToken,
    sourceFile,
    sourceNode,
    grid,
    width: dimensions.width,
    height: dimensions.height,
    margins,
    guides: pageGuidesForModel(page, dimensions, margins, layout),
    labels: [createProtocolLabel({
      kind: 'page',
      id: pageId,
      source: 'html-to-indesign',
      semantic,
      parentPage: effectiveParentPageId ? { id: effectiveParentPageId, name: effectiveParentPageName } : null,
      layout: layoutToken,
      sourceFile,
      sourceNode,
      grid,
    })],
    items: allItems.filter((item) => !item.parentPageItem),
    parentPageItems,
  };
}

function pageGuidesForModel(page, dimensions, margins, layout) {
  const attrs = page.attributes || {};
  const explicitGuides = pageGuidesFromAttr(attrs);
  if (explicitGuides) return explicitGuides;
  if (isObservationPageWithoutGuideContract(attrs)) {
    return Array.isArray(page.guides) ? page.guides : [];
  }
  return pageGuides(page, dimensions, margins, layout);
}

function pageGuidesFromAttr(attrs = {}) {
  const raw = attrs['data-id-guides'];
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (error) {
    const out = new Error(`PAGE_GUIDES_ATTR_INVALID: data-id-guides must be a JSON array: ${error.message}`);
    out.code = 'PAGE_GUIDES_ATTR_INVALID';
    out.cause = error;
    throw out;
  }
  if (!Array.isArray(parsed)) {
    const out = new Error('PAGE_GUIDES_ATTR_INVALID: data-id-guides must be a JSON array');
    out.code = 'PAGE_GUIDES_ATTR_INVALID';
    throw out;
  }
  return parsed.map((guide, index) => {
    const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
    const position = Number(guide && guide.position);
    if (!['vertical', 'horizontal'].includes(orientation) || !Number.isFinite(position)) {
      const out = new Error(`PAGE_GUIDES_ATTR_INVALID: invalid guide at index ${index}`);
      out.code = 'PAGE_GUIDES_ATTR_INVALID';
      throw out;
    }
    return {
      orientation,
      position,
      source: guide.source ? String(guide.source) : 'page',
    };
  });
}

function isObservationPageWithoutGuideContract(attrs = {}) {
  const mode = String(attrs['data-id-reverse-mode'] || '').trim().toLowerCase();
  const observed = String(attrs['data-id-observed'] || '').trim().toLowerCase() === 'true';
  const hasGuideContract = attrs['data-id-guide-mode'] || attrs['data-id-grid'] || attrs['data-id-baseline-guides'];
  return !hasGuideContract && (observed || mode === 'observation');
}

function parentPagesFor(pages, sourceParentPages = []) {
  const parentPages = [];
  const seen = new Set();
  const byId = new Map();
  const itemKeys = new Set();
  const sourceById = sourceParentPageMap(sourceParentPages);
  function ensureParentPage(id, name) {
    if (!id) return null;
    if (byId.has(id)) return byId.get(id);
    const sourceParentPage = sourceById.get(String(id)) || sourceById.get(String(name || '')) || null;
    const parentPage = {
      id,
      name: name || id,
      parentPageId: sourceParentPage && sourceParentPage.parentPageId || null,
      parentPageName: sourceParentPage && sourceParentPage.parentPageName || null,
      guides: sourceParentPage ? sourceParentPageGuides(sourceParentPage.guides || []) : [],
      labels: [createProtocolLabel({
        kind: 'parentPage',
        id,
        source: 'html-to-indesign',
        displayName: name || id,
      })],
      items: [],
    };
    byId.set(id, parentPage);
    parentPages.push(parentPage);
    return parentPage;
  }
  for (const parentPage of Array.isArray(sourceParentPages) ? sourceParentPages : []) {
    ensureParentPage(parentPage && (parentPage.id || parentPage.name), parentPage && (parentPage.name || parentPage.id));
  }
  for (const page of pages) {
    if (!page.parentPageId || seen.has(page.parentPageId)) continue;
    seen.add(page.parentPageId);
    ensureParentPage(page.parentPageId, page.parentPageName || page.parentPageId);
  }
  for (const page of pages) {
    for (const item of page.parentPageItems || []) {
      const parentPage = ensureParentPage(item.parentPageId || page.parentPageId, item.parentPageName || page.parentPageName);
      if (!parentPage) continue;
      const modelItem = parentPageModelItemFor(item, parentPage);
      const key = `${parentPage.id}::${modelItem.id}`;
      if (itemKeys.has(key)) continue;
      itemKeys.add(key);
      parentPage.items.push(modelItem);
    }
  }
  return parentPages;
}

function sourceParentPageMap(parentPages = []) {
  const out = new Map();
  for (const parentPage of Array.isArray(parentPages) ? parentPages : []) {
    if (!parentPage) continue;
    for (const key of [parentPage.id, parentPage.name]) {
      if (key != null && !out.has(String(key))) out.set(String(key), parentPage);
    }
  }
  return out;
}

function sourceParentPageGuides(guides = []) {
  return (Array.isArray(guides) ? guides : [])
    .map((guide) => {
      const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
      const position = Number(guide && guide.position);
      if (!['vertical', 'horizontal'].includes(orientation) || !Number.isFinite(position)) return null;
      return {
        orientation,
        position,
        source: guide.source || 'parent-page',
      };
    })
    .filter(Boolean);
}

function parentPageItemsFor(items) {
  return (items || []).filter((item) => item && item.parentPageItem);
}

function stripParentPageItems(page) {
  const { parentPageItems, ...cleanPage } = page;
  return cleanPage;
}

function parentPageModelItemFor(item, parentPage) {
  const id = item.parentPageSourceId || item.id;
  return {
    ...item,
    id,
    parentPageItem: true,
    parentPageId: parentPage.id,
    parentPageName: parentPage.name,
    structure: null,
    labels: [createProtocolLabel({
      kind: 'item',
      id,
      source: 'html-to-indesign',
      role: item.role,
      semantic: item.semantic,
      htmlTag: item.tagName || null,
      className: (item.classList || []).join(' '),
    })],
  };
}

function itemModelFor(item, page, layout) {
  const attrs = item.attributes || {};
  const semantic = attrs['data-id-semantic'] || null;
  const bounds = itemBounds(item, page, layout);
  const vectorFacts = vectorFactsFromSvgItem(item, bounds) || {};
  const visualStyle = mergeVisualStyleFacts(
    visualStyleFromComputedStyle(item),
    item.visualStyle || vectorFacts.visualStyle || null,
    visualStyleFromProtocolAttrs(attrs),
  );
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
  const styleRefs = filterItemStyleRefs({
    ...(item.styleRefs || {}),
    ...(attrs['data-id-layer'] ? { layer: attrs['data-id-layer'] } : {}),
    ...(attrs['data-id-style-token'] ? { synthesizedToken: attrs['data-id-style-token'] } : {}),
    ...(attrs['data-id-style-name'] ? { synthesizedName: attrs['data-id-style-name'] } : {}),
  });
  const parentPageName = attrs['data-id-parent-page-item'] || null;
  const parentPageSourceId = attrs['data-id-parent-page-source-id'] || null;
  const extensions = itemExtensionsFor(item);
  return {
    id: item.id,
    raw: item,
    role: item.role,
    tagName: item.tagName || null,
    semantic,
    sourceSelector: item.sourceSelector || null,
    bounds,
    zIndex: item.zIndex || 0,
    layer: attrs['data-id-layer'] || null,
    classList: item.classList || [],
    attributes: attrs,
    sourceFile,
    sourceNode,
    sourceAncestorNodes,
    parentPageItem: parentPageName || null,
    parentPageId: parentPageName,
    parentPageName,
    parentPageSourceId,
    structure,
    layout: itemLayout,
    styleRefs,
    content: contentForItem(item),
    table: item.table || null,
    vectorGeometry: item.vectorGeometry || vectorFacts.vectorGeometry || null,
    visualStyle,
    ...(extensions ? { extensions } : {}),
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

function itemExtensionsFor(item) {
  const indesign = {};
  if (item.effects) {
    indesign.effects = item.effects;
  }
  if (!Object.keys(indesign).length) return null;
  return { indesign };
}

function filterItemStyleRefs(styleRefs) {
  const filtered = {};
  for (const [key, value] of Object.entries(styleRefs || {})) {
    if (ITEM_STYLE_REF_ALLOWED_KEYS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function mergeVisualStyleFacts(...facts) {
  const entries = facts.filter(Boolean);
  if (!entries.length) return null;
  return Object.assign({}, ...entries);
}

function visualStyleFromComputedStyle(item) {
  const style = item && item.computedStyle || {};
  const out = {};
  const opacity = cssOpacityPercent(style.opacity);
  if (opacity !== null && opacity < 100) out.opacity = opacity;
  return Object.keys(out).length ? out : null;
}

function visualStyleFromProtocolAttrs(attrs = {}) {
  const out = {};
  if (attrs['data-id-stroke-color']) out.strokeColor = attrs['data-id-stroke-color'];
  if (Object.prototype.hasOwnProperty.call(attrs, 'data-id-stroke-weight')) {
    out.strokeWeight = numberOrZero(attrs['data-id-stroke-weight']);
  }
  if (attrs['data-id-stroke-style']) out.strokeStyle = attrs['data-id-stroke-style'];
  if (attrs['data-id-stroke-alignment']) out.strokeAlignment = attrs['data-id-stroke-alignment'];
  const startRawName = attrs['data-id-line-start-marker-raw-name'];
  const endRawName = attrs['data-id-line-end-marker-raw-name'];
  if (startRawName) out.lineStartMarker = { type: null, rawName: startRawName };
  if (endRawName) out.lineEndMarker = { type: null, rawName: endRawName };
  return Object.keys(out).length ? out : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function cssOpacityPercent(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const percent = number <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, Math.round(percent * 10000) / 10000));
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

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
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

function synthesizedStyleReferenceWarnings(pages, parentPages, synthesizedStyles) {
  const registered = new Map((Array.isArray(synthesizedStyles) ? synthesizedStyles : [])
    .filter((style) => style && style.token)
    .map((style) => [String(style.token), style]));
  const warnings = [];
  for (const scope of [
    ...arrayOrEmpty(parentPages).map((page) => ({ kind: 'parentPage', page })),
    ...arrayOrEmpty(pages).map((page) => ({ kind: 'page', page })),
  ]) {
    for (const item of arrayOrEmpty(scope.page.items)) {
      const refs = item && item.styleRefs || {};
      const token = refs.synthesizedToken;
      if (!token) continue;
      const registeredStyle = registered.get(String(token));
      if (!registeredStyle) {
        warnings.push({
          code: 'SYNTHESIZED_STYLE_TOKEN_UNREGISTERED',
          message: `Synthesized style token is missing from the source package registry: ${token}`,
          scope: scope.kind,
          pageId: scope.page.id || null,
          itemId: item.id || null,
          token: String(token),
        });
        continue;
      }
      const actualName = refs.synthesizedName;
      const expectedName = registeredStyle.displayName;
      if (!actualName || !expectedName || String(actualName) === String(expectedName)) continue;
      warnings.push({
        code: 'SYNTHESIZED_STYLE_NAME_MISMATCH',
        message: `Synthesized style display name does not match registry for token: ${token}`,
        scope: scope.kind,
        pageId: scope.page.id || null,
        itemId: item.id || null,
        token: String(token),
        expectedName: String(expectedName),
        actualName: String(actualName),
      });
    }
  }
  return warnings;
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
