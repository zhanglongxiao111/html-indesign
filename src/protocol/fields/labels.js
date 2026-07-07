const LABEL_PAYLOAD_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
});

const ALL_LABEL_KINDS = Object.freeze(['document', 'page', 'item', 'style', 'layer', 'parentPage']);
const STYLE_LABEL_KINDS = Object.freeze(['style']);
const STYLE_AND_LAYER_LABEL_KINDS = Object.freeze(['style', 'layer']);
const PAGE_AND_ITEM_LABEL_KINDS = Object.freeze(['page', 'item']);
const SEMANTIC_LABEL_KINDS = Object.freeze(['page', 'item', 'parentPage']);
const STYLE_REF_ALLOWED_KEYS = Object.freeze([
  'paragraphStyle',
  'characterStyle',
  'objectStyle',
  'frameStyle',
  'tableStyle',
  'cellStyle',
  'paragraphStyleDisplayName',
  'characterStyleDisplayName',
  'objectStyleDisplayName',
  'frameStyleDisplayName',
  'tableStyleDisplayName',
  'displayName',
  'genericStyle',
  'synthesizedToken',
  'synthesizedName',
  'layer',
]);

function labelPayloadMetadata(canonicalPath, type = 'string', labelKinds = ALL_LABEL_KINDS) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type,
    capabilities: LABEL_PAYLOAD_METADATA_CAPABILITIES,
    indesign: {
      labelPaths: [canonicalPath.slice('labels[].'.length)],
      labelKinds,
    },
  };
}

module.exports = [
  labelPayloadMetadata('labels[].name', 'string', ['parentPage']),
  labelPayloadMetadata('labels[].token', 'string', STYLE_AND_LAYER_LABEL_KINDS),
  labelPayloadMetadata('labels[].displayName', 'string', ['style', 'layer', 'parentPage']),
  labelPayloadMetadata('labels[].styleKind', 'string', STYLE_LABEL_KINDS),
  labelPayloadMetadata('labels[].htmlClass', 'string', STYLE_LABEL_KINDS),
  {
    canonicalPath: 'labels[].protocol',
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['protocol'],
      labelKinds: ALL_LABEL_KINDS,
    },
  },
  {
    canonicalPath: 'labels[].version',
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'number',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['version'],
      labelKinds: ALL_LABEL_KINDS,
    },
  },
  {
    canonicalPath: 'labels[].kind',
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['kind'],
      labelKinds: ALL_LABEL_KINDS,
    },
  },
  {
    canonicalPath: 'labels[].id',
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['id'],
      labelKinds: ALL_LABEL_KINDS,
    },
  },
  {
    canonicalPath: 'labels[].source',
    currentPaths: [],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['source'],
      labelKinds: ALL_LABEL_KINDS,
    },
  },
  {
    canonicalPath: 'items[].semantic',
    currentPaths: ['labels[].semantic', 'items[].effectiveLabel.semantic'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    defaultValue: null,
    description: 'Canonical item semantic token. Defaults to null when no accepted semantic is present.',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-semantic'],
      writeAttrs: ['data-id-semantic'],
    },
    indesign: {
      labelPaths: ['semantic'],
      labelKinds: SEMANTIC_LABEL_KINDS,
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].semantic'],
    },
  },
  {
    canonicalPath: 'items[].layout',
    currentPaths: ['pages[].items[].layout', 'items[].effectiveLabel.layout'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'object|string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['layout'],
      labelKinds: ['item'],
    },
  },
  {
    canonicalPath: 'items[].role',
    currentPaths: ['labels[].role', 'items[].effectiveLabel.role'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
    description: 'Canonical semantic role for an item.',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-role'],
      writeAttrs: ['data-id-role'],
    },
    indesign: {
      labelPaths: ['role'],
      labelKinds: ['item'],
      instructionPaths: ['role'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].role'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs',
    currentPaths: ['labels[].styleRefs', 'items[].effectiveLabel.styleRefs'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'object',
    description: 'Canonical style reference object; only registered allowedKeys are valid styleRefs members.',
    allowedKeys: STYLE_REF_ALLOWED_KEYS,
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['styleRefs'],
      labelKinds: ['item'],
    },
  },
];
