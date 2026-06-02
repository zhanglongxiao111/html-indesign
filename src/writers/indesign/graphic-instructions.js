const { round } = require('../../shared/geometry');
const { placementFromAttributes } = require('../../adapters/html/reader/asset-detector');
const { assetSourceFromElementLike } = require('../../shared/assets');
const {
  cssLengthToTarget,
  cssLengthToMm,
  normalizeVisualMm,
} = require('../../semantic-model/layout');

function graphicContentBounds(item, bounds, layout, placement = null) {
  const explicit = explicitGraphicContentBounds(bounds, placement, layout);
  if (explicit) return explicit;
  const padding = paddingForItem(item, layout);
  if (!padding.top && !padding.right && !padding.bottom && !padding.left) return null;
  return insetBounds(bounds, padding);
}

function explicitGraphicContentBounds(bounds, placement, layout) {
  if (!placement) return null;
  if (placement.contentBox) {
    const box = placement.contentBox;
    return {
      x: round(bounds.x + cssLengthToTarget(box.x, layout), 2),
      y: round(bounds.y + cssLengthToTarget(box.y, layout), 2),
      width: round(cssLengthToTarget(box.width, layout), 2),
      height: round(cssLengthToTarget(box.height, layout), 2),
    };
  }
  if (placement.contentBounds) {
    const box = placement.contentBounds;
    return {
      x: round(numberOrCssLength(box.x, layout), 2),
      y: round(numberOrCssLength(box.y, layout), 2),
      width: round(numberOrCssLength(box.width, layout), 2),
      height: round(numberOrCssLength(box.height, layout), 2),
    };
  }
  return null;
}

function paddingForItem(item, layout) {
  if (layout.unitMode === 'presentation') {
    const style = item.computedStyle || {};
    return {
      top: cssLengthToTarget(style.paddingTop, layout),
      right: cssLengthToTarget(style.paddingRight, layout),
      bottom: cssLengthToTarget(style.paddingBottom, layout),
      left: cssLengthToTarget(style.paddingLeft, layout),
    };
  }
  const style = item.computedStyle || {};
  return {
    top: normalizeVisualMm(cssLengthToMm(style.paddingTop)),
    right: normalizeVisualMm(cssLengthToMm(style.paddingRight)),
    bottom: normalizeVisualMm(cssLengthToMm(style.paddingBottom)),
    left: normalizeVisualMm(cssLengthToMm(style.paddingLeft)),
  };
}

function numberOrCssLength(value, layout) {
  return typeof value === 'number' ? value : cssLengthToTarget(value, layout);
}

function insetBounds(bounds, padding) {
  const width = Math.max(0, bounds.width - padding.left - padding.right);
  const height = Math.max(0, bounds.height - padding.top - padding.bottom);
  return {
    x: round(bounds.x + padding.left, 2),
    y: round(bounds.y + padding.top, 2),
    width: round(width, 2),
    height: round(height, 2),
  };
}

function assetForItem(item, assets) {
  const source = assetSourceFromElementLike({
    tagName: item.tagName,
    attributes: item.attributes,
    computedStyle: item.computedStyle,
    authoredStyle: item.authoredStyle,
  }).src;
  return assets.find((asset) => source && asset.src === source)
    || assets.find((asset) => asset.sourceSelector === item.sourceSelector)
    || null;
}

function placementForItem(item, asset) {
  const itemPlacement = placementFromAttributes(item.attributes || {}, item.computedStyle || {});
  const assetPlacement = asset.placement || {};
  const sameSource = asset.sourceSelector && item.sourceSelector && asset.sourceSelector === item.sourceSelector;
  return {
    fit: itemPlacement.fit || assetPlacement.fit || 'fill',
    position: itemPlacement.position || assetPlacement.position || '50% 50%',
    pageNumber: itemPlacement.pageNumber || (sameSource ? assetPlacement.pageNumber : undefined),
    crop: itemPlacement.crop || (sameSource ? assetPlacement.crop : undefined),
    artboard: itemPlacement.artboard || (sameSource ? assetPlacement.artboard : undefined),
    layerComp: itemPlacement.layerComp || (sameSource ? assetPlacement.layerComp : undefined),
    visibleLayers: itemPlacement.visibleLayers || (sameSource ? assetPlacement.visibleLayers : undefined),
    hiddenLayers: itemPlacement.hiddenLayers || (sameSource ? assetPlacement.hiddenLayers : undefined),
    preserveVector: itemPlacement.preserveVector || (sameSource ? assetPlacement.preserveVector : undefined),
    contentBox: itemPlacement.contentBox || (sameSource ? assetPlacement.contentBox : undefined),
    contentBounds: itemPlacement.contentBounds || (sameSource ? assetPlacement.contentBounds : undefined),
  };
}

module.exports = {
  graphicContentBounds,
  paddingForItem,
  insetBounds,
  assetForItem,
  placementForItem,
};
