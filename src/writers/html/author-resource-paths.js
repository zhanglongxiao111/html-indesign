const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { normalizePathKey } = require('../../shared/assets');

function rewriteResourceAttrs(attrs, options = {}) {
  if (!attrs || !options.assetPathMap) return attrs;
  for (const name of ['src', 'data', 'href', HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC]) {
    if (!attrs[name]) continue;
    const rewritten = lookupAssetPath(options.assetPathMap, attrs[name]);
    if (rewritten) attrs[name] = rewritten;
  }
  return attrs;
}

function lookupAssetPath(map, value) {
  if (!map || !value) return '';
  const key = normalizePathKey(value);
  if (typeof map.get === 'function') return map.get(key) || map.get(String(value)) || '';
  return map[key] || map[String(value)] || '';
}

module.exports = {
  rewriteResourceAttrs,
  lookupAssetPath,
  normalizePathKey,
};
