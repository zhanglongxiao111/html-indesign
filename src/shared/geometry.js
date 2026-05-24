function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
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

function boundsToGeometricBounds(bounds) {
  return [
    bounds.y,
    bounds.x,
    bounds.y + bounds.height,
    bounds.x + bounds.width,
  ];
}

module.exports = {
  round,
  parseCssLength,
  parseStyleDeclarations,
  parsePhysicalSize,
  rectPxToMm,
  boundsToGeometricBounds,
};
