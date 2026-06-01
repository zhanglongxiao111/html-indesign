const PPTX_FORMAT_EXTENSIONS = Object.freeze([
  'extensions.pptx.animation',
  'extensions.pptx.transition',
  'extensions.pptx.placeholder',
  'extensions.pptx.speakerNotes',
]);

const PptxReaderContract = Object.freeze({
  kind: 'pptx-reader-contract',
  contractOnly: true,
  input: 'pptx-package',
  output: 'pptx-raw-snapshot',
  normalizerOutput: 'semantic-model',
  supportedFacts: Object.freeze([
    'slides',
    'masters',
    'layouts',
    'shapes',
    'textBoxes',
    'tables',
    'charts',
    'media',
    'customData',
  ]),
  formatExtensions: PPTX_FORMAT_EXTENSIONS,
});

const PptxWriterContract = Object.freeze({
  kind: 'pptx-writer-contract',
  contractOnly: true,
  input: 'semantic-model',
  output: 'pptx-package',
  customDataCarrier: 'pptx-custom-data',
  fallbackStrategies: Object.freeze([
    'preview-image',
    'custom-data-roundtrip',
    'unsupported-warning',
  ]),
});

module.exports = Object.freeze({
  PPTX_FORMAT_EXTENSIONS,
  PptxReaderContract,
  PptxWriterContract,
});
