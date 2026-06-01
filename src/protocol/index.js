const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
const {
  assertWritable,
  capabilityFor,
  fieldFor,
  lifecyclePolicyFor,
} = require('./field-query');
const { scanDataIdFields } = require('./scanners/scan-data-id-fields');
const { scanInstructionPaths } = require('./scanners/scan-instruction-paths');
const { scanModelPaths } = require('./scanners/scan-model-paths');
const { createFieldRegistry } = require('./registry');
const { validateDataIdFields } = require('./validators/validate-data-id-fields');
const { validateInstructionFields } = require('./validators/validate-instruction-fields');
const { validateLabelFields } = require('./validators/validate-label-fields');
const { validateModelFields } = require('./validators/validate-model-fields');
const { validateRetiredFields } = require('./validators/validate-retired-fields');
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

const rawFieldEntries = [
  ...require('./fields/document-page'),
  ...require('./fields/document-model'),
  ...require('./fields/styles'),
  ...require('./fields/assets'),
  ...require('./fields/labels'),
  ...require('./fields/source-metadata'),
  ...require('./fields/visual-style'),
  ...require('./fields/vector-geometry'),
  ...require('./fields/text'),
  ...require('./fields/table'),
  ...require('./fields/observation'),
  ...require('./fields/reverse-surfaces'),
  ...require('./fields/reverse-diagnostics'),
  ...require('./fields/retired'),
  ...require('./fields/pptx-extensions'),
];

const fieldRegistry = createFieldRegistry(rawFieldEntries);
const fieldEntries = fieldRegistry.entries;

module.exports = Object.freeze({
  CAPABILITY_LEVELS,
  assertWritable,
  capabilityFor,
  createFieldRegistry,
  DIRECTIONS,
  FIELD_CLASSES,
  fieldFor,
  fieldEntries,
  fieldRegistry,
  FORMATS,
  LIFECYCLES,
  isCapabilityLevel,
  isFieldClass,
  isLifecycle,
  lifecyclePolicyFor,
  normalizeCapabilities,
  normalizeFieldEntry,
  scanDataIdFields,
  scanInstructionPaths,
  scanModelPaths,
  uniquePaths,
  validateDataIdFields,
  validateFieldEntry,
  validateInstructionFields,
  validateLabelFields,
  validateModelFields,
  validateRetiredFields,
});
