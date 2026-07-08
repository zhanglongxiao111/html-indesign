const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { blendModeCss } = require('./css-blend-mode');
const { hasVectorPaths, vectorPathElements, vectorViewBox } = require('./vector-svg');
const { assetHtml, assetPlacementAttrs } = require('./asset-html');
const { renderTextContent, textContent } = require('./rich-text-html');
const { renderTableContent, tableStyleName } = require('./table-html');
const { assertReverseVisualHtmlContainerTag } = require('./safe-tags');
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

function semanticModelToHtml(model, options = {}) {
  assertDocumentModel(model);

  const title = model.title || model.id;
  const pages = (model.pages || []).map((page) => pageToHtml(page, model, options)).join('\n');
  const reverseMode = model.reverseMode || 'structured';
  const mainAttrs = [
    'class="deck"',
    `${HTML_DATA_ID_ATTRIBUTES.DOCUMENT}="${attr(model.id)}"`,
    `${HTML_DATA_ID_ATTRIBUTES.PROFILE}="${attr(model.profile || '')}"`,
    reverseMode !== 'structured' ? `${HTML_DATA_ID_ATTRIBUTES.REVERSE_MODE}="${attr(reverseMode)}"` : null,
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
    writableSemantic(page.semantic) ? `${HTML_DATA_ID_ATTRIBUTES.SEMANTIC}="${attr(writableSemantic(page.semantic))}"` : null,
    page.parentPageId ? `${HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE}="${attr(page.parentPageId)}"` : null,
    page.parentPageName ? `${HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_NAME}="${attr(page.parentPageName)}"` : null,
    page.layout ? `${HTML_DATA_ID_ATTRIBUTES.LAYOUT}="${attr(page.layout)}"` : null,
    page.margins ? `${HTML_DATA_ID_ATTRIBUTES.MARGIN}="${attr(marginValue(page.margins))}"` : null,
    page.source ? `${HTML_DATA_ID_ATTRIBUTES.SOURCE}="${attr(page.source)}"` : null,
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
    `${HTML_DATA_ID_ATTRIBUTES.OBJECT}="${attr(itemId)}"`,
    item.source ? `${HTML_DATA_ID_ATTRIBUTES.SOURCE}="${attr(item.source)}"` : null,
    item.role ? `${HTML_DATA_ID_ATTRIBUTES.ROLE}="${attr(item.role)}"` : null,
    writableSemantic(item.semantic) ? `${HTML_DATA_ID_ATTRIBUTES.SEMANTIC}="${attr(writableSemantic(item.semantic))}"` : null,
    item.layerName ? `${HTML_DATA_ID_ATTRIBUTES.LAYER}="${attr(item.layerName)}"` : null,
    item.styleRefs && item.styleRefs.paragraphStyle
      ? `${HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE}="${attr(item.styleRefs.paragraphStyle)}"`
      : null,
    item.styleRefs && item.styleRefs.objectStyle
      ? `${HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE}="${attr(item.styleRefs.objectStyle)}"`
      : null,
    item.styleRefs && item.styleRefs.frameStyle
      ? `${HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE}="${attr(item.styleRefs.frameStyle)}"`
      : null,
    tableStyleName(item) ? `${HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE}="${attr(tableStyleName(item))}"` : null,
    item.migration && item.migration.isSlot ? `${HTML_DATA_ID_ATTRIBUTES.MIGRATION_SLOT}="true"` : null,
    item.migration && item.migration.slotName ? `${HTML_DATA_ID_ATTRIBUTES.SLOT_NAME}="${attr(item.migration.slotName)}"` : null,
    item.migration && item.migration.slotType ? `${HTML_DATA_ID_ATTRIBUTES.SLOT_TYPE}="${attr(item.migration.slotType)}"` : null,
    item.migration && item.migration.confidence != null ? `${HTML_DATA_ID_ATTRIBUTES.CONFIDENCE}="${attr(item.migration.confidence)}"` : null,
    item.asset && item.asset.path ? `${HTML_DATA_ID_ATTRIBUTES.ASSET_PATH}="${attr(item.asset.path)}"` : null,
    item.asset && item.asset.cropped ? `${HTML_DATA_ID_ATTRIBUTES.IMAGE_CROPPED}="true"` : null,
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
    `${HTML_DATA_ID_ATTRIBUTES.OBJECT}="${attr(itemId)}"`,
    item.role ? `${HTML_DATA_ID_ATTRIBUTES.ROLE}="${attr(item.role)}"` : null,
    writableSemantic(item.semantic) ? `${HTML_DATA_ID_ATTRIBUTES.SEMANTIC}="${attr(writableSemantic(item.semantic))}"` : null,
    item.layerName ? `${HTML_DATA_ID_ATTRIBUTES.LAYER}="${attr(item.layerName)}"` : null,
    item.styleRefs && item.styleRefs.objectStyle
      ? `${HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE}="${attr(item.styleRefs.objectStyle)}"`
      : null,
    `${HTML_DATA_ID_ATTRIBUTES.VECTOR}="${attr(item.vectorGeometry && item.vectorGeometry.kind || 'path')}"`,
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

function writableSemantic(value) {
  const semantic = String(value || '').trim();
  if (!semantic || semantic.toLowerCase() === 'unknown') return '';
  return semantic;
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
  return assertReverseVisualHtmlContainerTag(tagName);
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
