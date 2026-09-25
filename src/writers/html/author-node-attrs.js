const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
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

// 外框由 reverse-overrides.css 按读回 bounds 写的对象，源码 style 里的定位、尺寸、外边距会压过兜底几何。
const SOURCE_BOX_PROPERTY_RE = /^(?:position|left|top|right|bottom|inset(?:-[a-z-]+)?|(?:min-|max-)?(?:width|height|inline-size|block-size)|margin(?:-[a-z-]+)?)$/;

function attrsForItem(item, sourceNode, options) {
  const tag = safeTag(sourceNode.tagName || tagForAsset(item) || item.tagName || tagForRole(item.role));
  const preserveTrustedSource = shouldPreserveTrustedSource(item, sourceNode, options);
  const attrs = preserveTrustedSource
    ? mergeAttributes(sourceNode.attributes)
    : mergeAttributes(sourceNode.attributes, assetAttributes(item, tag));
  sanitizeRetiredAssetAttrs(attrs, item);
  rewriteResourceAttrs(attrs, options);
  if (!preserveTrustedSource) addStyleProtocolAttrs(attrs, item, options);
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
  const sourceStyle = isVectorContainerChildWithReverseBox(item, options)
    ? stripSourceBoxStyle(sourceStyleForItem(item, sourceNode, classes))
    : sourceStyleForItem(item, sourceNode, classes);
  const preserveAcceptedSourceStyle = item && item.labelStatus === 'accepted' && hasSourceNode(sourceNode);
  const mergedStyle = preserveTrustedSource || preserveAcceptedSourceStyle ? sourceStyle : authorInlineStyleForItem(item, sourceStyle, {
    synthesizedStyles: options.synthesizedStyles,
    styleResidualReport: options.styleResidualReport,
    foldedBordersByContainer: options.foldedBordersByContainer,
  });
  if (mergedStyle) attrs.style = mergedStyle;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text' && !item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs[HTML_DATA_ID_ATTRIBUTES.OBJECT] = '';
  }
  if (isUsefulSemantic(item.semantic)) attrs[HTML_DATA_ID_ATTRIBUTES.SEMANTIC] = item.semantic;
  if (!preserveTrustedSource) addObservedLabelAttrs(attrs, item);
  return attrsToHtml(orderAttrs(attrs));
}

// 矢量容器（author-vector-renderer）的直接子对象按读回 bounds 绝对定位，
// 条件与 author-css-writer 写兜底几何一致：有 bounds、不走作者网格。
function isVectorContainerChildWithReverseBox(item, options = {}) {
  const containers = options.vectorContainerIds;
  const parentId = item && item.structure && item.structure.parentId;
  if (!containers || !parentId || !containers.has(parentId)) return false;
  return Boolean(item.bounds) && !(item.layout && item.layout.grid);
}

function stripSourceBoxStyle(sourceStyle) {
  return String(sourceStyle || '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const index = declaration.indexOf(':');
      if (index <= 0) return false;
      return !SOURCE_BOX_PROPERTY_RE.test(declaration.slice(0, index).trim().toLowerCase());
    })
    .join(';');
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
  const parentRef = item.parentPageId || item.parentPageName || '';
  if (parentRef) attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_ITEM] = parentRef;
  if (item.parentPageSourceId) attrs[HTML_DATA_ID_ATTRIBUTES.PARENT_PAGE_SOURCE_ID] = item.parentPageSourceId;
  if (item.placement && !attrs[HTML_DATA_ID_ATTRIBUTES.PLACEMENT]) {
    attrs[HTML_DATA_ID_ATTRIBUTES.PLACEMENT] = item.placement;
  }
}

function addObservedLabelAttrs(attrs, item) {
  const status = item && item.labelStatus;
  if (!status || status === 'accepted') return;
  attrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED_LABEL_STATUS] = status;
  const reasons = item.rejectionReasons || item.observedLabel && item.observedLabel.rejectionReasons || [];
  if (reasons.length) attrs[HTML_DATA_ID_ATTRIBUTES.OBSERVED_REASONS] = reasons.join(' ');
}

function addStyleProtocolAttrs(attrs, item, options = {}) {
  const refs = item && item.styleRefs || {};
  const textStyle = item && item.textStyle || {};
  const pairs = [
    ['paragraphStyle', HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE],
    ['characterStyle', HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE],
    ['objectStyle', HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE],
    ['frameStyle', HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE],
    ['tableStyle', HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE],
    ['cellStyle', HTML_DATA_ID_ATTRIBUTES.CELL_STYLE],
    ['layer', HTML_DATA_ID_ATTRIBUTES.LAYER],
  ];
  for (const [key, attr] of pairs) {
    if (!attrs[attr] && refs[key]) attrs[attr] = refs[key];
  }
  addVisualStyleProtocolAttrs(attrs, item && item.visualStyle);
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN] && refs.synthesizedToken) {
    attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN] = refs.synthesizedToken;
  }
  const displayPairs = [
    ['displayName', HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
    ['paragraphStyleDisplayName', HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE_NAME],
    ['characterStyleDisplayName', HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE_NAME],
    ['objectStyleDisplayName', HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE_NAME],
    ['frameStyleDisplayName', HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE_NAME],
    ['tableStyleDisplayName', HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE_NAME],
  ];
  for (const [key, attr] of displayPairs) {
    if (refs[key] && (!attrs[attr] || options.mode === 'observation')) attrs[attr] = refs[key];
  }
  if (refs.synthesizedName && (!attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_NAME] || options.mode === 'observation')) {
    attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_NAME] = refs.synthesizedName;
  }
  if (!attrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_COMPOSER] && textStyle.composer) {
    attrs[HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_COMPOSER] = textStyle.composer;
  }
}

function addVisualStyleProtocolAttrs(attrs, visualStyle) {
  if (!visualStyle || typeof visualStyle !== 'object' || Array.isArray(visualStyle)) return;
  setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_COLOR, visualStyle.strokeColor);
  if (Object.prototype.hasOwnProperty.call(visualStyle, 'strokeWeight')) {
    setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_WEIGHT, visualStyle.strokeWeight == null ? 0 : visualStyle.strokeWeight);
  }
  setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_STYLE, visualStyle.strokeStyle);
  setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.STROKE_ALIGNMENT, visualStyle.strokeAlignment);
  const startRawName = markerRawName(visualStyle.lineStartMarker);
  const endRawName = markerRawName(visualStyle.lineEndMarker);
  setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.LINE_START_MARKER_RAW_NAME, startRawName);
  setAttrIfMissing(attrs, HTML_DATA_ID_ATTRIBUTES.LINE_END_MARKER_RAW_NAME, endRawName);
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
  SOURCE_BOX_PROPERTY_RE,
  attrsForItem,
  sourceNodeForItem,
  shouldPreserveTrustedSource,
  sourceStyleForItem,
  cssVarsStyle,
  addParentPageAttrs,
  addObservedLabelAttrs,
  addStyleProtocolAttrs,
};
