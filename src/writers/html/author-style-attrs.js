const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
'use strict';

const { blendModeCss } = require('./css-blend-mode');
const { safeAuthorClassToken, isIndesignBuiltinStyleName } = require('../../shared/style-utils');
const {
  equivalentCssValue,
  inlineResidualForSynth,
  parseCssDeclarations,
  serializeCssDeclarations,
  synthesizedStyleDeclarations,
} = require('./author-style-residual');
const { foldedBorderCss } = require('./author-border-fold');
const { capitalizationCss, colorWithOpacity, cssBorderStyle } = require('./css-values');

function generatedInlineStyleForItem(item, options = {}) {
  const indesign = item && item.extensions && item.extensions.indesign || {};
  const foldedBorders = options.foldedBordersByContainer && item && options.foldedBordersByContainer.get(item.id);
  return mergeCss([
    visualStyleCss(item && item.visualStyle, { foldedBorders }),
    textStyleCss(item && item.textStyle),
    textFrameStyleCss(indesign.textFrameStyle),
    cssForHtml(item && item.inlineStyle),
    zIndexCss(item && item.zIndex),
  ]);
}

function authorInlineStyleForItem(item, sourceStyle, options = {}) {
  const generatedStyle = generatedInlineStyleForItem(item, options);
  if (options.disableSynthResidual) return mergeCss([sourceStyle, generatedStyle]);
  const token = item && item.styleRefs && item.styleRefs.synthesizedToken;
  const residual = inlineResidualForSynth({
    inlineCss: generatedStyle,
    token,
    synthesizedStyles: options.synthesizedStyles,
  });
  recordResidual(options.styleResidualReport, item, token, residual);
  return mergeCss([sourceStyle, residual.css]);
}

// 保留来源内联样式的对象（accepted 来源节点）外观来自样式类与合成样式类。合成样式按外观归组，
// 组内颜色等覆盖字段（style-atoms TEXT_OVERRIDE_FIELDS）不同的成员共用一条规则：规则取的是组内
// 第一个成员的值，其余成员与规则不同的属性必须写成局部覆盖，否则会被规则的值顶掉（#34 往返：
// 图例文字与页码并在一组，图例文字被刷成页码的颜色）。与规则相同的属性从来源内联样式里剥掉，
// 免得上一轮写下的旧覆盖值压过这一轮读回的外观。
function synthesizedOverrideStyle(item, sourceStyle, options = {}) {
  const token = item && item.styleRefs && item.styleRefs.synthesizedToken;
  const style = token && (Array.isArray(options.synthesizedStyles) ? options.synthesizedStyles : [])
    .find((entry) => entry && entry.token === token);
  if (!style) return sourceStyle;
  const rule = parseCssDeclarations(synthesizedStyleDeclarations(style));
  if (!rule.order.length) return sourceStyle;
  const generated = parseCssDeclarations(generatedInlineStyleForItem(item, options));
  const source = parseCssDeclarations(sourceStyle);
  const overrides = [];
  for (const property of rule.order) {
    if (!generated.values.has(property)) continue;
    const value = generated.values.get(property);
    if (equivalentCssValue(value, rule.values.get(property))) {
      source.values.delete(property);
    } else {
      overrides.push(`${property}:${value}`);
    }
  }
  return mergeCss([serializeCssDeclarations(source), overrides.join(';')]);
}

function recordResidual(report, item, token, residual) {
  if (!report || typeof report !== 'object') return;
  if (residual.removed.length) {
    report.removedProperties = Number(report.removedProperties || 0) + residual.removed.length;
    report.itemsReduced = Number(report.itemsReduced || 0) + 1;
  }
  if (token && residual.reason === 'synth-rule-missing') {
    if (!Array.isArray(report.missingSynthRules)) report.missingSynthRules = [];
    const key = `${item && item.id || ''}:${token}`;
    if (!report.missingSynthRules.some((entry) => `${entry.itemId || ''}:${entry.token}` === key)) {
      report.missingSynthRules.push({ itemId: item && item.id || null, token });
    }
  }
}

// 合成样式类只认模型这一轮分配的 token（semantic-model/synthesized-styles），与 components.css
// 同源：来源 class 里上一轮写出的 synth-* 类是旧编号，二轮往返时会和重新编号的规则错位（#34 往返）。
function authorClassesForItem(item, sourceClasses, sourceAttrs = {}) {
  const refs = item && item.styleRefs || {};
  const synthesizedClass = refs.synthesizedToken ? `synth-${safeAuthorClassToken(refs.synthesizedToken)}` : null;
  // 来源 class 里的旧 synth 类原位换成这一轮的类（没有就去掉），类序保持不变，往返 diff 不因换位抖动。
  const classes = new Set((sourceClasses || [])
    .map((className) => (isSynthesizedClass(className) ? synthesizedClass : className))
    .filter(Boolean));
  const paragraphStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE] || refs.paragraphStyle;
  const characterStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE] || refs.characterStyle;
  const objectStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE] || refs.objectStyle;
  const frameStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE] || refs.frameStyle;
  const tableStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE] || refs.tableStyle;
  const cellStyle = sourceAttrs[HTML_DATA_ID_ATTRIBUTES.CELL_STYLE] || refs.cellStyle;
  // 内置样式名（手写源码里的 data-id-*-style="[基本段落]" 会随来源属性回读）不生成样式类：
  // 类名会洗掉方括号，再次正向时无法认出是内置名，会被当成用户样式新建（#21）。
  const addStyleClass = (prefix, name) => {
    if (name && !isIndesignBuiltinStyleName(name)) classes.add(`${prefix}${safeAuthorClassToken(name)}`);
  };
  addStyleClass('pstyle-', paragraphStyle);
  addStyleClass('cstyle-', characterStyle);
  addStyleClass('ostyle-', objectStyle);
  addStyleClass('fstyle-', frameStyle);
  addStyleClass('tstyle-', tableStyle);
  addStyleClass('cellstyle-', cellStyle);
  if (synthesizedClass) classes.add(synthesizedClass);
  return Array.from(classes).filter(Boolean);
}

function isSynthesizedClass(className) {
  return /^synth-/i.test(String(className || ''));
}

// options.foldedBorders：折回容器的边框对象（author-border-fold），取代容器自身为 0 的描边。
function visualStyleCss(inputVisualStyle, options = {}) {
  if (!inputVisualStyle && !options.foldedBorders) return '';
  const visualStyle = inputVisualStyle || {};
  const styles = [];
  if (visualStyle.fillColor) styles.push(`background-color:${colorWithOpacity(visualStyle.fillColor, visualStyle.fillOpacity)}`);
  if (options.foldedBorders) {
    styles.push(foldedBorderCss(options.foldedBorders));
  } else if (visualStyle.strokeColor && Number(visualStyle.strokeWeight) > 0) {
    const strokeColor = colorWithOpacity(visualStyle.strokeColor, visualStyle.strokeOpacity);
    styles.push(`border:${geometryPx(visualStyle.strokeWeight)} ${cssBorderStyle(visualStyle.strokeStyle)} ${strokeColor}`);
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
  const capitalization = capitalizationCss(textStyle.capitalization);
  if (capitalization) styles.push(capitalization);
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
  synthesizedOverrideStyle,
  blendModeCss,
  mergeCss,
  textStyleCss,
  textFrameStyleCss,
  visualStyleCss,
};
