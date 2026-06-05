const test = require('node:test');
const assert = require('node:assert/strict');

const {
  capabilityFor,
  fieldRegistry,
  scanModelPaths,
  validateModelFields,
} = require('../../src/protocol');

function assertRegistered(path) {
  const field = fieldRegistry.getByPath(path);
  assert.ok(field, `${path} should be registered`);
  assert.equal(field.canonicalPath, path);
  assert.equal(field.lifecycle, 'active');
  return field;
}

test('synthesized style fields are registered with lifecycle and format capabilities', () => {
  for (const path of [
    'styles.synthesized[].token',
    'styles.synthesized[].displayName',
    'styles.synthesized[].kind',
    'styles.synthesized[].fingerprint',
    'styles.synthesized[].source',
    'styles.synthesized[].properties',
    'items[].styleRefs.synthesizedToken',
    'items[].styleRefs.synthesizedName',
    'items[].styleOverrides',
  ]) {
    const field = assertRegistered(path);
    assert.equal(field.owner, 'synthesized-styles');
    assert.deepEqual(capabilityFor(fieldRegistry, path, 'html'), {
      read: 'native',
      write: 'native',
      persist: 'native',
    });
    assert.deepEqual(capabilityFor(fieldRegistry, path, 'indesign'), {
      read: 'native',
      write: 'native',
      persist: 'native',
    });
  }

  assert.equal(
    fieldRegistry.getByPath('items[].styleRefs.synthesizedToken').html.writeAttrs[0],
    'data-id-style-token',
  );
  assert.deepEqual(
    fieldRegistry.getByPath('items[].styleRefs.synthesizedName').indesign.labelPaths,
    ['styleRefs.synthesizedName'],
  );
});

test('model field scanning accepts synthesized style registry references and overrides', () => {
  const model = {
    kind: 'DocumentModel',
    id: 'doc',
    styles: {
      synthesized: [{
        token: 'synth_line_001',
        displayName: '线条样式 01',
        kind: 'line',
        fingerprint: 'line:abc',
        source: 'indesign-observed',
        properties: {
          strokeStyle: '虚线（3 和 2）',
          strokeWeight: 0.2834645669,
        },
      }],
    },
    pages: [{
      id: 'p1',
      items: [{
        id: 'i1',
        styleRefs: {
          synthesizedToken: 'synth_line_001',
          synthesizedName: '线条样式 01',
        },
        styleOverrides: {
          line: {
            lineEndMarker: '箭头',
          },
        },
      }],
    }],
  };

  const scannedPaths = scanModelPaths(model);
  assert.deepEqual(scannedPaths.filter((path) => path.includes('synthesized')), [
    'styles.synthesized',
    'styles.synthesized[].token',
    'styles.synthesized[].displayName',
    'styles.synthesized[].kind',
    'styles.synthesized[].fingerprint',
    'styles.synthesized[].source',
    'styles.synthesized[].properties',
    'items[].styleRefs.synthesizedToken',
    'items[].styleRefs.synthesizedName',
  ]);
  assert.equal(scannedPaths.includes('items[].styleOverrides'), true);

  const strict = validateModelFields(fieldRegistry, scannedPaths, {
    strict: true,
    domains: ['styles', 'styleRefs'],
  });

  assert.equal(strict.valid, true);
  assert.deepEqual(strict.unknown, []);
});
