const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CAPABILITY_LEVELS,
  FORMATS,
  DIRECTIONS,
  validateFieldEntry,
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

test('normalizeCapabilities preserves explicit invalid format declarations for validation', () => {
  const normalized = normalizeCapabilities({
    html: '',
  });

  assert.equal(normalized.html, '');
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

test('normalizeCapabilities preserves unknown explicit formats for validation', () => {
  const normalized = normalizeCapabilities({
    html: { read: 'native' },
    custom: { read: 'native' },
  });

  assert.deepEqual(normalized.custom, { read: 'native' });
  assert.equal(normalized.html.read, 'native');
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

  const result = validateFieldEntry({
    canonicalPath: 'document.id',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document',
    capabilities: normalized,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.code).join(','), /CAPABILITY_FORMAT_INVALID/);
});

test('isCapabilityLevel accepts defined levels and rejects invalid values', () => {
  for (const level of CAPABILITY_LEVELS) {
    assert.equal(isCapabilityLevel(level), true, level);
  }

  assert.equal(isCapabilityLevel('legacy'), false);
  assert.equal(isCapabilityLevel('maybe'), false);
});

test('capability constants are immutable and do not expose live validation state', () => {
  assert.equal(Object.isFrozen(FORMATS), true);
  assert.equal(Object.isFrozen(DIRECTIONS), true);
  assert.equal(Object.isFrozen(CAPABILITY_LEVELS), true);

  assert.throws(() => FORMATS.push('legacy'), TypeError);
  assert.throws(() => DIRECTIONS.push('preview'), TypeError);
  assert.equal(typeof CAPABILITY_LEVELS.add, 'undefined');
  assert.equal(isCapabilityLevel('maybe'), false);
});
