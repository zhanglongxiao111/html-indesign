const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
'use strict';

function hasVectorPaths(item) {
  const vector = item && item.vectorGeometry;
  return Boolean(vector && Array.isArray(vector.paths) && vector.paths.some((path) => path && Array.isArray(path.points) && path.points.length > 1));
}

function isDegenerateInvisibleVector(item) {
  if (!item || !item.vectorGeometry || hasVectorPaths(item)) return false;
  const bounds = item.bounds || {};
  const visual = item.visualStyle || {};
  const hasPaint = Boolean(visual.fillColor || visual.strokeColor || Number(visual.strokeWeight) > 0);
  return !hasPaint && Number(bounds.width || 0) === 0 && Number(bounds.height || 0) === 0;
}

function vectorViewBox(item) {
  const viewport = vectorViewport(item);
  const width = viewport.width;
  const height = viewport.height;
  return `0 0 ${formatNumber(width)} ${formatNumber(height)}`;
}

function vectorViewport(item) {
  const bounds = item && item.bounds || {};
  const width = Math.max(0, Number(bounds.width || 0));
  const height = Math.max(0, Number(bounds.height || 0));
  const stroke = paintedStrokeExtent(item);
  return {
    width: width > 0 ? width : stroke,
    height: height > 0 ? height : stroke,
    shiftX: width > 0 ? 0 : stroke / 2,
    shiftY: height > 0 ? 0 : stroke / 2,
  };
}

function vectorPathElements(item, depth = 0) {
  const vector = item && item.vectorGeometry || {};
  const paths = (vector.paths || [])
    .map((path) => vectorPathElement(item, path, depth))
    .filter(Boolean)
    .join('\n');
  const defs = vectorMarkerDefs(item, depth);
  return [defs, paths].filter(Boolean).join('\n');
}

function vectorPathElement(item, path, depth) {
  const d = svgPathData(path, item);
  if (!d) return '';
  const visualStyle = item && item.visualStyle || {};
  const attrs = {
    d,
    fill: path.closed ? (visualStyle.fillColor || 'none') : 'none',
    stroke: visualStyle.strokeColor || 'none',
  };
  if (!path.closed && visualStyle.fillColor) attrs[HTML_DATA_ID_ATTRIBUTES.FILL_COLOR] = visualStyle.fillColor;
  const pointTypes = pointTypesAttr(path.points);
  if (pointTypes) attrs[HTML_DATA_ID_ATTRIBUTES.POINT_TYPES] = pointTypes;
  const vectorPoints = vectorPointsAttr(path, item);
  if (vectorPoints) attrs[HTML_DATA_ID_ATTRIBUTES.VECTOR_POINTS] = vectorPoints;
  const strokeWeight = Number(visualStyle.strokeWeight);
  if (Number.isFinite(strokeWeight) && strokeWeight > 0) attrs['stroke-width'] = formatNumber(strokeWeight);
  const fillOpacity = opacityValue(visualStyle.fillOpacity);
  if (fillOpacity != null && attrs.fill !== 'none') attrs['fill-opacity'] = fillOpacity;
  if (fillOpacity != null && attrs.fill === 'none' && visualStyle.fillColor) attrs[HTML_DATA_ID_ATTRIBUTES.FILL_OPACITY] = fillOpacity;
  const strokeOpacity = opacityValue(visualStyle.strokeOpacity);
  if (strokeOpacity != null && attrs.stroke !== 'none') attrs['stroke-opacity'] = strokeOpacity;
  const lineCap = strokeLineCap(visualStyle.strokeLineCap);
  if (lineCap) attrs['stroke-linecap'] = lineCap;
  const lineJoin = strokeLineJoin(visualStyle.strokeLineJoin);
  if (lineJoin) attrs['stroke-linejoin'] = lineJoin;
  const miterLimit = positiveNumber(visualStyle.strokeMiterLimit);
  if (miterLimit != null) attrs['stroke-miterlimit'] = formatNumber(miterLimit);
  const strokeStyle = stringValue(visualStyle.strokeStyle);
  if (strokeStyle) attrs[HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE] = strokeStyle;
  const dash = strokeDashArray(strokeStyle, strokeWeight);
  if (dash) attrs['stroke-dasharray'] = dash;
  if (dash && /dot|点/i.test(strokeStyle)) attrs['stroke-linecap'] = 'round';
  const startMarker = visualStyle.lineStartMarker;
  const endMarker = visualStyle.lineEndMarker;
  const startRawName = markerRawName(startMarker);
  const endRawName = markerRawName(endMarker);
  if (startRawName) attrs[HTML_DATA_ID_ATTRIBUTES.LINE_START_MARKER_RAW_NAME] = startRawName;
  if (endRawName) attrs[HTML_DATA_ID_ATTRIBUTES.LINE_END_MARKER_RAW_NAME] = endRawName;
  if (markerType(startMarker)) attrs['marker-start'] = `url(#${markerId(item, 'start')})`;
  if (markerType(endMarker)) attrs['marker-end'] = `url(#${markerId(item, 'end')})`;
  return `${indent(depth)}<path ${attrsToHtml(orderVectorPathAttrs(attrs))}></path>`;
}

