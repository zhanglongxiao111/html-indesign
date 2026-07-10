const AUTHORING_CANONICAL_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'native', persist: 'native' },
  indesign: { read: 'observe-only', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
});

function objectPolicyField(canonicalPath, currentPaths, htmlAttr, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'html-authoring',
    type,
    capabilities: AUTHORING_CANONICAL_CAPABILITIES,
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    indesign: {
      labelPaths: [canonicalPath.slice('items[].'.length)],
      labelKinds: ['item'],
    },
    pptx: {
      customDataPaths: [`htmlIndesign.${canonicalPath}`],
    },
  };
}

module.exports = [
  objectPolicyField(
    'items[].objectPolicy.forceObject',
    [
      'sourceNode.attributes.data-id-object',
      'labels[].sourceNode.attributes.data-id-object',
      'pages[].items[].sourceNode.attributes.data-id-object',
    ],
    'data-id-object',
    'boolean|string',
  ),
  objectPolicyField(
    'items[].objectPolicy.ignore',
    [
      'sourceNode.attributes.data-id-ignore',
      'labels[].sourceNode.attributes.data-id-ignore',
      'pages[].items[].sourceNode.attributes.data-id-ignore',
    ],
    'data-id-ignore',
    'boolean|string',
  ),
  objectPolicyField(
    'items[].authoring.gridIgnore',
    [
      'sourceNode.attributes.data-id-grid-ignore',
      'pages[].items[].sourceNode.attributes.data-id-grid-ignore',
    ],
    'data-id-grid-ignore',
    'boolean|string',
  ),
  objectPolicyField(
    'items[].authoring.guideIgnore',
    [
      'sourceNode.attributes.data-id-guide-ignore',
      'pages[].items[].sourceNode.attributes.data-id-guide-ignore',
    ],
    'data-id-guide-ignore',
    'boolean|string',
  ),
  objectPolicyField(
    'items[].placement',
    [
      'sourceNode.attributes.data-id-placement',
      'pages[].items[].sourceNode.attributes.data-id-placement',
      'pages[].items[].placement',
      'pages[].parentPageItems[].placement',
      'parentPages[].items[].placement',
    ],
    'data-id-placement',
    'string',
  ),
];
