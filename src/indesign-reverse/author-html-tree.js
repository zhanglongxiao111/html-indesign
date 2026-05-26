const { mergeAttributes, attrsToHtml, isVoidTag, escapeHtml } = require('./author-attribute-writer');

const SAFE_TAGS = new Set([
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figure', 'figcaption', 'img', 'object', 'embed', 'picture', 'source',
  'svg', 'canvas', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'strong', 'em', 'small', 'sup', 'sub',
]);

function pageItemsToAuthorHtml(page, options = {}) {
  const tree = buildAuthorTree(page);
  return tree.map((node) => renderNode(node, options, 0)).join('\n');
}

function buildAuthorTree(page) {
  const rootId = page.id;
  const nodes = new Map();
  const roots = [];
  for (const item of sortedItems(page.items || [])) {
    nodes.set(item.id, { item, children: [] });
  }
  for (const node of nodes.values()) {
    const parentId = node.item.structure && node.item.structure.parentId;
    if (parentId && parentId !== rootId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of nodes.values()) node.children.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
  return roots.sort((a, b) => structureOrder(a.item) - structureOrder(b.item));
}

function renderNode(node, options, depth) {
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const tag = safeTag(sourceNode.tagName || item.tagName || tagForRole(item.role));
  const attrs = attrsForItem(item, sourceNode, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  if (isVoidTag(tag)) return `${indent(depth)}${open}`;
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const own = ownContent(item);
  if (children) {
    return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
  }
  return `${indent(depth)}${open}${own}</${tag}>`;
}

function attrsForItem(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item));
  attrs.id = sourceNode.id || item.id;
  const classes = new Set(sourceNode.classList || []);
  if (options.mode === 'observation' && item.role === 'text') classes.add('observed-text');
  if (!classes.size || options.mode === 'observation') classes.add('id-object');
  if (!classes.size) classes.add(classForRole(item.role));
  if (item.layout && item.layout.cssVars) {
    attrs.style = Object.entries(item.layout.cssVars).map(([name, value]) => `${name}:${value}`).join(';');
  }
  attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text') attrs['data-id-object'] = '';
  if (item.semantic) attrs['data-id-semantic'] = item.semantic;
  return attrsToHtml(orderAttrs(attrs));
}

function assetAttributes(item) {
  const nodeAttrs = (item.sourceNode && item.sourceNode.attributes) || {};
  const asset = item.sourceAsset || item.asset || {};
  const out = {};
  const tag = item.sourceNode && String(item.sourceNode.tagName || '').toLowerCase();
  if (tag === 'img' && !nodeAttrs.src && asset.path) out.src = asset.path;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.data && asset.path) out.data = asset.path;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.type && asset.graphicType === 'pdf') out.type = 'application/pdf';
  return out;
}

function ownContent(item) {
  if (item.role === 'table' && item.table) return tableContent(item.table);
  return escapeHtml((item.content && item.content.text) || '').replace(/\r\n|\r|\n/g, '<br>');
}

function tableContent(table) {
  return (table.rows || []).map((row) => `<tr>${(row.cells || []).map((cell) => {
    const tag = cell.header ? 'th' : 'td';
    return `<${tag}>${escapeHtml(cell.text || '')}</${tag}>`;
  }).join('')}</tr>`).join('');
}

function orderAttrs(attrs) {
  const out = {};
  for (const key of ['id', 'class', 'src', 'data', 'type', 'alt', 'title', 'role', 'style']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
}

function sortedItems(items) {
  return items.slice().sort((a, b) => structureOrder(a) - structureOrder(b));
}

function structureOrder(item) {
  const order = item.structure && Number(item.structure.order);
  return Number.isFinite(order) ? order : 0;
}

function hasDataIdObject(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, 'data-id-object');
}

function safeTag(value) {
  const tag = String(value || '').toLowerCase();
  return SAFE_TAGS.has(tag) ? tag : 'div';
}

function tagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'table') return 'table';
  if (role === 'graphic') return 'figure';
  return 'div';
}

function classForRole(role) {
  return role === 'graphic' ? 'graphic-object' : 'id-object';
}

function indent(spaces) {
  return ' '.repeat(spaces);
}

module.exports = {
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
