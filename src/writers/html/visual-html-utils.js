const { safeVisualClassToken } = require('../../shared/style-utils');

function requiredNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(message);
  }
  return number;
}

function requiredString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message);
  }
  return value;
}

function formatPx(value) {
  return `${formatNumber(value)}px`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 10000) / 10000);
}

function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function uniqueWords(value) {
  return Array.from(new Set(String(value || '').split(/\s+/).filter(Boolean)));
}

function trimCss(value) {
  return String(value || '').trim().replace(/;+$/, '').trim();
}

function cssForHtml(value) {
  return trimCss(value).replace(/(-?\d+(?:\.\d+)?)pt\b/g, (_, number) => `${formatNumber(number)}px`);
}

function styleByName(model, collectionName, name) {
  if (!name || !model || !model.styles) return null;
  const collection = model.styles[collectionName] || {};
  return collection[name] || Object.values(collection).find((style) => style && (style.name === name || style.token === name)) || null;
}

function styleClassToken(style) {
  return safeVisualClassToken(style.safeName || style.token || style.name || 'style');
}

function fontFamilyFromCss(css) {
  const match = String(css || '').match(/font-family:\s*['"]?([^,'";]+)['"]?/);
  return match ? match[1] : null;
}

function usesCompositeFont(paragraphStyle, model, firstLineFont) {
  const compositeFonts = (model.styles && model.styles.compositeFonts) || {};
  if (firstLineFont && compositeFonts[firstLineFont]) return true;
  if (!paragraphStyle) return false;
  const features = indesignFeatures(paragraphStyle);
  const compositeName = features.compositeFont
    ? features.compositeFont
    : fontFamilyFromCss(paragraphStyle.css);
  return Boolean(compositeName && compositeFonts[compositeName]);
}

function indesignFeatures(style) {
  return style && style.indesignFeatures || {};
}

function wrapEnglishText(value) {
  return String(value).replace(/([A-Za-z][A-Za-z0-9 .,:;()\/&+-]*[A-Za-z0-9)])/g, '<span class="en-text">$1</span>');
}

function splitLines(value) {
  return String(value || '').split(/\r\n|\r|\n/);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  requiredNumber,
  requiredString,
  formatPx,
  formatNumber,
  finiteOrZero,
  finiteOrNull,
  escapeHtml,
  attr,
  uniqueWords,
  cssForHtml,
  styleByName,
  styleClassToken,
  fontFamilyFromCss,
  usesCompositeFont,
  indesignFeatures,
  wrapEnglishText,
  splitLines,
  clamp,
};
