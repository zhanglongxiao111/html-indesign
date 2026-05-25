const { pathToFileURL } = require('node:url');

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
  const pages = (model.pages || []).map((page) => pageToHtml(page, model)).join('\n');
  const reverseMode = model.reverseMode || 'structured';

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
    `<main class="deck" data-id-document="${attr(model.id)}" data-id-profile="${attr(model.profile || '')}" data-id-reverse-mode="${attr(reverseMode)}">`,
    pages,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function pageToHtml(page, model) {
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
    page.source ? `data-id-source="${attr(page.source)}"` : null,
    `style="${attr(pageStyle(page))}"`,
  ].filter(Boolean);

  const items = (page.items || []).map((item) => itemToHtml(item, model)).join('\n');
  return [`  <section ${attrs.join(' ')}>`, items, '  </section>'].join('\n');
}

function itemToHtml(item, model) {
  const itemId = requiredString(item.id, 'Item is missing id');
  const tag = safeTagName(item.tagName || htmlTagForRole(item.role));
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
    item.legacy && item.legacy.isSlot ? 'data-id-legacy-slot="true"' : null,
    item.legacy && item.legacy.slotName ? `data-id-slot-name="${attr(item.legacy.slotName)}"` : null,
    item.legacy && item.legacy.slotType ? `data-id-slot-type="${attr(item.legacy.slotType)}"` : null,
    item.legacy && item.legacy.confidence != null ? `data-id-confidence="${attr(item.legacy.confidence)}"` : null,
    item.asset && item.asset.path ? `data-id-asset-path="${attr(item.asset.path)}"` : null,
    item.asset && item.asset.cropped ? 'data-id-image-cropped="true"' : null,
    `style="${attr(boundsStyle(itemId, item.bounds, inlineStyle))}"`,
  ].filter(Boolean);

  if (tag === 'figure') {
    return `    <figure ${attrs.join(' ')}>${assetHtml(item)}${escapeHtml(textContent(item))}</figure>`;
  }

  return `    <${tag} ${attrs.join(' ')}>${renderTextContent(item, model)}</${tag}>`;
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
    '    .id-object { position: absolute; margin: 0; overflow: hidden; }',
    '    .id-object[data-id-role="text"] { overflow: visible; }',
    '    .id-object > img, .id-object > object { display: block; width: 100%; height: 100%; }',
    '    .list-item { display: block; padding: 0; }',
    '    .list-item.has-bullet::before { content: "•"; margin-right: 0.5em; }',
    '    .list-item.has-number::before { content: attr(data-circle); margin-right: 0.5em; }',
    '    .has-dropcap { display: grid; grid-template-columns: auto 1fr; column-gap: 0.5em; align-content: start; }',
    '    .dropcap-chars { font-size: 3.2em; line-height: 0.8; align-self: start; }',
    '    .dropcap-rest { display: inline; }',
    '    .id-asset-placeholder { display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; border: 1px dashed #8aa0ad; color: #52636f; font-size: 12px; }',
    styleResourceCss(model),
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

function boundsStyle(itemId, bounds, inlineStyle) {
  if (!bounds) {
    throw new Error(`Item ${itemId} is missing bounds`);
  }
  const styles = [
    `left:${formatPx(requiredNumber(bounds.x, `Item ${itemId} bounds is missing x`))}`,
    `top:${formatPx(requiredNumber(bounds.y, `Item ${itemId} bounds is missing y`))}`,
    `width:${formatPx(requiredNumber(bounds.width, `Item ${itemId} bounds is missing width`))}`,
    `height:${formatPx(requiredNumber(bounds.height, `Item ${itemId} bounds is missing height`))}`,
  ];
  if (inlineStyle) styles.push(String(inlineStyle).trim().replace(/;+$/, ''));
  return styles.join(';');
}

function itemInlineStyle(item) {
  return [
    visualStyleCss(item.visualStyle),
    textStyleCss(item.textStyle),
    textFrameStyleCss(item.textFrameStyle),
    cssForHtml(item.inlineStyle),
    zIndexCss(item.zIndex),
  ].filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
}

