const { isVoidTag } = require('./author-attribute-writer');
const { buildAuthorTree } = require('./author-tree-builder');
const { tagForAsset } = require('./author-asset-attrs');
const {
  renderAssetFigureNode,
  renderPlacedAssetFrameNode,
  shouldRenderAssetFigureNode,
  shouldRenderPlacedAssetFrame,
} = require('./author-asset-renderer');
const { attrsForItem, shouldPreserveTrustedSource, sourceNodeForItem } = require('./author-node-attrs');
const { isPdfObjectItem, renderPdfObjectNode } = require('./author-pdf-renderer');
const { ownContent, sourceHtmlContent } = require('./author-rich-text-renderer');
const { indent, safeTag, tagForRole } = require('./author-render-utils');
const { AUTHOR_HTML_SAFE_INLINE_TAGS } = require('./safe-tags');
const {
  renderVectorContainerNode,
  renderVectorSvgNode,
  shouldRenderVectorSvg,
  vectorContainerIdsForPage,
  vectorNodeHasAuthorContent,
} = require('./author-vector-renderer');
const { reverseGeometryPlanForPage } = require('./author-reverse-geometry');
const { normalizeLineEndings } = require('../../shared/text');

const AUTHOR_ITEM_DROPPED = 'REVERSE_AUTHOR_ITEM_DROPPED';

function reverseGeometryPageOptions(plan) {
  return { reverseBoxes: plan.boxes, foldedBordersByContainer: plan.foldedBordersByContainer };
}

// options.authorWarnings 为数组时收集写出 warning（带 pageId），由作者包写出器汇总进 report.json。
function pageItemsToAuthorHtml(page, options = {}) {
  const tree = buildAuthorTree(page);
  const state = { rendered: new Set(), warnings: [] };
  const vectorContainerIds = vectorContainerIdsForPage(page, options);
  const pageOptions = {
    ...options,
    vectorContainerIds,
    // 与 reverse-overrides.css 同一份外框规划：哪些对象按读回 bounds 兜底、哪些退出网格、哪些边框对象折回容器。
    ...reverseGeometryPageOptions(reverseGeometryPlanForPage(page, { ...options, vectorContainerIds })),
    authorRenderState: state,
  };
  const html = tree.map((node) => renderNode(node, pageOptions, 0)).join('\n');
  for (const warning of droppedItemWarnings(tree, state)) state.warnings.push(warning);
  if (Array.isArray(options.authorWarnings)) {
    for (const warning of state.warnings) {
      options.authorWarnings.push({
        ...warning,
        source: 'author-writer',
        details: { pageId: page && page.id || null, ...(warning.details || {}) },
      });
    }
  }
  return html;
}

// 兜底记账：树里每个对象（含折进父对象的伴生文字）都必须被某条写出路径写出；
// 写出路径没接住的对象不能静默消失，逐个记 warning。
function droppedItemWarnings(tree, state) {
  const warnings = [];
  const visit = (node, parentId) => {
    const item = node.item || {};
    const ownerId = item.virtual ? parentId : item.id;
    if (!item.virtual && !state.rendered.has(item.id)) warnings.push(droppedItemWarning(item, parentId));
    const companion = item.authorTextCompanion;
    if (companion && !state.rendered.has(companion.id)) warnings.push(droppedItemWarning(companion, item.id));
    node.children.forEach((child) => visit(child, ownerId));
  };
  tree.forEach((node) => visit(node, null));
  return warnings;
}

function droppedItemWarning(item, parentId) {
  const text = item.content && typeof item.content.text === 'string' ? item.content.text.trim() : '';
  const where = parentId ? ` (its parent ${parentId} cannot hold child content)` : '';
  return {
    code: AUTHOR_ITEM_DROPPED,
    message: `Item ${item.id} was not written to author HTML${where}.`,
    details: {
      itemId: item.id,
      parentId: parentId || null,
      role: item.role || null,
      ...(text ? { text: text.slice(0, 80) } : {}),
    },
  };
}

function markRendered(options, item, { companion = false } = {}) {
  const state = options && options.authorRenderState;
  if (!state || !item) return;
  if (!item.virtual && item.id) state.rendered.add(item.id);
  if (companion && item.authorTextCompanion && item.authorTextCompanion.id) {
    state.rendered.add(item.authorTextCompanion.id);
  }
}

function markSubtreeRendered(options, node) {
  markRendered(options, node.item);
  node.children.forEach((child) => markSubtreeRendered(options, child));
}

function renderNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  markRendered(options, item);
  if (shouldRenderVectorSvg(item, sourceNode, options)) {
    if (!vectorNodeHasAuthorContent(node)) return renderVectorSvgNode(node, options, depth);
    markRendered(options, item, { companion: true });
    return renderVectorContainerNode(node, options, depth, renderNode);
  }
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
  markRendered(options, item, { companion: true });
  const preservedInlineSourceHtml = inlineSourceHtmlForNode(node, options, depth);
  if (preservedInlineSourceHtml != null) {
    // 内联子节点原样保留在源码 HTML 里，算作已写出。
    node.children.forEach((child) => markSubtreeRendered(options, child));
    return `${indent(depth)}${open}${preservedInlineSourceHtml}</${tag}>`;
  }
  const own = ownContent(item, depth, {
    ignoreSourceHtml: node.children.length > 0,
    // 字符级、单元格读回外观：源码 CSS 未随包保留时，来源 class 不再带样式，只能写内联。
    writeRunStyles: !shouldPreserveTrustedSource(item, sourceNode, options),
  });
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
  AUTHOR_ITEM_DROPPED,
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
