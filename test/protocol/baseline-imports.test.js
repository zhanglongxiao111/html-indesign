const test = require('node:test');
const assert = require('node:assert/strict');

const api = require('../../index');

test('current public API exposes protocol-relevant module entry points', () => {
  assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
  assert.equal(typeof api.pagedHtml.compileInstructions, 'function');
  assert.equal(typeof api.semanticModel.snapshotToSemanticModel, 'function');
  assert.equal(typeof api.indesignReverse.reverseSnapshotToSemanticModel, 'function');
});
