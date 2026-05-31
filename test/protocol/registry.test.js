const test = require('node:test');
const assert = require('node:assert/strict');

const { createFieldRegistry, fieldEntries, fieldRegistry } = require('../../src/protocol');

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
  assert.equal(registry.getByHtmlAttr('data-id-page'), null);
});

test('registry exposes retired HTML attrs only through retired lookup metadata', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      html: {
        readAttrs: ['data-id-pdf-page'],
        retiredAttrs: [{
          name: 'data-id-page',
          readPolicy: 'observe-only',
          writePolicy: 'forbidden',
          reason: 'ambiguous-with-page-identity',
        }],
      },
    }),
  ]);

  const retired = registry.getRetiredHtmlAttr('data-id-page');

  assert.equal(registry.getByHtmlAttr('data-id-page'), null);
  assert.equal(retired.canonicalPath, 'items[].asset.placement.pageNumber');
  assert.equal(retired.readPolicy, 'observe-only');
  assert.equal(retired.writePolicy, 'forbidden');
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

test('registry entry exposure does not allow external mutation to alter lookup state', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      canonicalPath: 'document.id',
      currentPaths: [],
      owner: 'document',
    }),
  ]);

  assert.equal(Object.isFrozen(registry.entries[0]), true);
  assert.equal(Object.isFrozen(registry.getByPath('document.id')), true);

  registry.entries[0].owner = 'mutated';
  registry.getByPath('document.id').owner = 'mutated';

  assert.equal(registry.getByPath('document.id').owner, 'document');
  assert.deepEqual(registry.listByOwner('document').map((entry) => entry.canonicalPath), ['document.id']);
  assert.deepEqual(registry.listByOwner('mutated'), []);
});

test('protocol index exports registered field entries and default registry', () => {
  assert.equal(Array.isArray(fieldEntries), true);
  assert.equal(fieldEntries.length > 0, true);
  assert.equal(fieldRegistry.entries.length, fieldEntries.length);
});

test('protocol index field entry exports are frozen facts', () => {
  const firstOwner = fieldEntries[0].owner;

  assert.equal(Object.isFrozen(fieldEntries), true);
  assert.equal(Object.isFrozen(fieldEntries[0]), true);
  assert.equal(Object.isFrozen(fieldRegistry.entries), true);
  assert.equal(Object.isFrozen(fieldRegistry.entries[0]), true);
  assert.throws(() => fieldEntries.push(fieldEntries[0]), TypeError);
  assert.throws(() => fieldRegistry.entries.push(fieldRegistry.entries[0]), TypeError);

  fieldEntries[0].owner = 'mutated';
  fieldRegistry.entries[0].owner = 'mutated';

  assert.equal(fieldEntries[0].owner, firstOwner);
  assert.equal(fieldRegistry.entries[0].owner, firstOwner);
  assert.equal(fieldRegistry.getByPath(fieldEntries[0].canonicalPath).owner, firstOwner);
});
