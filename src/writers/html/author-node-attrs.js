const { HTML_DATA_ID_ATTRIBUTES } = require('../../protocol');
const { SYNTHESIZED_STYLE_TOKEN_RE } = require('../../semantic-model/synthesized-styles');
const { mergeAttributes, attrsToHtml } = require('./author-attribute-writer');
const { assetAttributes, sanitizeRetiredAssetAttrs, tagForAsset } = require('./author-asset-attrs');
const {
  authorInlineStyleForItem,
  authorClassesForItem,
  mergeCss,
  synthesizedOverrideStyle,
} = require('./author-style-attrs');
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
// 留在网格里、高度按读回钉住的对象：只剥纵向尺寸与纵向对齐。
const GRID_START_SOURCE_PROPERTY_RE = /^(?:(?:min-|max-)?(?:height|block-size)|align-self|place-self)$/;
const GRID_PLACEMENT_VAR_RE = /^--grid-(?:col|span|row|row-span)$/;

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
  // 对象 id 落在表格外的文本框包裹层上（读回对象就是那个文本框），表格本身不再带同一个 id。
  if (tableFrameWrapperFor(item, options)) delete attrs.id;
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
  const sourceStyle = reverseBoxSourceStyle(item, classes, sourceStyleForItem(item, sourceNode, classes), options);
  const preserveAcceptedSourceStyle = item && item.labelStatus === 'accepted' && hasSourceNode(sourceNode);
  let mergedStyle;
  if (preserveTrustedSource) mergedStyle = sourceStyle;
  else if (preserveAcceptedSourceStyle) {
    mergedStyle = mergeCss([synthesizedOverrideStyle(item, sourceStyle, options), readBackStackingCss(item, options)]);
  }
  else {
    mergedStyle = authorInlineStyleForItem(item, sourceStyle, {
      synthesizedStyles: options.synthesizedStyles,
      styleResidualReport: options.styleResidualReport,
      foldedBordersByContainer: options.foldedBordersByContainer,
    });
  }
  if (mergedStyle) attrs.style = mergedStyle;
  if (classes.size) attrs.class = Array.from(classes).join(' ');
  if (!hasDataIdObject(attrs) && item.role !== 'text' && !item.virtual && (!hasSourceNode(sourceNode) || options.mode === 'observation')) {
    attrs[HTML_DATA_ID_ATTRIBUTES.OBJECT] = '';
  }
  if (options.paragraphTextFrame) attrs[HTML_DATA_ID_ATTRIBUTES.ROLE] = 'text';
  if (isUsefulSemantic(item.semantic)) attrs[HTML_DATA_ID_ATTRIBUTES.SEMANTIC] = item.semantic;
  if (!preserveTrustedSource) addObservedLabelAttrs(attrs, item);
  return attrsToHtml(orderAttrs(attrs));
}

// 外框规划（author-reverse-geometry）给了读回兜底几何的对象：reverse-overrides.css 按读回 bounds 写外框，
// 源码 style 里的定位、尺寸、外边距会压过兜底，一并剥掉；退出网格的对象同时去掉 grid-item 类和 --grid-* 变量。
// 留在网格里、只是高度按读回钉住的对象，只剥掉源码里的纵向尺寸，网格变量照留。
function reverseBoxSourceStyle(item, classes, sourceStyle, options = {}) {
  const box = reverseBoxFor(item, options);
  if (!box) return sourceStyle;
  if (box.exitsGrid) classes.delete('grid-item');
  if (box.keepsGrid) {
    return filterDeclarations(sourceStyle, (property) => !GRID_START_SOURCE_PROPERTY_RE.test(property));
  }
  return filterDeclarations(sourceStyle, (property) => !SOURCE_BOX_PROPERTY_RE.test(property)
    && !(box.exitsGrid && GRID_PLACEMENT_VAR_RE.test(property)));
}

// 表格所在文本框的包裹层：'write' 由作者 HTML 写出器新写一层（外框规划标了 tableFrame）；
// 'source' 源码里已有同 id 的 data-id-ignore 包裹层（上一轮反向写出的），作为虚拟节点原样写出。
function tableFrameWrapperFor(item, options = {}) {
  if (!item || item.virtual || item.role !== 'table') return null;
  const inSourceWrapper = (item.sourceAncestorNodes || []).some((node) => node
    && node.id != null
    && String(node.id) === String(item.id)
    && Object.prototype.hasOwnProperty.call(node.attributes || {}, HTML_DATA_ID_ATTRIBUTES.IGNORE));
  if (inSourceWrapper) return 'source';
  const box = reverseBoxFor(item, options);
  return box && box.tableFrame ? 'write' : null;
}

// 源码包裹层写出为虚拟节点（id 形如 source:…），它的元素 id 取源码 id；
// 与读回对象同 id 的包裹层（读回的正是它）按该对象的外框规划处理。
function reverseBoxFor(item, options = {}) {
  const boxes = options.reverseBoxes;
  if (!boxes || !item) return null;
  const id = item.virtual ? item.sourceNode && item.sourceNode.id : item.id;
  return id != null && boxes.get(id) || null;
}

// 源码样式没有随包（未拷回源码 CSS）时，源码 class 上的 z-index 也不在包里：
// 保留源码内联样式的对象同样按读回 z 序写 z-index，否则会被兜底定位的对象压住。
function readBackStackingCss(item, options = {}) {
  if (options.sourceLayoutCarried) return '';
  const zIndex = Number(item && item.zIndex);
  return Number.isFinite(zIndex) ? `z-index:${Math.round(zIndex * 1000) / 1000}` : '';
}

function filterDeclarations(style, keepProperty) {
  return String(style || '')
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const index = declaration.indexOf(':');
      if (index <= 0) return false;
      return keepProperty(declaration.slice(0, index).trim().toLowerCase());
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
    if (!attrs[attr] && refs[key]) attrs[attr] = key === 'layer' ? layerToken(refs.layer, options) : refs[key];
  }
  addVisualStyleProtocolAttrs(attrs, item && item.visualStyle);
  // 合成样式 token 与显示名只取模型这一轮的分配；来源属性里上一轮的 synth token/名字一并替换或清掉。
  if (SYNTHESIZED_STYLE_TOKEN_RE.test(String(attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN] || ''))) {
    delete attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN];
    delete attrs[HTML_DATA_ID_ATTRIBUTES.STYLE_NAME];
  }
  if (refs.synthesizedToken) {
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

// 读回的是 InDesign 图层名（文字），作者 HTML 写语义键（text）：按作者包语义库
// styleNameMap.layers 反查。反查不到的人做图层名（图层 1）原样写，由包内语义库登记（#32）。
function layerToken(layerName, options = {}) {
  const map = options.layerTokenByName;
  const name = String(layerName).trim();
  return map && map.has(name) ? map.get(name) : name;
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
  attrsForItem,
  reverseBoxSourceStyle,
  tableFrameWrapperFor,
  sourceNodeForItem,
  shouldPreserveTrustedSource,
  sourceStyleForItem,
  cssVarsStyle,
  addParentPageAttrs,
  addObservedLabelAttrs,
  addStyleProtocolAttrs,
};
