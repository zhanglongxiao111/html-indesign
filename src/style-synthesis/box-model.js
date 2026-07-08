const {
  parseCssLength,
  cssLengthStringToPx,
  cssLengthStringToVisualMm,
  round,
} = require('../shared/geometry');
const { cssLengthToPt } = require('../shared/style-utils');

function styleLengthToPt(style, prop, options) {
  const value = style && style[prop];
  if (isPresentationLayout(options)) return cssLengthToPresentationPt(value, options);
  return cssLengthToPt(value);
}

function trackingValue(style, options) {
  const letterSpacing = styleLengthToPt(style, 'letterSpacing', options);
  const fontSize = styleLengthToPt(style, 'fontSize', options);
  if (!letterSpacing || !fontSize) return null;
  return round(letterSpacing / fontSize * 1000, 4);
}

function itemLengthToPt(item, prop, options) {
  if (isPresentationLayout(options)) {
    return cssLengthToPresentationPt(presentationLengthStyleValue(item, prop), options);
  }
  return cssLengthToPt(lengthStyleValue(item, prop));
}

function presentationLengthStyleValue(item, prop) {
  const authored = item && item.authoredStyle && item.authoredStyle[prop];
  const parsed = parseCssLength(authored);
  if (parsed && parsed.unit === 'px') return authored;
  return item && item.computedStyle && item.computedStyle[prop];
}

function cssLengthToPresentationPt(value, options) {
  const px = cssLengthStringToPx(value);
  if (px == null) return null;
  return round(px * presentationScale(options), 4);
}

function cornerRadiusValue(item, options) {
  const computed = item && item.computedStyle && item.computedStyle.borderRadius;
  if (isPresentationLayout(options)) {
    if (String(computed || '').trim().endsWith('%')) return computed;
    const pt = cssLengthToPresentationPt(computed, options);
    return pt == null ? '0pt' : `${pt}pt`;
  }
  return lengthStyleValue(item, 'borderRadius') || computed || '0px';
}

function tableCellPadding(style, options) {
  if (isPresentationLayout(options)) {
    return {
      unit: 'pt',
      values: {
        top: styleLengthToPt(style, 'paddingTop', options),
        right: styleLengthToPt(style, 'paddingRight', options),
        bottom: styleLengthToPt(style, 'paddingBottom', options),
        left: styleLengthToPt(style, 'paddingLeft', options),
      },
    };
  }
  return {
    unit: 'mm',
    values: {
      top: cssLengthStringToVisualMm(style.paddingTop),
      right: cssLengthStringToVisualMm(style.paddingRight),
      bottom: cssLengthStringToVisualMm(style.paddingBottom),
      left: cssLengthStringToVisualMm(style.paddingLeft),
    },
  };
}

function bordersAreUniform(borders) {
  return sameBorder(borders.top, borders.right)
    && sameBorder(borders.top, borders.bottom)
    && sameBorder(borders.top, borders.left);
}

function sameBorder(a, b) {
  if (!visibleBorder(a) && !visibleBorder(b)) return true;
  if (!visibleBorder(a) || !visibleBorder(b)) return false;
  return a.color === b.color
    && a.style === b.style
    && Math.abs(Number(a.widthPt || 0) - Number(b.widthPt || 0)) < 0.01;
}

function visibleBorder(edge) {
  return edge
    && edge.color
    && edge.style !== 'none'
    && edge.style !== 'hidden'
    && Number(edge.widthPt || 0) > 0;
}

function lengthStyleValue(item, prop) {
  const authored = item && item.authoredStyle && item.authoredStyle[prop];
  return authored || (item && item.computedStyle && item.computedStyle[prop]);
}

function isPresentationLayout(options) {
  return options && options.layout && options.layout.unitMode === 'presentation';
}

function presentationScale(options) {
  return Number(options && options.layout && options.layout.scale || 1);
}

module.exports = {
  styleLengthToPt,
  trackingValue,
  itemLengthToPt,
  cornerRadiusValue,
  tableCellPadding,
  bordersAreUniform,
  lengthStyleValue,
};
