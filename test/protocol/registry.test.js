const test = require('node:test');
const assert = require('node:assert/strict');

const protocol = require('../../src/protocol');
const { createFieldRegistry, fieldEntries, fieldRegistry } = protocol;

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

test('registry finds field by canonicalPath currentPath and html attr', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      html: {
        readAttrs: ['data-id-pdf-page'],
        writeAttrs: ['data-id-pdf-target-page'],
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
      },
    }),
    retiredHtmlAttrEntry(),
  ]);

  const retired = registry.getRetiredHtmlAttr('data-id-page');

  assert.equal(registry.getByHtmlAttr('data-id-page'), null);
  assert.equal(retired.canonicalPath, 'retired.htmlAttrs.dataIdPage');
  assert.equal(retired.fieldClass, 'observation');
  assert.equal(retired.lifecycle, 'retired');
  assert.equal(retired.name, 'data-id-page');
  assert.equal(retired.readPolicy, 'observe-only');
  assert.equal(retired.writePolicy, 'forbidden');
  assert.equal(retired.replacedBy, 'data-id-pdf-page');
  assert.equal(retired.entry, registry.getByPath('retired.htmlAttrs.dataIdPage'));
});

test('registry does not source retired HTML attrs from active field metadata', () => {
  const registry = createFieldRegistry([
    fieldEntry({
      html: {
        readAttrs: ['data-id-pdf-page'],
        retiredAttrs: [{
          name: 'data-id-page',
          readPolicy: 'observe-only',
          writePolicy: 'forbidden',
        }],
      },
    }),
  ]);

  assert.equal(registry.getByHtmlAttr('data-id-page'), null);
  assert.equal(registry.getRetiredHtmlAttr('data-id-page'), null);
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

test('registry rejects incomplete explicit known format capabilities before normalization', () => {
  assert.throws(() => createFieldRegistry([
    fieldEntry({
      capabilities: {
        html: { read: 'native' },
      },
    }),
  ]), /FIELD_ENTRY_INVALID:.*CAPABILITY_DECLARATION_INVALID/);
});

test('registry rejects malformed retired html attr policies before indexing', () => {
  const invalidPolicies = [
    [{ name: 'data-id-page', writePolicy: 'forbidden' }],
    [{ name: 'data-id-page', readPolicy: 'observe-only' }],
    [{ name: 'data-id-page', readPolicy: '', writePolicy: 'forbidden' }],
    [{ name: 'data-id-page', readPolicy: 'collect', writePolicy: 'forbidden' }],
    [{ name: 'data-id-page', readPolicy: 'observe-only', writePolicy: 'warn' }],
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
    assert.throws(() => createFieldRegistry([
      retiredHtmlAttrEntry({
        retired: { htmlAttrs },
      }),
    ]), /FIELD_ENTRY_INVALID:.*RETIRED_POLICY_INVALID/);
  }
});

test('registry rejects retired html attr policies declared by active entries', () => {
  assert.throws(() => createFieldRegistry([
    fieldEntry({
      retired: {
        htmlAttrs: [{
          name: 'data-id-page',
          readPolicy: 'observe-only',
          writePolicy: 'forbidden',
        }],
      },
    }),
  ]), /FIELD_ENTRY_INVALID:.*RETIRED_POLICY_INVALID/);
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

test('protocol index and registry exports cannot be rebound by consumers', () => {
  const entryCount = protocol.fieldEntries.length;
  const registryEntryCount = protocol.fieldRegistry.entries.length;

  protocol.fieldEntries = [];
  protocol.fieldRegistry.entries = [];

  assert.equal(Object.isFrozen(protocol), true);
  assert.equal(Object.isFrozen(protocol.fieldRegistry), true);
  assert.equal(protocol.fieldEntries.length, entryCount);
  assert.equal(protocol.fieldRegistry.entries.length, registryEntryCount);
  assert.equal(protocol.fieldRegistry.getByPath(protocol.fieldEntries[0].canonicalPath), protocol.fieldEntries[0]);
});
