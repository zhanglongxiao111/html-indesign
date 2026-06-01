const OBSERVATION_CAPABILITIES = Object.freeze({
  html: { read: 'observe-only', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
  pptx: { read: 'observe-only', write: 'unsupported', persist: 'lossless' },
});

const SOURCE_METADATA_CAPABILITIES = Object.freeze({
  html: { read: 'native', write: 'observe-only', persist: 'lossless' },
  indesign: { read: 'lossless', write: 'observe-only', persist: 'lossless' },
  pptx: { read: 'unsupported', write: 'unsupported', persist: 'lossless' },
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

function sourceMetadata(canonicalPath, currentPaths, type) {
  return {
    canonicalPath,
    currentPaths,
    fieldClass: 'sourceMetadata',
    lifecycle: 'active',
    owner: 'reverse-diagnostics',
    type,
    capabilities: SOURCE_METADATA_CAPABILITIES,
  };
}

module.exports = [
  observation('warnings', [], 'array'),
  observation('errors', [], 'array'),
  observation('fieldValidation', [], 'array'),
  observation('report', [], 'object'),
  observation('valid', [], 'boolean'),
  sourceMetadata('reverseMode', [], 'string'),
  observation('pages[].labelStatus', [], 'string'),
  observation('pages[].observedLabel', [], 'object'),
  observation('pages[].rejectedFields', [], 'object'),
  observation('pages[].rejectionReasons', [], 'array'),
  observation('pages[].items[].labelStatus', [], 'string'),
  observation('pages[].items[].rejectedFields', [], 'object'),
  observation('pages[].items[].rejectionReasons', [], 'array'),
];
