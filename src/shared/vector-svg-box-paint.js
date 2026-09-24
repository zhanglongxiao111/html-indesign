const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');

// 反向写出的矢量 svg（作者包与视觉参照页都带 class="id-object" 和 data-id-vector）只由 path 的
// fill/stroke 表达填充和描边。合成样式、对象样式和源码样式里的盒模型装饰（border、background、
// padding、box-shadow）落在 svg 元素上会在外围多画一个矩形框或底色，border/padding 还会把
// viewBox 内容区往里缩，端点和角度随之偏移。border-radius 不画东西，保留它让正向回编仍能读到
// 对象样式圆角。写出侧归零规则与正向回编的「填充取 path」判定共用这里的同一个标记。
const PATH_PAINTED_VECTOR_SVG_CLASS = 'id-object';
const PATH_PAINTED_VECTOR_SVG_SELECTOR = `svg.${PATH_PAINTED_VECTOR_SVG_CLASS}[${HTML_DATA_ID_ATTRIBUTES.VECTOR}]`;

const VECTOR_SVG_BOX_PAINT_RESET = Object.freeze([
  'border:0',
  'background:none',
  'padding:0',
  'box-shadow:none',
]);

function isVectorSvgBoxPaintProperty(property) {
  const name = String(property || '').trim().toLowerCase();
  if (/^border(?:-|$)/.test(name)) return !/radius$/.test(name);
  return /^(?:background|padding)(?:-|$)/.test(name) || name === 'box-shadow';
}

function vectorSvgBoxPaintResetRule() {
  return `${PATH_PAINTED_VECTOR_SVG_SELECTOR} { ${VECTOR_SVG_BOX_PAINT_RESET.join('; ')}; }`;
}

// 快照元素是否是反向写出的、只靠 path 上色的矢量 svg：与归零规则的选择器同一判定。
function isPathPaintedVectorSvg(element) {
  if (String(element && element.tagName || '').toLowerCase() !== 'svg') return false;
  const attrs = element.attributes || {};
  if (!Object.prototype.hasOwnProperty.call(attrs, HTML_DATA_ID_ATTRIBUTES.VECTOR)) return false;
  const classes = Array.isArray(element.classList)
    ? element.classList
    : String(attrs.class || '').split(/\s+/);
  return classes.includes(PATH_PAINTED_VECTOR_SVG_CLASS);
}

module.exports = {
  VECTOR_SVG_BOX_PAINT_RESET,
  isVectorSvgBoxPaintProperty,
  isPathPaintedVectorSvg,
  vectorSvgBoxPaintResetRule,
};
