function pageLevelItems(page) {
  return (page.items || []).filter((item) => {
    if (!item) return false;
    const parentId = item.structure && item.structure.parentId;
    return !parentId || parentId === page.id;
  });
}

function readingOrderTuple(page, item, originalIndex) {
  const bounds = effectiveBounds(page, item);
  return {
    bounded: Boolean(bounds),
    y: bounds ? Number(bounds.y) : null,
    x: bounds ? Number(bounds.x) : null,
    originalIndex,
  };
}

function compareReadingOrderTuples(left, right) {
  if (left.bounded !== right.bounded) return left.bounded ? -1 : 1;
  if (left.bounded && left.y !== right.y) return left.y - right.y;
  if (left.bounded && left.x !== right.x) return left.x - right.x;
  return left.originalIndex - right.originalIndex;
}

function effectiveBounds(page, item) {
  if (hasBounds(item)) return normalizedBounds(item.bounds);
  const childBounds = (page.items || [])
    .filter((child) => child && child.structure && child.structure.parentId === item.id)
    .filter(hasBounds)
    .map((child) => normalizedBounds(child.bounds));
  return childBounds.length ? unionBounds(childBounds) : null;
}

function normalizedBounds(bounds) {
  return {
    x: Number(bounds.x),
    y: Number(bounds.y),
    width: Number(bounds.width),
    height: Number(bounds.height),
  };
}

function unionBounds(boundsList) {
  const left = Math.min(...boundsList.map((bounds) => bounds.x));
  const top = Math.min(...boundsList.map((bounds) => bounds.y));
  const right = Math.max(...boundsList.map((bounds) => bounds.x + bounds.width));
  const bottom = Math.max(...boundsList.map((bounds) => bounds.y + bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function hasBounds(item) {
  const bounds = item && item.bounds;
  return Boolean(bounds
    && Number.isFinite(Number(bounds.x))
    && Number.isFinite(Number(bounds.y))
    && Number.isFinite(Number(bounds.width))
    && Number.isFinite(Number(bounds.height)));
}

module.exports = {
  pageLevelItems,
  readingOrderTuple,
  compareReadingOrderTuples,
};
