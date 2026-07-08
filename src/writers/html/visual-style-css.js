const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { blendModeCss } = require('./css-blend-mode');
const {
  requiredNumber,
  formatPx,
  formatNumber,
  uniqueWords,
  cssForHtml,
  styleByName,
  styleClassToken,
  fontFamilyFromCss,
  indesignFeatures,
  clamp,
} = require('./visual-html-utils');

function baseCss(model) {
  const firstPage = model.pages[0];
  const width = requiredNumber(firstPage.width, `Page ${firstPage.id} is missing width`);
  const height = requiredNumber(firstPage.height, `Page ${firstPage.id} is missing height`);

  return [
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; background: #f3f5f6; color: #14324a; font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '    .deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `    .page { position: relative; width: ${formatPx(width)}; height: ${formatPx(height)}; background: #fff; overflow: hidden; isolation: isolate; }`,
    '    .id-object { position: absolute; margin: 0; overflow: hidden; }',
    `    .id-object[${HTML_DATA_ID_ATTRIBUTES.ROLE}="text"] { overflow: visible; }`,
    `    .id-object[${HTML_DATA_ID_ATTRIBUTES.ROLE}="table"] { border-collapse: collapse; table-layout: fixed; }`,
    `    .id-object[${HTML_DATA_ID_ATTRIBUTES.ROLE}="table"] th, .id-object[${HTML_DATA_ID_ATTRIBUTES.ROLE}="table"] td { overflow: hidden; vertical-align: top; }`,
    '    .id-object > img, .id-object > object { display: block; width: 100%; height: 100%; }',
    `    .id-object > img[${HTML_DATA_ID_ATTRIBUTES.PREVIEW_KIND}="pdf"] { border: 0; outline: 0; }`,
    '    .list-item { display: block; padding: 0; }',
    '    .list-item.has-bullet::before { content: "•"; margin-right: 0.5em; }',
    '    .list-item.has-number::before { content: attr(data-circle); margin-right: 0.5em; }',
    '    .has-dropcap { display: grid; grid-template-columns: auto 1fr; column-gap: 0.5em; align-content: start; }',
    '    .dropcap-chars { font-size: 3.2em; line-height: 0.8; align-self: start; }',
    '    .dropcap-rest { display: inline; }',
    '    .id-asset-placeholder { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; border: 1px dashed #8aa0ad; color: #52636f; font-size: 12px; }',
    styleResourceCss(model),
  ].join('\n');
}

function pageStyle(page) {
  const width = requiredNumber(page.width, `Page ${page.id} is missing width`);
  const height = requiredNumber(page.height, `Page ${page.id} is missing height`);
  return [
    `width:${formatPx(width)}`,
    `height:${formatPx(height)}`,
  ].join(';');
}

function boundsStyle(itemId, bounds, inlineStyle) {
  if (!bounds) {
    throw new Error(`Item ${itemId} is missing bounds`);
  }
  const styles = [
    `left:${formatPx(requiredNumber(bounds.x, `Item ${itemId} bounds is missing x`))}`,
    `top:${formatPx(requiredNumber(bounds.y, `Item ${itemId} bounds is missing y`))}`,
    `width:${formatPx(requiredNumber(bounds.width, `Item ${itemId} bounds is missing width`))}`,
    `height:${formatPx(requiredNumber(bounds.height, `Item ${itemId} bounds is missing height`))}`,
  ];
  if (inlineStyle) styles.push(String(inlineStyle).trim().replace(/;+$/, ''));
  return styles.join(';');
}

function itemInlineStyle(item) {
  const indesign = item && item.extensions && item.extensions.indesign || {};
  return [
    visualStyleCss(item.visualStyle),
    effectsCss(indesign.effects, item.visualStyle),
    item.inlineStyle ? '' : textStyleCss(item.textStyle),
    textFrameStyleCss(indesign.textFrameStyle),
    cssForHtml(item.inlineStyle),
    zIndexCss(item.zIndex),
  ].filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
}

function itemClasses(item, model) {
  const classes = uniqueWords(['id-object', item.htmlClass].filter(Boolean).join(' '));
  const paragraphStyle = styleByName(model, 'paragraphStyles', item.styleRefs && item.styleRefs.paragraphStyle);
  const objectStyle = styleByName(model, 'objectStyles', item.styleRefs && item.styleRefs.objectStyle);
  if (paragraphStyle) {
    const features = indesignFeatures(paragraphStyle);
    classes.push(`pstyle-${styleClassToken(paragraphStyle)}`);
    if (features.dropCap) classes.push('has-dropcap');
    if (features.list && features.list.type === 'bullet') classes.push('has-bullet-list');
    if (features.list && features.list.type === 'numbered') classes.push('has-numbered-list');
  }
  if (objectStyle) classes.push(`ostyle-${styleClassToken(objectStyle)}`);
  return uniqueWords(classes.join(' '));
}

