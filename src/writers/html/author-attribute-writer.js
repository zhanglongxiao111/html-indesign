const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'defer',
  'disabled',
  'hidden',
  'loop',
  'muted',
  'open',
  'playsinline',
  'readonly',
  'required',
  'selected',
  HTML_DATA_ID_ATTRIBUTES.OBJECT,
  HTML_DATA_ID_ATTRIBUTES.IGNORE,
]);
const BLOCKED_ATTRIBUTES = new Set(['style']);

function mergeAttributes(...sources) {
  const out = new Map();
  for (const source of sources) {
    for (const [name, value] of Object.entries(source || {})) {
      const key = normalizeAttrName(name);
      if (!key || BLOCKED_ATTRIBUTES.has(key)) continue;
      if (key === 'class' || key === 'id') continue;
      if (!out.has(key)) out.set(key, value == null ? '' : String(value));
    }
  }
  return Object.fromEntries(out);
}

function attrsToHtml(attrs) {
  return Object.entries(attrs || {}).map(([name, value]) => {
    const key = normalizeAttrName(name);
    if (!key) return '';
    if (BOOLEAN_ATTRIBUTES.has(key) && (value === '' || value === true || value === key)) return key;
    return `${key}="${attr(value)}"`;
  }).filter(Boolean).join(' ');
}

function normalizeAttrName(name) {
  const key = String(name || '').trim().toLowerCase();
  return /^[a-z_:][a-z0-9_:.-]*$/.test(key) ? key : '';
}

function isVoidTag(tagName) {
  return VOID_TAGS.has(String(tagName || '').toLowerCase());
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  mergeAttributes,
  attrsToHtml,
  isVoidTag,
  escapeHtml,
  attr,
};
