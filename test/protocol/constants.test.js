const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const {
  createFieldRegistry,
  fieldRegistry,
} = require('../../src/protocol');
const {
  deriveProtocolConstants,
  HTML_DATA_ID_ATTRIBUTES,
  HTML_DATA_ID_ATTRIBUTE_NAMES,
  ITEM_ROLE,
  ITEM_ROLE_VALUES,
  RETIRED_HTML_DATA_ID_ATTRIBUTES,
  RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES,
  STYLE_KIND,
  STYLE_KIND_VALUES,
  SYNTHESIZED_STYLE_KIND,
  SYNTHESIZED_STYLE_KIND_VALUES,
} = require('../../src/protocol/constants');

function capabilities() {
  return {
    html: { read: 'native', write: 'native', persist: 'native' },
    indesign: { read: 'native', write: 'native', persist: 'native' },
    pptx: { read: 'unsupported', write: 'fallback', persist: 'lossless' },
  };
}

function field(canonicalPath, extra = {}) {
  return {
    canonicalPath,
    currentPaths: [],
    fieldClass: 'canonical',
    lifecycle: 'active',
    owner: 'test',
    type: 'string',
    capabilities: capabilities(),
    ...extra,
  };
}

function roleField(extra = {}) {
  return field('items[].role', {
    allowedValues: ['text', 'graphic', 'shape', 'table', 'line', 'background', 'decoration', 'annotation'],
    roleSubsets: {
      authoringMappable: ['text', 'graphic', 'shape', 'table'],
      htmlPhysical: ['text', 'graphic', 'shape', 'table', 'line', 'background', 'decoration'],
    },
    ...extra,
  });
}

test('protocol constants are derived from a supplied registry', () => {
  const registry = createFieldRegistry([
    roleField({
      allowedValues: ['text', 'graphic', 'shape', 'table'],
      roleSubsets: {
        authoringMappable: ['text', 'graphic'],
        htmlPhysical: ['text', 'graphic', 'shape'],
      },
      html: {
        readAttrs: ['data-id-test-read'],
        writeAttrs: ['data-id-test-write'],
      },
    }),
    field('labels[].styleKind', {
      fieldClass: 'sourceMetadata',
      allowedValues: ['testStyles'],
      html: {
        persistAttrs: ['data-id-test-persist'],
      },
    }),
    field('styles.synthesized[].kind', {
      allowedValues: ['testSynth'],
    }),
  ]);

  const constants = deriveProtocolConstants(registry);

  assert.deepEqual(constants.HTML_DATA_ID_ATTRIBUTE_NAMES, [
    'data-id-test-persist',
    'data-id-test-read',
    'data-id-test-write',
  ]);
  assert.deepEqual(constants.HTML_DATA_ID_ATTRIBUTES, {
    TEST_PERSIST: 'data-id-test-persist',
    TEST_READ: 'data-id-test-read',
    TEST_WRITE: 'data-id-test-write',
  });
  assert.deepEqual(constants.ITEM_ROLE_VALUES, ['text', 'graphic', 'shape', 'table']);
  assert.deepEqual(constants.ITEM_ROLE, { TEXT: 'text', GRAPHIC: 'graphic', SHAPE: 'shape', TABLE: 'table' });
  assert.deepEqual(constants.AUTHORING_MAPPABLE_ITEM_ROLE_VALUES, ['text', 'graphic']);
  assert.deepEqual(constants.HTML_PHYSICAL_ITEM_ROLE_VALUES, ['text', 'graphic', 'shape']);
  assert.deepEqual(constants.STYLE_KIND_VALUES, ['testStyles']);
  assert.deepEqual(constants.STYLE_KIND, { TEST_STYLES: 'testStyles' });
  assert.deepEqual(constants.SYNTHESIZED_STYLE_KIND_VALUES, ['testSynth']);
  assert.deepEqual(constants.SYNTHESIZED_STYLE_KIND, { TEST_SYNTH: 'testSynth' });
});

test('protocol constants fail visibly when required registry fields are missing', () => {
  const registry = createFieldRegistry([
    roleField(),
    field('labels[].styleKind', { allowedValues: ['paragraphStyles'] }),
  ]);

  assert.throws(
    () => deriveProtocolConstants(registry),
    /PROTOCOL_CONSTANT_FIELD_MISSING:styles\.synthesized\[\]\.kind/,
  );
});

