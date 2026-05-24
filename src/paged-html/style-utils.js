const crypto = require('crypto');
const { parseCssLength, round } = require('../shared/geometry');

function normalizeCssColor(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === 'transparent') return null;
  const rgba = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d?(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/);
  if (!rgba) return null;
  const alpha = rgba[4] == null ? 1 : Number(rgba[4]);
  if (alpha === 0) return null;
  const r = clampColor(Number(rgba[1]));
  const g = clampColor(Number(rgba[2]));
  const b = clampColor(Number(rgba[3]));
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return {
    hex,
    name: `color-${hex.slice(1)}`,
  };
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(value) {
  return value.toString(16).padStart(2, '0');
}

function cssLengthToPt(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  if (parsed.unit === 'pt') return round(parsed.value, 4);
  if (parsed.unit === 'px') return round(parsed.value * 72 / 96, 4);
  if (parsed.unit === 'mm') return round(parsed.value * 72 / 25.4, 4);
  return null;
}

function sanitizeStyleName(value) {
  const safe = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || null;
}

function stableAutoName(prefix, signature) {
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(sortObject(signature)))
    .digest('hex')
    .slice(0, 8);
  return `auto-${prefix}-${hash}`;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = sortObject(value[key]);
    return out;
  }, {});
}

function firstClassName(item) {
  const first = (item.classList || []).find((name) => String(name || '').trim());
  return first ? sanitizeStyleName(first) : null;
}

function explicitName(attributes, names) {
  for (const name of names) {
    const value = attributes && attributes[name];
    const safe = sanitizeStyleName(value);
    if (safe) return safe;
  }
  return null;
}

module.exports = {
  normalizeCssColor,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
  explicitName,
};
