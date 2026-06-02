const { isDegenerateInvisibleVector } = require('./vector-svg');

function buildAuthorTree(page) {
  const rootId = page.id;
  const nodes = new Map();
  const roots = [];
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
    nodes.set(item.id, { item: companion ? Object.assign({}, item, { authorTextCompanion: companion }) : item, children: [] });
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
  for (const node of nodes.values()) node.children.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
  return roots.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
}

function attachSourceAncestorNodes(nodes, rootId) {
  const parentOverrides = new Map();
  for (const node of Array.from(nodes.values())) {
    const chain = sourceAncestorChain(node.item, nodes);
    if (!chain.length) continue;
    let parentId = node.item.structure && node.item.structure.parentId || rootId;
    for (const ancestor of chain) {
      const key = sourceAncestorKey(ancestor);
      ensureVirtualAncestorNode(nodes, key, ancestor, node.item);
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

function ensureVirtualAncestorNode(nodes, key, ancestor, sourceItem) {
  const existing = nodes.get(key);
  if (existing) {
    const existingOrder = structureOrder(existing.item);
    const sourceOrder = structureOrder(sourceItem);
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
      structure: { parentId: null, order: structureOrder(sourceItem) - 0.001 },
      content: { text: '' },
    },
    children: [],
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
  return items.slice().sort((a, b) => structureOrder(a) - structureOrder(b));
}

function structureOrder(item) {
  const order = item.structure && Number(item.structure.order);
  return Number.isFinite(order) ? order : 0;
}

module.exports = {
  buildAuthorTree,
};
