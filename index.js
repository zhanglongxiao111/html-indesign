const protocol = require('./src/protocol');
const pptxContracts = require('./src/adapters/pptx/contracts');
const pptxCapabilities = require('./src/adapters/pptx/capabilities');
const adapters = {
  html: require('./src/adapters/html'),
  indesign: require('./src/adapters/indesign'),
  pptx: Object.freeze({
    PPTX_FORMAT_EXTENSIONS: pptxContracts.PPTX_FORMAT_EXTENSIONS,
    PptxReaderContract: pptxContracts.PptxReaderContract,
    PptxWriterContract: pptxContracts.PptxWriterContract,
    PPTX_RESOURCE_FALLBACKS: pptxCapabilities.PPTX_RESOURCE_FALLBACKS,
    PptxContractCapabilities: pptxCapabilities.PptxContractCapabilities,
  }),
};
const semanticModel = require('./src/semantic-model');
const writers = {
  html: require('./src/writers/html'),
  indesign: require('./src/writers/indesign'),
};
const historicalTemplate = require('./src/historical-template');

module.exports = {
  protocol,
  adapters,
  semanticModel,
  writers,
  historicalTemplate,
};
