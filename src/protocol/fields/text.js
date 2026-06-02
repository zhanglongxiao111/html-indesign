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
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'approximate', persist: 'lossless' },
    },
    indesign: {
      snapshotPaths: ['textStyle'],
    },
  },
];
