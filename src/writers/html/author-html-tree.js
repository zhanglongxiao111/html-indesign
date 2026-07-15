const { isVoidTag } = require('./author-attribute-writer');
const { buildAuthorTree } = require('./author-tree-builder');
const { tagForAsset } = require('./author-asset-attrs');
const {
  renderAssetFigureNode,
  renderPlacedAssetFrameNode,
  shouldRenderAssetFigureNode,
  shouldRenderPlacedAssetFrame,
} = require('./author-asset-renderer');
const { attrsForItem, sourceNodeForItem } = require('./author-node-attrs');
const { isPdfObjectItem, renderPdfObjectNode } = require('./author-pdf-renderer');
const { ownContent, sourceHtmlContent } = require('./author-rich-text-renderer');
const { indent, safeTag, tagForRole } = require('./author-render-utils');
const { AUTHOR_HTML_SAFE_INLINE_TAGS } = require('./safe-tags');
const { renderVectorSvgNode, shouldRenderVectorSvg } = require('./author-vector-renderer');
const { normalizeLineEndings } = require('../../shared/text');

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
  if (shouldRenderAssetFigureNode(item, sourceNode, tag)) {
    return renderAssetFigureNode(node, options, depth, renderNode);
  }
  if (isPdfObjectItem(item, sourceNode, tag)) {
    return renderPdfObjectNode(node, options, depth, renderNode);
  }
  const attrs = attrsForItem(item, sourceNode, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  if (isVoidTag(tag)) return `${indent(depth)}${open}`;
  const preservedInlineSourceHtml = inlineSourceHtmlForNode(node, options, depth);
  if (preservedInlineSourceHtml != null) {
    return `${indent(depth)}${open}${preservedInlineSourceHtml}</${tag}>`;
  }
  const own = ownContent(item, depth, { ignoreSourceHtml: node.children.length > 0 });
  if (node.children.length && node.children.every(isInlineNode)) {
    const children = node.children.map((child) => renderNode(child, options, 0)).join('');
    return `${indent(depth)}${open}${own}${children}</${tag}>`;
  }
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  if (children) {
    return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
  }
  return `${indent(depth)}${open}${own}</${tag}>`;
}

function isInlineNode(node) {
  const item = node && node.item || {};
  const sourceNode = sourceNodeForItem(item);
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  return AUTHOR_HTML_SAFE_INLINE_TAGS.has(tag);
}

function inlineSourceHtmlForNode(node, options = {}, depth = 0) {
  if (!options.preserveTrustedSource || options.mode === 'observation') return null;
  if (!node.children.length || !node.children.every(isInlineSubtree)) return null;
  const item = node.item || {};
  const sourceNode = sourceNodeForItem(item);
  const sourceHtml = item.virtual
    ? sourceNode.sourceHtml
    : item.content && item.content.sourceHtml;
  if (typeof sourceHtml !== 'string' || sourceHtml === '') return null;
  if (!node.children.every(sourceTextIsUnchanged)) return null;
  return sourceHtmlContent(sourceHtml, depth);
}

function isInlineSubtree(node) {
  return isInlineNode(node) && node.children.every(isInlineSubtree);
}

function sourceTextIsUnchanged(node) {
  const item = node && node.item || {};
  if (!item.virtual) {
    const label = sourceLabelForItem(item);
    if (!label || typeof label.sourceText !== 'string') return false;
    const currentText = item.content && typeof item.content.text === 'string'
      ? item.content.text
      : '';
    if (normalizeLineEndings(currentText) !== normalizeLineEndings(label.sourceText)) return false;
  }
  return node.children.every(sourceTextIsUnchanged);
}

function sourceLabelForItem(item) {
  if (item && item.effectiveLabel && typeof item.effectiveLabel.sourceText === 'string') {
    return item.effectiveLabel;
  }
  return (item && item.labels || []).find((label) => label && typeof label.sourceText === 'string') || null;
}

module.exports = {
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
