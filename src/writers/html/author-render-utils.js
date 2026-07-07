const {
  safeAuthorHtmlTag,
  safeAuthorInlineHtmlTag,
} = require('./safe-tags');

function normalizeCropToken(value) {
  const text = String(value || '').trim();
  const key = text.toLowerCase();
  for (const token of ['media', 'bleed', 'trim', 'art', 'content']) {
    if (key === token || key.includes(token)) return token;
  }
  return text;
}

function layerListAttr(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item || '').trim()).filter(Boolean).join('|');
}

function fileExtension(value) {
  const clean = String(value || '').split(/[?#]/)[0];
  const index = clean.lastIndexOf('.');
  return index === -1 ? '' : clean.slice(index + 1).toLowerCase();
}

function safeInlineTag(value) {
  return safeAuthorInlineHtmlTag(value);
}

function hasSourceNode(sourceNode) {
  return Boolean(sourceNode && sourceNode.tagName && !sourceNode.generatedFrame);
}

function isUsefulCharacterStyle(value) {
  const name = String(value || '').trim();
  return Boolean(name && name !== '[无]' && !/^自动字符-/i.test(name));
}

function isUsefulSemantic(value) {
  const semantic = String(value || '').trim();
  return Boolean(semantic && semantic.toLowerCase() !== 'unknown');
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
}

function orderAttrs(attrs) {
  const out = {};
  for (const key of ['id', 'class', 'src', 'data', 'type', 'alt', 'title', 'role', 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function orderInlineAttrs(attrs) {
  const out = {};
  for (const key of ['class', 'title', 'role']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function hasDataIdObject(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, 'data-id-object');
}

function hasDataIdIgnore(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, 'data-id-ignore');
}

function safeTag(value) {
  return safeAuthorHtmlTag(value);
}

function tagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'table') return 'table';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function classForRole(role) {
  return role === 'graphic' ? 'graphic-object' : 'id-object';
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 10000) / 10000);
}

function px(value) {
  return `${formatNumber(value)}px`;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function indent(spaces) {
  return ' '.repeat(spaces);
}

function fileStem(filePath) {
  const name = String(filePath || 'pdf').split(/[\\/]/).pop() || 'pdf';
  return name.replace(/\.[^.]+$/, '') || 'pdf';
}

module.exports = {
  normalizeCropToken,
  layerListAttr,
  fileExtension,
  safeInlineTag,
  hasSourceNode,
  isUsefulCharacterStyle,
  isUsefulSemantic,
  positiveIntegerOrNull,
  orderAttrs,
  orderInlineAttrs,
  hasDataIdObject,
  hasDataIdIgnore,
  safeTag,
  tagForRole,
  classForRole,
  formatNumber,
  px,
  numberOrZero,
  finiteOrNull,
  indent,
  fileStem,
};
