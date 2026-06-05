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
  if (asset.path && !previewOnly && !nodeAttrs['data-id-asset-path']) out['data-id-asset-path'] = asset.path;
  if (kind && !nodeAttrs['data-id-asset-kind']) out['data-id-asset-kind'] = kind;
  if (previewPath && !nodeAttrs['data-id-preview-src']) out['data-id-preview-src'] = previewPath;
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
  const sourcePreview = nodeAttrs['data-id-preview-src'] || nodeAttrs['data-id-preview-asset-path'] || '';
  if (!preview) return sourcePreview;
  if (typeof preview === 'string') return preview;
  return preview.path || preview.htmlPath || preview.relativePath || sourcePreview;
}

function addAssetPlacementAttrs(out, nodeAttrs, asset, item) {
  if (isPreviewOnlyAsset(item, asset)) return;
  const placement = asset && asset.placement || {};
  const kind = assetKind(asset);
  const pageNumber = kind === 'pdf' ? assetPdfPageNumber(asset) : (placement.pageNumber || asset.pageNumber || null);
  if (kind === 'pdf' && pageNumber != null && !nodeAttrs['data-id-pdf-page']) out['data-id-pdf-page'] = String(pageNumber);
  if (kind === 'ai') {
    const artboard = placement.artboard || asset.artboard || placement.pageNumber || asset.pageNumber || null;
    if (artboard != null && !nodeAttrs['data-id-artboard']) out['data-id-artboard'] = String(artboard);
  }
  const crop = placement.crop || placement.pdfCropName || asset.crop || null;
  if (crop && !nodeAttrs['data-id-crop']) out['data-id-crop'] = normalizeCropToken(crop);
  const visibleLayers = layerListAttr(placement.visibleLayers);
  if (visibleLayers && !nodeAttrs['data-id-visible-layers']) out['data-id-visible-layers'] = visibleLayers;
  const hiddenLayers = layerListAttr(placement.hiddenLayers);
  if (hiddenLayers && !nodeAttrs['data-id-hidden-layers']) out['data-id-hidden-layers'] = hiddenLayers;
  const geometry = assetContentGeometry(item || { asset });
  if (geometry) {
    if (!nodeAttrs['data-id-fit']) out['data-id-fit'] = 'manual';
    if (!nodeAttrs['data-id-content-x']) out['data-id-content-x'] = px(geometry.x);
    if (!nodeAttrs['data-id-content-y']) out['data-id-content-y'] = px(geometry.y);
    if (!nodeAttrs['data-id-content-width']) out['data-id-content-width'] = px(geometry.width);
    if (!nodeAttrs['data-id-content-height']) out['data-id-content-height'] = px(geometry.height);
    if (geometry.scaleX != null && !nodeAttrs['data-id-content-scale-x']) out['data-id-content-scale-x'] = formatNumber(geometry.scaleX);
    if (geometry.scaleY != null && !nodeAttrs['data-id-content-scale-y']) out['data-id-content-scale-y'] = formatNumber(geometry.scaleY);
  }
}

function sanitizeRetiredAssetAttrs(attrs, item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset) || {};
  const kind = assetKind(asset);
  if (isPreviewOnlyAsset(item, asset)) {
    delete attrs['data-id-asset-path'];
    delete attrs['data-id-fit'];
    delete attrs['data-id-content-x'];
    delete attrs['data-id-content-y'];
    delete attrs['data-id-content-width'];
    delete attrs['data-id-content-height'];
    delete attrs['data-id-content-scale-x'];
    delete attrs['data-id-content-scale-y'];
  }
  if (kind === 'pdf' || kind === 'ai') delete attrs['data-id-page'];
  if (kind === 'pdf' && attrs['data-id-pdf-page'] != null && positiveIntegerOrNull(attrs['data-id-pdf-page']) == null) {
    delete attrs['data-id-pdf-page'];
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
  const hasPreview = Boolean(nodeAttrs['data-id-preview-src'] || nodeAttrs['data-id-preview-asset-path'] || assetPreviewPath(asset));
  const hasOriginalPath = Boolean(nodeAttrs['data-id-asset-path']);
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
