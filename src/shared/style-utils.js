const crypto = require('crypto');
const { parseCssLength, round } = require('./geometry');

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
  const out = {
    hex,
    name: swatchNameFromRgb(r, g, b),
  };
  if (alpha !== 1) out.alpha = alpha;
  return out;
}

function normalizeCssColorFromBackgroundImage(value) {
  const gradient = parseCssLinearGradient(value);
  if (gradient && gradient.stops.length) return gradient.stops[0].color;
  return null;
}

function parseCssLinearGradient(value) {
  const text = String(value || '').trim();
  const match = text.match(/^linear-gradient\((.*)\)$/i);
  if (!match) return null;
  const parts = splitCssArgs(match[1]);
  if (parts.length < 2) return null;

  let angle = 180;
  let stopStart = 0;
  const angleMatch = parts[0].match(/^([+-]?(?:\d+|\d*\.\d+))deg$/i);
  if (angleMatch) {
    angle = Number(angleMatch[1]);
    stopStart = 1;
  }

  const stops = parts.slice(stopStart)
    .map(parseGradientStop)
    .filter(Boolean);
  if (stops.length < 2) return null;
  assignStopLocations(stops);
  return {
    type: 'linear',
    angle,
    stops,
  };
}

function splitCssArgs(value) {
  const out = [];
  let current = '';
  let depth = 0;
  for (const char of String(value || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseGradientStop(value) {
  const colorMatch = String(value || '').trim().match(/^(rgba?\([^)]+\))(.*)$/i);
  if (!colorMatch) return null;
  const color = normalizeCssColorForGradientStop(colorMatch[1]);
  if (!color) return null;
  const alpha = color.alpha == null ? 1 : color.alpha;
  const cleanColor = {
    hex: color.hex,
    name: color.name,
  };
  const locationMatch = colorMatch[2].match(/([+-]?(?:\d+|\d*\.\d+))%/);
  return {
    color: cleanColor,
    opacity: Math.round(alpha * 10000) / 100,
    location: locationMatch ? Number(locationMatch[1]) : null,
  };
}

function normalizeCssColorForGradientStop(value) {
  const text = String(value || '').trim().toLowerCase();
  const rgba = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d?(?:\.\d+)?|1(?:\.0+)?|0(?:\.0+)?))?\s*\)$/);
  if (!rgba) return null;
  const alpha = rgba[4] == null ? 1 : Number(rgba[4]);
  const r = clampColor(Number(rgba[1]));
  const g = clampColor(Number(rgba[2]));
  const b = clampColor(Number(rgba[3]));
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return {
    hex,
    name: swatchNameFromRgb(r, g, b),
    alpha,
  };
}

function swatchNameFromRgb(r, g, b) {
  return `颜色-${r}-${g}-${b}`;
}

function assignStopLocations(stops) {
  if (stops[0].location == null) stops[0].location = 0;
  if (stops[stops.length - 1].location == null) stops[stops.length - 1].location = 100;

  let previousKnown = 0;
  for (let index = 1; index < stops.length; index += 1) {
    if (stops[index].location == null) continue;
    distributeMissingLocations(stops, previousKnown, index);
    previousKnown = index;
  }
  distributeMissingLocations(stops, previousKnown, stops.length - 1);
}

function distributeMissingLocations(stops, startIndex, endIndex) {
  const start = stops[startIndex].location;
  const end = stops[endIndex].location;
  const gap = endIndex - startIndex;
  if (gap <= 1) return;
  for (let index = startIndex + 1; index < endIndex; index += 1) {
    if (stops[index].location != null) continue;
    const ratio = (index - startIndex) / gap;
    stops[index].location = Math.round((start + (end - start) * ratio) * 100) / 100;
  }
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
    .slice(0, 12);
  const digits = (BigInt(`0x${hash}`) % 100000000n).toString().padStart(8, '0');
  return `${autoNamePrefix(prefix)}-${digits}`;
}

function autoNamePrefix(prefix) {
  const labels = {
    paragraph: '自动段落',
    character: '自动字符',
    object: '自动对象',
    frame: '自动框架',
  };
  return labels[prefix] || '自动样式';
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
  normalizeCssColorFromBackgroundImage,
  parseCssLinearGradient,
  cssLengthToPt,
  sanitizeStyleName,
  stableAutoName,
  firstClassName,
  explicitName,
};
