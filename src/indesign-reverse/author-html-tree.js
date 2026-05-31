const { mergeAttributes, attrsToHtml, isVoidTag, escapeHtml } = require('./author-attribute-writer');
const { authorInlineStyleForItem, authorClassesForItem, blendModeCss, mergeCss } = require('./author-style-attrs');
const { hasVectorPaths, isDegenerateInvisibleVector, vectorPathElements, vectorViewBox } = require('./vector-svg');

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
  const sourceNode = sourceNodeForItem(item);
  if (shouldRenderVectorSvg(item, sourceNode, options)) return renderVectorSvgNode(node, options, depth);
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  if (shouldRenderPlacedAssetFrame(item, sourceNode, options, tag)) {
    return renderPlacedAssetFrameNode(node, options, depth);
  }
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

function renderVectorSvgNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  const attrs = vectorAttrsForItem(item, sourceNode, options);
  const children = vectorPathElements(item, depth + 2);
  return `${indent(depth)}<svg ${attrs}>\n${children}\n${indent(depth)}</svg>`;
}

function shouldRenderPlacedAssetFrame(item, sourceNode, options, tag) {
  if (!item || item.role !== 'graphic') return false;
  if (tag !== 'img') return false;
  if (!assetContentGeometry(item)) return false;
  if (shouldPreserveTrustedSource(item, sourceNode, options)) return false;
  return true;
}

function renderPlacedAssetFrameNode(node, options, depth) {
  const item = node.item;
  const sourceNode = sourceNodeForItem(item);
  const frameSource = placedAssetFrameSourceNode(sourceNode);
  const attrs = attrsForItem(item, frameSource, options);
  const childAttrs = placedAssetContentAttrs(item, sourceNode, options);
  const children = node.children.map((child) => renderNode(child, options, depth + 2)).join('\n');
  const body = [
    childAttrs ? `${indent(depth + 2)}<img ${childAttrs}>` : null,
    children || null,
  ].filter(Boolean).join('\n');
  return `${indent(depth)}<figure ${attrs}>\n${body}\n${indent(depth)}</figure>`;
}

function placedAssetFrameSourceNode(sourceNode) {
  const attrs = mergeAttributes(sourceNode && sourceNode.attributes);
  delete attrs.src;
  delete attrs.data;
  delete attrs.href;
  delete attrs.type;
  delete attrs.alt;
  return {
    ...sourceNode,
    tagName: 'figure',
    attributes: attrs,
    generatedFrame: true,
  };
}

function placedAssetContentAttrs(item, sourceNode, options) {
  const asset = item.sourceAsset || item.asset || {};
  if (!asset.path) return '';
  const previewPath = assetPreviewPath(asset);
  const src = shouldUsePreviewImage(asset) && previewPath ? previewPath : asset.path;
  const attrs = {
    class: usesGeneratedFramePreview(asset) ? 'placed-asset-preview' : 'placed-asset-content',
    src,
    alt: (sourceNode && sourceNode.attributes && sourceNode.attributes.alt) || fileStem(asset.path),
    'data-id-ignore': '',
    style: placedAssetContentStyle(item, asset),
  };
  rewriteResourceAttrs(attrs, options);
  return attrsToHtml(orderAttrs(attrs));
}

function placedAssetContentStyle(item, asset) {
  if (usesGeneratedFramePreview(asset)) return placedAssetPreviewStyle();
  const geometry = assetContentGeometry(item);
  return mergeCss([
    'position:absolute',
    `left:${px(geometry.x)}`,
    `top:${px(geometry.y)}`,
    `width:${px(geometry.width)}`,
    `height:${px(geometry.height)}`,
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ]);
}

function placedAssetPreviewStyle() {
  return mergeCss([
    'position:absolute',
    'left:0px',
    'top:0px',
    'width:100%',
    'height:100%',
    'max-width:none',
    'max-height:none',
    'object-fit:fill',
  ]);
}

