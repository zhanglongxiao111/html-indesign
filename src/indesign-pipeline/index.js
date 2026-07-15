const { snapshotToSemanticModel } = require('../adapters/html/normalizer/snapshot-to-model');
const { semanticModelToInstructions } = require('../writers/indesign/instruction-writer');

function compileInstructions(snapshot, options = {}) {
  return compileDocument(snapshot, options).instructions;
}

function compileDocument(snapshot, options = {}) {
  const model = snapshotToSemanticModel(snapshot, options);
  return {
    model,
    instructions: semanticModelToInstructions(model, options),
  };
}

module.exports = {
  compileDocument,
  compileInstructions,
};
