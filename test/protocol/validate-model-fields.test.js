const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateModelFields,
  scanModelPaths,
  fieldRegistry,
} = require('../../src/protocol');

test('scanModelPaths deterministically scans known model surfaces', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    assets: [{ path: 'drawings/site.pdf' }],
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        asset: { pageNumber: 2 },
        madeUpField: 1,
      }],
    }],
  };

  assert.deepEqual(scanModelPaths(model), [
    'document.id',
    'assets[].path',
    'pages[].id',
    'items[].asset.pageNumber',
    'pages[].items[].madeUpField',
  ]);
});

test('validateModelFields accepts registered model paths and warns for unknown paths by default', () => {
  const result = validateModelFields(fieldRegistry, [
    'assets[].path',
    'pages[].items[].madeUpField',
  ]);

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['assets[].path']);
  assert.deepEqual(result.unknown, ['pages[].items[].madeUpField']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_NOT_REGISTERED'
      && warning.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});

test('validateModelFields rejects unknown model paths in strict mode', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    assets: [{ path: 'drawings/site.pdf' }],
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        madeUpField: 1,
      }],
    }],
  };

  const result = validateModelFields(fieldRegistry, scanModelPaths(model), { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, [
    'document.id',
    'assets[].path',
    'pages[].id',
  ]);
  assert.deepEqual(result.unknown, ['pages[].items[].madeUpField']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'pages[].items[].madeUpField'
    )),
    true,
  );
});
