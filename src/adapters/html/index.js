const { renderSnapshot } = require('./reader/browser-snapshot');
const { snapshotToSemanticModel } = require('./normalizer/snapshot-to-model');
const {
  AUTHORING_LINT_PROFILE_NAMES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  GRID_OBSERVED_DOWNGRADED,
  resolveAuthoringLintProfile,
  validateAuthoringRules,
} = require('./validators/authoring-validator');
const { auditHtmlCompatibility } = require('./compatibility/audit');

module.exports = {
  renderSnapshot,
  snapshotToSemanticModel,
  validateAuthoringRules,
  resolveAuthoringLintProfile,
  AUTHORING_LINT_PROFILE_NAMES,
  DEFAULT_AUTHORING_LINT_PROFILE,
  GRID_OBSERVED_DOWNGRADED,
  auditHtmlCompatibility,
};
