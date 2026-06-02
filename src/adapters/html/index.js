const { renderSnapshot } = require('./reader/browser-snapshot');
const { snapshotToSemanticModel } = require('./normalizer/snapshot-to-model');
const { validateAuthoringRules } = require('./validators/authoring-validator');

module.exports = {
  renderSnapshot,
  snapshotToSemanticModel,
  validateAuthoringRules,
};
