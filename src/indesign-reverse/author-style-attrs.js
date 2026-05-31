'use strict';

const { blendModeCss } = require('./css-blend-mode');

function authorInlineStyleForItem(item, sourceStyle) {
  return mergeCss([
    sourceStyle,
    visualStyleCss(item && item.visualStyle),
    textStyleCss(item && item.textStyle),
    textFrameStyleCss(item && item.textFrameStyle),
    cssForHtml(item && item.inlineStyle),
    zIndexCss(item && item.zIndex),
  ]);
}

function authorClassesForItem(item, sourceClasses, sourceAttrs = {}) {
  const classes = new Set(sourceClasses || []);
  const refs = item && item.styleRefs || {};
  const paragraphStyle = sourceAttrs['data-id-paragraph-style'] || refs.paragraphStyle;
  const characterStyle = sourceAttrs['data-id-character-style'] || refs.characterStyle;
  const objectStyle = sourceAttrs['data-id-object-style'] || refs.objectStyle;
  const frameStyle = sourceAttrs['data-id-frame-style'] || refs.frameStyle;
  const tableStyle = sourceAttrs['data-id-table-style'] || refs.tableStyle;
  const cellStyle = sourceAttrs['data-id-cell-style'] || refs.cellStyle;
  if (paragraphStyle) classes.add(`pstyle-${safeClass(paragraphStyle)}`);
  if (characterStyle) classes.add(`cstyle-${safeClass(characterStyle)}`);
  if (objectStyle) classes.add(`ostyle-${safeClass(objectStyle)}`);
  if (frameStyle) classes.add(`fstyle-${safeClass(frameStyle)}`);
  if (tableStyle) classes.add(`tstyle-${safeClass(tableStyle)}`);
  if (cellStyle) classes.add(`cellstyle-${safeClass(cellStyle)}`);
  return Array.from(classes).filter(Boolean);
}

function visualStyleCss(visualStyle) {
  if (!visualStyle) return '';
  const styles = [];
  if (visualStyle.fillColor) styles.push(`background-color:${visualStyle.fillColor}`);
  if (visualStyle.strokeColor && Number(visualStyle.strokeWeight) > 0) {
    styles.push(`border:${px(visualStyle.strokeWeight)} solid ${visualStyle.strokeColor}`);
  }
  if (Number(visualStyle.cornerRadius) > 0) styles.push(`border-radius:${px(visualStyle.cornerRadius)}`);
  const blendMode = blendModeCss(visualStyle.blendMode);
  if (blendMode) styles.push(blendMode);
  const opacity = Number(visualStyle.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 100) styles.push(`opacity:${formatNumber(opacity / 100)}`);
  return styles.join(';');
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
  return String(value || '').trim();
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

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 10000) / 10000);
}

function safeClass(value) {
  return String(value || 'style').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-');
}

module.exports = {
  authorInlineStyleForItem,
  authorClassesForItem,
  blendModeCss,
  mergeCss,
  textStyleCss,
  textFrameStyleCss,
};
