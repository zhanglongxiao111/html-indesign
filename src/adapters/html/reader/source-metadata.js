const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const STABLE_ATTRIBUTE_RE = /^(data-|aria-|role$|href$|src$|srcset$|sizes$|alt$|title$|data$|type$|width$|height$|loading$|decoding$|crossorigin$|referrerpolicy$|media$|poster$)/i;
const GRID_VAR_NAMES = ['--grid-col', '--grid-span', '--grid-row', '--grid-row-span'];

function sourcePackageFromDocument(input = {}) {
  const attributes = input.attributes || {};
  const config = attributes[HTML_DATA_ID_ATTRIBUTES.SOURCE_PACKAGE_CONFIG] || null;
  if (!config) return null;
  const parentPages = sourceParentPages(input.parentPages || []);
  const out = {
    schemaVersion: Number(attributes[HTML_DATA_ID_ATTRIBUTES.SOURCE_PACKAGE_SCHEMA] || 1),
    config,
    entry: input.entry || 'deck.html',
    styleFiles: (input.styleFiles || []).map(slash),
    pageFiles: (input.pageFiles || []).map((page) => ({ id: page.id, file: slash(page.file) })),
    assetRoot: input.assetRoot || 'assets',
  };
  if (parentPages.length) out.parentPages = parentPages;
  const layers = sourceLayers(input.layers || []);
  if (layers.length) out.layers = layers;
  if (Array.isArray(input.synthesizedStyles) && input.synthesizedStyles.length) {
    out.synthesizedStyles = input.synthesizedStyles.map(synthesizedStyleForSourcePackage).filter(Boolean);
  }
  if (attributes[HTML_DATA_ID_ATTRIBUTES.DOCUMENT]) out.id = attributes[HTML_DATA_ID_ATTRIBUTES.DOCUMENT];
  if (input.title) out.title = input.title;
  if (attributes[HTML_DATA_ID_ATTRIBUTES.PROFILE]) out.profile = attributes[HTML_DATA_ID_ATTRIBUTES.PROFILE];
  if (attributes[HTML_DATA_ID_ATTRIBUTES.SEMANTIC_PRESET]) {
    out.semanticPreset = {
      source: 'project',
      id: attributes[HTML_DATA_ID_ATTRIBUTES.PROFILE] || attributes[HTML_DATA_ID_ATTRIBUTES.DOCUMENT] || out.profile || out.id || null,
      relativePath: slash(attributes[HTML_DATA_ID_ATTRIBUTES.SEMANTIC_PRESET]),
    };
  }
  return out;
}

function synthesizedStyleForSourcePackage(style) {
  if (!style || !style.token || !style.displayName) {
    return null;
  }
  return {
    token: String(style.token),
    displayName: String(style.displayName),
    kind: style.kind || null,
    fingerprint: style.fingerprint || null,
    source: style.source || null,
    properties: style.properties || {},
  };
}

function sourceParentPages(parentPages = []) {
  return (Array.isArray(parentPages) ? parentPages : [])
    .map((parentPage) => {
      const id = parentPage && (parentPage.id || parentPage.name);
      if (!id) return null;
      const out = {
        id: String(id),
        name: String(parentPage.name || id),
        guides: sourceParentPageGuides(parentPage.guides || []),
      };
      if (parentPage.parentPageId) out.parentPageId = String(parentPage.parentPageId);
      if (parentPage.parentPageName) out.parentPageName = String(parentPage.parentPageName);
      return out;
    })
    .filter(Boolean);
}

function sourceLayers(layers = []) {
  return (Array.isArray(layers) ? layers : [])
    .map((layer) => {
      const name = layer && (layer.name != null ? layer.name : layer);
      if (name == null || String(name).trim() === '') return null;
      return { name: String(name) };
    })
    .filter(Boolean);
}

function sourceParentPageGuides(guides = []) {
  return (Array.isArray(guides) ? guides : [])
    .map((guide) => {
      const orientation = String(guide && guide.orientation || '').trim().toLowerCase();
      const position = numberOrNull(guide && guide.position);
      if (!['vertical', 'horizontal'].includes(orientation) || position == null) return null;
      return {
        orientation,
        position,
        source: guide.source || 'parent-page',
      };
    })
    .filter(Boolean);
}

function sourceNodeForSnapshotItem(item = {}) {
  const attributes = {};
  for (const [name, value] of Object.entries(item.attributes || {})) {
    if (name === 'id' || name === 'class' || name === 'style') continue;
    if (name === HTML_DATA_ID_ATTRIBUTES.IGNORE) continue;
    if (STABLE_ATTRIBUTE_RE.test(name)) attributes[name] = value;
  }
  return {
    tagName: String(item.tagName || 'div').toLowerCase(),
    id: item.id || (item.attributes && item.attributes.id) || null,
    classList: item.classList || [],
    attributes,
  };
}

function gridLayoutFromCssVars(cssVars = {}) {
  const values = {};
  for (const name of GRID_VAR_NAMES) {
    if (cssVars[name] != null && String(cssVars[name]).trim() !== '') {
      values[name] = String(cssVars[name]).trim();
    }
  }
  if (Object.keys(values).length === 0) return null;
  return {
    grid: {
      col: numberOrNull(values['--grid-col']),
      span: numberOrNull(values['--grid-span']),
      row: numberOrNull(values['--grid-row']),
      rowSpan: numberOrNull(values['--grid-row-span']),
    },
    cssVars: values,
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  sourcePackageFromDocument,
  sourceNodeForSnapshotItem,
  gridLayoutFromCssVars,
  GRID_VAR_NAMES,
};
