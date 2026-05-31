const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIELD_CLASSES,
  LIFECYCLES,
  isFieldClass,
  isLifecycle,
} = require('../../src/protocol');

test('isFieldClass accepts defined field classes and rejects legacy or unknown values', () => {
  for (const fieldClass of FIELD_CLASSES) {
    assert.equal(isFieldClass(fieldClass), true, fieldClass);
  }

  assert.equal(isFieldClass('legacy'), false);
  assert.equal(isFieldClass('unknown'), false);
});

test('isLifecycle accepts defined lifecycles and rejects legacy or unknown values', () => {
  for (const lifecycle of LIFECYCLES) {
    assert.equal(isLifecycle(lifecycle), true, lifecycle);
  }

  assert.equal(isLifecycle('legacy'), false);
  assert.equal(isLifecycle('unknown'), false);
});

test('lifecycle constants are immutable and do not expose live validation state', () => {
  assert.equal(Object.isFrozen(FIELD_CLASSES), true);
  assert.equal(Object.isFrozen(LIFECYCLES), true);

  assert.equal(typeof FIELD_CLASSES.add, 'undefined');
  assert.equal(typeof LIFECYCLES.add, 'undefined');
  assert.equal(isFieldClass('legacy'), false);
  assert.equal(isLifecycle('legacy'), false);
});
