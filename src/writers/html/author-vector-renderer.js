const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
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

// InDesign 读回的矢量点是页面坐标下的最终几何：旋转、平移都已烘焙进 path，
// viewBox 取自读回 bounds。源码节点 style 描述的是「旋转前的盒子 + CSS 变换」：
// 变换留在 svg 上会二次旋转；非网格对象的外框由 reverse-overrides.css 按读回
// bounds 兜底，源码里的定位、尺寸、外边距留在内联里会压过兜底，把外框拉回旋转前的盒子。
const BAKED_VECTOR_TRANSFORM_PROPERTIES = new Set([
  'transform',
  'transform-origin',
  'transform-box',
  'rotate',
  'translate',
  'scale',
]);
const BAKED_VECTOR_BOX_PROPERTY_RE = /^(?:position|left|top|right|bottom|inset(?:-[a-z-]+)?|(?:min-|max-)?(?:width|height|inline-size|block-size)|margin(?:-[a-z-]+)?)$/;

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
  attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR] = item.vectorGeometry && item.vectorGeometry.kind || 'path';
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.ROLE] && item.role) attrs[HTML_DATA_ID_ATTRIBUTES.ROLE] = item.role;
  addStyleProtocolAttrs(attrs, item, options);
  const classes = new Set(authorClassesForItem(item, sourceNode.classList || [], attrs));
  if (!hasSourceNode(sourceNode) && item.role !== 'text' && !item.virtual) classes.add('id-object');
  if (options.mode === 'observation') classes.add('id-object');
  if (item.parentPageItem) {
    classes.add('id-parent-page-object');
    addParentPageAttrs(attrs, item);
  }
  if (options.mode === 'observation') attrs[HTML_DATA_ID_ATTRIBUTES.OBJECT] = '';
  if (isUsefulSemantic(item.semantic)) attrs[HTML_DATA_ID_ATTRIBUTES.SEMANTIC] = item.semantic;
  addObservedLabelAttrs(attrs, item);
  const sourceStyle = bakedVectorSourceStyle(sourceStyleForItem(item, sourceNode, classes), item);
  const style = mergeCss([
    sourceStyle,
    'overflow:visible',
    blendModeCss(item.visualStyle && item.visualStyle.blendMode),
    vectorOpacityStyle(item),
    zIndexStyle(item.zIndex),
  ]);
  if (style) attrs.style = style;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  return svgAttrsToHtml(orderAttrs(attrs));
}

function rendersBakedVectorSvg(item, options = {}) {
  return shouldRenderVectorSvg(item, sourceNodeForItem(item), options);
}

// 与 reverse-overrides.css 写兜底几何的条件一致：有读回 bounds、不走作者网格。
function bakedVectorBoxFromBounds(item) {
  return Boolean(item && item.bounds) && !(item.layout && item.layout.grid);
}

function bakedVectorSourceStyle(sourceStyle, item) {
  const dropBox = bakedVectorBoxFromBounds(item);
  return String(sourceStyle || '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const index = declaration.indexOf(':');
      if (index <= 0) return false;
      const property = declaration.slice(0, index).trim().toLowerCase();
      if (BAKED_VECTOR_TRANSFORM_PROPERTIES.has(property)) return false;
      return !(dropBox && BAKED_VECTOR_BOX_PROPERTY_RE.test(property));
    })
    .join(';');
}

function svgAttrsToHtml(attrs) {
  return attrsToHtml(attrs)
    .replace(/\bviewbox=/g, 'viewBox=')
    .replace(/\bpreserveaspectratio=/g, 'preserveAspectRatio=');
}

function zIndexStyle(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
}

function vectorOpacityStyle(item) {
  const visualStyle = item && item.visualStyle || {};
  const opacity = Number(visualStyle.opacity);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity >= 100) return '';
  return `opacity:${formatNumber(opacity / 100)}`;
}

module.exports = {
  rendersBakedVectorSvg,
  renderVectorSvgNode,
  shouldRenderVectorSvg,
  vectorAttrsForItem,
};
