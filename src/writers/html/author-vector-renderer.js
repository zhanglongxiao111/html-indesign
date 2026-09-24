const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { isVoidTag, mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const {
  authorClassesForItem,
  blendModeCss,
  mergeCss,
  textFrameStyleCss,
  textStyleCss,
  visualStyleCss,
} = require('./author-style-attrs');
const { hasVectorPaths, vectorMatchesBoundsBox, vectorPathElements, vectorViewBox } = require('./vector-svg');
const { rewriteResourceAttrs } = require('./author-resource-paths');
const { ownContent } = require('./author-rich-text-renderer');
const { buildAuthorTree } = require('./author-tree-builder');
const {
  addObservedLabelAttrs,
  addParentPageAttrs,
  addStyleProtocolAttrs,
  SOURCE_BOX_PROPERTY_RE,
  sourceNodeForItem,
  sourceStyleForItem,
} = require('./author-node-attrs');
const {
  formatNumber,
  hasDataIdObject,
  hasSourceNode,
  indent,
  isUsefulSemantic,
  orderAttrs,
  safeTag,
  tagForRole,
} = require('./author-render-utils');

const VECTOR_CONTAINER_SHAPE_APPROXIMATED = 'REVERSE_VECTOR_CONTAINER_SHAPE_APPROXIMATED';

function renderVectorSvgNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  const attrs = vectorAttrsForItem(item, sourceNode, options);
  const children = vectorPathElements(item, depth + 2);
  return `${indent(depth)}<svg ${attrs}>\n${children}\n${indent(depth)}</svg>`;
}

// 读回带矢量路径、又挂着作者内容（子对象、伴生文字或自身文字）的对象不能写成 <svg>：
// svg 里只能放 path，子对象会整片丢失。它改写成普通 HTML 容器：外框沿用已烘焙矢量的
// 读回 bounds 规则，填充、描边、圆角按读回 visualStyle 写成 CSS 盒子（正向构建读的也是它），
// 子对象按读回 bounds 绝对定位：非网格容器相对容器，网格容器相对页面（见 author-css-writer）。
// 路径不是贴合 bounds 的直角矩形时，CSS 盒子只能近似，记 warning。
function renderVectorContainerNode(node, options, depth, renderChild) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  const tag = vectorContainerTag(item, sourceNode);
  const attrs = vectorContainerAttrsForItem(item, sourceNode, options);
  if (!vectorMatchesBoundsBox(item)) recordShapeApproximated(item, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  const own = ownContent(item, depth, { ignoreSourceHtml: true });
  const children = node.children.map((child) => renderChild(child, options, depth + 2)).join('\n');
  if (!children) return `${indent(depth)}${open}${own}</${tag}>`;
  return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
}

function vectorNodeHasAuthorContent(node) {
  if (!node) return false;
  if (Array.isArray(node.children) && node.children.length) return true;
  const item = node.item || {};
  const companion = item.authorTextCompanion;
  if (companion && hasText(companion.content && companion.content.text)) return true;
  return hasText(item.content && item.content.text);
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// 与 author-html-tree 的判定一致：页内哪些对象写成矢量容器。reverse-overrides.css
// 需要据此给容器的直接子对象写相对容器的读回几何。
function vectorContainerIdsForPage(page, options = {}) {
  const ids = new Set();
  const visit = (node) => {
    const item = node.item || {};
    if (!item.virtual
      && shouldRenderVectorSvg(item, sourceNodeForItem(item), options)
      && vectorNodeHasAuthorContent(node)) {
      ids.add(item.id);
    }
    node.children.forEach(visit);
  };
  buildAuthorTree(page || {}).forEach(visit);
  return ids;
}

function vectorContainerTag(item, sourceNode) {
  const tag = safeTag(sourceNode.tagName || item.tagName || tagForRole(item.role));
  return tag === 'svg' || isVoidTag(tag) ? 'div' : tag;
}

function vectorContainerAttrsForItem(item, sourceNode, options) {
  const { attrs, classes, sourceStyle } = vectorIdentityAttrs(item, sourceNode, options);
  delete attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR];
  delete attrs.xmlns;
  if (!hasDataIdObject(attrs) && item.role !== 'text' && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs[HTML_DATA_ID_ATTRIBUTES.OBJECT] = '';
  }
  const style = mergeCss([
    sourceStyle,
    visualStyleCss(item.visualStyle),
    companionTextCss(item),
    'overflow:visible',
    zIndexStyle(item.zIndex),
  ]);
  if (style) attrs.style = style;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  return attrsToHtml(orderAttrs(attrs));
}

