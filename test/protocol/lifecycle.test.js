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

test('lifecyclePolicyFor returns retired model path policies from retired registry entries', () => {
  const expectations = [
    ['items[].type', 'items[].sourceType'],
    ['items[].effects', 'items[].extensions.indesign.effects'],
    ['items[].textFrameStyle', 'items[].extensions.indesign.textFrameStyle'],
  ];

  for (const [path, replacedBy] of expectations) {
    const policy = lifecyclePolicyFor(fieldRegistry, path);

    assert.equal(policy.lifecycle, 'retired');
    assert.equal(policy.fieldClass, 'observation');
    assert.equal(policy.path, path);
    assert.equal(policy.readPolicy, 'retired');
    assert.equal(policy.writePolicy, 'forbidden');
    assert.equal(policy.replacedBy, replacedBy);
  }
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

test('lifecyclePolicyFor returns active lifecycle for active fake entries without retired metadata', () => {
  assert.deepEqual(
    lifecyclePolicyFor(fakeActiveRegistry(null), 'items[].bad'),
    {
      lifecycle: 'active',
      fieldClass: 'canonical',
      canonicalPath: 'items[].bad',
      readPolicy: null,
      writePolicy: null,
      replacedBy: null,
    },
  );
});

test('lifecyclePolicyFor rejects retired html attr policies on active query entries', () => {
  assert.throws(
    () => lifecyclePolicyFor(fakeActiveRegistry({
      htmlAttrs: [{
        name: 'data-id-page',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      }],
    }), 'items[].bad'),
    /LIFECYCLE_POLICY_INVALID:items\[\]\.bad/,
  );
});

test('lifecyclePolicyFor rejects stale retired html attr aliases', () => {
  assert.throws(
    () => lifecyclePolicyFor(fieldRegistry, 'html.data-id-page'),
    /FIELD_NOT_REGISTERED:html\.data-id-page/,
  );
});

test('lifecyclePolicyFor rejects retired html attr policies without a name', () => {
  const registry = fakeRetiredRegistry([{
    readPolicy: 'observe-only',
    writePolicy: 'forbidden',
    replacedBy: 'data-id-pdf-page',
  }]);

  assert.throws(
    () => lifecyclePolicyFor(registry, 'retired.bad'),
    /LIFECYCLE_POLICY_INVALID:retired\.bad/,
  );
});

test('lifecyclePolicyFor rejects retired entries without exactly one html attr policy', () => {
  assert.throws(
    () => lifecyclePolicyFor(fakeRetiredRegistry([]), 'retired.bad'),
    /LIFECYCLE_POLICY_INVALID:retired\.bad/,
  );

  assert.throws(
    () => lifecyclePolicyFor(fakeRetiredRegistry([
      {
        name: 'data-id-old-a',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
      {
        name: 'data-id-old-b',
        readPolicy: 'observe-only',
        writePolicy: 'forbidden',
      },
    ]), 'retired.bad'),
    /LIFECYCLE_POLICY_INVALID:retired\.bad/,
  );
});

test('lifecyclePolicyFor rejects empty retired optional metadata', () => {
  assert.throws(
    () => lifecyclePolicyFor(fakeRetiredRegistry([{
      name: 'data-id-page',
      readPolicy: 'observe-only',
      writePolicy: 'forbidden',
      replacedBy: '',
    }]), 'retired.bad'),
    /LIFECYCLE_POLICY_INVALID:retired\.bad/,
  );

  assert.throws(
    () => lifecyclePolicyFor(fakeRetiredRegistry([{
      name: 'data-id-page',
      readPolicy: 'observe-only',
      writePolicy: 'forbidden',
      reason: '',
    }]), 'retired.bad'),
    /LIFECYCLE_POLICY_INVALID:retired\.bad/,
  );
});

test('lifecyclePolicyFor accepts non-empty retired optional metadata', () => {
  const policy = lifecyclePolicyFor(fakeRetiredRegistry([{
    name: 'data-id-page',
    readPolicy: 'observe-only',
    writePolicy: 'forbidden',
    replacedBy: 'data-id-pdf-page',
    reason: 'ambiguous-with-page-identity',
  }]), 'retired.bad');

  assert.equal(policy.replacedBy, 'data-id-pdf-page');
  assert.equal(policy.readPolicy, 'observe-only');
  assert.equal(policy.writePolicy, 'forbidden');
});

function fakeRetiredRegistry(htmlAttrs) {
  return {
    getByPath(fieldPath) {
      return fieldPath === 'retired.bad'
        ? {
          canonicalPath: 'retired.bad',
          fieldClass: 'observation',
          lifecycle: 'retired',
          retired: { htmlAttrs },
        }
        : null;
    },
  };
}

function fakeActiveRegistry(retired) {
  return {
    getByPath(fieldPath) {
      return fieldPath === 'items[].bad'
        ? {
          canonicalPath: 'items[].bad',
          fieldClass: 'canonical',
          lifecycle: 'active',
          ...(retired ? { retired } : {}),
        }
        : null;
    },
  };
}
