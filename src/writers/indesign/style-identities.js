const { createProtocolLabel } = require('../../shared/labels');
const {
  firstClassName,
  explicitName,
} = require('../../shared/style-utils');

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
  const className = firstClassName(item);
  const mappedClass = mappedStyleName(className, kind, options);
  if (mappedClass) return mappedClass;
  return signature ? null : firstClassName(item);
}

function classFrameStyleName(item, options) {
  const className = firstClassName(item);
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
  const className = firstClassName(item);
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
    paragraphStyles: ['data-id-paragraph-style-name', 'data-id-style-name'],
    characterStyles: ['data-id-character-style-name', 'data-id-style-name'],
    objectStyles: ['data-id-object-style-name', 'data-id-style-name'],
    frameStyles: ['data-id-frame-style-name', 'data-id-style-name'],
    tableStyles: ['data-id-table-style-name', 'data-id-style-name'],
  };
  return byKind[kind] || [];
}

function styleTokenAttributes(kind) {
  const byKind = {
    paragraphStyles: ['data-id-paragraph-style', 'data-id-style'],
    characterStyles: ['data-id-character-style', 'data-id-style'],
    objectStyles: ['data-id-object-style', 'data-id-style'],
    frameStyles: ['data-id-frame-style'],
    tableStyles: ['data-id-table-style'],
  };
  return byKind[kind] || [];
}

module.exports = {
  explicitFrameStyleName,
  styleNameForKind,
  classFrameStyleName,
  styleTokenForKind,
  styleIdentityForKind,
  styleProtocolLabel,
};
