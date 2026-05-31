const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
const { createFieldRegistry } = require('./registry');
const {
  CAPABILITY_LEVELS,
  DIRECTIONS,
  FORMATS,
  isCapabilityLevel,
  normalizeCapabilities,
} = require('./capability');
const {
  FIELD_CLASSES,
  LIFECYCLES,
  isFieldClass,
  isLifecycle,
} = require('./lifecycle');
const { uniquePaths } = require('./path-utils');

module.exports = {
  CAPABILITY_LEVELS,
  createFieldRegistry,
  DIRECTIONS,
  FIELD_CLASSES,
  FORMATS,
  LIFECYCLES,
  isCapabilityLevel,
  isFieldClass,
  isLifecycle,
  normalizeCapabilities,
  normalizeFieldEntry,
  uniquePaths,
  validateFieldEntry,
};
