function readBounds(item = {}) {
  const raw = item.bounds || item;
  if (!raw || typeof raw !== 'object') return null;

  const x = firstNumber(raw.x, raw.left, raw.x0);
  const y = firstNumber(raw.y, raw.top, raw.y0);
  let width = numberOrNull(raw.width);
  let height = numberOrNull(raw.height);

  const right = firstNumber(raw.right, raw.x1);
  const bottom = firstNumber(raw.bottom, raw.y1);
  if (width == null && x != null && right != null) width = right - x;
  if (height == null && y != null && bottom != null) height = bottom - y;

  if (x == null || y == null || width == null || height == null) return null;
  if (width < 0 || height < 0) return null;

  return {
    x,
    y,
    width,
    height,
  };
}

function normalizeBounds(bounds, page) {
  if (!bounds || !validPageSize(page)) return null;
  return {
    x: round(bounds.x / page.width),
    y: round(bounds.y / page.height),
    width: round(bounds.width / page.width),
    height: round(bounds.height / page.height),
  };
}

function metrics(bounds) {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    right: bounds.x + bounds.width,
    bottom: bounds.y + bounds.height,
    centerX: bounds.x + bounds.width / 2,
    centerY: bounds.y + bounds.height / 2,
    area: bounds.width * bounds.height,
  };
}

function minEdgeDistance(a, b) {
  const horizontal = Math.max(0, Math.max(a.x - b.right, b.x - a.right));
  const vertical = Math.max(0, Math.max(a.y - b.bottom, b.y - a.bottom));
  if (horizontal === 0) return vertical;
  if (vertical === 0) return horizontal;
  return Math.sqrt(horizontal * horizontal + vertical * vertical);
}

function overlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  const area = x * y;
  const minArea = Math.min(a.area, b.area);
  return {
    area,
    ratio: minArea > 0 ? round(area / minArea) : 0,
  };
}

function containment(container, child, tolerance = 0) {
  if (!container || !child) return 0;
  const contains = (
    child.x >= container.x - tolerance
    && child.y >= container.y - tolerance
    && child.right <= container.right + tolerance
    && child.bottom <= container.bottom + tolerance
  );
  if (!contains) return 0;
  const childArea = Math.max(child.area, 1);
  const overlapArea = overlap(container, child).area;
  return round(overlapArea / childArea);
}

function validPageSize(page = {}) {
  return Number.isFinite(Number(page.width))
    && Number(page.width) > 0
    && Number.isFinite(Number(page.height))
    && Number(page.height) > 0;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = numberOrNull(value);
    if (number != null) return number;
  }
  return null;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value) {
  return Number(Number(value).toFixed(6));
}

module.exports = {
  readBounds,
  normalizeBounds,
  metrics,
  minEdgeDistance,
  overlap,
  containment,
  validPageSize,
  numberOrNull,
  round,
};
