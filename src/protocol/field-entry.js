const {
  DIRECTIONS,
  FORMATS,
  isCapabilityLevel,
  normalizeCapabilities,
} = require('./capability');
const { isFieldClass, isLifecycle } = require('./lifecycle');
const { uniquePaths } = require('./path-utils');
const hasOwn = Object.prototype.hasOwnProperty;

function normalizeFieldEntry(input) {
  const source = input && typeof input === 'object' ? input : {};
  const currentPaths = hasOwn.call(source, 'currentPaths')
    ? normalizeCurrentPaths(source.currentPaths)
    : [];

  return {
    ...source,
    currentPaths,
    allPaths: uniquePaths([
      source.canonicalPath,
      ...(Array.isArray(currentPaths) ? currentPaths : []),
    ]),
    capabilities: normalizeCapabilities(
      hasOwn.call(source, 'capabilities') ? source.capabilities : {},
    ),
    lifecycle: hasOwn.call(source, 'lifecycle') ? source.lifecycle : 'active',
  };
}

function normalizeCurrentPaths(currentPaths) {
  return Array.isArray(currentPaths) ? currentPaths.slice() : currentPaths;
}

function validateFieldEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: [{
        code: 'FIELD_ENTRY_INVALID',
        message: 'Field entry must be an object.',
      }],
    };
  }

  const errors = [];

  if (typeof input.canonicalPath !== 'string' || input.canonicalPath.length === 0) {
    errors.push({
      code: 'CANONICAL_PATH_MISSING',
      message: 'canonicalPath is required.',
    });
  }

  if (
    !Array.isArray(input.currentPaths)
    || input.currentPaths.some((path) => typeof path !== 'string' || path.length === 0)
  ) {
    errors.push({
      code: 'CURRENT_PATHS_INVALID',
      message: 'currentPaths must be an array of paths.',
    });
  }

  if (!isFieldClass(input.fieldClass)) {
    errors.push({
      code: 'FIELD_CLASS_INVALID',
      message: `Invalid fieldClass: ${input.fieldClass}`,
    });
  }

  if (!isLifecycle(input.lifecycle)) {
    errors.push({
      code: 'LIFECYCLE_INVALID',
      message: `Invalid lifecycle: ${input.lifecycle}`,
    });
  }

  if (typeof input.owner !== 'string' || input.owner.length === 0) {
    errors.push({
      code: 'OWNER_MISSING',
      message: 'owner is required.',
    });
  }

  validateCapabilities(input.capabilities, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCapabilities(capabilities, errors) {
  if (
    !capabilities
    || typeof capabilities !== 'object'
    || Array.isArray(capabilities)
    || Object.keys(capabilities).length === 0
  ) {
    errors.push({
      code: 'CAPABILITIES_MISSING',
      message: 'capabilities must explicitly declare at least one format.',
    });
    return;
  }

  for (const [format, formatCapabilities] of Object.entries(capabilities)) {
    if (!FORMATS.includes(format)) {
      errors.push({
        code: 'CAPABILITY_FORMAT_INVALID',
        message: `Invalid capability format: ${format}`,
      });
      continue;
    }

    if (!formatCapabilities || typeof formatCapabilities !== 'object' || Array.isArray(formatCapabilities)) {
      errors.push({
        code: 'CAPABILITY_DECLARATION_INVALID',
        message: `Capability declaration for ${format} must be an object.`,
      });
      continue;
    }

    for (const direction of DIRECTIONS) {
      const level = formatCapabilities[direction];
      if (level !== undefined && !isCapabilityLevel(level)) {
        errors.push({
          code: 'CAPABILITY_LEVEL_INVALID',
          message: `Invalid capability ${format}.${direction}: ${level}`,
        });
      }
    }
  }
}

module.exports = {
  normalizeFieldEntry,
  validateFieldEntry,
};
