const protocol = require('./src/protocol');
const pptxContracts = require('./src/adapters/pptx/contracts');
const pptxCapabilities = require('./src/adapters/pptx/capabilities');
const adapters = {
  html: require('./src/adapters/html'),
  indesign: require('./src/adapters/indesign'),
  pptx: Object.freeze({
    ...pptxContracts,
    ...pptxCapabilities,
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
