const path = require('path');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
  placementFromAttributes,
  resolveLocalAssetReference,
} = require('../../../shared/assets');

function detectAssetsFromItems(items, htmlPath) {
  const assets = [];
  const seenKeys = new Map();
  const seenIds = new Map();
  for (const item of items) {
    const source = assetSourceFromElementLike({
      tagName: item.tagName,
      attributes: item.attributes,
      computedStyle: item.computedStyle,
      authoredStyle: item.authoredStyle,
    });
    if (!source.src) continue;
    const kind = inferAssetKind(source.src, source.explicitKind);
    if (kind === 'unknown') continue;
    const resolvedPath = resolveAssetPath(source.src, htmlPath);
    const key = assetIdentityKey(resolvedPath);
    if (seenKeys.has(key)) continue;
    const id = uniqueAssetId(createAssetId(source.src), key, seenIds);
    seenKeys.set(key, id);
    assets.push({
      id,
      src: source.src,
      resolvedPath,
      kind,
      fileName: path.basename(source.src),
      linked: true,
      placement: placementFromAttributes(item.attributes, item.computedStyle),
      sourceSelector: item.sourceSelector,
    });
  }
  return assets;
}

function assetIdentityKey(resolvedPath) {
  return String(resolvedPath || '').replace(/\\/g, '/').toLowerCase();
}

function uniqueAssetId(baseId, key, seenIds) {
  if (!seenIds.has(baseId)) {
    seenIds.set(baseId, key);
    return baseId;
  }
  if (seenIds.get(baseId) === key) return baseId;
  let id = `${baseId}-${shortHash(key)}`;
  let index = 2;
  while (seenIds.has(id) && seenIds.get(id) !== key) {
    id = `${baseId}-${shortHash(`${key}:${index}`)}`;
    index += 1;
  }
  seenIds.set(id, key);
  return id;
}

function shortHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

function resolveAssetPath(src, htmlPath) {
  return resolveLocalAssetReference(src, { baseDir: path.dirname(htmlPath) }) || src;
}

module.exports = {
  detectAssetsFromItems,
  resolveAssetPath,
};
