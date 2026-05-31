const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeFieldEntry, validateFieldEntry } = require('../../src/protocol');

test('field entry requires canonicalPath currentPaths fieldClass lifecycle owner and capabilities', () => {
  const result = validateFieldEntry({
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: ['items[].asset.pageNumber'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    type: 'integer',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
      indesign: { read: 'native', write: 'native', persist: 'native' },
      pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless' },
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('field entry rejects unknown fieldClass and capability level', () => {
  const result = validateFieldEntry({
    canonicalPath: 'items[].bad',
    currentPaths: [],
    fieldClass: 'legacy',
    lifecycle: 'active',
    owner: 'test',
    capabilities: {
      html: { read: 'maybe', write: 'native', persist: 'native' },
    },
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.code).join(','), /FIELD_CLASS_INVALID/);
  assert.match(result.errors.map((error) => error.code).join(','), /CAPABILITY_LEVEL_INVALID/);
});

test('field entry rejects entries without explicit capabilities', () => {
  const result = validateFieldEntry({
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.map((error) => error.code).join(','), /CAPABILITIES_MISSING/);
});

test('normalizeFieldEntry always includes canonicalPath in allPaths', () => {
  const entry = normalizeFieldEntry({
    canonicalPath: 'document.id',
    currentPaths: ['labels.document.id'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
    },
  });

  assert.deepEqual(entry.allPaths, ['document.id', 'labels.document.id']);
});

test('normalizeFieldEntry preserves explicit invalid lifecycle values and defaults only omitted lifecycle', () => {
  const baseEntry = {
    canonicalPath: 'document.id',
    currentPaths: [],
    fieldClass: 'canonical',
    owner: 'document',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
    },
  };

  assert.equal(normalizeFieldEntry({
    ...baseEntry,
    lifecycle: '',
  }).lifecycle, '');
  assert.equal(normalizeFieldEntry(baseEntry).lifecycle, 'active');
});
