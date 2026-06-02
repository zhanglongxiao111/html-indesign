const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const {
  assetContentGeometry,
  assetPreviewPath,
  shouldUsePreviewImage,
  usesGeneratedFramePreview,
} = require('./author-asset-attrs');
const { attrsForItem, shouldPreserveTrustedSource } = require('./author-node-attrs');
const { rewriteResourceAttrs } = require('./author-resource-paths');
const { mergeCss } = require('./author-style-attrs');
const { fileStem, indent, orderAttrs, px } = require('./author-render-utils');

function shouldRenderPlacedAssetFrame(item, sourceNode, options, tag) {
  if (!item || item.role !== 'graphic') return false;
  if (tag !== 'img') return false;
  if (!assetContentGeometry(item)) return false;
  if (shouldPreserveTrustedSource(item, sourceNode, options)) return false;
  return true;
}

function renderPlacedAssetFrameNode(node, options, depth, renderNode) {
  const item = node.item;
  const sourceNode = item && item.effectiveLabel && item.effectiveLabel.sourceNode || item.sourceNode || {};
  const frameSource = placedAssetFrameSourceNode(sourceNode);
  const attrs = attrsForItem(item, frameSource, options);
  const childAttrs = placedAssetContentAttrs(item, sourceNode, options);
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const body = [
    childAttrs ? `${indent(depth + 2)}<img ${childAttrs}>` : null,
    children || null,
  ].filter(Boolean).join('\n');
  return `${indent(depth)}<figure ${attrs}>\n${body}\n${indent(depth)}</figure>`;
}

function placedAssetFrameSourceNode(sourceNode) {
  const attrs = mergeAttributes(sourceNode && sourceNode.attributes);
  delete attrs.src;
  delete attrs.data;
  delete attrs.href;
  delete attrs.type;
  delete attrs.alt;
  return {
    ...sourceNode,
    tagName: 'figure',
    attributes: attrs,
    generatedFrame: true,
  };
}

function placedAssetContentAttrs(item, sourceNode, options) {
  const asset = item.sourceAsset || item.asset || {};
  if (!asset.path) return '';
  const previewPath = assetPreviewPath(asset);
  const src = shouldUsePreviewImage(asset) && previewPath ? previewPath : asset.path;
  const attrs = {
    class: usesGeneratedFramePreview(asset) ? 'placed-asset-preview' : 'placed-asset-content',
    src,
    alt: (sourceNode && sourceNode.attributes && sourceNode.attributes.alt) || fileStem(asset.path),
    'data-id-ignore': '',
    style: placedAssetContentStyle(item, asset),
  };
  rewriteResourceAttrs(attrs, options);
  return attrsToHtml(orderAttrs(attrs));
}

function placedAssetContentStyle(item, asset) {
  if (usesGeneratedFramePreview(asset)) return placedAssetPreviewStyle();
  const geometry = assetContentGeometry(item);
  return mergeCss([
    'position:absolute',
    `left:${px(geometry.x)}`,
    `top:${px(geometry.y)}`,
    `width:${px(geometry.width)}`,
    `height:${px(geometry.height)}`,
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ]);
}

function placedAssetPreviewStyle() {
  return mergeCss([
    'position:absolute',
    'left:0px',
    'top:0px',
    'width:100%',
    'height:100%',
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ]);
}

module.exports = {
  renderPlacedAssetFrameNode,
  shouldRenderPlacedAssetFrame,
  placedAssetFrameSourceNode,
  placedAssetContentAttrs,
};
