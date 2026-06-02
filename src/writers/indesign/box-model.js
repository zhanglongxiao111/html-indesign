const { parseCssLength, round } = require('../../shared/geometry');
const { cssLengthToPt } = require('../../shared/style-utils');

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
    return cssLengthToPresentationPt(item && item.computedStyle && item.computedStyle[prop], options);
  }
  return cssLengthToPt(lengthStyleValue(item, prop));
}

function cssLengthToPresentationPt(value, options) {
  const px = cssLengthToPx(value);
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
      top: cssLengthToMm(style.paddingTop),
      right: cssLengthToMm(style.paddingRight),
      bottom: cssLengthToMm(style.paddingBottom),
      left: cssLengthToMm(style.paddingLeft),
    },
  };
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

function cssLengthToPx(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  if (parsed.unit === 'px') return parsed.value;
  if (parsed.unit === 'pt') return parsed.value * 96 / 72;
  if (parsed.unit === 'mm') return parsed.value * 96 / 25.4;
  return null;
}

function cssLengthToMm(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  let mm = null;
  if (parsed.unit === 'mm') mm = parsed.value;
  if (parsed.unit === 'pt') mm = parsed.value * 25.4 / 72;
  if (parsed.unit === 'px') mm = parsed.value * 25.4 / 96;
  if (mm == null) return null;
  const nearest = Math.round(mm);
  if (Math.abs(mm - nearest) < 0.15) return nearest;
  return round(mm, 2);
}

module.exports = {
  styleLengthToPt,
  trackingValue,
  itemLengthToPt,
  cornerRadiusValue,
  tableCellPadding,
  lengthStyleValue,
};