test('default protocol constants expose current registry data-id attributes and value domains', () => {
  const registryAttrs = [...new Set(fieldRegistry.entries.flatMap((entry) => {
    const html = entry.html || {};
    return [
      ...(html.readAttrs || []),
      ...(html.writeAttrs || []),
      ...(html.persistAttrs || []),
    ];
  }).filter((attr) => attr.startsWith('data-id-')))].sort();

  assert.deepEqual(HTML_DATA_ID_ATTRIBUTE_NAMES, registryAttrs);
  assert.equal(HTML_DATA_ID_ATTRIBUTES.ROLE, 'data-id-role');
  assert.equal(HTML_DATA_ID_ATTRIBUTES.PARAGRAPH_STYLE, 'data-id-paragraph-style');
  assert.equal(HTML_DATA_ID_ATTRIBUTES.STYLE_TOKEN, 'data-id-style-token');

  assert.deepEqual(ITEM_ROLE_VALUES, fieldRegistry.getByPath('items[].role').allowedValues);
  for (const role of ['text', 'graphic', 'shape', 'table', 'line', 'background', 'decoration', 'annotation']) {
    assert.equal(ITEM_ROLE_VALUES.includes(role), true, `${role} role should be registered`);
    assert.equal(ITEM_ROLE[constantKeyFor(role)], role);
  }

  assert.deepEqual(STYLE_KIND_VALUES, fieldRegistry.getByPath('labels[].styleKind').allowedValues);
  for (const styleKind of ['paragraphStyles', 'characterStyles', 'objectStyles', 'frameStyles', 'tableStyles', 'cellStyles']) {
    assert.equal(STYLE_KIND_VALUES.includes(styleKind), true, `${styleKind} style kind should be registered`);
    assert.equal(STYLE_KIND[constantKeyFor(styleKind)], styleKind);
  }

  assert.deepEqual(SYNTHESIZED_STYLE_KIND_VALUES, fieldRegistry.getByPath('styles.synthesized[].kind').allowedValues);
  for (const styleKind of ['text', 'line', 'object', 'asset']) {
    assert.equal(SYNTHESIZED_STYLE_KIND_VALUES.includes(styleKind), true, `${styleKind} synthesized style kind should be registered`);
    assert.equal(SYNTHESIZED_STYLE_KIND[constantKeyFor(styleKind)], styleKind);
  }
});

test('protocol constants expose retired HTML data-id attributes separately from active attributes', () => {
  const retiredAttrs = [...new Set(fieldRegistry.entries.flatMap((entry) => {
    const retired = entry.retired || {};
    return (retired.htmlAttrs || []).map((attr) => attr.name);
  }).filter((attr) => attr.startsWith('data-id-')))].sort();

  assert.deepEqual(RETIRED_HTML_DATA_ID_ATTRIBUTE_NAMES, retiredAttrs);
  assert.equal(RETIRED_HTML_DATA_ID_ATTRIBUTES.PAGE, 'data-id-page');
  assert.equal(HTML_DATA_ID_ATTRIBUTES.PAGE, undefined);
});

test('protocol index exports the derived constants surface', () => {
  const protocol = require('../../src/protocol');

  assert.equal(protocol.HTML_DATA_ID_ATTRIBUTES, HTML_DATA_ID_ATTRIBUTES);
  assert.equal(protocol.RETIRED_HTML_DATA_ID_ATTRIBUTES, RETIRED_HTML_DATA_ID_ATTRIBUTES);
  assert.equal(protocol.ITEM_ROLE, ITEM_ROLE);
  assert.equal(protocol.STYLE_KIND, STYLE_KIND);
  assert.equal(protocol.SYNTHESIZED_STYLE_KIND, SYNTHESIZED_STYLE_KIND);
  assert.equal(protocol.deriveProtocolConstants, deriveProtocolConstants);
});

test('protocol constants module can be required directly without preloading protocol index', () => {
  const result = spawnSync(process.execPath, [
    '-e',
    [
      "const constants = require('./src/protocol/constants');",
      "process.stdout.write(constants.ITEM_ROLE.TEXT + ':' + constants.HTML_DATA_ID_ATTRIBUTES.ROLE);",
    ].join(''),
  ], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'text:data-id-role');
});

function constantKeyFor(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}
