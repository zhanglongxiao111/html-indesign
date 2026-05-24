const test = require('node:test');
const assert = require('node:assert/strict');

test('legacy-template wrappers expose existing builder and validator', () => {
  const legacy = require('../../src/legacy-template');
  assert.equal(typeof legacy.buildInstructions, 'function');
  assert.equal(typeof legacy.validate, 'function');
  assert.equal(typeof legacy.ERRORS, 'object');
});
