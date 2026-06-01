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
      labelKinds: ['document'],
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
      labelPaths: ['document.profile', 'profile'],
      labelKinds: ['document'],
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
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].id'],
    },
  },
  {
    canonicalPath: 'pages[].layout',
    currentPaths: ['pages[].semanticLayout', 'labels[].layout', 'pages[].effectiveLabel.layout'],
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
      labelPaths: ['page.layout', 'layout'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].layout'],
    },
  },
  {
    canonicalPath: 'pages[].parentPage',
    currentPaths: ['labels[].parentPage', 'pages[].effectiveLabel.parentPage'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['parentPage'],
      labelKinds: ['page'],
    },
  },
  {
    canonicalPath: 'pages[].parentPageId',
    currentPaths: ['labels[].parentPageId', 'pages[].effectiveLabel.parentPageId'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['parentPageId'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].parentPageId'],
    },
  },
  {
    canonicalPath: 'pages[].parentPageName',
    currentPaths: ['labels[].parentPageName', 'pages[].effectiveLabel.parentPageName'],
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'string',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['parentPageName'],
      labelKinds: ['page'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].parentPageName'],
    },
  },
  {
    canonicalPath: 'pages[].margins',
    currentPaths: ['labels[].margins', 'pages[].effectiveLabel.margins'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document-page',
    type: 'object',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'lossless', write: 'lossless', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      labelPaths: ['margins'],
      labelKinds: ['page'],
    },
  },
  {
    canonicalPath: 'pages[].grid',
    currentPaths: ['labels[].grid', 'sourceNode.attributes.data-id-grid', 'pages[].effectiveLabel.grid'],
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
      labelKinds: ['page'],
      instructionPaths: ['guides.grid'],
    },
    pptx: {
      customDataPaths: ['htmlIndesign.pages[].grid'],
    },
  },
];