function vectorAttrsForItem(item, sourceNode, options) {
  const attrs = mergeAttributes(sourceNode.attributes);
  rewriteResourceAttrs(attrs, options);
  if (sourceNode.id) attrs.id = sourceNode.id;
  else attrs.id = item.id;
  attrs.viewBox = vectorViewBox(item);
  attrs.preserveAspectRatio = 'none';
  attrs['data-id-vector'] = item.vectorGeometry && item.vectorGeometry.kind || 'path';
  const classes = new Set(authorClassesForItem(item, sourceNode.classList || [], attrs));
  if (!hasSourceNode(sourceNode) && item.role !== 'text' && !item.virtual) classes.add('id-object');
  if (options.mode === 'observation') classes.add('id-object');
  if (item.parentPageItem) {
    classes.add('id-parent-page-object');
    addParentPageAttrs(attrs, item);
  }
  if (options.mode === 'observation') attrs['data-id-object'] = '';
  if (isUsefulSemantic(item.semantic)) attrs['data-id-semantic'] = item.semantic;
  addObservedLabelAttrs(attrs, item);
  const sourceStyle = sourceStyleForItem(item, sourceNode, classes);
  const style = mergeCss([sourceStyle, 'overflow:visible', blendModeCss(item.visualStyle && item.visualStyle.blendMode), zIndexStyle(item.zIndex)]);
  if (style) attrs.style = style;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  return svgAttrsToHtml(orderAttrs(attrs));
}

function attrsForItem(item, sourceNode, options) {
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item, tag));
  sanitizeRetiredAssetAttrs(attrs, item);
  rewriteResourceAttrs(attrs, options);
  const preserveTrustedSource = shouldPreserveTrustedSource(item, sourceNode, options);
  if (sourceNode.id) {
    attrs.id = sourceNode.id;
  } else if (!item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs.id = item.id;
  }
  const classes = new Set(preserveTrustedSource
    ? (sourceNode.classList || [])
    : authorClassesForItem(item, sourceNode.classList || [], attrs));
  if (!hasSourceNode(sourceNode) && item.role !== 'text' && !item.virtual) classes.add('id-object');
  if (options.mode === 'observation' && item.role === 'text') classes.add('observed-text');
  if (options.mode === 'observation') classes.add('id-object');
  if (item.parentPageItem) {
    classes.add('id-parent-page-object');
    addParentPageAttrs(attrs, item);
  }
  if (!classes.size && !hasSourceNode(sourceNode)) classes.add(classForRole(item.role));
  const sourceStyle = sourceStyleForItem(item, sourceNode, classes);
  const mergedStyle = preserveTrustedSource ? sourceStyle : authorInlineStyleForItem(item, sourceStyle);
  if (mergedStyle) attrs.style = mergedStyle;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text' && !item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs['data-id-object'] = '';
  }
  if (isUsefulSemantic(item.semantic)) attrs['data-id-semantic'] = item.semantic;
  if (!preserveTrustedSource) addObservedLabelAttrs(attrs, item);
  return attrsToHtml(orderAttrs(attrs));
}

