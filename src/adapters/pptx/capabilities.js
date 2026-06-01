const { PptxWriterContract } = require('./contracts');

const PPTX_RESOURCE_FALLBACKS = Object.freeze({
  pdf: Object.freeze({
    visualOutput: 'preview-image',
    metadataPersistence: 'pptx-custom-data',
    fidelity: 'lossless-metadata',
  }),
  ai: Object.freeze({
    visualOutput: 'preview-image',
    metadataPersistence: 'pptx-custom-data',
    fidelity: 'lossless-metadata',
  }),
  psd: Object.freeze({
    visualOutput: 'preview-image',
    metadataPersistence: 'pptx-custom-data',
    fidelity: 'lossless-metadata',
  }),
});

const PptxContractCapabilities = Object.freeze({
  contractOnly: true,
  format: 'pptx',
  boundary: 'semantic-model',
  registry: 'protocol-field-registry',
  customDataCarrier: PptxWriterContract.customDataCarrier,
  fallbackStrategies: PptxWriterContract.fallbackStrategies,
  resourceStrategy: PPTX_RESOURCE_FALLBACKS,
});

module.exports = Object.freeze({
  PPTX_RESOURCE_FALLBACKS,
  PptxContractCapabilities,
});
