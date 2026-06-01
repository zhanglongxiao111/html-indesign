const protocol = require('./src/protocol');
const adapters = {
  html: require('./src/adapters/html'),
  indesign: require('./src/adapters/indesign'),
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