function addParentPageAttrs(attrs, item) {
  const parentName = item.parentPageName || item.parentPageId || '';
  if (parentName) attrs['data-id-parent-page-item'] = parentName;
  if (item.parentPageSourceId) attrs['data-id-parent-page-source-id'] = item.parentPageSourceId;
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
    'data-id-ignore': '',
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
  const page = positiveIntegerOrNull(attrs['data-id-pdf-page'] ?? assetPdfPageNumber(item.asset));
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

function sourceNodeForItem(item) {
  return item && item.effectiveLabel && item.effectiveLabel.sourceNode || item.sourceNode || {};
}

function shouldPreserveTrustedSource(item, sourceNode, options = {}) {
  if (!options.preserveTrustedSource || options.mode === 'observation') return false;
  if (!hasSourceNode(sourceNode)) return false;
  if (item && item.virtual) return false;
  return true;
}

function sourceStyleForItem(item, sourceNode, classes) {
  const rawStyle = sourceNode && sourceNode.attributes && sourceNode.attributes.style || '';
  const gridStyle = item && item.layout && item.layout.cssVars && classes.has('grid-item')
    ? cssVarsStyle(item.layout.cssVars)
    : '';
  return mergeCss([rawStyle, gridStyle]);
}

function cssVarsStyle(cssVars) {
  return Object.entries(cssVars || {}).map(([name, value]) => `${name}:${value}`).join(';');
}

function addObservedLabelAttrs(attrs, item) {
  const status = item && item.labelStatus;
  if (!status || status === 'accepted') return;
  attrs['data-id-observed-label-status'] = status;
  const reasons = item.rejectionReasons || item.observedLabel && item.observedLabel.rejectionReasons || [];
  if (reasons.length) attrs['data-id-observed-reasons'] = reasons.join(' ');
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
  for (const name of ['src', 'data', 'href', 'data-id-preview-src', 'data-id-source-csv', 'data-id-source-xml']) {
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

function assetAttributes(item, tagName) {
  const nodeAttrs = (item.sourceNode && item.sourceNode.attributes) || {};
  const asset = item.sourceAsset || item.asset || {};
  const tag = String(tagName || item.sourceNode && item.sourceNode.tagName || '').toLowerCase();
  const out = {};
  const previewPath = assetPreviewPath(asset);
  if (tag === 'img' && !nodeAttrs.src && asset.path) out.src = shouldUsePreviewImage(asset) && previewPath ? previewPath : asset.path;
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.data && asset.path) out.data = asset.path;
  const kind = assetKind(asset);
  if ((tag === 'object' || tag === 'embed') && !nodeAttrs.type && kind === 'pdf') out.type = 'application/pdf';
  if (asset.path && !nodeAttrs['data-id-asset-path']) out['data-id-asset-path'] = asset.path;
  if (kind && !nodeAttrs['data-id-asset-kind']) out['data-id-asset-kind'] = kind;
  if (previewPath && !nodeAttrs['data-id-preview-src']) out['data-id-preview-src'] = previewPath;
  addAssetPlacementAttrs(out, nodeAttrs, asset, item);
  if (tag === 'img' && !nodeAttrs.alt && asset.path) out.alt = fileStem(asset.path);
  return out;
}

function tagForAsset(item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset);
  if (!asset || !asset.path) return '';
  const kind = assetKind(asset);
  const ext = fileExtension(asset.path);
  if (shouldUsePreviewImage(asset)) return 'img';
  if (kind === 'pdf' || ext === 'pdf') return 'object';
  if (kind === 'svg' || ext === 'svg') return 'img';
  if (kind === 'image' || kind === 'raster' || ['png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'bmp', 'tif', 'tiff'].includes(ext)) return 'img';
  return 'object';
}

function assetKind(asset) {
  const ext = fileExtension(asset && asset.path);
  if (ext === 'pdf' || ext === 'ai' || ext === 'psd' || ext === 'svg') return ext;
  const raw = String(asset && (asset.kind || asset.graphicType || asset.imageTypeName) || '').toLowerCase();
  if (raw === 'pdf' || raw.includes('adobe pdf')) return 'pdf';
  if (raw === 'psd' || raw.includes('photoshop')) return 'psd';
  if (raw === 'ai' || raw.includes('illustrator')) return 'ai';
  if (raw === 'image') return 'image';
  if (raw === 'raster') return 'raster';
  return raw || '';
}

function shouldUsePreviewImage(asset) {
  if (!assetPreviewPath(asset)) return false;
  return ['pdf', 'ai', 'psd'].includes(assetKind(asset));
}

function usesGeneratedFramePreview(asset) {
  const preview = asset && asset.preview;
  return shouldUsePreviewImage(asset) && preview && typeof preview === 'object' && preview.source === 'indesign-frame-export';
}

function assetPreviewPath(asset) {
  const preview = asset && asset.preview;
  if (!preview) return '';
  if (typeof preview === 'string') return preview;
  return preview.path || preview.htmlPath || preview.relativePath || '';
}

function addAssetPlacementAttrs(out, nodeAttrs, asset, item) {
  const placement = asset && asset.placement || {};
  const kind = assetKind(asset);
  const pageNumber = kind === 'pdf' ? assetPdfPageNumber(asset) : (placement.pageNumber || asset.pageNumber || null);
  if (kind === 'pdf' && pageNumber != null && !nodeAttrs['data-id-pdf-page']) out['data-id-pdf-page'] = String(pageNumber);
  if (kind === 'ai') {
    const artboard = placement.artboard || asset.artboard || placement.pageNumber || asset.pageNumber || null;
    if (artboard != null && !nodeAttrs['data-id-artboard']) out['data-id-artboard'] = String(artboard);
  }
  const crop = placement.crop || placement.pdfCropName || asset.crop || null;
  if (crop && !nodeAttrs['data-id-crop']) out['data-id-crop'] = normalizeCropToken(crop);
  const visibleLayers = layerListAttr(placement.visibleLayers);
  if (visibleLayers && !nodeAttrs['data-id-visible-layers']) out['data-id-visible-layers'] = visibleLayers;
  const hiddenLayers = layerListAttr(placement.hiddenLayers);
  if (hiddenLayers && !nodeAttrs['data-id-hidden-layers']) out['data-id-hidden-layers'] = hiddenLayers;
  const geometry = assetContentGeometry(item || { asset });
  if (geometry) {
    if (!nodeAttrs['data-id-fit']) out['data-id-fit'] = 'manual';
    if (!nodeAttrs['data-id-content-x']) out['data-id-content-x'] = px(geometry.x);
    if (!nodeAttrs['data-id-content-y']) out['data-id-content-y'] = px(geometry.y);
    if (!nodeAttrs['data-id-content-width']) out['data-id-content-width'] = px(geometry.width);
    if (!nodeAttrs['data-id-content-height']) out['data-id-content-height'] = px(geometry.height);
    if (geometry.scaleX != null && !nodeAttrs['data-id-content-scale-x']) out['data-id-content-scale-x'] = formatNumber(geometry.scaleX);
    if (geometry.scaleY != null && !nodeAttrs['data-id-content-scale-y']) out['data-id-content-scale-y'] = formatNumber(geometry.scaleY);
  }
}

function sanitizeRetiredAssetAttrs(attrs, item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset) || {};
  const kind = assetKind(asset);
  if (kind === 'pdf' || kind === 'ai') delete attrs['data-id-page'];
  if (kind === 'pdf' && attrs['data-id-pdf-page'] != null && positiveIntegerOrNull(attrs['data-id-pdf-page']) == null) {
    delete attrs['data-id-pdf-page'];
  }
}

function assetPdfPageNumber(asset) {
  const kind = assetKind(asset);
  if (kind !== 'pdf') return null;
  const placement = asset && asset.placement || {};
  return positiveIntegerOrNull(placement.pageNumber ?? asset.pageNumber);
}

function assetContentGeometry(item) {
  const asset = item && (item.sourceAsset || item.asset || item.placedAsset) || {};
  const placement = asset.placement || {};
  let offset = placement.contentOffset || null;
  let size = placement.contentSize || null;
  const frameBounds = placement.frameBounds || item && item.bounds || null;
  const contentBounds = placement.contentBounds || null;
  if ((!offset || !size) && contentBounds && frameBounds) {
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
    x: numberOrZero(offset.x),
    y: numberOrZero(offset.y),
    width,
    height,
    scaleX: finiteOrNull(placement.contentScale && placement.contentScale.x),
    scaleY: finiteOrNull(placement.contentScale && placement.contentScale.y),
  };
}

function normalizeCropToken(value) {
  const text = String(value || '').trim();
  const key = text.toLowerCase();
  for (const token of ['media', 'bleed', 'trim', 'art', 'content']) {
    if (key === token || key.includes(token)) return token;
  }
  return text;
}

function layerListAttr(value) {
  if (!Array.isArray(value)) return '';
  return value.map((item) => String(item || '').trim()).filter(Boolean).join('|');
}

function fileExtension(value) {
  const clean = String(value || '').split(/[?#]/)[0];
  const index = clean.lastIndexOf('.');
  return index === -1 ? '' : clean.slice(index + 1).toLowerCase();
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

function shouldRenderVectorSvg(item, sourceNode, options = {}) {
  if (!hasVectorPaths(item)) return false;
  if (item.asset || item.table) return false;
  if (item.role === 'text' || item.role === 'graphic' || item.role === 'table') return false;
  return !hasSourceNode(sourceNode) || options.mode === 'observation';
}

function svgAttrsToHtml(attrs) {
  return attrsToHtml(attrs)
    .replace(/\bviewbox=/g, 'viewBox=')
    .replace(/\bpreserveaspectratio=/g, 'preserveAspectRatio=');
}

function zIndexStyle(zIndex) {
  return Number.isFinite(Number(zIndex)) ? `z-index:${formatNumber(zIndex)}` : '';
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

function isPdfObjectItem(item, sourceNode, tag) {
  if (tag !== 'object' && tag !== 'embed') return false;
  const attrs = sourceNode.attributes || {};
  const data = attrs.data || attrs.src || (item.asset && item.asset.path) || '';
  return String(attrs.type || '').toLowerCase() === 'application/pdf' || /\.pdf(?:[?#].*)?$/i.test(String(data));
}

function pdfPreviewPath(pdfPath, page) {
  const value = String(pdfPath || '');
  if (!/\.pdf(?:[?#].*)?$/i.test(value)) return '';
  const pageNumber = positiveIntegerOrNull(page);
  if (pageNumber == null) return '';
  return value.replace(/\.pdf(?:[?#].*)?$/i, `-page${pageNumber}.png`);
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
  return Boolean(sourceNode && sourceNode.tagName && !sourceNode.generatedFrame);
}

function isUsefulCharacterStyle(value) {
  const name = String(value || '').trim();
  return Boolean(name && name !== '[无]' && !/^自动字符-/i.test(name));
}

function isUsefulSemantic(value) {
  const semantic = String(value || '').trim();
  return Boolean(semantic && semantic !== 'unknown');
}

function positiveIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return null;
  return number;
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

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Math.round(number * 10000) / 10000);
}

function px(value) {
  return `${formatNumber(value)}px`;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function indent(spaces) {
  return ' '.repeat(spaces);
}

module.exports = {
  pageItemsToAuthorHtml,
  buildAuthorTree,
};
