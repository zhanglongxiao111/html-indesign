module.exports = [
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
    canonicalPath: 'items[].role',
    currentPaths: ['labels[].role'],
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
];
