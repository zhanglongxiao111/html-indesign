const { mergeAttributes, attrsToHtml, isVoidTag, escapeHtml } = require('./author-attribute-writer');

const SAFE_TAGS = new Set([
  'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'figure', 'figcaption', 'img', 'object', 'embed', 'picture', 'source',
  'svg', 'canvas', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'strong', 'em', 'small', 'sup', 'sub',
]);

const SAFE_INLINE_TAGS = new Set(['span', 'strong', 'b', 'em', 'i', 'mark', 'small', 'sup', 'sub']);
const PDF_WRAPPER_CLASSES = new Set(['drawing-frame', 'grid-frame', 'figure-frame', 'asset-frame']);
const PDF_OBJECT_OMITTED_CLASSES = new Set(['drawing-frame', 'grid-frame', 'figure-frame', 'asset-frame', 'grid-item']);

function pageItemsToAuthorHtml(page, options = {}) {
  const tree = buildAuthorTree(page);
  return tree.map((node) => renderNode(node, options, 0)).join('\n');
}

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

function renderNode(node, options, depth) {
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const tag = safeTag(sourceNode.tagName || item.tagName || tagForRole(item.role));
  if (isPdfObjectItem(item, sourceNode, tag)) {
    return renderPdfObjectNode(node, options, depth);
  }
  const attrs = attrsForItem(item, sourceNode, options);
  const open = `<${tag}${attrs ? ` ${attrs}` : ''}>`;
  if (isVoidTag(tag)) return `${indent(depth)}${open}`;
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const own = ownContent(item, depth);
  if (children) {
    return `${indent(depth)}${open}\n${own ? `${indent(depth + 2)}${own}\n` : ''}${children}\n${indent(depth)}</${tag}>`;
  }
  return `${indent(depth)}${open}${own}</${tag}>`;
}

function attrsForItem(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item));
  rewriteResourceAttrs(attrs, options);
  if (sourceNode.id) {
    attrs.id = sourceNode.id;
  } else if (!item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs.id = item.id;
  }
  const classes = new Set(sourceNode.classList || []);
  if (options.mode === 'observation' && item.role === 'text') classes.add('observed-text');
  if (options.mode === 'observation') classes.add('id-object');
  if (!classes.size && !hasSourceNode(sourceNode)) classes.add(classForRole(item.role));
  if (item.layout && item.layout.cssVars && classes.has('grid-item')) {
    attrs.style = Object.entries(item.layout.cssVars).map(([name, value]) => `${name}:${value}`).join(';');
  } else if (sourceNode.attributes && sourceNode.attributes.style) {
    attrs.style = sourceNode.attributes.style;
  }
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text' && !item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs['data-id-object'] = '';
  }
  if (isUsefulSemantic(item.semantic)) attrs['data-id-semantic'] = item.semantic;
  return attrsToHtml(orderAttrs(attrs));
}

function objectAttrsForPdf(item, sourceNode, options) {
  const objectSource = Object.assign({}, sourceNode, {
    classList: (sourceNode.classList || []).filter((name) => !PDF_OBJECT_OMITTED_CLASSES.has(String(name || '').trim())),
  });
  if (!objectSource.classList.length) objectSource.classList = ['pdf-source'];
  return attrsForItem(item, objectSource, options);
}

function wrapperAttrsForPdf(item, sourceNode) {
  const classes = (sourceNode.classList || [])
    .filter((name) => PDF_WRAPPER_CLASSES.has(String(name || '').trim()) || String(name || '').trim() === 'grid-item');
  const attrs = {
    class: classes.length ? classes.join(' ') : 'drawing-frame grid-item grid-frame',
    'data-id-ignore': '',
  };
  if (item.layout && item.layout.cssVars) {
    attrs.style = Object.entries(item.layout.cssVars).map(([name, value]) => `${name}:${value}`).join(';');
  }
  return attrsToHtml(orderAttrs(attrs));
}

