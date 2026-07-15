const { HTML_DATA_ID_ATTRIBUTES } = require('../../../protocol');
'use strict';

function vectorFactsFromSvgItem(item, bounds) {
  const attrs = item && item.attributes || {};
  const tagName = String(item && item.tagName || '').toLowerCase();
  const vectorKind = String(attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR] || '').trim();
  if (tagName !== 'svg' && !vectorKind) return null;
  const sourceHtml = sourceHtmlForItem(item);
  const pathTags = pathTagsFromHtml(sourceHtml);
  if (!pathTags.length) return null;
  const viewBox = parseViewBox(attrs.viewBox || attrs.viewbox, bounds);
  const capturedPaths = Array.isArray(item && item.vectorPaths) ? item.vectorPaths : [];
  const paths = pathTags
    .flatMap((tag, index) => pathsFromPathTag(tag, bounds, viewBox, capturedPaths[index], sourceHtml))
    .filter(Boolean);
  if (!paths.length) return null;
  return {
    vectorGeometry: {
      kind: vectorKind || 'path',
      paths,
    },
    visualStyle: paths[0].visualStyle || visualStyleFromPath(pathTags[0], sourceHtml, capturedPaths[0] && capturedPaths[0].computedStyle),
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

function pathsFromPathTag(attrs, bounds, viewBox, capturedPath, sourceHtml) {
  const visualStyle = visualStyleFromPath(
    attrs,
    sourceHtml,
    capturedPath && capturedPath.computedStyle,
  );
  const metadataPoints = parseVectorPointsAttr(attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR_POINTS], bounds, viewBox);
  const paths = metadataPoints
    ? [{
      closed: /\b[zZ]\b|[zZ]\s*$/.test(String(attrs.d || '').trim()),
      points: metadataPoints,
    }]
    : parsePathSubpaths(attrs.d || '', bounds, viewBox);
  applyPointTypesToPaths(paths, attrs[HTML_DATA_ID_ATTRIBUTES.POINT_TYPES]);
  return paths
    .filter((path) => path && Array.isArray(path.points) && path.points.length)
    .map((path) => ({ ...path, visualStyle: { ...visualStyle } }));
}

function parseVectorPointsAttr(value, bounds, viewBox) {
  const text = decodeBasicEntities(String(value || '').trim());
  if (!text) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return null;
  }
  const rawPoints = Array.isArray(parsed && parsed[0]) ? parsed[0] : parsed;
  if (!Array.isArray(rawPoints) || !rawPoints.length) return null;
  const points = rawPoints.map((point) => vectorPointFromMetadata(point, bounds, viewBox)).filter(Boolean);
  return points.length ? points : null;
}

function vectorPointFromMetadata(point, bounds, viewBox) {
  if (!point || typeof point !== 'object') return null;
  const anchor = mapPoint(point.anchor || {}, bounds, viewBox);
  return {
    anchor,
    leftDirection: mapPoint(point.leftDirection || point.anchor || {}, bounds, viewBox),
    rightDirection: mapPoint(point.rightDirection || point.anchor || {}, bounds, viewBox),
    pointType: pointTypeFromMetadata(point.pointType),
  };
}

function pointTypeFromMetadata(value) {
  const token = String(value || '').trim().toUpperCase();
  return ['CORNER', 'SMOOTH', 'SYMMETRICAL', 'PLAIN'].includes(token) ? token : 'PLAIN';
}

function parsePathSubpaths(d, bounds, viewBox) {
  const tokens = pathTokens(d);
  const paths = [];
  let index = 0;
  let command = '';
  let current = { x: 0, y: 0 };
  let start = null;
  let active = null;
  while (index < tokens.length) {
    const iterationStart = index;
    if (isCommand(tokens[index])) {
      command = tokens[index++];
      if (!isSupportedCommand(command)) {
        throw svgPathError(
          'UNSUPPORTED_SVG_PATH_COMMAND',
          `Unsupported inline SVG path command '${command}'. Use an external SVG asset for complex paths.`,
        );
      }
    }
    if (!command) break;
    if (/[zZ]/.test(command)) {
      if (!active || !active.points.length) {
        throw svgPathError('INVALID_SVG_PATH_DATA', 'SVG close-path command has no active subpath.');
      }
      active.closed = true;
      paths.push(active);
      active = null;
      if (start) current = start;
      start = null;
      command = '';
      continue;
    }
    if (/[mM]/.test(command)) {
      if (!hasNumbers(tokens, index, 2)) {
        throw svgPathError('INVALID_SVG_PATH_DATA', 'SVG move command requires a coordinate pair.');
      }
      if (active && active.points.length) paths.push(active);
      const moveCommand = command;
      const local = moveCommand === 'm'
        ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
        : { x: number(tokens[index]), y: number(tokens[index + 1]) };
      current = local;
      start = { ...local };
      active = { closed: false, points: [vectorPoint(mapPoint(local, bounds, viewBox))] };
      index += 2;
      command = moveCommand === 'm' ? 'l' : 'L';
      while (hasNumbers(tokens, index, 2)) {
        const local = command === 'l'
          ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
          : { x: number(tokens[index]), y: number(tokens[index + 1]) };
        current = local;
        active.points.push(vectorPoint(mapPoint(local, bounds, viewBox)));
        index += 2;
      }
    } else if (/[lL]/.test(command)) {
      assertActiveSubpath(active, command);
      while (hasNumbers(tokens, index, 2)) {
        const local = command === 'l'
          ? { x: current.x + number(tokens[index]), y: current.y + number(tokens[index + 1]) }
          : { x: number(tokens[index]), y: number(tokens[index + 1]) };
        current = local;
        active.points.push(vectorPoint(mapPoint(local, bounds, viewBox)));
        index += 2;
      }
    } else if (/[cC]/.test(command)) {
      assertActiveSubpath(active, command);
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
        if (active.points.length) active.points[active.points.length - 1].rightDirection = mapPoint(c1, bounds, viewBox);
        const anchor = mapPoint(end, bounds, viewBox);
        active.points.push({
          anchor,
          leftDirection: mapPoint(c2, bounds, viewBox),
          rightDirection: anchor,
          pointType: 'SMOOTH',
        });
        current = end;
        index += 6;
      }
    } else {
      throw svgPathError(
        'UNSUPPORTED_SVG_PATH_COMMAND',
        `Unsupported inline SVG path command '${command}'. Use an external SVG asset for complex paths.`,
      );
    }
    if (index === iterationStart) {
      throw svgPathError(
        'INVALID_SVG_PATH_DATA',
        `Invalid inline SVG path data near '${tokens[index]}'.`,
      );
    }
  }
  if (active && active.points.length) paths.push(active);
  return paths;
}

