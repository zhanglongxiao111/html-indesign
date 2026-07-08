const { HTML_DATA_ID_ATTRIBUTES, RETIRED_HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const {
  finiteOrNull,
  fileExtension,
  fileStem,
  formatNumber,
  layerListAttr,
  normalizeCropToken,
  numberOrZero,
  positiveIntegerOrNull,
  px,
} = require('./author-render-utils');

function assetAttributes(item, tagName) {
  const nodeAttrs = sourceNodeAttrsForItem(item);
  const asset = item.sourceAsset || item.asset || {};
  const tag = String(tagName || item.sourceNode && item.sourceNode.tagName || '').toLowerCase();
  const out = {};
  const previewPath = assetPreviewPath(asset, item);
  const previewOnly = isPreviewOnlyAsset(item, asset);
  const renderPath = shouldUsePreviewImage(asset, item) && previewPath ? previewPath : asset.path;
  if (tag === 'img' && !nodeAttrs.src && renderPath) out.src = renderPath;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.data && asset.path) out.data = asset.path;
  const kind = assetKind(asset);
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.type && kind === 'pdf') out.type = 'application/pdf';
  if (asset.path && !previewOnly && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH]) out[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH] = asset.path;
  if (kind && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.ASSET_KIND]) out[HTML_DATA_ID_ATTRIBUTES.ASSET_KIND] = kind;
  if (previewPath && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC]) out[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] = previewPath;
  addAssetPlacementAttrs(out, nodeAttrs, asset, item);
  if (tag === 'img' && !nodeAttrs.alt && renderPath) out.alt = fileStem(asset.path || renderPath);
  return out;
}

function tagForAsset(item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset);
  if (!asset) return '';
  const previewPath = assetPreviewPath(asset, item);
  if (!asset.path && !previewPath) return '';
  const kind = assetKind(asset);
  const ext = fileExtension(asset.path);
  if (shouldUsePreviewImage(asset, item)) return 'img';
  if (kind === 'pdf' || ext === 'pdf') return 'object';
  if (kind === 'svg' || ext === 'svg') return 'img';
  if (kind === 'image' || kind === 'raster' || ['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'bmp', 'tif', 'tiff'].includes(ext)) return 'img';
  return 'object';
}

function assetKind(asset) {
  const ext = fileExtension(asset && asset.path);
  if (ext === 'pdf' || ext === 'ai' || ext === 'psd' || ext === 'svg') return ext;
  const raw = String(asset && (asset.kind || asset.graphicType || asset.imageTypeName) || '').toLowerCase();
  if (raw === 'pdf' || raw.includes('adobe pdf')) return 'pdf';
  if (raw === 'psd' || raw.includes('photoshop')) return 'psd';
  if (raw === 'ai' || raw.includes('illustrator')) return 'ai';
  if (raw === 'image') return 'image';
  if (raw === 'raster') return 'raster';
  return raw || '';
}

function shouldUsePreviewImage(asset, item = null) {
  if (!assetPreviewPath(asset, item)) return false;
  const kind = assetKind(asset);
  return ['pdf', 'ai', 'psd'].includes(kind) || (isPreviewOnlyAsset(item, asset) && ['image', 'raster'].includes(kind));
}

function usesGeneratedFramePreview(asset, item = null) {
  const preview = asset && asset.preview;
  if (!shouldUsePreviewImage(asset, item)) return false;
  if (isPreviewOnlyAsset(item, asset)) return true;
  return preview && typeof preview === 'object' && preview.source === 'indesign-frame-export';
}

function assetPreviewPath(asset, item = null) {
  const preview = asset && asset.preview;
  const nodeAttrs = sourceNodeAttrsForItem(item);
  const sourcePreview = nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] || nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_ASSET_PATH] || '';
  if (sourcePreview) return sourcePreview;
  if (!preview) return sourcePreview;
  if (typeof preview === 'string') return preview;
  return preview.path || preview.htmlPath || preview.relativePath || '';
}

