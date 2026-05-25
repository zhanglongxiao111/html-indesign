const path = require('path');

const RASTER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.bmp']);

function cleanKind(value) {
  const kind = String(value || '').trim().toLowerCase();
  if (['raster', 'pdf', 'psd', 'ai', 'svg', 'vector', 'fallback'].includes(kind)) return kind;
  return null;
}

function inferAssetKind(src, explicitKind) {
  const cleanExplicit = cleanKind(explicitKind);
  if (cleanExplicit) return cleanExplicit;
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
  const explicitKind = cleanKind(attrs['data-id-asset-kind']);
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

module.exports = {
  inferAssetKind,
  assetSourceFromElementLike,
  createAssetId,
  firstCssUrl,
};