function itemClasses(item, model) {
  const classes = uniqueWords(['id-object', item.htmlClass].filter(Boolean).join(' '));
  const paragraphStyle = styleByName(model, 'paragraphStyles', item.styleRefs && item.styleRefs.paragraphStyle);
  const objectStyle = styleByName(model, 'objectStyles', item.styleRefs && item.styleRefs.objectStyle);
  if (paragraphStyle) {
    classes.push(`pstyle-${styleClassToken(paragraphStyle)}`);
    if (paragraphStyle.legacy && paragraphStyle.legacy.dropCap) classes.push('has-dropcap');
    if (paragraphStyle.legacy && paragraphStyle.legacy.list && paragraphStyle.legacy.list.type === 'bullet') classes.push('has-bullet-list');
    if (paragraphStyle.legacy && paragraphStyle.legacy.list && paragraphStyle.legacy.list.type === 'numbered') classes.push('has-numbered-list');
  }
  if (objectStyle) classes.push(`ostyle-${styleClassToken(objectStyle)}`);
  return uniqueWords(classes.join(' '));
}

function visualStyleCss(visualStyle) {
  if (!visualStyle) return '';
  const styles = [];
  if (visualStyle.fillColor) styles.push(`background-color:${visualStyle.fillColor}`);
  if (visualStyle.strokeColor && Number(visualStyle.strokeWeight) > 0) {
    styles.push(`border:${formatNumber(visualStyle.strokeWeight)}px solid ${visualStyle.strokeColor}`);
  }
  if (Number(visualStyle.cornerRadius) > 0) {
    styles.push(`border-radius:${formatPx(visualStyle.cornerRadius)}`);
  }
  const opacity = Number(visualStyle.opacity);
  if (Number.isFinite(opacity) && opacity >= 0 && opacity < 100) {
    styles.push(`opacity:${formatNumber(opacity / 100)}`);
  }
  return styles.join(';');
}

function textStyleCss(textStyle) {
  if (!textStyle) return '';
  const styles = [];
  if (textStyle.fontFamily) styles.push(`font-family:"${textStyle.fontFamily}", Arial, sans-serif`);
  if (textStyle.fontWeight) styles.push(`font-weight:${textStyle.fontWeight}`);
  if (textStyle.fontStyle) styles.push(`font-style:${textStyle.fontStyle}`);
  if (textStyle.pointSize != null) styles.push(`font-size:${formatPx(textStyle.pointSize)}`);
  if (textStyle.leading != null) styles.push(`line-height:${formatPx(textStyle.leading)}`);
  if (textStyle.fillColor) styles.push(`color:${textStyle.fillColor}`);
  if (textStyle.tracking != null && Number(textStyle.tracking) !== 0) {
    styles.push(`letter-spacing:${formatNumber(Number(textStyle.tracking) / 1000)}em`);
  }
  if (textStyle.justification) styles.push(`text-align:${textStyle.justification}`);
  return styles.join(';');
}

function textFrameStyleCss(textFrameStyle) {
  if (!textFrameStyle) return '';
  const styles = [];
  const inset = textFrameStyle.inset || {};
  if ([inset.top, inset.right, inset.bottom, inset.left].some((value) => Number(value) > 0)) {
    styles.push(`padding:${formatPx(inset.top || 0)} ${formatPx(inset.right || 0)} ${formatPx(inset.bottom || 0)} ${formatPx(inset.left || 0)}`);
  }
  if (Number(textFrameStyle.columnCount) > 1) {
    styles.push(`column-count:${formatNumber(textFrameStyle.columnCount)}`);
    if (Number(textFrameStyle.columnGap) > 0) styles.push(`column-gap:${formatPx(textFrameStyle.columnGap)}`);
  }
  if (textFrameStyle.verticalJustification && textFrameStyle.verticalJustification !== 'flex-start') {
    styles.push('display:flex', 'flex-direction:column', `justify-content:${textFrameStyle.verticalJustification}`);
  }
  return styles.join(';');
}

