const { snapshotToSemanticModel, semanticModelToInstructions } = require('../semantic-model');

function compileInstructions(snapshot, options = {}) {
  const model = snapshotToSemanticModel(snapshot, options);
  return semanticModelToInstructions(model, options);
}

module.exports = {
  compileInstructions,
};
