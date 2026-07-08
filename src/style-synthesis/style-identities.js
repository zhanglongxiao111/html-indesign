const { HTML_DATA_ID_ATTRIBUTES } = require('../protocol');
const { createProtocolLabel } = require('../shared/labels');
const {
  explicitName,
  sanitizeStyleName,
} = require('../shared/style-utils');

function explicitFrameStyleName(item, options) {
  const attributes = item.attributes || {};
  const explicitDisplay = explicitName(attributes, styleDisplayAttributes('frameStyles'));
  if (explicitDisplay) return explicitDisplay;
  const token = styleTokenForKind(attributes, 'frameStyles');
  return mappedStyleName(token, 'frameStyles', options) || token || null;
}

function styleNameForKind(item, kind, signature, options) {
  const attributes = item.attributes || {};
  const explicitDisplay = explicitName(attributes, styleDisplayAttributes(kind));
  if (explicitDisplay) return explicitDisplay;
  const token = styleTokenForKind(attributes, kind);
  const mapped = mappedStyleName(token, kind, options);
  if (mapped) return mapped;
  if (token) return token;
  const className = styleClassNameForKind(item, kind);
  const mappedClass = mappedStyleName(className, kind, options);
  if (mappedClass) return mappedClass;
  return shouldUseUnmappedClassName(className, kind, options) ? className : null;
}

function classFrameStyleName(item, options) {
  const className = styleClassNameForKind(item, 'frameStyles');
  if (!className) return null;
  return mappedStyleName(`${className}-frame`, 'frameStyles', options)
    || mappedStyleName(className, 'frameStyles', options)
    || `${className}-frame`;
}

function styleTokenForKind(attributes, kind) {
  return explicitName(attributes || {}, styleTokenAttributes(kind));
}

function styleIdentityForKind(item, kind, name, options) {
  const attributes = item && item.attributes || {};
  const explicitDisplay = explicitName(attributes, styleDisplayAttributes(kind));
  const explicitToken = styleTokenForKind(attributes, kind);
  const className = styleClassNameForKind(item, kind);
  const token = explicitToken || className || name;
  const displayName = explicitDisplay || mappedStyleName(token, kind, options) || name;
  return {
    token: token || name,
    displayName: displayName || name,
  };
}

function styleProtocolLabel(kind, identity) {
  return createProtocolLabel({
    kind: 'style',
    id: identity.token,
    source: 'html-to-indesign',
    styleKind: kind,
    token: identity.token,
    displayName: identity.displayName,
  });
}

function mappedStyleName(token, kind, options) {
  if (!token || !options || !options.styleNameMap) return null;
  const map = options.styleNameMap;
  return (map[kind] && map[kind][token]) || map[token] || null;
}

function styleDisplayAttributes(kind) {
  const byKind = {
    paragraphStyles: [HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE_NAME, HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
    characterStyles: [HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE_NAME, HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
    objectStyles: [HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE_NAME, HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
    frameStyles: [HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE_NAME, HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
    tableStyles: [HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE_NAME, HTML_DATA_ID_ATTRIBUTES.STYLE_NAME],
  };
  return byKind[kind] || [];
}

function styleTokenAttributes(kind) {
  const byKind = {
    paragraphStyles: [HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE, HTML_DATA_ID_ATTRIBUTES.STYLE],
    characterStyles: [HTML_DATA_ID_ATTRIBUTES.CHARACTER_STYLE, HTML_DATA_ID_ATTRIBUTES.STYLE],
    objectStyles: [HTML_DATA_ID_ATTRIBUTES.OBJECT_STYLE, HTML_DATA_ID_ATTRIBUTES.STYLE],
    frameStyles: [HTML_DATA_ID_ATTRIBUTES.FRAME_STYLE],
    tableStyles: [HTML_DATA_ID_ATTRIBUTES.TABLE_STYLE],
  };
  return byKind[kind] || [];
}

function styleClassNameForKind(item, kind) {
  const ownPrefix = styleClassPrefix(kind);
  for (const value of item && item.classList || []) {
    const className = sanitizeStyleName(value);
    if (!className) continue;
    const prefix = detectedStyleClassPrefix(className);
    if (prefix) {
      if (prefix !== ownPrefix) continue;
      const stripped = sanitizeStyleName(className.slice(prefix.length));
      if (stripped) return stripped;
      continue;
    }
    if (isUtilityClass(className)) continue;
    return className;
  }
  return null;
}

function detectedStyleClassPrefix(className) {
  const lower = String(className || '').toLowerCase();
  return ['cellstyle-', 'pstyle-', 'cstyle-', 'ostyle-', 'fstyle-', 'tstyle-']
    .find((prefix) => lower.startsWith(prefix)) || null;
}

function styleClassPrefix(kind) {
  const byKind = {
    paragraphStyles: 'pstyle-',
    characterStyles: 'cstyle-',
    objectStyles: 'ostyle-',
    frameStyles: 'fstyle-',
    tableStyles: 'tstyle-',
    cellStyles: 'cellstyle-',
  };
  return byKind[kind] || null;
}

function isUtilityClass(className) {
  return [
    'id-object',
    'observed-text',
    'id-parent-page-object',
    'grid-item',
  ].includes(String(className || '').toLowerCase());
}

function shouldUseUnmappedClassName(className, kind, options) {
  if (!className) return false;
  if (kind === 'frameStyles') return false;
  if (!options || !options.styleNameMap) return true;
  return !/[A-Za-z]/.test(className);
}

module.exports = {
  explicitFrameStyleName,
  styleNameForKind,
  classFrameStyleName,
  styleTokenForKind,
  styleIdentityForKind,
  styleProtocolLabel,
};
