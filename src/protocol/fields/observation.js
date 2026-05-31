module.exports = [
  {
    canonicalPath: 'items[].observedLabel',
    currentPaths: ['pages[].items[].observedLabel'],
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'label-protocol',
    type: 'object',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
      pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-observed-label-status', 'data-id-observed-reasons'],
      writeAttrs: ['data-id-observed-label-status', 'data-id-observed-reasons'],
    },
    validation: {
      mayDriveStructuredCompilation: false,
    },
  },
];
