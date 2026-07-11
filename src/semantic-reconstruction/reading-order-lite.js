const {
  pageLevelItems,
  readingOrderTuple,
  compareReadingOrderTuples,
} = require('./reading-order');
const { isTrustedSourceEntity } = require('./trusted-source-preservation');

function applyReadingOrderLite(model) {
  const applied = [];
  const skipped = [];

  for (const page of model.pages || []) {
    const entries = pageLevelItems(page)
      .map((item) => {
        const originalIndex = (page.items || []).indexOf(item);
        return {
          item,
          tuple: readingOrderTuple(page, item, originalIndex),
        };
      })
      .sort((left, right) => compareReadingOrderTuples(left.tuple, right.tuple));
    const occupiedOrders = new Set(entries
      .filter(({ item }) => protectedReason(item))
      .map(({ item, tuple }) => explicitOrder(item) == null ? tuple.originalIndex + 1 : explicitOrder(item))
      .filter((order) => order != null));
    let nextOrder = 1;

    for (const entry of entries) {
      const { item, tuple } = entry;
      const reason = protectedReason(item);
      if (reason) {
        skipped.push(skippedItem(page, item, reason));
        continue;
      }
      while (occupiedOrders.has(nextOrder)) nextOrder += 1;
      const targetOrder = nextOrder;
      occupiedOrders.add(targetOrder);
      nextOrder += 1;
      const beforeOrder = explicitOrder(item);
      if (beforeOrder === targetOrder) {
        skipped.push(skippedItem(page, item, 'order-already-stable'));
        continue;
      }
      item.structure = {
        ...(item.structure || {}),
        order: targetOrder,
      };
      applied.push({
        pageId: page.id || null,
        itemId: item.id || null,
        beforeOrder,
        order: targetOrder,
        evidence: {
          bounded: tuple.bounded,
          y: tuple.y,
          x: tuple.x,
          originalIndex: tuple.originalIndex,
        },
      });
    }
  }

  return {
    name: 'reading-order-lite',
    version: 1,
    status: 'completed',
    source: 'observed-model',
    summary: {
      pages: (model.pages || []).length,
      candidates: applied.length + skipped.length,
      applied: applied.length,
      skipped: skipped.length,
    },
    applied,
    skipped,
  };
}

function protectedReason(item) {
  if (isTrustedSourceEntity(item)) return 'trusted-source-protected';
  if (item && item.parentPageItem === true) return 'parent-page-furniture-protected';
  return null;
}

function explicitOrder(item) {
  const order = item && item.structure && Number(item.structure.order);
  return Number.isFinite(order) ? order : null;
}

function skippedItem(page, item, reason) {
  return {
    pageId: page && page.id || null,
    itemId: item && item.id || null,
    reason,
  };
}

module.exports = {
  applyReadingOrderLite,
};
