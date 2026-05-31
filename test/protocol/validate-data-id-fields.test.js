const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateDataIdFields,
  scanDataIdFields,
  fieldRegistry,
} = require('../../src/protocol');

test('scanDataIdFields returns unique data-id attributes in first-seen order', () => {
  assert.deepEqual(
    scanDataIdFields('<div data-id-pdf-page="2" data-id-page="9" data-id-made-up="x"></div><span data-id-page="8"></span>'),
    ['data-id-pdf-page', 'data-id-page', 'data-id-made-up'],
  );
});

test('validateDataIdFields accepts active fields and reports unknown and retired fields as warnings by default', () => {
  const result = validateDataIdFields(fieldRegistry, [
    'data-id-pdf-page',
    'data-id-made-up',
    'data-id-page',
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['data-id-pdf-page']);
  assert.deepEqual(result.unknown, ['data-id-made-up']);
  assert.deepEqual(result.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_NOT_REGISTERED'
      && warning.name === 'data-id-made-up'
    )),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
      && warning.policy.writePolicy === 'forbidden'
    )),
    true,
  );
});

test('validateDataIdFields rejects unknown data-id fields in strict mode while keeping retired fields out of accepted', () => {
  const result = validateDataIdFields(fieldRegistry, [
    'data-id-pdf-page',
    'data-id-made-up',
    'data-id-page',
  ], { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['data-id-pdf-page']);
  assert.deepEqual(result.unknown, ['data-id-made-up']);
  assert.deepEqual(result.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'DATA_ID_FIELD_NOT_REGISTERED'
      && error.name === 'data-id-made-up'
    )),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
      && warning.policy.readPolicy === 'observe-only'
    )),
    true,
  );
});
