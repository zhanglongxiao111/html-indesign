const test = require('node:test');
const assert = require('node:assert/strict');

const { createFieldRegistry } = require('../../src/protocol');

function validCapabilities() {
  return {
    html: { read: 'native', write: 'native', persist: 'native' },
  };
}

function fieldEntry(overrides = {}) {
  return {
    canonicalPath: 'items[].asset.placement.pageNumber',
    currentPaths: ['items[].asset.pageNumber'],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'asset-placement',
    capabilities: validCapabilities(),
    ...overrides,
  };
}

test('registry finds field by canonicalPath currentPath and html attr', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      html: {
        readAttrs: ['data-id-pdf-page'],
        writeAttrs: ['data-id-pdf-target-page'],
        retiredAttrs: [{ name: 'data-id-page' }],
      },
    }),
  ]);

  assert.equal(registry.getByPath('items[].asset.placement.pageNumber').owner, 'asset-placement');
  assert.equal(registry.getByPath('items[].asset.pageNumber').owner, 'asset-placement');
  assert.equal(registry.getByHtmlAttr('data-id-pdf-page').canonicalPath, 'items[].asset.placement.pageNumber');
  assert.equal(registry.getByHtmlAttr('data-id-pdf-target-page').canonicalPath, 'items[].asset.placement.pageNumber');
  assert.equal(registry.getByHtmlAttr('data-id-page').canonicalPath, 'items[].asset.placement.pageNumber');
});

test('registry rejects duplicate path ownership', () => {
  assert.throws(() => createFieldRegistry([
    fieldEntry({
      canonicalPath: 'document.id',
      currentPaths: [],
      owner: 'document',
    }),
    fieldEntry({
      canonicalPath: 'document.id',
      currentPaths: [],
      owner: 'other',
    }),
  ]), /FIELD_PATH_DUPLICATED:document\.id/);
});

test('registry rejects duplicate HTML attrs', () => {
  assert.throws(() => createFieldRegistry([
    fieldEntry({
      canonicalPath: 'document.id',
      currentPaths: [],
      owner: 'document',
      html: { readAttrs: ['data-id-token'] },
    }),
    fieldEntry({
      canonicalPath: 'document.title',
      currentPaths: [],
      owner: 'document',
      html: { writeAttrs: ['data-id-token'] },
    }),
  ]), /HTML_ATTR_DUPLICATED:data-id-token/);
});

test('registry validates entries before storing them', () => {
  assert.throws(() => createFieldRegistry([
    fieldEntry({
      capabilities: {
        html: { read: 'maybe' },
      },
    }),
  ]), /FIELD_ENTRY_INVALID:CAPABILITY_LEVEL_INVALID/);
});

test('registry lists fields by owner class and lifecycle', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      canonicalPath: 'document.id',
      currentPaths: [],
      owner: 'document',
    }),
    fieldEntry({
      canonicalPath: 'observations[].label',
      currentPaths: [],
      fieldClass: 'observation',
      lifecycle: 'candidate',
      owner: 'reverse-export',
    }),
  ]);

  assert.deepEqual(registry.listByOwner('document').map((entry) => entry.canonicalPath), ['document.id']);
  assert.deepEqual(registry.listByClass('observation').map((entry) => entry.canonicalPath), ['observations[].label']);
  assert.deepEqual(registry.listByLifecycle('candidate').map((entry) => entry.canonicalPath), ['observations[].label']);
});
