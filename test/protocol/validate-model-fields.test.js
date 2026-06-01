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

test('validateModelFields rejects nested ghosts on registered root surfaces in strict mode', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    parentPages: [{ id: 'parent-a', ghost: true }],
    layers: [{ token: 'text', ghost: true }],
    styles: [{ name: 'Title', ghost: true }],
    pages: [{
      id: 'p1',
      effectiveLabel: { semantic: 'agenda-page', ghost: true },
      observedLabel: { rejectionReasons: ['unknown-layout'], ghost: true },
      items: [],
    }],
  };

  const scannedPaths = scanModelPaths(model);
  for (const path of [
    'parentPages[].ghost',
    'layers[].ghost',
    'styles[].ghost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
  ]) {
    assert.equal(scannedPaths.includes(path), true, `${path} should be scanned`);
  }

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.unknown, [
    'parentPages[].ghost',
    'layers[].ghost',
    'styles[].ghost',
    'pages[].effectiveLabel.ghost',
    'pages[].observedLabel.ghost',
  ]);
  for (const path of strict.unknown) {
    assert.equal(
      strict.errors.some((error) => (
        error.code === 'MODEL_FIELD_NOT_REGISTERED'
        && error.path === path
      )),
      true,
      `${path} should be a strict error`,
    );
  }
});

test('validateModelFields rejects unknown style collection fields in strict mode', () => {
  const scannedPaths = scanModelPaths({
    kind: 'DocumentModel',
    styles: {
      paragraphStyles: {
        title: {
          name: 'Title',
          css: 'font-size:32pt',
          ghost: true,
        },
      },
      ghostCollection: {},
    },
  });

  assert.equal(scannedPaths.includes('styles.paragraphStyles[].ghost'), true);
  assert.equal(scannedPaths.includes('styles.ghostCollection'), true);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.unknown, [
    'styles.paragraphStyles[].ghost',
    'styles.ghostCollection',
  ]);
});

test('validateModelFields reports model root unknown fields in warning-only and strict modes', () => {
  const model = {
    kind: 'DocumentModel',
    madeUpRoot: 1,
    pages: [{ id: 'p1', items: [] }],
  };
  const scannedPaths = scanModelPaths(model);

  assert.deepEqual(scannedPaths, [
    'madeUpRoot',
    'pages[].id',
  ]);

  const nonStrict = validateModelFields(fieldRegistry, scannedPaths);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, ['pages[].id']);
  assert.deepEqual(nonStrict.unknown, ['madeUpRoot']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_NOT_REGISTERED'
      && warning.path === 'madeUpRoot'
    )),
    true,
  );

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, ['pages[].id']);
  assert.deepEqual(strict.unknown, ['madeUpRoot']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'madeUpRoot'
    )),
    true,
  );
});

test('validateModelFields rejects retired paths only in strict mode', () => {
  const nonStrict = validateModelFields(fieldRegistry, ['retired.htmlAttrs.dataIdPage']);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, []);
  assert.deepEqual(nonStrict.retired.map((item) => item.path), ['retired.htmlAttrs.dataIdPage']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'MODEL_FIELD_RETIRED'
      && warning.path === 'retired.htmlAttrs.dataIdPage'
    )),
    true,
  );

  const strict = validateModelFields(fieldRegistry, ['retired.htmlAttrs.dataIdPage'], { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, []);
  assert.deepEqual(strict.retired.map((item) => item.path), ['retired.htmlAttrs.dataIdPage']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_RETIRED'
      && error.path === 'retired.htmlAttrs.dataIdPage'
    )),
    true,
  );
});

test('scanModelPaths scans effectiveLabel nested registered and unknown fields', () => {
  const scannedPaths = scanModelPaths({
    pages: [{
      items: [{
        effectiveLabel: {
          semantic: 'figure',
          sourceNode: {},
          madeUp: 1,
        },
      }],
    }],
  });

  assert.deepEqual(scannedPaths, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.semantic',
    'effectiveLabel.sourceNode',
    'items[].effectiveLabel.madeUp',
  ]);

  const strict = validateModelFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, [
    'items[].effectiveLabel',
    'items[].effectiveLabel.semantic',
    'effectiveLabel.sourceNode',
  ]);
  assert.deepEqual(strict.unknown, ['items[].effectiveLabel.madeUp']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'MODEL_FIELD_NOT_REGISTERED'
      && error.path === 'items[].effectiveLabel.madeUp'
    )),
    true,
  );
});
