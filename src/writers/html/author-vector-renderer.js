const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const { authorClassesForItem, blendModeCss, mergeCss } = require('./author-style-attrs');
const { hasVectorPaths, vectorPathElements, vectorViewBox } = require('./vector-svg');
const { rewriteResourceAttrs } = require('./author-resource-paths');
const {
  addObservedLabelAttrs,
  addParentPageAttrs,
  addStyleProtocolAttrs,
  sourceNodeForItem,
  sourceStyleForItem,
} = require('./author-node-attrs');
const {
  formatNumber,
  hasSourceNode,
  indent,
  isUsefulSemantic,
  orderAttrs,
} = require('./author-render-utils');

function renderVectorSvgNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  const attrs = vectorAttrsForItem(item, sourceNode, options);
  const children = vectorPathElements(item, depth + 2);
  return `${indent(depth)}<svg ${attrs}>\n${children}\n${indent(depth)}</svg>`;
}

function shouldRenderVectorSvg(item, sourceNode, options = {}) {
  if (!hasVectorPaths(item)) return false;
  if (item.asset || item.table) return false;
  if (item.role === 'text' || item.role === 'graphic' || item.role === 'table') return false;
  return !hasSourceNode(sourceNode) || options.mode === 'observation';
}

function vectorAttrsForItem(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes);
  rewriteResourceAttrs(attrs, options);
  if (sourceNode.id) attrs.id = sourceNode.id;
  else attrs.id = item.id;
  delete attrs.viewbox;
  delete attrs.preserveaspectratio;
  attrs.viewBox = vectorViewBox(item);
  attrs.preserveAspectRatio = 'none';
  attrs['data-id-vector'] = item.vectorGeometry && item.vectorGeometry.kind || 'path';
  if (!attrs['data-id-role'] && item.role) attrs['data-id-role'] = item.role;
  addStyleProtocolAttrs(attrs, item);
  const classes = new Set(authorClassesForItem(item, sourceNode.classList || [], attrs));
  if (!hasSourceNode(sourceNode) && item.role !== 'text' && !item.virtual) classes.add('id-object');
  if (options.mode === 'observation') classes.add('id-object');
  if (item.parentPageItem) {
    classes.add('id-parent-page-object');
    addParentPageAttrs(attrs, item);
  }
  if (options.mode === 'observation') attrs['data-id-object'] = '';
  if (isUsefulSemantic(item.semantic)) attrs['data-id-semantic'] = item.semantic;
  addObservedLabelAttrs(attrs, item);
  const sourceStyle = sourceStyleForItem(item, sourceNode, classes);
  const style = mergeCss([sourceStyle, 'overflow:visible', blendModeCss(item.visualStyle && item.visualStyle.blendMode), zIndexStyle(item.zIndex)]);
  if (style) attrs.style = style;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  return svgAttrsToHtml(orderAttrs(attrs));
}

function svgAttrsToHtml(attrs) {
  return attrsToHtml(attrs)
    .replace(/\bviewbox=/g, 'viewBox=')
    .replace(/\bpreserveaspectratio=/g, 'preserveAspectRatio=');
}

function zIndexStyle(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
}

module.exports = {
  renderVectorSvgNode,
  shouldRenderVectorSvg,
  vectorAttrsForItem,
};
