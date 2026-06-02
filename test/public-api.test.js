const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../index');

test('public API exposes protocol adapters semanticModel and writers entry points', () => {
  assert.equal(typeof api.protocol.fieldRegistry.getByPath, 'function');
  assert.equal(typeof api.adapters.html.renderSnapshot, 'function');
  assert.equal(typeof api.adapters.html.snapshotToSemanticModel, 'function');
  assert.equal(typeof api.adapters.html.validateAuthoringRules, 'function');
  assert.equal(typeof api.adapters.indesign.readReverseSnapshot, 'function');
  assert.equal(typeof api.adapters.indesign.reverseSnapshotToSemanticModel, 'function');
  assert.equal(typeof api.adapters.indesign.blueprintMigrationToSemanticModel, 'function');
  assert.equal(typeof api.semanticModel.validateSemanticModel, 'function');
  assert.equal(typeof api.writers.indesign.compileStyles, 'function');
  assert.equal(typeof api.writers.indesign.compileInstructions, 'function');
  assert.equal(typeof api.writers.indesign.validateInstructions, 'function');
  assert.equal(typeof api.writers.indesign.semanticModelToInstructions, 'function');
  assert.equal(typeof api.writers.html.semanticModelToHtml, 'function');
  assert.equal(typeof api.writers.html.writeReverseAuthorPackage, 'function');
});

test('public API does not expose retired facades historical template or semantic-model conversion entry points', () => {
  assert.equal(api.pagedHtml, undefined);
  assert.equal(api.indesignReverse, undefined);
  assert.equal(api.historicalTemplate, undefined);
  assert.equal(api.adapters.pptx.PptxReaderContract.contractOnly, true);
  assert.equal(api.adapters.pptx.PptxWriterContract.contractOnly, true);
  assert.equal(api.adapters.pptx.readPptxPackage, undefined);
  assert.equal(api.adapters.pptx.writePptxPackage, undefined);
  assert.equal(api.adapters.pptx.readPptx, undefined);
  assert.equal(api.adapters.pptx.writePptx, undefined);
  assert.deepEqual(Object.keys(api.semanticModel), ['validateSemanticModel']);
  assert.equal(api.semanticModel.snapshotToSemanticModel, undefined);
  assert.equal(api.semanticModel.semanticModelToInstructions, undefined);
});

test('PPTX public API is exported with explicit keys instead of silent object-spread merge', () => {
  const publicEntrySource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

  assert.deepEqual(Object.keys(api.adapters.pptx).sort(), [
    'PPTX_FORMAT_EXTENSIONS',
    'PPTX_RESOURCE_FALLBACKS',
    'PptxContractCapabilities',
    'PptxReaderContract',
    'PptxWriterContract',
  ].sort());
  assert.doesNotMatch(publicEntrySource, /\.{3}pptxContracts\b/);
  assert.doesNotMatch(publicEntrySource, /\.{3}pptxCapabilities\b/);
});