function visualStyleCss(visualStyle) {
  if (!visualStyle) return '';
  const styles = [];
  if (visualStyle.fillColor) styles.push(`background-color:${visualStyle.fillColor}`);
  if (visualStyle.strokeColor && Number(visualStyle.strokeWeight) > 0) {
    styles.push(`border:${formatNumber(visualStyle.strokeWeight)}px solid ${visualStyle.strokeColor}`);
  }
  if (Number(visualStyle.cornerRadius) > 0) {
    styles.push(`border-radius:${formatPx(visualStyle.cornerRadius)}`);
  }
  const blendMode = blendModeCss(visualStyle.blendMode);
  if (blendMode) styles.push(blendMode);
  const opacity = Number(visualStyle.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 100) {
    styles.push(`opacity:${formatNumber(opacity / 100)}`);
  }
  return styles.join(';');
}

function textStyleCss(textStyle) {
  if (!textStyle) return '';
  const styles = [];
  if (textStyle.fontFamily) styles.push(`font-family:"${textStyle.fontFamily}", Arial, sans-serif`);
  if (textStyle.fontWeight) styles.push(`font-weight:${textStyle.fontWeight}`);
  if (textStyle.fontStyle) styles.push(`font-style:${textStyle.fontStyle}`);
  if (textStyle.pointSize != null) styles.push(`font-size:${formatPx(textStyle.pointSize)}`);
  if (textStyle.leading != null) styles.push(`line-height:${formatPx(textStyle.leading)}`);
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
    styles.push(`padding:${formatPx(inset.top || 0)} ${formatPx(inset.right || 0)} ${formatPx(inset.bottom || 0)} ${formatPx(inset.left || 0)}`);
  }
  if (Number(textFrameStyle.columnCount) > 1) {
    styles.push(`column-count:${formatNumber(textFrameStyle.columnCount)}`);
    if (Number(textFrameStyle.columnGap) > 0) styles.push(`column-gap:${formatPx(textFrameStyle.columnGap)}`);
  }
  if (textFrameStyle.verticalJustification && textFrameStyle.verticalJustification !== 'flex-start') {
    styles.push('display:flex', 'flex-direction:column', `justify-content:${textFrameStyle.verticalJustification}`);
  }
  return styles.join(';');
}

function zIndexCss(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
}

function styleResourceCss(model) {
  const styles = model.styles || {};
  return [
    styleCollectionCss(styles.paragraphStyles, 'pstyle'),
    styleCollectionCss(styles.characterStyles, 'cstyle'),
    styleCollectionCss(styles.objectStyles, 'ostyle'),
    compositeFontCss(styles.paragraphStyles, styles.compositeFonts),
  ].filter(Boolean).join('\n');
}

function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {})
    .filter((style) => style && style.css)
    .map((style) => `    .${prefix}-${styleClassToken(style)} { ${cssForHtml(style.css)} }`)
    .join('\n');
}

function compositeFontCss(paragraphStyles = {}, compositeFonts = {}) {
  const lines = [];
  for (const style of Object.values(paragraphStyles || {})) {
    if (!style || !style.css) continue;
    const features = indesignFeatures(style);
    const compositeName = features.compositeFont
      ? features.compositeFont
      : fontFamilyFromCss(style.css);
    const composite = compositeName && compositeFonts ? compositeFonts[compositeName] : null;
    if (!composite) continue;
    const roman = (composite.entries || []).find((entry) => entry.name === '罗马字') || {};
    const css = [];
    if (roman.size) css.push(`font-size:${formatNumber(Number(roman.size) / 100)}em`);
    if (roman.weight || composite.romanWeight) css.push(`font-weight:${roman.weight || composite.romanWeight}`);
    if (css.length) lines.push(`    .pstyle-${styleClassToken(style)} .en-text { ${css.join('; ')} }`);
  }
  return lines.join('\n');
}

function effectsCss(effects, visualStyle) {
  if (!effects || !effects.gradientFeather) return '';
  const gradient = gradientFeatherCss(effects.gradientFeather, visualStyle);
  return gradient ? `background:${gradient}` : '';
}

function gradientFeatherCss(gradientFeather, visualStyle) {
  if (!gradientFeather || String(gradientFeather.type || 'linear').toLowerCase() !== 'linear') return '';
  const stops = Array.isArray(gradientFeather.stops) ? gradientFeather.stops : [];
  if (!stops.length) return '';
  const rgb = hexToRgb(visualStyle && visualStyle.fillColor ? visualStyle.fillColor : '#ffffff');
  if (!rgb) return '';
  const angle = indesignGradientAngleToCss(gradientFeather.angle);
  const cssStops = stops.map((stop) => {
    const opacity = clamp(Number(stop.opacity) / 100, 0, 1);
    const location = clamp(Number(stop.location), 0, 100);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${formatNumber(opacity)}) ${formatNumber(location)}%`;
  });
  return `linear-gradient(${formatNumber(angle)}deg, ${cssStops.join(', ')})`;
}

function indesignGradientAngleToCss(angle) {
  return ((Number(angle || 0) - 270) % 360 + 360) % 360;
}

function hexToRgb(value) {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

module.exports = {
  baseCss,
  pageStyle,
  boundsStyle,
  itemInlineStyle,
  itemClasses,
  textStyleCss,
  zIndexCss,
};