function addAssetPlacementAttrs(out, nodeAttrs, asset, item) {
  if (isPreviewOnlyAsset(item, asset)) return;
  const placement = asset && asset.placement || {};
  const kind = assetKind(asset);
  const pageNumber = kind === 'pdf' ? assetPdfPageNumber(asset) : (placement.pageNumber || asset.pageNumber || null);
  if (kind === 'pdf' && pageNumber != null && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE]) out[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE] = String(pageNumber);
  if (kind === 'ai') {
    const artboard = placement.artboard || asset.artboard || placement.pageNumber || asset.pageNumber || null;
    if (artboard != null && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.ARTBOARD]) out[HTML_DATA_ID_ATTRIBUTES.ARTBOARD] = String(artboard);
  }
  const crop = placement.crop || placement.pdfCropName || asset.crop || null;
  if (crop && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CROP]) out[HTML_DATA_ID_ATTRIBUTES.CROP] = normalizeCropToken(crop);
  const visibleLayers = layerListAttr(placement.visibleLayers);
  if (visibleLayers && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.VISIBLE_LAYERS]) out[HTML_DATA_ID_ATTRIBUTES.VISIBLE_LAYERS] = visibleLayers;
  const hiddenLayers = layerListAttr(placement.hiddenLayers);
  if (hiddenLayers && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.HIDDEN_LAYERS]) out[HTML_DATA_ID_ATTRIBUTES.HIDDEN_LAYERS] = hiddenLayers;
  const geometry = assetContentGeometry(item || { asset });
  if (geometry) {
    if (!nodeAttrs[HTML_DATA_ID_ATTRIBUTES.FIT]) out[HTML_DATA_ID_ATTRIBUTES.FIT] = 'manual';
    if (!nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_X]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_X] = px(geometry.x);
    if (!nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_Y]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_Y] = px(geometry.y);
    if (!nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_WIDTH]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_WIDTH] = px(geometry.width);
    if (!nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_HEIGHT]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_HEIGHT] = px(geometry.height);
    if (geometry.scaleX != null && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_X]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_X] = formatNumber(geometry.scaleX);
    if (geometry.scaleY != null && !nodeAttrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_Y]) out[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_Y] = formatNumber(geometry.scaleY);
  }
}

function sanitizeRetiredAssetAttrs(attrs, item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset) || {};
  const kind = assetKind(asset);
  if (isPreviewOnlyAsset(item, asset)) {
    delete attrs[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.FIT];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_X];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_Y];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_WIDTH];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_HEIGHT];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_X];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.CONTENT_SCALE_Y];
  }
  if (kind === 'pdf' || kind === 'ai') delete attrs[RETIRED_HTML_DATA_ID_ATTRIBUTES.PAGE];
  if (kind === 'pdf' && attrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE] != null && positiveIntegerOrNull(attrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE]) == null) {
    delete attrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE];
  }
}

function assetPdfPageNumber(asset) {
  const kind = assetKind(asset);
  if (kind !== 'pdf') return null;
  const placement = asset && asset.placement || {};
  return positiveIntegerOrNull(placement.pageNumber ?? asset.pageNumber);
}

function assetContentGeometry(item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset) || {};
  if (isPreviewOnlyAsset(item, asset)) return null;
  const placement = asset.placement || {};
  let offset = placement.contentOffset || null;
  let size = placement.contentSize || null;
  const frameBounds = placement.frameBounds || item && item.bounds || null;
  const contentBounds = placement.contentBounds || null;
  if ((!offset || !size) && contentBounds && frameBounds) {
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
    x: numberOrZero(offset.x),
    y: numberOrZero(offset.y),
    width,
    height,
    scaleX: finiteOrNull(placement.contentScale && placement.contentScale.x),
    scaleY: finiteOrNull(placement.contentScale && placement.contentScale.y),
  };
}

function isPreviewOnlyAsset(item, asset = {}) {
  const nodeAttrs = sourceNodeAttrsForItem(item);
  const hasPreview = Boolean(nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_SRC] || nodeAttrs[HTML_DATA_ID_ATTRIBUTES.PREVIEW_ASSET_PATH] || assetPreviewPath(asset));
  const hasOriginalPath = Boolean(nodeAttrs[HTML_DATA_ID_ATTRIBUTES.ASSET_PATH]);
  const kind = assetKind(asset);
  return hasPreview && !hasOriginalPath && (!asset.path || ['image', 'raster'].includes(kind));
}

function sourceNodeAttrsForItem(item) {
  const sourceNode = item && item.effectiveLabel && item.effectiveLabel.sourceNode || item && item.sourceNode || {};
  return sourceNode.attributes || {};
}

function pdfPreviewPath(pdfPath, page) {
  const value = String(pdfPath || '');
  if (!/\.pdf(?:[?#].*)?$/i.test(value)) return '';
  const pageNumber = positiveIntegerOrNull(page);
  if (pageNumber == null) return '';
  return value.replace(/\.pdf(?:[?#].*)?$/i, `-page${pageNumber}.png`);
}

module.exports = {
  assetAttributes,
  tagForAsset,
  assetKind,
  shouldUsePreviewImage,
  usesGeneratedFramePreview,
  assetPreviewPath,
  assetPdfPageNumber,
  assetContentGeometry,
  sanitizeRetiredAssetAttrs,
  pdfPreviewPath,
};
