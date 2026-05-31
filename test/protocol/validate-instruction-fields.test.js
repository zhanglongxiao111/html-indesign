const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateInstructionFields,
  scanInstructionPaths,
  fieldRegistry,
} = require('../../src/protocol');

test('scanInstructionPaths emits instruction paths without the registry namespace prefix', () => {
  const instructions = {
    pages: [{
      items: [{
        type: 'GRAPHIC',
        placed: {
          pageNumber: 2,
          madeUp: 1,
        },
      }],
    }],
  };

  assert.deepEqual(scanInstructionPaths(instructions), [
    'pages[].items[].placed.pageNumber',
    'pages[].items[].placed.madeUp',
  ]);
});

test('validateInstructionFields resolves scanned paths through the instructions namespace', () => {
  const instructions = {
    pages: [{
      items: [{
        type: 'GRAPHIC',
        placed: { pageNumber: 2 },
      }],
    }],
  };

  const result = validateInstructionFields(fieldRegistry, scanInstructionPaths(instructions), { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['pages[].items[].placed.pageNumber']);
  assert.deepEqual(result.unknown, []);
  assert.deepEqual(result.errors, []);
});

test('validateInstructionFields warns by default and errors in strict mode for unknown instruction fields', () => {
  const scannedPaths = scanInstructionPaths({
    pages: [{
      items: [{
        type: 'GRAPHIC',
        placed: {
          pageNumber: 2,
          madeUp: 1,
        },
      }],
    }],
  });

  const nonStrict = validateInstructionFields(fieldRegistry, scannedPaths);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, ['pages[].items[].placed.pageNumber']);
  assert.deepEqual(nonStrict.unknown, ['pages[].items[].placed.madeUp']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && warning.path === 'pages[].items[].placed.madeUp'
      && warning.registryPath === 'instructions.pages[].items[].placed.madeUp'
    )),
    true,
  );

  const strict = validateInstructionFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && error.path === 'pages[].items[].placed.madeUp'
      && error.registryPath === 'instructions.pages[].items[].placed.madeUp'
    )),
    true,
  );
});

test('validateInstructionFields reports instruction root and page unknown fields', () => {
  const scannedPaths = scanInstructionPaths({
    madeUpRoot: 1,
    pages: [{
      madeUpPage: 2,
      items: [{
        type: 'GRAPHIC',
        placed: { pageNumber: 2 },
      }],
    }],
  });

  assert.deepEqual(scannedPaths, [
    'madeUpRoot',
    'pages[].madeUpPage',
    'pages[].items[].placed.pageNumber',
  ]);

  const nonStrict = validateInstructionFields(fieldRegistry, scannedPaths);
  assert.equal(nonStrict.valid, true);
  assert.deepEqual(nonStrict.accepted, ['pages[].items[].placed.pageNumber']);
  assert.deepEqual(nonStrict.unknown, ['madeUpRoot', 'pages[].madeUpPage']);
  assert.equal(nonStrict.errors.length, 0);
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && warning.path === 'madeUpRoot'
      && warning.registryPath === 'instructions.madeUpRoot'
    )),
    true,
  );
  assert.equal(
    nonStrict.warnings.some((warning) => (
      warning.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && warning.path === 'pages[].madeUpPage'
      && warning.registryPath === 'instructions.pages[].madeUpPage'
    )),
    true,
  );

  const strict = validateInstructionFields(fieldRegistry, scannedPaths, { strict: true });
  assert.equal(strict.valid, false);
  assert.deepEqual(strict.accepted, ['pages[].items[].placed.pageNumber']);
  assert.deepEqual(strict.unknown, ['madeUpRoot', 'pages[].madeUpPage']);
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && error.path === 'madeUpRoot'
      && error.registryPath === 'instructions.madeUpRoot'
    )),
    true,
  );
  assert.equal(
    strict.errors.some((error) => (
      error.code === 'INSTRUCTION_FIELD_NOT_REGISTERED'
      && error.path === 'pages[].madeUpPage'
      && error.registryPath === 'instructions.pages[].madeUpPage'
    )),
    true,
  );
});
