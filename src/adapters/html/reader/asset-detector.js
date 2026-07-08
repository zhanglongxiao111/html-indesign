const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
const path = require('path');
const {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
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
  if (/^[a-z]+:\/\//i.test(src)) return src;
  if (/^[a-zA-Z]:[\\/]/.test(src) || src.startsWith('\\\\')) return src;
  return path.resolve(path.dirname(htmlPath), src);
}

function placementFromAttributes(attributes, computedStyle) {
  attributes = attributes || {};
  computedStyle = computedStyle || {};
  const hasElementSource = Boolean(attributes.src || attributes.href || attributes.data);
  const previewOnly = Boolean(attributes[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] && !attributes[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH]);
  const hasBackgroundSource = !hasElementSource && assetSourceFromElementLike({
    tagName: 'div',
    attributes,
    computedStyle,
  }).src;
  const contentBox = previewOnly ? undefined : contentBoxFromAttributes(attributes);
  return {
    fit: previewOnly ? 'fill' : attributes[HTML_DATA_ID_ATTRIBUTES.FIT] || (contentBox ? 'manual' : null) || (hasBackgroundSource ? fitFromBackgroundSize(computedStyle.backgroundSize) : computedStyle.objectFit) || 'fill',
    position: hasBackgroundSource
      ? normalizePosition(computedStyle.backgroundPosition)
      : normalizePosition(computedStyle.objectPosition) || '50% 50%',
    pageNumber: positiveIntegerOrUndefined(attributes[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE]),
    crop: attributes[HTML_DATA_ID_ATTRIBUTES.CROP] || undefined,
    artboard: attributes[HTML_DATA_ID_ATTRIBUTES.ARTBOARD] || undefined,
    layerComp: attributes[HTML_DATA_ID_ATTRIBUTES.LAYER_COMP] || undefined,
    visibleLayers: layerListFromAttribute(attributes[HTML_DATA_ID_ATTRIBUTES.VISIBLE_LAYERS] || attributes[HTML_DATA_ID_ATTRIBUTES.PDF_VISIBLE_LAYERS]),
    hiddenLayers: layerListFromAttribute(attributes[HTML_DATA_ID_ATTRIBUTES.HIDDEN_LAYERS] || attributes[HTML_DATA_ID_ATTRIBUTES.PDF_HIDDEN_LAYERS]),
    preserveVector: attributes[HTML_DATA_ID_ATTRIBUTES.PRESERVE_VECTOR] === 'true',
    contentBox,
  };
}

function contentBoxFromAttributes(attributes) {
  const x = attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_X];
  const y = attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_Y];
  const width = attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_WIDTH];
  const height = attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_HEIGHT];
  if (x == null && y == null && width == null && height == null) return undefined;
  if (x == null || y == null || width == null || height == null) return undefined;
  return {
    x,
    y,
    width,
    height,
    scaleX: numberOrUndefined(attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_X]),
    scaleY: numberOrUndefined(attributes[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_Y]),
  };
}

function numberOrUndefined(value) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function positiveIntegerOrUndefined(value) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return undefined;
  return number;
}

function layerListFromAttribute(value) {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch (_error) {}
  }
  const parts = raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function fitFromBackgroundSize(value) {
  const key = String(value || '').toLowerCase();
  if (key.includes('contain')) return 'contain';
  if (key.includes('cover')) return 'cover';
  if (key === '100% 100%') return 'fill';
  return null;
}

function normalizePosition(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const text = raw
    .replace(/\bleft\b/g, '0%')
    .replace(/\btop\b/g, '0%')
    .replace(/\bcenter\b/g, '50%')
    .replace(/\bright\b/g, '100%')
    .replace(/\bbottom\b/g, '100%');
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) parts.push('50%');
  return parts.slice(0, 2).join(' ');
}

module.exports = {
  detectAssetsFromItems,
  resolveAssetPath,
  placementFromAttributes,
};
