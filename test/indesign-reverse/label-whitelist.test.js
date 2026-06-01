const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReverseLabel } = require('../../src/indesign-reverse/label-whitelist');

const preset = {
  semantics: {
    'page-title': { roles: ['text'] },
    'hero-image': { roles: ['graphic'] },
  },
  layouts: { 'cover-grid': {} },
  styles: {
    paragraphStyles: { 'page-title': {} },
    objectStyles: { 'hero-frame': {} },
  },
};

test('validateReverseLabel accepts fields present in the active semantic preset', () => {
  const result = validateReverseLabel({
    semantic: 'page-title',
    role: 'text',
    layout: 'cover-grid',
    styleRefs: { paragraphStyle: 'page-title' },
  }, { preset });

  assert.equal(result.status, 'accepted');
  assert.equal(result.effective.semantic, 'page-title');
  assert.equal(result.effective.role, 'text');
  assert.equal(result.effective.layout, 'cover-grid');
  assert.deepEqual(result.rejectionReasons, []);
});

test('validateReverseLabel keeps valid semantic but rejects unknown structure fields', () => {
  const result = validateReverseLabel({
    semantic: 'page-title',
    role: 'text',
    layout: 'copied-template-grid',
    styleRefs: { paragraphStyle: 'missing-style' },
  }, { preset });

  assert.equal(result.status, 'partial');
  assert.equal(result.effective.semantic, 'page-title');
  assert.equal(result.effective.layout, null);
  assert.equal(result.observed.layout, 'copied-template-grid');
  assert.deepEqual(result.rejectionReasons.sort(), ['unknown-layout', 'unknown-paragraph-style'].sort());
});

test('validateReverseLabel observes unknown semantic instead of accepting copied labels', () => {
  const result = validateReverseLabel({ semantic: 'foreign-slot', role: 'text' }, { preset });

  assert.equal(result.status, 'observed');
  assert.equal(result.effective.semantic, null);
  assert.equal(result.observed.semantic, 'foreign-slot');
  assert.deepEqual(result.rejectionReasons, ['unknown-semantic']);
});

test('validateReverseLabel treats standard style-map tokens as known semantics', () => {
  const result = validateReverseLabel({
    semantic: 'metric-card',
    role: 'graphic',
    styleRefs: { objectStyle: 'metric-card' },
  }, {
    preset: {
      styleNameMap: {
        objectStyles: { 'metric-card': '指标卡片' },
      },
    },
  });

  assert.equal(result.status, 'accepted');
  assert.equal(result.effective.semantic, 'metric-card');
  assert.equal(result.effective.styleRefs.objectStyle, 'metric-card');
});

test('validateReverseLabel reports unknown payload fields without making them effective', () => {
  const result = validateReverseLabel({
    semantic: 'page-title',
    role: 'text',
    madeUpField: 'copied-template-value',
  }, { preset, warnFields: true });

  assert.equal(result.status, 'partial');
  assert.equal(result.effective.semantic, 'page-title');
  assert.equal(result.effective.madeUpField, undefined);
  assert.equal(result.observed.madeUpField, 'copied-template-value');
  assert.equal(result.rejectedFields.madeUpField, 'label-field-not-registered');
  assert.equal(
    result.warnings.some((warning) => (
      warning.code === 'LABEL_FIELD_NOT_REGISTERED'
      && warning.path === 'madeUpField'
    )),
    true,
  );
});

test('validateReverseLabel accepts registered common and nested payload fields in field strict mode', () => {
  const result = validateReverseLabel({
    protocol: 'html-indesign',
    version: 1,
    kind: 'item',
    id: 'title',
    semantic: 'page-title',
    role: 'text',
    styleRefs: { paragraphStyle: 'page-title' },
    sourceFile: 'pages/cover.html',
    sourceText: 'Cover',
    sourceHtml: '<span>Cover</span>',
    sourceRuns: [{ text: 'Cover' }],
    structure: { parentId: 'cover' },
  }, { preset, strictFields: true });

  assert.equal(result.valid, true);
  assert.equal(result.status, 'accepted');
  assert.equal(result.effective.sourceFile, 'pages/cover.html');
  assert.deepEqual(result.fieldValidation.unknown, []);
});