function previewAttrsForPdf(item, sourceNode, options = {}) {
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item));
  rewriteResourceAttrs(attrs, options);
  const pdfPath = attrs.data || attrs.src || (item.asset && item.asset.path) || '';
  const page = attrs['data-id-page'] || attrs['data-id-pdf-page'] || '1';
  if (sourceNode.previewNode) {
    const previewAttrs = mergeAttributes(sourceNode.previewNode.attributes);
    rewriteResourceAttrs(previewAttrs, options);
    const previewClasses = new Set(sourceNode.previewNode.classList || []);
    if (previewClasses.size) previewAttrs.class = Array.from(previewClasses).join(' ');
    if (!previewAttrs.src) previewAttrs.src = pdfPreviewPath(pdfPath, page);
    if (!previewAttrs.alt) previewAttrs.alt = attrs.alt || `${fileStem(pdfPath)} preview`;
    if (!hasDataIdIgnore(previewAttrs)) previewAttrs['data-id-ignore'] = '';
    return attrsToHtml(orderAttrs(previewAttrs));
  }
  const preview = pdfPreviewPath(pdfPath, page);
  if (!preview) return '';
  return attrsToHtml(orderAttrs({
    class: 'pdf-preview',
    src: preview,
    alt: attrs.alt || `${fileStem(pdfPath)} preview`,
    'data-id-ignore': '',
  }));
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

function renderPdfObjectNode(node, options, depth) {
  if (hasSourcePdfWrapper(node.item)) {
    return renderPdfObjectContents(node, options, depth);
  }
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const wrapperAttrs = wrapperAttrsForPdf(item, sourceNode);
  const body = renderPdfObjectContents(node, options, depth + 2);
  return `${indent(depth)}<div ${wrapperAttrs}>\n${body}\n${indent(depth)}</div>`;
}

function renderPdfObjectContents(node, options, depth) {
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const previewAttrs = previewAttrsForPdf(item, sourceNode, options);
  const objectAttrs = objectAttrsForPdf(item, sourceNode, options);
  const children = node.children.map((child) => renderNode(child, options, depth)).join('\n');
  return [
    previewAttrs ? `${indent(depth)}<img ${previewAttrs}>` : null,
    `${indent(depth)}<object ${objectAttrs}></object>`,
    children || null,
  ].filter(Boolean).join('\n');
}

function rewriteResourceAttrs(attrs, options = {}) {
  if (!attrs || !options.assetPathMap) return attrs;
  for (const name of ['src', 'data', 'href', 'data-id-source-csv', 'data-id-source-xml']) {
    if (!attrs[name]) continue;
    const rewritten = lookupAssetPath(options.assetPathMap, attrs[name]);
    if (rewritten) attrs[name] = rewritten;
  }
  return attrs;
}

function lookupAssetPath(map, value) {
  if (!map || !value) return '';
  const key = normalizePathKey(value);
  if (typeof map.get === 'function') return map.get(key) || map.get(String(value)) || '';
  return map[key] || map[String(value)] || '';
}

