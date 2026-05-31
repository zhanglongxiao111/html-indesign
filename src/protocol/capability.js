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

function isCapabilityLevel(value) {
  return CAPABILITY_LEVELS.has(value);
}

function normalizeCapabilities(capabilities = {}) {
  const inputCapabilities = capabilities && typeof capabilities === 'object' ? capabilities : {};
  const normalized = {};

  for (const format of FORMATS) {
    const input = inputCapabilities[format] && typeof inputCapabilities[format] === 'object'
      ? inputCapabilities[format]
      : {};
    normalized[format] = {};

    for (const direction of DIRECTIONS) {
      normalized[format][direction] = input[direction] || 'unsupported';
    }

    if (Object.prototype.hasOwnProperty.call(input, 'fallbackKind')) {
      normalized[format].fallbackKind = input.fallbackKind;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'risk')) {
      normalized[format].risk = input.risk;
    }
  }

  return normalized;
}

module.exports = {
  CAPABILITY_LEVELS,
  FORMATS,
  DIRECTIONS,
  isCapabilityLevel,
  normalizeCapabilities,
};
