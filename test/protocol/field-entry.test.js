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

test('field entry rejects explicit known format capabilities missing directions', () => {
  const missingWrite = validateFieldEntry({
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    capabilities: {
      html: { read: 'native', persist: 'native' },
    },
  });

  assert.equal(missingWrite.valid, false);
  assert.match(
    missingWrite.errors.map((error) => error.code).join(','),
    /CAPABILITY_DECLARATION_INVALID/,
  );

  const missingPersist = validateFieldEntry({
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    capabilities: {
      html: { read: 'native', write: 'native' },
    },
  });

  assert.equal(missingPersist.valid, false);
  assert.match(
    missingPersist.errors.map((error) => error.code).join(','),
    /CAPABILITY_DECLARATION_INVALID/,
  );
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

test('field entry rejects malformed retired html attr policy declarations', () => {
  const invalidPolicies = [
    [],
    [
      {
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
    ],
    [
      {
        name: 'data-id-page',
        writePolicy: 'forbidden',
      },
    ],
    [
      {
        name: 'data-id-page',
        readPolicy: 'observe-only',
      },
    ],
    [
      {
        name: '',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
    ],
    [
      {
        name: 'data-id-page',
        readPolicy: '',
        writePolicy: 'forbidden',
      },
    ],
    [
      {
        name: 'data-id-page',
        readPolicy: 'observe-only',
        writePolicy: '',
      },
    ],
    [
      {
        name: 'data-id-page',
        readPolicy: 'collect',
        writePolicy: 'forbidden',
      },
    ],
    [
      {
        name: 'data-id-page',
        readPolicy: 'observe-only',
        writePolicy: 'warn',
      },
    ],
    [
      {
        name: 'data-id-old-a',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
      {
        name: 'data-id-old-b',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
    ],
  ];

  for (const htmlAttrs of invalidPolicies) {
    const result = validateFieldEntry(retiredHtmlAttrEntry({ retired: { htmlAttrs } }));

    assert.equal(result.valid, false);
    assert.match(
      result.errors.map((error) => error.code).join(','),
      /RETIRED_POLICY_INVALID/,
    );
  }
});

test('field entry rejects retired html attr policies on active entries', () => {
  const result = validateFieldEntry(activeEntryWithRetiredHtmlAttrs());

  assert.equal(result.valid, false);
  assert.match(
    result.errors.map((error) => error.code).join(','),
    /RETIRED_POLICY_INVALID/,
  );
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

test('normalizeFieldEntry preserves explicit invalid capabilities for validation', () => {
  const baseEntry = {
    canonicalPath: 'document.id',
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document',
  };

  assert.equal(normalizeFieldEntry({
    ...baseEntry,
    capabilities: '',
  }).capabilities, '');
  assert.deepEqual(normalizeFieldEntry(baseEntry).capabilities.html, {
    read: 'unsupported',
    write: 'unsupported',
    persist: 'unsupported',
  });
});

test('normalizeFieldEntry must preserve invalid currentPaths declarations for validation', () => {
  const baseEntry = {
    canonicalPath: 'document.id',
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'document',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
    },
  };

  const invalidContainer = normalizeFieldEntry({
    ...baseEntry,
    currentPaths: '',
  });
  assert.equal(invalidContainer.currentPaths, '');
  assert.match(
    validateFieldEntry(invalidContainer).errors.map((error) => error.code).join(','),
    /CURRENT_PATHS_INVALID/,
  );

  const invalidPath = normalizeFieldEntry({
    ...baseEntry,
    currentPaths: ['items[].ok', ''],
  });
  assert.deepEqual(invalidPath.currentPaths, ['items[].ok', '']);
  assert.match(
    validateFieldEntry(invalidPath).errors.map((error) => error.code).join(','),
    /CURRENT_PATHS_INVALID/,
  );
});

function retiredHtmlAttrEntry(overrides = {}) {
  return {
    canonicalPath: 'retired.htmlAttrs.dataIdPage',
    currentPaths: [],
    fieldClass: 'observation',
    lifecycle: 'retired',
    owner: 'asset-placement',
    capabilities: {
      html: { read: 'observe-only', write: 'unsupported', persist: 'unsupported' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-page',
        replacedBy: 'data-id-pdf-page',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
        reason: 'ambiguous-with-page-identity',
      }],
    },
    ...overrides,
  };
}

function activeEntryWithRetiredHtmlAttrs() {
  return {
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: ['items[].asset.pageNumber'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    capabilities: {
      html: { read: 'native', write: 'native', persist: 'native' },
    },
    retired: {
      htmlAttrs: [{
        name: 'data-id-page',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      }],
    },
  };
}