function normalizePathKey(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function hasSourcePdfWrapper(item) {
  return (item.sourceAncestorNodes || []).some((node) => {
    const attrs = node.attributes || {};
    const classes = new Set(node.classList || []);
    return hasDataIdIgnore(attrs) || Array.from(classes).some((name) => PDF_WRAPPER_CLASSES.has(String(name || '').trim()));
  });
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

function ownContent(item, depth) {
  if (item.role === 'table' && item.table) return `\n${tableContent(item.table, depth + 2)}\n${indent(depth)}`;
  if (item.authorTextCompanion && item.authorTextCompanion.content) {
    return plainTextContent(item.authorTextCompanion.content.text || '');
  }
  if (item.content && typeof item.content.sourceHtml === 'string' && item.content.sourceHtml !== '') {
    return item.content.sourceHtml;
  }
  const rich = richTextContent(item);
  if (rich != null) return rich;
  return escapeHtml((item.content && item.content.text) || '').replace(/\r\n|\r|\n/g, '<br>');
}

function tableContent(table, depth) {
  const rows = table.rows || [];
  const headRows = rows.filter((row) => row.header || (row.cells || []).some((cell) => cell.header));
  const bodyRows = rows.filter((row) => !headRows.includes(row));
  const sections = [];
  if (headRows.length) sections.push(tableSection('thead', headRows, depth));
  if (bodyRows.length) sections.push(tableSection('tbody', bodyRows, depth));
  return sections.join('\n');
}

function tableSection(tag, rows, depth) {
  const rowHtml = rows.map((row) => tableRow(row, depth + 2)).join('\n');
  return `${indent(depth)}<${tag}>\n${rowHtml}\n${indent(depth)}</${tag}>`;
}

function tableRow(row, depth) {
  const cells = (row.cells || []).map((cell) => tableCell(cell, depth + 2)).join('\n');
  return `${indent(depth)}<tr>\n${cells}\n${indent(depth)}</tr>`;
}

function tableCell(cell, depth) {
  const tag = cell.header ? 'th' : 'td';
  const attrs = {};
  if (cell.paragraphStyle) attrs['data-id-paragraph-style'] = cell.paragraphStyle;
  const attrHtml = attrsToHtml(orderAttrs(attrs));
  return `${indent(depth)}<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${escapeHtml(cell.text || '')}</${tag}>`;
}

function richTextContent(item) {
  const content = item.content || {};
  const text = String(content.text == null ? '' : content.text);
  const runs = Array.isArray(content.runs) ? content.runs.filter((run) => run && run.text != null && String(run.text) !== '') : [];
  if (!text || !runs.some((run) => hasRichRunMarkup(run))) return null;
  let cursor = 0;
  let html = '';
  for (const run of runs) {
    const runText = String(run.text);
    const index = text.indexOf(runText, cursor);
    if (index < cursor) return null;
    html += plainTextContent(text.slice(cursor, index));
    html += renderInlineRun(run);
    cursor = index + runText.length;
  }
  html += plainTextContent(text.slice(cursor));
  return html;
}

function renderInlineRun(run) {
  if (!hasRichRunMarkup(run)) return plainTextContent(run.text);
  const tag = safeInlineTag(run.tagName);
  const attrs = mergeAttributes(run.attributes);
  if (isUsefulCharacterStyle(run.characterStyle) && !attrs['data-id-character-style']) {
    attrs['data-id-character-style'] = run.characterStyle;
  }
  const classes = new Set(run.classList || []);
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  const attrHtml = attrsToHtml(orderInlineAttrs(attrs));
  return `<${tag}${attrHtml ? ` ${attrHtml}` : ''}>${plainTextContent(run.text)}</${tag}>`;
}

function hasRichRunMarkup(run) {
  if (isUsefulCharacterStyle(run.characterStyle)) return true;
  if ((run.classList || []).length) return true;
  const attrs = mergeAttributes(run.attributes);
  if (Object.keys(attrs).some((name) => name !== 'id')) return true;
  const tag = safeInlineTag(run.tagName);
  return tag !== 'span';
}

function plainTextContent(value) {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

function orderInlineAttrs(attrs) {
  const out = {};
  for (const key of ['class', 'title', 'role']) {
    if (Object.prototype.hasOwnProperty.call(attrs, key)) out[key] = attrs[key];
  }
  for (const key of Object.keys(attrs).sort()) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = attrs[key];
  }
  return out;
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
  if (isGeneratedLabel(item)) return true;
  const id = String(item.id || '');
  if (/-border-(top|right|bottom|left)$/i.test(id)) return true;
  if (item.semantic === 'unknown' && /-background$/i.test(id)) return true;
  return false;
}

function isGeneratedLabel(item) {
  return (item.labels || []).some((label) => label && (label.generated === true || label.kind === 'generated'));
}

function isPdfObjectItem(item, sourceNode, tag) {
  if (tag !== 'object' && tag !== 'embed') return false;
  const attrs = sourceNode.attributes || {};
  const data = attrs.data || attrs.src || (item.asset && item.asset.path) || '';
  return String(attrs.type || '').toLowerCase() === 'application/pdf' || /\.pdf(?:[?#].*)?$/i.test(String(data));
}

function pdfPreviewPath(pdfPath, page) {
  const value = String(pdfPath || '');
  if (!/\.pdf(?:[?#].*)?$/i.test(value)) return '';
  return value.replace(/\.pdf(?:[?#].*)?$/i, `-page${page || 1}.png`);
}

function fileStem(filePath) {
  const name = String(filePath || 'pdf').split(/[\\/]/).pop() || 'pdf';
  return name.replace(/\.[^.]+$/, '') || 'pdf';
}

function safeInlineTag(value) {
  const tag = String(value || '').toLowerCase();
  return SAFE_INLINE_TAGS.has(tag) ? tag : 'span';
}

function hasSourceNode(sourceNode) {
  return Boolean(sourceNode && sourceNode.tagName);
}

function isUsefulCharacterStyle(value) {
  const name = String(value || '').trim();
  return Boolean(name && name !== '[无]' && !/^自动字符-/i.test(name));
}

function isUsefulSemantic(value) {
  const semantic = String(value || '').trim();
  return Boolean(semantic && semantic !== 'unknown');
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

function hasDataIdIgnore(attrs) {
  return Object.prototype.hasOwnProperty.call(attrs, 'data-id-ignore');
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
