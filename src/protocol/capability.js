const CAPABILITY_LEVELS = new Set([
  'native',
  'lossless',
  'approximate',
  'fallback',
  'observe-only',
  'unsupported',
]);

const FORMATS = ['html', 'indesign', 'pptx'];
const DIRECTIONS = ['read', 'write', 'persist'];
const hasOwn = Object.prototype.hasOwnProperty;

function isCapabilityLevel(value) {
  return CAPABILITY_LEVELS.has(value);
}

function normalizeCapabilities(capabilities = {}) {
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return capabilities;
  }

  const normalized = {};

  for (const format of FORMATS) {
    if (!hasOwn.call(capabilities, format)) {
      normalized[format] = unsupportedDirections();
      continue;
    }

    const input = capabilities[format];
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      normalized[format] = input;
      continue;
    }

    normalized[format] = {};

    for (const direction of DIRECTIONS) {
      normalized[format][direction] = hasOwn.call(input, direction)
        ? input[direction]
        : 'unsupported';
    }

    if (hasOwn.call(input, 'fallbackKind')) {
      normalized[format].fallbackKind = input.fallbackKind;
    }
    if (hasOwn.call(input, 'risk')) {
      normalized[format].risk = input.risk;
    }
  }

  return normalized;
}

function unsupportedDirections() {
  return {
    read: 'unsupported',
    write: 'unsupported',
    persist: 'unsupported',
  };
}

module.exports = {
  CAPABILITY_LEVELS,
  FORMATS,
  DIRECTIONS,
  isCapabilityLevel,
  normalizeCapabilities,
};
