const OBSERVATION_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
  pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
});

function observation(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'reverse-diagnostics',
    type,
    capabilities: OBSERVATION_CAPABILITIES,
    validation: {
      mayDriveStructuredCompilation: false,
    },
  };
}

function pageObservedLabelEntries() {
  return [
    observation('pages[].observedLabel.semantic', [], 'string'),
    observation('pages[].observedLabel.layout', [], 'object|string'),
    observation('pages[].observedLabel.parentPage', [], 'object'),
    observation('pages[].observedLabel.parentPageId', [], 'string'),
    observation('pages[].observedLabel.parentPageName', [], 'string'),
    observation('pages[].observedLabel.sourceFile', [], 'string'),
    observation('pages[].observedLabel.sourceNode', [], 'object'),
    observation('pages[].observedLabel.sourceAncestorNodes', [], 'array'),
    observation('pages[].observedLabel.sourceText', [], 'string'),
    observation('pages[].observedLabel.sourceHtml', [], 'string'),
    observation('pages[].observedLabel.htmlTag', [], 'string'),
    observation('pages[].observedLabel.className', [], 'string'),
    observation('pages[].observedLabel.sourceRuns', [], 'array'),
    observation('pages[].observedLabel.structure', [], 'object'),
    observation('pages[].observedLabel.grid', [], 'object'),
    observation('pages[].observedLabel.margins', [], 'object'),
    observation('pages[].observedLabel.rejectionReasons', [], 'array'),
  ];
}

module.exports = [
  observation('warnings', [], 'array'),
  observation('errors', [], 'array'),
  observation('fieldValidation', [], 'array'),
  observation('report', [], 'object'),
  observation('valid', [], 'boolean'),
  {
    canonicalPath: 'reverseMode',
    currentPaths: ['sourceNode.attributes.data-id-reverse-mode'],
    fieldClass: 'observation',
    lifecycle: 'active',
    owner: 'reverse-diagnostics',
    type: 'string',
    capabilities: OBSERVATION_CAPABILITIES,
    html: {
      readAttrs: ['data-id-reverse-mode'],
      writeAttrs: ['data-id-reverse-mode'],
    },
    validation: {
      mayDriveStructuredCompilation: false,
    },
  },
  observation('pages[].labelStatus', [], 'string'),
  observation('pages[].observedLabel', [], 'object'),
  ...pageObservedLabelEntries(),
  observation('pages[].rejectedFields', [], 'object'),
  observation('pages[].rejectionReasons', [], 'array'),
  observation('pages[].auditItems', [], 'array'),
  observation('pages[].auditItems[].parent', [], 'object'),
  observation('pages[].items[].labelStatus', [], 'string'),
  observation('pages[].items[].rejectedFields', [], 'object'),
  observation('pages[].items[].rejectionReasons', [], 'array'),
];
