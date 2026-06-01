const { snapshotToSemanticModel } = require('../../adapters/html/normalizer/snapshot-to-model');
const { semanticModelToInstructions } = require('./instruction-writer');

function compileInstructions(snapshot, options = {}) {
  const model = snapshotToSemanticModel(snapshot, options);
  return semanticModelToInstructions(model, options);
}

module.exports = {
  compileInstructions,
};
