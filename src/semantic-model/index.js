const { snapshotToSemanticModel } = require('./from-snapshot');
const { semanticModelToInstructions } = require('./to-instructions');

module.exports = {
  snapshotToSemanticModel,
  semanticModelToInstructions,
};
