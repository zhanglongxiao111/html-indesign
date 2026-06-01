const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../index');

test('public API exposes protocol adapters semanticModel writers and historical-template entry points', () => {
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
  assert.equal(typeof api.historicalTemplate.buildInstructions, 'function');
  assert.equal(typeof api.historicalTemplate.validate, 'function');
});
