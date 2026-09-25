const cheerio = require('cheerio');
const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const {
  assetAttributes,
  assetContentGeometry,
  assetPreviewPath,
  tagForAsset,
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

function shouldRenderAssetFigureNode(item, sourceNode, tag) {
  if (!item || item.role !== 'graphic') return false;
  if (tag !== 'figure') return false;
  const asset = item.sourceAsset || item.asset || item.placedAsset;
  return Boolean(asset && (asset.path || assetPreviewPath(asset, item)));
}

function renderAssetFigureNode(node, options, depth, renderNode) {
  const item = node.item;
  const sourceNode = item && item.effectiveLabel && item.effectiveLabel.sourceNode || item.sourceNode || {};
  const attrs = attrsForItem(item, sourceNode, options);
  const assetNode = renderFigureAssetContent(item, sourceNode, options, depth + 2);
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const body = [assetNode, children || null].filter(Boolean).join('\n');
  return `${indent(depth)}<figure${attrs ? ` ${attrs}` : ''}>\n${body}\n${indent(depth)}</figure>`;
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

function renderFigureAssetContent(item, sourceNode, options, depth) {
  const tag = tagForAsset(item) || 'img';
  const attrs = figureAssetContentAttrs(item, tag, sourceNode, options);
  if (!attrs) return '';
  if (tag === 'img') return `${indent(depth)}<img ${attrs}>`;
  return `${indent(depth)}<${tag} ${attrs}></${tag}>`;
}

function figureAssetContentAttrs(item, tag, sourceNode, options) {
  const asset = item.sourceAsset || item.asset || item.placedAsset || {};
  const attrs = mergeAttributes(assetAttributes(item, tag));
  attrs.class = [attrs.class, usesGeneratedFramePreview(asset, item) ? 'placed-asset-preview' : 'placed-asset-content'].filter(Boolean).join(' ');
  attrs[HTML_DATA_ID_ATTRIBUTES.IGNORE] = '';
  const style = figureAssetContentStyle(item, asset);
  if (style) attrs.style = style;
  if (tag === 'img') {
    // assetAttributes 在图框自身没有 alt 时先填了文件名；来源里找得到作者写的替代文字时以它为准。
    attrs.alt = sourceAltText(item, sourceNode) || attrs.alt || fileStem(asset.path);
  }
  rewriteResourceAttrs(attrs, options);
  return attrsToHtml(orderAttrs(attrs));
}

function figureAssetContentStyle(item, asset) {
  if (usesGeneratedFramePreview(asset, item)) return placedAssetPreviewStyle();
  const geometry = assetContentGeometry(item);
  if (geometry) return placedAssetContentStyle(item);
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

// 替代文字：来源元素自己的 alt（作者写的 <img alt>）；反向写成 figure 图框后 alt 落在框内的
// 内容图（.placed-asset-content / .placed-asset-preview）上，再次往返时从图框的来源 HTML 里取回，
// 不能退成文件名（#34 往返：venue public frontage → architecture-facade）。
function sourceAltText(item, sourceNode) {
  const own = sourceNode && sourceNode.attributes && sourceNode.attributes.alt;
  if (own) return own;
  for (const html of [sourceNode && sourceNode.sourceHtml, item && item.content && item.content.sourceHtml]) {
    if (typeof html !== 'string' || !html.toLowerCase().includes('<img')) continue;
    const $ = cheerio.load(html, null, false);
    const alt = $('img.placed-asset-content, img.placed-asset-preview').first().attr('alt');
    if (alt) return alt;
  }
  return '';
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
  const previewPath = assetPreviewPath(asset, item);
  const src = shouldUsePreviewImage(asset, item) && previewPath ? previewPath : asset.path;
  if (!src) return '';
  const attrs = {
    class: usesGeneratedFramePreview(asset, item) ? 'placed-asset-preview' : 'placed-asset-content',
    src,
    alt: sourceAltText(item, sourceNode) || fileStem(asset.path || src),
    [HTML_DATA_ID_ATTRIBUTES.IGNORE]: '',
    style: placedAssetContentStyle(item, asset),
  };
  rewriteResourceAttrs(attrs, options);
  return attrsToHtml(orderAttrs(attrs));
}

function placedAssetContentStyle(item, asset) {
  if (usesGeneratedFramePreview(asset, item)) return placedAssetPreviewStyle();
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
  renderAssetFigureNode,
  renderPlacedAssetFrameNode,
  shouldRenderAssetFigureNode,
  shouldRenderPlacedAssetFrame,
  placedAssetFrameSourceNode,
  placedAssetContentAttrs,
};