function zIndexCss(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
}

function assetHtml(item) {
  const asset = item.asset || {};
  if (!asset.path) return '';
  const url = assetUrl(asset.path);
  const label = asset.name || item.semantic || item.id;
  const extension = String(asset.name || asset.path).toLowerCase();
  const fit = asset.cropped ? 'cover' : 'contain';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(extension)) {
    return `<img src="${attr(url)}" alt="${attr(label)}" style="object-fit:${fit}">`;
  }
  if (/\.pdf$/.test(extension)) {
    return `<object data="${attr(url)}" type="application/pdf" aria-label="${attr(label)}" style="object-fit:${fit}"></object>`;
  }
  return `<span class="id-asset-placeholder">${escapeHtml(label)}</span>`;
}

function styleResourceCss(model) {
  const styles = model.styles || {};
  return [
    styleCollectionCss(styles.paragraphStyles, 'pstyle'),
    styleCollectionCss(styles.characterStyles, 'cstyle'),
    styleCollectionCss(styles.objectStyles, 'ostyle'),
    compositeFontCss(styles.paragraphStyles, styles.compositeFonts),
  ].filter(Boolean).join('\n');
}

function styleCollectionCss(collection, prefix) {
  return Object.values(collection || {})
    .filter((style) => style && style.css)
    .map((style) => `    .${prefix}-${styleClassToken(style)} { ${cssForHtml(style.css)} }`)
    .join('\n');
}

function compositeFontCss(paragraphStyles = {}, compositeFonts = {}) {
  const lines = [];
  for (const style of Object.values(paragraphStyles || {})) {
    if (!style || !style.css) continue;
    const compositeName = style.legacy && style.legacy.compositeFont
      ? style.legacy.compositeFont
      : fontFamilyFromCss(style.css);
    const composite = compositeName && compositeFonts ? compositeFonts[compositeName] : null;
    if (!composite) continue;
    const roman = (composite.entries || []).find((entry) => entry.name === '罗马字') || {};
    const css = [];
    if (roman.size) css.push(`font-size:${formatNumber(Number(roman.size) / 100)}em`);
    if (roman.weight || composite.romanWeight) css.push(`font-weight:${roman.weight || composite.romanWeight}`);
    if (css.length) lines.push(`    .pstyle-${styleClassToken(style)} .en-text { ${css.join('; ')} }`);
  }
  return lines.join('\n');
}

function renderTextContent(item, model) {
  const text = textContent(item);
  if (item.role !== 'text') return escapeHtml(text);
  const paragraphStyle = styleByName(model, 'paragraphStyles', item.styleRefs && item.styleRefs.paragraphStyle);
  const legacy = (paragraphStyle && paragraphStyle.legacy) || {};
  const usesComposite = usesCompositeFont(paragraphStyle, model, item.firstLineFont);

  if (legacy.list) return renderListText(text, legacy.list, usesComposite);
  if (legacy.dropCap) return renderDropCapText(text, legacy.dropCap, usesComposite);
  if (legacy.grepStyles && legacy.grepStyles.length) return renderGrepText(text, legacy.grepStyles, usesComposite, item, model);
  return usesComposite ? wrapEnglishText(escapeHtml(text)) : escapeHtml(text);
}

function renderListText(text, list, usesComposite) {
  const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
  let counter = 1;
  return splitLines(text).map((line) => {
    if (!line.trim()) return '';
    const content = usesComposite ? wrapEnglishText(escapeHtml(line)) : escapeHtml(line);
    if (list.type === 'bullet') return `<span class="list-item has-bullet">${content}</span>`;
    const number = counter++;
    const circle = list.isCircle ? ` data-circle="${circleNumbers[number - 1] || `(${number})`}"` : '';
    return `<span class="list-item has-number" data-number="${number}"${circle}>${content}</span>`;
  }).filter(Boolean).join('\n');
}

