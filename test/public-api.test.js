const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../index');

test('public API exposes paged-html and legacy-template entry points', () => {
  assert.equal(typeof api.pagedHtml.renderSnapshot, 'function');
  assert.equal(typeof api.legacyTemplate.buildInstructions, 'function');
  assert.equal(typeof api.legacyTemplate.validate, 'function');
});