function vectorMarkerDefs(item, depth = 0) {
  const start = markerType(item && item.visualStyle && item.visualStyle.lineStartMarker);
  const end = markerType(item && item.visualStyle && item.visualStyle.lineEndMarker);
  if (!start && !end) return '';
  const children = [
    start ? markerDef(item, 'start', start, depth + 2) : null,
    end ? markerDef(item, 'end', end, depth + 2) : null,
  ].filter(Boolean).join('\n');
  return `${indent(depth)}<defs>\n${children}\n${indent(depth)}</defs>`;
}

function markerDef(item, side, type, depth) {
  const id = markerId(item, side);
  const color = item && item.visualStyle && item.visualStyle.strokeColor || 'currentColor';
  const common = {
    id,
    viewBox: '0 0 10 10',
    refX: markerRefX(type, side),
    refY: '5',
    markerWidth: '3',
    markerHeight: '3',
    orient: 'auto-start-reverse',
    markerUnits: 'strokeWidth',
  };
  const body = markerBody(type, color, depth + 2);
  return `${indent(depth)}<marker ${attrsToHtml(orderMarkerAttrs(common))}>\n${body}\n${indent(depth)}</marker>`;
}

function markerBody(type, color, depth) {
  if (type === 'circle') return `${indent(depth)}<circle cx="5" cy="5" r="3" fill="${attr(color)}"></circle>`;
  if (type === 'square') return `${indent(depth)}<rect x="2" y="2" width="6" height="6" fill="${attr(color)}"></rect>`;
  if (type === 'diamond') return `${indent(depth)}<path fill="${attr(color)}" d="M5 0 L10 5 L5 10 L0 5 Z"></path>`;
  if (type === 'bar') return `${indent(depth)}<path fill="none" stroke="${attr(color)}" stroke-width="2" d="M5 0 L5 10"></path>`;
  return `${indent(depth)}<path fill="${attr(color)}" d="M0 0 L10 5 L0 10 Z"></path>`;
}

function markerRefX(type, side) {
  if (type === 'circle' || type === 'square' || type === 'diamond' || type === 'bar') return '5';
  return side === 'start' ? '0' : '10';
}

function markerId(item, side) {
  return `${safeId(item && item.id || 'vector')}-marker-${side}`;
}

function safeId(value) {
  return String(value || 'vector').replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-');
}

