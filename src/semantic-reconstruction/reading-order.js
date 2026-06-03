function normalizePageLevelReadingOrder(page) {
  const roots = pageLevelItems(page);
  const ordered = roots.slice().sort((a, b) => readingOrderKey(page, a) - readingOrderKey(page, b));
  ordered.forEach((item, index) => {
    if (!item.virtual && hasExplicitOrder(item)) return;
    item.structure = {
      ...(item.structure || {}),
      order: index + 1,
    };
  });
}

function pageLevelItems(page) {
  return (page.items || []).filter((item) => {
    if (!item) return false;
    const parentId = item.structure && item.structure.parentId;
    return !parentId || parentId === page.id;
  });
}

function readingOrderKey(page, item) {
  if (hasBounds(item)) return boundsKey(item.bounds);
  const childBounds = (page.items || [])
    .filter((child) => child && child.structure && child.structure.parentId === item.id)
    .filter(hasBounds)
    .map((child) => child.bounds);
  if (childBounds.length) return boundsKey(unionBounds(childBounds));
  const index = (page.items || []).indexOf(item);
  return 1000000000000 + (index >= 0 ? index : 0);
}

function boundsKey(bounds) {
  return Number(bounds.y) * 1000000 + Number(bounds.x) * 1000;
}

function unionBounds(boundsList) {
  const left = Math.min(...boundsList.map((bounds) => Number(bounds.x)));
  const top = Math.min(...boundsList.map((bounds) => Number(bounds.y)));
  const right = Math.max(...boundsList.map((bounds) => Number(bounds.x) + Number(bounds.width)));
  const bottom = Math.max(...boundsList.map((bounds) => Number(bounds.y) + Number(bounds.height)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function hasExplicitOrder(item) {
  const order = item && item.structure && Number(item.structure.order);
  return Number.isFinite(order);
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
  normalizePageLevelReadingOrder,
};
