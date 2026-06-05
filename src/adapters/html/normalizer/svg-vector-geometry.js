'use strict';

function vectorFactsFromSvgItem(item, bounds) {
  const attrs = item && item.attributes || {};
  const tagName = String(item && item.tagName || '').toLowerCase();
  const vectorKind = String(attrs['data-id-vector'] || '').trim();
  if (tagName !== 'svg' && !vectorKind) return null;
  const sourceHtml = sourceHtmlForItem(item);
  const pathTags = pathTagsFromHtml(sourceHtml);
  if (!pathTags.length) return null;
  const viewBox = parseViewBox(attrs.viewBox || attrs.viewbox, bounds);
  const paths = pathTags
    .map((tag) => pathFromPathTag(tag, bounds, viewBox))
    .filter(Boolean);
  if (!paths.length) return null;
  return {
    vectorGeometry: {
      kind: vectorKind || 'path',
      paths,
    },
    visualStyle: visualStyleFromPath(pathTags[0], sourceHtml),
  };
}

function sourceHtmlForItem(item) {
  if (item && item.sourceNode && typeof item.sourceNode.sourceHtml === 'string') return item.sourceNode.sourceHtml;
  if (item && typeof item.sourceHtml === 'string') return item.sourceHtml;
  return '';
}

function pathTagsFromHtml(html) {
  const out = [];
  const pattern = /<path\b[^>]*>/gi;
  const body = String(html || '').replace(/<defs\b[\s\S]*?<\/defs>/gi, '');
  let match;
  while ((match = pattern.exec(body))) out.push(parseAttributes(match[0]));
  return out.filter((attrs) => attrs.d);
}

function parseAttributes(tag) {
  const out = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(String(tag || '')))) {
    out[match[1]] = match[2] != null ? match[2] : match[3];
  }
  return out;
}

function pathFromPathTag(attrs, bounds, viewBox) {
  const points = parsePathPoints(attrs.d || '', bounds, viewBox);
  if (!points.length) return null;
  applyPointTypes(points, attrs['data-id-point-types']);
  return {
    closed: /\b[zZ]\b|[zZ]\s*$/.test(String(attrs.d || '').trim()),
    points,
  };
}

function parsePathPoints(d, bounds, viewBox) {
  const tokens = pathTokens(d);
  const points = [];
  let index = 0;
  let command = '';
  let current = { x: 0, y: 0 };
  while (index < tokens.length) {
    if (isCommand(tokens[index])) command = tokens[index++];
    if (!command || /[zZ]/.test(command)) break;
    if (/[mM]/.test(command)) {
      while (hasNumbers(tokens, index, 2)) {
        const local = command === 'm'
          ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
          : { x: number(tokens[index]), y: number(tokens[index + 1]) };
        current = local;
        points.push(vectorPoint(mapPoint(local, bounds, viewBox)));
        index += 2;
        command = command === 'm' ? 'l' : 'L';
      }
    } else if (/[lL]/.test(command)) {
      while (hasNumbers(tokens, index, 2)) {
        const local = command === 'l'
          ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
          : { x: number(tokens[index]), y: number(tokens[index + 1]) };
        current = local;
        points.push(vectorPoint(mapPoint(local, bounds, viewBox)));
        index += 2;
      }
    } else if (/[cC]/.test(command)) {
      while (hasNumbers(tokens, index, 6)) {
        const c1 = command === 'c'
          ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
          : { x: number(tokens[index]), y: number(tokens[index + 1]) };
        const c2 = command === 'c'
          ? { x: current.x + number(tokens[index + 2]), y: current.y + number(tokens[index + 3]) }
          : { x: number(tokens[index + 2]), y: number(tokens[index + 3]) };
        const end = command === 'c'
          ? { x: current.x + number(tokens[index + 4]), y: current.y + number(tokens[index + 5]) }
          : { x: number(tokens[index + 4]), y: number(tokens[index + 5]) };
        if (points.length) points[points.length - 1].rightDirection = mapPoint(c1, bounds, viewBox);
        const anchor = mapPoint(end, bounds, viewBox);
        points.push({
          anchor,
          leftDirection: mapPoint(c2, bounds, viewBox),
          rightDirection: anchor,
          pointType: 'SMOOTH',
        });
        current = end;
        index += 6;
      }
    } else {
      break;
    }
  }
  return points;
}

function pathTokens(value) {
  return String(value || '').match(/[mMlLcCzZ]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
}

function isCommand(token) {
  return /^[mMlLcCzZ]$/.test(String(token || ''));
}

function hasNumbers(tokens, index, count) {
  if (index + count > tokens.length) return false;
  for (let offset = 0; offset < count; offset += 1) {
    if (isCommand(tokens[index + offset])) return false;
  }
  return true;
}

function vectorPoint(anchor) {
  return {
    anchor,
    leftDirection: anchor,
    rightDirection: anchor,
    pointType: 'PLAIN',
  };
}

function applyPointTypes(points, value) {
  const pointTypes = pointTypesFromAttr(value);
  if (!pointTypes.length) return;
  for (let index = 0; index < points.length && index < pointTypes.length; index += 1) {
    points[index].pointType = pointTypes[index];
  }
}

function pointTypesFromAttr(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => ['CORNER', 'SMOOTH', 'SYMMETRICAL', 'PLAIN'].includes(token));
}

