function observedLabelChild(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'label-protocol',
    type,
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
      pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
    },
    validation: {
      mayDriveStructuredCompilation: false,
    },
  };
}

function itemObservedLabelEntries() {
  const paths = [
    ['role', 'string'],
    ['semantic', 'string'],
    ['layout', 'object|string'],
    ['sourceNode', 'object'],
    ['sourceAncestorNodes', 'array'],
    ['sourceFile', 'string'],
    ['sourceText', 'string'],
    ['sourceHtml', 'string'],
    ['htmlTag', 'string'],
    ['className', 'string'],
    ['structure', 'object'],
    ['sourceRuns', 'array'],
    ['rejectionReasons', 'array'],
  ];
  return paths.map(([path, type]) => (
    observedLabelChild(
      `items[].observedLabel.${path}`,
      [`pages[].items[].observedLabel.${path}`],
      type,
    )
  ));
}

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
  ...itemObservedLabelEntries(),
];
