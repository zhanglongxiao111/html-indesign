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

module.exports = {
  attrsForItem,
  sourceNodeForItem,
  shouldPreserveTrustedSource,
  sourceStyleForItem,
  cssVarsStyle,
  addParentPageAttrs,
  addObservedLabelAttrs,
};