function mapPoint(point, bounds = {}, viewBox = {}) {
  const width = Number(bounds.width || 0);
  const height = Number(bounds.height || 0);
  const vbWidth = Number(viewBox.width || 0);
  const vbHeight = Number(viewBox.height || 0);
  const scaleX = vbWidth ? width / vbWidth : 1;
  const scaleY = vbHeight ? height / vbHeight : 1;
  return {
    x: round(Number(bounds.x || 0) + (Number(point.x || 0) - Number(viewBox.x || 0)) * scaleX),
    y: round(Number(bounds.y || 0) + (Number(point.y || 0) - Number(viewBox.y || 0)) * scaleY),
  };
}

function parseViewBox(value, bounds = {}) {
  const parts = String(value || '').trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }
  return { x: 0, y: 0, width: Number(bounds.width || 0), height: Number(bounds.height || 0) };
}

function visualStyleFromPath(attrs, sourceHtml) {
  const style = {};
  if (visiblePaint(attrs['data-id-fill-color'])) style.fillColor = normalizeHexColor(attrs['data-id-fill-color']);
  else if (visiblePaint(attrs.fill)) style.fillColor = normalizeHexColor(attrs.fill);
  else style.fillColor = null;
  style.fillOpacity = opacityPercent(attrs['data-id-fill-opacity'] || attrs['fill-opacity']);
  if (visiblePaint(attrs.stroke)) style.strokeColor = normalizeHexColor(attrs.stroke);
  else style.strokeColor = null;
  const strokeWeight = positiveNumber(attrs['stroke-width']);
  style.strokeWeight = strokeWeight;
  style.strokeOpacity = opacityPercent(attrs['stroke-opacity']);
  const opacity = opacityPercent(attrs.opacity);
  if (opacity !== null) style.opacity = opacity;
  if (attrs['stroke-linecap']) style.strokeLineCap = attrs['stroke-linecap'];
  if (attrs['stroke-linejoin']) style.strokeLineJoin = attrs['stroke-linejoin'];
  const miter = positiveNumber(attrs['stroke-miterlimit']);
  if (miter !== null) style.strokeMiterLimit = miter;
  const rawStrokeStyle = String(attrs['data-id-stroke-style'] || '').trim();
  const dash = String(attrs['stroke-dasharray'] || '').trim();
  if (rawStrokeStyle) style.strokeStyle = rawStrokeStyle;
  else if (dash) style.strokeStyle = dash;
  const start = markerFromUrl(attrs['marker-start'], sourceHtml, attrs['data-id-line-start-marker-raw-name']);
  const end = markerFromUrl(attrs['marker-end'], sourceHtml, attrs['data-id-line-end-marker-raw-name']);
  if (start) style.lineStartMarker = start;
  if (end) style.lineEndMarker = end;
  return style;
}

function visiblePaint(value) {
  const text = String(value || '').trim().toLowerCase();
  return Boolean(text && text !== 'none' && text !== 'transparent');
}

function normalizeHexColor(value) {
  const text = String(value || '').trim().toLowerCase();
  const short = text.match(/^#([0-9a-f]{3})$/i);
  if (short) return `#${short[1].split('').map((char) => `${char}${char}`).join('')}`.toLowerCase();
  const full = text.match(/^#([0-9a-f]{6})$/i);
  if (full) return `#${full[1].toLowerCase()}`;
  const rgb = text.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
  if (!rgb) return text;
  return `#${hexByte(rgb[1])}${hexByte(rgb[2])}${hexByte(rgb[3])}`;
}

function hexByte(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0)))).toString(16).padStart(2, '0');
}

function opacityPercent(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return round(Math.max(0, Math.min(100, percent)));
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? round(parsed) : null;
}

function markerFromUrl(value, sourceHtml, rawName) {
  const match = String(value || '').match(/url\(#([^)]+)\)/i);
  if (!match) return null;
  const raw = String(rawName || '').trim();
  return { type: markerTypeForId(match[1], sourceHtml), rawName: raw || null };
}

function markerTypeForId(id, sourceHtml) {
  const marker = markerHtmlForId(id, sourceHtml);
  if (/<circle\b/i.test(marker)) return 'circle';
  if (/<rect\b/i.test(marker)) return 'square';
  if (/M5\s+0\s+L10\s+5\s+L5\s+10\s+L0\s+5\s+Z/i.test(marker)) return 'diamond';
  if (/M5\s+0\s+L5\s+10/i.test(marker)) return 'bar';
  if (/M0\s+0\s+L10\s+5\s+L0\s+10\s+Z/i.test(marker)) return 'arrow';
  return 'custom';
}

function markerHtmlForId(id, sourceHtml) {
  const escaped = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<marker\\b(?=[^>]*\\bid=["']${escaped}["'])[^>]*>[\\s\\S]*?<\\/marker>`, 'i');
  const match = pattern.exec(String(sourceHtml || ''));
  return match ? match[0] : '';
}

function number(value) {
  return Number(value || 0);
}

function round(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 1000) / 1000;
}

module.exports = {
  vectorFactsFromSvgItem,
};
