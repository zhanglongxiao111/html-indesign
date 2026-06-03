const { isDegenerateInvisibleVector } = require('./vector-svg');

function buildAuthorTree(page) {
  const rootId = page.id;
  const nodes = new Map();
  const roots = [];
  const sourceIndexes = new Map((page.items || []).map((item, index) => [item && item.id, index]));
  const items = sortedItems(page.items || []);
  const itemIds = new Set(items.map((item) => item.id));
  const companionTextByBase = new Map();
  for (const item of items) {
    const baseId = companionTextBaseId(item, itemIds);
    if (baseId) companionTextByBase.set(baseId, item);
  }
  for (const item of items) {
    if (companionTextBaseId(item, itemIds)) continue;
    if (shouldOmitAuthorItem(item)) continue;
    const companion = companionTextByBase.get(item.id);
    nodes.set(item.id, {
      item: companion ? Object.assign({}, item, { authorTextCompanion: companion }) : item,
      children: [],
      sourceIndex: sourceIndexes.get(item.id),
    });
  }
  const parentOverrides = attachSourceAncestorNodes(nodes, rootId);
  for (const node of nodes.values()) {
    const parentId = parentOverrides.get(node.item.id) || (node.item.structure && node.item.structure.parentId);
    if (parentId && parentId !== rootId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of nodes.values()) node.children.sort((a, b) => nodeOrder(a) - nodeOrder(b));
  return roots.sort((a, b) => nodeOrder(a) - nodeOrder(b));
}

function attachSourceAncestorNodes(nodes, rootId) {
  const parentOverrides = new Map();
  for (const node of Array.from(nodes.values())) {
    const chain = sourceAncestorChain(node.item, nodes);
    if (!chain.length) continue;
    let parentId = node.item.structure && node.item.structure.parentId || rootId;
    for (const ancestor of chain) {
      const key = sourceAncestorKey(ancestor);
      ensureVirtualAncestorNode(nodes, key, ancestor, node.item, node.sourceIndex);
      if (!parentOverrides.has(key)) parentOverrides.set(key, parentId);
      parentId = key;
    }
    parentOverrides.set(node.item.id, parentId);
  }
  return parentOverrides;
}

function sourceAncestorChain(item, nodes) {
  return (item.sourceAncestorNodes || [])
    .filter((ancestor) => ancestor && ancestor.tagName)
    .filter((ancestor) => !(ancestor.id && nodes.has(ancestor.id)));
}

function sourceAncestorKey(ancestor) {
  if (ancestor.id) return String(ancestor.id);
  if (ancestor.sourcePath) return `source:${ancestor.sourcePath}`;
  const classes = (ancestor.classList || []).join('.');
  return `source:${ancestor.tagName || 'div'}:${classes}:${JSON.stringify(ancestor.attributes || {})}`;
}

function ensureVirtualAncestorNode(nodes, key, ancestor, sourceItem, sourceIndex) {
  const existing = nodes.get(key);
  if (existing) {
    const existingOrder = structureOrder(existing.item, existing.sourceIndex);
    const sourceOrder = structureOrder(sourceItem, sourceIndex);
    if (sourceOrder < existingOrder) existing.item.structure.order = sourceOrder - 0.001;
    return;
  }
  nodes.set(key, {
    item: {
      id: key,
      role: 'container',
      virtual: true,
      semantic: null,
      tagName: ancestor.tagName,
      sourceNode: {
        tagName: ancestor.tagName,
        id: ancestor.id || null,
        classList: Array.isArray(ancestor.classList) ? ancestor.classList.slice() : [],
        attributes: { ...(ancestor.attributes || {}) },
      },
      structure: { parentId: null, order: structureOrder(sourceItem, sourceIndex) - 0.001 },
      content: { text: '' },
    },
    children: [],
    sourceIndex,
  });
}

function companionTextBaseId(item, itemIds) {
  if (!item || item.role !== 'text' || item.sourceNode) return '';
  const id = String(item.id || '');
  if (!/-text$/i.test(id)) return '';
  const baseId = id.replace(/-text$/i, '');
  return itemIds.has(baseId) ? baseId : '';
}

function shouldOmitAuthorItem(item) {
  if (!item) return true;
  if (isDegenerateInvisibleVector(item)) return true;
  if (isGeneratedLabel(item)) return true;
  const id = String(item.id || '');
  if (/-border-(top|right|bottom|left)$/i.test(id)) return true;
  if (item.semantic === 'unknown' && /-background$/i.test(id)) return true;
  return false;
}

function isGeneratedLabel(item) {
  return (item.labels || []).some((label) => label && (label.generated === true || label.kind === 'generated'));
}

function sortedItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => structureOrder(a.item, a.index) - structureOrder(b.item, b.index))
    .map((entry) => entry.item);
}

function nodeOrder(node) {
  return structureOrder(node.item, node.sourceIndex);
}

function structureOrder(item, sourceIndex) {
  const order = item.structure && Number(item.structure.order);
  if (Number.isFinite(order)) return order;
  return Number.isFinite(sourceIndex) ? sourceIndex + 1 : 0;
}

module.exports = {
  buildAuthorTree,
};
