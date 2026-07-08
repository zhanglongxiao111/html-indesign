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
const { MODEL_FIELD_DOMAIN_NAMES } = require('./validators/model-field-domains');
const { validateModelFields } = require('./validators/validate-model-fields');
const { validateRetiredFields } = require('./validators/validate-retired-fields');
const {
  deriveProtocolConstants,
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  HTML_DATA_ID_ATTRIBUTES,
  HTML_DATA_ID_ATTRIBUTE_NAMES,
  HTML_PHYSICAL_ITEM_ROLE_VALUES,
  ITEM_ROLE,
  ITEM_ROLE_VALUES,
  RETIRED_HTML_DATA_ID_ATTRIBUTES,
  RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES,
  STYLE_KIND,
  STYLE_KIND_VALUES,
  SYNTHESIZED_STYLE_KIND,
  SYNTHESIZED_STYLE_KIND_VALUES,
} = require('./constants');
const {
  htmlItemRoleFromElementFacts,
  htmlPhysicalItemRoleFromAttributes,
  isAuthoringMappableItemRole,
  registeredItemRole,
} = require('./item-role-helpers');
const {
  fieldEntries,
  fieldRegistry,
} = require('./field-entries');
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

module.exports = Object.freeze({
  CAPABILITY_LEVELS,
  assertWritable,
  capabilityFor,
  createFieldRegistry,
  deriveProtocolConstants,
  DIRECTIONS,
  FIELD_CLASSES,
  fieldFor,
  fieldEntries,
  fieldRegistry,
  FORMATS,
  HTML_DATA_ID_ATTRIBUTES,
  HTML_DATA_ID_ATTRIBUTE_NAMES,
  htmlItemRoleFromElementFacts,
  htmlPhysicalItemRoleFromAttributes,
  ITEM_ROLE,
  ITEM_ROLE_VALUES,
  RETIRED_HTML_DATA_ID_ATTRIBUTES,
  RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES,
  AUTHORING_MAPPABLE_ITEM_ROLE_VALUES,
  HTML_PHYSICAL_ITEM_ROLE_VALUES,
  LIFECYCLES,
  MODEL_FIELD_DOMAIN_NAMES,
  STYLE_KIND,
  STYLE_KIND_VALUES,
  SYNTHESIZED_STYLE_KIND,
  SYNTHESIZED_STYLE_KIND_VALUES,
  isCapabilityLevel,
  isAuthoringMappableItemRole,
  isFieldClass,
  isLifecycle,
  lifecyclePolicyFor,
  normalizeCapabilities,
  normalizeFieldEntry,
  scanDataIdFields,
  scanInstructionPaths,
  scanModelPaths,
  uniquePaths,
  registeredItemRole,
  validateDataIdFields,
  validateFieldEntry,
  validateInstructionFields,
  validateLabelFields,
  validateModelFields,
  validateRetiredFields,
});
