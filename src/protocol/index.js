const { normalizeFieldEntry, validateFieldEntry } = require('./field-entry');
const {
  assertWritable,
  capabilityFor,
  fieldFor,
  lifecyclePolicyFor,
} = require('./field-query');
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

const rawFieldEntries = [
  ...require('./fields/document-page'),
  ...require('./fields/styles'),
  ...require('./fields/assets'),
  ...require('./fields/labels'),
  ...require('./fields/source-metadata'),
  ...require('./fields/visual-style'),
  ...require('./fields/vector-geometry'),
  ...require('./fields/text'),
  ...require('./fields/table'),
  ...require('./fields/observation'),
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
  uniquePaths,
  validateFieldEntry,
});
