module.exports = [
  {
    canonicalPath: 'items[].content.text',
    currentPaths: ['items[].text', 'instructions.pages[].items[].text'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'native', persist: 'lossless' },
    },
    indesign: {
      snapshotPaths: ['text'],
      instructionPaths: ['text'],
    },
  },
  {
    canonicalPath: 'items[].content.runs',
    currentPaths: ['items[].textRuns'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'array',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'text-runs' },
    },
    indesign: {
      snapshotPaths: ['textRuns'],
      instructionPaths: ['textRuns'],
    },
  },
  {
    canonicalPath: 'items[].textStyle',
    currentPaths: ['reverseModel.pages[].items[].textStyle'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    indesign: {
      snapshotPaths: ['textStyle'],
    },
  },
  {
    canonicalPath: 'items[].textStyle.composer',
    currentPaths: [
      'reverseModel.pages[].items[].textStyle.composer',
      'sourceNode.attributes.data-id-paragraph-composer',
    ],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'observe-only', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    html: {
      readAttrs: ['data-id-paragraph-composer'],
      writeAttrs: ['data-id-paragraph-composer'],
    },
    indesign: {
      snapshotPaths: ['textStyle.composer'],
    },
  },
  {
    canonicalPath: 'styles.paragraphStyles[].composer',
    currentPaths: ['styles.paragraphStyles[].composer'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'text-content',
    type: 'string',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'observe-only', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless', fallbackKind: 'customData' },
    },
    indesign: {
      instructionPaths: ['styles.paragraphStyles[].composer'],
    },
  },
  {
    canonicalPath: 'items[].extensions.indesign.textFit',
    currentPaths: ['instructions.pages[].items[].textFit'],
    fieldClass: 'formatExtension',
    lifecycle: 'active',
    owner: 'indesign-writer',
    type: 'object',
    description: 'Derived InDesign executor policy for bounded text-frame growth when browser-visible text would otherwise become overset.',
    capabilities: {
      html: { read: 'native', write: 'unsupported', persist: 'lossless' },
      indesign: { read: 'unsupported', write: 'native', persist: 'lossless' },
      pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
    },
    indesign: {
      instructionPaths: ['textFit'],
    },
  },
];
