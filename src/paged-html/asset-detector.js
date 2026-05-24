const path = require('path');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
} = require('../shared/assets');

function detectAssetsFromItems(items, htmlPath) {
  const assets = [];
  const seen = new Set();
  for (const item of items) {
    const source = assetSourceFromElementLike({
      tagName: item.tagName,
      attributes: item.attributes,
    });
    if (!source.src) continue;
    const kind = inferAssetKind(source.src, source.explicitKind);
    if (kind === 'unknown') continue;
    const id = createAssetId(source.src);
    if (seen.has(id)) continue;
    seen.add(id);
    assets.push({
      id,
      src: source.src,
      resolvedPath: resolveAssetPath(source.src, htmlPath),
      kind,
      fileName: path.basename(source.src),
      linked: true,
      placement: placementFromAttributes(item.attributes, item.computedStyle),
      sourceSelector: item.sourceSelector,
    });
  }
  return assets;
}

function resolveAssetPath(src, htmlPath) {
  if (/^[a-z]+:\/\//i.test(src)) return src;
  if (/^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('\\\\')) return src;
  return path.resolve(path.dirname(htmlPath), src);
}

function placementFromAttributes(attributes, computedStyle) {
  return {
    fit: attributes['data-id-fit'] || computedStyle.objectFit || 'fill',
    position: computedStyle.objectPosition || '50% 50%',
    pageNumber: attributes['data-id-page'] ? Number(attributes['data-id-page']) : undefined,
    crop: attributes['data-id-crop'] || undefined,
    artboard: attributes['data-id-artboard'] || undefined,
    layerComp: attributes['data-id-layer-comp'] || undefined,
    preserveVector: attributes['data-id-preserve-vector'] === 'true',
  };
}

module.exports = {
  detectAssetsFromItems,
  resolveAssetPath,
  placementFromAttributes,
};
