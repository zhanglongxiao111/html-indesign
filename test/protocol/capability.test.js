const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CAPABILITY_LEVELS,
  FORMATS,
  DIRECTIONS,
  assertWritable,
  capabilityFor,
  fieldRegistry,
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

test('capabilityFor returns explicit registry capability metadata for a known format', () => {
  assert.deepEqual(
    capabilityFor(fieldRegistry, 'items[].asset.placement.pageNumber', 'pptx'),
    {
      read: 'unsupported',
      write: 'fallback',
      persist: 'lossless',
      fallbackKind: 'preview-image',
      risk: 'editable-loss',
    },
  );
});

test('assertWritable rejects observe-only writes', () => {
  assert.throws(
    () => assertWritable(fieldRegistry, 'items[].sourceNode', 'indesign'),
    /FIELD_WRITE_FORBIDDEN:indesign:items\[\]\.sourceNode:observe-only/,
  );
});

test('assertWritable rejects unsupported writes', () => {
  assert.throws(
    () => assertWritable(fieldRegistry, 'items[].observedLabel', 'indesign'),
    /FIELD_WRITE_FORBIDDEN:indesign:items\[\]\.observedLabel:unsupported/,
  );
});

test('capabilityFor rejects unregistered fields', () => {
  assert.throws(
    () => capabilityFor(fieldRegistry, 'not.registered', 'html'),
    /FIELD_NOT_REGISTERED:not\.registered/,
  );
});

test('capabilityFor rejects unknown formats instead of manufacturing unsupported capabilities', () => {
  assert.throws(
    () => capabilityFor(fieldRegistry, 'items[].asset.placement.pageNumber', 'docx'),
    /CAPABILITY_FORMAT_INVALID:docx/,
  );
});