function assertActiveSubpath(active, command) {
  if (active && active.points && active.points.length) return;
  throw svgPathError('INVALID_SVG_PATH_DATA', `SVG path command '${command}' has no active subpath.`);
}

function pathTokens(value) {
  return String(value || '').match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g) || [];
}

function isCommand(token) {
  return /^[A-Za-z]$/.test(String(token || ''));
}

function isSupportedCommand(token) {
  return /^[mMlLcCzZ]$/.test(String(token || ''));
}

function svgPathError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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

function applyPointTypesToPaths(paths, value) {
  const pointTypes = pointTypesFromAttr(value);
  if (!pointTypes.length) return;
  let index = 0;
  for (const path of paths || []) {
    for (const point of path && path.points || []) {
      if (index >= pointTypes.length) return;
      point.pointType = pointTypes[index++];
    }
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

function visualStyleFromPath(attrs, sourceHtml, computedStyle = {}) {
  const style = {};
  if (visiblePaint(attrs[HTML_DATA_ID_ATTRIBUTES.FILL_COLOR])) style.fillColor = normalizeHexColor(attrs[HTML_DATA_ID_ATTRIBUTES.FILL_COLOR]);
  else if (visiblePaint(computedStyle.fill)) style.fillColor = normalizeHexColor(computedStyle.fill);
  else if (visiblePaint(attrs.fill)) style.fillColor = normalizeHexColor(attrs.fill);
  else style.fillColor = null;
  style.fillOpacity = opacityPercent(attrs[HTML_DATA_ID_ATTRIBUTES.FILL_OPACITY] || computedStyle['fill-opacity'] || attrs['fill-opacity']);
  if (visiblePaint(computedStyle.stroke)) style.strokeColor = normalizeHexColor(computedStyle.stroke);
  else if (visiblePaint(attrs.stroke)) style.strokeColor = normalizeHexColor(attrs.stroke);
  else style.strokeColor = null;
  const strokeWeight = positiveNumber(computedStyle['stroke-width'] || attrs['stroke-width']);
  style.strokeWeight = strokeWeight;
  style.strokeOpacity = opacityPercent(computedStyle['stroke-opacity'] || attrs['stroke-opacity']);
  const opacity = opacityPercent(computedStyle.opacity || attrs.opacity);
  if (opacity !== null) style.opacity = opacity;
  const lineCap = computedStyle['stroke-linecap'] || attrs['stroke-linecap'];
  const lineJoin = computedStyle['stroke-linejoin'] || attrs['stroke-linejoin'];
  if (lineCap) style.strokeLineCap = lineCap;
  if (lineJoin) style.strokeLineJoin = lineJoin;
  const miter = positiveNumber(computedStyle['stroke-miterlimit'] || attrs['stroke-miterlimit']);
  if (miter !== null) style.strokeMiterLimit = miter;
  const rawStrokeStyle = String(attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE] || '').trim();
  const dash = String(computedStyle['stroke-dasharray'] || attrs['stroke-dasharray'] || '').trim();
  if (rawStrokeStyle) style.strokeStyle = rawStrokeStyle;
  else if (dash) style.strokeStyle = dash;
  const start = markerFromUrl(attrs['marker-start'], sourceHtml, attrs[HTML_DATA_ID_ATTRIBUTES.LINE_START_MARKER_RAW_NAME]);
  const end = markerFromUrl(attrs['marker-end'], sourceHtml, attrs[HTML_DATA_ID_ATTRIBUTES.LINE_END_MARKER_RAW_NAME]);
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
  const rgb = /^rgba?\(/.test(text) ? text.match(/\d+(?:\.\d+)?/g) : null;
  if (!rgb || rgb.length < 3) return text;
  return `#${hexByte(rgb[0])}${hexByte(rgb[1])}${hexByte(rgb[2])}`;
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
  const parsed = Number.parseFloat(String(value == null ? '' : value));
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

function decodeBasicEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
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
