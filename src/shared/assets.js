const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.tif', '.tiff', '.webp', '.bmp']);

function cleanKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  if (['raster', 'pdf', 'psd', 'ai', 'svg', 'vector', 'fallback'].includes(kind)) return kind;
  return null;
}

function inferAssetKind(src, explicitKind) {
  const cleanExplicit = cleanKind(explicitKind);
  if (cleanExplicit === 'fallback' || cleanExplicit === 'vector') return cleanExplicit;
  const inferred = inferAssetKindFromExtension(src);
  if (inferred !== 'unknown') return inferred;
  if (cleanExplicit) return cleanExplicit;
  return 'unknown';
}

function inferAssetKindFromExtension(src) {
  const ext = path.extname(String(src || '').split(/[?#]/)[0]).toLowerCase();
  if (RASTER_EXTENSIONS.has(ext)) return 'raster';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.psd') return 'psd';
  if (ext === '.ai') return 'ai';
  if (ext === '.svg') return 'svg';
  return 'unknown';
}

function assetSourceFromElementLike(element) {
  const tagName = String(element.tagName || '').toUpperCase();
  const attrs = element.attributes || {};
  const style = element.computedStyle || {};
  const authoredStyle = element.authoredStyle || {};
  const explicitKind = cleanKind(attrs[HTML_DATA_ID_ATTRIBUTES.ASSET_KIND]);
  const protocolAssetPath = attrs[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH] || null;
  const previewSrc = attrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] || attrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_ASSET_PATH] || null;
  if (protocolAssetPath) return { src: protocolAssetPath, explicitKind };
  if (previewSrc) return { src: previewSrc, explicitKind };
  if (tagName === 'IMG') return { src: attrs.src || null, explicitKind };
  if (tagName === 'OBJECT') {
    const type = String(attrs.type || '').toLowerCase();
    return {
      src: attrs.data || null,
      explicitKind: explicitKind || (type === 'application/pdf' ? 'pdf' : null),
    };
  }
  if (tagName === 'EMBED') {
    const type = String(attrs.type || '').toLowerCase();
    return {
      src: attrs.src || null,
      explicitKind: explicitKind || (type === 'application/pdf' ? 'pdf' : null),
    };
  }
  return {
    src: attrs.src || attrs.href || attrs.data || firstCssUrl(authoredStyle.backgroundImage) || firstCssUrl(style.backgroundImage) || null,
    explicitKind,
  };
}

function firstCssUrl(value) {
  const match = String(value || '').match(/url\(\s*(['"]?)(.*?)\1\s*\)/i);
  return match ? match[2] : null;
}

function createAssetId(src) {
  const raw = path.basename(String(src || 'asset')).replace(/\.[^.]+$/, '') + path.extname(String(src || 'asset'));
  const safe = raw
    .replace(/\.[^.]+$/, (ext) => '-' + ext.slice(1))
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `asset-${safe || 'unknown'}`;
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

// PDF/AI 置入图层名单（data-id-visible-layers / data-id-hidden-layers）的属性编码。
// 当前写法是 JSON 字符串数组：图层名可以含 `|`、逗号、引号（例如「合并底图|PM-隔断」），
// 任何分隔符拼接都会与图层名冲突。数组元素原样保留，不 trim，与 InDesign 回读的图层名逐字对应。
// 旧包里用 `|` / `,` 拼接的非 JSON 值只作为兼容边界读取：按旧规则拆分，
// 并由 authoring lint 报 ASSET_LAYER_LIST_DELIMITED 提示改写；
// 以 `[` 开头却不是合法 JSON 字符串数组的值不读取，由 lint 报 ASSET_LAYER_LIST_INVALID。
const LAYER_LIST_ENCODING = Object.freeze({
  EMPTY: 'empty',
  JSON: 'json',
  DELIMITED: 'delimited',
  INVALID: 'invalid',
});

function parseLayerListAttribute(value) {
  if (value == null) return { encoding: LAYER_LIST_ENCODING.EMPTY, layers: undefined };
  const raw = String(value).trim();
  if (!raw) return { encoding: LAYER_LIST_ENCODING.EMPTY, layers: undefined };
  if (raw.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { encoding: LAYER_LIST_ENCODING.INVALID, layers: undefined, reason: `not valid JSON: ${error.message}` };
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return { encoding: LAYER_LIST_ENCODING.INVALID, layers: undefined, reason: 'must be a JSON array of layer name strings' };
    }
    const layers = parsed.filter((item) => item !== '');
    return { encoding: LAYER_LIST_ENCODING.JSON, layers: layers.length ? layers : undefined };
  }
  const parts = raw.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
  return { encoding: LAYER_LIST_ENCODING.DELIMITED, layers: parts.length ? parts : undefined };
}

function layerListFromAttribute(value) {
  return parseLayerListAttribute(value).layers;
}

function formatLayerListAttribute(layers) {
  if (!Array.isArray(layers)) return '';
  const names = layers.map((item) => (item == null ? '' : String(item))).filter((item) => item !== '');
  return names.length ? JSON.stringify(names) : '';
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

function normalizePathKey(value) {
  return slash(String(value || '')).toLowerCase();
}

function sourceFileKey(value) {
  return process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
}

function resolveLocalAssetReference(value, options = {}) {
  const input = String(value || '').trim();
  if (!input || isRemoteReference(input)) return null;
  if (isFileUrlReference(input)) {
    try {
      return path.resolve(fileURLToPath(input));
    } catch (_error) {
      return null;
    }
  }
  if (path.isAbsolute(input)) return path.resolve(input);
  const root = options.sourceRoot || options.baseDir || (options.resolveRelativeToCwd ? process.cwd() : null);
  return root ? path.resolve(root, input) : null;
}

function resourceReferenceIdentity(value, options = {}) {
  const raw = String(value || '');
  if (!raw) return null;
  const networkKey = networkResourceKey(raw);
  if (networkKey) return `network:${networkKey}`;
  const filePath = resolveLocalAssetReference(raw, options);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    return `sha256:${hash}`;
  }
  return `path:${slash(raw)}`;
}

function networkResourceKey(value) {
  const raw = String(value || '').trim();
  let host = '';
  let parts = [];
  if (/^file:/i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!parsed.hostname) return null;
      host = parsed.hostname;
      parts = parsed.pathname.split('/').filter(Boolean);
    } catch (_error) {
      return null;
    }
  } else {
    const normalized = slash(raw);
    const withoutPrefix = normalized.startsWith('/nas/')
      ? normalized.slice('/nas/'.length)
      : normalized.startsWith('//') ? normalized.slice(2) : '';
    if (!withoutPrefix) return null;
    const segments = withoutPrefix.split('/').filter(Boolean);
    host = segments.shift() || '';
    parts = segments;
  }
  if (!host || parts.length === 0) return null;
  const decoded = parts.map((part) => {
    try {
      return decodeURIComponent(part);
    } catch (_error) {
      return part;
    }
  });
  return `//${host}/${decoded.join('/')}`.toLowerCase();
}

function sanitizeRelative(value) {
  return slash(value)
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .map((part) => part.replace(/[<>:"|?*]/g, '_'))
    .join('/') || 'asset';
}

function isRemoteReference(value) {
  const input = String(value || '');
  return /^[a-z][a-z0-9+.-]*:/i.test(input)
    && !/^file:/i.test(input)
    && !/^[a-z]:[\\/]/i.test(input);
}

function isFileUrlReference(value) {
  return /^file:/i.test(String(value || ''));
}

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

module.exports = {
  inferAssetKind,
  inferAssetKindFromExtension,
  assetSourceFromElementLike,
  createAssetId,
  firstCssUrl,
  placementFromAttributes,
  LAYER_LIST_ENCODING,
  parseLayerListAttribute,
  formatLayerListAttribute,
  normalizePathKey,
  sourceFileKey,
  resolveLocalAssetReference,
  resourceReferenceIdentity,
  sanitizeRelative,
  isRemoteReference,
};
