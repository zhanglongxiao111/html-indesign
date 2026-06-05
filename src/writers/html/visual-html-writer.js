const { blendModeCss } = require('./css-blend-mode');
const { hasVectorPaths, vectorPathElements, vectorViewBox } = require('./vector-svg');
const { assetHtml, assetPlacementAttrs } = require('./asset-html');
const { renderTextContent, textContent } = require('./rich-text-html');
const { renderTableContent, tableStyleName } = require('./table-html');
const {
  baseCss,
  pageStyle,
  boundsStyle,
  itemInlineStyle,
  itemClasses,
  zIndexCss,
} = require('./visual-style-css');
const {
  attr,
  escapeHtml,
  formatPx,
  formatNumber,
  requiredNumber,
  requiredString,
} = require('./visual-html-utils');

const SAFE_TAGS = new Set([
  'article',
  'aside',
  'blockquote',
  'caption',
  'div',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'span',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
]);

function semanticModelToHtml(model, options = {}) {
  assertDocumentModel(model);

  const title = model.title || model.id;
  const pages = (model.pages || []).map((page) => pageToHtml(page, model, options)).join('\n');
  const reverseMode = model.reverseMode || 'structured';
  const mainAttrs = [
    'class="deck"',
    `data-id-document="${attr(model.id)}"`,
    `data-id-profile="${attr(model.profile || '')}"`,
    reverseMode !== 'structured' ? `data-id-reverse-mode="${attr(reverseMode)}"` : null,
  ].filter(Boolean);

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${escapeHtml(title)}</title>`,
    '  <style>',
    baseCss(model),
    '  </style>',
    '</head>',
    '<body>',
    `<main ${mainAttrs.join(' ')}>`,
    pages,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function pageToHtml(page, model, options) {
  const pageId = requiredString(page.id, 'Page is missing id');
  const attrs = [
    `class="page"`,
    `id="${attr(pageId)}"`,
    `data-page="${attr(pageId)}"`,
    page.semantic ? `data-id-semantic="${attr(page.semantic)}"` : null,
    page.parentPageId ? `data-id-parent-page="${attr(page.parentPageId)}"` : null,
    page.parentPageName ? `data-id-parent-page-name="${attr(page.parentPageName)}"` : null,
    page.layout ? `data-id-layout="${attr(page.layout)}"` : null,
    page.margins ? `data-id-margin="${attr(marginValue(page.margins))}"` : null,
    page.source ? `data-id-source="${attr(page.source)}"` : null,
    `style="${attr(pageStyle(page))}"`,
  ].filter(Boolean);

  const items = (page.items || []).filter((item) => !item.virtual).map((item) => itemToHtml(item, model, options)).join('\n');
  return [`  <section ${attrs.join(' ')}>`, items, '  </section>'].join('\n');
}

function itemToHtml(item, model, options) {
  const itemId = requiredString(item.id, 'Item is missing id');
  if (shouldRenderVectorSvg(item)) return vectorItemToHtml(item, model);
  const tag = safeTagName(containerTagForItem(item));
  const classes = itemClasses(item, model).join(' ');
  const inlineStyle = itemInlineStyle(item);
  const attrs = [
    `id="${attr(itemId)}"`,
    `class="${attr(classes)}"`,
    `data-id-object="${attr(itemId)}"`,
    item.source ? `data-id-source="${attr(item.source)}"` : null,
    item.role ? `data-id-role="${attr(item.role)}"` : null,
    item.semantic ? `data-id-semantic="${attr(item.semantic)}"` : null,
    item.layerName ? `data-id-layer="${attr(item.layerName)}"` : null,
    item.styleRefs && item.styleRefs.paragraphStyle
      ? `data-id-paragraph-style="${attr(item.styleRefs.paragraphStyle)}"`
      : null,
    item.styleRefs && item.styleRefs.objectStyle
      ? `data-id-object-style="${attr(item.styleRefs.objectStyle)}"`
      : null,
    item.styleRefs && item.styleRefs.frameStyle
      ? `data-id-frame-style="${attr(item.styleRefs.frameStyle)}"`
      : null,
    tableStyleName(item) ? `data-id-table-style="${attr(tableStyleName(item))}"` : null,
    item.migration && item.migration.isSlot ? 'data-id-migration-slot="true"' : null,
    item.migration && item.migration.slotName ? `data-id-slot-name="${attr(item.migration.slotName)}"` : null,
    item.migration && item.migration.slotType ? `data-id-slot-type="${attr(item.migration.slotType)}"` : null,
    item.migration && item.migration.confidence != null ? `data-id-confidence="${attr(item.migration.confidence)}"` : null,
    item.asset && item.asset.path ? `data-id-asset-path="${attr(item.asset.path)}"` : null,
    item.asset && item.asset.cropped ? 'data-id-image-cropped="true"' : null,
    ...assetPlacementAttrs(item.asset),
    `style="${attr(boundsStyle(itemId, item.bounds, inlineStyle))}"`,
  ].filter(Boolean);

  if (tag === 'table') {
    return `    <table ${attrs.join(' ')}>${renderTableContent(item, model)}</table>`;
  }

  if (tag === 'figure') {
    return `    <figure ${attrs.join(' ')}>${assetHtml(item, options)}${escapeHtml(textContent(item))}</figure>`;
  }

  return `    <${tag} ${attrs.join(' ')}>${renderTextContent(item, model)}</${tag}>`;
}

function shouldRenderVectorSvg(item) {
  if (!hasVectorPaths(item)) return false;
  if (item.asset || item.table) return false;
  return item.role !== 'text' && item.role !== 'graphic' && item.role !== 'table';
}

function vectorItemToHtml(item, model) {
  const itemId = requiredString(item.id, 'Item is missing id');
  const classes = itemClasses(item, model).join(' ');
  const attrs = [
    `id="${attr(itemId)}"`,
    `class="${attr(classes)}"`,
    `data-id-object="${attr(itemId)}"`,
    item.role ? `data-id-role="${attr(item.role)}"` : null,
    item.semantic ? `data-id-semantic="${attr(item.semantic)}"` : null,
    item.layerName ? `data-id-layer="${attr(item.layerName)}"` : null,
    item.styleRefs && item.styleRefs.objectStyle
      ? `data-id-object-style="${attr(item.styleRefs.objectStyle)}"`
      : null,
    `data-id-vector="${attr(item.vectorGeometry && item.vectorGeometry.kind || 'path')}"`,
    `preserveAspectRatio="none"`,
    `viewBox="${attr(vectorViewBox(item))}"`,
    `style="${attr(boundsStyle(itemId, item.bounds, vectorInlineStyle(item)))}"`,
  ].filter(Boolean);
  return `    <svg ${attrs.join(' ')}>\n${vectorPathElements(item, 6)}\n    </svg>`;
}

function vectorInlineStyle(item) {
  return [
    vectorMinSizeCss(item),
    'overflow:visible',
    blendModeCss(item.visualStyle && item.visualStyle.blendMode),
    zIndexCss(item.zIndex),
  ].filter(Boolean).join(';');
}

function vectorMinSizeCss(item) {
  if (!item || !item.bounds || !item.visualStyle) return '';
  const stroke = Number(item.visualStyle.strokeWeight);
  const markerExtent = hasLineMarker(item.visualStyle) ? 1 : 0;
  const extent = Number.isFinite(stroke) && stroke > 0 ? stroke : markerExtent;
  if (!extent) return '';
  const styles = [];
  if (Number(item.bounds.width || 0) <= 0) styles.push(`min-width:${formatPx(extent)}`);
  if (Number(item.bounds.height || 0) <= 0) styles.push(`min-height:${formatPx(extent)}`);
  return styles.join(';');
}

function hasLineMarker(visualStyle) {
  return Boolean(visualStyle && (visualStyle.lineStartMarker || visualStyle.lineEndMarker));
}

function marginValue(margins) {
  return [margins.top, margins.right, margins.bottom, margins.left]
    .map((value, index) => formatNumber(requiredNumber(value, `Page margins missing ${['top', 'right', 'bottom', 'left'][index]}`)))
    .join(' ');
}

function htmlTagForRole(role) {
  if (role === 'text') return 'p';
  if (role === 'graphic') return 'figure';
  if (role === 'table') return 'table';
  return 'div';
}

function containerTagForItem(item) {
  const tagName = String(item.tagName || '').toLowerCase();
  if (item.role === 'graphic' && ['img', 'object', 'picture'].includes(tagName)) return 'figure';
  return item.tagName || htmlTagForRole(item.role);
}

function safeTagName(tagName) {
  const normalized = String(tagName || '').toLowerCase();
  if (SAFE_TAGS.has(normalized)) return normalized;
  throw new Error(`Unsupported reverse HTML tag: ${tagName}`);
}

function assertDocumentModel(model) {
  if (!model || model.kind !== 'DocumentModel') {
    throw new Error('semanticModelToHtml requires a DocumentModel');
  }
  if (!model.id) {
    throw new Error('DocumentModel is missing id');
  }
  if (!Array.isArray(model.pages) || model.pages.length === 0) {
    throw new Error('DocumentModel is missing pages');
  }
}

module.exports = {
  semanticModelToHtml,
};
