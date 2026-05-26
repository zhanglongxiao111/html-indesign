'use strict';

const { SemanticPresetError } = require('./errors');
const {
  loadSemanticPreset,
  loadStandardSemanticPreset,
  loadProjectSemanticPreset,
  resolveSemanticPreset,
} = require('./loader');
const { validateSemanticPreset } = require('./schema');
const {
  presetToStyleNameMap,
  collectKnownSemanticTokens,
} = require('./maps');
const { initProjectSemanticPreset } = require('./init');
const { auditAuthoringSemanticTokens } = require('./audit-authoring');

module.exports = {
  SemanticPresetError,
  auditAuthoringSemanticTokens,
  initProjectSemanticPreset,
  loadSemanticPreset,
  loadStandardSemanticPreset,
  loadProjectSemanticPreset,
  resolveSemanticPreset,
  validateSemanticPreset,
  presetToStyleNameMap,
  collectKnownSemanticTokens,
};