function renderDropCapText(text, dropCap, usesComposite) {
  const chars = Math.max(1, Number(dropCap.chars || 1));
  const escaped = escapeHtml(text);
  const head = escaped.slice(0, chars);
  const rest = escaped.slice(chars);
  const restContent = usesComposite ? wrapEnglishText(rest) : rest;
  return `<span class="dropcap-chars">${head}</span><span class="dropcap-rest">${restContent}</span>`;
}

function renderGrepText(text, grepStyles, usesComposite, item, model) {
  const lines = splitLines(text).map((line) => escapeHtml(line));
  for (const grepStyle of grepStyles) {
    if (grepStyle.pattern && grepStyle.pattern.includes('^.+?(?=\\n|\\r)') && lines.length > 0) {
      const firstUsesComposite = usesCompositeFont(null, model, item.firstLineFont) || usesComposite;
      const first = firstUsesComposite ? wrapEnglishText(lines[0]) : lines[0];
      const firstLineStyle = firstLineStyleCss(grepStyle, item, model);
      lines[0] = firstLineStyle
        ? `<span class="grep-first-line" style="${attr(firstLineStyle)}">${first}</span>`
        : `<span class="grep-first-line">${first}</span>`;
    }
  }
  return lines.map((line, index) => (index === 0 || !usesComposite ? line : wrapEnglishText(line))).join('<br>');
}

function firstLineStyleCss(grepStyle, item, model) {
  const styles = [];
  if (item.firstLineFont) {
    const compositeFonts = (model.styles && model.styles.compositeFonts) || {};
    const composite = compositeFonts[item.firstLineFont];
    if (composite && (composite.hasBoldCJK || String(composite.cjkWeight) === '700')) {
      styles.push('font-weight:bold');
    } else if (!composite) {
      styles.push(`font-family:'${item.firstLineFont}',sans-serif`);
    }
  }
  if (grepStyle.charStyleCSS) styles.push(cssForHtml(grepStyle.charStyleCSS));
  return styles.join('; ');
}

function assetUrl(assetPath) {
  if (/^(https?:|file:)/i.test(assetPath)) return assetPath;
  return pathToFileURL(assetPath).href;
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

function styleByName(model, collectionName, name) {
  if (!name || !model || !model.styles) return null;
  const collection = model.styles[collectionName] || {};
  return collection[name] || Object.values(collection).find((style) => style && (style.name === name || style.token === name)) || null;
}

function styleClassToken(style) {
  return safeClassToken(style.safeName || style.token || style.name || 'style');
}

function safeClassToken(value) {
  return String(value || 'style')
    .replace(/[\[\]]/g, '')
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-')
    .replace(/^-+|-+$/g, '') || 'style';
}

function trimCss(value) {
  return String(value || '').trim().replace(/;+$/, '').trim();
}

function cssForHtml(value) {
  return trimCss(value).replace(/(-?\d+(?:\.\d+)?)pt\b/g, (_, number) => `${formatNumber(number)}px`);
}

function fontFamilyFromCss(css) {
  const match = String(css || '').match(/font-family:\s*['"]?([^,'";]+)['"]?/);
  return match ? match[1] : null;
}

function usesCompositeFont(paragraphStyle, model, firstLineFont) {
  const compositeFonts = (model.styles && model.styles.compositeFonts) || {};
  if (firstLineFont && compositeFonts[firstLineFont]) return true;
  if (!paragraphStyle) return false;
  const compositeName = paragraphStyle.legacy && paragraphStyle.legacy.compositeFont
    ? paragraphStyle.legacy.compositeFont
    : fontFamilyFromCss(paragraphStyle.css);
  return Boolean(compositeName && compositeFonts[compositeName]);
}

function wrapEnglishText(value) {
  return String(value).replace(/([A-Za-z][A-Za-z0-9 .,:;()\/&+-]*[A-Za-z0-9)])/g, '<span class="en-text">$1</span>');
}

function splitLines(value) {
  return String(value || '').split(/\r\n|\r|\n/);
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

function uniqueWords(value) {
  return Array.from(new Set(String(value || '').split(/\s+/).filter(Boolean)));
}

module.exports = {
  semanticModelToHtml,
};
