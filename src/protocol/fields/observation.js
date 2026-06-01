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

function migrationObservation(canonicalPath, htmlAttr, type) {
  return {
    canonicalPath,
    currentPaths: [`sourceNode.attributes.${htmlAttr}`],
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'reverse-model',
    type,
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
      pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: [htmlAttr],
      writeAttrs: [htmlAttr],
    },
    validation: {
      mayDriveStructuredCompilation: false,
    },
  };
}

module.exports = [
  {
    canonicalPath: 'pages[].observed',
    currentPaths: ['pages[].observed', 'sourceNode.attributes.data-id-observed'],
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'reverse-model',
    type: 'boolean|string',
    capabilities: {
      html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
      indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
      pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
    },
    html: {
      readAttrs: ['data-id-observed'],
      writeAttrs: ['data-id-observed'],
    },
    validation: {
      mayDriveStructuredCompilation: false,
    },
  },
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
  migrationObservation('items[].migration.isSlot', 'data-id-migration-slot', 'boolean|string'),
  migrationObservation('items[].migration.slotName', 'data-id-slot-name', 'string'),
  migrationObservation('items[].migration.slotType', 'data-id-slot-type', 'string'),
  migrationObservation('items[].migration.confidence', 'data-id-confidence', 'number|string'),
  ...itemObservedLabelEntries(),
];
