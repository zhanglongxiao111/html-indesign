const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = require('../../index');

test('public entry exposes protocol adapters semanticModel and writers after refactor', () => {
  assert.equal(typeof api.protocol.fieldRegistry.getByPath, 'function');
  assert.equal(typeof api.adapters.html.renderSnapshot, 'function');
  assert.equal(typeof api.adapters.html.snapshotToSemanticModel, 'function');
  assert.equal(typeof api.adapters.indesign.reverseSnapshotToSemanticModel, 'function');
  assert.equal(typeof api.adapters.indesign.blueprintMigrationToSemanticModel, 'function');
  assert.equal(typeof api.writers.indesign.semanticModelToInstructions, 'function');
  assert.equal(typeof api.writers.indesign.compileStyles, 'function');
  assert.equal(typeof api.writers.html.semanticModelToHtml, 'function');
});

test('old paged-html and indesign-reverse directories are removed after refactor', () => {
  const srcDir = path.join(__dirname, '../../src');
  assert.equal(fs.existsSync(path.join(srcDir, 'paged-html')), false);
  assert.equal(fs.existsSync(path.join(srcDir, 'indesign-reverse')), false);
});
