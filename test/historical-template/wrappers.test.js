const test = require('node:test');
const assert = require('node:assert/strict');

test('historical-template wrappers expose existing builder and validator for migration checks', () => {
  const historical = require('../../src/historical-template');
  assert.equal(typeof historical.buildInstructions, 'function');
  assert.equal(typeof historical.validate, 'function');
  assert.equal(typeof historical.ERRORS, 'object');
});
