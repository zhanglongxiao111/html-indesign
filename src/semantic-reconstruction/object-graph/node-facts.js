const {
  readBounds,
  normalizeBounds,
  metrics,
} = require('./bounds');

function nodeFactForItem(item = {}, page = {}, itemIndex = 0) {
  const bounds = readBounds(item);
  const normalizedBounds = normalizeBounds(bounds, page);
  if (!bounds || !normalizedBounds) {
    return {
      node: null,
      unresolved: {
        itemId: item.id || null,
        reason: bounds ? 'page-size-missing' : 'bounds-missing',
      },
    };
  }

  const boundsMetrics = metrics(bounds);
  const sourceType = item.role || 'unknown';
  const node = {
    id: item.id || `item-${itemIndex + 1}`,
    pageId: page.id || null,
    sourceType,
    bounds,
    normalizedBounds,
    size: {
      width: bounds.width,
      height: bounds.height,
      area: boundsMetrics.area,
    },
    rotation: numberOrDefault(item.rotation, 0),
    zOrder: zOrderForItem(item, itemIndex),
    textFacts: textFactsForItem(item, sourceType),
    assetFacts: assetFactsForItem(item),
    visualFacts: visualFactsForItem(item),
    labelFacts: labelFactsForItem(item),
    observedFacts: observedFactsForItem(item),
    _metrics: boundsMetrics,
  };

  return { node, unresolved: null };
}

function publicNode(node) {
  const { _metrics, ...out } = node;
  return out;
}

function textFactsForItem(item = {}, sourceType) {
  if (sourceType !== 'text') return null;
  const text = textForItem(item);
  const lines = text ? text.split(/\r\n|\r|\n/) : [];
  const textStyle = item.textStyle || {};
  return {
    length: text.length,
    lineCount: Math.max(lines.length, text ? 1 : 0),
    firstLine: truncate(lines[0] || '', 80),
    align: item.align || textStyle.align || textStyle.textAlign || 'unknown',
    fontSize: numberOrNull(textStyle.fontSize || item.fontSize),
    fontWeight: textStyle.fontWeight || item.fontWeight || null,
    overset: Boolean(item.overset || item.textOverset),
  };
}

function assetFactsForItem(item = {}) {
  const asset = item.asset || item.placedAsset || null;
  if (!asset) return null;
  return {
    kind: asset.kind || asset.type || null,
    path: asset.path || asset.href || asset.src || null,
    pageNumber: asset.pageNumber || asset.page || null,
    crop: asset.crop || null,
    fitting: asset.fitting || asset.fit || null,
    frameBounds: asset.frameBounds || null,
    contentBounds: asset.contentBounds || null,
  };
}

function visualFactsForItem(item = {}) {
  const visual = item.visualStyle || {};
  const styleRefs = item.styleRefs || {};
  return cleanObject({
    fill: visual.fill || visual.fillColor || null,
    stroke: visual.stroke || visual.strokeColor || null,
    strokeWeight: numberOrNull(visual.strokeWeight),
    opacity: numberOrNull(visual.opacity),
    cornerRadius: numberOrNull(visual.cornerRadius || visual.borderRadius),
    objectStyle: styleRefs.objectStyle || null,
    paragraphStyle: styleRefs.paragraphStyle || null,
    frameStyle: styleRefs.frameStyle || null,
  });
}

function labelFactsForItem(item = {}) {
  return {
    labelStatus: item.labelStatus || null,
    hasEffectiveLabel: Boolean(item.effectiveLabel && Object.keys(item.effectiveLabel).length),
    hasObservedLabel: Boolean(item.observedLabel && Object.keys(item.observedLabel).length),
    rejectionReasons: Array.isArray(item.rejectionReasons) ? item.rejectionReasons.slice() : [],
  };
}

function observedFactsForItem(item = {}) {
  return cleanObject({
    indesignLayerName: item.layerName || item.indesignLayerName || null,
    indesignLayerIndex: item.layerIndex == null ? null : item.layerIndex,
  });
}

function textForItem(item = {}) {
  if (item.content && typeof item.content.text === 'string') return item.content.text;
  if (typeof item.text === 'string') return item.text;
  return '';
}

function zOrderForItem(item = {}, itemIndex = 0) {
  return numberOrNull(item.zOrder) ?? numberOrNull(item.zIndex) ?? itemIndex;
}

function numberOrDefault(value, fallback) {
  const number = numberOrNull(value);
  return number == null ? fallback : number;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function cleanObject(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (entry !== null && entry !== undefined && entry !== '') out[key] = entry;
  }
  return out;
}

module.exports = {
  nodeFactForItem,
  publicNode,
};
