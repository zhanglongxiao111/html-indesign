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
  fieldStrategies: Object.freeze({
    'items[].asset.placement.pageNumber': Object.freeze({
      write: 'fallback',
      persist: 'lossless',
      fallbackKind: 'preview-image',
      customDataCarrier: 'pptx-custom-data',
      customDataPath: 'htmlIndesign.items[].asset.placement.pageNumber',
      risk: 'editable-loss',
    }),
  }),
});

module.exports = Object.freeze({
  PPTX_RESOURCE_FALLBACKS,
  PptxContractCapabilities,
});
