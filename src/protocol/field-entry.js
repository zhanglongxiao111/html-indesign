const {
  DIRECTIONS,
  FORMATS,
  isCapabilityLevel,
  normalizeCapabilities,
} = require('./capability');
const { isFieldClass, isLifecycle } = require('./lifecycle');
const { uniquePaths } = require('./path-utils');
const hasOwn = Object.prototype.hasOwnProperty;
const RETIRED_READ_POLICIES = new Set(['observe-only']);
const RETIRED_WRITE_POLICIES = new Set(['forbidden']);

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
  validateRetiredPolicy(input, errors);

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
      if (!hasOwn.call(formatCapabilities, direction)) {
        errors.push({
          code: 'CAPABILITY_DECLARATION_INVALID',
          message: `Capability declaration for ${format} must include ${direction}.`,
        });
        continue;
      }

      const level = formatCapabilities[direction];
      if (!isCapabilityLevel(level)) {
        errors.push({
          code: 'CAPABILITY_LEVEL_INVALID',
          message: `Invalid capability ${format}.${direction}: ${level}`,
        });
      }
    }
  }
}

function validateRetiredPolicy(input, errors) {
  const retired = input.retired;
  const hasRetiredHtmlAttrs = retired
    && typeof retired === 'object'
    && !Array.isArray(retired)
    && hasOwn.call(retired, 'htmlAttrs');

  if (input.lifecycle !== 'retired') {
    if (hasRetiredHtmlAttrs) {
      errors.push({
        code: 'RETIRED_POLICY_INVALID',
        message: 'retired.htmlAttrs may only be declared by retired lifecycle entries.',
      });
    }
    return;
  }

  const htmlAttrs = hasRetiredHtmlAttrs ? retired.htmlAttrs : undefined;

  if (!Array.isArray(htmlAttrs) || htmlAttrs.length !== 1) {
    errors.push({
      code: 'RETIRED_POLICY_INVALID',
      message: 'retired.htmlAttrs must contain exactly one retired policy record.',
    });
    return;
  }

  const retiredAttr = htmlAttrs[0];
  if (!retiredAttr || typeof retiredAttr !== 'object' || Array.isArray(retiredAttr)) {
    errors.push({
      code: 'RETIRED_POLICY_INVALID',
      message: 'retired.htmlAttrs record must be an object.',
    });
    return;
  }

  for (const key of ['name', 'readPolicy', 'writePolicy']) {
    if (typeof retiredAttr[key] !== 'string' || retiredAttr[key].length === 0) {
      errors.push({
        code: 'RETIRED_POLICY_INVALID',
        message: `retired.htmlAttrs record must include ${key}.`,
      });
    }
  }

  validateRetiredPolicyValue(retiredAttr, 'readPolicy', RETIRED_READ_POLICIES, errors);
  validateRetiredPolicyValue(retiredAttr, 'writePolicy', RETIRED_WRITE_POLICIES, errors);

  for (const key of ['replacedBy', 'reason']) {
    if (
      hasOwn.call(retiredAttr, key)
      && (typeof retiredAttr[key] !== 'string' || retiredAttr[key].length === 0)
    ) {
      errors.push({
        code: 'RETIRED_POLICY_INVALID',
        message: `retired.htmlAttrs ${key} must be a non-empty string when present.`,
      });
    }
  }
}

function validateRetiredPolicyValue(retiredAttr, key, allowedValues, errors) {
  if (
    typeof retiredAttr[key] === 'string'
    && retiredAttr[key].length > 0
    && !allowedValues.has(retiredAttr[key])
  ) {
    errors.push({
      code: 'RETIRED_POLICY_INVALID',
      message: `retired.htmlAttrs ${key} is not allowed: ${retiredAttr[key]}.`,
    });
  }
}

module.exports = {
  normalizeFieldEntry,
  validateFieldEntry,
};
