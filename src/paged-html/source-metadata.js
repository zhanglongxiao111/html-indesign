const STABLE_ATTRIBUTE_RE = /^(data-|aria-|role$|href$|src$|srcset$|sizes$|alt$|title$|data$|type$|width$|height$|loading$|decoding$|crossorigin$|referrerpolicy$|media$|poster$)/i;
const GRID_VAR_NAMES = ['--grid-col', '--grid-span', '--grid-row', '--grid-row-span'];

function sourcePackageFromDocument(input = {}) {
  const attributes = input.attributes || {};
  const config = attributes['data-id-source-package-config'] || null;
  if (!config) return null;
  const out = {
    schemaVersion: Number(attributes['data-id-source-package-schema'] || 1),
    config,
    entry: input.entry || 'deck.html',
    styleFiles: (input.styleFiles || []).map(slash),
    pageFiles: (input.pageFiles || []).map((page) => ({ id: page.id, file: slash(page.file) })),
    assetRoot: input.assetRoot || 'assets',
  };
  if (attributes['data-id-document']) out.id = attributes['data-id-document'];
  if (input.title) out.title = input.title;
  if (attributes['data-id-profile']) out.profile = attributes['data-id-profile'];
  return out;
}

function sourceNodeForSnapshotItem(item = {}) {
  const attributes = {};
  for (const [name, value] of Object.entries(item.attributes || {})) {
    if (name === 'id' || name === 'class' || name === 'style') continue;
    if (name === 'data-id-ignore') continue;
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
