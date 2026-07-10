const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
'use strict';

const { blendModeCss } = require('./css-blend-mode');
const { safeAuthorClassToken } = require('../../shared/style-utils');

function authorInlineStyleForItem(item, sourceStyle) {
  const indesign = item && item.extensions && item.extensions.indesign || {};
  return mergeCss([
    sourceStyle,
    visualStyleCss(item && item.visualStyle),
    textStyleCss(item && item.textStyle),
    textFrameStyleCss(indesign.textFrameStyle),
    cssForHtml(item && item.inlineStyle),
    zIndexCss(item && item.zIndex),
  ]);
}

function authorClassesForItem(item, sourceClasses, sourceAttrs = {}) {
  const classes = new Set(sourceClasses || []);
  const refs = item && item.styleRefs || {};
  const paragraphStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE] || refs.paragraphStyle;
  const characterStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] || refs.characterStyle;
  const objectStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE] || refs.objectStyle;
  const frameStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE] || refs.frameStyle;
  const tableStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE] || refs.tableStyle;
  const cellStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.CELL_STYLE] || refs.cellStyle;
  const synthesizedToken = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN] || refs.synthesizedToken;
  if (paragraphStyle) classes.add(`pstyle-${safeAuthorClassToken(paragraphStyle)}`);
  if (characterStyle) classes.add(`cstyle-${safeAuthorClassToken(characterStyle)}`);
  if (objectStyle) classes.add(`ostyle-${safeAuthorClassToken(objectStyle)}`);
  if (frameStyle) classes.add(`fstyle-${safeAuthorClassToken(frameStyle)}`);
  if (tableStyle) classes.add(`tstyle-${safeAuthorClassToken(tableStyle)}`);
  if (cellStyle) classes.add(`cellstyle-${safeAuthorClassToken(cellStyle)}`);
  if (synthesizedToken) classes.add(`synth-${safeAuthorClassToken(synthesizedToken)}`);
  return Array.from(classes).filter(Boolean);
}

function visualStyleCss(visualStyle) {
  if (!visualStyle) return '';
  const styles = [];
  if (visualStyle.fillColor) styles.push(`background-color:${visualStyle.fillColor}`);
  if (visualStyle.strokeColor && Number(visualStyle.strokeWeight) > 0) {
    styles.push(`border:${geometryPx(visualStyle.strokeWeight)} solid ${visualStyle.strokeColor}`);
  } else if (hasExplicitStrokeFact(visualStyle)) {
    styles.push('border:0 solid transparent');
  }
  if (Number(visualStyle.cornerRadius) > 0) styles.push(`border-radius:${geometryPx(visualStyle.cornerRadius)}`);
  const blendMode = blendModeCss(visualStyle.blendMode);
  if (blendMode) styles.push(blendMode);
  const opacity = Number(visualStyle.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 100) styles.push(`opacity:${formatNumber(opacity / 100)}`);
  return styles.join(';');
}

function hasExplicitStrokeFact(visualStyle) {
  return Object.prototype.hasOwnProperty.call(visualStyle, 'strokeColor')
    || Object.prototype.hasOwnProperty.call(visualStyle, 'strokeWeight');
}

function textStyleCss(textStyle) {
  if (!textStyle) return '';
  const styles = [];
  if (textStyle.fontFamily) styles.push(`font-family:"${textStyle.fontFamily}", Arial, sans-serif`);
  if (textStyle.fontWeight) styles.push(`font-weight:${textStyle.fontWeight}`);
  if (textStyle.fontStyle) styles.push(`font-style:${textStyle.fontStyle}`);
  if (textStyle.pointSize != null) styles.push(`font-size:${px(textStyle.pointSize)}`);
  if (textStyle.leading != null) styles.push(`line-height:${px(textStyle.leading)}`);
  if (textStyle.fillColor) styles.push(`color:${textStyle.fillColor}`);
  if (textStyle.tracking != null && Number(textStyle.tracking) !== 0) {
    styles.push(`letter-spacing:${formatNumber(Number(textStyle.tracking) / 1000)}em`);
  }
  if (textStyle.justification) styles.push(`text-align:${textStyle.justification}`);
  return styles.join(';');
}

function textFrameStyleCss(textFrameStyle) {
  if (!textFrameStyle) return '';
  const styles = [];
  const inset = textFrameStyle.inset || {};
  if ([inset.top, inset.right, inset.bottom, inset.left].some((value) => Number(value) > 0)) {
    styles.push(`padding:${px(inset.top || 0)} ${px(inset.right || 0)} ${px(inset.bottom || 0)} ${px(inset.left || 0)}`);
  }
  if (Number(textFrameStyle.columnCount) > 1) {
    styles.push(`column-count:${formatNumber(textFrameStyle.columnCount)}`);
    if (Number(textFrameStyle.columnGap) > 0) styles.push(`column-gap:${px(textFrameStyle.columnGap)}`);
  }
  if (textFrameStyle.verticalJustification && textFrameStyle.verticalJustification !== 'flex-start') {
    styles.push('display:flex', 'flex-direction:column', `justify-content:${textFrameStyle.verticalJustification}`);
  }
  return styles.join(';');
}

function zIndexCss(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
}

function cssForHtml(value) {
  return String(value || '').trim().replace(/(-?\d+(?:\.\d+)?)px\b/g, (_, number) => `${px(number)}`);
}

function mergeCss(values) {
  const order = [];
  const map = new Map();
  for (const value of values || []) {
    for (const declaration of cssDeclarations(value)) {
      const index = declaration.indexOf(':');
      if (index <= 0) continue;
      const property = declaration.slice(0, index).trim();
      const cssValue = declaration.slice(index + 1).trim();
      if (!property || !cssValue) continue;
      if (!map.has(property)) order.push(property);
      map.set(property, cssValue);
    }
  }
  return order.map((property) => `${property}:${map.get(property)}`).join(';');
}

function cssDeclarations(value) {
  return String(value || '').split(';').map((part) => part.trim()).filter(Boolean);
}

function px(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? formatNumber(number) : 0}px`;
}

function geometryPx(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? Math.round(number * 100) / 100 : 0}px`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

module.exports = {
  authorInlineStyleForItem,
  authorClassesForItem,
  blendModeCss,
  mergeCss,
  textStyleCss,
  textFrameStyleCss,
};
