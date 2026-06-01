const { isVoidTag } = require('./author-attribute-writer');
const { buildAuthorTree } = require('./author-tree-builder');
const { tagForAsset } = require('./author-asset-attrs');
const { renderPlacedAssetFrameNode, shouldRenderPlacedAssetFrame } = require('./author-asset-renderer');
const { attrsForItem, sourceNodeForItem } = require('./author-node-attrs');
const { isPdfObjectItem, renderPdfObjectNode } = require('./author-pdf-renderer');
const { ownContent } = require('./author-rich-text-renderer');
const { indent, safeTag, tagForRole } = require('./author-render-utils');
const { renderVectorSvgNode, shouldRenderVectorSvg } = require('./author-vector-renderer');

function pageItemsToAuthorHtml(page, options = {}) {
  const tree = buildAuthorTree(page);
  return tree.map((node) => renderNode(node, options, 0)).join('\n');
}

function renderNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  if (shouldRenderVectorSvg(item, sourceNode, options)) return renderVectorSvgNode(node, options, depth);
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  if (shouldRenderPlacedAssetFrame(item, sourceNode, options, tag)) {
    return renderPlacedAssetFrameNode(node, options, depth, renderNode);
  }
  if (isPdfObjectItem(item, sourceNode, tag)) {
    return renderPdfObjectNode(node, options, depth, renderNode);
  }
  const attrs = attrsForItem(item, sourceNode, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  if (isVoidTag(tag)) return `${indent(depth)}${open}`;
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const own = ownContent(item, depth);
  if (children) {
    return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
  }
  return `${indent(depth)}${open}${own}</${tag}>`;
}

module.exports = {
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
