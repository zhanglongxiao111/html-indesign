const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath, pathToFileURL } = require('node:url');
const {
  attr,
  escapeHtml,
  formatPx,
  formatNumber,
  finiteOrZero,
  finiteOrNull,
} = require('./visual-html-utils');

function assetHtml(item, options) {
  const asset = item.asset || {};
  if (!asset.path) return '';
  const url = assetUrl(asset.path, options);
  const label = asset.name || item.semantic || item.id;
  const extension = String(asset.name || asset.path).toLowerCase();
  const fit = asset.cropped ? 'cover' : 'contain';
  const geometry = assetContentGeometry(asset);
  const previewPath = placedPreviewPath(asset);
  const kind = assetKind(asset);
  const framePreview = previewPath && usesGeneratedFramePreview(asset);
  const geometryAttrs = assetGeometryAttrs(asset, geometry, framePreview);
  const fallbackFitStyle = geometryAttrs ? '' : ` style="object-fit:${fit}"`;
  if (previewPath && ['pdf', 'ai', 'psd'].includes(kind)) {
    return `<img src="${attr(assetUrl(previewPath, options))}"${geometryAttrs} alt="${attr(label)}" data-id-preview-kind="${attr(kind)}" data-id-preview-asset-path="${attr(previewPath)}"${fallbackFitStyle}>`;
  }
  if (kind === 'image' || kind === 'raster' || /\.(png|jpe?g|jfif|gif|webp|svg|bmp|tiff?)$/.test(extension)) {
    return `<img src="${attr(url)}"${geometryAttrs} alt="${attr(label)}"${fallbackFitStyle}>`;
  }
  if (/\.pdf$/.test(extension)) {
    const previewPath = placedPreviewPath(asset);
    if (previewPath) {
      const pdfFramePreview = usesGeneratedFramePreview(asset);
      const pdfGeometryAttrs = assetGeometryAttrs(asset, geometry, pdfFramePreview);
      const pdfFallbackFitStyle = pdfGeometryAttrs ? '' : ` style="object-fit:${fit}"`;
      return `<img src="${attr(assetUrl(previewPath, options))}"${pdfGeometryAttrs} alt="${attr(label)}" data-id-preview-kind="pdf" data-id-preview-asset-path="${attr(previewPath)}"${pdfFallbackFitStyle}>`;
    }
    return `<object data="${attr(url)}" type="application/pdf" aria-label="${attr(label)}"${geometry ? ` style="${attr(placedAssetContentStyle(geometry))}"` : ` style="object-fit:${fit}"`}></object>`;
  }
  return `<span class="id-asset-placeholder">${escapeHtml(label)}</span>`;
}

function assetGeometryAttrs(asset, geometry, framePreview) {
  if (framePreview) return ` class="placed-asset-preview" style="${attr(placedAssetPreviewStyle())}"`;
  if (!geometry) return '';
  return ` class="placed-asset-content" style="${attr(placedAssetContentStyle(geometry))}"`;
}

function assetPlacementAttrs(asset = {}) {
  asset = asset || {};
  const geometry = assetContentGeometry(asset);
  const out = [];
  const pdfPageNumber = assetPdfPageNumber(asset);
  if (pdfPageNumber != null) out.push(`data-id-pdf-page="${attr(pdfPageNumber)}"`);
  if (assetKind(asset) === 'ai') {
    const placement = asset.placement || {};
    const artboard = placement.artboard || asset.artboard || placement.pageNumber || asset.pageNumber || null;
    if (artboard != null) out.push(`data-id-artboard="${attr(artboard)}"`);
  }
  if (geometry) {
    out.push(
      'data-id-fit="manual"',
      `data-id-content-x="${attr(formatPx(geometry.x))}"`,
      `data-id-content-y="${attr(formatPx(geometry.y))}"`,
      `data-id-content-width="${attr(formatPx(geometry.width))}"`,
      `data-id-content-height="${attr(formatPx(geometry.height))}"`,
    );
    if (geometry.scaleX != null) out.push(`data-id-content-scale-x="${attr(formatNumber(geometry.scaleX))}"`);
    if (geometry.scaleY != null) out.push(`data-id-content-scale-y="${attr(formatNumber(geometry.scaleY))}"`);
  }
  return out;
}

