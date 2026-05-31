module.exports = [
  {
    canonicalPath: 'document.id',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-document'],
      writeAttrs: ['data-id-document'],
    },
    indesign: {
      labelPaths: ['document.id'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.document.id'],
    },
  },
  {
    canonicalPath: 'document.profile',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-profile'],
      writeAttrs: ['data-id-profile'],
    },
    indesign: {
      labelPaths: ['document.profile'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.document.profile'],
    },
  },
  {
    canonicalPath: 'pages[].id',
    currentPaths: ['snapshot.pages[].id', 'reverseModel.pages[].id'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-page'],
      writeAttrs: ['data-page'],
    },
    indesign: {
      labelPaths: ['page.id'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].id'],
    },
  },
  {
    canonicalPath: 'pages[].layout',
    currentPaths: ['pages[].semanticLayout'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-layout'],
      writeAttrs: ['data-id-layout'],
    },
    indesign: {
      labelPaths: ['page.layout'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].layout'],
    },
  },
  {
    canonicalPath: 'pages[].grid',
    currentPaths: ['labels[].grid', 'sourceNode.attributes.data-id-grid'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-grid'],
      writeAttrs: ['data-id-grid'],
    },
    indesign: {
      labelPaths: ['page.grid'],
      instructionPaths: ['guides.grid'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].grid'],
    },
  },
];
