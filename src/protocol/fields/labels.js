module.exports = [
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
    },
  },
  {
    canonicalPath: 'items[].semantic',
    currentPaths: ['labels[].semantic', 'items[].effectiveLabel.semantic'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
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
    },
  },
  {
    canonicalPath: 'items[].role',
    currentPaths: ['labels[].role', 'items[].effectiveLabel.role'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'string',
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
      instructionPaths: ['role'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.items[].role'],
    },
  },
  {
    canonicalPath: 'items[].styleRefs',
    currentPaths: ['labels[].styleRefs'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'style-refs',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['styleRefs'],
    },
  },
];