function assetPdfPageNumber(asset = {}) {
  if (assetKind(asset) !== 'pdf') return null;
  const placement = asset.placement || {};
  return placement.pageNumber || asset.pageNumber || null;
}

function assetContentGeometry(asset = {}) {
  asset = asset || {};
  const placement = asset.placement || {};
  let offset = placement.contentOffset || null;
  let size = placement.contentSize || null;
  const frameBounds = placement.frameBounds || null;
  const contentBounds = placement.contentBounds || null;
  if ((!offset || !size) && frameBounds && contentBounds) {
    offset = offset || {
      x: Number(contentBounds.x || 0) - Number(frameBounds.x || 0),
      y: Number(contentBounds.y || 0) - Number(frameBounds.y || 0),
    };
    size = size || {
      width: Number(contentBounds.width || 0),
      height: Number(contentBounds.height || 0),
    };
  }
  if (!offset || !size) return null;
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    x: finiteOrZero(offset.x),
    y: finiteOrZero(offset.y),
    width,
    height,
    scaleX: finiteOrNull(placement.contentScale && placement.contentScale.x),
    scaleY: finiteOrNull(placement.contentScale && placement.contentScale.y),
  };
}

function placedAssetContentStyle(geometry) {
  return [
    'position:absolute',
    `left:${formatPx(geometry.x)}`,
    `top:${formatPx(geometry.y)}`,
    `width:${formatPx(geometry.width)}`,
    `height:${formatPx(geometry.height)}`,
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ].join(';');
}

function placedAssetPreviewStyle() {
  return [
    'position:absolute',
    'left:0px',
    'top:0px',
    'width:100%',
    'height:100%',
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ].join(';');
}

function placedPreviewPath(asset) {
  const explicit = asset.previewPath || previewValue(asset.preview) || asset.previewAssetPath;
  if (explicit) return explicit;
  const rawPath = String(asset.path || '');
  if (!rawPath || !path.isAbsolute(rawPath)) return null;
  const pageNumber = assetPdfPageNumber(asset);
  if (pageNumber == null) return null;
  const parsed = path.parse(rawPath);
  const page = Number(pageNumber);
  const candidates = [
    path.join(parsed.dir, `${parsed.name}-page${page}.png`),
    path.join(parsed.dir, `${parsed.name}-page-${page}.png`),
    path.join(parsed.dir, `${parsed.name}-preview.png`),
    path.join(parsed.dir, `${parsed.name}.png`),
  ];
  return candidates.find(fileExists) || null;
}

function usesGeneratedFramePreview(asset) {
  const preview = asset && asset.preview;
  return preview && typeof preview === 'object' && preview.source === 'indesign-frame-export';
}

function previewValue(preview) {
  if (!preview) return '';
  if (typeof preview === 'string') return preview;
  return preview.path || preview.htmlPath || preview.relativePath || '';
}

function assetKind(asset) {
  const ext = path.extname(String(asset.path || '')).toLowerCase().replace(/^\./, '');
  if (['pdf', 'ai', 'psd', 'svg'].includes(ext)) return ext;
  const raw = String(asset.kind || asset.graphicType || asset.imageTypeName || '').toLowerCase();
  if (raw === 'pdf' || raw.includes('adobe pdf')) return 'pdf';
  if (raw === 'psd' || raw.includes('photoshop')) return 'psd';
  if (raw === 'ai' || raw.includes('illustrator')) return 'ai';
  return raw;
}

function assetUrl(assetPath, options = {}) {
  const rawPath = String(assetPath || '');
  if (/^https?:/i.test(rawPath)) return rawPath;

  let localPath = rawPath;
  if (/^file:/i.test(rawPath)) {
    try {
      localPath = fileURLToPath(rawPath);
    } catch (_) {
      return rawPath;
    }
  }

  if (options && options.outputDir && path.isAbsolute(localPath)) {
    return filePathToUrlPath(path.relative(path.resolve(options.outputDir), localPath));
  }

  if (/^file:/i.test(rawPath)) return rawPath;
  return pathToFileURL(localPath).href;
}

function filePathToUrlPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => (segment === '..' || segment === '.' ? segment : encodeURIComponent(segment)))
    .join('/');
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_) {
    return false;
  }
}

module.exports = {
  assetHtml,
  assetPlacementAttrs,
};
