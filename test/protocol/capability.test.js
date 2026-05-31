const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CAPABILITY_LEVELS,
  FORMATS,
  DIRECTIONS,
  isCapabilityLevel,
  normalizeCapabilities,
} = require('../../src/protocol');

test('normalizeCapabilities fills unsupported for omitted formats and directions and preserves fallback metadata', () => {
  const normalized = normalizeCapabilities({
    html: {
      read: 'native',
      fallbackKind: 'raster-preview',
      risk: 'visual-only',
    },
  });

  assert.deepEqual(FORMATS, ['html', 'indesign', 'pptx']);
  assert.deepEqual(DIRECTIONS, ['read', 'write', 'persist']);
  assert.equal(normalized.html.read, 'native');
  assert.equal(normalized.html.write, 'unsupported');
  assert.equal(normalized.html.persist, 'unsupported');
  assert.equal(normalized.html.fallbackKind, 'raster-preview');
  assert.equal(normalized.html.risk, 'visual-only');
  assert.deepEqual(normalized.indesign, {
    read: 'unsupported',
    write: 'unsupported',
    persist: 'unsupported',
  });
  assert.deepEqual(normalized.pptx, {
    read: 'unsupported',
    write: 'unsupported',
    persist: 'unsupported',
  });
});

test('normalizeCapabilities preserves explicit invalid capability values for validation', () => {
  const normalized = normalizeCapabilities({
    html: { read: '' },
  });

  assert.equal(normalized.html.read, '');
  assert.equal(normalized.html.write, 'unsupported');
  assert.equal(normalized.html.persist, 'unsupported');
});

test('isCapabilityLevel accepts defined levels and rejects invalid values', () => {
  for (const level of CAPABILITY_LEVELS) {
    assert.equal(isCapabilityLevel(level), true, level);
  }

  assert.equal(isCapabilityLevel('legacy'), false);
  assert.equal(isCapabilityLevel('maybe'), false);
});
