function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// presentation 模式（CSS px 即 InDesign pt）下作者声明的长度统一按这个精度舍入：与反向作者包写出的
// 精度（3 位小数）一致，作者写的长度经 HTML -> InDesign -> HTML 回来还是同一个数。浏览器排版量出来的
// 几何（getBoundingClientRect）本身按 1/64 px 量化，不走这里。
const PRESENTATION_LENGTH_DIGITS = 3;

function roundPresentationLength(value) {
  return round(value, PRESENTATION_LENGTH_DIGITS);
}

// 字号、行距（pt，presentation 下即 CSS px）的精度：与正向 cssLengthToPt 的 4 位小数一致，
// 1/3 px 一类的字号（8.5pt -> 11.3333px）往返不丢位。
const TYPE_SIZE_DIGITS = 4;

function roundTypeSize(value) {
  return round(value, TYPE_SIZE_DIGITS);
}

function parseCssLength(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  const match = text.match(/^([+-]?(?:\d+|\d*\.\d+))(mm|px|pt)?$/i);
  if (!match) return null;
  return {
    value: Number(match[1]),
    unit: (match[2] || 'px').toLowerCase(),
  };
}

function cssLengthToMm(length, pxToMm = 25.4 / 96) {
  if (!length) return null;
  if (length.unit === 'mm') return length.value;
  if (length.unit === 'pt') return length.value * 25.4 / 72;
  if (length.unit === 'px') return length.value * pxToMm;
  return null;
}

function cssLengthStringToMm(value, pxToMm = 25.4 / 96) {
  return cssLengthToMm(parseCssLength(value), pxToMm);
}

function cssLengthStringToMmOrZero(value, pxToMm = 25.4 / 96) {
  const mm = cssLengthStringToMm(value, pxToMm);
  return mm == null ? 0 : mm;
}

function cssLengthStringToPx(value) {
  const parsed = parseCssLength(value);
  if (!parsed) return null;
  if (parsed.unit === 'px') return parsed.value;
  if (parsed.unit === 'pt') return parsed.value * 96 / 72;
  if (parsed.unit === 'mm') return parsed.value * 96 / 25.4;
  return null;
}

function cssLengthStringToVisualMm(value) {
  const mm = cssLengthStringToMm(value);
  if (mm == null) return null;
  const nearest = Math.round(mm);
  if (Math.abs(mm - nearest) < 0.15) return nearest;
  return round(mm, 2);
}

function parseStyleDeclarations(styleText) {
  const out = {};
  String(styleText || '').split(';').forEach((part) => {
    const index = part.indexOf(':');
    if (index < 0) return;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}

function parsePhysicalSize(styleText, pxToMm = 25.4 / 96) {
  const style = parseStyleDeclarations(styleText);
  const width = cssLengthToMm(parseCssLength(style.width), pxToMm);
  const height = cssLengthToMm(parseCssLength(style.height), pxToMm);
  return {
    widthMm: width == null ? null : round(width),
    heightMm: height == null ? null : round(height),
  };
}

function rectPxToMm({ rectPx, pageRectPx, pageWidthMm, pageHeightMm }) {
  const mmPerPxX = pageWidthMm / pageRectPx.width;
  const mmPerPxY = pageHeightMm / pageRectPx.height;
  return {
    x: round((rectPx.x - pageRectPx.x) * mmPerPxX),
    y: round((rectPx.y - pageRectPx.y) * mmPerPxY),
    width: round(rectPx.width * mmPerPxX),
    height: round(rectPx.height * mmPerPxY),
  };
}

function boundsIntersectPage(bounds, pageSize) {
  const pageWidth = Number(pageSize && pageSize.width);
  const pageHeight = Number(pageSize && pageSize.height);
  if (!Number.isFinite(pageWidth) || !Number.isFinite(pageHeight) || pageWidth <= 0 || pageHeight <= 0) return true;
  const left = Number(bounds && bounds.x || 0);
  const top = Number(bounds && bounds.y || 0);
  const right = left + Math.max(0, Number(bounds && bounds.width || 0));
  const bottom = top + Math.max(0, Number(bounds && bounds.height || 0));
  return Math.max(left, 0) <= Math.min(right, pageWidth)
    && Math.max(top, 0) <= Math.min(bottom, pageHeight);
}

function boundsToGeometricBounds(bounds) {
  return [
    bounds.y,
    bounds.x,
    bounds.y + bounds.height,
    bounds.x + bounds.width,
  ];
}

// 正向构建给原生表格留的外框余量：表格所在文本框高 = 各行高之和 + 余量（presentation 模式下行多时按行数放大）。
// 反向写出据此从读回的外框高还原表格本身的高度。
function tableFrameSlack(rowCount, unitMode) {
  if (unitMode !== 'presentation') return 1;
  return Math.max(24, (Number(rowCount) || 0) * 4);
}

module.exports = {
  round,
  PRESENTATION_LENGTH_DIGITS,
  roundPresentationLength,
  TYPE_SIZE_DIGITS,
  roundTypeSize,
  tableFrameSlack,
  parseCssLength,
  cssLengthToMm,
  cssLengthStringToMm,
  cssLengthStringToMmOrZero,
  cssLengthStringToPx,
  cssLengthStringToVisualMm,
  parseStyleDeclarations,
  parsePhysicalSize,
  rectPxToMm,
  boundsIntersectPage,
  boundsToGeometricBounds,
};
