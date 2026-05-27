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
