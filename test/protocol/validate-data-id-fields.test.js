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

test('scanDataIdFields only scans attribute names inside start tags', () => {
  assert.deepEqual(scanDataIdFields('<div>text data-id-page after</div>'), []);
  assert.deepEqual(scanDataIdFields('<div class="x data-id-page y"></div>'), []);
  assert.deepEqual(scanDataIdFields('<!-- data-id-page -->'), []);
  assert.deepEqual(scanDataIdFields('< data-id-page >'), []);
  assert.deepEqual(
    scanDataIdFields('<div data-id-pdf-page="2" data-id-page></div>'),
    ['data-id-pdf-page', 'data-id-page'],
  );
});

test('scanDataIdFields ignores pseudo tags inside raw text and RCDATA elements', () => {
  assert.deepEqual(scanDataIdFields('<script>const s = "<div data-id-page>";</script>'), []);
  assert.deepEqual(scanDataIdFields('<style>.x::before{content:"<div data-id-page>"}</style>'), []);
  assert.deepEqual(scanDataIdFields('<textarea><div data-id-page></textarea>'), []);
  assert.deepEqual(scanDataIdFields('<title><div data-id-page></title>'), []);
  assert.deepEqual(
    scanDataIdFields('<section data-id-pdf-page="2"><script>const s = "<div data-id-page>";</script><div data-id-asset-path="x"></div></section>'),
    ['data-id-pdf-page', 'data-id-asset-path'],
  );
});

test('scanDataIdFields requires raw text close tag name boundaries', () => {
  assert.deepEqual(
    scanDataIdFields('<script>const s = "</scripted><div data-id-page>";</script><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<style>.x{content:"</stylex><div data-id-page>"}</style><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<textarea></textareax><div data-id-page></textarea><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<title></titlex><div data-id-page></title><div data-id-pdf-page="2"></div>'),
    ['data-id-pdf-page'],
  );
  assert.deepEqual(
    scanDataIdFields('<section data-id-asset-path="x"><script></scripted><div data-id-page></script><div data-id-pdf-page="2"></div></section>'),
    ['data-id-asset-path', 'data-id-pdf-page'],
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

test('validateDataIdFields rejects retired data-id fields only in strict mode', () => {
  const nonStrict = validateDataIdFields(fieldRegistry, ['data-id-page']);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, []);
  assert.deepEqual(nonStrict.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'DATA_ID_FIELD_RETIRED'
      && warning.name === 'data-id-page'
    )),
    true,
  );

  const strict = validateDataIdFields(fieldRegistry, ['data-id-page'], { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, []);
  assert.deepEqual(strict.retired.map((item) => item.name), ['data-id-page']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'DATA_ID_FIELD_RETIRED'
      && error.name === 'data-id-page'
      && error.policy.writePolicy === 'forbidden'
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
