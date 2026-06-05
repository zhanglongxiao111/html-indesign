const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const { assetAttributes, sanitizeRetiredAssetAttrs, tagForAsset } = require('./author-asset-attrs');
const { authorInlineStyleForItem, authorClassesForItem, mergeCss } = require('./author-style-attrs');
const { rewriteResourceAttrs } = require('./author-resource-paths');
const {
  classForRole,
  hasDataIdObject,
  hasSourceNode,
  isUsefulSemantic,
  orderAttrs,
  safeTag,
  tagForRole,
} = require('./author-render-utils');

function attrsForItem(item, sourceNode, options) {
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  const attrs = mergeAttributes(sourceNode.attributes, assetAttributes(item, tag));
  sanitizeRetiredAssetAttrs(attrs, item);
  rewriteResourceAttrs(attrs, options);
  addStyleProtocolAttrs(attrs, item, options);
  const preserveTrustedSource = shouldPreserveTrustedSource(item, sourceNode, options);
  if (sourceNode.id) {
    attrs.id = sourceNode.id;
  } else if (preserveTrustedSource && item.id) {
    attrs.id = item.id;
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

function addParentPageAttrs(attrs, item) {
  const parentName = item.parentPageName || item.parentPageId || '';
  if (parentName) attrs['data-id-parent-page-item'] = parentName;
  if (item.parentPageSourceId) attrs['data-id-parent-page-source-id'] = item.parentPageSourceId;
}

function addObservedLabelAttrs(attrs, item) {
  const status = item && item.labelStatus;
  if (!status || status === 'accepted') return;
  attrs['data-id-observed-label-status'] = status;
  const reasons = item.rejectionReasons || item.observedLabel && item.observedLabel.rejectionReasons || [];
  if (reasons.length) attrs['data-id-observed-reasons'] = reasons.join(' ');
}

function addStyleProtocolAttrs(attrs, item, options = {}) {
  const refs = item && item.styleRefs || {};
  const textStyle = item && item.textStyle || {};
  const pairs = [
    ['paragraphStyle', 'data-id-paragraph-style'],
    ['characterStyle', 'data-id-character-style'],
    ['objectStyle', 'data-id-object-style'],
    ['frameStyle', 'data-id-frame-style'],
    ['tableStyle', 'data-id-table-style'],
    ['cellStyle', 'data-id-cell-style'],
    ['layer', 'data-id-layer'],
  ];
  for (const [key, attr] of pairs) {
    if (!attrs[attr] && refs[key]) attrs[attr] = refs[key];
  }
  addVisualStyleProtocolAttrs(attrs, item && item.visualStyle);
  if (!attrs['data-id-style-token'] && refs.synthesizedToken) {
    attrs['data-id-style-token'] = refs.synthesizedToken;
  }
  const displayPairs = [
    ['displayName', 'data-id-style-name'],
    ['paragraphStyleDisplayName', 'data-id-paragraph-style-name'],
    ['characterStyleDisplayName', 'data-id-character-style-name'],
    ['objectStyleDisplayName', 'data-id-object-style-name'],
    ['frameStyleDisplayName', 'data-id-frame-style-name'],
    ['tableStyleDisplayName', 'data-id-table-style-name'],
  ];
  for (const [key, attr] of displayPairs) {
    if (refs[key] && (!attrs[attr] || options.mode === 'observation')) attrs[attr] = refs[key];
  }
  if (refs.synthesizedName && (!attrs['data-id-style-name'] || options.mode === 'observation')) {
    attrs['data-id-style-name'] = refs.synthesizedName;
  }
  if (!attrs['data-id-paragraph-composer'] && textStyle.composer) {
    attrs['data-id-paragraph-composer'] = textStyle.composer;
  }
}

function addVisualStyleProtocolAttrs(attrs, visualStyle) {
  if (!visualStyle || typeof visualStyle !== 'object' || Array.isArray(visualStyle)) return;
  setAttrIfMissing(attrs, 'data-id-stroke-color', visualStyle.strokeColor);
  if (Object.prototype.hasOwnProperty.call(visualStyle, 'strokeWeight')) {
    setAttrIfMissing(attrs, 'data-id-stroke-weight', visualStyle.strokeWeight == null ? 0 : visualStyle.strokeWeight);
  }
  setAttrIfMissing(attrs, 'data-id-stroke-style', visualStyle.strokeStyle);
  setAttrIfMissing(attrs, 'data-id-stroke-alignment', visualStyle.strokeAlignment);
  const startRawName = markerRawName(visualStyle.lineStartMarker);
  const endRawName = markerRawName(visualStyle.lineEndMarker);
  setAttrIfMissing(attrs, 'data-id-line-start-marker-raw-name', startRawName);
  setAttrIfMissing(attrs, 'data-id-line-end-marker-raw-name', endRawName);
}

function setAttrIfMissing(attrs, name, value) {
  if (attrs[name] || value === null || typeof value === 'undefined' || value === '') return;
  attrs[name] = formatAttrValue(value);
}

function markerRawName(marker) {
  if (!marker || typeof marker !== 'object') return null;
  return marker.rawName || null;
}

function formatAttrValue(value) {
  const number = Number(value);
  if (Number.isFinite(number) && String(value).trim() !== '') {
    return String(Math.round(number * 10000) / 10000);
  }
  return String(value);
}

module.exports = {
  attrsForItem,
  sourceNodeForItem,
  shouldPreserveTrustedSource,
  sourceStyleForItem,
  cssVarsStyle,
  addParentPageAttrs,
  addObservedLabelAttrs,
  addStyleProtocolAttrs,
};