// 伴生文字（正向构建从带文字的形状拆出的 <id>-text 文本框）折回容器自身文字：
// 文字相对容器的偏移写成 padding，正向构建据此还原伴生文本框位置；字号、行距等按读回写出。
function companionTextCss(item) {
  const companion = item && item.authorTextCompanion;
  if (!companion) return '';
  const indesign = companion.extensions && companion.extensions.indesign || {};
  const frameStyle = indesign.textFrameStyle || null;
  return mergeCss([
    textStyleCss(companion.textStyle),
    companionPaddingCss(item.bounds, companion.bounds, frameStyle && frameStyle.inset || {}),
    textFrameStyleCss(frameStyle ? { ...frameStyle, inset: null } : null),
  ]);
}

function companionPaddingCss(bounds, textBounds, inset = {}) {
  if (!bounds || !textBounds) return '';
  const left = Number(textBounds.x) - Number(bounds.x) + (Number(inset.left) || 0);
  const top = Number(textBounds.y) - Number(bounds.y) + (Number(inset.top) || 0);
  const right = (Number(bounds.x) + Number(bounds.width)) - (Number(textBounds.x) + Number(textBounds.width)) + (Number(inset.right) || 0);
  const bottom = (Number(bounds.y) + Number(bounds.height)) - (Number(textBounds.y) + Number(textBounds.height)) + (Number(inset.bottom) || 0);
  const sides = [top, right, bottom, left].map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  if (!sides.some((value) => value > 0)) return '';
  return `padding:${sides.map((value) => `${formatNumber(value)}px`).join(' ')}`;
}

function recordShapeApproximated(item, options) {
  const state = options && options.authorRenderState;
  if (!state || !Array.isArray(state.warnings)) return;
  const kind = item.vectorGeometry && item.vectorGeometry.kind || 'path';
  state.warnings.push({
    code: VECTOR_CONTAINER_SHAPE_APPROXIMATED,
    message: `Vector object ${item.id} holds child content, so author HTML writes it as a CSS box container; its ${kind} path is approximated by the box.`,
    details: { itemId: item.id, vectorKind: kind },
  });
}

// InDesign 读回的矢量点是页面坐标下的最终几何：旋转、平移都已烘焙进 path，
// viewBox 取自读回 bounds。源码节点 style 描述的是「旋转前的盒子 + CSS 变换」：
// 变换留在 svg 上会二次旋转；非网格对象的外框由 reverse-overrides.css 按读回
// bounds 兜底，源码里的定位、尺寸、外边距留在内联里会压过兜底，把外框拉回旋转前的盒子。
// 矢量容器（见上）的外框同样来自读回 bounds，沿用同一套剥离规则。
const BAKED_VECTOR_TRANSFORM_PROPERTIES = new Set([
  'transform',
  'transform-origin',
  'transform-box',
  'rotate',
  'translate',
  'scale',
]);

function shouldRenderVectorSvg(item, sourceNode, options = {}) {
  if (!hasVectorPaths(item)) return false;
  if (item.asset || item.table) return false;
  if (item.role === 'text' || item.role === 'graphic' || item.role === 'table') return false;
  return !hasSourceNode(sourceNode) || options.mode === 'observation';
}

function vectorIdentityAttrs(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes);
  rewriteResourceAttrs(attrs, options);
  if (sourceNode.id) attrs.id = sourceNode.id;
  else attrs.id = item.id;
  delete attrs.viewbox;
  delete attrs.preserveaspectratio;
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
  return { attrs, classes, sourceStyle };
}

function vectorAttrsForItem(item, sourceNode, options) {
  const { attrs, classes, sourceStyle } = vectorIdentityAttrs(item, sourceNode, options);
  attrs.viewBox = vectorViewBox(item);
  attrs.preserveAspectRatio = 'none';
  attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR] = item.vectorGeometry && item.vectorGeometry.kind || 'path';
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

// 为 true 时对象走已烘焙矢量的写出路径（<svg>，或有作者内容时的矢量容器），
// 外框一律由 reverse-overrides.css 按读回 bounds 写。
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
      return !(dropBox && SOURCE_BOX_PROPERTY_RE.test(property));
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
  VECTOR_CONTAINER_SHAPE_APPROXIMATED,
  rendersBakedVectorSvg,
  renderVectorContainerNode,
  renderVectorSvgNode,
  shouldRenderVectorSvg,
  vectorAttrsForItem,
  vectorContainerIdsForPage,
  vectorNodeHasAuthorContent,
};
