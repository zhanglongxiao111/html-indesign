const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fieldRegistry,
  validateLabelFields,
} = require('../../src/protocol');

test('validateLabelFields accepts registered common label payload fields', () => {
  const result = validateLabelFields(fieldRegistry, {
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: 'title',
    source: 'reverse-export',
    semantic: 'page-title',
    layout: 'cover-grid',
    role: 'text',
    styleRefs: {
      paragraphStyle: 'title-style',
      characterStyleToken: 'accent',
      objectStyle: 'title-frame',
      tableStyleToken: 'metrics-table',
      layer: 'Text',
    },
    sourceNode: { tagName: 'h1' },
    sourceFile: 'pages/cover.html',
    sourceText: 'Cover',
    sourceHtml: '<span>Cover</span>',
    sourceRuns: [{ text: 'Cover' }],
    structure: { parentId: 'cover-page' },
  }, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.errors.length, 0);
});

test('validateLabelFields rejects unknown label payload fields in strict mode', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    madeUpField: true,
  }, { strict: true });

  assert.equal(result.valid, false);
  assert.deepEqual(result.accepted, ['kind', 'id']);
  assert.deepEqual(result.unknown, ['madeUpField']);
  assert.equal(
    result.errors.some((error) => (
      error.code === 'LABEL_FIELD_NOT_REGISTERED'
      && error.path === 'madeUpField'
    )),
    true,
  );
});

test('validateLabelFields reports unknown fields in observation mode without accepting them', () => {
  const result = validateLabelFields(fieldRegistry, {
    kind: 'item',
    id: 'title',
    foreignSlot: 'legacy',
  }, { mode: 'observation' });

  assert.equal(result.valid, true);
  assert.deepEqual(result.accepted, ['kind', 'id']);
  assert.deepEqual(result.unknown, ['foreignSlot']);
  assert.deepEqual(result.observed, ['foreignSlot']);
  assert.equal(result.errors.length, 0);
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'LABEL_FIELD_NOT_REGISTERED'
      && warning.path === 'foreignSlot'
    )),
    true,
  );
});

test('validateLabelFields accepts registered nested style refs and source metadata', () => {
  const result = validateLabelFields(fieldRegistry, {
    styleRefs: {
      paragraphStyle: 'body',
      paragraphStyleToken: 'body-token',
      objectStyleToken: 'frame-token',
      layerToken: 'text-layer',
    },
    sourceNode: {
      tagName: 'p',
      attributes: { 'data-id-paragraph-style': 'body' },
    },
    sourceAncestorNodes: [{ tagName: 'section' }],
    sourceFile: 'pages/01.html',
  }, { strict: true });

  assert.equal(result.valid, true);
  assert.deepEqual(result.unknown, []);
});
