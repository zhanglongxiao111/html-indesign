const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../index');

test('public API exposes paged-html and historical-template entry points', () => {
  assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
  assert.equal(typeof api.pagedHtml.compileStyles, 'function');
  assert.equal(typeof api.pagedHtml.compileInstructions, 'function');
  assert.equal(typeof api.pagedHtml.validateAuthoringRules, 'function');
  assert.equal(typeof api.pagedHtml.validateInstructions, 'function');
  assert.equal(typeof api.semanticModel.snapshotToSemanticModel, 'function');
  assert.equal(typeof api.semanticModel.semanticModelToInstructions, 'function');
  assert.equal(typeof api.indesignReverse.reverseSnapshotToSemanticModel, 'function');
  assert.equal(typeof api.indesignReverse.semanticModelToHtml, 'function');
  assert.equal(typeof api.historicalTemplate.buildInstructions, 'function');
  assert.equal(typeof api.historicalTemplate.validate, 'function');
});
