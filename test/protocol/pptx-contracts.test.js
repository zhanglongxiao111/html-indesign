const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = require('../../index');
const {
  capabilityFor,
  fieldRegistry,
} = require('../../src/protocol');

const expectedFormatExtensions = [
  'extensions.pptx.animation',
  'extensions.pptx.transition',
  'extensions.pptx.placeholder',
  'extensions.pptx.speakerNotes',
];

const forbiddenImplementationNames = [
  'readPptxPackage',
  'writePptxPackage',
  'readPptx',
  'writePptx',
  'parsePptxPackage',
  'serializePptxPackage',
  'htmlToPptx',
  'pptxToHtml',
  'indesignToPptx',
  'pptxToIndesign',
];

function pptxAdapter() {
  assert.notEqual(api.adapters.pptx, undefined, 'api.adapters.pptx must expose the Stage 10 contract-only surface');
  return api.adapters.pptx;
}

test('PPTX public adapter exposes only contract data and no package implementation functions', () => {
  const pptx = pptxAdapter();

  assert.deepEqual(Object.keys(pptx).sort(), [
    'PPTX_FORMAT_EXTENSIONS',
    'PPTX_RESOURCE_FALLBACKS',
    'PptxContractCapabilities',
    'PptxReaderContract',
    'PptxWriterContract',
  ].sort());

  for (const exportName of forbiddenImplementationNames) {
    assert.equal(pptx[exportName], undefined, `${exportName} must not exist before PPTX package I/O is implemented`);
  }
});

test('PPTX reader and writer contracts stay on the semantic-model boundary', () => {
  const {
    PptxReaderContract,
    PptxWriterContract,
  } = pptxAdapter();

  assert.deepEqual(PptxReaderContract, {
    kind: 'pptx-reader-contract',
    contractOnly: true,
    input: 'pptx-package',
    output: 'pptx-raw-snapshot',
    normalizerOutput: 'semantic-model',
    supportedFacts: [
      'slides',
      'masters',
      'layouts',
      'shapes',
      'textBoxes',
      'tables',
      'charts',
      'media',
      'customData',
    ],
    formatExtensions: expectedFormatExtensions,
  });

  assert.deepEqual(PptxWriterContract, {
    kind: 'pptx-writer-contract',
    contractOnly: true,
    input: 'semantic-model',
    output: 'pptx-package',
    customDataCarrier: 'pptx-custom-data',
    fallbackStrategies: [
      'preview-image',
      'custom-data-roundtrip',
      'unsupported-warning',
    ],
  });
});

test('PPTX format extensions are protocol registry fields under extensions.pptx only', () => {
  const pptx = pptxAdapter();

  assert.deepEqual(pptx.PPTX_FORMAT_EXTENSIONS, expectedFormatExtensions);

  for (const fieldPath of expectedFormatExtensions) {
    const field = fieldRegistry.getByPath(fieldPath);
    assert.equal(field.fieldClass, 'formatExtension');
    assert.equal(field.owner, 'pptx-adapter');
    assert.equal(fieldPath.startsWith('extensions.pptx.'), true);
    assert.deepEqual(capabilityFor(fieldRegistry, fieldPath, 'pptx'), {
      read: 'native',
      write: 'native',
      persist: 'native',
    });
  }
});

test('PPTX contract capabilities describe custom data and explicit fallback resource strategy', () => {
  const {
    PptxContractCapabilities,
    PPTX_RESOURCE_FALLBACKS,
  } = pptxAdapter();

  assert.equal(PptxContractCapabilities.contractOnly, true);
  assert.equal(PptxContractCapabilities.boundary, 'semantic-model');
  assert.equal(PptxContractCapabilities.registry, 'protocol-field-registry');
  assert.equal(PptxContractCapabilities.customDataCarrier, 'pptx-custom-data');
  assert.deepEqual(PptxContractCapabilities.fallbackStrategies, [
    'preview-image',
    'custom-data-roundtrip',
    'unsupported-warning',
  ]);
  assert.deepEqual(PPTX_RESOURCE_FALLBACKS, {
    pdf: { visualOutput: 'preview-image', metadataPersistence: 'pptx-custom-data', fidelity: 'lossless-metadata' },
    ai: { visualOutput: 'preview-image', metadataPersistence: 'pptx-custom-data', fidelity: 'lossless-metadata' },
    psd: { visualOutput: 'preview-image', metadataPersistence: 'pptx-custom-data', fidelity: 'lossless-metadata' },
  });
});

test('PPTX page-number asset placement contract is fallback write with lossless custom-data persistence', () => {
  const { PptxContractCapabilities } = pptxAdapter();

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

  assert.deepEqual(PptxContractCapabilities.fieldStrategies['items[].asset.placement.pageNumber'], {
    write: 'fallback',
    persist: 'lossless',
    fallbackKind: 'preview-image',
    customDataCarrier: 'pptx-custom-data',
    customDataPath: 'htmlIndesign.items[].asset.placement.pageNumber',
    risk: 'editable-loss',
  });
});

test('PPTX README states the Stage 10 contract boundary and no package I/O implementation', () => {
  const readmePath = path.join(__dirname, '../../src/adapters/pptx/README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.match(readme, /contract-only/i);
  assert.match(readme, /no PPTX package read\/write implementation yet/i);
  assert.match(readme, /Semantic Model/);
  assert.match(readme, /protocol registry/);
  assert.match(readme, /extensions\.pptx\.\*/);
  assert.match(readme, /PDF\/AI\/PSD/);
  assert.match(readme, /metadata persists losslessly through custom data/i);
});
