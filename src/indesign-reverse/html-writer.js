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

function semanticModelToHtml(model) {
  assertDocumentModel(model);

  const title = model.title || model.id;
  const pages = (model.pages || []).map(pageToHtml).join('\n');

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
    `<main class="deck" data-id-document="${attr(model.id)}" data-id-profile="${attr(model.profile || '')}">`,
    pages,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function pageToHtml(page) {
  const pageId = requiredString(page.id, 'Page is missing id');
  const attrs = [
    `class="page"`,
    `id="${attr(pageId)}"`,
    `data-page="${attr(pageId)}"`,
    page.semantic ? `data-id-semantic="${attr(page.semantic)}"` : null,
    page.parentPageId ? `data-id-parent-page="${attr(page.parentPageId)}"` : null,
    page.parentPageName ? `data-id-parent-page-name="${attr(page.parentPageName)}"` : null,
    page.layout ? `data-id-layout="${attr(page.layout)}"` : null,
    page.margins ? `data-id-margins="${attr(marginValue(page.margins))}"` : null,
    `style="${attr(pageStyle(page))}"`,
  ].filter(Boolean);

  const items = (page.items || []).map(itemToHtml).join('\n');
  return [`  <section ${attrs.join(' ')}>`, items, '  </section>'].join('\n');
}

function itemToHtml(item) {
  const itemId = requiredString(item.id, 'Item is missing id');
  const tag = safeTagName(item.tagName || htmlTagForRole(item.role));
  const classes = ['id-object', item.htmlClass].filter(Boolean).join(' ');
  const attrs = [
    `class="${attr(classes)}"`,
    `id="${attr(itemId)}"`,
    `data-id-object="${attr(itemId)}"`,
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
    `style="${attr(boundsStyle(itemId, item.bounds))}"`,
  ].filter(Boolean);

  if (tag === 'figure') {
    return `    <figure ${attrs.join(' ')}>${escapeHtml(textContent(item))}</figure>`;
  }

  return `    <${tag} ${attrs.join(' ')}>${escapeHtml(textContent(item))}</${tag}>`;
}

function baseCss(model) {
  const firstPage = model.pages[0];
  const width = requiredNumber(firstPage.width, `Page ${firstPage.id} is missing width`);
  const height = requiredNumber(firstPage.height, `Page ${firstPage.id} is missing height`);

  return [
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; background: #f3f5f6; color: #14324a; font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '    .deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `    .page { position: relative; width: ${formatPx(width)}; height: ${formatPx(height)}; background: #fff; overflow: hidden; }`,
    '    .id-object { position: absolute; margin: 0; }',
  ].join('\n');
}

function pageStyle(page) {
  const pageId = requiredString(page.id, 'Page is missing id');
  const width = requiredNumber(page.width, `Page ${pageId} is missing width`);
  const height = requiredNumber(page.height, `Page ${pageId} is missing height`);
  return [
    `width:${formatPx(width)}`,
    `height:${formatPx(height)}`,
  ].join(';');
}

function boundsStyle(itemId, bounds) {
  if (!bounds) {
    throw new Error(`Item ${itemId} is missing bounds`);
  }
  return [
    `left:${formatPx(requiredNumber(bounds.x, `Item ${itemId} bounds is missing x`))}`,
    `top:${formatPx(requiredNumber(bounds.y, `Item ${itemId} bounds is missing y`))}`,
    `width:${formatPx(requiredNumber(bounds.width, `Item ${itemId} bounds is missing width`))}`,
    `height:${formatPx(requiredNumber(bounds.height, `Item ${itemId} bounds is missing height`))}`,
  ].join(';');
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

function safeTagName(tagName) {
  const normalized = String(tagName || '').toLowerCase();
  if (SAFE_TAGS.has(normalized)) return normalized;
  throw new Error(`Unsupported reverse HTML tag: ${tagName}`);
}

function textContent(item) {
  return (item.content && item.content.text) || '';
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

function requiredNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(message);
  }
  return number;
}

function requiredString(value, message) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(message);
  }
  return value;
}

function formatPx(value) {
  return `${formatNumber(value)}px`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 1000) / 1000);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

module.exports = {
  semanticModelToHtml,
};
