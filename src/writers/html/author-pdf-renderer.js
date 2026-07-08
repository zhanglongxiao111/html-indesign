const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const {
  assetAttributes,
  assetPdfPageNumber,
  pdfPreviewPath,
  sanitizeRetiredAssetAttrs,
} = require('./author-asset-attrs');
const { attrsForItem, cssVarsStyle } = require('./author-node-attrs');
const { rewriteResourceAttrs } = require('./author-resource-paths');
const { authorInlineStyleForItem } = require('./author-style-attrs');
const {
  fileStem,
  hasDataIdIgnore,
  indent,
  orderAttrs,
  positiveIntegerOrNull,
} = require('./author-render-utils');

const PDF_WRAPPER_CLASSES = new Set(['drawing-frame', 'grid-frame', 'figure-frame', 'asset-frame']);
const PDF_OBJECT_OMITTED_CLASSES = new Set(['drawing-frame', 'grid-frame', 'figure-frame', 'asset-frame', 'grid-item']);

function renderPdfObjectNode(node, options, depth, renderNode) {
  if (hasSourcePdfWrapper(node.item)) {
    return renderPdfObjectContents(node, options, depth, renderNode);
  }
  const item = node.item;
  const sourceNode = item.sourceNode || {};
  const wrapperAttrs = wrapperAttrsForPdf(item, sourceNode);
  const body = renderPdfObjectContents(node, options, depth + 2, renderNode);
  return `${indent(depth)}<div ${wrapperAttrs}>\n${body}\n${indent(depth)}</div>`;
}

function renderPdfObjectContents(node, options, depth, renderNode) {
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

function isPdfObjectItem(item, sourceNode, tag) {
  if (tag !== 'object' && tag !== 'embed') return false;
  const attrs = sourceNode.attributes || {};
  const data = attrs.data || attrs.src || (item.asset && item.asset.path) || '';
  return String(attrs.type || '').toLowerCase() === 'application/pdf' || /\.pdf(?:[?#].*)?$/i.test(String(data));
}

function objectAttrsForPdf(item, sourceNode, options) {
  const objectSource = Object.assign({}, sourceNode, {
    tagName: 'object',
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
    [HTML_DATA_ID_ATTRIBUTES.IGNORE]: '',
  };
  const sourceStyle = item.layout && item.layout.cssVars ? cssVarsStyle(item.layout.cssVars) : '';
  const mergedStyle = authorInlineStyleForItem(item, sourceStyle);
  if (mergedStyle) attrs.style = mergedStyle;
  return attrsToHtml(orderAttrs(attrs));
}

function previewAttrsForPdf(item, sourceNode, options = {}) {
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item, 'object'));
  sanitizeRetiredAssetAttrs(attrs, item);
  rewriteResourceAttrs(attrs, options);
  const pdfPath = attrs.data || attrs.src || (item.asset && item.asset.path) || '';
  const page = positiveIntegerOrNull(attrs[HTML_DATA_ID_ATTRIBUTES.PDF_PAGE] ?? assetPdfPageNumber(item.asset));
  if (sourceNode.previewNode) {
    const previewAttrs = mergeAttributes(sourceNode.previewNode.attributes);
    rewriteResourceAttrs(previewAttrs, options);
    const previewClasses = new Set(sourceNode.previewNode.classList || []);
    if (previewClasses.size) previewAttrs.class = Array.from(previewClasses).join(' ');
    if (!previewAttrs.src) previewAttrs.src = pdfPreviewPath(pdfPath, page);
    if (!previewAttrs.alt) previewAttrs.alt = attrs.alt || `${fileStem(pdfPath)} preview`;
    if (!hasDataIdIgnore(previewAttrs)) previewAttrs[HTML_DATA_ID_ATTRIBUTES.IGNORE] = '';
    return attrsToHtml(orderAttrs(previewAttrs));
  }
  const preview = pdfPreviewPath(pdfPath, page);
  if (!preview) return '';
  return attrsToHtml(orderAttrs({
    class: 'pdf-preview',
    src: preview,
    alt: attrs.alt || `${fileStem(pdfPath)} preview`,
    [HTML_DATA_ID_ATTRIBUTES.IGNORE]: '',
  }));
}

function hasSourcePdfWrapper(item) {
  return (item.sourceAncestorNodes || []).some((node) => {
    const attrs = node.attributes || {};
    const classes = new Set(node.classList || []);
    return hasDataIdIgnore(attrs) || Array.from(classes).some((name) => PDF_WRAPPER_CLASSES.has(String(name || '').trim()));
  });
}

module.exports = {
  renderPdfObjectNode,
  renderPdfObjectContents,
  isPdfObjectItem,
  objectAttrsForPdf,
  wrapperAttrsForPdf,
  previewAttrsForPdf,
  hasSourcePdfWrapper,
};
