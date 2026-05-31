const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FIELD_CLASSES,
  LIFECYCLES,
  fieldRegistry,
  isFieldClass,
  isLifecycle,
  lifecyclePolicyFor,
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

test('lifecyclePolicyFor returns retired html attr policy from the retired registry entry', () => {
  const policy = lifecyclePolicyFor(fieldRegistry, 'retired.htmlAttrs.dataIdPage');

  assert.equal(policy.lifecycle, 'retired');
  assert.equal(policy.fieldClass, 'observation');
  assert.equal(policy.canonicalPath, 'retired.htmlAttrs.dataIdPage');
  assert.equal(policy.name, 'data-id-page');
  assert.equal(policy.readPolicy, 'observe-only');
  assert.equal(policy.writePolicy, 'forbidden');
  assert.equal(policy.replacedBy, 'data-id-pdf-page');
  assert.notEqual(policy.canonicalPath, 'items[].asset.placement.pageNumber');
});

test('lifecyclePolicyFor returns active lifecycle without retired policy metadata', () => {
  const policy = lifecyclePolicyFor(fieldRegistry, 'items[].asset.placement.pageNumber');

  assert.deepEqual(policy, {
    lifecycle: 'active',
    fieldClass: 'canonical',
    canonicalPath: 'items[].asset.placement.pageNumber',
    readPolicy: null,
    writePolicy: null,
    replacedBy: null,
  });
});

test('lifecyclePolicyFor rejects stale retired html attr aliases', () => {
  assert.throws(
    () => lifecyclePolicyFor(fieldRegistry, 'html.data-id-page'),
    /FIELD_NOT_REGISTERED:html\.data-id-page/,
  );
});
