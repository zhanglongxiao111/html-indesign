const { renderSnapshot } = require('./reader/browser-snapshot');
const { snapshotToSemanticModel } = require('./normalizer/snapshot-to-model');
const { validateAuthoringRules } = require('./validators/authoring-validator');
const { auditHtmlCompatibility } = require('./compatibility/audit');

module.exports = {
  renderSnapshot,
  snapshotToSemanticModel,
  validateAuthoringRules,
  auditHtmlCompatibility,
};
