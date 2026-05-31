const CAPABILITY_LEVELS = Object.freeze([
  'native',
  'lossless',
  'approximate',
  'fallback',
  'observe-only',
  'unsupported',
]);

const FORMATS = Object.freeze(['html', 'indesign', 'pptx']);
const DIRECTIONS = Object.freeze(['read', 'write', 'persist']);
const hasOwn = Object.prototype.hasOwnProperty;
const capabilityLevelSet = new Set(CAPABILITY_LEVELS);

function isCapabilityLevel(value) {
  return capabilityLevelSet.has(value);
}

function normalizeCapabilities(capabilities) {
  const inputCapabilities = arguments.length === 0 ? {} : capabilities;
  if (!inputCapabilities || typeof inputCapabilities !== 'object' || Array.isArray(inputCapabilities)) {
    return inputCapabilities;
  }

  const normalized = {};

  for (const [format, formatCapabilities] of Object.entries(inputCapabilities)) {
    normalized[format] = FORMATS.includes(format)
      ? normalizeKnownFormatCapabilities(formatCapabilities)
      : formatCapabilities;
  }

  for (const format of FORMATS) {
    if (!hasOwn.call(inputCapabilities, format)) {
      normalized[format] = unsupportedDirections();
    }
  }

  return normalized;
}

function normalizeKnownFormatCapabilities(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const normalized = {};

  for (const direction of DIRECTIONS) {
    normalized[direction] = hasOwn.call(input, direction)
      ? input[direction]
      : 'unsupported';
  }

  if (hasOwn.call(input, 'fallbackKind')) {
    normalized.fallbackKind = input.fallbackKind;
  }
  if (hasOwn.call(input, 'risk')) {
    normalized.risk = input.risk;
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