function svgPathData(path, item) {
  const points = path && Array.isArray(path.points) ? path.points : [];
  if (points.length < 2) return '';
  const bounds = item && item.bounds || {};
  const viewport = vectorViewport(item);
  const absolute = pathUsesAbsoluteCoordinates(points, bounds);
  let d = `M${svgPoint(points[0].anchor, bounds, absolute, viewport)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (isCurveSegment(previous, current)) {
      d += ` C${svgPoint(previous.rightDirection || previous.anchor, bounds, absolute, viewport)} ${svgPoint(current.leftDirection || current.anchor, bounds, absolute, viewport)} ${svgPoint(current.anchor, bounds, absolute, viewport)}`;
    } else {
      d += ` L${svgPoint(current.anchor, bounds, absolute, viewport)}`;
    }
  }
  if (path.closed) d += ' Z';
  return d;
}

function isCurveSegment(previous, current) {
  return !samePoint(previous.rightDirection, previous.anchor) || !samePoint(current.leftDirection, current.anchor);
}

function samePoint(a = {}, b = {}) {
  return Math.abs(Number(a.x || 0) - Number(b.x || 0)) < 0.001 && Math.abs(Number(a.y || 0) - Number(b.y || 0)) < 0.001;
}

function svgPoint(point = {}, bounds = {}, absolute, viewport = {}) {
  const x = Number(point.x || 0) - (absolute ? Number(bounds.x || 0) : 0) + Number(viewport.shiftX || 0);
  const y = Number(point.y || 0) - (absolute ? Number(bounds.y || 0) : 0) + Number(viewport.shiftY || 0);
  return `${formatNumber(x)} ${formatNumber(y)}`;
}

function vectorPointsAttr(path, item) {
  const points = path && Array.isArray(path.points) ? path.points : [];
  if (!points.length) return '';
  const bounds = item && item.bounds || {};
  const viewport = vectorViewport(item);
  const absolute = pathUsesAbsoluteCoordinates(points, bounds);
  return JSON.stringify(points.map((point) => ({
    anchor: vectorPointForAttr(point.anchor, bounds, absolute, viewport),
    leftDirection: vectorPointForAttr(point.leftDirection || point.anchor, bounds, absolute, viewport),
    rightDirection: vectorPointForAttr(point.rightDirection || point.anchor, bounds, absolute, viewport),
    pointType: pointTypeToken(point && point.pointType) || null,
  })));
}

function vectorPointForAttr(point = {}, bounds = {}, absolute, viewport = {}) {
  return {
    x: numberForAttr(Number(point.x || 0) - (absolute ? Number(bounds.x || 0) : 0) + Number(viewport.shiftX || 0)),
    y: numberForAttr(Number(point.y || 0) - (absolute ? Number(bounds.y || 0) : 0) + Number(viewport.shiftY || 0)),
  };
}

function numberForAttr(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 1000) / 1000;
}

function pathUsesAbsoluteCoordinates(points, bounds = {}) {
  const x = Number(bounds.x || 0);
  const y = Number(bounds.y || 0);
  const width = Math.max(0, Number(bounds.width || 0));
  const height = Math.max(0, Number(bounds.height || 0));
  const anchors = points.map((point) => point.anchor || {});
  return anchors.every((point) => {
    const px = Number(point.x || 0);
    const py = Number(point.y || 0);
    return px >= x - 0.5 && px <= x + width + 0.5 && py >= y - 0.5 && py <= y + height + 0.5;
  });
}

function opacityValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number >= 100) return null;
  return formatNumber(number / 100);
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function strokeLineCap(value) {
  const token = String(value || '').toLowerCase();
  return ['butt', 'round', 'square'].includes(token) ? token : '';
}

function strokeLineJoin(value) {
  const token = String(value || '').toLowerCase();
  return ['miter', 'round', 'bevel'].includes(token) ? token : '';
}

function markerType(marker) {
  const token = typeof marker === 'string' ? marker : marker && marker.type;
  const normalized = String(token || '').toLowerCase();
  return ['arrow', 'circle', 'square', 'diamond', 'bar', 'custom'].includes(normalized) ? normalized : '';
}

function markerRawName(marker) {
  if (!marker || typeof marker !== 'object') return '';
  return stringValue(marker.rawName);
}

function stringValue(value) {
  const text = String(value == null ? '' : value).trim();
  return text;
}

function strokeDashArray(styleName, strokeWeight) {
  const style = String(styleName || '').toLowerCase();
  const weight = Number.isFinite(Number(strokeWeight)) && Number(strokeWeight) > 0 ? Number(strokeWeight) : 1;
  if (style.includes('dash') || style.includes('虚')) return `${formatNumber(weight * 3)} ${formatNumber(weight * 2)}`;
  if (style.includes('dot') || style.includes('点')) return `0 ${formatNumber(weight * 2)}`;
  return '';
}

function pointTypesAttr(points) {
  const values = (Array.isArray(points) ? points : [])
    .map((point) => pointTypeToken(point && point.pointType));
  if (!values.length || values.every((value) => value === '')) return '';
  return values.map((value) => value || 'PLAIN').join(' ');
}

function pointTypeToken(value) {
  const token = String(value || '').trim().toUpperCase();
  if (['CORNER', 'SMOOTH', 'SYMMETRICAL', 'PLAIN'].includes(token)) return token;
  return '';
}

function paintedStrokeExtent(item) {
  const strokeWeight = Number(item && item.visualStyle && item.visualStyle.strokeWeight);
  return Number.isFinite(strokeWeight) && strokeWeight > 0 ? strokeWeight : 1;
}

function orderVectorPathAttrs(attrs) {
  const out = {};
  for (const key of ['d', HTML_DATA_ID_ATTRIBUTES.POINT_TYPES, HTML_DATA_ID_ATTRIBUTES.VECTOR_POINTS, 'fill', HTML_DATA_ID_ATTRIBUTES.FILL_COLOR, 'fill-opacity', HTML_DATA_ID_ATTRIBUTES.FILL_OPACITY, 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE, 'stroke-dasharray', HTML_DATA_ID_ATTRIBUTES.LINE_START_MARKER_RAW_NAME, HTML_DATA_ID_ATTRIBUTES.LINE_END_MARKER_RAW_NAME, 'marker-start', 'marker-end']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  return out;
}

function orderMarkerAttrs(attrs) {
  const out = {};
  for (const key of ['id', 'viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'markerUnits']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  return out;
}

function attrsToHtml(attrs) {
  return Object.entries(attrs || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => value === true ? key : `${key}="${attr(value)}"`)
    .join(' ');
}

function attr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

function indent(spaces) {
  return ' '.repeat(spaces);
}

module.exports = {
  hasVectorPaths,
  isDegenerateInvisibleVector,
  vectorPathElements,
  vectorViewBox,
};
