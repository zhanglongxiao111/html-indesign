const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { blendModeCss } = require('./css-blend-mode');
const { hasVectorPaths, vectorPathElements, vectorViewBox } = require('./vector-svg');

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
    page.margins ? `data-id-margins="${attr(marginValue(page.margins))}"` : null,
    page.source ? `data-id-source="${attr(page.source)}"` : null,
    `style="${attr(pageStyle(page))}"`,
  ].filter(Boolean);

  const items = (page.items || []).map((item) => itemToHtml(item, model, options)).join('\n');
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
  if (!Number.isFinite(stroke) || stroke <= 0) return '';
  const styles = [];
  if (Number(item.bounds.width || 0) <= 0) styles.push(`min-width:${formatPx(stroke)}`);
  if (Number(item.bounds.height || 0) <= 0) styles.push(`min-height:${formatPx(stroke)}`);
  return styles.join(';');
}

function baseCss(model) {
  const firstPage = model.pages[0];
  const width = requiredNumber(firstPage.width, `Page ${firstPage.id} is missing width`);
  const height = requiredNumber(firstPage.height, `Page ${firstPage.id} is missing height`);

  return [
    '    * { box-sizing: border-box; }',
    '    body { margin: 0; background: #f3f5f6; color: #14324a; font-family: Arial, "Microsoft YaHei", sans-serif; }',
    '    .deck { display: flex; flex-direction: column; gap: 40px; padding: 40px; }',
    `    .page { position: relative; width: ${formatPx(width)}; height: ${formatPx(height)}; background: #fff; overflow: hidden; isolation: isolate; }`,
    '    .id-object { position: absolute; margin: 0; overflow: hidden; }',
    '    .id-object[data-id-role="text"] { overflow: visible; }',
    '    .id-object[data-id-role="table"] { border-collapse: collapse; table-layout: fixed; }',
    '    .id-object[data-id-role="table"] th, .id-object[data-id-role="table"] td { overflow: hidden; vertical-align: top; }',
    '    .id-object > img, .id-object > object { display: block; width: 100%; height: 100%; }',
    '    .id-object > img[data-id-preview-kind="pdf"] { border: 0; outline: 0; }',
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
    effectsCss(item.effects, item.visualStyle),
    item.inlineStyle ? '' : textStyleCss(item.textStyle),
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
    const features = indesignFeatures(paragraphStyle);
    classes.push(`pstyle-${styleClassToken(paragraphStyle)}`);
    if (features.dropCap) classes.push('has-dropcap');
    if (features.list && features.list.type === 'bullet') classes.push('has-bullet-list');
    if (features.list && features.list.type === 'numbered') classes.push('has-numbered-list');
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
  const blendMode = blendModeCss(visualStyle.blendMode);
  if (blendMode) styles.push(blendMode);
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

function assetHtml(item, options) {
  const asset = item.asset || {};
  if (!asset.path) return '';
  const url = assetUrl(asset.path, options);
  const label = asset.name || item.semantic || item.id;
  const extension = String(asset.name || asset.path).toLowerCase();
  const fit = asset.cropped ? 'cover' : 'contain';
  const geometry = assetContentGeometry(asset);
  const previewPath = placedPreviewPath(asset);
  const kind = assetKind(asset);
  const framePreview = previewPath && usesGeneratedFramePreview(asset);
  const geometryAttrs = assetGeometryAttrs(asset, geometry, framePreview);
  const fallbackFitStyle = geometryAttrs ? '' : ` style="object-fit:${fit}"`;
  if (previewPath && ['pdf', 'ai', 'psd'].includes(kind)) {
    return `<img src="${attr(assetUrl(previewPath, options))}"${geometryAttrs} alt="${attr(label)}" data-id-preview-kind="${attr(kind)}" data-id-preview-asset-path="${attr(previewPath)}"${fallbackFitStyle}>`;
  }
  if (kind === 'image' || kind === 'raster' || /\.(png|jpe?g|jfif|gif|webp|svg|bmp|tiff?)$/.test(extension)) {
    return `<img src="${attr(url)}"${geometryAttrs} alt="${attr(label)}"${fallbackFitStyle}>`;
  }
  if (/\.pdf$/.test(extension)) {
    const previewPath = placedPreviewPath(asset);
    if (previewPath) {
      const pdfFramePreview = usesGeneratedFramePreview(asset);
      const pdfGeometryAttrs = assetGeometryAttrs(asset, geometry, pdfFramePreview);
      const pdfFallbackFitStyle = pdfGeometryAttrs ? '' : ` style="object-fit:${fit}"`;
      return `<img src="${attr(assetUrl(previewPath, options))}"${pdfGeometryAttrs} alt="${attr(label)}" data-id-preview-kind="pdf" data-id-preview-asset-path="${attr(previewPath)}"${pdfFallbackFitStyle}>`;
    }
    return `<object data="${attr(url)}" type="application/pdf" aria-label="${attr(label)}"${geometry ? ` style="${attr(placedAssetContentStyle(geometry))}"` : ` style="object-fit:${fit}"`}></object>`;
  }
  return `<span class="id-asset-placeholder">${escapeHtml(label)}</span>`;
}

function assetGeometryAttrs(asset, geometry, framePreview) {
  if (framePreview) return ` class="placed-asset-preview" style="${attr(placedAssetPreviewStyle())}"`;
  if (!geometry) return '';
  return ` class="placed-asset-content" style="${attr(placedAssetContentStyle(geometry))}"`;
}

function assetPlacementAttrs(asset = {}) {
  asset = asset || {};
  const geometry = assetContentGeometry(asset);
  const out = [];
  const pdfPageNumber = assetPdfPageNumber(asset);
  if (pdfPageNumber != null) out.push(`data-id-pdf-page="${attr(pdfPageNumber)}"`);
  if (assetKind(asset) === 'ai') {
    const placement = asset.placement || {};
    const artboard = placement.artboard || asset.artboard || placement.pageNumber || asset.pageNumber || null;
    if (artboard != null) out.push(`data-id-artboard="${attr(artboard)}"`);
  }
  if (geometry) {
    out.push(
      'data-id-fit="manual"',
      `data-id-content-x="${attr(formatPx(geometry.x))}"`,
      `data-id-content-y="${attr(formatPx(geometry.y))}"`,
      `data-id-content-width="${attr(formatPx(geometry.width))}"`,
      `data-id-content-height="${attr(formatPx(geometry.height))}"`,
    );
    if (geometry.scaleX != null) out.push(`data-id-content-scale-x="${attr(formatNumber(geometry.scaleX))}"`);
    if (geometry.scaleY != null) out.push(`data-id-content-scale-y="${attr(formatNumber(geometry.scaleY))}"`);
  }
  return out;
}

function assetPdfPageNumber(asset = {}) {
  if (assetKind(asset) !== 'pdf') return null;
  const placement = asset.placement || {};
  return placement.pageNumber || asset.pageNumber || null;
}

function assetContentGeometry(asset = {}) {
  asset = asset || {};
  const placement = asset.placement || {};
  let offset = placement.contentOffset || null;
  let size = placement.contentSize || null;
  const frameBounds = placement.frameBounds || null;
  const contentBounds = placement.contentBounds || null;
  if ((!offset || !size) && frameBounds && contentBounds) {
    offset = offset || {
      x: Number(contentBounds.x || 0) - Number(frameBounds.x || 0),
      y: Number(contentBounds.y || 0) - Number(frameBounds.y || 0),
    };
    size = size || {
      width: Number(contentBounds.width || 0),
      height: Number(contentBounds.height || 0),
    };
  }
  if (!offset || !size) return null;
  const width = Number(size.width);
  const height = Number(size.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return {
    x: finiteOrZero(offset.x),
    y: finiteOrZero(offset.y),
    width,
    height,
    scaleX: finiteOrNull(placement.contentScale && placement.contentScale.x),
    scaleY: finiteOrNull(placement.contentScale && placement.contentScale.y),
  };
}

function placedAssetContentStyle(geometry) {
  return [
    'position:absolute',
    `left:${formatPx(geometry.x)}`,
    `top:${formatPx(geometry.y)}`,
    `width:${formatPx(geometry.width)}`,
    `height:${formatPx(geometry.height)}`,
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ].join(';');
}

function placedAssetPreviewStyle() {
  return [
    'position:absolute',
    'left:0px',
    'top:0px',
    'width:100%',
    'height:100%',
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ].join(';');
}

function placedPreviewPath(asset) {
  const explicit = asset.previewPath || previewValue(asset.preview) || asset.previewAssetPath;
  if (explicit) return explicit;
  const rawPath = String(asset.path || '');
  if (!rawPath || !path.isAbsolute(rawPath)) return null;
  const pageNumber = assetPdfPageNumber(asset);
  if (pageNumber == null) return null;
  const parsed = path.parse(rawPath);
  const page = Number(pageNumber);
  const candidates = [
    path.join(parsed.dir, `${parsed.name}-page${page}.png`),
    path.join(parsed.dir, `${parsed.name}-page-${page}.png`),
    path.join(parsed.dir, `${parsed.name}-preview.png`),
    path.join(parsed.dir, `${parsed.name}.png`),
  ];
  return candidates.find(fileExists) || null;
}

function usesGeneratedFramePreview(asset) {
  const preview = asset && asset.preview;
  return preview && typeof preview === 'object' && preview.source === 'indesign-frame-export';
}

function previewValue(preview) {
  if (!preview) return '';
  if (typeof preview === 'string') return preview;
  return preview.path || preview.htmlPath || preview.relativePath || '';
}

function assetKind(asset) {
  const ext = path.extname(String(asset.path || '')).toLowerCase().replace(/^\./, '');
  if (['pdf', 'ai', 'psd', 'svg'].includes(ext)) return ext;
  const raw = String(asset.kind || asset.graphicType || asset.imageTypeName || '').toLowerCase();
  if (raw === 'pdf' || raw.includes('adobe pdf')) return 'pdf';
  if (raw === 'psd' || raw.includes('photoshop')) return 'psd';
  if (raw === 'ai' || raw.includes('illustrator')) return 'ai';
  return raw;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (_) {
    return false;
  }
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
    const features = indesignFeatures(style);
    const compositeName = features.compositeFont
      ? features.compositeFont
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
  const runs = contentRuns(item);
  if (runs.length) return renderRichTextRuns(runs, model);
  const paragraphStyle = styleByName(model, 'paragraphStyles', item.styleRefs && item.styleRefs.paragraphStyle);
  const features = indesignFeatures(paragraphStyle);
  const usesComposite = usesCompositeFont(paragraphStyle, model, item.firstLineFont);

  if (features.list) return renderListText(text, features.list, usesComposite);
  if (features.dropCap) return renderDropCapText(text, features.dropCap, usesComposite);
  if (features.grepStyles && features.grepStyles.length) return renderGrepText(text, features.grepStyles, usesComposite, item, model);
  return renderPlainText(text, usesComposite);
}

function renderTableContent(item, model) {
  const table = item.table || {};
  const parts = [];
  if (Array.isArray(table.columnWidths) && table.columnWidths.length) {
    parts.push(renderTableColGroup(table.columnWidths));
  }
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (rows.length) {
    parts.push('<tbody>');
    for (const row of rows) parts.push(renderTableRow(row, model));
    parts.push('</tbody>');
  }
  return parts.length ? `\n${parts.join('\n')}\n    ` : '';
}

function renderTableColGroup(columnWidths) {
  const cols = columnWidths
    .map((width) => `      <col style="width:${formatPx(width)}">`)
    .join('\n');
  return `      <colgroup>\n${cols}\n      </colgroup>`;
}

function renderTableRow(row, model) {
  const cells = (row.cells || []).map((cell) => renderTableCell(cell, model)).join('\n');
  return `      <tr>\n${cells}\n      </tr>`;
}

function renderTableCell(cell, model) {
  const tag = cell.header ? 'th' : 'td';
  const style = tableCellCss(cell);
  const attrs = [
    cell.paragraphStyle ? `data-id-paragraph-style="${attr(cell.paragraphStyle)}"` : null,
    cell.cellStyle ? `data-id-cell-style="${attr(cell.cellStyle)}"` : null,
    Number(cell.rowSpan) > 1 ? `rowspan="${attr(cell.rowSpan)}"` : null,
    Number(cell.colSpan) > 1 ? `colspan="${attr(cell.colSpan)}"` : null,
    style ? `style="${attr(style)}"` : null,
  ].filter(Boolean);
  const open = attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
  return `        ${open}${renderTableCellContent(cell, model)}</${tag}>`;
}

function renderTableCellContent(cell, model) {
  const runs = Array.isArray(cell.runs) ? cell.runs.filter((run) => run && run.text) : [];
  if (runs.length) return renderRichTextRuns(runs, model);
  return renderTextWithBreaks(cleanTableCellText(cell.text));
}

function tableCellCss(cell) {
  const styles = [];
  if (cell.fillColor) styles.push(`background-color:${cell.fillColor}`);
  const textStyle = { ...(cell.textStyle || {}) };
  if (cell.textColor) textStyle.fillColor = cell.textColor;
  if (cell.pointSize != null) textStyle.pointSize = cell.pointSize;
  if (cell.leading != null) textStyle.leading = cell.leading;
  if (cell.tracking != null) textStyle.tracking = cell.tracking;
  if (cell.textAlign) textStyle.justification = cell.textAlign;
  const textCss = textStyleCss(textStyle);
  if (textCss) styles.push(textCss);
  const padding = tableCellPaddingCss(cell.padding);
  if (padding) styles.push(padding);
  const borders = tableCellBordersCss(cell.borders);
  if (borders) styles.push(borders);
  if (cell.inlineStyle) styles.push(cssForHtml(cell.inlineStyle));
  return styles.filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
}

function tableCellPaddingCss(padding) {
  if (!padding) return '';
  const values = [padding.top, padding.right, padding.bottom, padding.left];
  if (!values.some((value) => value != null && Number.isFinite(Number(value)))) return '';
  return `padding:${formatPx(values[0] || 0)} ${formatPx(values[1] || 0)} ${formatPx(values[2] || 0)} ${formatPx(values[3] || 0)}`;
}

function tableCellBordersCss(borders) {
  if (!borders) return '';
  const styles = [];
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const edge = borders[side] || {};
    const weight = Number(edge.borderWeight);
    if (Number.isFinite(weight) && weight > 0) {
      styles.push(`border-${side}:${formatNumber(weight)}px solid ${edge.color || '#000000'}`);
    }
  }
  return styles.join(';');
}

function renderRichTextRuns(runs, model) {
  return runs.map((run) => {
    const content = renderTextWithBreaks(run.text);
    const characterStyle = styleByName(model, 'characterStyles', run.characterStyle);
    const classes = characterStyle ? [`cstyle-${styleClassToken(characterStyle)}`] : [];
    const inlineStyle = [
      run.inlineStyle ? cssForHtml(run.inlineStyle) : textStyleCss(run.textStyle),
    ].filter(Boolean).map((value) => String(value).trim().replace(/;+$/, '')).join(';');
    const attrs = [
      classes.length ? `class="${attr(classes.join(' '))}"` : null,
      inlineStyle ? `style="${attr(inlineStyle)}"` : null,
    ].filter(Boolean);
    return attrs.length ? `<span ${attrs.join(' ')}>${content}</span>` : content;
  }).join('');
}

function contentRuns(item) {
  const runs = item.content && Array.isArray(item.content.runs) ? item.content.runs : [];
  return runs.filter((run) => run && run.text != null && String(run.text) !== '');
}

function renderPlainText(text, usesComposite) {
  if (usesComposite) {
    return splitLines(text).map((line) => wrapEnglishText(escapeHtml(line))).join('<br>');
  }
  return renderTextWithBreaks(text);
}

function renderTextWithBreaks(text) {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');
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

function effectsCss(effects, visualStyle) {
  if (!effects || !effects.gradientFeather) return '';
  const gradient = gradientFeatherCss(effects.gradientFeather, visualStyle);
  return gradient ? `background:${gradient}` : '';
}

function gradientFeatherCss(gradientFeather, visualStyle) {
  if (!gradientFeather || String(gradientFeather.type || 'linear').toLowerCase() !== 'linear') return '';
  const stops = Array.isArray(gradientFeather.stops) ? gradientFeather.stops : [];
  if (!stops.length) return '';
  const rgb = hexToRgb(visualStyle && visualStyle.fillColor ? visualStyle.fillColor : '#ffffff');
  if (!rgb) return '';
  const angle = indesignGradientAngleToCss(gradientFeather.angle);
  const cssStops = stops.map((stop) => {
    const opacity = clamp(Number(stop.opacity) / 100, 0, 1);
    const location = clamp(Number(stop.location), 0, 100);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${formatNumber(opacity)}) ${formatNumber(location)}%`;
  });
  return `linear-gradient(${formatNumber(angle)}deg, ${cssStops.join(', ')})`;
}

function indesignGradientAngleToCss(angle) {
  return ((Number(angle || 0) - 270) % 360 + 360) % 360;
}

function hexToRgb(value) {
  const raw = String(value || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

function assetUrl(assetPath, options = {}) {
  const rawPath = String(assetPath || '');
  if (/^https?:/i.test(rawPath)) return rawPath;

  let localPath = rawPath;
  if (/^file:/i.test(rawPath)) {
    try {
      localPath = fileURLToPath(rawPath);
    } catch (_) {
      return rawPath;
    }
  }

  if (options && options.outputDir && path.isAbsolute(localPath)) {
    return filePathToUrlPath(path.relative(path.resolve(options.outputDir), localPath));
  }

  if (/^file:/i.test(rawPath)) return rawPath;
  return pathToFileURL(localPath).href;
}

function filePathToUrlPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => (segment === '..' || segment === '.' ? segment : encodeURIComponent(segment)))
    .join('/');
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
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

function textContent(item) {
  return (item.content && item.content.text) || '';
}

function tableStyleName(item) {
  return (item.styleRefs && item.styleRefs.tableStyle)
    || (item.table && item.table.tableStyle)
    || null;
}

function cleanTableCellText(value) {
  return String(value == null ? '' : value)
    .replace(/\u0016/g, '')
    .replace(/[\u0003-\u0007]/g, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n+$/g, '');
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
  const features = indesignFeatures(paragraphStyle);
  const compositeName = features.compositeFont
    ? features.compositeFont
    : fontFamilyFromCss(paragraphStyle.css);
  return Boolean(compositeName && compositeFonts[compositeName]);
}

function indesignFeatures(style) {
  return style && style.indesignFeatures || {};
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
  return String(Math.round(number * 10000) / 10000);
}

function finiteOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
