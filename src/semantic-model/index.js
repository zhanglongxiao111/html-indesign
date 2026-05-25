const { snapshotToSemanticModel } = require('./from-snapshot');
const { semanticModelToInstructions } = require('./to-instructions');
const { validateSemanticModel } = require('./validator');

module.exports = {
  snapshotToSemanticModel,
  semanticModelToInstructions,
  validateSemanticModel,
};
